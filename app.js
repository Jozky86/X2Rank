const boards = [
  "预女猎白混",
  "机械狼通灵师",
  "梦魇守卫",
  "盗宝通灵",
  "石像鬼守墓人",
  "狼美骑士",
  "狼王射梦人",
  "血月猎魔人",
  "其他",
];
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
  "摄梦人",
  "石像鬼",
  "守墓人",
  "猎魔人",
  "血月使徒",
  "梦魇",
  "狼美人",
  "骑士",
  "其他",
];

const STORAGE_KEY = "x2rank.records.v1";

const state = {
  mode: "auto",
  extras: [],
  records: loadRecords(),
  selectedPlayer: "",
  sortKey: "totalScore",
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

function formatTime(timestamp) {
  return new Date(timestamp).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function currentUserName() {
  return el("loginName").value.trim() || el("playerName").value.trim() || "匿名玩家";
}

function setToday() {
  const today = new Date().toISOString().slice(0, 10);
  el("gameDate").value = today;
}

function roleScopeMatches(roleScope, role) {
  if (!roleScope) return true;
  return roleScope.split(",").map((item) => item.trim()).includes(role);
}

function updateSkillActions() {
  const role = el("role").value;
  document.querySelectorAll(".quick-actions button").forEach((button) => {
    button.classList.toggle("hidden", !roleScopeMatches(button.dataset.role, role));
  });
}

function pruneRoleExtras() {
  const role = el("role").value;
  const originalLength = state.extras.length;
  state.extras = state.extras.filter((item) => roleScopeMatches(item.roleScope, role));
  if (state.extras.length !== originalLength) {
    renderExtras();
  }
}

function renderExtras() {
  const chipList = el("chipList");
  chipList.innerHTML = "";
  state.extras.forEach((item, index) => {
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.innerHTML = `${escapeHtml(item.label)} ${item.delta > 0 ? "+" : ""}${item.delta}<button type="button" aria-label="删除 ${escapeHtml(item.label)}">×</button>`;
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

function getWinStreak(records) {
  const sorted = [...records].sort((a, b) => b.createdAt - a.createdAt);
  let streak = 0;
  for (const record of sorted) {
    if (!record.isWin) break;
    streak += 1;
  }
  return streak;
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

  const players = Array.from(byPlayer.values())
    .map((player) => ({
      ...player,
      winRate: player.games ? player.wins / player.games : 0,
      avgScore: player.games ? player.totalScore / player.games : 0,
      winStreak: getWinStreak(state.records.filter((record) => record.playerName === player.playerName)),
    }));

  return players.sort((a, b) => {
    const primary = b[state.sortKey] - a[state.sortKey];
    return primary || b.totalScore - a.totalScore || b.winRate - a.winRate || a.playerName.localeCompare(b.playerName);
  });
}

function renderSortButtons() {
  document.querySelectorAll(".sort-btn").forEach((button) => {
    const isActive = button.dataset.sort === state.sortKey;
    button.classList.toggle("active", isActive);
    button.querySelector("span").textContent = isActive ? "↓" : "";
  });
}

function renderLeaderboard() {
  const players = getLeaderboard();
  const body = el("leaderboardBody");
  body.innerHTML = "";
  renderSortButtons();

  if (!players.length) {
    body.innerHTML = `<tr><td colspan="7">还没有记录，先提交一局分数。</td></tr>`;
  } else {
    players.forEach((player, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span class="rank ${index === 0 ? "top" : ""}">${index + 1}</span></td>
        <td><button class="player-link" type="button">${escapeHtml(player.playerName)}</button></td>
        <td class="score">${formatScore(player.totalScore)}</td>
        <td>${Math.round(player.winRate * 100)}%</td>
        <td>${player.winStreak}</td>
        <td>${player.games}</td>
        <td>${formatScore(player.avgScore)}</td>
      `;
      row.querySelector(".player-link").addEventListener("click", () => {
        state.selectedPlayer = player.playerName;
        renderPlayerPanel();
        el("playerPanel").scrollIntoView({ behavior: "smooth", block: "start" });
      });
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

function renderComments(record, container) {
  const comments = record.comments || [];
  const body = container.querySelector(".comment-list");
  body.innerHTML = comments.length
    ? comments
        .map(
          (comment) => `
            <div class="comment">
              <div><strong>${escapeHtml(comment.author)}</strong><span>${formatTime(comment.createdAt)}</span></div>
              <p>${escapeHtml(comment.content)}</p>
            </div>
          `,
        )
        .join("")
    : `<div class="comment-empty">暂无评论</div>`;
}

function createRecordCard(record, options = {}) {
  const item = document.createElement("article");
  item.className = "record";
  item.innerHTML = `
    <div class="record-head">
      <div>
        <strong>${escapeHtml(record.playerName)}</strong>
        <div class="meta">${escapeHtml(record.gameDate)} 第 ${record.gameRound} 局 · ${escapeHtml(record.boardType)}</div>
      </div>
      ${options.canDelete ? `<button class="delete" type="button" aria-label="删除记录">×</button>` : ""}
    </div>
    <div class="score">${formatScore(record.score)} 分 · ${escapeHtml(record.role)} · ${record.camp === "good" ? "好人" : "狼人"} · ${record.isWin ? "胜利" : "失败"}</div>
    <div class="meta">${record.mode === "manual" ? "直接上传" : "按细则计算"}${record.extras.length ? ` · ${record.extras.map((x) => escapeHtml(x.label)).join("、")}` : ""}</div>
    ${record.notes ? `<div class="notes">${escapeHtml(record.notes)}</div>` : ""}
    <div class="comments">
      <div class="comment-list"></div>
      <form class="comment-form">
        <input name="comment" type="text" maxlength="160" placeholder="评论这局表现" required />
        <button type="submit">发送</button>
      </form>
    </div>
  `;

  if (options.canDelete) {
    item.querySelector(".delete").addEventListener("click", () => {
      state.records = state.records.filter((existing) => existing.id !== record.id);
      saveRecords();
      renderAll();
    });
  }

  item.querySelector(".comment-form").addEventListener("submit", (event) => {
    event.preventDefault();
    const input = event.currentTarget.elements.comment;
    const content = input.value.trim();
    if (!content) return;
    const target = state.records.find((existing) => existing.id === record.id);
    if (!target) return;
    target.comments = target.comments || [];
    target.comments.push({
      id: crypto.randomUUID(),
      author: currentUserName(),
      content,
      createdAt: Date.now(),
    });
    input.value = "";
    saveRecords();
    renderAll();
  });

  renderComments(record, item);
  return item;
}

function renderRecordCollection(list, records, options = {}) {
  list.innerHTML = "";

  if (!records.length) {
    list.innerHTML = `<div class="empty">${options.emptyText || "暂无提交记录"}</div>`;
    return;
  }

  [...records]
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, options.limit || records.length)
    .forEach((record) => {
      list.appendChild(createRecordCard(record, options));
    });
}

function renderRecords() {
  renderRecordCollection(el("recordList"), state.records, {
    canDelete: true,
    limit: 12,
    emptyText: "暂无提交记录",
  });
}

function renderPlayerPanel() {
  const panel = el("playerPanel");
  if (!state.selectedPlayer) {
    panel.classList.add("hidden");
    return;
  }

  const records = state.records.filter((record) => record.playerName === state.selectedPlayer);
  if (!records.length) {
    state.selectedPlayer = "";
    panel.classList.add("hidden");
    return;
  }

  const totalScore = records.reduce((sum, record) => sum + record.score, 0);
  const wins = records.filter((record) => record.isWin).length;
  const best = records.reduce((max, record) => Math.max(max, record.score), records[0].score);
  const winStreak = getWinStreak(records);
  el("playerTitle").textContent = `${state.selectedPlayer} 的战绩`;
  el("playerSummary").innerHTML = `
    <div><span>${formatScore(totalScore)}</span><small>总分</small></div>
    <div><span>${Math.round((wins / records.length) * 100)}%</span><small>胜率</small></div>
    <div><span>${winStreak}</span><small>当前连胜</small></div>
    <div><span>${records.length}</span><small>局数</small></div>
    <div><span>${formatScore(totalScore / records.length)}</span><small>均分</small></div>
    <div><span>${formatScore(best)}</span><small>单局最高</small></div>
  `;
  renderRecordCollection(el("playerRecordList"), records, {
    canDelete: false,
    emptyText: "这个玩家还没有战绩",
  });
  panel.classList.remove("hidden");
}

function renderAll() {
  renderLeaderboard();
  renderRecords();
  renderPlayerPanel();
}

function resetForm() {
  form.reset();
  state.extras = [];
  setToday();
  updateSkillActions();
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

  document.querySelectorAll(".sort-btn").forEach((button) => {
    button.addEventListener("click", () => {
      state.sortKey = button.dataset.sort;
      renderLeaderboard();
    });
  });

  document.querySelectorAll("#autoPanel input, #camp").forEach((input) => {
    input.addEventListener("input", updateLiveScore);
    input.addEventListener("change", updateLiveScore);
  });

  el("role").addEventListener("change", () => {
    updateSkillActions();
    pruneRoleExtras();
    updateLiveScore();
  });

  document.querySelectorAll(".quick-actions button").forEach((button) => {
    button.addEventListener("click", () => {
      state.extras.push({
        label: button.dataset.label,
        delta: Number(button.dataset.delta),
        roleScope: button.dataset.role || "",
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
  el("closePlayer").addEventListener("click", () => {
    state.selectedPlayer = "";
    renderPlayerPanel();
  });

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
      comments: [],
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
  updateSkillActions();
  updateLiveScore();
  renderAll();
}

init();
