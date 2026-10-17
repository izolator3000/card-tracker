// Логика игры «Джокер»
// Победа: игрок набирает >= 501 очко.
// Отрисовка: игроки — колонки, раунды — строки (история сохраняется).

(function (global) {
  "use strict";

  const TARGET_SCORE = 501;

  function pad(str, width) {
    str = String(str);
    if (str.length >= width) return str.slice(0, width);
    return str + " ".repeat(width - str.length);
  }

  function padLeft(str, width) {
    str = String(str);
    if (str.length >= width) return str.slice(0, width);
    return " ".repeat(width - str.length) + str;
  }

  function maxRounds(state) {
    // Самое длинное число раундов среди игроков
    let m = 0;
    state.players.forEach((p) => {
      if (p.scores.length > m) m = p.scores.length;
    });
    return m;
  }

  const GameRules_Joker = {
    id: "joker",
    title: "Джокер",

    getCommands() {
      return [
        "игрок Имя          — добавить игрока (2–6 человек)",
        "N X                — игроку N добавить X очков",
        "го                 — завершить раунд и начать новый",
        "сброс N            — сбросить очки игрока N в текущем раунде",
        "помощь             — показать команды игры",
      ].join("\n");
    },

    getRulesText() {
      return [
        "Победа: >= " + TARGET_SCORE + " очков.",
        "Игроки: 2–6 человек.",
        "Каждый раунд — новая строка таблицы.",
      ].join("\n");
    },

    handleCommand(parts, state, showError) {
      const cmd = (parts[0] || "").toLowerCase();

      if (cmd === "игрок") {
        const name = parts.slice(1).join(" ").trim();
        if (!name) {
          showError("Укажите имя: игрок Имя");
          return true;
        }
        if (state.players.length >= 6) {
          showError("Максимум 6 игроков");
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
        state.players.push({ name, scores: [] });
        return true;
      }

      if (cmd === "го") {
        if (state.players.length < 2) {
          showError("Нужно минимум 2 игрока");
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
        const winners = state.players.filter(
          (p) => p.scores[idx] >= TARGET_SCORE
        );
        if (winners.length > 0) {
          state.winners = winners.map((p) => p.name);
          state.finished = true;
        } else {
          state.currentRoundIndex += 1;
        }
        return true;
      }

      if (cmd === "сброс") {
        const n = parseInt(parts[1], 10);
        if (!Number.isFinite(n) || n < 1 || n > state.players.length) {
          showError("Укажите номер игрока: сброс N");
          return true;
        }
        const player = state.players[n - 1];
        player.scores[state.currentRoundIndex] = 0;
        return true;
      }

      const n = parseInt(parts[0], 10);
      const x = parseInt(parts[1], 10);

      if (Number.isFinite(n) && Number.isFinite(x)) {
        if (n < 1 || n > state.players.length) {
          showError("Нет игрока с номером " + n);
          return true;
        }
        if (x < 0) {
          showError("Очки не могут быть отрицательными");
          return true;
        }
        if (state.finished) {
          showError("Игра завершена. Начните новую: игра 1");
          return true;
        }
        const player = state.players[n - 1];
        const current = player.scores[state.currentRoundIndex] || 0;
        player.scores[state.currentRoundIndex] = current + x;
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

      const numWidth = 4;     // колонка «Раунд»
      const cellWidth = 8;    // ширина колонки каждого игрока

      // --- Шапка: Раунд | Игрок1 | Игрок2 | ... ---
      let h = pad("Раунд", numWidth);
      state.players.forEach((p) => {
        h += pad(p.name, cellWidth);
      });
      header.push(h);

      // --- Разделитель ---
      let s = "-".repeat(numWidth + cellWidth * state.players.length);
      separator.push(s);

      // --- Строки раундов ---
      const total = maxRounds(state);
      const currentIdx = state.currentRoundIndex;

      for (let r = 0; r < total; r++) {
        let row = pad(r + 1, numWidth);
        state.players.forEach((p) => {
          const v = typeof p.scores[r] === "number" ? p.scores[r] : "—";
          row += pad(v, cellWidth);
        });
        if (r === currentIdx && !state.finished) {
          row += "← текущий";
        }
        rows.push(row);
      }

      // Если текущий раунд ещё пуст (нет ни одного хода), но игроки есть
      if (total === 0) {
        let row = pad(1, numWidth);
        state.players.forEach(() => {
          row += pad("—", cellWidth);
        });
        row += "← текущий";
        rows.push(row);
      }

      // --- Итоги ---
      let totals = pad("Σ", numWidth);
      state.players.forEach((p) => {
        const sum = p.scores.reduce((a, v) => a + (v || 0), 0);
        totals += pad(sum, cellWidth);
      });
      footer.push(totals);

      if (state.finished && state.winners && state.winners.length) {
        footer.push("🏆 Победитель(и): " + state.winners.join(", "));
      }

      return { header, separator, rows, footer };
    },
  };

  global.GameRules_Joker = GameRules_Joker;
})(window);