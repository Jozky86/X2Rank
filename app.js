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
  "盗宝大师",
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
  "蒙面人",
  "其他",
];

const subRoleOptions = {
  盗宝大师: ["毒师", "摄梦人", "猎人", "蒙面人", "通灵师"],
  机械狼: ["守卫", "通灵师", "双刀狼", "平民", "女巫", "猎人"],
};

const wolfRoles = ["小狼", "大狼", "狼枪", "机械狼", "盗宝大师", "石像鬼", "血月使徒", "狼美人"];

const seasons = ["S2"];
const CURRENT_SEASON = "S2";
const users = [
  { username: "Jozky", password: "123123" },
  { username: "黑昕昕", password: "123123" },
  { username: "林一爱吃蛋挞", password: "123123" },
  { username: "小羊", password: "123123" },
  { username: "小外套", password: "123123" },
  { username: "不爱吃蛋挞边边", password: "123123" },
  { username: "smxp", password: "123123" },
  { username: "傅延年", password: "123123" },
  { username: "水泥猫", password: "123123" },
  { username: "木木", password: "123123" },
  { username: "S", password: "123123" },
  { username: "dx", password: "123123" },
  { username: "-  QUEEN", password: "123123" },
];
const STORAGE_KEY = "x2rank.records.v2";
const SESSION_KEY = "x2rank.currentUser.v1";
const PASSWORDS_KEY = "x2rank.passwordOverrides.v1";
const PROFILES_KEY = "x2rank.profiles.v1";
const DISCUSSIONS_KEY = "x2rank.discussions.v1";

const state = {
  mode: "auto",
  extras: [],
  records: loadRecords(),
  profiles: loadProfiles(),
  discussions: loadDiscussions(),
  passwordOverrides: loadPasswordOverrides(),
  serverAvailable: false,
  currentUser: localStorage.getItem(SESSION_KEY) || "",
  selectedPlayer: "",
  selectedSeason: CURRENT_SEASON,
  sortKey: "totalScore",
  leaderboardFullscreen: false,
  discussionExpanded: false,
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
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved) || [];
    return [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.records));
}

function loadProfiles() {
  try {
    return JSON.parse(localStorage.getItem(PROFILES_KEY)) || {};
  } catch {
    return {};
  }
}

function saveProfiles() {
  localStorage.setItem(PROFILES_KEY, JSON.stringify(state.profiles));
}

function loadDiscussions() {
  try {
    return JSON.parse(localStorage.getItem(DISCUSSIONS_KEY)) || [];
  } catch {
    return [];
  }
}

function saveDiscussions() {
  localStorage.setItem(DISCUSSIONS_KEY, JSON.stringify(state.discussions));
}

function loadPasswordOverrides() {
  try {
    return JSON.parse(localStorage.getItem(PASSWORDS_KEY)) || {};
  } catch {
    return {};
  }
}

function savePasswordOverrides() {
  localStorage.setItem(PASSWORDS_KEY, JSON.stringify(state.passwordOverrides));
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "服务器请求失败");
  return payload;
}

async function loadServerState() {
  if (window.location.protocol === "file:") return;
  try {
    const payload = await apiRequest("/api/state");
    state.records = payload.records || [];
    state.discussions = payload.discussions || [];
    state.profiles = {};
    (payload.users || []).forEach((user) => {
      state.profiles[user.username] = { avatar: user.avatar || "" };
    });
    state.serverAvailable = true;
    saveRecords();
    saveDiscussions();
    saveProfiles();
  } catch (error) {
    console.warn("Using local browser storage:", error.message);
  }
}

async function persistServer(path, options = {}) {
  if (!state.serverAvailable) return true;
  try {
    await apiRequest(path, options);
    return true;
  } catch (error) {
    alert(`服务器保存失败：${error.message}`);
    return false;
  }
}

function getUser(username) {
  return users.find((user) => user.username === username);
}

function getUserPassword(username) {
  return state.passwordOverrides[username] || getUser(username)?.password || "";
}

function getAvatar(username) {
  return state.profiles[username]?.avatar || "";
}

function avatarMarkup(username) {
  const avatar = getAvatar(username);
  return avatar
    ? `<img src="${escapeHtml(avatar)}" alt="${escapeHtml(username)} 的头像" />`
    : `<span>${escapeHtml(username.slice(0, 1).toUpperCase())}</span>`;
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

function formatBadgeVote(record) {
  if (typeof record.badgeVoteCorrect !== "boolean") return "警徽未录";
  return record.badgeVoteCorrect ? "警徽对" : "警徽错";
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
  return state.currentUser || "匿名玩家";
}

function setToday() {
  const today = new Date().toISOString().slice(0, 10);
  el("gameDate").value = today;
}

function scopeMatches(scope, value) {
  if (!scope) return true;
  return scope.split(",").map((item) => item.trim()).includes(value);
}

function actionMatchesCurrentRole(button) {
  return scopeMatches(button.dataset.role, el("role").value) && scopeMatches(button.dataset.subrole, el("subRole").value);
}

function extraMatchesCurrentRole(item) {
  return scopeMatches(item.roleScope, el("role").value) && scopeMatches(item.subRoleScope, el("subRole").value);
}

function updateSubRoleField() {
  const role = el("role").value;
  const options = subRoleOptions[role] || [];
  el("subRoleField").classList.toggle("hidden", !options.length);
  fillOptions(el("subRole"), options);
}

function syncCampWithRole() {
  el("camp").value = wolfRoles.includes(el("role").value) ? "wolf" : "good";
}

function roleScopeMatches(roleScope, role) {
  if (!roleScope) return true;
  return scopeMatches(roleScope, role);
}

function updateSkillActions() {
  document.querySelectorAll(".quick-actions button").forEach((button) => {
    button.classList.toggle("hidden", !actionMatchesCurrentRole(button));
  });
}

function pruneRoleExtras() {
  const originalLength = state.extras.length;
  state.extras = state.extras.filter((item) => extraMatchesCurrentRole(item));
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

function recordSeason(record) {
  return record.season || CURRENT_SEASON;
}

function getSeasonRecords() {
  return state.records.filter((record) => recordSeason(record) === state.selectedSeason);
}

function getLeaderboard() {
  const byPlayer = new Map();
  users.forEach((user) => {
    byPlayer.set(user.username, {
      playerName: user.username,
      totalScore: 0,
      wins: 0,
      badgeCorrect: 0,
      badgeGames: 0,
      games: 0,
    });
  });

  const seasonRecords = getSeasonRecords();
  seasonRecords.forEach((record) => {
    const current = byPlayer.get(record.playerName) || {
      playerName: record.playerName,
      totalScore: 0,
      wins: 0,
      badgeCorrect: 0,
      badgeGames: 0,
      games: 0,
    };
    current.totalScore += record.score;
    current.wins += record.isWin ? 1 : 0;
    if (typeof record.badgeVoteCorrect === "boolean") {
      current.badgeCorrect += record.badgeVoteCorrect ? 1 : 0;
      current.badgeGames += 1;
    }
    current.games += 1;
    byPlayer.set(record.playerName, current);
  });

  const players = Array.from(byPlayer.values())
    .map((player) => ({
      ...player,
      winRate: player.games ? player.wins / player.games : 0,
      sideRate: player.badgeGames ? player.badgeCorrect / player.badgeGames : 0,
      avgScore: player.games ? player.totalScore / player.games : 0,
      winStreak: getWinStreak(seasonRecords.filter((record) => record.playerName === player.playerName)),
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
  const seasonRecords = getSeasonRecords();
  const body = el("leaderboardBody");
  body.innerHTML = "";
  renderSortButtons();

  if (!players.length) {
    body.innerHTML = `<tr><td colspan="8">还没有记录，先提交一局分数。</td></tr>`;
  } else {
    players.forEach((player, index) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td><span class="rank ${index === 0 ? "top" : ""}">${index + 1}</span></td>
        <td><button class="player-link" type="button">${escapeHtml(player.playerName)}</button></td>
        <td class="score">${formatScore(player.totalScore)}</td>
        <td>${Math.round(player.winRate * 100)}%</td>
        <td>${Math.round(player.sideRate * 100)}%</td>
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
  el("totalGames").textContent = seasonRecords.length;
  el("avgScore").textContent = seasonRecords.length
    ? formatScore(seasonRecords.reduce((sum, item) => sum + item.score, 0) / seasonRecords.length)
    : "0.0";
  el("topPlayer").textContent = seasonRecords.length ? players[0]?.playerName || "暂无" : "暂无";
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
        <div class="meta">${escapeHtml(recordSeason(record))} · ${escapeHtml(record.gameDate)} 第 ${record.gameRound} 局 · ${escapeHtml(record.boardType)}</div>
      </div>
      ${options.canDelete ? `<button class="delete" type="button" aria-label="删除记录">×</button>` : ""}
    </div>
    <div class="score">${formatScore(record.score)} 分 · ${escapeHtml(record.role)}${record.subRole ? `/${escapeHtml(record.subRole)}` : ""} · ${record.camp === "good" ? "好人" : "狼人"} · ${record.isWin ? "胜利" : "失败"} · ${formatBadgeVote(record)}</div>
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
    item.querySelector(".delete").addEventListener("click", async () => {
      const saved = await persistServer(`/api/records/${encodeURIComponent(record.id)}`, { method: "DELETE" });
      if (!saved) return;
      state.records = state.records.filter((existing) => existing.id !== record.id);
      saveRecords();
      renderAll();
    });
  }

  item.querySelector(".comment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.currentUser) {
      alert("请先登录账号");
      return;
    }
    const input = event.currentTarget.elements.comment;
    const content = input.value.trim();
    if (!content) return;
    const target = state.records.find((existing) => existing.id === record.id);
    if (!target) return;
    const comment = {
      id: crypto.randomUUID(),
      author: currentUserName(),
      content,
      createdAt: Date.now(),
    };
    const saved = await persistServer("/api/comments", {
      method: "POST",
      body: JSON.stringify({ recordId: record.id, comment }),
    });
    if (!saved) return;
    target.comments = target.comments || [];
    target.comments.push(comment);
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
  renderRecordCollection(el("recordList"), getSeasonRecords(), {
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

  const records = getSeasonRecords().filter((record) => record.playerName === state.selectedPlayer);
  const knownUser = users.some((user) => user.username === state.selectedPlayer);
  if (!records.length && !knownUser) {
    state.selectedPlayer = "";
    panel.classList.add("hidden");
    return;
  }

  const totalScore = records.reduce((sum, record) => sum + record.score, 0);
  const wins = records.filter((record) => record.isWin).length;
  const badgeRecords = records.filter((record) => typeof record.badgeVoteCorrect === "boolean");
  const badgeCorrect = badgeRecords.filter((record) => record.badgeVoteCorrect).length;
  const sideRate = badgeRecords.length ? badgeCorrect / badgeRecords.length : 0;
  const best = records.length ? records.reduce((max, record) => Math.max(max, record.score), records[0].score) : 0;
  const winStreak = getWinStreak(records);
  el("playerTitle").textContent = `${state.selectedPlayer} 的战绩`;
  el("playerProfile").innerHTML = `
    <div class="avatar large-avatar">${avatarMarkup(state.selectedPlayer)}</div>
    <div class="profile-copy">
      <strong>${escapeHtml(state.selectedPlayer)}</strong>
      <span>${escapeHtml(state.selectedSeason)} · ${records.length} 局 · ${formatScore(totalScore)} 分</span>
    </div>
    ${
      state.currentUser === state.selectedPlayer
        ? `<label class="avatar-upload">上传头像<input id="avatarInput" type="file" accept="image/*" /></label>`
        : ""
    }
  `;
  const avatarInput = el("avatarInput");
  if (avatarInput) {
    avatarInput.addEventListener("change", handleAvatarUpload);
  }
  el("playerSummary").innerHTML = `
    <div><span>${formatScore(totalScore)}</span><small>总分</small></div>
    <div><span>${records.length ? Math.round((wins / records.length) * 100) : 0}%</span><small>胜率</small></div>
    <div><span>${Math.round(sideRate * 100)}%</span><small>站边率</small></div>
    <div><span>${winStreak}</span><small>当前连胜</small></div>
    <div><span>${records.length}</span><small>局数</small></div>
    <div><span>${records.length ? formatScore(totalScore / records.length) : "0.0"}</span><small>均分</small></div>
    <div><span>${formatScore(best)}</span><small>单局最高</small></div>
  `;
  renderRecordCollection(el("playerRecordList"), records, {
    canDelete: false,
    emptyText: "这个玩家还没有战绩",
  });
  panel.classList.remove("hidden");
}

function renderDiscussionComments(post, container) {
  const comments = post.comments || [];
  const body = container.querySelector(".discussion-comments");
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
    : `<div class="comment-empty">暂无留言</div>`;
}

function createDiscussionCard(post) {
  const item = document.createElement("article");
  item.className = "discussion-card";
  item.innerHTML = `
    <div class="discussion-head">
      <div class="avatar">${avatarMarkup(post.author)}</div>
      <div>
        <strong>${escapeHtml(post.author)}</strong>
        <div class="meta">${formatTime(post.createdAt)}</div>
      </div>
    </div>
    <p>${escapeHtml(post.content)}</p>
    <div class="discussion-comments"></div>
    <form class="comment-form">
      <input name="comment" type="text" maxlength="160" placeholder="回复这条讨论" required />
      <button type="submit">发送</button>
    </form>
  `;
  item.querySelector(".comment-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.currentUser) {
      alert("请先登录账号");
      return;
    }
    const input = event.currentTarget.elements.comment;
    const content = input.value.trim();
    if (!content) return;
    const comment = {
      id: crypto.randomUUID(),
      author: currentUserName(),
      content,
      createdAt: Date.now(),
    };
    const saved = await persistServer(`/api/discussions/${encodeURIComponent(post.id)}/comments`, {
      method: "POST",
      body: JSON.stringify({ comment }),
    });
    if (!saved) return;
    const target = state.discussions.find((item) => item.id === post.id);
    if (!target) return;
    target.comments = target.comments || [];
    target.comments.push(comment);
    input.value = "";
    saveDiscussions();
    renderDiscussions();
  });
  renderDiscussionComments(post, item);
  return item;
}

function renderDiscussions() {
  const list = el("discussionList");
  list.innerHTML = "";
  el("discussionTitle").textContent = state.discussionExpanded ? "讨论区" : "最新讨论";
  el("toggleDiscussionView").textContent = state.discussionExpanded ? "收起" : "查看全部";
  if (!state.discussions.length) {
    list.innerHTML = `<div class="empty">还没有讨论，先发一条。</div>`;
    return;
  }
  const posts = state.discussions
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt);
  const visiblePosts = state.discussionExpanded ? posts : posts.slice(0, 3);
  visiblePosts.forEach((post) => list.appendChild(createDiscussionCard(post)));
  if (!state.discussionExpanded && posts.length > visiblePosts.length) {
    const more = document.createElement("button");
    more.className = "ghost discussion-more";
    more.type = "button";
    more.textContent = `查看全部 ${posts.length} 条讨论`;
    more.addEventListener("click", openDiscussionView);
    list.appendChild(more);
  }
}

function renderAll() {
  renderLeaderboard();
  renderRecords();
  renderPlayerPanel();
  renderDiscussions();
}

function resetForm() {
  form.reset();
  state.extras = [];
  setToday();
  el("season").value = state.selectedSeason;
  if (state.currentUser) {
    el("playerName").value = state.currentUser;
    el("playerName").readOnly = true;
  }
  updateSubRoleField();
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

function openRulesModal() {
  el("rulesModal").classList.remove("hidden");
}

function closeRulesModal() {
  el("rulesModal").classList.add("hidden");
}

function openPasswordModal() {
  el("passwordUser").value = state.currentUser || el("loginName").value.trim();
  el("oldPassword").value = "";
  el("newPassword").value = "";
  el("confirmPassword").value = "";
  el("passwordModal").classList.remove("hidden");
}

function closePasswordModal() {
  el("passwordModal").classList.add("hidden");
}

function toggleLeaderboardFullscreen() {
  state.leaderboardFullscreen = !state.leaderboardFullscreen;
  document.body.classList.toggle("leaderboard-fullscreen", state.leaderboardFullscreen);
  el("toggleFullscreen").textContent = state.leaderboardFullscreen ? "退出全屏" : "全屏";
}

function openDiscussionView() {
  state.discussionExpanded = true;
  renderDiscussions();
  el("discussionTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

function toggleDiscussionView() {
  state.discussionExpanded = !state.discussionExpanded;
  renderDiscussions();
  el("discussionTitle").scrollIntoView({ behavior: "smooth", block: "start" });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function handleAvatarUpload(event) {
  const file = event.target.files?.[0];
  if (!file || !state.currentUser) return;
  if (file.size > 700_000) {
    alert("头像图片太大，请选 700KB 以内的图片");
    return;
  }
  const avatar = await readFileAsDataUrl(file);
  const saved = await persistServer("/api/avatar", {
    method: "POST",
    body: JSON.stringify({ username: state.currentUser, avatar }),
  });
  if (!saved) return;
  state.profiles[state.currentUser] = { avatar };
  saveProfiles();
  renderAll();
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

  el("seasonFilter").addEventListener("change", () => {
    state.selectedSeason = el("seasonFilter").value;
    el("season").value = state.selectedSeason;
    state.selectedPlayer = "";
    renderAll();
  });

  document.querySelectorAll("#autoPanel input, #camp").forEach((input) => {
    input.addEventListener("input", updateLiveScore);
    input.addEventListener("change", updateLiveScore);
  });

  el("role").addEventListener("change", () => {
    updateSubRoleField();
    syncCampWithRole();
    updateSkillActions();
    pruneRoleExtras();
    updateLiveScore();
  });

  el("subRole").addEventListener("change", () => {
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
        subRoleScope: button.dataset.subrole || "",
      });
      renderExtras();
      updateLiveScore();
    });
  });

  el("loginBtn").addEventListener("click", async () => {
    const name = el("loginName").value.trim();
    const password = el("loginPassword").value;
    const user = getUser(name);
    let validPassword = user && getUserPassword(name) === password;
    if (state.serverAvailable) {
      try {
        await apiRequest("/api/login", {
          method: "POST",
          body: JSON.stringify({ username: name, password }),
        });
        validPassword = true;
      } catch {
        validPassword = false;
      }
    }
    if (!validPassword) {
      alert("账号或密码不正确");
      return;
    }
    state.currentUser = user.username;
    localStorage.setItem(SESSION_KEY, state.currentUser);
    el("playerName").value = state.currentUser;
    el("playerName").readOnly = true;
    el("loginBtn").textContent = "已登录";
    renderAll();
  });

  el("resetForm").addEventListener("click", resetForm);
  el("openRules").addEventListener("click", openRulesModal);
  el("openPasswordModal").addEventListener("click", openPasswordModal);
  el("toggleFullscreen").addEventListener("click", toggleLeaderboardFullscreen);
  el("openDiscussionTop").addEventListener("click", openDiscussionView);
  el("toggleDiscussionView").addEventListener("click", toggleDiscussionView);
  el("discussionForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.currentUser) {
      alert("请先登录账号");
      return;
    }
    const content = el("discussionContent").value.trim();
    if (!content) return;
    const post = {
      id: crypto.randomUUID(),
      author: state.currentUser,
      content,
      comments: [],
      createdAt: Date.now(),
    };
    const saved = await persistServer("/api/discussions", {
      method: "POST",
      body: JSON.stringify({ post }),
    });
    if (!saved) return;
    state.discussions.unshift(post);
    saveDiscussions();
    el("discussionContent").value = "";
    renderDiscussions();
  });
  document.querySelectorAll("[data-close-rules]").forEach((button) => {
    button.addEventListener("click", closeRulesModal);
  });
  document.querySelectorAll("[data-close-password]").forEach((button) => {
    button.addEventListener("click", closePasswordModal);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeRulesModal();
      closePasswordModal();
      if (state.leaderboardFullscreen) toggleLeaderboardFullscreen();
    }
  });

  el("passwordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const username = el("passwordUser").value.trim();
    const oldPassword = el("oldPassword").value;
    const newPassword = el("newPassword").value;
    const confirmPassword = el("confirmPassword").value;
    if (!getUser(username)) {
      alert("账号不存在");
      return;
    }
    if (!state.serverAvailable && getUserPassword(username) !== oldPassword) {
      alert("原密码不正确");
      return;
    }
    if (newPassword !== confirmPassword) {
      alert("两次新密码不一致");
      return;
    }
    if (state.serverAvailable) {
      const saved = await persistServer("/api/change-password", {
        method: "POST",
        body: JSON.stringify({ username, oldPassword, newPassword }),
      });
      if (!saved) return;
    }
    state.passwordOverrides[username] = newPassword;
    savePasswordOverrides();
    if (state.currentUser === username) el("loginPassword").value = newPassword;
    closePasswordModal();
    alert("密码已修改");
  });

  el("closePlayer").addEventListener("click", () => {
    state.selectedPlayer = "";
    renderPlayerPanel();
  });

  el("clearData").addEventListener("click", async () => {
    if (!state.records.length) return;
    if (confirm("确定清空所有本地积分记录吗？")) {
      const saved = await persistServer("/api/records", { method: "DELETE" });
      if (!saved) return;
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

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!state.currentUser) {
      alert("请先登录账号");
      return;
    }
    const record = {
      id: crypto.randomUUID(),
      playerName: state.currentUser,
      season: el("season").value,
      gameDate: el("gameDate").value,
      gameRound: numberValue("gameRound"),
      boardType: el("boardType").value,
      role: el("role").value,
      subRole: el("subRoleField").classList.contains("hidden") ? "" : el("subRole").value,
      camp: getCamp(),
      isWin: el("isWin").checked,
      badgeVoteCorrect: el("badgeVote").value === "correct",
      score: currentScore(),
      mode: state.mode,
      extras: [...state.extras],
      notes: el("notes").value.trim(),
      comments: [],
      createdAt: Date.now(),
    };
    const saved = await persistServer("/api/records", {
      method: "POST",
      body: JSON.stringify({ record }),
    });
    if (!saved) return;
    state.records.push(record);
    saveRecords();
    renderAll();
    resetForm();
    el("playerName").value = record.playerName;
  });
}

async function init() {
  await loadServerState();
  fillOptions(el("boardType"), boards);
  fillOptions(el("role"), roles);
  fillOptions(el("season"), seasons);
  fillOptions(el("seasonFilter"), seasons);
  fillOptions(el("userList"), users.map((user) => user.username));
  if (!users.some((user) => user.username === state.currentUser)) {
    state.currentUser = "";
    localStorage.removeItem(SESSION_KEY);
  }
  if (state.currentUser) {
    el("loginName").value = state.currentUser;
    el("playerName").value = state.currentUser;
    el("playerName").readOnly = true;
    el("loginBtn").textContent = "已登录";
  }
  el("season").value = CURRENT_SEASON;
  el("seasonFilter").value = CURRENT_SEASON;
  setToday();
  bindEvents();
  updateSubRoleField();
  syncCampWithRole();
  updateSkillActions();
  updateLiveScore();
  renderAll();
}

init();
