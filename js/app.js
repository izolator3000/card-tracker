// Ядро приложения: выбор игры, маршрутизация команд, рендер.
// Не содержит логики правил конкретных игр.
// Игры: №0 для простого счёта; МореСольБумага, 7ред, Кинга, ЯпонскийДурак

(function () {
  "use strict";

  // ---- Доступные игры (описания берутся из модулей) ----
  const GAMES = [
    { id: "plain",    title: "Обычный счёт",     module: window.GameRules_Plain },
    { id: "seasalt",  title: "Море Соль Бумага",   module: window.GameRules_SeaSalt },
    { id: "joker",    title: "Джокер",           module: window.GameRules_Joker },
    { id: "sevenred", title: "7 red",             module: window.GameRules_SevenRed },
    { id: "thousand", title: "Тысяча",           module: window.GameRules_Thousand },
    { id: "king",     title: "Кинга",            module: window.GameRules_King || null },
    { id: "pref",     title: "Преферанс",        module: window.GameRules_Pref || null },
  ];

  // ---- Глобальное состояние ----
  const state = {
    selectedGameId: null,
    players: [],
    rounds: [],
    currentRoundIndex: 0,
    dealerIndex: null,
    winners: null,
    finished: false,
  };

  // ---- DOM ----
  const screenEl = document.getElementById("screen");
  const cmdEl = document.getElementById("cmd");
  const cmdHelpEl = document.getElementById("commands-help");
  const rulesHelpEl = document.getElementById("rules-help");

  // ---- Утилиты ----
  function padEnd(str, width) {
    str = String(str);
    return str.length >= width ? str : str + " ".repeat(width - str.length);
  }

  function showError(message) {
    state.lastError = "[ОШИБКА] " + message;
  }

  function clearError() {
    state.lastError = null;
  }

  function currentGame() {
    return GAMES.find((g) => g.id === state.selectedGameId) || null;
  }

  function resetGameState() {
    state.players = [];
    state.rounds = [];
    state.currentRoundIndex = 0;
    state.dealerIndex = null;
    state.winners = null;
    state.finished = false;
    state.lastError = null;
  }

  // ---- Рендер ----
  function render() {
    const lines = [];

    if (!state.selectedGameId) {
      lines.push("Выберите игру командой: игра N");
      lines.push("");
      GAMES.forEach((g, i) => {
        const available = g.module ? "" : "  (модуль не подключён)";
        lines.push("  " + (i + 1) + ". " + g.title + available);
      });
      screenEl.textContent = lines.join("\n");
      cmdHelpEl.textContent = "игра N — выбрать игру\nпомощь — список игр";
      rulesHelpEl.textContent = "Выберите игру, чтобы увидеть правила.";
      return;
    }

    const game = currentGame();
    if (!game || !game.module) {
      lines.push("[ОШИБКА] Модуль игры не подключён.");
      screenEl.textContent = lines.join("\n");
      return;
    }

    lines.push("Игра: " + game.title);
    lines.push("");

    const data = game.module.renderTable(state);
    if (data.header && data.header.length) lines.push(...data.header);
    if (data.separator && data.separator.length) lines.push(...data.separator);
    if (data.rows && data.rows.length) lines.push(...data.rows);
    if (data.footer && data.footer.length) {
      lines.push("");
      lines.push(...data.footer);
    }

    // Текущий раунд
    if (!state.finished) {
      lines.push("");
      lines.push("Раунд " + (state.currentRoundIndex + 1) + " ← текущий");
    }

    if (state.lastError) {
      lines.push("");
      lines.push(state.lastError);
    }

    screenEl.textContent = lines.join("\n");

    // Подсказки
    if (typeof game.module.getCommands === "function") {
      cmdHelpEl.textContent = game.module.getCommands();
    }
    if (typeof game.module.getRulesText === "function") {
      rulesHelpEl.textContent = game.module.getRulesText();
    }
    screenEl.scrollTop = screenEl.scrollHeight;
  }

  // ---- Маршрутизация команд ----
  function handleInput(raw) {
    const text = String(raw || "").trim();
    if (!text) return;

    const parts = text.split(/\s+/);
    const cmd = parts[0].toLowerCase();

    clearError();

    // Общие команды ядра
    if (cmd === "игра") {
      const n = parseInt(parts[1], 10);
      if (!Number.isFinite(n) || n < 1 || n > GAMES.length) {
        showError("Укажите номер игры от 1 до " + GAMES.length);
        render();
        return;
      }
      const game = GAMES[n - 1];
      if (!game.module) {
        showError("Модуль игры «" + game.title + "» не подключён");
        render();
        return;
      }
      state.selectedGameId = game.id;
      resetGameState();
      render();
      return;
    }

    if (cmd === "помощь") {
      if (!state.selectedGameId) {
        showError("Сначала выберите игру: игра N");
      } else {
        const game = currentGame();
        if (game && game.module && typeof game.module.getCommands === "function") {
          cmdHelpEl.textContent = game.module.getCommands();
        }
      }
      render();
      return;
    }

    if (cmd === "сброс-игры") {
      resetGameState();
      render();
      return;
    }

    // Если игра не выбрана — только общие команды
    if (!state.selectedGameId) {
      showError("Сначала выберите игру: игра N");
      render();
      return;
    }

    const game = currentGame();
    if (!game || !game.module) {
      showError("Модуль игры не подключён");
      render();
      return;
    }

    // Всё остальное — в модуль игры
    const needsRender = game.module.handleCommand(parts, state, showError);
    if (needsRender) render();
  }

  // ---- Защита от случайного обновления (свайп вниз на телефоне) ----
  let dirty = false;          // есть ли данные, которые жалко потерять
  let bypassUnload = false;   // флаг «пользователь уже подтвердил уход»

  function markDirty() {
    dirty = true;
  }

  function isDirty() {
    // «Грязно», если выбрана игра или уже есть игроки
    return dirty || state.selectedGameId !== null || state.players.length > 0;
  }

  window.addEventListener("beforeunload", (e) => {
    if (bypassUnload) return;
    if (!isDirty()) return;
    // Стандартное окно подтверждения браузера
    e.preventDefault();
    // Для старых браузеров
    e.returnValue = "";
    return "";
  });

  // ---- Инициализация ----
  function init() {
    cmdEl.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        const value = cmdEl.value;
        cmdEl.value = "";
        handleInput(value);
        markDirty();
      }
    });
    render();
    cmdEl.focus();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();