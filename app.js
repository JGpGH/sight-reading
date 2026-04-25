const TREBLE_NOTES = {
  60: 'C',  62: 'D',  64: 'E',  65: 'F',  67: 'G',  69: 'A',  71: 'B',
  72: 'c',  74: 'd',  76: 'e',  77: 'f',  79: 'g',  81: 'a',  83: 'b'
};

const TREBLE_FLATS = {
  61: '_D',  63: '_E',  66: '_G',  68: '_A',  70: '_B',
  73: '_d',  75: '_e',  78: '_g',  80: '_a',  82: '_b'
};

const TREBLE_SHARPS = {
  61: '^C',  63: '^D',  66: '^F',  68: '^G',  70: '^A',
  73: '^c',  75: '^d',  78: '^f',  80: '^g',  82: '^a'
};

const BASS_NOTES = {
  36: 'C,,', 38: 'D,,', 40: 'E,,', 41: 'F,,', 43: 'G,,', 45: 'A,,', 47: 'B,,',
  48: 'C,',  50: 'D,',  52: 'E,',  53: 'F,',  55: 'G,',  57: 'A,',  59: 'B,'
};

const BASS_FLATS = {
  37: '_D,,', 39: '_E,,', 42: '_G,,', 44: '_A,,', 46: '_B,,',
  49: '_D,',  51: '_E,',  54: '_G,',  56: '_A,',  58: '_B,'
};

const BASS_SHARPS = {
  37: '^C,,', 39: '^D,,', 42: '^F,,', 44: '^G,,', 46: '^A,,',
  49: '^C,',  51: '^D,',  54: '^F,',  56: '^G,',  58: '^A,'
};

// pitch class (midiNote % 12) → letter name
const PITCH_CLASS_NAMES = {
  0: 'C', 1: 'Db', 2: 'D', 3: 'Eb', 4: 'E', 5: 'F',
  6: 'Gb', 7: 'G', 8: 'Ab', 9: 'A', 10: 'Bb', 11: 'B'
};

const state = {
  mode: 'right',
  currentMidi: null,
  currentClef: 'treble',
  currentToken: null,
  correct: 0,
  total: 0,
  waiting: true
};

function getEntries(clef) {
  const naturals = clef === 'treble' ? TREBLE_NOTES : BASS_NOTES;
  const flats    = clef === 'treble' ? TREBLE_FLATS : BASS_FLATS;
  const sharps   = clef === 'treble' ? TREBLE_SHARPS : BASS_SHARPS;
  return [
    ...Object.entries(naturals),
    ...Object.entries(flats),
    ...Object.entries(sharps),
  ];
}

function buildABC(trebleToken, bassToken) {
  return [
    'X:1',
    'M:4/4',
    'L:1/4',
    'K:C',
    '%%score {1} {2}',
    'V:1 clef=treble name="Right"',
    trebleToken + ' |',
    'V:2 clef=bass name="Left"',
    bassToken + ' |'
  ].join('\n');
}

function pickNote() {
  let clef;
  if (state.mode === 'right') clef = 'treble';
  else if (state.mode === 'left') clef = 'bass';
  else clef = Math.random() < 0.5 ? 'treble' : 'bass';

  state.currentClef = clef;
  const entries = getEntries(clef).filter(([m]) => parseInt(m) !== state.currentMidi);
  const [midiStr, token] = entries[Math.floor(Math.random() * entries.length)];
  state.currentMidi = parseInt(midiStr);
  state.currentToken = token;
}

function renderNote() {
  const noteToken = state.currentToken + '1';
  const abc = state.currentClef === 'treble'
    ? buildABC(noteToken, 'z4')
    : buildABC('z4', noteToken);
  ABCJS.renderAbc('notation', abc, {
    responsive: 'resize',
    scale: 1.5,
    paddingtop: 20,
    paddingbottom: 20,
    paddingleft: 40,
    paddingright: 40
  });
}

function showNote() {
  state.waiting = true;
  clearFeedback();
  pickNote();
  renderNote();
}

function repeatNote() {
  state.waiting = true;
  clearFeedback();
  renderNote();
}

const noteAudios = Object.fromEntries(
  ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'].map(n => [n, new Audio(`notes/${n}.mp3`)])
);
const failAudio = new Audio('fail.mp3');

function checkNote(playedMidi) {
  if (!state.waiting) return;
  state.waiting = false;
  state.total++;

  const playedClass = playedMidi % 12;
  const expectedClass = state.currentMidi % 12;

  if (playedClass === expectedClass) {
    state.correct++;
    noteAudios[PITCH_CLASS_NAMES[expectedClass]].play();
    showFeedback('Correct!', true);
    updateScore();
    setTimeout(() => showNote(), 200);
  } else {
    const expected = PITCH_CLASS_NAMES[expectedClass] ?? '?';
    const played = PITCH_CLASS_NAMES[playedClass] ?? `MIDI ${playedMidi}`;
    showFeedback(`Wrong — you played ${played}, expected ${expected}`, false);
    updateScore();
    setTimeout(() => repeatNote(), 800);
  }
}

function showFeedback(msg, correct) {
  const el = document.getElementById('feedback');
  el.textContent = msg;
  if (!correct) {
    failAudio.play();
  }
  el.className = correct ? 'correct' : 'wrong';
  el.style.opacity = '1';
}

function clearFeedback() {
  const el = document.getElementById('feedback');
  el.style.opacity = '0';
}

function updateScore() {
  document.getElementById('score-display').textContent =
    `Score: ${state.correct} / ${state.total}`;
}

function setMidiStatus(connected) {
  const el = document.getElementById('midi-status');
  el.textContent = connected ? 'MIDI: Connected' : 'MIDI: Not Connected';
  el.className = connected ? 'midi-ok' : 'midi-err';
}

function handleMIDIMessage(event) {
  const [status, note, velocity] = event.data;
  const isNoteOn = (status & 0xf0) === 0x90 && velocity > 0;
  if (!isNoteOn) return;
  checkNote(note);
}

async function initMIDI() {
  if (!navigator.requestMIDIAccess) {
    setMidiStatus(false);
    return;
  }
  try {
    const access = await navigator.requestMIDIAccess();
    access.inputs.forEach(input => { input.onmidimessage = handleMIDIMessage; });
    setMidiStatus(access.inputs.size > 0);
    access.onstatechange = (e) => {
      if (e.port.type === 'input' && e.port.state === 'connected') {
        e.port.onmidimessage = handleMIDIMessage;
        setMidiStatus(true);
      }
    };
  } catch (err) {
    setMidiStatus(false);
    console.warn('MIDI access denied:', err);
  }
}

document.querySelectorAll('.mode-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    state.mode = btn.dataset.mode;
    dismissOverlay();
    showNote();
  });
});

document.getElementById('skip-btn').addEventListener('click', () => {
  dismissOverlay();
  if (state.waiting) showNote();
});

document.getElementById('volume-slider').addEventListener('input', (e) => {
  const vol = parseFloat(e.target.value);
  Object.values(noteAudios).forEach(a => { a.volume = vol; });
  failAudio.volume = vol;
});

function dismissOverlay() {
  document.getElementById('play-overlay').style.display = 'none';
  document.getElementById('sheet-area').classList.add('ready');
  document.getElementById('notation').classList.add('visible');
}

document.getElementById('play-btn').addEventListener('click', () => {
  dismissOverlay();
  showNote();
});

document.addEventListener('DOMContentLoaded', async () => {
  await initMIDI();
});
