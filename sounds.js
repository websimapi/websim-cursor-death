// Simple Web Audio-based sound system for quiet synthesized SFX

let audioCtx = null;
let unlocked = false;
let bgmAudio = null; // background music element

function ensureAudioContext() {
  if (audioCtx) return audioCtx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  audioCtx = new AC();
  // Try to unlock on first user interaction
  const unlock = () => {
    if (!audioCtx) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume().catch(() => {});
    }
    unlocked = true;
    // start background music once audio is unlocked
    initBackgroundMusic();
    window.removeEventListener("pointerdown", unlock);
    window.removeEventListener("touchstart", unlock);
    window.removeEventListener("click", unlock);
  };
  window.addEventListener("pointerdown", unlock);
  window.addEventListener("touchstart", unlock);
  window.addEventListener("click", unlock);
  return audioCtx;
}

// initialize looping background music at 50% volume
function initBackgroundMusic() {
  if (!bgmAudio) {
    bgmAudio = new Audio("/resonance (1).mp3");
    bgmAudio.loop = true;
    bgmAudio.volume = 0.1; // lowered to 10% volume
  }
  // always attempt to play immediately; browser may defer until allowed
  bgmAudio.play().catch(() => {});
}

export function initAudio() {
  ensureAudioContext();
  // attempt to start bgm early; real start will happen on unlock
  initBackgroundMusic();
}

function playTone({ freq = 440, duration = 0.1, type = "sine", volume = 0.05, attack = 0.01, decay = 0.05, startTime } = {}) {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = startTime || ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = type;
  osc.frequency.setValueAtTime(freq, now);

  const maxGain = Math.max(0, Math.min(volume, 0.15)); // clamp quiet
  gain.gain.setValueAtTime(0, now);
  gain.gain.linearRampToValueAtTime(maxGain, now + attack);
  gain.gain.linearRampToValueAtTime(0, now + attack + decay + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(now);
  osc.stop(now + attack + decay + duration + 0.05);
}

// Public SFX helpers (all intentionally quiet)

export function playClickBeginHellSound() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  // softer, less bit-crushed combo
  playTone({ freq: 220, duration: 0.14, type: "triangle", volume: 0.035, attack: 0.01, decay: 0.09, startTime: now });
  playTone({ freq: 440, duration: 0.12, type: "sine", volume: 0.03, attack: 0.01, decay: 0.08, startTime: now + 0.03 });
}

// Small laser warning & fire
export function playSmallLaserWarningSound() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone({ freq: 900, duration: 0.08, type: "sine", volume: 0.03, attack: 0.005, decay: 0.05, startTime: now });
}

export function playSmallLaserFireSound() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  // smoother triangle for main blast
  playTone({ freq: 1150, duration: 0.09, type: "triangle", volume: 0.035, attack: 0.003, decay: 0.06, startTime: now });
  // subtle movement whoosh
  playTone({ freq: 300, duration: 0.18, type: "sine", volume: 0.025, attack: 0.005, decay: 0.12, startTime: now + 0.01 });
}

// Large laser warning & fire
export function playLargeLaserWarningSound() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone({ freq: 400, duration: 0.16, type: "sine", volume: 0.035, attack: 0.01, decay: 0.1, startTime: now });
  playTone({ freq: 600, duration: 0.16, type: "triangle", volume: 0.025, attack: 0.01, decay: 0.1, startTime: now + 0.03 });
}

export function playLargeLaserFireSound() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  // use triangle instead of square to soften
  playTone({ freq: 220, duration: 0.24, type: "triangle", volume: 0.04, attack: 0.005, decay: 0.17, startTime: now });
  // low sweep for movement, less buzzy waveform
  playTone({ freq: 160, duration: 0.3, type: "triangle", volume: 0.03, attack: 0.01, decay: 0.22, startTime: now + 0.03 });
}

// Large saw volley sounds
export function playLargeSawAppearSound() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone({ freq: 180, duration: 0.22, type: "triangle", volume: 0.035, attack: 0.01, decay: 0.15, startTime: now });
}

export function playLargeSawWarningSweepSound() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  playTone({ freq: 300, duration: 0.27, type: "sine", volume: 0.03, attack: 0.01, decay: 0.19, startTime: now });
}

export function playLargeSawExplosionSound() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  // short multi-tone burst, less harsh waveforms
  playTone({ freq: 220, duration: 0.17, type: "triangle", volume: 0.042, attack: 0.005, decay: 0.13, startTime: now });
  playTone({ freq: 330, duration: 0.14, type: "sine", volume: 0.035, attack: 0.005, decay: 0.11, startTime: now + 0.02 });
  playTone({ freq: 120, duration: 0.24, type: "sine", volume: 0.03, attack: 0.01, decay: 0.19, startTime: now + 0.03 });
}

// Player death explosion
export function playPlayerExplosionSound() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  // soften by using triangle + sine
  playTone({ freq: 260, duration: 0.2, type: "triangle", volume: 0.04, attack: 0.005, decay: 0.15, startTime: now });
  playTone({ freq: 90, duration: 0.26, type: "sine", volume: 0.03, attack: 0.01, decay: 0.21, startTime: now + 0.04 });
}

// Typing sound for subtitle animation
export function playTypingSound() {
  const ctx = ensureAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  // very soft, short blip
  playTone({ freq: 650, duration: 0.04, type: "triangle", volume: 0.02, attack: 0.003, decay: 0.03, startTime: now });
}