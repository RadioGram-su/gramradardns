const api = require("./api");
const tg = require("./telegram");

const TICK_MS = Number(process.env.WATCH_MS || 45000);

let timer = null;

function normAddr(a) {
  if (!a) return "";
  return String(a).toLowerCase().replace(/^-?\d:/, "");
}

async function processDomain(wallet, slug, row, settings, chatId) {
  const info = await api.getDomain(slug);
  if (!info.success) return;

  const now = Math.floor(Date.now() / 1000);
  const left = info.auction?.auction_end_time ? info.auction.auction_end_time - now : 0;
  const bid = info.auction?.max_bid_amount || 0;
  const leader = info.auction?.max_bid_address || info.ownerAddress;
  const url = info.url;
  const name = info.domain || `${slug}.gram`;
  const notified = row.notified || {};

  if (settings.notifyOutbid !== false && row.myBidGrm > 0) {
    const leaderNorm = normAddr(leader);
    const walletNorm = normAddr(wallet);
    if (leaderNorm && leaderNorm !== walletNorm && bid > row.myBidGrm + 0.0001 && !notified.outbid) {
      await tg.send(
        chatId,
        `⚠️ <b>Ставку перебили</b>\n\n` +
          `<b>${tg.esc(name)}</b>\n` +
          `Ваша: ${row.myBidGrm.toFixed(2)} GRM\n` +
          `Новая: ${bid.toFixed(2)} GRM\n` +
          `Лидер: <code>${tg.fmtWallet(leader)}</code>\n` +
          `<a href="${url}">Открыть аукцион</a>`
      );
      notified.outbid = true;
    }
  }

  if (info.state === "auction" || info.state === "waiting") {
    if (settings.notify10m !== false && left <= 600 && left > 300 && !notified.m10) {
      await tg.send(
        chatId,
        `⏰ <b>10 минут до конца</b>\n\n` +
          `<b>${tg.esc(name)}</b>\n` +
          `Ставка: ${bid.toFixed(2)} GRM\n` +
          `Осталось: ${Math.floor(left / 60)}м ${left % 60}с\n` +
          `<a href="${url}">Открыть</a>`
      );
      notified.m10 = true;
    }
    if (settings.notify5m !== false && left <= 300 && left > 0 && !notified.m5) {
      await tg.send(
        chatId,
        `🔥 <b>5 минут до конца</b>\n\n` +
          `<b>${tg.esc(name)}</b>\n` +
          `Ставка: ${bid.toFixed(2)} GRM\n` +
          `Осталось: ${Math.floor(left / 60)}м ${left % 60}с\n` +
          `<a href="${url}">Открыть</a>`
      );
      notified.m5 = true;
    }
  }

  if ((info.state === "taken" || left <= 0) && !notified.ended) {
    const finalBid = row.myBidGrm && bid <= row.myBidGrm ? row.myBidGrm : bid;
    const buyer = info.ownerAddress || leader;
    await tg.send(
      chatId,
      `✅ <b>Аукцион завершён</b>\n\n` +
        `<b>${tg.esc(name)}</b>\n` +
        `Цена: ${finalBid.toFixed(2)} GRM\n` +
        `Покупатель: <code>${tg.fmtWallet(buyer)}</code>\n` +
        `<a href="${url}">Подробнее</a>`
    );
    notified.ended = true;
  }

  row.notified = notified;
  row.lastBid = bid;
  row.lastLeader = leader;
  row.end = info.auction?.auction_end_time || row.end;
}

async function tick() {
  let data;
  try {
    data = await api.listJobs();
  } catch (e) {
    console.warn("[watcher] jobs:", e.message);
    return;
  }

  for (const job of data.jobs || []) {
    const { wallet, chatId, settings, watch } = job;
    const slugs = new Set(Object.keys(watch?.domains || {}));
    for (const s of settings?.watchlist || []) slugs.add(String(s).toLowerCase().replace(/\.gram$/, ""));

    let dirty = false;
    for (const slug of slugs) {
      if (!slug) continue;
      if (!watch.domains[slug]) watch.domains[slug] = { notified: {} };
      try {
        await processDomain(wallet, slug, watch.domains[slug], settings || {}, chatId);
        dirty = true;
      } catch (e) {
        console.warn("[watcher]", slug, e.message);
      }
    }

    if (dirty) {
      try {
        await api.saveWatch(wallet, watch);
      } catch (e) {
        console.warn("[watcher] save:", e.message);
      }
    }
  }
}

function startWatcher() {
  if (timer) return;
  console.log("[watcher] auction alerts started");
  tick();
  timer = setInterval(tick, TICK_MS);
}

module.exports = { startWatcher, tick };
