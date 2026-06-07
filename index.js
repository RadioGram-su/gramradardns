require("dotenv").config();

const bot = require("./src/bot");
const tg = require("./src/telegram");
const watcher = require("./src/watcher");
const api = require("./src/api");

const POLL_MS = Number(process.env.POLL_MS || 1500);
let offset = 0;
let pollTimer = null;

function checkEnv() {
  if (!tg.isEnabled()) {
    console.error("Set TELEGRAM_BOT_TOKEN in .env");
    process.exit(1);
  }
  if (!api.SECRET) {
    console.error("Set BOT_API_SECRET in .env (same as on gramradar.org server)");
    process.exit(1);
  }
}

async function pollOnce() {
  try {
    const updates = await tg.tg("getUpdates", {
      offset,
      timeout: 0,
      allowed_updates: ["message"]
    });
    for (const u of updates || []) {
      offset = u.update_id + 1;
      if (u.message) await bot.handleMessage(u.message);
    }
  } catch (e) {
    console.warn("[poll]", e.message);
  }
}

function startPolling() {
  if (pollTimer) return;
  console.log(`Gram Radar Bot @gramradardns_bot`);
  console.log(`API: ${api.SITE}`);
  pollOnce();
  pollTimer = setInterval(pollOnce, POLL_MS);
}

checkEnv();
startPolling();
watcher.startWatcher();

process.on("SIGINT", () => {
  console.log("bye");
  process.exit(0);
});
