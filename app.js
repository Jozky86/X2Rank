const boards = ["预女猎白混", "机械狼通灵师", "梦魇守卫", "盗宝通灵", "其他"];
const roles = [
  "平民",
  "小狼",
  "大狼",
  "狼枪",
  "机械狼",
  "预言家",
  "女巫",
  "猎人",
  "守卫",
  "白痴",
  "射梦人",
  "其他",
];

const STORAGE_KEY = "x2rank.records.v1";

const state = {
  mode: "auto",
  extras: [],
  records: loadRecords(),
};

const el = (id) => document.getElementById(id);
const form = el("scoreForm");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function loadRecords() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function fillOptions(select, values) {
  select.innerHTML = values.map((value) => `<option value="${value}">${value}</option>`).join("");
}

function numberValue(id) {
  return Number(el(id).value || 0);
}

function getCamp() {
  return el("camp").value;
}

function getVoteScore() {
  if (getCamp() !== "good") return 0;
  const diff = Math.abs(numberValue("correctVotes") - numberValue("wrongVotes"));
  const capped = el("isWin").checked ? -Math.min(diff, 4) : Math.min(diff, 3);
  return capped + numberValue("noVoteBonus");
}

function getLifeScore() {
  if (getCamp() === "wolf") return numberValue("killGood");
  return (
    numberValue("killGood") * -1 +
    numberValue("voteGoodAlive") * -0.5 +
    numberValue("killWolf") +
    numberValue("voteWolfAlive") * 0.5
  );
}

function getAutoScore() {
  const winScore = el("isWin").checked ? 5 : 0;
  const extraScore = state.extras.reduce((sum, item) => sum + item.delta, 0);
  return winScore + getVoteScore() + getLifeScore() + extraScore;
}

function currentScore() {
  return state.mode === "manual" ? numberValue("manualScore") : getAutoScore();
}

function formatScore(score) {
  return Number(score).toFixed(1);
}

function setToday() {
  const today = new Date().toISOString().slice(0, 10);
  el("gameDate").value = today;
}

function renderExtras() {
  const chipList = el("chipList");
  chipList.innerHTML = "";
  state.extras.forEach((item, index) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${item.label} ${item.delta > 0 ? "+" : ""}${item.delta}<button type="button" aria-label="删除 ${item.label}">×</button>`;
    chip.querySelector("button").addEventListener("click", () => {
      state.extras.splice(index, 1);
      renderExtras();
      updateLiveScore();
    });
    chipList.appendChild(chip);
  });
}

function updateLiveScore() {
  el("liveScore").textContent = `${formatScore(getAutoScore())} 分`;
}

function getLeaderboard() {
  const byPlayer = new Map();
  state.records.forEach((record) => {
    const current = byPlayer.get(record.playerName) || {
      playerName: record.playerName,
      totalScore: 0,
      wins: 0,
      games: 0,
    };
    current.totalScore += record.score;
    current.wins += record.isWin ? 1 : 0;
    current.games += 1;
    byPlayer.set(record.playerName, current);
  });

  return Array.from(byPlayer.values())
    .map((player) => ({
      ...player,
      winRate: player.games ? player.wins / player.games : 0,
      avgScore: player.games ? player.totalScore / player.games : 0,
    }))
    .sort((a, b) => b.totalScore - a.totalScore || b.winRate - a.winRate || a.playerName.localeCompare(b.playerName));
}

function renderLeaderboard() {
  const players = getLeaderboard();
  const body = el("leaderboardBody");
  body.innerHTML = "";

  if (!players.length) {
    body.innerHTML = `<tr><td colspan="6">还没有记录，先提交一局分数。</td></tr>`;
  } else {
    players.forEach((player, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span class="rank ${index === 0 ? "top" : ""}">${index + 1}</span></td>
        <td>${escapeHtml(player.playerName)}</td>
        <td class="score">${formatScore(player.totalScore)}</td>
        <td>${Math.round(player.winRate * 100)}%</td>
        <td>${player.games}</td>
        <td>${formatScore(player.avgScore)}</td>
      `;
      body.appendChild(row);
    });
  }

  el("totalPlayers").textContent = players.length;
  el("totalGames").textContent = state.records.length;
  el("avgScore").textContent = state.records.length
    ? formatScore(state.records.reduce((sum, item) => sum + item.score, 0) / state.records.length)
    : "0.0";
  el("topPlayer").textContent = players[0]?.playerName || "暂无";
}

function renderRecords() {
  const list = el("recordList");
  list.innerHTML = "";

  if (!state.records.length) {
    list.innerHTML = `<div class="empty">暂无提交记录</div>`;
    return;
  }

  [...state.records]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 12)
    .forEach((record) => {
      const item = document.createElement("article");
      item.className = "record";
      item.innerHTML = `
        <div class="record-head">
          <div>
            <strong>${escapeHtml(record.playerName)}</strong>
            <div class="meta">${escapeHtml(record.gameDate)} 第 ${record.gameRound} 局 · ${escapeHtml(record.boardType)}</div>
          </div>
          <button class="delete" type="button" aria-label="删除记录">×</button>
        </div>
        <div class="score">${formatScore(record.score)} 分 · ${escapeHtml(record.role)} · ${record.camp === "good" ? "好人" : "狼人"} · ${record.isWin ? "胜利" : "失败"}</div>
        <div class="meta">${record.mode === "manual" ? "直接上传" : "按细则计算"}${record.extras.length ? ` · ${record.extras.map((x) => escapeHtml(x.label)).join("、")}` : ""}</div>
        ${record.notes ? `<div class="notes">${escapeHtml(record.notes)}</div>` : ""}
      `;
      item.querySelector(".delete").addEventListener("click", () => {
        state.records = state.records.filter((existing) => existing.id !== record.id);
        saveRecords();
        renderAll();
      });
      list.appendChild(item);
    });
}

function renderAll() {
  renderLeaderboard();
  renderRecords();
}

function resetForm() {
  form.reset();
  state.extras = [];
  setToday();
  renderExtras();
  updateLiveScore();
}

function switchMode(mode) {
  state.mode = mode;
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.mode === mode);
  });
  el("autoPanel").classList.toggle("hidden", mode !== "auto");
  el("manualPanel").classList.toggle("hidden", mode !== "manual");
}

function bindEvents() {
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.addEventListener("click", () => switchMode(tab.dataset.mode));
  });

  document.querySelectorAll("#autoPanel input, #camp").forEach((input) => {
    input.addEventListener("input", updateLiveScore);
    input.addEventListener("change", updateLiveScore);
  });

  document.querySelectorAll(".quick-actions button").forEach((button) => {
    button.addEventListener("click", () => {
      state.extras.push({
        label: button.dataset.label,
        delta: Number(button.dataset.delta),
      });
      renderExtras();
      updateLiveScore();
    });
  });

  el("loginBtn").addEventListener("click", () => {
    const name = el("loginName").value.trim();
    if (name) el("playerName").value = name;
  });

  el("resetForm").addEventListener("click", resetForm);

  el("clearData").addEventListener("click", () => {
    if (!state.records.length) return;
    if (confirm("确定清空所有本地积分记录吗？")) {
      state.records = [];
      saveRecords();
      renderAll();
    }
  });

  el("exportData").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state.records, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `x2rank-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const record = {
      id: crypto.randomUUID(),
      playerName: el("playerName").value.trim(),
      gameDate: el("gameDate").value,
      gameRound: numberValue("gameRound"),
      boardType: el("boardType").value,
      role: el("role").value,
      camp: getCamp(),
      isWin: el("isWin").checked,
      score: currentScore(),
      mode: state.mode,
      extras: [...state.extras],
      notes: el("notes").value.trim(),
      createdAt: Date.now(),
    };
    state.records.push(record);
    saveRecords();
    renderAll();
    resetForm();
    el("playerName").value = record.playerName;
  });
}

function init() {
  fillOptions(el("boardType"), boards);
  fillOptions(el("role"), roles);
  setToday();
  bindEvents();
  updateLiveScore();
  renderAll();
}

init();
