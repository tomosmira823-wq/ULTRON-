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
ipcMain.handle('keys:status', () => { const k = readKeys(); return { anthropic: !!k.anthropic, printify: !!k.printify }; });
ipcMain.handle('keys:set', (_e, patch) => { const k = readKeys(); for (const [a, b] of Object.entries(patch)) { if (b === null) delete k[a]; else if (b) k[a] = b.trim(); } writeKeys(k); return true; });

// ---------- network with retry ----------
async function fetchRetry(url, opts, tries = 4) {
  let last;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url, opts);
      if ([429, 500, 502, 503, 504, 529].includes(res.status) && i < tries - 1) {
        const ra = Number(res.headers.get('retry-after'));
        await new Promise((r) => setTimeout(r, (ra > 0 ? ra * 1000 : 0) || 1500 * 2 ** i));
        continue;
      }
      return res;
    } catch (e) { last = e; await new Promise((r) => setTimeout(r, 1500 * 2 ** i)); }
  }
  throw last || new Error('Network error');
}

ipcMain.handle('claude:ask', async (_e, { prompt, model, maxTokens, key }) => {
  const k = key || readKeys().anthropic;
  if (!k) throw new Error('No Anthropic API key. Add it in Settings.');
  const res = await fetchRetry('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': k, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: model || 'claude-sonnet-5-5', max_tokens: maxTokens || 4000, messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.error && j.error.message) || `Claude API error ${res.status}`);
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  return { text, usage: j.usage || {}, stop: j.stop_reason };
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
ipcMain.on('open:url', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
