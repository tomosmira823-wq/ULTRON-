// Kivo Ultron — main process
const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage, Tray, Menu, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let win, tray, quitting = false;
const startHidden = process.argv.includes('--hidden');
const DATA = () => path.join(app.getPath('userData'), 'station-data.json');
const KEYS = () => path.join(app.getPath('userData'), 'keys.bin');
const PREFS = () => path.join(app.getPath('userData'), 'prefs.json');

// ---------- storage ----------
function readJSON(f, d) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } }
function writeJSON(f, d) {
  fs.mkdirSync(path.dirname(f), { recursive: true });
  const tmp = f + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d));
  fs.renameSync(tmp, f);
}
function readKeys() {
  try {
    const buf = fs.readFileSync(KEYS());
    const txt = safeStorage.isEncryptionAvailable() ? safeStorage.decryptString(buf) : buf.toString('utf8');
    return JSON.parse(txt);
  } catch { return {}; }
}
function writeKeys(k) {
  const txt = JSON.stringify(k);
  const buf = safeStorage.isEncryptionAvailable() ? safeStorage.encryptString(txt) : Buffer.from(txt, 'utf8');
  fs.mkdirSync(path.dirname(KEYS()), { recursive: true });
  fs.writeFileSync(KEYS(), buf);
}
let prefs = { closeToTray: true, openAtLogin: true };

// ---------- single instance ----------
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
else app.on('second-instance', () => showWindow());

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}

function createWindow() {
  win = new BrowserWindow({
    width: 1560, height: 940, minWidth: 1100, minHeight: 700,
    frame: false, backgroundColor: '#0b0d0c', show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, backgroundThrottling: false },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { if (!startHidden) win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.on('maximize', () => win.webContents.send('win:state', true));
  win.on('unmaximize', () => win.webContents.send('win:state', false));
  win.on('close', (e) => {
    if (!quitting && prefs.closeToTray) {
      e.preventDefault(); win.hide();
      if (!prefs.trayHintShown && Notification.isSupported()) {
        new Notification({ title: 'Kivo Ultron is still running', body: 'The crew keeps working in the tray. Right-click the tray icon to quit.' }).show();
        prefs.trayHintShown = true; writeJSON(PREFS(), prefs);
      }
    }
  });
}

function buildTray() {
  const img = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('Kivo Ultron');
  tray.on('click', showWindow);
  setTrayMenu({ autopilot: false, running: false });
}
function setTrayMenu(st) {
  if (!tray) return;
  tray.setToolTip(`Kivo Ultron — ${st.running ? 'mission running' : st.autopilot ? 'autopilot on' : 'standing by'}`);
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Kivo Ultron', click: showWindow },
    { type: 'separator' },
    { label: st.running ? 'Mission running…' : 'Run mission now', enabled: !st.running, click: () => win.webContents.send('tray:cmd', 'run') },
    { label: st.autopilot ? 'Pause autopilot' : 'Resume autopilot', click: () => win.webContents.send('tray:cmd', 'toggleAuto') },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
}

app.whenReady().then(() => {
  if (!gotLock) return;
  prefs = { ...prefs, ...readJSON(PREFS(), {}) };
  applyLogin();
  createWindow();
  buildTray();
  extras.startTg();
  if (app.isPackaged) {
    autoUpdater.autoDownload = true;
    autoUpdater.autoInstallOnAppQuit = true;
    const send = (st) => win && win.webContents.send('update:state', st);
    autoUpdater.on('update-available', (i) => send({ state: 'available', version: i.version }));
    autoUpdater.on('update-downloaded', (i) => send({ state: 'downloaded', version: i.version }));
    autoUpdater.on('error', () => {});
    const check = () => autoUpdater.checkForUpdates().catch(() => {});
    setTimeout(check, 5000);
    setInterval(check, 60 * 60 * 1000);
  }
});
app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => { if (quitting || !prefs.closeToTray) app.quit(); });

function applyLogin() {
  if (process.platform !== 'win32' || !app.isPackaged) return;
  app.setLoginItemSettings({ openAtLogin: !!prefs.openAtLogin, args: ['--hidden'] });
}

// ---------- window / app ipc ----------
ipcMain.on('win:min', () => win.minimize());
ipcMain.on('win:max', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on('win:close', () => win.close());
ipcMain.on('update:install', () => { quitting = true; autoUpdater.quitAndInstall(); });
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('prefs:get', () => prefs);
ipcMain.handle('prefs:set', (_e, p) => { prefs = { ...prefs, ...p }; writeJSON(PREFS(), prefs); applyLogin(); return prefs; });
ipcMain.on('tray:state', (_e, st) => setTrayMenu(st));
ipcMain.on('notify', (_e, { title, body }) => {
  if (!Notification.isSupported()) return;
  const n = new Notification({ title, body, icon: path.join(__dirname, 'build', 'icon.png') });
  n.on('click', showWindow); n.show();
});

// ---------- storage ipc ----------
ipcMain.handle('data:load', () => readJSON(DATA(), {}));
ipcMain.handle('data:save', (_e, d) => { writeJSON(DATA(), d); return true; });
ipcMain.handle('keys:status', () => { const k = readKeys(); return { anthropic: !!k.anthropic, printify: !!k.printify, openai: !!k.openai }; });
const extras = require('./main-extra')({ app, ipcMain, dialog, getWin: () => win, readKeys, writeKeys, DATA });
ipcMain.handle('keys:set', (_e, patch) => { const k = readKeys(); for (const [a, b] of Object.entries(patch)) { if (b === null) delete k[a]; else if (b) k[a] = b.trim(); } writeKeys(k); return true; });

// ---------- network with retry ----------
const inflight = new Map();
ipcMain.on('claude:cancelAll', () => { for (const ac of inflight.values()) ac.abort(); inflight.clear(); });
ipcMain.on('claude:cancel', (_e, ids) => { for (const id of ids || []) { const ac = inflight.get(id); if (ac) { ac.abort(); inflight.delete(id); } } });
async function fetchRetry(url, opts, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    if (opts.signal?.aborted) throw new Error('ABORTED');
    try {
      const res = await fetch(url, opts);
      if ([429, 500, 502, 503, 504, 529].includes(res.status) && i < tries - 1) {
        const ra = Number(res.headers.get('retry-after'));
        await new Promise((r) => setTimeout(r, (ra > 0 ? ra * 1000 : 0) || 1500 * 2 ** i));
        continue;
      }
      return res;
    } catch (e) { if (e.name === 'AbortError' || opts.signal?.aborted) throw new Error('ABORTED'); last = e; await new Promise((r) => setTimeout(r, 1500 * 2 ** i)); }
  }
  throw last || new Error('Network error');
}

ipcMain.handle('claude:ask', async (e, { prompt, model, maxTokens, key, stream, reqId, images, web }) => {
  const k = key || readKeys().anthropic;
  if (!k) throw new Error('No Anthropic API key. Add it in Settings.');
  const ac = new AbortController(); inflight.set(reqId || Math.random(), ac);
  try {
  const res = await fetchRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST', signal: ac.signal,
    headers: { 'content-type': 'application/json', 'x-api-key': k, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: model || 'claude-sonnet-5-5', max_tokens: maxTokens || 4000, stream: !!stream, ...(web ? { tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: Math.max(1, Math.min(10, Number(web) || 5)) }] } : {}), messages: [{ role: 'user', content: images?.length ? [...images.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.media_type || 'image/jpeg', data: im.data } })), { type: 'text', text: prompt }] : prompt }] }),
  });
  if (!res.ok) {
    const j = await res.json().catch(() => ({}));
    throw new Error((j.error && j.error.message) || `Claude API error ${res.status}`);
  }
  if (!stream) {
    const j = await res.json().catch(() => ({}));
    const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
    return { text, usage: { ...(j.usage || {}), searches: j.usage?.server_tool_use?.web_search_requests || 0 }, stop: j.stop_reason };
  }
  // server-sent events: forward text as it arrives so the agent feed can show it live
  const reader = res.body.getReader(), dec = new TextDecoder();
  let buf = '', text = '', stop = null, pending = '', lastSend = 0, toolBuf = null;
  const usage = { input_tokens: 0, output_tokens: 0, searches: 0 };
  const flush = (force) => {
    if (!pending || (!force && Date.now() - lastSend < 60)) return;
    if (!e.sender.isDestroyed()) e.sender.send('claude:delta', { reqId, delta: pending });
    pending = ''; lastSend = Date.now();
  };
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = chunk.split('\n').find((l) => l.startsWith('data:'));
      if (!line) continue;
      let d; try { d = JSON.parse(line.slice(5).trim()); } catch { continue; }
      if (d.type === 'message_start') usage.input_tokens = d.message?.usage?.input_tokens || 0;
      else if (d.type === 'content_block_delta' && d.delta?.type === 'text_delta') { text += d.delta.text; pending += d.delta.text; flush(false); }
      else if (d.type === 'message_delta') { usage.output_tokens = d.usage?.output_tokens || usage.output_tokens; usage.input_tokens = Math.max(usage.input_tokens, d.usage?.input_tokens || 0); usage.searches = d.usage?.server_tool_use?.web_search_requests || usage.searches; stop = d.delta?.stop_reason || stop; }
      else if (d.type === 'content_block_start' && d.content_block?.type === 'server_tool_use') toolBuf = '';
      else if (d.type === 'content_block_delta' && d.delta?.type === 'input_json_delta' && toolBuf != null) toolBuf += d.delta.partial_json || '';
      else if (d.type === 'content_block_stop' && toolBuf != null) { let q = ''; try { q = JSON.parse(toolBuf || '{}').query || ''; } catch {} toolBuf = null; if (!e.sender.isDestroyed()) e.sender.send('claude:delta', { reqId, delta: '', search: q || 'the web' }); }
      else if (d.type === 'error') throw new Error(d.error?.message || 'Claude stream error');
    }
  }
  flush(true);
  return { text, usage, stop };
  } catch (err) {
    if (err.name === 'AbortError' || ac.signal.aborted) throw new Error('ABORTED');
    throw err;
  } finally { for (const [k, v] of inflight) if (v === ac) inflight.delete(k); }
});

ipcMain.handle('printify:req', async (_e, { method, url, body, key }) => {
  const k = key || readKeys().printify;
  if (!k) throw new Error('No Printify token. Add it in Settings.');
  if (!url.startsWith('/v1/')) throw new Error('Bad Printify path');
  const res = await fetchRetry('https://api.printify.com' + url, {
    method: method || 'GET',
    headers: { Authorization: 'Bearer ' + k, 'Content-Type': 'application/json;charset=utf-8', 'User-Agent': 'KivoUltron/' + app.getVersion() },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let j; try { j = JSON.parse(txt); } catch { j = txt; }
  if (!res.ok) throw new Error(`Printify ${res.status}: ${typeof j === 'string' ? j.slice(0, 300) : JSON.stringify(j).slice(0, 300)}`);
  return j;
});

// ---------- files ----------
ipcMain.handle('file:save', async (_e, { name, data, encoding, filters }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name, filters });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, encoding === 'base64' ? Buffer.from(data, 'base64') : data);
  return r.filePath;
});
ipcMain.handle('file:saveDir', async (_e, { files }) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], title: 'Choose export folder' });
  if (r.canceled || !r.filePaths[0]) return null;
  for (const f of files) fs.writeFileSync(path.join(r.filePaths[0], path.basename(f.name)), f.encoding === 'base64' ? Buffer.from(f.data, 'base64') : f.data);
  return r.filePaths[0];
});
ipcMain.handle('file:open', async (_e, { filters } = {}) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openFile'], filters: filters || [{ name: 'Kivo space', extensions: ['json'] }] });
  if (r.canceled || !r.filePaths[0]) return null;
  const f = r.filePaths[0];
  if (fs.statSync(f).size > 2e6) throw new Error('That file is too big to be a Kivo space.');
  return { name: path.basename(f), text: fs.readFileSync(f, 'utf8') };
});
ipcMain.on('open:url', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });

// ===================== MARKETING: media, video, social =====================
const os = require('os');
const crypto = require('crypto');
const http = require('http');
const { spawn } = require('child_process');
const MEDIA = () => { const d = path.join(app.getPath('userData'), 'media'); fs.mkdirSync(d, { recursive: true }); return d; };
const safeName = (n) => path.basename(String(n)).replace(/[^\w.\-]/g, '_');
const inMedia = (p) => path.resolve(p).startsWith(path.resolve(MEDIA()));
function ffmpegPath() {
  let p = require('ffmpeg-static');
  if (p && p.includes('app.asar')) p = p.replace('app.asar', 'app.asar.unpacked');
  return p;
}
function ffmpeg(args, { timeoutMs = 10 * 60e3 } = {}) {
  return new Promise((resolve, reject) => {
    const pr = spawn(ffmpegPath(), ['-hide_banner', '-y', ...args], { windowsHide: true });
    let err = '';
    pr.stderr.on('data', (d) => { err += d; if (err.length > 200000) err = err.slice(-100000); });
    const to = setTimeout(() => { pr.kill('SIGKILL'); reject(new Error('Video render timed out')); }, timeoutMs);
    pr.on('error', (e) => { clearTimeout(to); reject(e); });
    pr.on('close', (code) => { clearTimeout(to); code === 0 ? resolve(err) : reject(new Error('Video render failed: ' + err.split('\n').filter(Boolean).slice(-3).join(' | '))); });
  });
}
ipcMain.handle('media:save', (_e, { name, data }) => { const f = path.join(MEDIA(), safeName(name)); fs.writeFileSync(f, Buffer.from(data, 'base64')); return f; });
ipcMain.handle('media:read', (_e, file) => { if (!inMedia(file)) throw new Error('Not a Kivo media file'); return { data: fs.readFileSync(file).toString('base64'), size: fs.statSync(file).size }; });
ipcMain.handle('net:image', async (_e, url) => {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !/(^|\.)printify\.com$|(^|\.)cloudinary\.com$/.test(u.hostname)) throw new Error('Image host not allowed');
  const r = await fetch(url); if (!r.ok) throw new Error('Image fetch ' + r.status);
  return { type: r.headers.get('content-type') || 'image/jpeg', data: Buffer.from(await r.arrayBuffer()).toString('base64') };
});
// slideshow: still frames → 1080x1920 H.264 MP4 with a gentle push-in and crossfades
ipcMain.handle('video:slides', async (_e, { name, slides }) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kivo-'));
  try {
    const fps = 30, xf = 0.35, args = [], filters = [];
    slides.forEach((s, i) => { const f = path.join(dir, `s${i}.jpg`); fs.writeFileSync(f, Buffer.from(s.data, 'base64')); args.push('-loop', '1', '-t', String(s.dur), '-i', f); });
    slides.forEach((s, i) => {
      const frames = Math.round(s.dur * fps);
      filters.push(`[${i}:v]scale=1188:2112,zoompan=z='min(zoom+0.0009,1.1)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=1080x1920:fps=${fps},setsar=1,format=yuv420p[v${i}]`);
    });
    let last = 'v0', t = slides[0].dur;
    for (let i = 1; i < slides.length; i++) { const out = i === slides.length - 1 ? 'vout' : `x${i}`; filters.push(`[${last}][v${i}]xfade=transition=fade:duration=${xf}:offset=${(t - xf).toFixed(2)}[${out}]`); last = out; t += slides[i].dur - xf; }
    if (slides.length === 1) filters.push('[v0]null[vout]');
    const out = path.join(MEDIA(), safeName(name));
    await ffmpeg([...args, '-f', 'lavfi', '-t', String(t.toFixed(2)), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
      '-filter_complex', filters.join(';'), '-map', '[vout]', '-map', `${slides.length}:a`, '-c:v', 'libx264', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(fps), '-g', String(fps * 2),
      '-b:v', '6M', '-maxrate', '8M', '-bufsize', '12M', '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', out]);
    return out;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
ipcMain.handle('video:pick', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Choose your footage', properties: ['openFile', 'multiSelections'], filters: [{ name: 'Video', extensions: ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv'] }] });
  return r.canceled ? [] : r.filePaths;
});
async function probeDuration(file) {
  const out = await ffmpeg(['-i', file, '-f', 'null', '-t', '0.01', '-']).catch((e) => String(e.message));
  const m = String(out).match(/Duration: (\d+):(\d+):([\d.]+)/);
  return m ? (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]) : 0;
}
ipcMain.handle('video:frames', async (_e, { path: file, count = 16 }) => {
  if (!fs.existsSync(file)) throw new Error('File not found');
  const duration = await probeDuration(file);
  if (!duration) throw new Error('Couldn’t read that video');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kivo-f-'));
  try {
    const n = Math.max(4, Math.min(count, Math.floor(duration * 2))), frames = [];
    for (let i = 0; i < n; i++) {
      const t = Math.min(duration - 0.05, (duration * (i + 0.5)) / n), f = path.join(dir, `f${i}.jpg`);
      await ffmpeg(['-ss', t.toFixed(2), '-i', file, '-frames:v', '1', '-vf', 'scale=384:-2', '-q:v', '5', f]);
      if (fs.existsSync(f)) frames.push({ t, data: fs.readFileSync(f).toString('base64') });
    }
    return { duration, frames };
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});
// cut chosen segments, crop to 9:16, burn text overlays, join with audio
ipcMain.handle('video:edit', async (_e, { path: file, name, segments }) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'kivo-e-'));
  try {
    const parts = [];
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i], ov = path.join(dir, `o${i}.png`), part = path.join(dir, `p${i}.mp4`);
      fs.writeFileSync(ov, Buffer.from(s.overlay, 'base64'));
      await ffmpeg(['-ss', String(s.start), '-t', String(Math.max(0.5, s.end - s.start)), '-i', file, '-i', ov, '-f', 'lavfi', '-t', String(Math.max(0.5, s.end - s.start)), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-filter_complex', "[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[b];[b][1:v]overlay=0:0,format=yuv420p[v];[0:a]aresample=44100,aformat=channel_layouts=stereo[a0];[a0][2:a]amix=inputs=2:duration=first[a]",
        '-map', '[v]', '-map', '[a]', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k', '-shortest', part])
        .catch(() => ffmpeg(['-ss', String(s.start), '-t', String(Math.max(0.5, s.end - s.start)), '-i', file, '-i', ov, '-f', 'lavfi', '-t', String(Math.max(0.5, s.end - s.start)), '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
          '-filter_complex', '[0:v]scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920,setsar=1,fps=30[b];[b][1:v]overlay=0:0,format=yuv420p[v]',
          '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-c:a', 'aac', '-b:a', '128k', '-shortest', part])); // clips with no audio track
      parts.push(part);
    }
    const list = path.join(dir, 'list.txt');
    fs.writeFileSync(list, parts.map((p) => `file '${p.replace(/\\/g, '/').replace(/'/g, "'\\''")}'`).join('\n'));
    const out = path.join(MEDIA(), safeName(name));
    await ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '20', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-movflags', '+faststart', out]);
    return out;
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

// ---- social accounts: stored encrypted alongside the API keys ----
ipcMain.handle('social:get', () => readKeys().social || {});
ipcMain.handle('social:set', (_e, patch) => { const k = readKeys(); k.social = { ...(k.social || {}), ...patch }; for (const [a, b] of Object.entries(patch)) if (b === null) delete k.social[a]; writeKeys(k); return k.social; });

// ---- OAuth: open the browser, catch the redirect on a local port ----
const OAUTH_PORT = 53682;
let activeOauth = null;
ipcMain.handle('oauth:start', async (_e, { authUrl, state, timeoutMs = 5 * 60e3 }) => {
  if (activeOauth) { await activeOauth.close(); activeOauth = null; }
  return new Promise((resolve, reject) => {
    let done = false;
    const handler = (req, res) => {
      const u = new URL(req.url, `http://127.0.0.1:${OAUTH_PORT}`);
      if (!u.pathname.startsWith('/callback')) { res.writeHead(404); res.end(); return; }
      const q = Object.fromEntries(u.searchParams);
      const ok = q.state === state && (q.code || q.error);
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8', Connection: 'close' });
      res.end(`<!doctype html><meta charset="utf-8"><title>Kivo Ultron</title><body style="font:16px system-ui;background:#0b0d0c;color:#c9f7dc;display:grid;place-items:center;height:100vh;margin:0"><div><h2 style="color:#46ff9a">${ok && q.code ? 'Connected ✓' : 'Something went wrong'}</h2><p>${ok && q.code ? 'You can close this tab and go back to Kivo Ultron.' : 'Go back to Kivo Ultron and try again.'}</p></div></body>`);
      if (!ok || done) return;
      done = true; clearTimeout(to); session.close(); showWindow();
      q.error ? reject(new Error(q.error_description || q.error)) : resolve(q);
    };
    // listen on IPv4 and IPv6 loopback so both 127.0.0.1 and localhost redirects arrive
    const srv = http.createServer(handler), srv6 = http.createServer(handler);
    const close = () => new Promise((r) => { let n = 0; const fin = () => (++n === 2 ? r() : 0);
      for (const x of [srv, srv6]) { try { x.closeAllConnections?.(); if (x.listening) x.close(fin); else fin(); } catch { fin(); } } });
    const session = { close }; activeOauth = session;
    const to = setTimeout(() => { if (done) return; done = true; close(); reject(new Error('Sign-in timed out — try again.')); }, timeoutMs);
    srv6.on('error', () => {});
    let tries = 0;
    const listen = () => srv.listen(OAUTH_PORT, '127.0.0.1');
    srv.on('error', (e) => {
      if (e.code === 'EADDRINUSE' && tries++ < 10) return setTimeout(listen, 300);
      clearTimeout(to); done = true; close();
      reject(new Error(e.code === 'EADDRINUSE' ? `Port ${OAUTH_PORT} is in use by another program — close it and retry.` : e.message));
    });
    srv.on('listening', () => { try { srv6.listen(OAUTH_PORT, '::1'); } catch {} shell.openExternal(authUrl); });
    listen();
  });
});
ipcMain.handle('oauth:pkce', () => {
  const verifier = crypto.randomBytes(48).toString('base64url').slice(0, 64);
  return { verifier, hex: crypto.createHash('sha256').update(verifier).digest('hex'), b64url: crypto.createHash('sha256').update(verifier).digest('base64url'), state: crypto.randomBytes(12).toString('hex') };
});

// ---- social API proxy (only these hosts) ----
const SOCIAL_HOSTS = /(^|\.)(graph\.instagram\.com|api\.instagram\.com|graph\.facebook\.com|open\.tiktokapis\.com|open-upload\.tiktokapis\.com|api\.pinterest\.com|api\.cloudinary\.com)$/;
ipcMain.handle('social:req', async (_e, { url, method = 'GET', headers = {}, json, form, filePath, range }) => {
  const u = new URL(url);
  if (u.protocol !== 'https:' || !SOCIAL_HOSTS.test(u.hostname)) throw new Error('Host not allowed: ' + u.hostname);
  let body;
  if (json !== undefined) { body = JSON.stringify(json); headers['Content-Type'] = headers['Content-Type'] || 'application/json; charset=UTF-8'; }
  else if (form) { body = new URLSearchParams(form).toString(); headers['Content-Type'] = 'application/x-www-form-urlencoded'; }
  else if (filePath) {
    if (!inMedia(filePath)) throw new Error('Not a Kivo media file');
    const buf = fs.readFileSync(filePath);
    body = range ? buf.subarray(range[0], range[1] + 1) : buf;
  }
  const res = await fetchRetry(url, { method, headers, body }, 3);
  const txt = await res.text(); let data; try { data = JSON.parse(txt); } catch { data = txt; }
  return { status: res.status, ok: res.ok, data };
});
// Cloudinary unsigned upload → public https URL (Instagram needs one)
ipcMain.handle('social:host', async (_e, { cloud, preset, filePath, resource = 'auto' }) => {
  if (!inMedia(filePath)) throw new Error('Not a Kivo media file');
  const fd = new FormData();
  fd.append('file', new Blob([fs.readFileSync(filePath)]), path.basename(filePath));
  fd.append('upload_preset', preset);
  const res = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/${resource}/upload`, { method: 'POST', body: fd });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error('Media host: ' + (j.error?.message || res.status));
  return { url: j.secure_url, publicId: j.public_id, bytes: j.bytes };
});
ipcMain.handle('media:size', (_e, file) => { if (!inMedia(file)) throw new Error('Not a Kivo media file'); return fs.statSync(file).size; });
