// Kivo Ultron — extras: phone link (Telegram), email, webhooks, backups, voice, sounds, look, licence / free tier
(() => {
  const K = window.KU;
  const $ = (s) => document.querySelector(s);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const btn = (l, f, c) => { const b = el('button', 'hw-btn ' + (c || ''), l); b.onclick = f; return b; };
  const BUY_URL = 'https://tomosmira823-wq.github.io/ULTRON-/#buy';
  const S = () => K.D.settings;
  let tg = { on: false, paired: false, bot: '' }, mail = { on: false }, lic = { ok: false }, pendingRedo = null;

  // ================= sounds (synthesised, no files) =================
  let ac = null;
  const actx = () => (ac = ac || new (window.AudioContext || window.webkitAudioContext)());
  function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, glide) {
    if (S().sounds === false) return;
    try {
      const a = actx(), t0 = a.currentTime + when, o = a.createOscillator(), g = a.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t0); if (glide) o.frequency.exponentialRampToValueAtTime(glide, t0 + dur);
      const v = vol * (S().volume ?? 0.5);
      g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v), t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + dur + 0.05);
    } catch {}
  }
  const SOUNDS = {
    chime: () => { tone(880, 0.5, 'sine', 0.18); tone(1320, 0.6, 'sine', 0.12, 0.12); },
    ping: () => { tone(1046, 0.25, 'triangle', 0.18); tone(1568, 0.3, 'triangle', 0.1, 0.09); },
    bell: () => { for (const [f, d] of [[1200, 1.2], [1800, 0.9], [2400, 0.6]]) tone(f, d, 'sine', 0.13); },
    gong: () => { tone(110, 2.4, 'sine', 0.32, 0, 98); tone(165, 2.0, 'triangle', 0.14, 0.01, 150); tone(332, 1.4, 'sine', 0.08, 0.02); },
    whoosh: () => tone(500, 0.18, 'sine', 0.035, 0, 900),
    tick: () => tone(2000 + Math.random() * 800, 0.025, 'square', 0.012),
  };
  function sound(n) { (SOUNDS[n] || SOUNDS.chime)(); }
  setInterval(() => { if (S().sounds === false || S().typing === false || document.hidden) return; if (Object.values(K.agentState).some((s) => s.status === 'WORKING') && Math.random() < 0.55) SOUNDS.tick(); }, 110);

  // ================= voice =================
  function speak(text) {
    if (!window.speechSynthesis) return;
    const clean = String(text).replace(/[*_#`>|]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').slice(0, 600);
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(clean);
    const vs = speechSynthesis.getVoices();
    u.voice = vs.find((v) => v.name === S().voiceName) || vs.find((v) => /en-GB/i.test(v.lang) && /male|george|ryan|thomas/i.test(v.name)) || vs.find((v) => /en-GB/i.test(v.lang)) || null;
    u.rate = 1.02; u.pitch = 0.8; speechSynthesis.speak(u);
  }
  let rec = null, chunks = [];
  async function micToggle() {
    const b = $('#chat-mic');
    if (rec) { rec.stop(); return; }
    if (!K.keys.openai) { K.toast('Add an OpenAI key in Settings → Voice to talk to ULTRON. Or press Win + H in the chat box to use Windows dictation.', true); return; }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunks = []; rec = new MediaRecorder(stream, { mimeType: 'audio/webm' });
      rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop()); rec = null; b.classList.remove('rec'); b.textContent = '🎙';
        const blob = new Blob(chunks, { type: 'audio/webm' }); if (blob.size < 2000) return;
        const data = await new Promise((res) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1] || ''); fr.readAsDataURL(blob); });
        b.textContent = '…';
        try { const text = await kivo.stt({ data, mime: 'audio/webm' }); b.textContent = '🎙'; if (text) K.chatSend(text, 'voice'); }
        catch (e) { b.textContent = '🎙'; K.toast(K.cleanErr(e), true); }
      };
      rec.start(); b.classList.add('rec'); b.textContent = '■';
      setTimeout(() => rec?.state === 'recording' && rec.stop(), 30000);
    } catch (e) { K.toast('Couldn’t use the microphone: ' + e.message, true); }
  }

  // ================= phone (Telegram) =================
  const tgSend = (text, buttons) => (tg.paired ? kivo.tgSend({ text, buttons }).catch(() => {}) : Promise.resolve(false));
  function askApproval(sp, run, step) {
    sound('ping');
    tgSend(`🟡 ${sp.name}: ${step.name} needs your OK\n\n${String(step.out).replace(/```[\s\S]*?```/g, '').slice(0, 1500)}`, [[{ text: '✅ Approve', callback_data: `ap|${run.id}|${step.agent}|approve` }, { text: '✏️ Redo', callback_data: `ap|${run.id}|${step.agent}|redo` }, { text: '⏹ Stop', callback_data: `ap|${run.id}|${step.agent}|stop` }]]);
  }
  function phoneDone(sp, run) {
    const ready = (run.outbox || []).filter((e) => e.to && e.status !== 'sent');
    if (!ready.length) return;
    tgSend(`📧 ${sp.name} has ${ready.length} email${ready.length > 1 ? 's' : ''} ready:\n\n${ready.slice(0, 8).map((e) => `• ${e.to}: ${e.subject}`).join('\n')}`, [[{ text: `Send ${ready.length}`, callback_data: `mail|${sp.id}|${run.id}` }]]);
  }
  function onNotify(title, body) {
    if (/complete|finished/i.test(title)) sound(/Sales/i.test(title) ? 'gong' : 'chime');
    if (S().phoneNotify !== false && !/needs you/i.test(title)) tgSend(`${/fail/i.test(title) ? '⚠️' : '✅'} ${title}${body ? '\n' + body : ''}`);
  }
  async function onTg(kind, v) {
    if (kind === 'paired') { tg.paired = true; K.toast(`Phone linked${v.name ? ' to ' + v.name : ''} ✓`); renderSettings(); return; }
    if (kind === 'error') { K.log('ultron', 'Phone link: ' + v, 'err'); return; }
    if (kind === 'cb') {
      const [t, a, b, c] = String(v.data).split('|');
      if (t === 'ap') {
        if (c === 'redo') { pendingRedo = { run: a, agent: b }; tgSend('✏️ What should change? Reply with your note.'); return; }
        window.SP?.answer(a, b, c); tgSend(c === 'approve' ? '✅ Approved' : '⏹ Stopped');
      } else if (t === 'mail') {
        const sp = window.SP?.get(a), run = sp?.runs.find((r) => r.id === b);
        if (run) { await window.SP.sendAll(sp, run); const sent = run.outbox.filter((e) => e.status === 'sent').length; tgSend(`📧 ${sent}/${run.outbox.length} sent.`); }
      }
      return;
    }
    if (kind === 'msg') {
      const text = v.text;
      if (pendingRedo) { const p = pendingRedo; pendingRedo = null; window.SP?.answer(p.run, p.agent, 'redo', text); tgSend('✏️ Got it, redoing with your note.'); return; }
      if (/^\/start/.test(text)) { tgSend('👋 Linked. Message me like you would in the app, e.g. “make 3 Halloween designs” or “run the sales office on barbers in Chester”.'); return; }
      tgSend('…');
      const reply = await K.chatSend(text, 'phone');
      tgSend(reply || 'Done.');
    }
  }

  // ================= licence / free tier =================
  const pro = () => !!lic.ok;
  function allow(what, d) {
    if (pro()) return true;
    if (what === 'marketing') return lock('Marketing is part of Kivo Ultron Pro.');
    if (what === 'room') { const list = window.SP?.list || []; if (!d && list.length >= 1) return lock('The free version includes the Store and one room.'); if (d && list.findIndex((s) => s.id === d) > 0) return lock('The free version includes the Store and one room.'); }
    return true;
  }
  function lock(why) {
    $('#lock-why').textContent = why; $('#lock-key').value = ''; $('#lock-msg').textContent = '';
    $('#lock').hidden = false; setTimeout(() => $('#lock-key').focus(), 50); return false;
  }
  async function activate(key, msgEl) {
    try { lic = await kivo.licSet(key); msgEl.textContent = `Unlocked ✓ Thanks${lic.name ? ', ' + lic.name : ''}!`; K.toast('Kivo Ultron Pro unlocked'); renderLicBadge(); renderSettings(); setTimeout(() => ($('#lock').hidden = true), 900); return true; }
    catch (e) { msgEl.textContent = K.cleanErr(e); return false; }
  }
  function renderLicBadge() { const b = $('#pro-badge'); if (b) { b.textContent = pro() ? 'PRO' : 'FREE'; b.classList.toggle('pro', pro()); b.title = pro() ? `Licensed to ${lic.name}` : 'Free version: Store + 1 room. Click to unlock everything.'; } }

  // ================= settings panel =================
  function section(box, title, sub) { box.append(el('h3', 'engr sm', title)); if (sub) box.append(el('p', 'tiny dim', sub)); }
  function field(label, input) { const f = el('div', 'field'); const l = el('label', 'lbl', label); f.append(l, input); return f; }
  function inp(type, val, ph) { const i = el('input'); i.type = type; i.value = val ?? ''; if (ph) i.placeholder = ph; i.autocomplete = 'off'; return i; }
  function chk(label, on, fn) { const l = el('label', 'chk'); const c = el('input'); c.type = 'checkbox'; c.checked = !!on; c.onchange = () => fn(c.checked); l.append(c, ' ' + label); return l; }
  async function renderSettings() {
    const box = $('#s-extras'); if (!box) return;
    [tg, mail] = await Promise.all([kivo.tgStatus(), kivo.mailStatus()]);
    box.textContent = '';
    // licence
    section(box, 'LICENCE', pro() ? `Kivo Ultron Pro · licensed to ${lic.name}` : 'Free version: the Store plus one room. Pro unlocks Marketing and every room.');
    if (!pro()) { const k = inp('text', '', 'KIVO-…'); const m = el('div', 'wz-msg'); const r = el('div', 'row'); r.append(k, btn('ACTIVATE', () => activate(k.value, m), 'go'), btn('BUY PRO', () => kivo.openUrl(BUY_URL))); box.append(r, m); }
    else box.append(btn('REMOVE KEY FROM THIS PC', async () => { if (!confirm('Remove the licence key from this PC?')) return; lic = await kivo.licSet(null); renderLicBadge(); renderSettings(); }, 'mini'));
    // phone
    section(box, 'PHONE · TELEGRAM', 'Get approvals and updates on your phone, tap Approve, and message ULTRON from anywhere.');
    if (!tg.on) {
      const how = el('ol', 'wz-how'); for (const t of ['In Telegram, message @BotFather and send /newbot.', 'Give it any name, then copy the token it sends you.', 'Paste it here and press CONNECT.']) how.append(el('li', '', t));
      const t = inp('password', '', '123456789:AA…'); const m = el('div', 'wz-msg');
      const r = el('div', 'row'); r.append(t, btn('CONNECT', async () => { m.textContent = 'Checking…'; try { const x = await kivo.tgSet({ token: t.value }); m.textContent = `Now open @${x.bot} in Telegram and send it this code: ${x.code}`; tg = await kivo.tgStatus(); } catch (e) { m.textContent = K.cleanErr(e); } }, 'go'));
      box.append(how, r, m);
    } else {
      box.append(el('div', 'tiny', tg.paired ? `✅ Linked to @${tg.bot}` : `Waiting for you to send the pairing code to @${tg.bot}…`));
      const r = el('div', 'row wrap'); r.append(chk('Send me updates when jobs finish', S().phoneNotify !== false, (v) => { S().phoneNotify = v; K.persist(); }), btn('SEND TEST', () => tgSend('👋 Test from Kivo Ultron'), 'mini'), btn('DISCONNECT', async () => { await kivo.tgSet({ token: '' }); renderSettings(); }, 'mini danger'));
      box.append(r);
    }
    // email
    section(box, 'EMAIL · LETS BOTS SEND (YOU APPROVE EACH ONE)', 'Gmail: host smtp.gmail.com, port 465, your address, and an app password (Google Account → Security → App passwords). Outlook: smtp.office365.com, 587. Type “preview” as the host to try it without sending.');
    const h = inp('text', mail.host, 'smtp.gmail.com'), p = inp('number', mail.port || '465'), u = inp('text', mail.user, 'you@gmail.com'), pw = inp('password', '', mail.on ? 'leave blank to keep' : 'app password'), fr = inp('text', mail.from, 'Kivo <you@gmail.com>');
    const r1 = el('div', 'row'); r1.append(field('HOST', h), field('PORT', p)); const r2 = el('div', 'row'); r2.append(field('USERNAME', u), field('PASSWORD', pw), field('FROM', fr));
    const mm = el('div', 'wz-msg', mail.on ? `✅ Email set up (${mail.host})` : '');
    const r3 = el('div', 'row'); r3.append(btn('SAVE & TEST', async () => { mm.textContent = 'Testing…'; try { await kivo.mailSet({ host: h.value.trim(), port: p.value, user: u.value.trim(), pass: pw.value, from: fr.value.trim() }); await kivo.mailTest(); mail = await kivo.mailStatus(); EX.mailOn = mail.on; mm.textContent = '✅ Connected'; } catch (e) { mm.textContent = K.cleanErr(e); } }, 'go'), mail.on ? btn('REMOVE', async () => { await kivo.mailSet(null); EX.mailOn = false; renderSettings(); }, 'mini danger') : el('span'));
    box.append(r1, r2, r3, mm);
    // webhook
    section(box, 'SLACK / DISCORD', 'Paste an incoming-webhook link, then tick “Post a summary” on any room (EDIT ROOM).');
    const w = inp('text', S().webhook || '', 'https://hooks.slack.com/services/… or https://discord.com/api/webhooks/…'); const wm = el('div', 'wz-msg');
    const r4 = el('div', 'row'); r4.append(w, btn('SAVE & TEST', async () => { S().webhook = w.value.trim(); K.persist(); if (!S().webhook) { wm.textContent = 'Removed'; return; } try { await kivo.hookPost({ url: S().webhook, text: '👋 Kivo Ultron is connected.' }); wm.textContent = '✅ Posted a test message'; } catch (e) { wm.textContent = K.cleanErr(e); } }, 'go'));
    box.append(r4, wm);
    // backup
    section(box, 'BACKUP & SYNC', 'Pick your OneDrive or Google Drive folder for auto-backups and they follow you to any PC. Keys and accounts aren’t included: they stay encrypted on each PC.');
    const bm = el('div', 'wz-msg', S().backupDir ? `Auto-backup every day to ${S().backupDir}${S().lastBackup ? ' · last ' + new Date(S().lastBackup).toLocaleString() : ''}` : '');
    const r5 = el('div', 'row wrap');
    r5.append(btn('BACKUP NOW', async () => { const f = await kivo.backupSave(); if (f) bm.textContent = 'Saved ' + f; }), btn('RESTORE…', async () => { if (!confirm('Restore a backup? Everything in the app now is replaced (a copy is kept as station-data.before-restore.json).')) return; try { const f = await kivo.backupRestore(); if (f) location.reload(); } catch (e) { bm.textContent = K.cleanErr(e); } }),
      btn(S().backupDir ? 'CHANGE AUTO-BACKUP FOLDER' : 'AUTO-BACKUP TO A FOLDER…', async () => { const d = await kivo.folderPick({ title: 'Back up Kivo Ultron to…' }); if (d) { S().backupDir = d; K.persist(); await autoBackup(true); renderSettings(); } }));
    if (S().backupDir) r5.append(btn('STOP AUTO-BACKUP', () => { S().backupDir = ''; K.persist(); renderSettings(); }, 'mini'));
    box.append(r5, bm);
    // voice
    section(box, 'VOICE', 'Talk to ULTRON with the 🎙 button in Chat. Speech-to-text uses OpenAI (about 0.6p a minute); replies are read out with a Windows voice.');
    const ok = inp('password', '', K.keys.openai ? 'saved · leave blank to keep' : 'sk-… (optional)'); const om = el('div', 'wz-msg');
    const r6 = el('div', 'row'); r6.append(ok, btn('SAVE KEY', async () => { if (!ok.value.trim()) return; await kivo.setKeys({ openai: ok.value.trim() }); K.keys.openai = true; om.textContent = '✅ Saved'; ok.value = ''; }, 'go'));
    const vs = el('select'); const voices = (window.speechSynthesis?.getVoices() || []).filter((v) => /^en/i.test(v.lang)); for (const v of [{ name: '', lang: 'Auto (British)' }, ...voices]) { const o = el('option', '', v.name ? `${v.name} · ${v.lang}` : v.lang); o.value = v.name; vs.append(o); } vs.value = S().voiceName || ''; vs.onchange = () => { S().voiceName = vs.value; K.persist(); speak('ULTRON online.'); };
    const r7 = el('div', 'row wrap'); r7.append(chk('Read every ULTRON reply out loud', !!S().speakAll, (v) => { S().speakAll = v; EX.speakAll = v; K.persist(); }), field('VOICE', vs));
    box.append(r6, om, r7);
    // look & sound
    section(box, 'LOOK & SOUND');
    const vol = el('input'); vol.type = 'range'; vol.min = 0; vol.max = 1; vol.step = 0.05; vol.value = S().volume ?? 0.5; vol.oninput = () => { S().volume = +vol.value; K.persist(); }; vol.onchange = () => sound('chime');
    const r8 = el('div', 'row wrap'); r8.append(chk('Sound effects', S().sounds !== false, (v) => { S().sounds = v; K.persist(); if (v) sound('chime'); }), chk('Keyboard sounds while bots work', S().typing !== false, (v) => { S().typing = v; K.persist(); }), chk('Day / night lighting in the rooms', S().daynight !== false, (v) => { S().daynight = v; window.KIVO_LIGHT = v; K.persist(); }), field('VOLUME', vol));
    box.append(r8);
  }

  // ================= auto backup =================
  async function autoBackup(force) {
    if (!S().backupDir) return;
    if (!force && Date.now() - (S().lastBackup || 0) < 20 * 3600e3) return;
    try { const f = await kivo.backupTo({ dir: S().backupDir }); if (f) { S().lastBackup = Date.now(); K.persist(); K.log('ultron', 'Backed up to ' + f, 'ok'); } }
    catch (e) { K.log('ultron', 'Backup failed: ' + K.cleanErr(e), 'err'); }
  }

  async function init() {
    lic = await kivo.licGet(); mail = await kivo.mailStatus(); tg = await kivo.tgStatus();
    EX.mailOn = mail.on; EX.speakAll = !!S().speakAll; window.KIVO_LIGHT = S().daynight !== false;
    kivo.onTg?.(onTg);
    renderLicBadge();
    $('#pro-badge')?.addEventListener('click', () => (pro() ? null : lock('Unlock everything in Kivo Ultron.')));
    $('#chat-mic')?.addEventListener('click', micToggle);
    $('#lock-close').onclick = () => ($('#lock').hidden = true);
    $('#lock-buy').onclick = () => kivo.openUrl(BUY_URL);
    $('#lock-go').onclick = () => activate($('#lock-key').value, $('#lock-msg'));
    $('#lock-key').onkeydown = (e) => { if (e.key === 'Enter') $('#lock-go').click(); };
    $('#btn-settings').addEventListener('click', () => setTimeout(renderSettings, 0));
    setInterval(autoBackup, 30 * 60e3); setTimeout(autoBackup, 15000);
    speechSynthesis?.getVoices();
  }
  const EX = window.EX = { init, sound, speak, askApproval, phoneDone, onNotify, allow, get pro() { return pro(); }, mailOn: false, speakAll: false, openSettings: () => $('#btn-settings').click(), renderSettings };
})();
