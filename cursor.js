const cursorImg = new Image();
cursorImg.src = "/cursor.png";

let cursorX = 0;
let cursorY = 0;
// treat player as present even if they haven't moved yet
let hasMouse = true;

export function initCursor(canvas) {
  const rect = canvas.getBoundingClientRect();
  cursorX = rect.width / 2;
  cursorY = rect.height / 2;
  hasMouse = true;

  canvas.addEventListener("mousemove", (e) => {
    const r = canvas.getBoundingClientRect();
    cursorX = e.clientX - r.left;
    cursorY = e.clientY - r.top;
    hasMouse = true;
  });
}

export function setGameCursor(active) {
  if (active) {
    document.body.style.cursor = "none";
  } else {
    document.body.style.cursor = "auto";
  }
}

export function drawCursor(ctx) {
  const w = 15;
  const h = 17;
  if (!cursorImg.complete || cursorImg.naturalWidth === 0) {
    ctx.fillStyle = "#000";
    ctx.beginPath();
    ctx.arc(cursorX + w / 2, cursorY + h / 2, 5, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  ctx.drawImage(cursorImg, cursorX, cursorY, w, h);
}

export function getCursorCenter() {
  return { x: cursorX + 7.5, y: cursorY + 8.5 };
}

export function getCursorPosition() {
  return { x: cursorX, y: cursorY };
}

export function getHasMouse() {
  return hasMouse;
}

