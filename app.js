const TREBLE_NOTES = {
  60: 'C',  62: 'D',  64: 'E',  65: 'F',  67: 'G',  69: 'A',  71: 'B',
  72: 'c',  74: 'd',  76: 'e',  77: 'f',  79: 'g',  81: 'a',  83: 'b'
};

const BASS_NOTES = {
  36: 'C,,', 38: 'D,,', 40: 'E,,', 41: 'F,,', 43: 'G,,', 45: 'A,,', 47: 'B,,',
  48: 'C,',  50: 'D,',  52: 'E,',  53: 'F,',  55: 'G,',  57: 'A,',  59: 'B,'
};

// pitch class (midiNote % 12) → letter name
const PITCH_CLASS_NAMES = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };

const state = {
  mode: 'right',
  currentMidi: null,
  currentClef: 'treble',
  correct: 0,
  total: 0,
  waiting: true
};

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
  const map = clef === 'treble' ? TREBLE_NOTES : BASS_NOTES;
  const keys = Object.keys(map);
  const midi = parseInt(keys[Math.floor(Math.random() * keys.length)]);
  state.currentMidi = midi;
  return { midi, clef, map };
}

function renderNote(midi, clef) {
  const map = clef === 'treble' ? TREBLE_NOTES : BASS_NOTES;
  const noteToken = map[midi] + '1';
  const abc = clef === 'treble'
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
  const { midi, clef } = pickNote();
  renderNote(midi, clef);
}

function repeatNote() {
  state.waiting = true;
  clearFeedback();
  renderNote(state.currentMidi, state.currentClef);
}

const successAudio = new Audio('success.mp3');
const failAudio = new Audio('fail.mp3');

function checkNote(playedMidi) {
  if (!state.waiting) return;
  state.waiting = false;
  state.total++;

  const playedClass = playedMidi % 12;
  const expectedClass = state.currentMidi % 12;

  if (playedClass === expectedClass) {
    state.correct++;
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
  if (correct) {
    successAudio.play();
  } else {
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
    showNote();
  });
});

document.getElementById('skip-btn').addEventListener('click', () => {
  if (state.waiting) showNote();
});

document.getElementById('volume-slider').addEventListener('input', (e) => {
  const vol = parseFloat(e.target.value);
  successAudio.volume = vol;
  failAudio.volume = vol;
});

document.addEventListener('DOMContentLoaded', async () => {
  await initMIDI();
  showNote();
});
