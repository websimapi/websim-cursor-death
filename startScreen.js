import { formatTimeSeconds } from "./utils.js";
import { playClickBeginHellSound, playTypingSound } from "./sounds.js";

const startScreenEl = document.getElementById("startScreen");
const subtitleEl = document.getElementById("subtitle");
const clickToBeginEl = document.getElementById("clickToBegin");
const leaderboardRow1El = document.getElementById("leaderboardRow1");
const leaderboardRow2El = document.getElementById("leaderboardRow2");

const fullSubtitle = "a bullet hell of cursors and also a lot of death";
let subtitleIndex = 0;
let typingIntervalId = null;

let startCallback = null;

export function initStartScreen(room, onStartGame) {
  startCallback = onStartGame;

  if (clickToBeginEl) {
    // ensure blink animation is active on initial load as well
    clickToBeginEl.classList.add("blink");
    clickToBeginEl.addEventListener("click", handleStartClick);
  }
  if (startScreenEl) {
    startScreenEl.addEventListener("click", handleStartClick);
  }

  startSubtitleTyping();

  // use new score collection (reset leaderboard)
  room.collection("score_v4").subscribe((scores) => {
    renderLeaderboard(scores, room);
  });
}

function handleStartClick() {
  if (typeof startCallback === "function") {
    playClickBeginHellSound();
    startCallback();
  }
}

function startSubtitleTyping() {
  if (!subtitleEl) return;
  subtitleEl.textContent = "";
  subtitleIndex = 0;
  if (typingIntervalId) {
    clearInterval(typingIntervalId);
  }
  typingIntervalId = setInterval(() => {
    if (subtitleIndex >= fullSubtitle.length) {
      clearInterval(typingIntervalId);
      typingIntervalId = null;
      return;
    }
    subtitleEl.textContent += fullSubtitle[subtitleIndex];
    // play a tiny typing blip on every character (can be tuned to every 2 chars if wanted)
    playTypingSound();
    subtitleIndex += 1;
  }, 40);
}

function renderLeaderboard(scores, room) {
  if (!leaderboardRow1El || !leaderboardRow2El) return;
  if (!scores) {
    // pull from new collection as well
    scores = room.collection("score_v4").getList();
  }

  // build best time per user (one entry per username, highest time only)
  const bestByUser = new Map();
  for (const s of scores || []) {
    if (
      !s ||
      typeof s.time !== "number" ||
      Number.isNaN(s.time) ||
      s.time > 1000
    ) {
      continue;
    }
    const username = s.username || "anon";
    const key = String(username);
    const existing = bestByUser.get(key);
    if (!existing || s.time > existing.time) {
      bestByUser.set(key, s);
    }
  }

  const best = Array.from(bestByUser.values())
    .sort((a, b) => b.time - a.time)
    .slice(0, 10);

  leaderboardRow1El.innerHTML = "";
  leaderboardRow2El.innerHTML = "";

  if (best.length === 0) return;

  best.forEach((s, idx) => {
    const timeStr = formatTimeSeconds(s.time);
    const username = s.username || "anon";
    const safeName = String(username);
    const avatarUrl = `https://images.websim.com/avatar/${encodeURIComponent(
      safeName
    )}`;

    const rowEl = idx < 5 ? leaderboardRow1El : leaderboardRow2El;
    const entry = document.createElement("div");
    entry.className = "leaderboard-entry";
    entry.innerHTML = `
      <span class="rank">${idx + 1}.</span>
      <img class="avatar" src="${avatarUrl}" alt="">
      <span class="name">${safeName}</span>
      <span class="time">${timeStr}</span>
    `;
    rowEl.appendChild(entry);
  });
}

export function showStartScreenAfterDeath() {
  if (startScreenEl) {
    startScreenEl.classList.remove("hidden-screen");
    // allow animations to play again after death
    startScreenEl.classList.remove("no-anim");
  }
  // restart subtitle typing animation instead of static text
  startSubtitleTyping();

  // only start blinking after a death (class already present from initial load)
  if (clickToBeginEl) {
    clickToBeginEl.classList.add("blink");
  }
}

export function hideStartScreenForGame() {
  if (startScreenEl) {
    startScreenEl.classList.add("hidden-screen");
  }
  // stop blinking while the game is running
  if (clickToBeginEl) {
    clickToBeginEl.classList.remove("blink");
  }
}