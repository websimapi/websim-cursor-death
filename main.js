import { initCursor, drawCursor, getCursorCenter, setGameCursor } from "./cursor.js";
import {
  initHazards,
  onResize as hazardsOnResize,
  resetHazards,
  updateHazards,
  drawHazards,
  triggerAllPendingHazards,
  checkHazardCollisions,
} from "./hazards.js";
import { initStartScreen, hideStartScreenForGame, showStartScreenAfterDeath } from "./startScreen.js";
import { formatTimeSeconds } from "./utils.js";
import { initAudio, playPlayerExplosionSound } from "./sounds.js";

const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const timerEl = document.getElementById("timer");
const replayControlsEl = document.getElementById("replayControls");
const watchReplayButtonEl = document.getElementById("watchReplayButton");

// Multiplayer / records setup
const room = new WebsimSocket();
await room.initialize();
const currentUser = await window.websim.getCurrentUser();

initAudio(); // prepare audio system once we have JS running

let width = 0;
let height = 0;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  width = window.innerWidth;
  height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  hazardsOnResize(width, height);
}

window.addEventListener("resize", resize);
resize();

// Initialize cursor and hazards
initCursor(canvas);
initHazards(() => ({ width, height }));

// Game state
let gameRunning = false;
let gameOver = false;
let gameStartTime = 0;
let lastTime = performance.now();
let deathTime = null;
let finalSurvivalSeconds = 0;

// Trail
const trail = [];
const TRAIL_DURATION = 0.25;

// Explosion particles
let explosionParticles = [];

// Instant replay state: record cursor path while playing
let currentReplayFrames = []; // { t, x, y }
let lastReplayFrames = [];
let lastReplayDuration = 0;
let isReplaying = false;
let replayStartTime = 0;

// Start screen
initStartScreen(room, () => {
  if (!gameRunning && !gameOver && !isReplaying) {
    startGame();
  }
});

canvas.addEventListener("click", () => {
  if (!gameRunning && !gameOver && !isReplaying) {
    startGame();
  }
});

if (watchReplayButtonEl) {
  watchReplayButtonEl.addEventListener("click", () => {
    if (lastReplayFrames.length === 0 || lastReplayDuration <= 0) return;
    startReplay();
  });
}

// Trail logic
function updateTrail(dt) {
  const now = performance.now() / 1000;
  const center = getCursorCenter();
  trail.push({ x: center.x, y: center.y, t: now });
  const cutoff = now - TRAIL_DURATION;
  while (trail.length && trail[0].t < cutoff) {
    trail.shift();
  }
}

// Record replay frames during gameplay
function recordReplaySample(now) {
  const elapsed = (now - gameStartTime) / 1000;
  const center = getCursorCenter();
  currentReplayFrames.push({
    t: elapsed,
    x: center.x,
    y: center.y,
  });
}

function drawTrail() {
  if (trail.length < 2) return;

  const now = performance.now() / 1000;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";

  ctx.beginPath();
  for (let i = 0; i < trail.length; i++) {
    const p = trail[i];
    const age = now - p.t;
    const alpha = 1 - age / TRAIL_DURATION;
    if (alpha <= 0) continue;
    const x = p.x;
    const y = p.y;
    ctx.strokeStyle = `rgba(0,0,0,${0.25 * alpha})`;
    ctx.lineWidth = 2 + 1 * alpha;

    if (i === 0) {
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  }
}

// Explosion
function spawnExplosion(x, y) {
  const count = 32;
  const now = performance.now();
  explosionParticles = [];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 180 + Math.random() * 260;
    const wobble = (Math.random() - 0.5) * 0.4;
    explosionParticles.push({
      x,
      y,
      vx: Math.cos(angle + wobble) * speed,
      vy: Math.sin(angle + wobble) * speed,
      life: 0.7 + Math.random() * 0.25,
      birth: now,
      size: 2 + Math.random() * 3.5,
    });
  }
}

function updateExplosion(dt) {
  const now = performance.now();
  explosionParticles = explosionParticles.filter((p) => {
    const age = (now - p.birth) / 1000;
    if (age > p.life) return false;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 520 * dt;
    return true;
  });
}

function drawExplosion() {
  const now = performance.now();
  for (const p of explosionParticles) {
    const age = (now - p.birth) / 1000;
    const alpha = 1 - age / p.life;
    if (alpha <= 0) continue;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Timer
function updateTimer(now) {
  if (!gameRunning) return;
  const elapsed = (now - gameStartTime) / 1000;
  timerEl.textContent = formatTimeSeconds(elapsed);
}

// Persist best score + replay per user
async function saveBestScoreWithReplay() {
  try {
    const username = currentUser?.username;
    let existingBest = null;

    if (username) {
      const list = room.collection("score_v4").filter({ username }).getList();
      if (Array.isArray(list) && list.length > 0) {
        existingBest = list.reduce((best, s) => {
          if (!s || typeof s.time !== "number" || Number.isNaN(s.time)) {
            return best;
          }
          if (!best || s.time > best.time) return s;
          return best;
        }, null);
      }
    }

    const replayData = JSON.stringify({
      duration: finalSurvivalSeconds,
      frames: lastReplayFrames,
    });

    if (!existingBest || finalSurvivalSeconds > existingBest.time) {
      if (existingBest) {
        await room.collection("score_v4").update(existingBest.id, {
          time: finalSurvivalSeconds,
          replay: replayData,
        });
      } else {
        await room.collection("score_v4").create({
          time: finalSurvivalSeconds,
          replay: replayData,
        });
      }
    }
  } catch (e) {
    console.error("Failed to save best score with replay", e);
  }
}

// START / END OF GAME

function startGame() {
  gameRunning = true;
  gameOver = false;
  isReplaying = false;
  deathTime = null;
  finalSurvivalSeconds = 0;
  gameStartTime = performance.now();

  trail.length = 0;
  explosionParticles = [];
  resetHazards();

  // reset replay buffer for this run
  currentReplayFrames = [];
  lastReplayFrames = [];
  lastReplayDuration = 0;
  if (replayControlsEl) {
    replayControlsEl.style.display = "none";
  }

  hideStartScreenForGame();

  timerEl.style.display = "block";
  timerEl.textContent = "00.00";
  setGameCursor(true);
}

async function handleDeath() {
  if (!gameRunning || gameOver) return;

  gameRunning = false;
  gameOver = true;
  deathTime = performance.now();
  setGameCursor(false);

  finalSurvivalSeconds = (deathTime - gameStartTime) / 1000;
  timerEl.textContent = formatTimeSeconds(finalSurvivalSeconds);

  // freeze replay data for this run
  lastReplayFrames = currentReplayFrames.slice();
  lastReplayDuration = finalSurvivalSeconds;

  const center = getCursorCenter();
  spawnExplosion(center.x, center.y);
  playPlayerExplosionSound();

  triggerAllPendingHazards(gameStartTime, deathTime);

  if (replayControlsEl && lastReplayFrames.length > 0) {
    replayControlsEl.style.display = "block";
  }

  // save best score + replay to leaderboard
  await saveBestScoreWithReplay();
}

function finalizeGameOver() {
  gameOver = false;
  deathTime = null;
  if (replayControlsEl) {
    replayControlsEl.style.display = "none";
  }
  showStartScreenAfterDeath();
  timerEl.style.display = "none";
  timerEl.textContent = "00.00";
}

function startReplay() {
  if (lastReplayFrames.length === 0 || lastReplayDuration <= 0) return;
  isReplaying = true;
  replayStartTime = performance.now();
  if (replayControlsEl) {
    replayControlsEl.style.display = "none";
  }
}

// Render instant replay: simple white background + cursor path
function renderReplay(now) {
  const t = (now - replayStartTime) / 1000;
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (lastReplayFrames.length === 0) return;

  const clampT = Math.min(t, lastReplayDuration);

  // trail over last TRAIL_DURATION seconds
  const trailStart = clampT - TRAIL_DURATION;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  let started = false;

  for (let i = 0; i < lastReplayFrames.length; i++) {
    const f = lastReplayFrames[i];
    if (f.t > clampT) break;
    if (f.t < 0 || f.t < trailStart) continue;
    const age = clampT - f.t;
    const alpha = 1 - age / TRAIL_DURATION;
    if (alpha <= 0) continue;
    ctx.strokeStyle = `rgba(0,0,0,${0.25 * alpha})`;
    ctx.lineWidth = 2 + 1 * alpha;
    const x = f.x;
    const y = f.y;
    if (!started) {
      ctx.moveTo(x, y);
      started = true;
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  }

  // draw cursor as simple circle at current time
  let currentFrame = lastReplayFrames[lastReplayFrames.length - 1];
  for (let i = 0; i < lastReplayFrames.length; i++) {
    if (lastReplayFrames[i].t > clampT) {
      currentFrame = i > 0 ? lastReplayFrames[i - 1] : lastReplayFrames[0];
      break;
    }
  }
  if (currentFrame) {
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(currentFrame.x, currentFrame.y, 6, 0, Math.PI * 2);
    ctx.fill();
  }

  // end replay when finished
  if (t >= lastReplayDuration) {
    isReplaying = false;
    finalizeGameOver();
  }
}

// Main loop
function loop(now) {
  const dt = (now - lastTime) / 1000;
  lastTime = now;

  if (isReplaying) {
    renderReplay(now);
    requestAnimationFrame(loop);
    return;
  }

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);

  if (gameRunning) {
    updateTimer(now);
    updateTrail(dt);
    updateHazards(dt, true, gameRunning, gameStartTime);
    updateExplosion(dt);
    checkHazardCollisions(getCursorCenter(), handleDeath);

    // end the game if cursor leaves the visible screen
    const center = getCursorCenter();
    if (
      center.x < 0 ||
      center.x > width ||
      center.y < 0 ||
      center.y > height
    ) {
      handleDeath();
    }

    // record replay frame for this tick
    recordReplaySample(now);

    drawTrail();
    drawHazards(ctx);
    drawCursor(ctx);
    drawExplosion();
  } else if (gameOver) {
    updateHazards(dt, false, false, gameStartTime);
    updateExplosion(dt);

    drawHazards(ctx);
    // hide in-game cursor sprite while dead
    drawExplosion();

    if (deathTime && performance.now() - deathTime >= 2000) {
      // only auto-finalize if replay is not available or not used
      if (!lastReplayFrames.length) {
        finalizeGameOver();
      }
    }
  } else {
    updateExplosion(dt);
    drawExplosion();
  }

  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);