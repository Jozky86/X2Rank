const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const Database = require("better-sqlite3");

const PORT = Number(process.env.PORT || 5174);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");
const DB_PATH = path.join(DATA_DIR, "x2rank.db");
const MIGRATION_MARKER = path.join(DATA_DIR, ".sqlite-migrated");

const defaultUsers = [
  "Jozky",
  "黑昕昕",
  "林一爱吃蛋挞",
  "小羊",
  "小外套",
  "不爱吃蛋挞边边",
  "smxp",
  "傅延年",
  "水泥猫",
  "木木",
  "S",
  "dx",
  "QUEEN",
].map((username) => ({ username, password: "123123" }));

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
};

let db;

async function ensureStore() {
  if (db) return;
  await fs.mkdir(DATA_DIR, { recursive: true });
  db = new Database(DB_PATH);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      username TEXT PRIMARY KEY,
      password TEXT NOT NULL,
      avatar TEXT DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS records (
      id TEXT PRIMARY KEY,
      player_name TEXT NOT NULL,
      season TEXT DEFAULT 'S2',
      created_at INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_records_player ON records(player_name);
    CREATE INDEX IF NOT EXISTS idx_records_season_created ON records(season, created_at DESC);
    CREATE TABLE IF NOT EXISTS record_comments (
      id TEXT PRIMARY KEY,
      record_id TEXT NOT NULL,
      author TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      data TEXT NOT NULL,
      FOREIGN KEY(record_id) REFERENCES records(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_record_comments_record ON record_comments(record_id, created_at);
    CREATE TABLE IF NOT EXISTS discussions (
      id TEXT PRIMARY KEY,
      author TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      data TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_discussions_created ON discussions(created_at DESC);
    CREATE TABLE IF NOT EXISTS discussion_comments (
      id TEXT PRIMARY KEY,
      discussion_id TEXT NOT NULL,
      author TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      data TEXT NOT NULL,
      FOREIGN KEY(discussion_id) REFERENCES discussions(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_discussion_comments_discussion ON discussion_comments(discussion_id, created_at);
  `);
  seedUsers();
  await migrateJsonStore();
}

function seedUsers() {
  const insert = db.prepare("INSERT OR IGNORE INTO users (username, password, avatar) VALUES (?, ?, '')");
  const transaction = db.transaction(() => {
    defaultUsers.forEach((user) => insert.run(user.username, user.password));
  });
  transaction();
}

async function migrateJsonStore() {
  try {
    await fs.access(MIGRATION_MARKER);
    return;
  } catch {}

  try {
    await fs.access(STORE_PATH);
  } catch {
    await fs.writeFile(MIGRATION_MARKER, String(Date.now()), "utf8");
    return;
  }

  const raw = await fs.readFile(STORE_PATH, "utf8");
  const store = JSON.parse(raw);
  store.users = store.users || defaultUsers;
  store.records = store.records || [];
  store.discussions = store.discussions || [];
  migrateQueenName(store);

  const insertUser = db.prepare(`
    INSERT INTO users (username, password, avatar)
    VALUES (@username, @password, @avatar)
    ON CONFLICT(username) DO UPDATE SET
      password = excluded.password,
      avatar = excluded.avatar
  `);
  const insertRecord = db.prepare(`
    INSERT OR REPLACE INTO records (id, player_name, season, created_at, data)
    VALUES (@id, @playerName, @season, @createdAt, @data)
  `);
  const insertRecordComment = db.prepare(`
    INSERT OR REPLACE INTO record_comments (id, record_id, author, created_at, data)
    VALUES (@id, @recordId, @author, @createdAt, @data)
  `);
  const insertDiscussion = db.prepare(`
    INSERT OR REPLACE INTO discussions (id, author, created_at, data)
    VALUES (@id, @author, @createdAt, @data)
  `);
  const insertDiscussionComment = db.prepare(`
    INSERT OR REPLACE INTO discussion_comments (id, discussion_id, author, created_at, data)
    VALUES (@id, @discussionId, @author, @createdAt, @data)
  `);

  const transaction = db.transaction(() => {
    store.users.forEach((user) => {
      insertUser.run({
        username: user.username,
        password: user.password || "123123",
        avatar: user.avatar || "",
      });
    });
    store.records.forEach((record) => {
      const comments = record.comments || [];
      const recordData = { ...record, comments: [] };
      insertRecord.run({
        id: record.id,
        playerName: record.playerName,
        season: record.season || "S2",
        createdAt: record.createdAt || Date.now(),
        data: JSON.stringify(recordData),
      });
      comments.forEach((comment) => {
        insertRecordComment.run({
          id: comment.id,
          recordId: record.id,
          author: comment.author,
          createdAt: comment.createdAt || Date.now(),
          data: JSON.stringify(comment),
        });
      });
    });
    store.discussions.forEach((post) => {
      const comments = post.comments || [];
      const postData = { ...post, comments: [] };
      insertDiscussion.run({
        id: post.id,
        author: post.author,
        createdAt: post.createdAt || Date.now(),
        data: JSON.stringify(postData),
      });
      comments.forEach((comment) => {
        insertDiscussionComment.run({
          id: comment.id,
          discussionId: post.id,
          author: comment.author,
          createdAt: comment.createdAt || Date.now(),
          data: JSON.stringify(comment),
        });
      });
    });
  });
  transaction();
  await fs.writeFile(MIGRATION_MARKER, String(Date.now()), "utf8");
}

async function loadStore() {
  await ensureStore();
  const store = {
    users: db.prepare("SELECT username, password, avatar FROM users ORDER BY rowid").all(),
    records: loadRecords(),
    discussions: loadDiscussions(),
  };
  migrateQueenName(store);
  return store;
}

function parseData(row) {
  return JSON.parse(row.data);
}

function loadRecords() {
  const records = db.prepare("SELECT * FROM records ORDER BY created_at DESC").all().map(parseData);
  const comments = db.prepare("SELECT * FROM record_comments ORDER BY created_at").all();
  const byRecord = new Map(records.map((record) => [record.id, record]));
  records.forEach((record) => {
    record.comments = [];
  });
  comments.forEach((row) => {
    const record = byRecord.get(row.record_id);
    if (record) record.comments.push(parseData(row));
  });
  return records;
}

function loadDiscussions() {
  const posts = db.prepare("SELECT * FROM discussions ORDER BY created_at DESC").all().map(parseData);
  const comments = db.prepare("SELECT * FROM discussion_comments ORDER BY created_at").all();
  const byPost = new Map(posts.map((post) => [post.id, post]));
  posts.forEach((post) => {
    post.comments = [];
  });
  comments.forEach((row) => {
    const post = byPost.get(row.discussion_id);
    if (post) post.comments.push(parseData(row));
  });
  return posts;
}

function migrateQueenName(store) {
  const oldName = "-  QUEEN";
  const newName = "QUEEN";
  const oldUser = store.users.find((user) => user.username === oldName);
  const newUser = store.users.find((user) => user.username === newName);
  if (oldUser && !newUser) oldUser.username = newName;
  if (oldUser && newUser) store.users = store.users.filter((user) => user.username !== oldName);
  store.records.forEach((record) => {
    if (record.playerName === oldName) record.playerName = newName;
    (record.comments || []).forEach((comment) => {
      if (comment.author === oldName) comment.author = newName;
    });
  });
  store.discussions.forEach((post) => {
    if (post.author === oldName) post.author = newName;
    (post.comments || []).forEach((comment) => {
      if (comment.author === oldName) comment.author = newName;
    });
  });
}

function sendJson(res, status, payload) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(payload));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 2_500_000) {
        req.destroy();
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
  });
}

function publicState(store) {
  return {
    users: store.users.map(({ username, avatar }) => ({ username, avatar: avatar || "" })),
    records: store.records,
    discussions: store.discussions,
  };
}

async function handleApi(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  await ensureStore();

  if (req.method === "GET" && url.pathname === "/api/state") {
    const store = await loadStore();
    sendJson(res, 200, publicState(store));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const { username, password } = await readBody(req);
    const user = db.prepare("SELECT username FROM users WHERE username = ? AND password = ?").get(username, password);
    sendJson(res, user ? 200 : 401, user ? { ok: true, username } : { ok: false, error: "账号或密码不正确" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/change-password") {
    const { username, oldPassword, newPassword } = await readBody(req);
    const user = db.prepare("SELECT username, password FROM users WHERE username = ?").get(username);
    if (!user) {
      sendJson(res, 404, { ok: false, error: "账号不存在" });
      return;
    }
    if (user.password !== oldPassword) {
      sendJson(res, 401, { ok: false, error: "原密码不正确" });
      return;
    }
    db.prepare("UPDATE users SET password = ? WHERE username = ?").run(newPassword, username);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/avatar") {
    const { username, avatar } = await readBody(req);
    const user = db.prepare("SELECT username FROM users WHERE username = ?").get(username);
    if (!user) {
      sendJson(res, 404, { ok: false, error: "账号不存在" });
      return;
    }
    db.prepare("UPDATE users SET avatar = ? WHERE username = ?").run(avatar || "", username);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/records") {
    const { record } = await readBody(req);
    if (!record || !record.id || !record.playerName) {
      sendJson(res, 400, { ok: false, error: "记录不完整" });
      return;
    }
    const recordData = { ...record, comments: [] };
    db.prepare(`
      INSERT INTO records (id, player_name, season, created_at, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(record.id, record.playerName, record.season || "S2", record.createdAt || Date.now(), JSON.stringify(recordData));
    sendJson(res, 200, { ok: true, record });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/records/")) {
    const recordId = decodeURIComponent(url.pathname.slice("/api/records/".length));
    db.prepare("DELETE FROM records WHERE id = ?").run(recordId);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "DELETE" && url.pathname === "/api/records") {
    db.prepare("DELETE FROM records").run();
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/comments") {
    const { recordId, comment } = await readBody(req);
    const record = db.prepare("SELECT id FROM records WHERE id = ?").get(recordId);
    if (!record || !comment) {
      sendJson(res, 404, { ok: false, error: "记录不存在" });
      return;
    }
    db.prepare(`
      INSERT INTO record_comments (id, record_id, author, created_at, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(comment.id, recordId, comment.author, comment.createdAt || Date.now(), JSON.stringify(comment));
    sendJson(res, 200, { ok: true, comment });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/comments/")) {
    const commentId = decodeURIComponent(url.pathname.slice("/api/comments/".length));
    db.prepare("DELETE FROM record_comments WHERE id = ?").run(commentId);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/discussions") {
    const { post } = await readBody(req);
    if (!post || !post.id || !post.author || !post.content) {
      sendJson(res, 400, { ok: false, error: "讨论内容不完整" });
      return;
    }
    const postData = { ...post, comments: [] };
    db.prepare(`
      INSERT INTO discussions (id, author, created_at, data)
      VALUES (?, ?, ?, ?)
    `).run(post.id, post.author, post.createdAt || Date.now(), JSON.stringify(postData));
    sendJson(res, 200, { ok: true, post });
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/discussions/") && url.pathname.endsWith("/comments")) {
    const postId = decodeURIComponent(url.pathname.slice("/api/discussions/".length, -"/comments".length));
    const { comment } = await readBody(req);
    const post = db.prepare("SELECT id FROM discussions WHERE id = ?").get(postId);
    if (!post || !comment) {
      sendJson(res, 404, { ok: false, error: "讨论不存在" });
      return;
    }
    db.prepare(`
      INSERT INTO discussion_comments (id, discussion_id, author, created_at, data)
      VALUES (?, ?, ?, ?, ?)
    `).run(comment.id, postId, comment.author, comment.createdAt || Date.now(), JSON.stringify(comment));
    sendJson(res, 200, { ok: true, comment });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/discussions/") && url.pathname.includes("/comments/")) {
    const match = url.pathname.match(/^\/api\/discussions\/([^/]+)\/comments\/([^/]+)$/);
    if (!match) {
      sendJson(res, 404, { ok: false, error: "Not found" });
      return;
    }
    const commentId = decodeURIComponent(match[2]);
    db.prepare("DELETE FROM discussion_comments WHERE id = ?").run(commentId);
    sendJson(res, 200, { ok: true });
    return;
  }

  sendJson(res, 404, { ok: false, error: "Not found" });
}

async function serveStatic(req, res) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.normalize(path.join(ROOT, requested));
  if (!filePath.startsWith(ROOT) || filePath.startsWith(`${DATA_DIR}${path.sep}`) || filePath === DATA_DIR) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }
  try {
    const content = await fs.readFile(filePath);
    const ext = path.extname(filePath);
    res.writeHead(200, { "Content-Type": mimeTypes[ext] || "application/octet-stream" });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.url.startsWith("/api/")) {
      await handleApi(req, res);
      return;
    }
    await serveStatic(req, res);
  } catch (error) {
    console.error(error);
    sendJson(res, 500, { ok: false, error: "服务器错误" });
  }
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`X2Rank server running at http://0.0.0.0:${PORT}`);
});
