const api = require("./api");
const tg = require("./telegram");

const CHANNEL = process.env.CHANNEL_URL || "https://t.me/gramradardns";
const SITE = process.env.SITE_URL || "https://gramradar.org";

function welcomeText() {
  return (
    `👋 <b>Gram Radar DNS Bot</b>\n\n` +
    `Уведомления по .gram аукционам:\n` +
    `• перебили вашу ставку\n` +
    `• 10 / 5 мин до конца\n` +
    `• аукцион завершён (цена + кошелёк)\n\n` +
    `<b>Привязка кошелька:</b>\n` +
    `1. Откройте <a href="${SITE}/#sniper">gramradar.org</a>\n` +
    `2. Подключите TON-кошелёк\n` +
    `3. Нажмите «Привязать @gramradardns_bot»\n\n` +
    `Или: <code>/link КОД</code>\n\n` +
    `📢 Канал: <a href="${CHANNEL}">@gramradardns</a>\n` +
    `Команды: /status /help /channel`
  );
}

async function linkByCode(chatId, code, username) {
  const out = await api.consumeCode(code);
  await api.linkWallet(out.wallet, chatId, username);
  await tg.send(
    chatId,
    `✅ Telegram привязан к кошельку\n\n<code>${tg.esc(out.wallet)}</code>\n\n` +
      `Уведомления включены. Настройки — в Premium на сайте.\n\n` +
      `📢 <a href="${CHANNEL}">Подписаться на канал</a>`
  );
}

async function handleMessage(msg) {
  const chatId = msg.chat?.id;
  const text = (msg.text || "").trim();
  const username = msg.from?.username;
  if (!chatId || !text) return;

  if (text === "/start" || text.startsWith("/start ")) {
    const payload = text.split(/\s+/)[1] || "";
    if (payload.startsWith("link_")) {
      try {
        await linkByCode(chatId, payload.slice(5).toUpperCase(), username);
      } catch (e) {
        await tg.send(chatId, `❌ ${tg.esc(e.message)}\n\nПолучите новый код на сайте.`);
      }
      return;
    }
    await tg.send(chatId, welcomeText());
    return;
  }

  if (text.startsWith("/link")) {
    const code = text.split(/\s+/)[1]?.toUpperCase();
    if (!code) {
      await tg.send(chatId, "Использование: <code>/link AB12CD</code>");
      return;
    }
    try {
      await linkByCode(chatId, code, username);
    } catch (e) {
      await tg.send(chatId, `❌ ${tg.esc(e.message)}`);
    }
    return;
  }

  if (text === "/status") {
    try {
      const st = await api.statusByChat(chatId);
      if (!st.linked) {
        await tg.send(chatId, "Кошелёк не привязан. Откройте сайт и нажмите «Привязать Telegram».");
        return;
      }
      await tg.send(chatId, `✅ Кошелёк:\n<code>${tg.esc(st.wallet)}</code>`);
    } catch (e) {
      await tg.send(chatId, `❌ ${tg.esc(e.message)}`);
    }
    return;
  }

  if (text === "/channel") {
    await tg.send(chatId, `📢 Канал Gram Radar DNS:\n<a href="${CHANNEL}">@gramradardns</a>`);
    return;
  }

  if (text === "/help") {
    await tg.send(chatId, welcomeText());
  }
}

module.exports = { handleMessage, welcomeText };
