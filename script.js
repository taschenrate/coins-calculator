"use strict";

const STORAGE_KEY = "moderators_coins_database";

let moderators = [];
let currentResult = null;
let editingId = null;
let topChart = null;
let bulkPreviewRecords = [];
let confirmResolver = null;
let lastFocusedElement = null;

const elements = {
  calculatorForm: document.getElementById("calculatorForm"),
  nicknameInput: document.getElementById("nicknameInput"),
  checksInput: document.getElementById("checksInput"),
  resetFormButton: document.getElementById("resetFormButton"),
  resultCard: document.getElementById("resultCard"),
  resultNickname: document.getElementById("resultNickname"),
  resultChecks: document.getElementById("resultChecks"),
  resultCoins: document.getElementById("resultCoins"),
  saveResultButton: document.getElementById("saveResultButton"),
  moderatorsTable: document.getElementById("moderatorsTable"),
  tableEmpty: document.getElementById("tableEmpty"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  clearDatabaseButton: document.getElementById("clearDatabaseButton"),
  exportTxtButton: document.getElementById("exportTxtButton"),
  exportCsvButton: document.getElementById("exportCsvButton"),
  importTxtButton: document.getElementById("importTxtButton"),
  importCsvButton: document.getElementById("importCsvButton"),
  txtFileInput: document.getElementById("txtFileInput"),
  csvFileInput: document.getElementById("csvFileInput"),
  bulkPasteInput: document.getElementById("bulkPasteInput"),
  bulkParseButton: document.getElementById("bulkParseButton"),
  bulkSaveButton: document.getElementById("bulkSaveButton"),
  bulkClearButton: document.getElementById("bulkClearButton"),
  bulkPreviewShell: document.getElementById("bulkPreviewShell"),
  bulkPreviewTable: document.getElementById("bulkPreviewTable"),
  bulkEmpty: document.getElementById("bulkEmpty"),
  bulkSummary: document.getElementById("bulkSummary"),
  confirmModal: document.getElementById("confirmModal"),
  confirmIcon: document.getElementById("confirmIcon"),
  confirmTitle: document.getElementById("confirmTitle"),
  confirmMessage: document.getElementById("confirmMessage"),
  confirmAcceptButton: document.getElementById("confirmAcceptButton"),
  confirmCancelButton: document.getElementById("confirmCancelButton"),
  confirmCloseButton: document.getElementById("confirmCloseButton"),
  toastContainer: document.getElementById("toastContainer"),
  statModerators: document.getElementById("statModerators"),
  statChecks: document.getElementById("statChecks"),
  statCoins: document.getElementById("statCoins"),
  statAverage: document.getElementById("statAverage"),
  statBest: document.getElementById("statBest"),
  headerCoins: document.getElementById("headerCoins"),
  chartCanvas: document.getElementById("topChart"),
  chartEmpty: document.getElementById("chartEmpty"),
  podiumList: document.getElementById("podiumList")
};

function calculateCoins(checks) {
  const amount = Number(checks);

  if (!Number.isFinite(amount) || amount < 300) {
    return 0;
  }

  let coins = 300;

  if (amount > 300) {
    coins += (Math.min(amount, 450) - 300) * 2;
  }

  if (amount >= 450) {
    coins += 1000;
  }

  if (amount > 450) {
    coins += (amount - 450) * 5;
  }

  if (amount >= 1000) {
    coins += 1000;
  }

  return coins;
}

function formatNumber(value) {
  return Number(value).toLocaleString("ru-RU");
}

function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }

  return `mod-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCurrentDate() {
  const date = new Date();
  const pad = (value) => String(value).padStart(2, "0");

  return `${pad(date.getDate())}.${pad(date.getMonth() + 1)}.${date.getFullYear()} ${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function loadFromStorage() {
  try {
    const rawData = localStorage.getItem(STORAGE_KEY);
    const savedModerators = rawData ? JSON.parse(rawData) : [];

    moderators = Array.isArray(savedModerators)
      ? savedModerators.map(normalizeStoredModerator).filter(Boolean)
      : [];
  } catch (error) {
    moderators = [];
    localStorage.removeItem(STORAGE_KEY);
    showToast("Ошибка импорта", "error");
  }
}

function saveToStorage() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(moderators));
}

function calculateAndShowResult() {
  const nickname = elements.nicknameInput.value.trim();
  const checksValue = elements.checksInput.value.trim();
  const checks = Number(checksValue);

  if (!nickname) {
    showToast("Введите ник модератора", "error");
    elements.nicknameInput.focus();
    return null;
  }

  if (checksValue === "" || !Number.isFinite(checks) || checks < 0 || !Number.isInteger(checks)) {
    showToast("Введите корректное количество проверок", "error");
    elements.checksInput.focus();
    return null;
  }

  currentResult = {
    nickname,
    checks,
    coins: calculateCoins(checks)
  };

  elements.resultNickname.textContent = currentResult.nickname;
  elements.resultChecks.textContent = formatNumber(currentResult.checks);
  elements.resultCoins.textContent = formatNumber(currentResult.coins);
  elements.resultCard.classList.remove("hidden");
  refreshIcons();

  return currentResult;
}

function saveModerator() {
  const result = calculateAndShowResult();

  if (!result) {
    return;
  }

  const record = {
    nickname: result.nickname,
    checks: result.checks,
    coins: result.coins,
    date: getCurrentDate()
  };

  const sameNicknameIndex = findModeratorIndexByNickname(record.nickname, editingId);
  const editingIndex = editingId ? moderators.findIndex((moderator) => moderator.id === editingId) : -1;
  let action = "saved";

  if (editingIndex >= 0 && sameNicknameIndex >= 0) {
    moderators[sameNicknameIndex] = {
      ...moderators[sameNicknameIndex],
      ...record
    };
    moderators.splice(editingIndex, 1);
    action = "updated";
  } else if (editingIndex >= 0) {
    moderators[editingIndex] = {
      ...moderators[editingIndex],
      ...record
    };
    action = "updated";
  } else if (sameNicknameIndex >= 0) {
    moderators[sameNicknameIndex] = {
      ...moderators[sameNicknameIndex],
      ...record
    };
    action = "updated";
  } else {
    moderators.push({
      id: generateId(),
      ...record
    });
  }

  saveToStorage();
  resetForm();
  renderAll();
  showToast(action === "updated" ? "Модератор обновлен" : "Модератор сохранен", "success");
}

function editModerator(id) {
  const moderator = moderators.find((item) => item.id === id);

  if (!moderator) {
    showToast("Запись не найдена", "warning");
    return;
  }

  editingId = id;
  elements.nicknameInput.value = moderator.nickname;
  elements.checksInput.value = moderator.checks;
  calculateAndShowResult();
  document.getElementById("calculatorPanel").scrollIntoView({ behavior: "smooth", block: "start" });
  elements.nicknameInput.focus();
}

async function deleteModerator(id) {
  const moderator = moderators.find((item) => item.id === id);

  if (!moderator) {
    return;
  }

  const confirmed = await showConfirmModal({
    title: "Удалить модератора?",
    message: `Запись ${moderator.nickname} будет удалена из локальной базы.`,
    confirmText: "Удалить"
  });

  if (!confirmed) {
    return;
  }

  moderators = moderators.filter((item) => item.id !== id);
  saveToStorage();
  renderAll();
  showToast("Запись удалена", "success");
}

async function clearDatabase() {
  if (moderators.length === 0) {
    showToast("База уже пустая", "info");
    return;
  }

  const confirmed = await showConfirmModal({
    title: "Очистить базу?",
    message: "Все сохраненные модераторы будут удалены из браузера.",
    confirmText: "Очистить"
  });

  if (!confirmed) {
    return;
  }

  moderators = [];
  saveToStorage();
  resetForm();
  renderAll();
  showToast("База очищена", "success");
}

function renderTable() {
  const filteredModerators = getFilteredModerators();
  const rankMap = getRankMap();
  const hasSearch = elements.searchInput.value.trim() !== "";

  elements.moderatorsTable.innerHTML = filteredModerators
    .map((moderator) => {
      const rank = rankMap.get(moderator.id) || "—";
      const rankClass = rank <= 3 ? `rank-${rank}` : "";

      return `
        <tr>
          <td><span class="rank-badge ${rankClass}">#${rank}</span></td>
          <td class="nickname-cell" title="${escapeHTML(moderator.nickname)}">${escapeHTML(
            moderator.nickname
          )}</td>
          <td>${formatNumber(moderator.checks)}</td>
          <td>${formatNumber(moderator.coins)}</td>
          <td>${escapeHTML(moderator.date)}</td>
          <td>
            <div class="actions-cell">
              <button class="btn icon-btn edit" type="button" data-action="edit" data-id="${escapeHTML(
                moderator.id
              )}" title="Редактировать" aria-label="Редактировать ${escapeHTML(
        moderator.nickname
      )}">
                <i data-lucide="pencil"></i>
              </button>
              <button class="btn icon-btn delete" type="button" data-action="delete" data-id="${escapeHTML(
                moderator.id
              )}" title="Удалить" aria-label="Удалить ${escapeHTML(moderator.nickname)}">
                <i data-lucide="trash"></i>
              </button>
            </div>
          </td>
        </tr>
      `;
    })
    .join("");

  if (moderators.length === 0) {
    elements.tableEmpty.querySelector("p").textContent = "Пока нет сохраненных модераторов";
    elements.tableEmpty.classList.remove("hidden");
  } else if (filteredModerators.length === 0 && hasSearch) {
    elements.tableEmpty.querySelector("p").textContent = "По вашему запросу ничего не найдено";
    elements.tableEmpty.classList.remove("hidden");
  } else {
    elements.tableEmpty.classList.add("hidden");
  }

  refreshIcons();
}

function renderStats() {
  const totalModerators = moderators.length;
  const totalChecks = moderators.reduce((sum, moderator) => sum + moderator.checks, 0);
  const totalCoins = moderators.reduce((sum, moderator) => sum + moderator.coins, 0);
  const averageCoins = totalModerators > 0 ? Math.round(totalCoins / totalModerators) : 0;
  const bestModerator = getTopModerators(1)[0];

  elements.statModerators.textContent = formatNumber(totalModerators);
  elements.statChecks.textContent = formatNumber(totalChecks);
  elements.statCoins.textContent = formatNumber(totalCoins);
  elements.statAverage.textContent = formatNumber(averageCoins);
  elements.statBest.textContent = bestModerator ? bestModerator.nickname : "—";
  elements.headerCoins.textContent = formatNumber(totalCoins);
}

function renderChart() {
  const topModerators = getTopModerators(5);
  const hasData = topModerators.length > 0 && typeof Chart !== "undefined";

  elements.chartCanvas.classList.toggle("hidden", !hasData);
  elements.chartEmpty.classList.toggle("hidden", hasData);

  if (!hasData) {
    if (topChart) {
      topChart.destroy();
      topChart = null;
    }
    return;
  }

  const labels = topModerators.map((moderator) => moderator.nickname);
  const data = topModerators.map((moderator) => moderator.coins);

  if (topChart) {
    topChart.data.labels = labels;
    topChart.data.datasets[0].data = data;
    topChart.update();
    return;
  }

  topChart = new Chart(elements.chartCanvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Коины",
          data,
          borderWidth: 1,
          borderColor: "rgba(255, 255, 255, 0.18)",
          borderRadius: 10,
          backgroundColor: [
            "rgba(245, 158, 11, 0.86)",
            "rgba(148, 163, 184, 0.82)",
            "rgba(217, 119, 6, 0.78)",
            "rgba(59, 130, 246, 0.76)",
            "rgba(34, 197, 94, 0.72)"
          ]
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: "rgba(15, 23, 42, 0.96)",
          borderColor: "rgba(255, 255, 255, 0.14)",
          borderWidth: 1,
          callbacks: {
            label(context) {
              return `Коинов: ${formatNumber(context.parsed.y)}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: "rgba(255, 255, 255, 0.07)"
          },
          ticks: {
            color: "#cbd5e1",
            font: {
              weight: 700
            }
          }
        },
        y: {
          beginAtZero: true,
          grid: {
            color: "rgba(255, 255, 255, 0.08)"
          },
          ticks: {
            color: "#cbd5e1",
            callback(value) {
              return formatNumber(value);
            }
          }
        }
      }
    }
  });
}

function exportTXT() {
  if (moderators.length === 0) {
    showToast("Нет данных для экспорта", "warning");
    return;
  }

  const lines = [
    "Ник | Проверки | Коины | Дата",
    ...getTopModerators(moderators.length).map(
      (moderator) => `${moderator.nickname} | ${moderator.checks} | ${moderator.coins} | ${moderator.date}`
    )
  ];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
    type: "text/plain;charset=utf-8"
  });

  downloadBlob(blob, "moderators.txt");
  showToast("TXT экспортирован", "success");
}

function exportCSV() {
  if (moderators.length === 0) {
    showToast("Нет данных для экспорта", "warning");
    return;
  }

  const lines = [
    "nickname,checks,coins,date",
    ...getTopModerators(moderators.length).map((moderator) =>
      [moderator.nickname, moderator.checks, moderator.coins, moderator.date].map(escapeCSV).join(",")
    )
  ];
  const blob = new Blob([`\uFEFF${lines.join("\n")}`], {
    type: "text/csv;charset=utf-8"
  });

  downloadBlob(blob, "moderators.csv");
  showToast("CSV экспортирован", "success");
}

function importFile(file) {
  if (!file) {
    return;
  }

  const fileName = file.name.toLowerCase();
  const reader = new FileReader();

  reader.onload = () => {
    try {
      const content = String(reader.result || "");
      const importedCount = fileName.endsWith(".csv") ? parseCSV(content) : parseTXT(content);

      if (importedCount === 0) {
        throw new Error("No valid rows");
      }

      saveToStorage();
      renderAll();
      showToast("Данные импортированы", "success");
    } catch (error) {
      showToast("Ошибка импорта", "error");
    }
  };

  reader.onerror = () => showToast("Ошибка импорта", "error");
  reader.readAsText(file, "UTF-8");
}

function calculateBulkPaste({ silent = false } = {}) {
  bulkPreviewRecords = parsePastedLeaderboard(elements.bulkPasteInput.value);
  renderBulkPreview(bulkPreviewRecords.length === 0 && elements.bulkPasteInput.value.trim() !== "");

  if (silent) {
    return;
  }

  if (bulkPreviewRecords.length === 0) {
    showToast("Не удалось найти строки с ником и проверками", "warning");
    return;
  }

  showToast(`Рассчитано записей: ${bulkPreviewRecords.length}`, "success");
}

function saveBulkPreview() {
  if (bulkPreviewRecords.length === 0) {
    showToast("Сначала рассчитайте список", "warning");
    return;
  }

  const date = getCurrentDate();

  bulkPreviewRecords.forEach((record) => {
    const moderator = {
      nickname: record.nickname,
      checks: record.checks,
      coins: record.coins,
      date
    };
    const existingIndex = findModeratorIndexByNickname(record.nickname);

    if (existingIndex >= 0) {
      moderators[existingIndex] = {
        ...moderators[existingIndex],
        ...moderator
      };
      return;
    }

    moderators.push({
      id: generateId(),
      ...moderator
    });
  });

  saveToStorage();
  renderAll();
  showToast(`Список сохранен: ${bulkPreviewRecords.length}`, "success");
}

function clearBulkPaste() {
  elements.bulkPasteInput.value = "";
  bulkPreviewRecords = [];
  renderBulkPreview(false);
}

function renderBulkPreview(showEmpty = false) {
  elements.bulkSummary.querySelector("strong").textContent = formatNumber(bulkPreviewRecords.length);
  elements.bulkSaveButton.disabled = bulkPreviewRecords.length === 0;
  elements.bulkPreviewShell.classList.toggle("hidden", bulkPreviewRecords.length === 0);
  elements.bulkEmpty.classList.toggle("hidden", !showEmpty || bulkPreviewRecords.length > 0);

  elements.bulkPreviewTable.innerHTML = bulkPreviewRecords
    .map(
      (record, index) => `
        <tr>
          <td><span class="rank-badge ${record.sourcePosition <= 3 ? `rank-${record.sourcePosition}` : ""}">#${
        record.sourcePosition || index + 1
      }</span></td>
          <td class="nickname-cell" title="${escapeHTML(record.nickname)}">${escapeHTML(record.nickname)}</td>
          <td>${formatNumber(record.checks)}</td>
          <td>${formatNumber(record.coins)}</td>
        </tr>
      `
    )
    .join("");

  refreshIcons();
}

function parsePastedLeaderboard(content) {
  const lines = String(content)
    .replace(/\u00A0/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const records = [];

  lines.forEach((line) => {
    addBulkRecord(records, parseCompactLeaderboardLine(line, records.length + 1));
  });

  const tokens = lines.flatMap((line) => line.split(/\t+/).map((part) => part.trim()).filter(Boolean));
  let index = 0;

  while (index < tokens.length - 1) {
    const position = tokens[index];
    const nickname = tokens[index + 1];
    const checks = tokens[index + 2];

    if (isRankToken(position) && isNicknameToken(nickname) && isIntegerToken(checks)) {
      const amountToken = tokens[index + 3] && isAmountToken(tokens[index + 3]) ? tokens[index + 3] : "";

      addBulkRecord(records, createBulkRecord(nickname, checks, position, amountToken));
      index += amountToken ? 4 : 3;
      continue;
    }

    if (isNicknameToken(position) && isIntegerToken(nickname)) {
      const amountToken = checks && isAmountToken(checks) ? checks : "";

      addBulkRecord(records, createBulkRecord(position, nickname, "", amountToken, records.length + 1));
      index += amountToken ? 3 : 2;
      continue;
    }

    index += 1;
  }

  return dedupeBulkRecords(records);
}

function parseCompactLeaderboardLine(line, fallbackPosition = 0) {
  const normalizedLine = line.replace(/\t/g, " ").replace(/\s+/g, " ").trim();
  const rankedMatch = normalizedLine.match(
    /^(\d{1,4})\s+([A-Za-zА-Яа-яЁё0-9_.-]+)\s+(\d{1,7})(?:\s+([\d\s.,]+(?:₽|р|руб\.?)?))?$/i
  );

  if (rankedMatch) {
    return createBulkRecord(rankedMatch[2], rankedMatch[3], rankedMatch[1], rankedMatch[4] || "");
  }

  const plainMatch = normalizedLine.match(
    /^([A-Za-zА-Яа-яЁё0-9_.-]+)\s+(\d{1,7})(?:\s+([\d\s.,]+(?:₽|р|руб\.?)?))?$/i
  );

  if (plainMatch) {
    return createBulkRecord(plainMatch[1], plainMatch[2], "", plainMatch[3] || "", fallbackPosition);
  }

  return null;
}

function createBulkRecord(nickname, rawChecks, rawPosition, rawAmount = "", fallbackPosition = 0) {
  const checks = parseIntegerToken(rawChecks);

  if (!isNicknameToken(nickname) || checks === null) {
    return null;
  }

  return {
    sourcePosition: parseIntegerToken(rawPosition) || fallbackPosition,
    nickname: nickname.trim(),
    checks,
    coins: calculateCoins(checks)
  };
}

function addBulkRecord(records, record) {
  if (!record) {
    return;
  }

  records.push({
    ...record,
    order: records.length
  });
}

function dedupeBulkRecords(records) {
  const uniqueRecords = new Map();

  records.forEach((record) => {
    const key = record.nickname.toLowerCase();

    if (!uniqueRecords.has(key)) {
      uniqueRecords.set(key, record);
    }
  });

  return [...uniqueRecords.values()]
    .sort((first, second) => {
      if (first.sourcePosition !== second.sourcePosition) {
        return first.sourcePosition - second.sourcePosition;
      }

      return first.order - second.order;
    })
    .map(({ order, ...record }) => record);
}

function isRankToken(value) {
  return /^\d{1,4}$/.test(String(value).trim());
}

function isIntegerToken(value) {
  return /^\d{1,7}$/.test(String(value).trim());
}

function isNicknameToken(value) {
  const text = String(value).trim();

  return (
    /^[A-Za-zА-Яа-яЁё0-9_.-]+$/.test(text) &&
    /[A-Za-zА-Яа-яЁё_]/.test(text) &&
    !isLeaderboardHeader(text) &&
    !isAmountToken(text)
  );
}

function isLeaderboardHeader(value) {
  const text = String(value).toLowerCase();

  return ["позиция", "ник", "никнейм", "проверки", "зарплата", "топ"].some((word) => text.includes(word));
}

function isAmountToken(value) {
  const text = String(value).trim();

  return parseAmountToken(text) !== null && (/(₽|руб|р\.?)/i.test(text) || /\s/.test(text));
}

function parseIntegerToken(value) {
  const text = String(value).replace(/\s/g, "");

  if (!/^\d+$/.test(text)) {
    return null;
  }

  return Number(text);
}

function parseAmountToken(value) {
  const text = String(value || "")
    .replace(/[^\d,.\s]/g, "")
    .replace(/\s/g, "")
    .replace(",", ".");

  if (!text || !/^\d+(?:\.\d+)?$/.test(text)) {
    return null;
  }

  return Math.round(Number(text));
}

function parseTXT(content) {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  let importedCount = 0;

  lines.forEach((line, index) => {
    if (index === 0 && isTXTHeader(line)) {
      return;
    }

    const parts = line.split("|").map((part) => part.trim());
    const record = normalizeImportRecord({
      nickname: parts[0],
      checks: parts[1],
      date: parts[3]
    });

    if (record) {
      upsertImportedModerator(record);
      importedCount += 1;
    }
  });

  return importedCount;
}

function isTXTHeader(line) {
  const normalizedLine = line.toLowerCase();

  return (
    normalizedLine.includes("|") &&
    (normalizedLine.includes("ник") || normalizedLine.includes("nickname")) &&
    (normalizedLine.includes("провер") || normalizedLine.includes("checks"))
  );
}

function parseCSV(content) {
  if (typeof Papa === "undefined") {
    throw new Error("PapaParse is unavailable");
  }

  const parsed = Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    transformHeader(header) {
      return header.trim();
    }
  });
  let importedCount = 0;

  parsed.data.forEach((row) => {
    const record = normalizeImportRecord(row);

    if (record) {
      upsertImportedModerator(record);
      importedCount += 1;
    }
  });

  return importedCount;
}

function showToast(message, type = "info") {
  const iconByType = {
    success: "check-circle-2",
    error: "x-circle",
    warning: "alert-triangle",
    info: "info"
  };
  const toast = document.createElement("div");

  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <i data-lucide="${iconByType[type] || iconByType.info}"></i>
    <p>${escapeHTML(message)}</p>
  `;
  elements.toastContainer.appendChild(toast);
  refreshIcons();

  window.setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateY(8px)";
    window.setTimeout(() => toast.remove(), 180);
  }, 2600);
}

function showConfirmModal({ title, message, confirmText = "Подтвердить", icon = "shield-alert" }) {
  if (confirmResolver) {
    closeConfirmModal(false);
  }

  lastFocusedElement = document.activeElement;
  elements.confirmTitle.textContent = title;
  elements.confirmMessage.textContent = message;
  elements.confirmAcceptButton.innerHTML = `<i data-lucide="trash-2"></i>${escapeHTML(confirmText)}`;
  elements.confirmIcon.innerHTML = `<i data-lucide="${icon}"></i>`;
  elements.confirmModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  refreshIcons();
  elements.confirmAcceptButton.focus();

  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function closeConfirmModal(result = false) {
  if (!confirmResolver) {
    return;
  }

  const resolve = confirmResolver;

  confirmResolver = null;
  elements.confirmModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
  resolve(result);

  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus();
  }

  lastFocusedElement = null;
}

function renderAll() {
  renderStats();
  renderTable();
  renderChart();
  renderPodium();
}

function renderPodium() {
  const topModerators = getTopModerators(3);

  elements.podiumList.innerHTML = topModerators
    .map(
      (moderator, index) => `
        <div class="podium-item">
          <span class="rank-badge rank-${index + 1}">#${index + 1}</span>
          <strong title="${escapeHTML(moderator.nickname)}">${escapeHTML(moderator.nickname)}</strong>
          <span>${formatNumber(moderator.coins)}</span>
        </div>
      `
    )
    .join("");
}

function resetForm() {
  currentResult = null;
  editingId = null;
  elements.calculatorForm.reset();
  elements.resultCard.classList.add("hidden");
}

function getTopModerators(limit) {
  return [...moderators]
    .sort((first, second) => {
      if (second.coins !== first.coins) {
        return second.coins - first.coins;
      }

      if (second.checks !== first.checks) {
        return second.checks - first.checks;
      }

      return first.nickname.localeCompare(second.nickname, "ru", {
        sensitivity: "base",
        numeric: true
      });
    })
    .slice(0, limit);
}

function getRankMap() {
  const rankMap = new Map();

  getTopModerators(moderators.length).forEach((moderator, index) => {
    rankMap.set(moderator.id, index + 1);
  });

  return rankMap;
}

function getFilteredModerators() {
  const query = elements.searchInput.value.trim().toLowerCase();
  const sortMode = elements.sortSelect.value;
  const filtered = moderators.filter((moderator) => moderator.nickname.toLowerCase().includes(query));

  return filtered.sort((first, second) => {
    switch (sortMode) {
      case "coins-asc":
        return first.coins - second.coins;
      case "checks-desc":
        return second.checks - first.checks;
      case "checks-asc":
        return first.checks - second.checks;
      case "nickname-asc":
        return first.nickname.localeCompare(second.nickname, "ru", {
          sensitivity: "base",
          numeric: true
        });
      case "nickname-desc":
        return second.nickname.localeCompare(first.nickname, "ru", {
          sensitivity: "base",
          numeric: true
        });
      case "date-desc":
        return parseDateValue(second.date) - parseDateValue(first.date);
      case "date-asc":
        return parseDateValue(first.date) - parseDateValue(second.date);
      case "coins-desc":
      default:
        return second.coins - first.coins;
    }
  });
}

function normalizeStoredModerator(moderator) {
  const record = normalizeImportRecord(moderator);

  if (!record) {
    return null;
  }

  return {
    id: typeof moderator.id === "string" && moderator.id ? moderator.id : generateId(),
    ...record
  };
}

function normalizeImportRecord(source) {
  const nickname = String(getImportField(source, ["nickname", "nick", "ник", "модератор"]) || "").trim();
  const rawChecks = String(getImportField(source, ["checks", "проверки", "количествопроверок"]) || "")
    .replace(/\s/g, "")
    .replace(",", ".");
  const checks = Number(rawChecks);
  const date = String(getImportField(source, ["date", "дата"]) || "").trim() || getCurrentDate();

  if (!nickname || !Number.isFinite(checks) || checks < 0 || !Number.isInteger(checks)) {
    return null;
  }

  return {
    nickname,
    checks,
    coins: calculateCoins(checks),
    date
  };
}

function getImportField(source, names) {
  if (!source || typeof source !== "object") {
    return "";
  }

  const normalizedNames = names.map(normalizeImportKey);

  for (const [key, value] of Object.entries(source)) {
    if (normalizedNames.includes(normalizeImportKey(key))) {
      return value;
    }
  }

  return "";
}

function normalizeImportKey(value) {
  return String(value).replace(/\uFEFF/g, "").toLowerCase().replace(/[\s_\-]/g, "");
}

function upsertImportedModerator(record) {
  const existingIndex = findModeratorIndexByNickname(record.nickname);

  if (existingIndex >= 0) {
    moderators[existingIndex] = {
      ...moderators[existingIndex],
      ...record
    };
    return;
  }

  moderators.push({
    id: generateId(),
    ...record
  });
}

function findModeratorIndexByNickname(nickname, excludedId = null) {
  const normalizedNickname = nickname.toLowerCase();

  return moderators.findIndex(
    (moderator) => moderator.id !== excludedId && moderator.nickname.toLowerCase() === normalizedNickname
  );
}

function parseDateValue(value) {
  const text = String(value);
  const match = text.match(/^(\d{2})\.(\d{2})\.(\d{4})\s+(\d{2}):(\d{2})$/);

  if (match) {
    const [, day, month, year, hours, minutes] = match.map(Number);

    return new Date(year, month - 1, day, hours, minutes).getTime();
  }

  return Number.isNaN(Date.parse(text)) ? 0 : Date.parse(text);
}

function escapeHTML(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeCSV(value) {
  const text = String(value).replace(/"/g, '""');

  return /[",\r\n]/.test(text) ? `"${text}"` : text;
}

function downloadBlob(blob, fileName) {
  if (typeof saveAs === "function") {
    saveAs(blob, fileName);
    return;
  }

  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function refreshIcons() {
  if (window.lucide && typeof window.lucide.createIcons === "function") {
    window.lucide.createIcons();
  }
}

function handleExternalLibraryReady() {
  renderChart();
  refreshIcons();
}

function scheduleLibraryRefresh() {
  let attempts = 0;
  const refreshTimer = window.setInterval(() => {
    attempts += 1;
    handleExternalLibraryReady();

    if ((window.Chart && window.lucide) || attempts >= 20) {
      window.clearInterval(refreshTimer);
    }
  }, 250);
}

window.handleExternalLibraryReady = handleExternalLibraryReady;

elements.calculatorForm.addEventListener("submit", (event) => {
  event.preventDefault();
  calculateAndShowResult();
});

elements.saveResultButton.addEventListener("click", saveModerator);
elements.resetFormButton.addEventListener("click", resetForm);
elements.searchInput.addEventListener("input", renderTable);
elements.sortSelect.addEventListener("change", renderTable);
elements.clearDatabaseButton.addEventListener("click", clearDatabase);
elements.exportTxtButton.addEventListener("click", exportTXT);
elements.exportCsvButton.addEventListener("click", exportCSV);
elements.importTxtButton.addEventListener("click", () => elements.txtFileInput.click());
elements.importCsvButton.addEventListener("click", () => elements.csvFileInput.click());
elements.bulkParseButton.addEventListener("click", () => calculateBulkPaste());
elements.bulkSaveButton.addEventListener("click", saveBulkPreview);
elements.bulkClearButton.addEventListener("click", clearBulkPaste);
elements.confirmAcceptButton.addEventListener("click", () => closeConfirmModal(true));
elements.confirmCancelButton.addEventListener("click", () => closeConfirmModal(false));
elements.confirmCloseButton.addEventListener("click", () => closeConfirmModal(false));

elements.confirmModal.addEventListener("click", (event) => {
  if (event.target === elements.confirmModal) {
    closeConfirmModal(false);
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !elements.confirmModal.classList.contains("hidden")) {
    closeConfirmModal(false);
  }
});

elements.bulkPasteInput.addEventListener("paste", () => {
  window.setTimeout(() => calculateBulkPaste({ silent: true }), 0);
});

elements.bulkPasteInput.addEventListener("input", () => {
  if (elements.bulkPasteInput.value.trim() === "") {
    clearBulkPaste();
  }
});

elements.txtFileInput.addEventListener("change", (event) => {
  importFile(event.target.files[0]);
  event.target.value = "";
});

elements.csvFileInput.addEventListener("change", (event) => {
  importFile(event.target.files[0]);
  event.target.value = "";
});

elements.moderatorsTable.addEventListener("click", (event) => {
  const button = event.target.closest("button[data-action]");

  if (!button) {
    return;
  }

  const { action, id } = button.dataset;

  if (action === "edit") {
    editModerator(id);
  }

  if (action === "delete") {
    deleteModerator(id);
  }
});

loadFromStorage();
renderAll();
refreshIcons();
scheduleLibraryRefresh();
