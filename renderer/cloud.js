// Kivo Ultron — Cloud Workspace (beta) panel
(() => {
  const $ = (s) => document.querySelector(s);
  const k = window.kivo;
  if (!k || !k.cloudRun) return;

  const PRESETS = [
    { label: 'Blender test clip', text: `Make a 5-second vertical test video (1080x1920 is too slow, use 540x960, 24fps) in Blender:
- A simple cartoon character built from basic shapes (rounded body, head, big eyes) standing on a ground plane, soft studio lighting, a pastel background.
- The character waves one arm and bobs up and down a little; the camera slowly pushes in.
- If I attached a .blend / .glb / .fbx character, use that character instead of building one.
- Render with Cycles on CPU at low samples and encode to H.264 MP4 with ffmpeg.
Save it as /mnt/session/outputs/test-clip.mp4 and also save one still frame as /mnt/session/outputs/frame.png.` },
    { label: 'Caption a video', text: `I attached a video. Burn in large, bold, centred captions (white text, black outline) of what is said, Shorts style, 2-4 words at a time. Use a speech-to-text model you can install with pip (e.g. faster-whisper, small model on CPU). Save the result as /mnt/session/outputs/captioned.mp4.` },
    { label: 'Screenshot a website', text: `Open https://example.com in a headless browser (Playwright Chromium is installed), take a full-page screenshot at phone size (390x844) and desktop size (1440x900), and save them to /mnt/session/outputs/. Then tell me 3 quick things that could be improved on the page.` },
  ];

  let files = []; let runId = null; let lastBlobUrls = [];

  function open() {
    $('#cloud-ov').hidden = false;
    if (!$('#cloud-task').value) $('#cloud-task').value = PRESETS[0].text;
    k.cloudStatus().then((s) => { if (!s.hasKey) state('Add your Claude API key in Settings first.'); }).catch(() => {});
  }
  const close = () => { $('#cloud-ov').hidden = true; };
  const state = (t) => { $('#cloud-state').textContent = t || ''; };
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const size = (n) => n > 1e6 ? (n / 1e6).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1e3)) + ' KB';

  function log(kind, text) {
    const box = $('#cloud-log');
    box.querySelector('.cl-empty')?.remove();
    const last = box.lastElementChild;
    if (kind === 'think' && last?.classList.contains('think')) return;
    const d = document.createElement('div');
    d.className = 'cl ' + kind; d.textContent = text;
    box.appendChild(d);
    if (box.childElementCount > 600) box.firstElementChild.remove();
    box.scrollTop = box.scrollHeight;
  }

  function renderFiles() {
    $('#cloud-files').innerHTML = files.map((f, i) => `<span class="cf">${esc(f.name)} · ${size(f.size)}<button data-i="${i}" title="Remove">✕</button></span>`).join('');
    $('#cloud-files').querySelectorAll('button').forEach((b) => b.onclick = () => { files.splice(+b.dataset.i, 1); renderFiles(); });
  }

  async function showOutputs(list) {
    const box = $('#cloud-out');
    lastBlobUrls.forEach((u) => URL.revokeObjectURL(u)); lastBlobUrls = [];
    if (!list.length) { box.innerHTML = '<div class="cl-empty">No files came back. Check the live log for what happened.</div>'; return; }
    box.innerHTML = '';
    for (const f of list) {
      const card = document.createElement('div'); card.className = 'co';
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      const mime = { mp4: 'video/mp4', webm: 'video/webm', mov: 'video/quicktime', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' }[ext];
      if (mime && f.size < 150e6) {
        try {
          const r = await k.mediaRead(f.path);
          const bin = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0));
          const url = URL.createObjectURL(new Blob([bin], { type: mime })); lastBlobUrls.push(url);
          const el = document.createElement(mime.startsWith('video') ? 'video' : 'img');
          el.src = url; if (el.tagName === 'VIDEO') { el.controls = true; el.loop = true; }
          card.appendChild(el);
        } catch {}
      }
      const row = document.createElement('div'); row.className = 'row';
      row.innerHTML = `<span>${esc(f.name)} · ${size(f.size)}</span>`;
      const b = document.createElement('button'); b.className = 'hw-btn'; b.textContent = 'SHOW IN FOLDER'; b.onclick = () => k.cloudReveal(f.path);
      row.appendChild(b); card.appendChild(row); box.appendChild(card);
    }
  }

  function busy(on) {
    $('#cloud-run').hidden = on; $('#cloud-stop').hidden = !on;
    $('#cloud-attach').disabled = on; $('#cloud-task').disabled = on;
    $('#dept-cloud').classList.toggle('busy', on);
  }

  async function run() {
    const task = $('#cloud-task').value.trim();
    if (!task) return state('Write the job first.');
    runId = 'c' + Date.now();
    $('#cloud-log').innerHTML = ''; $('#cloud-out').innerHTML = '<div class="cl-empty">Waiting for the bot to finish…</div>';
    busy(true); state('Starting…');
    const t0 = Date.now();
    const tick = setInterval(() => { if (runId) state('Running · ' + Math.round((Date.now() - t0) / 1000) + 's'); }, 1000);
    try {
      await k.cloudRun({ id: runId, task, files: files.map((f) => f.path), budgetCents: +$('#cloud-budget').value, model: $('#cloud-model').value || undefined });
    } finally { clearInterval(tick); }
  }

  k.onCloud(async (ev) => {
    if (ev.id !== runId) return;
    if (ev.kind === 'done') {
      busy(false);
      const id = runId; runId = null;
      const cost = ev.cost != null ? ' · cost about $' + ev.cost.toFixed(2) : '';
      const secs = ev.secs != null ? ' · ' + Math.round(ev.secs) + 's of computer time' : '';
      state((ev.stop === 'stopped' ? 'Stopped' : ev.stop === 'error' ? 'Failed' : ev.stop === 'budget_reached' ? 'Hit the budget' : 'Done') + cost + secs);
      await showOutputs(ev.files || []);
      if (ev.files?.length) { window.EX?.sound?.('chime'); k.notify('Cloud job finished', ev.files.length + ' file(s) ready in Kivo'); }
      void id;
      return;
    }
    if (ev.kind === 'session') return log('status', 'Cloud session ' + ev.text);
    log(ev.kind, ev.text);
  });

  document.addEventListener('DOMContentLoaded', init); if (document.readyState !== 'loading') init();
  function init() {
    if (init.done) return; init.done = true;
    $('#dept-cloud').onclick = open;
    $('#cloud-close').onclick = close;
    $('#cloud-run').onclick = run;
    $('#cloud-stop').onclick = () => { if (runId) { state('Stopping…'); k.cloudStop(runId); } };
    $('#cloud-attach').onclick = async () => { const add = await k.cloudPick(); for (const f of add) if (!files.some((x) => x.path === f.path)) files.push(f); renderFiles(); };
    $('#cloud-presets').innerHTML = PRESETS.map((p, i) => `<button class="chip" data-i="${i}">${esc(p.label)}</button>`).join('');
    $('#cloud-presets').querySelectorAll('button').forEach((b) => b.onclick = () => { if (!runId) $('#cloud-task').value = PRESETS[+b.dataset.i].text; });
    $('#cloud-ov').addEventListener('mousedown', (e) => { if (e.target.id === 'cloud-ov' && !runId) close(); });
  }
  window.CLOUD = { open };
})();
