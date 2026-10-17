// Логика игры «Море Соль Бумага»
// 2–4 игрока. Порог победы зависит от числа игроков: 2→40, 3→35, 4→30.
// «го» требует, чтобы хотя бы у одного игрока в раунде было >= 7 очков.
// Отрисовка: игроки — колонки, раунды — строки. Маркер — любой.
// Звёздочка «*» — у раздающего, переезжает к следующему при «го».

(function (global) {
  "use strict";

  const MIN_PLAYERS = 2;
  const MAX_PLAYERS = 4;
  const MIN_ROUND_LEADER = 7; // хотя бы у одного игрока в раунде >= 7

  // Порог победы по числу игроков
  const WIN_THRESHOLDS = {
    2: 40,
    3: 35,
    4: 30,
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

  const GameRules_SeaSalt = {
    id: "seasalt",
    title: "Море Соль Бумага",

    getCommands() {
      return [
        "игрок Имя          — добавить игрока (2–4)",
        "N X                — игроку N записать X очков",
        "N X <маркер>       — то же + маркер справа от числа",
        "го                 — завершить раунд (хотя бы у одного >= 7)",
        "помощь             — показать команды игры",
      ].join("\n");
    },

    getRulesText() {
      return [
        "Игроки: 2–4.",
        "Победа: 2 игрока → 40, 3 → 35, 4 → 30 очков.",
        "В раунде хотя бы у одного игрока должно быть >= " +
          MIN_ROUND_LEADER + " очков.",
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
          showError("Максимум " + MAX_PLAYERS + " игрока");
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
        const allHaveScores = state.players.every(
          (p) => typeof p.scores[idx] === "number"
        );
        if (!allHaveScores) {
          showError("Не все игроки получили очки в текущем раунде");
          return true;
        }

        // Проверка: хотя бы у одного >= 7 за раунд
        const maxInRound = state.players.reduce(
          (m, p) => Math.max(m, p.scores[idx] || 0),
          -Infinity
        );
        if (maxInRound < MIN_ROUND_LEADER) {
          showError(
            "В раунде нужен хотя бы один игрок с " +
            MIN_ROUND_LEADER + "+ очками (максимум сейчас: " + maxInRound + ")"
          );
          return true;
        }

        // Проверка победы: суммарные очки
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

        // Маркер — любые символы без проверки
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

      // Подсказка о пороге победы для текущего числа игроков
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

  global.GameRules_SeaSalt = GameRules_SeaSalt;
})(window);