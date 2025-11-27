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

