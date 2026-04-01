const STORAGE_KEY = "csl-spinwheel-items";
const WINNER_QUEUE_KEY = "csl-spinwheel-winner-queue";
const HISTORY_KEY = "csl-spinwheel-history";
const MAX_HISTORY = 100;
const DEFAULT_ITEMS = [
  "Shake it out",
  "Hop like a bunny",
  "Sing a song",
  "Do 10 jumps",
  "Clap your hands",
  "Dance for 20 seconds",
  "Spin again",
  "Tell a joke",
];

const wheelCanvas = document.getElementById("wheel");
const spinButton = document.getElementById("spinButton");
const openSettingsButton = document.getElementById("openSettingsButton");
const closeSettingsButton = document.getElementById("closeSettingsButton");
const settingsOverlay = document.getElementById("settingsOverlay");
const resultText = document.getElementById("resultText");
const itemForm = document.getElementById("itemForm");
const itemInput = document.getElementById("itemInput");
const itemList = document.getElementById("itemList");
const itemTemplate = document.getElementById("itemTemplate");
const itemCount = document.getElementById("itemCount");
const pointerElement = document.querySelector(".pointer");
const winnerOverlay = document.getElementById("winnerOverlay");
const winnerName = document.getElementById("winnerName");
const closeWinnerButton = document.getElementById("closeWinnerButton");
const resultCard = document.querySelector(".result-card");
const queueWinnerSelect = document.getElementById("queueWinnerSelect");
const addToQueueButton = document.getElementById("addToQueueButton");
const queueList = document.getElementById("queueList");
const queueItemTemplate = document.getElementById("queueItemTemplate");
const queueModeText = document.getElementById("queueModeText");
const queueIndicator = document.getElementById("queueIndicator");
const queueRemaining = document.getElementById("queueRemaining");
const openHistoryButton = document.getElementById("openHistoryButton");
const closeHistoryButton = document.getElementById("closeHistoryButton");
const historyOverlay = document.getElementById("historyOverlay");
const historyList = document.getElementById("historyList");
const historyCount = document.getElementById("historyCount");
const historyEmpty = document.getElementById("historyEmpty");
const clearHistoryButton = document.getElementById("clearHistoryButton");

const ctx = wheelCanvas.getContext("2d");

const colors = [
  "#ef3f23",
  "#f6a623",
  "#1ab95f",
  "#17a0d6",
  "#7a4be2",
  "#f2549d",
  "#00a890",
  "#ff6f3c",
  "#8ac926",
  "#1982c4",
];

const BASE_ANGLE = -Math.PI / 2;
// Small offset to prevent landing exactly on a slice boundary,
// which could cause ambiguous winner detection due to floating point.
const LANDING_NUDGE = 0.0001;

let items = loadItems();
let winnerQueue = loadWinnerQueue();
let spinHistory = loadHistory();
let currentRotation = 0;
let isSpinning = false;
let lastWinnerIndex = -1;
let winnerRevealTimer = null;

migrateFixedWinner();
render();

// --- Event Listeners ---

openSettingsButton.addEventListener("click", openSettingsOverlay);
closeSettingsButton.addEventListener("click", closeSettingsOverlay);
settingsOverlay.addEventListener("click", (event) => {
  if (event.target === settingsOverlay || event.target.classList.contains("settings-backdrop")) {
    closeSettingsOverlay();
  }
});

openHistoryButton.addEventListener("click", openHistoryOverlay);
closeHistoryButton.addEventListener("click", closeHistoryOverlay);
historyOverlay.addEventListener("click", (event) => {
  if (event.target === historyOverlay || event.target.classList.contains("history-backdrop")) {
    closeHistoryOverlay();
  }
});

closeWinnerButton.addEventListener("click", closeWinnerOverlay);
winnerOverlay.addEventListener("click", (event) => {
  if (event.target === winnerOverlay || event.target.classList.contains("winner-backdrop")) {
    closeWinnerOverlay();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !winnerOverlay.hidden) {
    closeWinnerOverlay();
    return;
  }

  if (event.key === "Escape" && !historyOverlay.hidden) {
    closeHistoryOverlay();
    return;
  }

  if (event.key === "Escape" && !settingsOverlay.hidden) {
    closeSettingsOverlay();
  }
});

itemForm.addEventListener("submit", (event) => {
  event.preventDefault();

  if (isSpinning) {
    return;
  }

  const value = itemInput.value.trim();
  if (!value) {
    itemInput.focus();
    return;
  }

  items.push(value);
  persistItems();
  itemInput.value = "";
  clearWinnerState();
  render();
  itemInput.focus();
});

spinButton.addEventListener("click", () => {
  if (isSpinning || items.length < 2) {
    return;
  }

  animateSpin();
});

itemList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-index]");
  if (!button || isSpinning) {
    return;
  }

  const index = Number(button.dataset.index);
  const removedItem = items[index];
  items.splice(index, 1);

  winnerQueue = winnerQueue.filter((q) => q !== removedItem);
  persistWinnerQueue();

  persistItems();
  clearWinnerState();
  render();

  const nextButton = itemList.querySelector(`button[data-index="${Math.min(index, items.length - 1)}"]`);
  if (nextButton) {
    nextButton.focus();
  } else {
    itemInput.focus();
  }
});

addToQueueButton.addEventListener("click", () => {
  const value = queueWinnerSelect.value;
  if (!value || isSpinning) {
    return;
  }

  winnerQueue.push(value);
  persistWinnerQueue();
  queueWinnerSelect.value = "";
  render();
});

queueList.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-queue-index]");
  if (!button || isSpinning) {
    return;
  }

  const index = Number(button.dataset.queueIndex);
  winnerQueue.splice(index, 1);
  persistWinnerQueue();
  render();
});

clearHistoryButton.addEventListener("click", () => {
  spinHistory = [];
  persistHistory();
  renderHistoryList();
});

// --- Persistence ---

function loadItems() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return [...DEFAULT_ITEMS];
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_ITEMS];
    }

    const cleaned = parsed
      .map((item) => String(item).trim())
      .filter(Boolean)
      .slice(0, 40);

    return cleaned;
  } catch (error) {
    return [...DEFAULT_ITEMS];
  }
}

function persistItems() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

function loadWinnerQueue() {
  try {
    const saved = localStorage.getItem(WINNER_QUEUE_KEY);
    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((q) => String(q).trim()).filter(Boolean);
  } catch (error) {
    return [];
  }
}

function persistWinnerQueue() {
  localStorage.setItem(WINNER_QUEUE_KEY, JSON.stringify(winnerQueue));
}

function sanitizeWinnerQueue() {
  winnerQueue = winnerQueue.filter((q) => items.includes(q));
}

function loadHistory() {
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (!saved) {
      return [];
    }

    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.slice(0, MAX_HISTORY);
  } catch (error) {
    return [];
  }
}

function persistHistory() {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(spinHistory));
}

function recordHistory(winner, wasQueued) {
  spinHistory.unshift({
    winner,
    timestamp: Date.now(),
    wasQueued,
  });
  if (spinHistory.length > MAX_HISTORY) {
    spinHistory.pop();
  }
  persistHistory();
}

function migrateFixedWinner() {
  try {
    const old = localStorage.getItem("csl-spinwheel-fixed-winner");
    if (old && items.includes(old) && winnerQueue.length === 0) {
      winnerQueue.push(old);
      persistWinnerQueue();
    }
    localStorage.removeItem("csl-spinwheel-fixed-winner");
  } catch (error) {
    // ignore
  }
}

// --- Rendering ---

function render() {
  sanitizeWinnerQueue();
  drawWheel();
  renderItemList();
  updateUiState();
  updateQueueUi();
}

function updateUiState() {
  itemCount.textContent = String(items.length);

  if (winnerQueue.length > 0) {
    queueIndicator.hidden = false;
    queueRemaining.textContent = String(winnerQueue.length);
  } else {
    queueIndicator.hidden = true;
  }

  if (items.length < 2) {
    spinButton.disabled = true;
    resultCard.classList.remove("is-winner");
    resultText.textContent = "Add at least 2 items to spin";
    return;
  }

  spinButton.disabled = isSpinning;
  if (!isSpinning && resultText.textContent === "Add at least 2 items to spin") {
    resultText.textContent = "Press spin to begin";
  }
}

function renderItemList() {
  itemList.innerHTML = "";

  items.forEach((item, index) => {
    const node = itemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".item-name").textContent = item;

    const deleteButton = node.querySelector(".delete-button");
    deleteButton.dataset.index = String(index);
    deleteButton.disabled = isSpinning;

    itemList.appendChild(node);
  });
}

function updateQueueUi() {
  queueWinnerSelect.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Choose an item...";
  queueWinnerSelect.appendChild(placeholder);

  items.forEach((item) => {
    const option = document.createElement("option");
    option.value = item;
    option.textContent = item;
    queueWinnerSelect.appendChild(option);
  });

  if (winnerQueue.length > 0) {
    const count = winnerQueue.length;
    queueModeText.textContent = `Next ${count} spin${count > 1 ? "s" : ""} queued.`;
  } else {
    queueModeText.textContent = "No queued winners. Spins are random.";
  }

  renderQueueList();
}

function renderQueueList() {
  queueList.innerHTML = "";

  winnerQueue.forEach((item, index) => {
    const node = queueItemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".queue-position").textContent = String(index + 1);
    node.querySelector(".item-name").textContent = item;

    if (index === 0) {
      node.classList.add("queue-item-next");
    }

    const removeButton = node.querySelector(".delete-button");
    removeButton.dataset.queueIndex = String(index);
    removeButton.disabled = isSpinning;

    queueList.appendChild(node);
  });
}

function renderHistoryList() {
  historyList.innerHTML = "";
  historyCount.textContent = String(spinHistory.length);

  if (spinHistory.length === 0) {
    historyEmpty.hidden = false;
    clearHistoryButton.hidden = true;
    return;
  }

  historyEmpty.hidden = true;
  clearHistoryButton.hidden = false;

  spinHistory.forEach((entry) => {
    const li = document.createElement("li");
    li.className = "item-row history-row";

    const nameSpan = document.createElement("strong");
    nameSpan.className = "item-name";
    nameSpan.textContent = entry.winner;

    const metaDiv = document.createElement("div");
    metaDiv.className = "history-meta";

    if (entry.wasQueued) {
      const badge = document.createElement("span");
      badge.className = "history-badge";
      badge.textContent = "Queued";
      metaDiv.appendChild(badge);
    }

    const timeSpan = document.createElement("span");
    timeSpan.className = "history-time";
    timeSpan.textContent = formatTimestamp(entry.timestamp);
    metaDiv.appendChild(timeSpan);

    li.appendChild(nameSpan);
    li.appendChild(metaDiv);
    historyList.appendChild(li);
  });
}

function formatTimestamp(ts) {
  const date = new Date(ts);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// --- Wheel Drawing ---

function drawWheel() {
  const size = wheelCanvas.width;
  const radius = size / 2;

  ctx.clearRect(0, 0, size, size);
  ctx.save();
  ctx.translate(radius, radius);

  if (!items.length) {
    ctx.beginPath();
    ctx.arc(0, 0, radius - 12, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
    ctx.fill();
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(239, 91, 47, 0.16)";
    ctx.stroke();

    ctx.fillStyle = "#9b6c58";
    ctx.font = '700 26px Georgia, "Times New Roman", serif';
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("Add items", 0, -10);

    ctx.font = '600 15px "Trebuchet MS", sans-serif';
    ctx.fillText("to build your wheel", 0, 18);
    ctx.restore();
    return;
  }

  const sliceAngle = (Math.PI * 2) / items.length;

  items.forEach((item, index) => {
    const startAngle = BASE_ANGLE + currentRotation + index * sliceAngle;
    const endAngle = startAngle + sliceAngle;
    const centerAngle = startAngle + sliceAngle / 2;
    const sliceRadius = radius - 12;

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, sliceRadius, startAngle, endAngle);
    ctx.closePath();
    ctx.fillStyle = colors[index % colors.length];
    ctx.fill();

    if (index === lastWinnerIndex) {
      ctx.fillStyle = "rgba(255, 255, 255, 0.16)";
      ctx.fill();
    }

    ctx.strokeStyle = "rgba(255, 255, 255, 0.92)";
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, sliceRadius, startAngle, endAngle);
    ctx.closePath();
    ctx.clip();

    ctx.translate(
      Math.cos(centerAngle) * radius * 0.64,
      Math.sin(centerAngle) * radius * 0.64,
    );
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    drawSliceLabel(item, sliceAngle, radius);
    ctx.restore();
  });

  ctx.beginPath();
  ctx.arc(0, 0, radius - 10, 0, Math.PI * 2);
  ctx.lineWidth = 8;
  ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
  ctx.stroke();

  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
  ctx.fill();

  ctx.restore();
}

// --- Spin Animation ---

function animateSpin() {
  isSpinning = true;
  clearWinnerRevealTimer();
  lastWinnerIndex = -1;
  updateUiState();
  renderItemList();
  resultText.textContent = "Spinning...";

  const pointerAngle = getPointerAngle();
  const initialRotation = currentRotation;
  const phaseOneDuration = 4000;
  const phaseTwoDuration = 3000;
  const fullTurn = Math.PI * 2;
  const phaseOneTurns = 7.8;
  const phaseOneDistance = phaseOneTurns * fullTurn;
  const phaseOneSpeed = phaseOneDistance / (phaseOneDuration / 1000);
  const winnerIndex = getTargetWinnerIndex();
  const isQueuedSpin = winnerQueue.length > 0 && items[winnerIndex] === winnerQueue[0];
  const normalizedInitialRotation = normalizeAngle(initialRotation);
  const targetRotation = getSafeLandingRotationForWinnerIndex(
    winnerIndex,
    pointerAngle,
    isQueuedSpin,
  );
  // Use an INTEGER number of full turns so the fractional part doesn't
  // shift the landing away from targetRotation.
  const baseTurns = 10 + Math.floor(Math.random() * 3);
  let totalDistance =
    baseTurns * fullTurn +
    normalizeAngle(targetRotation - normalizedInitialRotation);
  let phaseTwoDistance = totalDistance - phaseOneDistance;
  const minimumPhaseTwoDistance = phaseOneSpeed * (phaseTwoDuration / 1000) * 0.54;

  while (phaseTwoDistance < minimumPhaseTwoDistance) {
    totalDistance += fullTurn;
    phaseTwoDistance += fullTurn;
  }

  const finalRotation = initialRotation + totalDistance;
  const phaseTwoSeconds = phaseTwoDuration / 1000;
  const phaseTwoA =
    (phaseOneSpeed * phaseTwoSeconds - 2 * phaseTwoDistance) /
    Math.pow(phaseTwoSeconds, 3);
  const phaseTwoB =
    (3 * phaseTwoDistance - 2 * phaseOneSpeed * phaseTwoSeconds) /
    Math.pow(phaseTwoSeconds, 2);
  const startTime = performance.now();

  function completeSpin(finalRotation, landedIndex) {
    currentRotation = finalRotation;
    drawWheel();
    isSpinning = false;
    updateUiState();
    renderItemList();
    lastWinnerIndex = landedIndex;
    drawWheel();
    const winner = items[landedIndex];

    // Record history BEFORE dequeuing
    recordHistory(winner, isQueuedSpin);

    // Dequeue if this was a queued spin
    if (isQueuedSpin && winnerQueue.length > 0 && winnerQueue[0] === winner) {
      winnerQueue.shift();
      persistWinnerQueue();
      updateQueueUi();
      updateUiState();
    }

    resultText.textContent = winner;
    resultCard.classList.add("is-winner");
    winnerRevealTimer = window.setTimeout(() => {
      openWinnerOverlay(winner);
      winnerRevealTimer = null;
    }, 220);
  }

  function frame(now) {
    const elapsed = now - startTime;

    if (elapsed < phaseOneDuration) {
      const linear = elapsed / phaseOneDuration;
      // Ease-in curve: starts from rest, exits at phaseOneSpeed.
      // f(t) = t²(2-t) -> f'(0)=0 (smooth start), f'(1)=1 (matches phase-two entry speed).
      const phaseOneProgress = linear * linear * (2 - linear);
      currentRotation = initialRotation + phaseOneDistance * phaseOneProgress;
      drawWheel();
      requestAnimationFrame(frame);
      return;
    }

    const phaseTwoElapsed = Math.min(elapsed - phaseOneDuration, phaseTwoDuration);
    const t = phaseTwoElapsed / 1000;
    const traveled =
      phaseTwoA * Math.pow(t, 3) +
      phaseTwoB * Math.pow(t, 2) +
      phaseOneSpeed * t;

    currentRotation = initialRotation + phaseOneDistance + traveled;
    drawWheel();

    if (phaseTwoElapsed < phaseTwoDuration) {
      requestAnimationFrame(frame);
      return;
    }

    completeSpin(finalRotation, winnerIndex);
  }

  requestAnimationFrame(frame);
}

// --- Math Helpers ---

function normalizeAngle(angle) {
  const full = Math.PI * 2;
  return ((angle % full) + full) % full;
}

function drawSliceLabel(text, sliceAngle, radius) {
  const labelRadius = radius * 0.64;
  const maxWidth = Math.max(28, 2 * Math.sin(sliceAngle / 2) * labelRadius * 0.82);
  const fontSize = getSliceFontSize(text, maxWidth);
  const fittedText = fitTextToWidth(text, maxWidth, fontSize);

  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${fontSize}px "Trebuchet MS", sans-serif`;
  ctx.fillText(fittedText, 0, 0);
}

function getSliceFontSize(text, maxWidth) {
  for (let size = 15; size >= 8; size -= 1) {
    ctx.font = `700 ${size}px "Trebuchet MS", sans-serif`;
    if (ctx.measureText(text).width <= maxWidth) {
      return size;
    }
  }

  return 8;
}

function fitTextToWidth(text, maxWidth, fontSize) {
  ctx.font = `700 ${fontSize}px "Trebuchet MS", sans-serif`;
  if (ctx.measureText(text).width <= maxWidth) {
    return text;
  }

  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}...`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }

  return `${trimmed}...`;
}

function getWinnerIndexFromRotation(rotation = currentRotation, pointerAngle = getPointerAngle()) {
  if (!items.length) {
    return -1;
  }

  const sliceAngle = (Math.PI * 2) / items.length;
  const pointerRelativeAngle = normalizeAngle(
    pointerAngle - BASE_ANGLE - normalizeAngle(rotation),
  );

  return Math.min(items.length - 1, Math.floor(pointerRelativeAngle / sliceAngle));
}

function getTargetWinnerIndex() {
  if (winnerQueue.length > 0) {
    for (let i = 0; i < winnerQueue.length; i++) {
      const idx = items.indexOf(winnerQueue[i]);
      if (idx >= 0) {
        return idx;
      }
    }
  }

  return Math.floor(Math.random() * items.length);
}

function getRotationForWinnerIndex(index, pointerAngle = getPointerAngle()) {
  const sliceAngle = (Math.PI * 2) / items.length;
  const winnerCenter = index * sliceAngle + sliceAngle / 2;
  return normalizeAngle(pointerAngle - BASE_ANGLE - winnerCenter - LANDING_NUDGE);
}

function getSafeLandingRotationForWinnerIndex(
  index,
  pointerAngle = getPointerAngle(),
  isQueuedSpin = false,
) {
  const sliceAngle = (Math.PI * 2) / items.length;
  const safePadding = sliceAngle * (isQueuedSpin ? 0.32 : 0.24);
  const safeStart = index * sliceAngle + safePadding;
  const safeEnd = (index + 1) * sliceAngle - safePadding;
  const safeCenter = (safeStart + safeEnd) / 2;
  const safeSpan = Math.max(0, safeEnd - safeStart);
  const offsetRatio = isQueuedSpin ? 0 : (Math.random() - 0.5) * 0.5;
  const pointerRelativeAngle = safeCenter + safeSpan * offsetRatio;
  const targetRotation = normalizeAngle(
    pointerAngle - BASE_ANGLE - pointerRelativeAngle - LANDING_NUDGE,
  );

  if (getWinnerIndexFromRotation(targetRotation, pointerAngle) === index) {
    return targetRotation;
  }

  return getRotationForWinnerIndex(index, pointerAngle);
}

function getPointerAngle() {
  if (!pointerElement) {
    return Math.PI;
  }

  const wheelRect = wheelCanvas.getBoundingClientRect();
  const pointerRect = pointerElement.getBoundingClientRect();

  const wheelCenterX = wheelRect.left + wheelRect.width / 2;
  const wheelCenterY = wheelRect.top + wheelRect.height / 2;
  const pointerTipX = pointerRect.right;
  const pointerTipY = pointerRect.top + pointerRect.height / 2;

  return Math.atan2(pointerTipY - wheelCenterY, pointerTipX - wheelCenterX);
}

// --- Overlay Helpers ---

function openSettingsOverlay() {
  settingsOverlay.hidden = false;
  itemInput.focus();
}

function closeSettingsOverlay() {
  settingsOverlay.hidden = true;
}

function openHistoryOverlay() {
  renderHistoryList();
  historyOverlay.hidden = false;
  closeHistoryButton.focus();
}

function closeHistoryOverlay() {
  historyOverlay.hidden = true;
}

function openWinnerOverlay(item) {
  winnerName.textContent = item;
  winnerOverlay.hidden = false;
  closeWinnerButton.focus();
}

function closeWinnerOverlay() {
  winnerOverlay.hidden = true;
}

function clearWinnerState() {
  clearWinnerRevealTimer();
  closeWinnerOverlay();
  resultCard.classList.remove("is-winner");
  lastWinnerIndex = -1;
  if (!isSpinning && items.length >= 2) {
    resultText.textContent = "Press spin to begin";
  }
}

function clearWinnerRevealTimer() {
  if (winnerRevealTimer !== null) {
    window.clearTimeout(winnerRevealTimer);
    winnerRevealTimer = null;
  }
}
