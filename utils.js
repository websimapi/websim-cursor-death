export function formatTimeSeconds(sec) {
  const seconds = Math.floor(sec);
  const centi = Math.floor((sec % 1) * 100);
  const ss = String(seconds).padStart(2, "0");
  const cc = String(centi).padStart(2, "0");
  return `${ss}.${cc}`;
}

