// ... existing code ...
function handleClick() {
  if (!gameRunning && !gameOver) {
    startGame();
  }
}

// Dynamic max small lasers per 3 seconds (global cap)
function getMaxSmallLasersPer3Seconds() {
  return 8;
}

// Cursor visibility helpers
function setGameCursor(active) {
// ... existing code ...

// ... existing code ...
function spawnLargeLaserParticles(lineStartX, lineStartY, lineEndX, lineEndY) {
  // ... existing code ...
}

// Laser / warning logic
function spawnWarning() {
  if (!hasMouse) return;

  const now = performance.now() / 1000;

  // Respect max small lasers per 3 seconds (based on fire time)
  const windowStart = now - 3;
  while (recentSmallLaserTimes.length && recentSmallLaserTimes[0] < windowStart) {
    recentSmallLaserTimes.shift();
  }
  const maxSmall = getMaxSmallLasersPer3Seconds();
  if (recentSmallLaserTimes.length >= maxSmall) return;

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

  // Use cursor center so the laser line and hitbox line up visually
  const cursorCenterX = cursorX + 7.5;
  const cursorCenterY = cursorY + 8.5;

  // Line passes through p = cursorCenter + normal * d
  const px = cursorCenterX + nx * d;
  const py = cursorCenterY + ny * d;

  warnings.push({
    px,
    py,
    normal,
    tangent,
    spawnTime: now,
    fired: false,
    fireTime: null,
  });
}

// New: large laser warning spawn
function spawnLargeWarning() {
  if (!hasMouse) return;

  const now = performance.now() / 1000;

  // Enforce max 2 large lasers spawned per 4 seconds (based on fire time)
  const windowStart = now - 4;
  while (recentLargeLaserTimes.length && recentLargeLaserTimes[0] < windowStart) {
    recentLargeLaserTimes.shift();
  }
  const maxLargePer4s = 2;
  if (recentLargeLaserTimes.length >= maxLargePer4s) return;

  // Pick a perpendicular distance so big lasers start off-axis
  const distances = [160, 220, 320];
  const d = distances[Math.floor(Math.random() * distances.length)];

  // Restrict orientation to 0/90/180/270 degrees
  const allowedAngles = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  const phi = allowedAngles[Math.floor(Math.random() * allowedAngles.length)];
  const nx = Math.cos(phi);
  const ny = Math.sin(phi);

  const normal = { x: nx, y: ny };
  const tangent = { x: -ny, y: nx };

  // Use cursor center so visuals and hitbox line up
  const cursorCenterX = cursorX + 7.5;
  const cursorCenterY = cursorY + 8.5;

  // Start outside and move toward the player (direction = -1 along normal)
  const px = cursorCenterX + nx * d;
  const py = cursorCenterY + ny * d;
  const direction = -1;

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
  });
}
// ... existing code ...

// ... existing code ...
function updateWarnings(dt, allowSpawns) {
  const now = performance.now() / 1000;

  // Possibly spawn new warning
  if (allowSpawns && gameRunning) {
    const elapsed = (performance.now() - gameStartTime) / 1000;
    // Slower difficulty curve
    const difficultyFactor = 0.6 + Math.min(elapsed / 40, 1.0); // scales from 0.6x to 1.6x over ~40s

    // Small-laser spawn rate (slightly reduced overall; hard-capped by 8 per 3s)
    const baseSpawnRate = elapsed >= 10 ? 1.0 : 1.4;
    const spawnChance = baseSpawnRate * difficultyFactor * dt;

    if (Math.random() < spawnChance) {
      spawnWarning();
    }

    // Large lasers spawn less frequently, plus explicit rate cap in spawnLargeWarning
    const baseLargeSpawnRate = 0.25; // per second, slower curve
    const largeSpawnChance = baseLargeSpawnRate * difficultyFactor * dt;
    if (Math.random() < largeSpawnChance) {
      spawnLargeWarning();
    }

    // New dotted-line projectile attack (post-10s, capped at 9 warnings)
    const baseDottedRate = 0.35; // per second
    const dottedChance = baseDottedRate * difficultyFactor * dt;
    if (Math.random() < dottedChance && dottedWarnings.length < 9) {
      spawnDottedWarningsWave();
    }
  }

  for (const w of warnings) {
    const age = now - w.spawnTime;
    // Fixed warning time: always 1 second before firing
    if (!w.fired && age >= LASER_WARNING_TIME_BASE) {
      w.fired = true;
      w.fireTime = now;
      recentSmallLaserTimes.push(now);
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
      // ... existing large laser firing logic ...
// ... existing code ...

// ... existing code ...
function drawWarningsAndLasers() {
  const now = performance.now() / 1000;
  const L = Math.max(width, height) * 2;

  // Small warnings
  for (const w of warnings) {
    const startX = w.px - w.tangent.x * L;
    const startY = w.py - w.tangent.y * L;
    const endX = w.px + w.tangent.x * L;
    const endY = w.py + w.tangent.y * L;

    const age = now - w.spawnTime;

    // Warning line
    if (!w.fired) {
      const t = Math.min(1, age / LASER_WARNING_TIME_BASE);
      const eased = t * t; // ease-in
      const alpha = 0.1 + 0.5 * eased;
      const width = 1 + 3 * eased;
      ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
      ctx.lineWidth = width;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endX);
      ctx.stroke();
    } else {
      // Laser line with eased fade-out and subtle size change
      const life = now - w.fireTime;
      const t = Math.min(1, life / LASER_ACTIVE_TIME);
      const easedOut = 1 - t * t; // ease-out
      const alpha = easedOut;
      const width = 5 - 2 * t;
      ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
      ctx.lineWidth = width;

      // Core stroke
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();

      // Slight glow using a second, faint stroke
      ctx.strokeStyle = `rgba(0,0,0,${alpha * 0.3})`;
      ctx.lineWidth = width + 2;
      ctx.beginPath();
      ctx.moveTo(startX, startY);
      ctx.lineTo(endX, endY);
      ctx.stroke();
    }
  }

  // Large warnings
  for (const lw of largeWarnings) {
    // ... existing large warning drawing code ...
  }

  // Dotted line warnings (visual telegraph for projectiles)
  for (const dw of dottedWarnings) {
    const age = now - dw.spawnTime;
    const t = Math.min(1, age / 2.0);
    const alpha = 0.15 + 0.35 * t;
    ctx.strokeStyle = `rgba(0,0,0,${alpha})`;
    ctx.lineWidth = 3;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(dw.x1, dw.y1);
    ctx.lineTo(dw.x2, dw.y2);
    ctx.stroke();
  }

  // Reset dash
  ctx.setLineDash([]);
}
// ... existing code ...

// ... existing code ...
function checkCollisions() {
  const now = performance.now() / 1000;
  // Use the visual cursor center for hit detection
  const point = { x: cursorX + 7.5, y: cursorY + 8.5 };

  // Small lasers: enable collision; hitbox matches rendered width over full active time
  for (const w of warnings) {
    if (!w.fired) continue;
    const life = now - w.fireTime;
    if (life < 0 || life > LASER_ACTIVE_TIME) continue;

    // Match hitbox to the rendered width (including fade out)
    const tLife = Math.min(1, Math.max(0, life / LASER_ACTIVE_TIME));
    const currentWidth = 5 - 2 * tLife;
    const thresholdSmall = currentWidth * 0.5;

    const dx = point.x - w.px;
    const dy = point.y - w.py;
    const dist = Math.abs(dx * w.normal.x + dy * w.normal.y);

    if (dist <= thresholdSmall) {
      handleDeath();
      return;
    }
  }

  // Large lasers
  for (const lw of largeWarnings) {
    if (!lw.fired) continue;
    const life = now - lw.fireTime;
    if (life < 0 || life > LARGE_LASER_ACTIVE_TIME) continue;

    // Match hitbox to the rendered width over the entire active time (including fade in/out)
    const tLife = Math.min(1, Math.max(0, life / LARGE_LASER_ACTIVE_TIME));
    const currentWidth = 16 - 4 * tLife;
    const thresholdLarge = currentWidth * 0.5;

    const dx = point.x - lw.px;
    const dy = point.y - lw.py;
    const dist = Math.abs(dx * lw.normal.x + dy * lw.normal.y);

    if (dist <= thresholdLarge) {
      handleDeath();
      return;
    }
  }

  // Projectiles (circles with trail)
  for (const p of projectiles) {
    const dx = point.x - p.x;
    const dy = point.y - p.y;
    const distSq = dx * dx + dy * dy;
    const r = p.radius;
    if (distSq <= r * r) {
      handleDeath();
      return;
    }
  }
}
// ... existing code ...

// ... existing code ...
// Projectiles logic (for dotted warnings)
function spawnProjectilesForWarning(dw) {
  const cx = dw.cx;
  const cy = dw.cy;

  // Projectiles come from offscreen towards the warning, with slight spread
  const baseAngle = Math.atan2(cy - height / 2, cx - width / 2);
  const maxRadius = Math.max(width, height) + 80;
  const speed = 750; // fast

  const elapsed = (performance.now() - gameStartTime) / 1000;
  const count = elapsed >= 10 ? 5 : 3;

  for (let i = 0; i < count; i++) {
    const offsetIndex = count === 3 ? (i - 1) : (i - (count - 1) / 2);
    const angleOffset = offsetIndex * (Math.PI / 32); // spread
    const angle = baseAngle + angleOffset;

    const sx = cx - Math.cos(angle) * maxRadius;
    const sy = cy - Math.sin(angle) * maxRadius;

    const vx = Math.cos(angle) * speed;
    const vy = Math.sin(angle) * speed;

    projectiles.push({
      x: sx,
      y: sy,
      vx,
      vy,
      radius: 8,
      trail: [],
    });
  }
}
// ... existing code ...

