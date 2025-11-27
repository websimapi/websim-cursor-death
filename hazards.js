import { getCursorCenter, getHasMouse } from "./cursor.js";
import {
  playSmallLaserWarningSound,
  playSmallLaserFireSound,
  playLargeLaserWarningSound,
  playLargeLaserFireSound,
  playLargeSawAppearSound,
  playLargeSawWarningSweepSound,
  playLargeSawExplosionSound,
} from "./sounds.js";

let width = 0;
let height = 0;

// Small lasers
const warnings = [];
const LASER_WARNING_TIME_BASE = 1.0;
const LASER_ACTIVE_TIME = 1.0; // lasers stay for 1 second at max
const recentSmallLaserTimes = [];

// Large lasers
const largeWarnings = [];
const LARGE_LASER_WARNING_TIME = 3.0;
const LARGE_LASER_ACTIVE_TIME = 3.0;
const recentLargeLaserTimes = [];

// Large laser particles (stylized)
let largeLaserParticles = [];

// New: Saws
const saws = [];
const MAX_SAWS = 12;
const SAW_MIN_SPAWN_TIME = 10; // seconds before saws start spawning
const SAW_SPAWN_RATE = 0.8; // approx. per second when eligible
const SAW_TRAIL_DURATION = 0.4;

// New: Large saw volleys
const largeSaws = [];
const LARGE_SAW_MIN_TIME = 20; // seconds before large saw volleys can appear
const LARGE_SAW_SPAWN_RATE = 0.25; // approx. per second after 20s
const LARGE_SAW_GROW_TIME = 3.0; // total lifetime until explosion
const LARGE_SAW_WARNING_LEAD = 2.0; // warning line appears 2s before explosion

// New: particles for large saw explosions
let largeSawParticles = [];

// New: large laser barrage (many parallel big lasers, no movement)
const barrageGroups = [];
const BARRAGE_MIN_TIME = 35; // seconds before barrage can appear
const BARRAGE_SPAWN_RATE = 0.18; // approx. per second after 35s
const BARRAGE_LASERS_PER_GROUP = 9;
// base spacing constant is no longer used for exact distance, but kept for reference
const BARRAGE_SPACING = 24;

// Config helpers
function getMaxSmallLasersPerSecond(elapsed) {
  return elapsed >= 10 ? 2 : 4;
}

export function initHazards(getDimensions) {
  const dims = getDimensions();
  width = dims.width;
  height = dims.height;
}

export function onResize(newWidth, newHeight) {
  width = newWidth;
  height = newHeight;
}

// Large laser particles
function spawnLargeLaserParticles(lineStartX, lineStartY, lineEndX, lineEndY) {
  const now = performance.now();
  const count = 40;
  largeLaserParticles = largeLaserParticles || [];
  for (let i = 0; i < count; i++) {
    const t = Math.random();
    const x = lineStartX + (lineEndX - lineStartX) * t;
    const y = lineStartY + (lineEndY - lineStartY) * t;
    const angle = Math.random() * Math.PI * 2;
    const speed = 140 + Math.random() * 190;
    largeLaserParticles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 0.6 + Math.random() * 0.3,
      birth: now,
      size: 1.8 + Math.random() * 2.2,
    });
  }
}

function updateLargeLaserParticles(dt) {
  const now = performance.now();
  largeLaserParticles = largeLaserParticles.filter((p) => {
    const age = (now - p.birth) / 1000;
    if (age > p.life) return false;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    return true;
  });
}

function drawLargeLaserParticles(ctx) {
  const now = performance.now();
  for (const p of largeLaserParticles) {
    const age = (now - p.birth) / 1000;
    const alpha = 1 - age / p.life;
    if (alpha <= 0) continue;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// New: large saw explosion particles
function spawnLargeSawParticles(x, y) {
  const now = performance.now();
  const count = 60;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 220 + Math.random() * 300;
    const wobble = (Math.random() - 0.5) * 0.7;
    largeSawParticles.push({
      x,
      y,
      vx: Math.cos(angle + wobble) * speed,
      vy: Math.sin(angle + wobble) * speed,
      life: 0.7 + Math.random() * 0.4,
      birth: now,
      size: 2.5 + Math.random() * 3.5,
    });
  }
}

function updateLargeSawParticles(dt) {
  const now = performance.now();
  largeSawParticles = largeSawParticles.filter((p) => {
    const age = (now - p.birth) / 1000;
    if (age > p.life) return false;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 420 * dt;
    return true;
  });
}

function drawLargeSawParticles(ctx) {
  const now = performance.now();
  for (const p of largeSawParticles) {
    const age = (now - p.birth) / 1000;
    const alpha = 1 - age / p.life;
    if (alpha <= 0) continue;
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
}

// Small laser spawn
function spawnWarning(gameStartTime) {
  if (!getHasMouse()) return;

  const now = performance.now() / 1000;
  const elapsed = (performance.now() - gameStartTime) / 1000;

  // Respect max small lasers per second (based on fire time)
  const windowStart = now - 1;
  while (recentSmallLaserTimes.length && recentSmallLaserTimes[0] < windowStart) {
    recentSmallLaserTimes.shift();
  }
  const maxSmall = getMaxSmallLasersPerSecond(elapsed);
  if (recentSmallLaserTimes.length >= maxSmall) return;

  const cursorCenter = getCursorCenter();

  // Pick perpendicular distance: 0, 100, 300
  const distances = [0, 100, 300];
  const d = distances[Math.floor(Math.random() * distances.length)];

  // Pick random normal angle
  const phi = Math.random() * Math.PI * 2;
  const nx = Math.cos(phi);
  const ny = Math.sin(phi);

  // Normal and tangent
  const normal = { x: nx, y: ny };
  const tx = -ny;
  const ty = nx;
  const tangent = { x: tx, y: ty };

  // Line passes through p = cursorCenter + normal * d
  const px = cursorCenter.x + nx * d;
  const py = cursorCenter.y + ny * d;

  warnings.push({
    px,
    py,
    normal,
    tangent,
    spawnTime: now,
    fired: false,
    fireTime: null,
  });

  // quiet warning ping
  playSmallLaserWarningSound();
}

// Large laser spawn (only 0, 90, 180 deg; moves toward player)
function spawnLargeWarning() {
  if (!getHasMouse()) return;

  const now = performance.now() / 1000;

  // Limit how many large lasers can be visible at once
  const totalLarge = largeWarnings.filter((lw) => !lw.isBarrage).length;
  if (totalLarge >= 4) return;

  // Pick a larger perpendicular distance so big lasers feel more "off-axis"
  const distances = [140, 220, 320];
  const d = distances[Math.floor(Math.random() * distances.length)];

  // Restrict orientation to 0, 90, or 180 degrees only (no 270+)
  const allowedAngles = [0, Math.PI / 2, Math.PI];
  const phi = allowedAngles[Math.floor(Math.random() * allowedAngles.length)];
  const nx = Math.cos(phi);
  const ny = Math.sin(phi);

  const normal = { x: nx, y: ny };
  const tangent = { x: -ny, y: nx };

  const cursorCenter = getCursorCenter();

  // Initial line position offset from the player
  const px = cursorCenter.x + nx * d;
  const py = cursorCenter.y + ny * d;

  // Choose movement direction so the laser moves toward the player
  const dx = cursorCenter.x - px;
  const dy = cursorCenter.y - py;
  const signedDist = dx * normal.x + dy * normal.y;
  const direction = signedDist >= 0 ? 1 : -1;

  largeWarnings.push({
    px,
    py,
    normal,
    tangent,
    direction,
    spawnTime: now,
    fired: false,
    fireTime: null,
    totalTravel: 0,
    travelSoFar: 0,
    moveDuration: 0,
    isBarrage: false,
  });

  // lower-pitched warning sweep
  playLargeLaserWarningSound();
}

// New: spawn a barrage of large lasers (no movement, parallel, 90 or 180 degrees)
function spawnLargeLaserBarrage(gameStartTime) {
  if (!getHasMouse()) return;

  const now = performance.now() / 1000;

  // Avoid overlapping barrages: wait until any existing barrage is over
  const activeBarrage = largeWarnings.some((lw) => lw.isBarrage);
  if (activeBarrage) return;

  // Choose orientation: 90° (vertical line) or 180° (horizontal line)
  const orientations = [Math.PI / 2, Math.PI];
  const phi = orientations[Math.floor(Math.random() * orientations.length)];
  const nx = Math.cos(phi);
  const ny = Math.sin(phi);
  const normal = { x: nx, y: ny };
  const tangent = { x: -ny, y: nx };

  // Choose a band center inside the screen
  const margin = 60;
  let centerX = margin + Math.random() * (width - margin * 2);
  let centerY = margin + Math.random() * (height - margin * 2);

  // Slight random shift so they don't always sit dead-center
  centerX += (Math.random() - 0.5) * 40;
  centerY += (Math.random() - 0.5) * 40;

  const count = BARRAGE_LASERS_PER_GROUP;
  const half = (count - 1) / 2;

  // spacing between lasers is always between 5 and 25px
  const minSpacing = 5;
  const maxSpacing = 25;
  const actualSpacing = minSpacing + Math.random() * (maxSpacing - minSpacing);

  for (let i = 0; i < count; i++) {
    const offset = (i - half) * actualSpacing;

    const px = centerX + normal.x * offset;
    const py = centerY + normal.y * offset;

    largeWarnings.push({
      px,
      py,
      normal,
      tangent,
      direction: 0, // no movement
      spawnTime: now,
      fired: false,
      fireTime: null,
      totalTravel: 0,
      travelSoFar: 0,
      moveDuration: LARGE_LASER_ACTIVE_TIME, // used just for fade timing
      isBarrage: true,
    });
  }

  barrageGroups.push({
    spawnTime: now,
  });

  // single warning sound for the whole barrage
  playLargeLaserWarningSound();
}

// New: Saws spawn
function spawnSaw() {
  if (!getHasMouse()) return;
  if (saws.length >= MAX_SAWS) return;

  const margin = 40;
  const now = performance.now() / 1000;

  // pick a side: 0=top,1=right,2=bottom,3=left
  const side = Math.floor(Math.random() * 4);
  let x, y, vx, vy;

  const speed = 100 + Math.random() * 60;

  if (side === 0) {
    // top
    x = Math.random() * width;
    y = -margin;
    const targetX = Math.random() * width;
    const targetY = height * 0.5 + (Math.random() - 0.5) * height * 0.3;
    const ang = Math.atan2(targetY - y, targetX - x);
    vx = Math.cos(ang) * speed;
    vy = Math.sin(ang) * speed;
  } else if (side === 1) {
    // right
    x = width + margin;
    y = Math.random() * height;
    const targetX = width * 0.5 + (Math.random() - 0.5) * width * 0.3;
    const targetY = Math.random() * height;
    const ang = Math.atan2(targetY - y, targetX - x);
    vx = Math.cos(ang) * speed;
    vy = Math.sin(ang) * speed;
  } else if (side === 2) {
    // bottom
    x = Math.random() * width;
    y = height + margin;
    const targetX = Math.random() * width;
    const targetY = height * 0.5 + (Math.random() - 0.5) * height * 0.3;
    const ang = Math.atan2(targetY - y, targetX - x);
    vx = Math.cos(ang) * speed;
    vy = Math.sin(ang) * speed;
  } else {
    // left
    x = -margin;
    y = Math.random() * height;
    const targetX = width * 0.5 + (Math.random() - 0.5) * width * 0.3;
    const targetY = Math.random() * height;
    const ang = Math.atan2(targetY - y, targetX - x);
    vx = Math.cos(ang) * speed;
    vy = Math.sin(ang) * speed;
  }

  const radius = 14;

  saws.push({
    x,
    y,
    vx,
    vy,
    r: radius,
    birth: now,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() > 0.5 ? 1 : -1) * (1.2 + Math.random() * 0.8),
    trail: [],
  });
}

// New: Large saw volley spawn (appears, then explodes into 6 saws)
function spawnLargeSawVolley() {
  if (!getHasMouse()) return;

  const now = performance.now() / 1000;

  // place near the play area center-ish
  const margin = Math.min(width, height) * 0.2;
  const x = margin + Math.random() * (width - margin * 2);
  const y = margin + Math.random() * (height - margin * 2);

  // six evenly spaced outgoing directions for the spawned saws
  const directions = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    directions.push({ x: Math.cos(a), y: Math.sin(a) });
  }

  largeSaws.push({
    x,
    y,
    baseRadius: 12,
    maxRadius: 44,
    spawnTime: now,
    explodeTime: now + LARGE_SAW_GROW_TIME,
    warningStartTime: now + (LARGE_SAW_GROW_TIME - LARGE_SAW_WARNING_LEAD),
    directions,
    exploded: false,
  });

  // subtle spawn sound
  playLargeSawAppearSound();
}

// Helper: explode a large saw into 6 normal saws
function explodeLargeSaw(ls) {
  const now = performance.now() / 1000;
  const speed = 200;

  // spawn 6 saws following the stored directions
  const dirs = ls.directions && ls.directions.length === 6
    ? ls.directions
    : Array.from({ length: 6 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 6;
        return { x: Math.cos(a), y: Math.sin(a) };
      });

  for (let i = 0; i < dirs.length; i++) {
    const dir = dirs[i];
    const vx = dir.x * speed;
    const vy = dir.y * speed;

    saws.push({
      x: ls.x,
      y: ls.y,
      vx,
      vy,
      r: 14,
      birth: now,
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() > 0.5 ? 1 : -1) * (1.5 + Math.random() * 0.8),
      trail: [],
    });
  }

  // extra impact particles when the large saw explodes
  spawnLargeSawParticles(ls.x, ls.y);
  playLargeSawExplosionSound();
}

export function resetHazards() {
  warnings.length = 0;
  largeWarnings.length = 0;
  recentSmallLaserTimes.length = 0;
  recentLargeLaserTimes.length = 0;
  largeLaserParticles.length = 0;
  saws.length = 0;
  largeSaws.length = 0;
  largeSawParticles.length = 0;
  barrageGroups.length = 0;
}

export function updateHazards(dt, allowSpawns, gameRunning, gameStartTime) {
  const now = performance.now() / 1000;

  if (allowSpawns && gameRunning) {
    const elapsed = (performance.now() - gameStartTime) / 1000;
    const difficultyFactor = 0.6 + Math.min(elapsed / 40, 1.0);

    // Small lasers
    const baseSpawnRate = elapsed >= 10 ? 1.0 : 1.4;
    const spawnChance = baseSpawnRate * difficultyFactor * dt;
    if (Math.random() < spawnChance) {
      spawnWarning(gameStartTime);
    }

    // Large lasers; reduce spawn when many active, only after 5s
    if (elapsed >= 5) {
      const activeLarge = largeWarnings.filter((lw) => lw.fired && !lw.isBarrage).length;
      let baseLargeSpawnRate = 0.25;
      if (activeLarge >= 3) {
        baseLargeSpawnRate = 0.05;
      } else if (activeLarge === 2) {
        baseLargeSpawnRate = 0.12;
      }
      const largeSpawnChance = baseLargeSpawnRate * difficultyFactor * dt;
      if (Math.random() < largeSpawnChance) {
        spawnLargeWarning();
      }
    }

    // New: Saws start spawning after 10 seconds
    if (elapsed >= SAW_MIN_SPAWN_TIME && saws.length < MAX_SAWS) {
      const sawSpawnChance = SAW_SPAWN_RATE * difficultyFactor * dt;
      if (Math.random() < sawSpawnChance) {
        spawnSaw();
      }
    }

    // New: Large saw volleys start after 20 seconds
    if (elapsed >= LARGE_SAW_MIN_TIME) {
      const largeSawChance = LARGE_SAW_SPAWN_RATE * dt;
      if (Math.random() < largeSawChance) {
        spawnLargeSawVolley();
      }
    }

    // New: Large-laser barrage starts after 35 seconds
    if (elapsed >= BARRAGE_MIN_TIME) {
      const barrageChance = BARRAGE_SPAWN_RATE * dt;
      if (Math.random() < barrageChance) {
        spawnLargeLaserBarrage(gameStartTime);
      }
    }
  }

  // Small warnings
  for (const w of warnings) {
    const age = now - w.spawnTime;
    if (!w.fired && age >= LASER_WARNING_TIME_BASE) {
      w.fired = true;
      w.fireTime = now;
      recentSmallLaserTimes.push(now);

      // fire + movement sound
      playSmallLaserFireSound();
    }
  }

  // Remove old small lasers
  for (let i = warnings.length - 1; i >= 0; i--) {
    const w = warnings[i];
    if (w.fired && now - w.fireTime > LASER_ACTIVE_TIME) {
      warnings.splice(i, 1);
    }
  }

  // Large warnings update
  for (const lw of largeWarnings) {
    const age = now - lw.spawnTime;
    if (!lw.fired && age >= LARGE_LASER_WARNING_TIME) {
      lw.fired = true;
      lw.fireTime = now;
      recentLargeLaserTimes.push(now);

      // Determine travel distance based on survival time (50px to 125px),
      // but barrage lasers do not move at all.
      if (!lw.isBarrage) {
        const elapsed = (performance.now() - gameStartTime) / 1000;
        const t = Math.max(0, Math.min((elapsed - 5) / 30, 1));
        lw.totalTravel = 50 + 75 * t;
        lw.travelSoFar = 0;
        // Movement phase duration (fade happens after reaching destination)
        lw.moveDuration = LARGE_LASER_ACTIVE_TIME * 0.6;
      } else {
        lw.totalTravel = 0;
        lw.travelSoFar = 0;
        lw.moveDuration = LARGE_LASER_ACTIVE_TIME * 0.6;
      }

      // Spawn particles along the laser line when it fires
      const L = Math.max(width, height) * 2;
      const startX = lw.px - lw.tangent.x * L;
      const startY = lw.py - lw.tangent.y * L;
      const endX = lw.px + lw.tangent.x * L;
      const endY = lw.py + lw.tangent.y * L;
      spawnLargeLaserParticles(startX, startY, endX, endY);

      // fire + movement sound
      playLargeLaserFireSound();
    }

    // Move fired large lasers (barrage lasers have direction 0, so they won't move)
    if (lw.fired && !lw.isBarrage) {
      const lifeSoFar = now - lw.fireTime;
      if (lifeSoFar < lw.moveDuration && lw.travelSoFar < lw.totalTravel) {
        const remainingDist = lw.totalTravel - lw.travelSoFar;
        const remainingTime = lw.moveDuration - lifeSoFar;
        if (remainingTime > 0) {
          const speed = remainingDist / remainingTime;
          const moveDist = speed * dt * lw.direction;

          lw.px += lw.normal.x * moveDist;
          lw.py += lw.normal.y * moveDist;
          lw.travelSoFar += Math.abs(moveDist);
        }
      }
    }
  }

  // Remove old large lasers
  for (let i = largeWarnings.length - 1; i >= 0; i--) {
    const lw = largeWarnings[i];
    if (lw.fired && now - lw.fireTime > LARGE_LASER_ACTIVE_TIME) {
      largeWarnings.splice(i, 1);
    }
  }

  // Update saws and their trails
  const cutoff = now - SAW_TRAIL_DURATION;
  for (let i = saws.length - 1; i >= 0; i--) {
    const s = saws[i];
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    s.angle += s.spin * dt;

    // update trail
    s.trail.push({ x: s.x, y: s.y, t: now });
    while (s.trail.length && s.trail[0].t < cutoff) {
      s.trail.shift();
    }

    // remove when fully offscreen
    if (
      s.x < -s.r - 60 ||
      s.x > width + s.r + 60 ||
      s.y < -s.r - 60 ||
      s.y > height + s.r + 60
    ) {
      saws.splice(i, 1);
    }
  }

  // Update large saws (growth, warning timing, explosion)
  for (let i = largeSaws.length - 1; i >= 0; i--) {
    const ls = largeSaws[i];
    const age = now - ls.spawnTime;

    // play a quiet warning sweep exactly when the warning starts
    if (!ls._playedWarningSound && now >= ls.warningStartTime) {
      ls._playedWarningSound = true;
      playLargeSawWarningSweepSound();
    }

    if (!ls.exploded && age >= LARGE_SAW_GROW_TIME) {
      ls.exploded = true;
      explodeLargeSaw(ls);
    }

    // remove once exploded and a little time has passed
    if (ls.exploded && age > LARGE_SAW_GROW_TIME + 0.25) {
      largeSaws.splice(i, 1);
    }
  }

  updateLargeLaserParticles(dt);
  updateLargeSawParticles(dt);
}

export function drawHazards(ctx) {
  const now = performance.now() / 1000;
  const L = Math.max(width, height) * 2;

  // Draw saw trails
  for (const s of saws) {
    if (s.trail.length < 2) continue;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    for (let i = 0; i < s.trail.length; i++) {
      const p = s.trail[i];
      const age = now - p.t;
      const alpha = 1 - age / SAW_TRAIL_DURATION;
      if (alpha <= 0) continue;
      ctx.strokeStyle = `rgba(0,0,0,${0.2 * alpha})`;
      ctx.lineWidth = 3 * alpha;
      if (i === 0) {
        ctx.moveTo(p.x, p.y);
      } else {
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(p.x, p.y);
      }
    }
  }

  // Draw saws (black circle with spikes)
  for (const s of saws) {
    ctx.save();
    ctx.translate(s.x, s.y);
    ctx.rotate(s.angle);

    // core circle
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(0, 0, s.r * 0.7, 0, Math.PI * 2);
    ctx.fill();

    // spikes
    const spikes = 10;
    const innerR = s.r * 0.7;
    const outerR = s.r;
    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
      const a0 = (i * 2 * Math.PI) / spikes;
      const a1 = ((i + 0.5) * 2 * Math.PI) / spikes;
      const a2 = ((i + 1) * 2 * Math.PI) / spikes;
      const x0 = Math.cos(a0) * innerR;
      const y0 = Math.sin(a0) * innerR;
      const x1 = Math.cos(a1) * outerR;
      const y1 = Math.sin(a1) * outerR;
      const x2 = Math.cos(a2) * innerR;
      const y2 = Math.sin(a2) * innerR;
      if (i === 0) {
        ctx.moveTo(x0, y0);
      }
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  // Draw large saws (center, growth, flashing, warning lines showing directions)
  for (const ls of largeSaws) {
    const age = now - ls.spawnTime;
    const tGrow = Math.min(1, Math.max(0, age / LARGE_SAW_GROW_TIME));
    const radius = ls.baseRadius + (ls.maxRadius - ls.baseRadius) * tGrow;

    // Directional warning rays: fade in, then out
    if (now >= ls.warningStartTime && now <= ls.explodeTime) {
      const warnAge = now - ls.warningStartTime;
      const warnTotal = ls.explodeTime - ls.warningStartTime;
      const warnT = Math.min(1, Math.max(0, warnAge / warnTotal));
      const fadeIn = Math.min(1, warnT * 2); // 0->0.5: fade in
      const fadeOut = Math.max(0, 1 - (warnT - 0.5) * 2); // 0.5->1: fade out
      const alphaBase = Math.min(fadeIn, fadeOut);
      const alpha = 0.1 + 0.4 * alphaBase;

      ctx.setLineDash([12, 8]);
      ctx.lineWidth = 4;

      const dirs = ls.directions || [];
      for (let i = 0; i < dirs.length; i++) {
        const dir = dirs[i];
        const startX = ls.x;
        const startY = ls.y;
        const endX = ls.x + dir.x * L;
        const endY = ls.y + dir.y * L;
        ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
      ctx.setLineDash([]);
    }

    // Cleaner flashing effect: smooth pulse instead of harsh strobe
    let alphaSaw = 1;
    const timeToExplode = ls.explodeTime - now;
    let flashIntensity = 0;
    if (timeToExplode <= 1.2 && timeToExplode >= 0) {
      const flashes = 3;
      const phase = ((1.2 - timeToExplode) / 1.2) * flashes;
      const frac = phase - Math.floor(phase);
      flashIntensity = 0.3 + 0.7 * (1 - Math.abs(frac - 0.5) * 2); // smooth ramp
      alphaSaw = 0.5 + 0.5 * flashIntensity;
    }
    // overall fade-in/out based on growth
    alphaSaw *= 0.6 + 0.4 * tGrow;

    ctx.save();
    ctx.translate(ls.x, ls.y);

    // base black saw (spawn color is solid black)
    ctx.globalAlpha = alphaSaw;
    ctx.fillStyle = "#000000";

    const spikes = 14;
    const innerR = radius * 0.7;
    const outerR = radius;

    // core circle
    ctx.beginPath();
    ctx.arc(0, 0, innerR, 0, Math.PI * 2);
    ctx.fill();

    // spikes
    ctx.beginPath();
    for (let i = 0; i < spikes; i++) {
      const a0 = (i * 2 * Math.PI) / spikes;
      const a1 = ((i + 0.5) * 2 * Math.PI) / spikes;
      const a2 = ((i + 1) * 2 * Math.PI) / spikes;
      const x0 = Math.cos(a0) * innerR;
      const y0 = Math.sin(a0) * innerR;
      const x1 = Math.cos(a1) * outerR;
      const y1 = Math.sin(a1) * outerR;
      const x2 = Math.cos(a2) * innerR;
      const y2 = Math.sin(a2) * innerR;
      if (i === 0) {
        ctx.moveTo(x0, y0);
      }
      ctx.lineTo(x1, y1);
      ctx.lineTo(x2, y2);
    }
    ctx.closePath();
    ctx.fill();

    // outline (black at spawn / non-flash)
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2;
    ctx.stroke();

    // during flashes, turn the entire saw (circle, spikes, outline) grey
    if (flashIntensity > 0) {
      const greyAlpha = 0.4 * flashIntensity;
      ctx.globalAlpha = greyAlpha;
      ctx.fillStyle = "#e0e0e0";
      ctx.strokeStyle = "#e0e0e0";

      // redraw circle and spikes in grey
      ctx.beginPath();
      ctx.arc(0, 0, innerR, 0, Math.PI * 2);
      ctx.fill();

      ctx.beginPath();
      for (let i = 0; i < spikes; i++) {
        const a0 = (i * 2 * Math.PI) / spikes;
        const a1 = ((i + 0.5) * 2 * Math.PI) / spikes;
        const a2 = ((i + 1) * 2 * Math.PI) / spikes;
        const x0 = Math.cos(a0) * innerR;
        const y0 = Math.sin(a0) * innerR;
        const x1 = Math.cos(a1) * outerR;
        const y1 = Math.sin(a1) * outerR;
        const x2 = Math.cos(a2) * innerR;
        const y2 = Math.sin(a2) * innerR;
        if (i === 0) {
          ctx.moveTo(x0, y0);
        }
        ctx.lineTo(x1, y1);
        ctx.lineTo(x2, y2);
      }
      ctx.closePath();
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    ctx.restore();
  }

  // Small warnings
  for (const w of warnings) {
    const startX = w.px - w.tangent.x * L;
    const startY = w.py - w.tangent.y * L;
    const endX = w.px + w.tangent.x * L;
    const endY = w.py + w.tangent.y * L;

    const age = now - w.spawnTime;

    if (!w.fired) {
      const t = Math.min(1, age / LASER_WARNING_TIME_BASE);
      const eased = t * t;
      const alpha = 0.1 + 0.5 * eased;
      const widthLine = 1 + 3 * eased;
      ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
      ctx.lineWidth = widthLine;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    } else {
      const life = now - w.fireTime;
      const t = Math.min(1, life / LASER_ACTIVE_TIME);
      const easedOut = 1 - t * t;
      const alpha = easedOut;
      const widthLine = 5 - 2 * t;
      ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
      ctx.lineWidth = widthLine;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.3})`;
      ctx.lineWidth = widthLine + 2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  // Large warnings
  for (const lw of largeWarnings) {
    const startX = lw.px - lw.tangent.x * L;
    const startY = lw.py - lw.tangent.y * L;
    const endX = lw.px + lw.tangent.x * L;
    const endY = lw.py + lw.tangent.y * L;

    const age = now - lw.spawnTime;

    if (!lw.fired) {
      // Barrage warnings: softer grey with fade in/out
      if (lw.isBarrage) {
        const t = Math.min(1, age / LARGE_LASER_WARNING_TIME);
        const fadeIn = Math.min(1, t * 2);
        const fadeOut = Math.max(0, 1 - (t - 0.5) * 2);
        const alphaBase = Math.min(fadeIn, fadeOut);
        const alpha = 0.18 + 0.4 * alphaBase;
        const widthLine = 7 + 4 * alphaBase;
        ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
        ctx.lineWidth = widthLine;
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      } else {
        // Multi-stage warning over 3 seconds for normal large lasers
        let stage = age / LARGE_LASER_WARNING_TIME;
        const pulse = 0.9 + 0.2 * Math.sin(age * 6);
        if (stage < 1 / 3) {
          ctx.strokeStyle = "rgba(0,0,0,0.18)";
          ctx.lineWidth = 4 * pulse;
        } else if (stage < 2 / 3) {
          ctx.strokeStyle = "rgba(0,0,0,0.3)";
          ctx.lineWidth = 7 * pulse;
        } else {
          ctx.strokeStyle = "rgba(0,0,0,0.45)";
          ctx.lineWidth = 11 * pulse;
        }
        ctx.beginPath();
        ctx.moveTo(startX, startY);
        ctx.lineTo(endX, endY);
        ctx.stroke();
      }
    } else {
      const life = now - lw.fireTime;
      let alpha = 1;
      if (life > lw.moveDuration) {
        const fadeDuration = LARGE_LASER_ACTIVE_TIME - lw.moveDuration;
        if (fadeDuration > 0) {
          const fadeT = Math.min(
            1,
            Math.max(0, (life - lw.moveDuration) / fadeDuration)
          );
          alpha = (1 - fadeT) * (1 - fadeT);
        }
      }
      const widthLine = 16 - 4 * Math.min(1, life / LARGE_LASER_ACTIVE_TIME);
      ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
      ctx.lineWidth = widthLine;

      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.25})`;
      ctx.lineWidth = widthLine + 4;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  drawLargeLaserParticles(ctx);
  drawLargeSawParticles(ctx);
}

export function triggerAllPendingHazards(gameStartTime, deathTime) {
  const nowSec = performance.now() / 1000;

  // Small lasers
  for (const w of warnings) {
    if (!w.fired) {
      w.fired = true;
      w.fireTime = nowSec;
      recentSmallLaserTimes.push(nowSec);
      playSmallLaserFireSound();
    }
  }

  // Large lasers
  for (const lw of largeWarnings) {
    if (!lw.fired) {
      lw.fired = true;
      lw.fireTime = nowSec;
      recentLargeLaserTimes.push(nowSec);

      const elapsed = (deathTime - gameStartTime) / 1000;
      const t = Math.max(0, Math.min((elapsed - 5) / 30, 1));
      if (!lw.isBarrage) {
        lw.totalTravel = 50 + 75 * t;
        lw.travelSoFar = 0;
        lw.moveDuration = LARGE_LASER_ACTIVE_TIME * 0.6;
      } else {
        lw.totalTravel = 0;
        lw.travelSoFar = 0;
        lw.moveDuration = LARGE_LASER_ACTIVE_TIME * 0.6;
      }

      const L = Math.max(width, height) * 2;
      const startX = lw.px - lw.tangent.x * L;
      const startY = lw.py - lw.tangent.y * L;
      const endX = lw.px + lw.tangent.x * L;
      const endY = lw.py + lw.tangent.y * L;
      spawnLargeLaserParticles(startX, startY, endX, endY);
      playLargeLaserFireSound();
    }
  }
}

export function checkHazardCollisions(cursorCenter, onDeath) {
  const now = performance.now() / 1000;
  const point = cursorCenter;

  // Small lasers
  for (const w of warnings) {
    if (!w.fired) continue;
    const life = now - w.fireTime;
    if (life < 0 || life > LASER_ACTIVE_TIME) continue;

    const tLife = Math.min(1, Math.max(0, life / LASER_ACTIVE_TIME));
    const currentWidth = 5 - 2 * tLife;
    // slightly larger threshold to match full drawn width (including glow)
    const thresholdSmall = currentWidth * 0.6;

    const dx = point.x - w.px;
    const dy = point.y - w.py;
    const dist = Math.abs(dx * w.normal.x + dy * w.normal.y);

    if (dist <= thresholdSmall) {
      onDeath();
      return;
    }
  }

  // Large lasers
  for (const lw of largeWarnings) {
    if (!lw.fired) continue;
    const life = now - lw.fireTime;
    if (life < 0 || life > LARGE_LASER_ACTIVE_TIME) continue;

    const tLife = Math.min(1, Math.max(0, life / LARGE_LASER_ACTIVE_TIME));
    const currentWidth = 16 - 4 * tLife;
    const thresholdLarge = currentWidth * 0.6;

    const dx = point.x - lw.px;
    const dy = point.y - lw.py;
    const dist = Math.abs(dx * lw.normal.x + dy * lw.normal.y);

    if (dist <= thresholdLarge) {
      onDeath();
      return;
    }
  }

  // Saws (simple circular collision)
  for (const s of saws) {
    const dx = point.x - s.x;
    const dy = point.y - s.y;
    const distSq = dx * dx + dy * dy;
    const r = s.r;
    if (distSq <= r * r) {
      onDeath();
      return;
    }
  }

  // Large saws (player dies on touch)
  for (const ls of largeSaws) {
    const age = now - ls.spawnTime;
    if (age < 0 || age > LARGE_SAW_GROW_TIME) continue;
    const tGrow = Math.min(1, Math.max(0, age / LARGE_SAW_GROW_TIME));
    const radius = ls.baseRadius + (ls.maxRadius - ls.baseRadius) * tGrow;

    const dx = point.x - ls.x;
    const dy = point.y - ls.y;
    const distSq = dx * dx + dy * dy;
    if (distSq <= radius * radius) {
      onDeath();
      return;
    }
  }
}