// Логика игры «Тысяча»
// 3 или 4 игрока. Очки кратны 5. «го» — сумма раунда из ALLOWED_ROUND_TOTALS,
// НО если у кого-то очки < 0 — проверка суммы пропускается.
// Отрисовка: игроки — колонки, раунды — строки. Маркеры: Б, б, т, п, с.
// Звёздочка «*» — у раздающего, переезжает к следующему при «го».

(function (global) {
  "use strict";

  const MIN_PLAYERS = 3;
  const MAX_PLAYERS = 4;
  const ALLOWED_ROUND_TOTALS = [120, 160, 180, 200, 220, 320];
  const SCORE_STEP = 5;
  const TARGET_SCORE = 1000;

  // Б — бочка, б — болт, т — тёмная, п — прикуп, с — ставка
  const ALLOWED_MARKS = ["Б", "б", "т", "п", "с"];

  const MARKS_LEGEND = [
    "Б — бочка",
    "б — болт",
    "т — тёмная",
    "п — прикуп",
    "с — ставка",
  ];

  function pad(str, width) {
    str = String(str);
    if (str.length >= width) return str.slice(0, width);
    return str + " ".repeat(width - str.length);
  }

  function padKeep(str, width) {
    str = String(str);
    return str.length >= width ? str + " " : str + " ".repeat(width - str.length);
  }

  function isMultipleOf5(n) {
    return Number.isFinite(n) && n % SCORE_STEP === 0;
  }

  function maxRounds(state) {
    let m = 0;
    state.players.forEach((p) => {
      if (p.scores.length > m) m = p.scores.length;
    });
    return m;
  }

  const GameRules_Thousand = {
    id: "thousand",
    title: "Тысяча",

    getCommands() {
      return [
        "игрок Имя          — добавить игрока (ровно 3 или 4)",
        "N X                — игроку N добавить X очков (кратно 5)",
        "N X <буква>        — то же + маркер справа от числа",
        "  Б — бочка, б — болт, т — тёмная, п — прикуп, с — ставка",
        "го                 — завершить раунд",
      ].join("\n");
    },

    getRulesText() {
      return [
        "Игроки: ровно 3 или 4.",
        "Очки кратны " + SCORE_STEP + " (могут быть отрицательными).",
        "Маркеры: " + MARKS_LEGEND.join(", ") + ".",
        "Сумма раунда для «го»: " + ALLOWED_ROUND_TOTALS.join(", ") +
          " (пропускается, если есть отрицательные очки).",
        "Победа: >= " + TARGET_SCORE + " очков.",
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
          showError("Нужно ровно " + MIN_PLAYERS + " или " + MAX_PLAYERS + " игрока");
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

        const hasNegative = state.players.some((p) => (p.scores[idx] || 0) < 0);

        if (!hasNegative) {
          const roundTotal = state.players.reduce(
            (acc, p) => acc + (p.scores[idx] || 0),
            0
          );
          if (!ALLOWED_ROUND_TOTALS.includes(roundTotal)) {
            showError(
              "Сумма раунда " + roundTotal +
              " недопустима (разрешено: " + ALLOWED_ROUND_TOTALS.join(", ") + ")"
            );
            return true;
          }
        }

        const winners = state.players.filter((p) => {
          const total = p.scores.reduce((a, v) => a + (v || 0), 0);
          return total >= TARGET_SCORE;
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
        if (!isMultipleOf5(x)) {
          showError("Очки должны быть кратны " + SCORE_STEP);
          return true;
        }
        if (state.finished) {
          showError("Игра завершена. Начните новую: игра 2");
          return true;
        }

        let mark = "";
        if (parts[2] !== undefined) {
          // Маркеры регистрозависимы: «Б» и «б» — разные
          const raw = String(parts[2]);
          if (!ALLOWED_MARKS.includes(raw)) {
            showError(
              "Некорректный маркер: " + parts[2] +
              " (допустимо: Б — бочка, б — болт, т — тёмная, п — прикуп, с — ставка)"
            );
            return true;
          }
          mark = raw;
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

      if (state.finished && state.winners && state.winners.length) {
        footer.push("🏆 Победитель(и): " + state.winners.join(", "));
      }

      return { header, separator, rows, footer };
    },
  };

  global.GameRules_Thousand = GameRules_Thousand;
})(window);