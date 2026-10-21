// Kivo Ultron — main-process extras: Telegram phone link, email, webhooks, save folders, backups, licence keys, voice
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// public half of the Kivo licence signing key (the private half never ships)
const LICENCE_PUB = 'MCowBQYDK2VwAyEAiAjsYjtDxSCwoFlOTeLGaZ9U+J2cQrTcnk/vBoXotPA=';

function verifyLicence(key) {
  try {
    const m = String(key || '').trim().match(/^KIVO-([A-Za-z0-9_-]+)\.([A-Za-z0-9_-]+)$/);
    if (!m) return { ok: false };
    const pub = crypto.createPublicKey({ key: Buffer.from(LICENCE_PUB, 'base64'), format: 'der', type: 'spki' });
    const ok = crypto.verify(null, Buffer.from(m[1]), pub, Buffer.from(m[2], 'base64url'));
    if (!ok) return { ok: false };
    const p = JSON.parse(Buffer.from(m[1], 'base64url').toString('utf8'));
    return { ok: true, name: p.n || '', plan: p.p || 'pro', issued: p.t || 0 };
  } catch { return { ok: false }; }
}

module.exports = function extras({ app, ipcMain, dialog, getWin, readKeys, writeKeys, DATA }) {
  const send = (ch, v) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send(ch, v); };
  const FOLDERS = () => path.join(app.getPath('userData'), 'folders.json');
  const folders = () => { try { return JSON.parse(fs.readFileSync(FOLDERS(), 'utf8')); } catch { return []; } };
  const allowDir = (d) => folders().includes(path.resolve(String(d || '')));

  // ---------------- Telegram ----------------
  let tg = { token: '', chatId: 0, polling: false, offset: 0, pair: null, gen: 0 };
  const tgApi = async (method, body) => {
    const res = await fetch(`https://api.telegram.org/bot${tg.token}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body || {}) });
    const j = await res.json().catch(() => ({}));
    if (!j.ok) throw new Error(j.description || 'Telegram error ' + res.status);
    return j.result;
  };
  async function poll(gen) {
    while (tg.token && gen === tg.gen) {
      try {
        const ups = await tgApi('getUpdates', { offset: tg.offset, timeout: 25, allowed_updates: ['message', 'callback_query'] });
        for (const u of ups) {
          tg.offset = u.update_id + 1;
          if (u.message) {
            const chat = u.message.chat?.id, text = String(u.message.text || '').trim();
            if (!tg.chatId && tg.pair && tg.pair.until > Date.now() && text.includes(tg.pair.code)) {
              tg.chatId = chat; tg.pair = null;
              const k = readKeys(); k.telegram = { ...(k.telegram || {}), chatId: chat }; writeKeys(k);
              await tgApi('sendMessage', { chat_id: chat, text: '✅ Paired with Kivo Ultron. You will get approvals and updates here, and you can message ULTRON any time.' });
              send('tg:paired', { chatId: chat, name: u.message.from?.first_name || '' });
            } else if (chat === tg.chatId && text) send('tg:msg', { text });
          } else if (u.callback_query && u.callback_query.message?.chat?.id === tg.chatId) {
            await tgApi('answerCallbackQuery', { callback_query_id: u.callback_query.id }).catch(() => {});
            send('tg:cb', { data: u.callback_query.data });
          }
        }
      } catch (e) { if (gen !== tg.gen) return; send('tg:error', String(e.message || e)); await new Promise((r) => setTimeout(r, 8000)); }
    }
  }
  function startTg() {
    const k = readKeys().telegram || {};
    tg = { ...tg, token: k.token || '', chatId: k.chatId || 0, gen: tg.gen + 1 };
    if (tg.token) poll(tg.gen);
  }
  ipcMain.handle('tg:set', async (_e, { token }) => {
    const k = readKeys();
    if (!token) { delete k.telegram; writeKeys(k); tg.gen++; tg.token = ''; tg.chatId = 0; return { ok: true, off: true }; }
    tg.token = String(token).trim();
    const me = await tgApi('getMe').catch((e) => { tg.token = ''; throw new Error('Telegram didn’t accept that token: ' + e.message); });
    k.telegram = { token: tg.token, chatId: 0, bot: me.username }; writeKeys(k);
    startTg();
    tg.pair = { code: String(crypto.randomInt(100000, 999999)), until: Date.now() + 15 * 60e3 };
    return { ok: true, bot: me.username, code: tg.pair.code };
  });
  ipcMain.handle('tg:status', () => { const k = readKeys().telegram || {}; return { on: !!k.token, paired: !!k.chatId, bot: k.bot || '' }; });
  ipcMain.handle('tg:send', async (_e, { text, buttons }) => {
    if (!tg.token || !tg.chatId) return false;
    await tgApi('sendMessage', { chat_id: tg.chatId, text: String(text).slice(0, 4000), ...(buttons ? { reply_markup: { inline_keyboard: buttons } } : {}) });
    return true;
  });

  // ---------------- email (SMTP) ----------------
  let nodemailer = null;
  const transport = () => {
    const m = readKeys().mail;
    if (!m?.host) throw new Error('Set up email in Settings first.');
    if (m.host === 'preview') return { t: { sendMail: async (o) => ({ messageId: 'preview-' + Date.now(), preview: o }), verify: async () => true }, m };
    nodemailer = nodemailer || require('nodemailer');
    return { t: nodemailer.createTransport({ host: m.host, port: Number(m.port) || 587, secure: Number(m.port) === 465, auth: { user: m.user, pass: m.pass } }), m };
  };
  ipcMain.handle('mail:set', (_e, p) => { const k = readKeys(); if (!p) delete k.mail; else k.mail = { ...(k.mail || {}), ...Object.fromEntries(Object.entries(p).filter(([, v]) => v !== '' && v != null)) }; writeKeys(k); return { on: !!k.mail?.host }; });
  ipcMain.handle('mail:status', () => { const m = readKeys().mail || {}; return { on: !!m.host, host: m.host || '', user: m.user || '', from: m.from || m.user || '', port: m.port || '' }; });
  ipcMain.handle('mail:test', async () => { const { t } = transport(); await t.verify(); return true; });
  ipcMain.handle('mail:send', async (_e, { to, subject, text }) => {
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(String(to || '').trim())) throw new Error('Not a valid email address: ' + to);
    const { t, m } = transport();
    const r = await t.sendMail({ from: m.from || m.user, to: String(to).trim(), subject: String(subject || '').slice(0, 300), text: String(text || '') });
    return { id: r.messageId, preview: m.host === 'preview' };
  });

  // ---------------- webhooks (Slack / Discord) ----------------
  ipcMain.handle('hook:post', async (_e, { url, text }) => {
    const u = new URL(url);
    const slack = u.protocol === 'https:' && u.hostname === 'hooks.slack.com';
    const discord = u.protocol === 'https:' && /(^|\.)discord(app)?\.com$/.test(u.hostname) && u.pathname.startsWith('/api/webhooks/');
    if (!slack && !discord) throw new Error('Only Slack or Discord webhook links are allowed.');
    const body = slack ? { text: String(text).slice(0, 3500) } : { content: String(text).slice(0, 1900) };
    const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!res.ok) throw new Error('Webhook said ' + res.status);
    return true;
  });

  // ---------------- folders the user picked ----------------
  ipcMain.handle('folder:pick', async (_e, { title } = {}) => {
    const r = await dialog.showOpenDialog(getWin(), { properties: ['openDirectory', 'createDirectory'], title: title || 'Choose a folder' });
    if (r.canceled || !r.filePaths[0]) return null;
    const d = path.resolve(r.filePaths[0]); const list = folders(); if (!list.includes(d)) { list.push(d); fs.writeFileSync(FOLDERS(), JSON.stringify(list)); }
    return d;
  });
  ipcMain.handle('folder:write', (_e, { dir, name, data }) => {
    if (!allowDir(dir)) throw new Error('Pick the folder again in Kivo first.');
    const f = path.join(path.resolve(dir), path.basename(String(name)).replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').slice(0, 120));
    fs.writeFileSync(f, String(data)); return f;
  });

  // ---------------- backups ----------------
  const stamp = () => new Date().toISOString().slice(0, 10);
  ipcMain.handle('backup:to', (_e, { dir }) => {
    if (!allowDir(dir)) throw new Error('Pick the backup folder again in Kivo first.');
    if (!fs.existsSync(DATA())) return null;
    const f = path.join(path.resolve(dir), `kivo-ultron-backup-${stamp()}.json`);
    fs.copyFileSync(DATA(), f);
    const old = fs.readdirSync(dir).filter((x) => /^kivo-ultron-backup-\d{4}-\d{2}-\d{2}\.json$/.test(x)).sort();
    for (const x of old.slice(0, Math.max(0, old.length - 7))) fs.rmSync(path.join(dir, x), { force: true });
    return f;
  });
  ipcMain.handle('backup:save', async () => {
    const r = await dialog.showSaveDialog(getWin(), { defaultPath: `kivo-ultron-backup-${stamp()}.json`, filters: [{ name: 'Kivo backup', extensions: ['json'] }] });
    if (r.canceled || !r.filePath) return null;
    fs.copyFileSync(DATA(), r.filePath); return r.filePath;
  });
  ipcMain.handle('backup:restore', async () => {
    const r = await dialog.showOpenDialog(getWin(), { properties: ['openFile'], filters: [{ name: 'Kivo backup', extensions: ['json'] }], title: 'Restore a Kivo Ultron backup' });
    if (r.canceled || !r.filePaths[0]) return null;
    let j; try { j = JSON.parse(fs.readFileSync(r.filePaths[0], 'utf8')); } catch { throw new Error('That file isn’t a Kivo backup.'); }
    if (!j || !Array.isArray(j.products) || !j.settings) throw new Error('That file isn’t a Kivo backup.');
    if (fs.existsSync(DATA())) fs.copyFileSync(DATA(), DATA().replace(/\.json$/, '.before-restore.json'));
    fs.writeFileSync(DATA(), JSON.stringify(j));
    return r.filePaths[0];
  });

  // ---------------- licence ----------------
  ipcMain.handle('lic:get', () => { const k = readKeys().licence; const v = verifyLicence(k); return v.ok ? { ...v, key: k } : { ok: false }; });
  ipcMain.handle('lic:set', (_e, key) => {
    const k = readKeys();
    if (!key) { delete k.licence; writeKeys(k); return { ok: false }; }
    const v = verifyLicence(key);
    if (!v.ok) throw new Error('That key isn’t valid. Check you copied all of it.');
    k.licence = String(key).trim(); writeKeys(k); return v;
  });

  // ---------------- voice: speech to text (optional OpenAI key) ----------------
  ipcMain.handle('stt', async (_e, { data, mime }) => {
    const key = readKeys().openai;
    if (!key) throw new Error('NO_KEY');
    const fd = new FormData();
    fd.append('file', new Blob([Buffer.from(data, 'base64')], { type: mime || 'audio/webm' }), 'speech.webm');
    fd.append('model', 'whisper-1');
    fd.append('language', 'en');
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + key }, body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(j.error?.message || 'Transcription failed (' + res.status + ')');
    return String(j.text || '').trim();
  });

  return { startTg, verifyLicence };
};
module.exports.verifyLicence = verifyLicence;
