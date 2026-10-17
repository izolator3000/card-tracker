// Логика игры «7 red»
// 2–7 игроков. Порог победы зависит от числа игроков:
// 2→40, 3→35, 4→30, 5→25, 6→20, 7→15.
// Других проверок нет: любые очки, любой маркер без валидации.
// Отрисовка: игроки — колонки, раунды — строки.
// Звёздочка «*» — у раздающего, переезжает к следующему при «го».

(function (global) {
  "use strict";

  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 7;

  // Порог победы по числу игроков
  const WIN_THRESHOLDS = {
    2: 40,
    3: 35,
    4: 30,
    5: 25,
    6: 20,
    7: 15,
  };

  function pad(str, width) {
    str = String(str);
    if (str.length >= width) return str.slice(0, width);
    return str + " ".repeat(width - str.length);
  }

  function padKeep(str, width) {
    str = String(str);
    return str.length >= width ? str + " " : str + " ".repeat(width - str.length);
  }

  function maxRounds(state) {
    let m = 0;
    state.players.forEach((p) => {
      if (p.scores.length > m) m = p.scores.length;
    });
    return m;
  }

  function winThreshold(playersCount) {
    return WIN_THRESHOLDS[playersCount] || null;
  }

  const GameRules_SevenRed = {
    id: "sevenred",
    title: "7 red",

    getCommands() {
      return [
        "игрок Имя          — добавить игрока (2–7)",
        "N X                — игроку N записать X очков",
        "N X <маркер>       — то же + маркер справа от числа",
        "го                 — завершить раунд и начать новый",
        "помощь             — показать команды игры",
      ].join("\n");
    },

    getRulesText() {
      return [
        "Игроки: 2–7.",
        "Победа: 2→40, 3→35, 4→30, 5→25, 6→20, 7→15 очков.",
        "Других правил нет.",
        "Маркер — любая буква или слово без валидации.",
        "* у имени — раздающий (переезжает по кругу).",
      ].join("\n");
    },

    handleCommand(parts, state, showError) {
      const cmd = (parts[0] || "").toLowerCase();

      // --- Добавление игроков ---
      if (cmd === "игрок") {
        const name = parts.slice(1).join(" ").trim();
        if (!name) {
          showError("Укажите имя: игрок Имя");
          return true;
        }
        if (state.players.length >= MAX_PLAYERS) {
          showError("Максимум " + MAX_PLAYERS + " игроков");
          return true;
        }
        if (state.players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
          showError("Игрок с таким именем уже есть");
          return true;
        }
        if (state.currentRoundIndex > 0 || state.players.some((p) => p.scores.length > 0)) {
          showError("Нельзя добавлять игроков после старта игры");
          return true;
        }
        state.players.push({
          name,
          scores: [],
          marks: [],
        });
        if (state.dealerIndex === null || state.dealerIndex === undefined) {
          state.dealerIndex = 0;
        }
        return true;
      }

      // --- Го ---
      if (cmd === "го") {
        if (state.players.length < MIN_PLAYERS || state.players.length > MAX_PLAYERS) {
          showError("Нужно от " + MIN_PLAYERS + " до " + MAX_PLAYERS + " игроков");
          return true;
        }
        const idx = state.currentRoundIndex;

        // Недостающие очки считаем нулём — как в «Обычном счёте»
        state.players.forEach((p) => {
          if (typeof p.scores[idx] !== "number") p.scores[idx] = 0;
        });

        // Проверка победы по сумме
        const threshold = winThreshold(state.players.length);
        const winners = state.players.filter((p) => {
          const total = p.scores.reduce((a, v) => a + (v || 0), 0);
          return threshold !== null && total >= threshold;
        });
        if (winners.length > 0) {
          state.winners = winners.map((p) => p.name);
          state.finished = true;
        } else {
          state.currentRoundIndex += 1;
          if (state.dealerIndex !== null && state.dealerIndex !== undefined) {
            state.dealerIndex = (state.dealerIndex + 1) % state.players.length;
          }
        }
        return true;
      }

      // --- Ввод очков: "N X" или "N X <маркер>" ---
      const n = parseInt(parts[0], 10);
      const x = parseInt(parts[1], 10);
      if (Number.isFinite(n) && Number.isFinite(x)) {
        if (n < 1 || n > state.players.length) {
          showError("Нет игрока с номером " + n);
          return true;
        }
        if (state.finished) {
          showError("Игра завершена. Начните новую: игра N");
          return true;
        }

        let mark = "";
        if (parts[2] !== undefined) {
          mark = String(parts[2]);
        }

        const player = state.players[n - 1];
        const idx = state.currentRoundIndex;
        player.scores[idx] = x;
        if (mark) player.marks[idx] = mark;
        return true;
      }

      showError("Неизвестная команда. Введите «помощь».");
      return true;
    },

    renderTable(state) {
      const header = [];
      const separator = [];
      const rows = [];
      const footer = [];

      if (state.players.length === 0) {
        header.push("Игроки ещё не добавлены. Введите: игрок Имя");
        return { header, separator, rows, footer };
      }

      const numWidth = 6;
      const cellWidth = 12;

      let h = padKeep("Раунд", numWidth);
      state.players.forEach((p, i) => {
        const star = i === state.dealerIndex ? "* " : "  ";
        h += padKeep(star + p.name, cellWidth);
      });
      header.push(h);

      let s = "-".repeat(numWidth + cellWidth * state.players.length);
      separator.push(s);

      const total = maxRounds(state);
      const currentIdx = state.currentRoundIndex;

      for (let r = 0; r < total; r++) {
        let row = pad(r + 1, numWidth);
        state.players.forEach((p) => {
          const hasScore = typeof p.scores[r] === "number";
          const v = hasScore ? p.scores[r] : "—";
          const mark = p.marks[r] ? " " + p.marks[r] : "";
          const cell = hasScore ? v + mark : "—";
          row += padKeep(cell, cellWidth);
        });
        if (r === currentIdx && !state.finished) {
          row += "← текущий";
        }
        rows.push(row);
      }

      if (total === 0) {
        let row = pad(1, numWidth);
        state.players.forEach(() => {
          row += padKeep("—", cellWidth);
        });
        row += "← текущий";
        rows.push(row);
      }

      let totals = pad("Σ", numWidth);
      state.players.forEach((p) => {
        const sum = p.scores.reduce((a, v) => a + (v || 0), 0);
        totals += padKeep(sum, cellWidth);
      });
      footer.push(totals);

      const threshold = winThreshold(state.players.length);
      if (threshold !== null) {
        footer.push("Порог победы (" + state.players.length + " игрока): " + threshold);
      }

      if (state.finished && state.winners && state.winners.length) {
        footer.push("🏆 Победитель(и): " + state.winners.join(", "));
      }

      return { header, separator, rows, footer };
    },
  };

  global.GameRules_SevenRed = GameRules_SevenRed;
})(window);