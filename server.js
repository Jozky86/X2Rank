const http = require("http");
const fs = require("fs/promises");
const path = require("path");

const PORT = Number(process.env.PORT || 5174);
const ROOT = __dirname;
const DATA_DIR = path.join(ROOT, "data");
const STORE_PATH = path.join(DATA_DIR, "store.json");

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

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(STORE_PATH);
  } catch {
    await saveStore({ users: defaultUsers, records: [], discussions: [] });
  }
}

async function loadStore() {
  await ensureStore();
  const raw = await fs.readFile(STORE_PATH, "utf8");
  const store = JSON.parse(raw);
  store.users = store.users || defaultUsers;
  store.records = store.records || [];
  store.discussions = store.discussions || [];
  migrateQueenName(store);
  return store;
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

async function saveStore(store) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.writeFile(STORE_PATH, JSON.stringify(store, null, 2), "utf8");
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
  const store = await loadStore();

  if (req.method === "GET" && url.pathname === "/api/state") {
    sendJson(res, 200, publicState(store));
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/login") {
    const { username, password } = await readBody(req);
    const user = store.users.find((item) => item.username === username && item.password === password);
    sendJson(res, user ? 200 : 401, user ? { ok: true, username } : { ok: false, error: "账号或密码不正确" });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/change-password") {
    const { username, oldPassword, newPassword } = await readBody(req);
    const user = store.users.find((item) => item.username === username);
    if (!user) {
      sendJson(res, 404, { ok: false, error: "账号不存在" });
      return;
    }
    if (user.password !== oldPassword) {
      sendJson(res, 401, { ok: false, error: "原密码不正确" });
      return;
    }
    user.password = newPassword;
    await saveStore(store);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/avatar") {
    const { username, avatar } = await readBody(req);
    const user = store.users.find((item) => item.username === username);
    if (!user) {
      sendJson(res, 404, { ok: false, error: "账号不存在" });
      return;
    }
    user.avatar = avatar || "";
    await saveStore(store);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/records") {
    const { record } = await readBody(req);
    if (!record || !record.id || !record.playerName) {
      sendJson(res, 400, { ok: false, error: "记录不完整" });
      return;
    }
    store.records.push(record);
    await saveStore(store);
    sendJson(res, 200, { ok: true, record });
    return;
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/records/")) {
    const recordId = decodeURIComponent(url.pathname.slice("/api/records/".length));
    store.records = store.records.filter((record) => record.id !== recordId);
    await saveStore(store);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "DELETE" && url.pathname === "/api/records") {
    store.records = [];
    await saveStore(store);
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/comments") {
    const { recordId, comment } = await readBody(req);
    const record = store.records.find((item) => item.id === recordId);
    if (!record || !comment) {
      sendJson(res, 404, { ok: false, error: "记录不存在" });
      return;
    }
    record.comments = record.comments || [];
    record.comments.push(comment);
    await saveStore(store);
    sendJson(res, 200, { ok: true, comment });
    return;
  }

  if (req.method === "POST" && url.pathname === "/api/discussions") {
    const { post } = await readBody(req);
    if (!post || !post.id || !post.author || !post.content) {
      sendJson(res, 400, { ok: false, error: "讨论内容不完整" });
      return;
    }
    store.discussions.unshift(post);
    await saveStore(store);
    sendJson(res, 200, { ok: true, post });
    return;
  }

  if (req.method === "POST" && url.pathname.startsWith("/api/discussions/") && url.pathname.endsWith("/comments")) {
    const postId = decodeURIComponent(url.pathname.slice("/api/discussions/".length, -"/comments".length));
    const { comment } = await readBody(req);
    const post = store.discussions.find((item) => item.id === postId);
    if (!post || !comment) {
      sendJson(res, 404, { ok: false, error: "讨论不存在" });
      return;
    }
    post.comments = post.comments || [];
    post.comments.push(comment);
    await saveStore(store);
    sendJson(res, 200, { ok: true, comment });
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
