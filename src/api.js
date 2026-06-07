const SITE = (process.env.GRAMRADAR_API || "https://gramradar.org").replace(/\/$/, "");
const SECRET = process.env.BOT_API_SECRET || process.env.GRAMRADAR_BOT_SECRET || "";

async function api(path, opts = {}) {
  const url = `${SITE}${path}`;
  const res = await fetch(url, {
    ...opts,
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "user-agent": "GramRadarBot/1.0",
      ...(opts.headers || {})
    }
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `${res.status} ${path}`);
  return data;
}

function withSecret(body = {}) {
  return { ...body, secret: SECRET };
}

function qs(params) {
  const p = new URLSearchParams({ secret: SECRET, ...params });
  return p.toString();
}

async function consumeCode(code) {
  return api("/api/bot/consume-code", { method: "POST", body: JSON.stringify(withSecret({ code })) });
}

async function linkWallet(wallet, chatId, username) {
  return api("/api/bot/link", {
    method: "POST",
    body: JSON.stringify(withSecret({ wallet, chatId, username: username || null }))
  });
}

async function statusByChat(chatId) {
  return api(`/api/bot/status-by-chat?${qs({ chatId })}`);
}

async function listJobs() {
  return api(`/api/bot/jobs?${qs()}`);
}

async function saveWatch(wallet, watch) {
  return api("/api/bot/watch", {
    method: "POST",
    body: JSON.stringify(withSecret({ wallet, watch }))
  });
}

async function getDomain(name) {
  return api(`/api/domains/check?name=${encodeURIComponent(name)}`);
}

module.exports = { consumeCode, linkWallet, statusByChat, listJobs, saveWatch, getDomain, SITE, SECRET };
