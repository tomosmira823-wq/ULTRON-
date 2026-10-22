// Kivo Ultron — Cloud Workspace (beta): bots that get their own Linux computer in Anthropic's cloud
// Uses Claude Managed Agents. Nothing runs on the user's PC; finished files come back into Kivo's media folder.
const path = require('path');
const fs = require('fs');

const API = 'https://api.anthropic.com';
const BETA = 'managed-agents-2026-04-01';
const FILES_BETA = 'files-api-2025-04-14';
const CLOUD_V = 1; // bump when the agent/environment setup below changes

const SYSTEM = `You are a Kivo Ultron cloud worker. You have your own Linux computer (Ubuntu) with a shell, files, Python, Node, ffmpeg and Blender installed.
Rules:
- Files the user attached are in /mnt/session/uploads/.
- Put EVERY finished file the user should get back in /mnt/session/outputs/ (videos as .mp4, images as .png). Only finished results go there, not scratch files.
- Work efficiently: this is billed per use. For 3D renders use Blender in background mode (blender -b -P script.py) with the Cycles engine on CPU (no GPU), low samples (8-16) and modest resolution unless told otherwise. Check render time on one frame before rendering the whole clip.
- If something can't be done (missing tool, too slow), say so plainly instead of faking a result.
- When finished, reply with a short plain-English summary: what you made, the file names, and anything the user should know.`;

module.exports = function cloud({ app, ipcMain, dialog, getWin, readKeys, writeKeys, mediaDir }) {
  const send = (v) => { const w = getWin(); if (w && !w.isDestroyed()) w.webContents.send('cloud:ev', v); };
  const key = () => { const k = readKeys().anthropic; if (!k) throw new Error('Add your Claude API key in Settings first.'); return k; };
  const H = (extra = {}) => ({ 'x-api-key': key(), 'anthropic-version': '2023-06-01', 'anthropic-beta': BETA, ...extra });

  async function api(method, p, body, beta) {
    const res = await fetch(API + p, { method, headers: H({ ...(body ? { 'content-type': 'application/json' } : {}), ...(beta ? { 'anthropic-beta': beta } : {}) }), body: body ? JSON.stringify(body) : undefined });
    const txt = await res.text();
    let j = {}; try { j = txt ? JSON.parse(txt) : {}; } catch {}
    if (!res.ok) {
      const msg = j.error?.message || txt.slice(0, 300) || res.statusText;
      if (res.status === 401) throw new Error('Claude rejected your API key.');
      if (res.status === 403 || res.status === 404) throw new Error(`Cloud workspaces aren’t switched on for this Claude account yet (${res.status}: ${msg}).`);
      throw new Error(`Cloud error ${res.status}: ${msg}`);
    }
    return j;
  }

  // one agent + one environment per install, re-made when CLOUD_V changes
  async function ensureSetup() {
    const k = readKeys();
    const c = k.cloud || {};
    if (c.v === CLOUD_V && c.agentId && c.envId) return c;
    const env = await api('POST', '/v1/environments', {
      name: 'kivo-cloud-v' + CLOUD_V + '-' + Date.now().toString(36),
      config: { type: 'cloud', packages: { apt: ['blender'] }, networking: { type: 'limited', allow_package_managers: true } },
    });
    const agent = await api('POST', '/v1/agents', {
      name: 'Kivo Cloud Worker v' + CLOUD_V,
      model: 'claude-sonnet-5-5',
      system: SYSTEM,
      tools: [{ type: 'agent_toolset_20260401', default_config: { permission_policy: { type: 'always_allow' } } }],
    });
    const k2 = readKeys(); k2.cloud = { v: CLOUD_V, agentId: agent.id, envId: env.id }; writeKeys(k2);
    return k2.cloud;
  }

  async function uploadFile(f) {
    const st = fs.statSync(f);
    if (st.size > 300e6) throw new Error(path.basename(f) + ' is over 300 MB.');
    const fd = new FormData();
    fd.append('file', new Blob([fs.readFileSync(f)]), path.basename(f));
    const res = await fetch(API + '/v1/files', { method: 'POST', headers: H({ 'anthropic-beta': FILES_BETA }), body: fd });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error('Upload failed for ' + path.basename(f) + ': ' + (j.error?.message || res.status));
    return j.id;
  }

  // ---- event stream (SSE) ----
  async function streamEvents(run, onEvent) {
    const res = await fetch(API + `/v1/sessions/${run.session}/events/stream`, { headers: H({ accept: 'text/event-stream' }), signal: run.ctl.signal });
    if (!res.ok) throw new Error('Couldn’t open the live feed (' + res.status + ')');
    const reader = res.body.getReader(); const dec = new TextDecoder(); let buf = '';
    for (;;) {
      const { value, done } = await reader.read();
      if (done) return;
      buf += dec.decode(value, { stream: true });
      let i;
      while ((i = buf.indexOf('\n\n')) >= 0) {
        const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
        const data = chunk.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('\n');
        if (!data) continue;
        let ev; try { ev = JSON.parse(data); } catch { continue; }
        if (await onEvent(ev)) { try { reader.cancel(); } catch {} return true; }
      }
    }
  }

  const short = (s, n = 400) => { s = String(s || ''); return s.length > n ? s.slice(0, n) + '…' : s; };
  function describeTool(ev) {
    const i = ev.input || {};
    if (i.command) return '$ ' + short(i.command, 300);
    if (i.file_path) return (ev.name || 'file') + ' ' + i.file_path;
    if (i.url) return (ev.name || 'web') + ' ' + i.url;
    if (i.query) return (ev.name || 'search') + ' “' + short(i.query, 120) + '”';
    return ev.name || 'tool';
  }

  async function collectOutputs(run) {
    const dir = path.join(mediaDir(), 'cloud', run.session.replace(/[^\w-]/g, ''));
    fs.mkdirSync(dir, { recursive: true });
    let files = [];
    for (let t = 0; t < (run.stopped ? 1 : 6); t++) {
      const j = await api('GET', `/v1/files?scope_id=${encodeURIComponent(run.session)}&limit=100`, null, `${FILES_BETA},${BETA}`).catch(() => ({ data: [] }));
      files = j.data || [];
      if (files.length) break;
      await new Promise((r) => setTimeout(r, 4000));
    }
    const out = [];
    for (const f of files) {
      if (run.uploaded.includes(f.id)) continue;
      const name = path.basename(String(f.filename || f.id)).replace(/[^\w.\-]/g, '_');
      send({ id: run.id, kind: 'status', text: 'Downloading ' + name + '…' });
      const res = await fetch(API + `/v1/files/${f.id}/content`, { headers: H({ 'anthropic-beta': `${FILES_BETA},${BETA}` }) });
      if (!res.ok) { send({ id: run.id, kind: 'error', text: 'Couldn’t download ' + name + ' (' + res.status + ')' }); continue; }
      const p = path.join(dir, name);
      fs.writeFileSync(p, Buffer.from(await res.arrayBuffer()));
      out.push({ path: p, name, size: fs.statSync(p).size });
    }
    return out;
  }

  const runs = new Map();

  ipcMain.handle('cloud:pick', async () => {
    const r = await dialog.showOpenDialog(getWin(), { properties: ['openFile', 'multiSelections'], title: 'Give the cloud worker some files' });
    return r.canceled ? [] : r.filePaths.map((p) => ({ path: p, name: path.basename(p), size: fs.statSync(p).size }));
  });

  ipcMain.handle('cloud:status', () => { const c = readKeys().cloud || {}; return { ready: c.v === CLOUD_V && !!c.agentId, hasKey: !!readKeys().anthropic }; });
  ipcMain.handle('cloud:reset', () => { const k = readKeys(); delete k.cloud; writeKeys(k); return true; });

  ipcMain.handle('cloud:run', async (_e, { id, task, files = [], budgetCents = 200, model }) => {
    const run = { id, session: '', ctl: new AbortController(), uploaded: [], seen: new Set(), done: false, stopped: false };
    runs.set(id, run);
    try {
      send({ id, kind: 'status', text: 'Getting your cloud computer ready…' });
      const c = await ensureSetup();
      const resources = [];
      for (const f of files) {
        send({ id, kind: 'status', text: 'Uploading ' + path.basename(f) + '…' });
        const fid = await uploadFile(f); run.uploaded.push(fid);
        resources.push({ type: 'file', file_id: fid, mount_path: '/' + path.basename(f).replace(/[^\w.\-]/g, '_') });
      }
      const cents = String(Math.max(25, Math.min(2000, Math.round(Number(budgetCents) || 200))));
      const sess = await api('POST', '/v1/sessions', {
        agent: model ? { type: 'agent_with_overrides', id: c.agentId, model } : c.agentId,
        environment_id: c.envId,
        title: 'Kivo: ' + short(task, 60),
        budget: { type: 'limit', max_list_cost: { amount: cents, currency: 'USD' } },
        ...(resources.length ? { resources } : {}),
      });
      run.session = sess.id;
      send({ id, kind: 'session', text: sess.id });
      send({ id, kind: 'status', text: 'Computer booting (first run installs Blender, this can take a few minutes)…' });

      let stop = null; let sent = false;
      const onEvent = async (ev) => {
        if (ev.id && run.seen.has(ev.id)) return false;
        if (ev.id) run.seen.add(ev.id);
        switch (ev.type) {
          case 'agent.message': {
            const t = (ev.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
            if (t) send({ id, kind: 'say', text: t });
            break;
          }
          case 'agent.thinking': send({ id, kind: 'think', text: 'Thinking…' }); break;
          case 'agent.tool_use': case 'agent.mcp_tool_use': send({ id, kind: 'tool', text: describeTool(ev) }); break;
          case 'agent.tool_result': {
            const t = (ev.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
            send({ id, kind: ev.is_error ? 'toolerr' : 'out', text: short(t, 600) });
            break;
          }
          case 'session.status_running': send({ id, kind: 'status', text: 'Working…' }); break;
          case 'session.error': send({ id, kind: 'error', text: ev.error?.message || 'Cloud error' }); break;
          case 'session.status_terminated': stop = { type: 'terminated' }; return true;
          case 'session.status_idle': {
            const r = ev.stop_reason || {};
            if (r.type === 'requires_action' && Array.isArray(r.event_ids)) {
              await api('POST', `/v1/sessions/${run.session}/events`, { events: r.event_ids.map((eid) => ({ type: 'user.tool_confirmation', tool_use_id: eid, result: 'allow' })) }).catch(() => {});
              return false;
            }
            if (!sent) return false; // idle from before our message
            stop = r; return true;
          }
        }
        return false;
      };

      // open the feed, then send the job
      for (let attempt = 0; !stop && !run.stopped && attempt < 30; attempt++) {
        const streaming = streamEvents(run, onEvent);
        if (!sent) {
          await new Promise((r) => setTimeout(r, 600));
          await api('POST', `/v1/sessions/${run.session}/events`, { events: [{ type: 'user.message', content: [{ type: 'text', text: String(task) }] }] });
          sent = true;
        }
        try { await streaming; } catch (e) { if (run.stopped) break; send({ id, kind: 'status', text: 'Feed dropped, reconnecting…' }); }
        if (stop || run.stopped) break;
        const s = await api('GET', `/v1/sessions/${run.session}`).catch(() => null);
        if (s && /terminated/.test(s.status || '')) { stop = { type: 'terminated' }; break; }
        await new Promise((r) => setTimeout(r, 1500));
      }

      if (stop?.type === 'budget_reached') send({ id, kind: 'error', text: `Stopped: it hit your $${(cents / 100).toFixed(2)} budget for this job.` });
      send({ id, kind: 'status', text: 'Collecting the finished files…' });
      const outputs = await collectOutputs(run);
      const fin = await api('GET', `/v1/sessions/${run.session}`).catch(() => null);
      const lc = fin?.usage?.list_cost; const cost = lc && lc.currency === 'USD' ? Number(lc.amount) / 100 : null;
      send({ id, kind: 'done', files: outputs, cost, secs: fin?.stats?.active_seconds ?? null, stop: stop?.type || (run.stopped ? 'stopped' : 'unknown') });
      api('POST', `/v1/sessions/${run.session}/archive`).catch(() => {});
      return { ok: true, files: outputs };
    } catch (e) {
      if (run.stopped) { send({ id, kind: 'done', files: [], stop: 'stopped' }); return { ok: false, stopped: true }; }
      send({ id, kind: 'error', text: String(e.message || e) });
      send({ id, kind: 'done', files: [], stop: 'error' });
      return { ok: false, error: String(e.message || e) };
    } finally { runs.delete(id); }
  });

  ipcMain.handle('cloud:stop', async (_e, id) => {
    const run = runs.get(id); if (!run) return false;
    run.stopped = true;
    if (run.session) await api('POST', `/v1/sessions/${run.session}/events`, { events: [{ type: 'user.interrupt' }] }).catch(() => {});
    try { run.ctl.abort(); } catch {}
    return true;
  });

  ipcMain.handle('cloud:reveal', (_e, p) => {
    if (!path.resolve(p).startsWith(path.resolve(mediaDir()))) return false;
    require('electron').shell.showItemInFolder(p); return true;
  });
};
