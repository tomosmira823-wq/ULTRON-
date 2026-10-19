// Kivo Station — main process
const { app, BrowserWindow, ipcMain, dialog, shell, safeStorage } = require('electron');
const path = require('path');
const fs = require('fs');
const { autoUpdater } = require('electron-updater');

let win;
const DATA = () => path.join(app.getPath('userData'), 'station-data.json');
const KEYS = () => path.join(app.getPath('userData'), 'keys.bin');

function readData() {
  try { return JSON.parse(fs.readFileSync(DATA(), 'utf8')); } catch { return {}; }
}
function writeData(d) {
  fs.mkdirSync(path.dirname(DATA()), { recursive: true });
  const tmp = DATA() + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(d));
  fs.renameSync(tmp, DATA());
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

function createWindow() {
  win = new BrowserWindow({
    width: 1560, height: 940, minWidth: 1100, minHeight: 700,
    frame: false, backgroundColor: '#0b0d0c', show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => { win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.on('maximize', () => win.webContents.send('win:state', true));
  win.on('unmaximize', () => win.webContents.send('win:state', false));
}

app.whenReady().then(() => {
  createWindow();
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
ipcMain.on('update:install', () => autoUpdater.quitAndInstall());
ipcMain.handle('app:version', () => app.getVersion());
app.on('window-all-closed', () => app.quit());

// window controls
ipcMain.on('win:min', () => win.minimize());
ipcMain.on('win:max', () => (win.isMaximized() ? win.unmaximize() : win.maximize()));
ipcMain.on('win:close', () => win.close());

// storage
ipcMain.handle('data:load', () => readData());
ipcMain.handle('data:save', (_e, d) => { writeData(d); return true; });
ipcMain.handle('keys:status', () => { const k = readKeys(); return { anthropic: !!k.anthropic, printify: !!k.printify }; });
ipcMain.handle('keys:set', (_e, patch) => { const k = readKeys(); for (const [a, b] of Object.entries(patch)) { if (b === null) delete k[a]; else if (b) k[a] = b.trim(); } writeKeys(k); return true; });

// Claude
ipcMain.handle('claude:ask', async (_e, { prompt, model, maxTokens }) => {
  const key = readKeys().anthropic;
  if (!key) throw new Error('No Anthropic API key. Add it in Settings.');
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model: model || 'claude-sonnet-5-5', max_tokens: maxTokens || 4000, messages: [{ role: 'user', content: prompt }] }),
  });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((j.error && j.error.message) || `Claude API error ${res.status}`);
  const text = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('');
  return { text, usage: j.usage || {} };
});

// Printify
ipcMain.handle('printify:req', async (_e, { method, url, body }) => {
  const key = readKeys().printify;
  if (!key) throw new Error('No Printify token. Add it in Settings.');
  if (!url.startsWith('/v1/')) throw new Error('Bad Printify path');
  const res = await fetch('https://api.printify.com' + url, {
    method: method || 'GET',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json;charset=utf-8', 'User-Agent': 'KivoStation/1.0' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const txt = await res.text();
  let j; try { j = JSON.parse(txt); } catch { j = txt; }
  if (!res.ok) throw new Error(`Printify ${res.status}: ${typeof j === 'string' ? j.slice(0, 300) : JSON.stringify(j).slice(0, 300)}`);
  return j;
});

// files
ipcMain.handle('file:save', async (_e, { name, data, encoding, filters }) => {
  const r = await dialog.showSaveDialog(win, { defaultPath: name, filters });
  if (r.canceled || !r.filePath) return null;
  fs.writeFileSync(r.filePath, encoding === 'base64' ? Buffer.from(data, 'base64') : data);
  return r.filePath;
});
ipcMain.handle('file:saveDir', async (_e, { files }) => {
  const r = await dialog.showOpenDialog(win, { properties: ['openDirectory', 'createDirectory'], title: 'Choose export folder' });
  if (r.canceled || !r.filePaths[0]) return null;
  for (const f of files) fs.writeFileSync(path.join(r.filePaths[0], f.name), f.encoding === 'base64' ? Buffer.from(f.data, 'base64') : f.data);
  return r.filePaths[0];
});
ipcMain.on('open:url', (_e, url) => { if (/^https:\/\//.test(url)) shell.openExternal(url); });
