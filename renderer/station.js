// Kivo Ultron — station renderer: rooms, agent characters, ULTRON hologram, commander core
(function () {
  const W = 960, H = 540;
  const C = { g: '#46ff9a', gd: '#1d7a48', warn: '#ffc247', bad: '#ff5a4f', info: '#5ac8ff' };

  // rooms (logical px). path = corridor route from the room to ULTRON's core.
  const ROOMS = {
    scout:   { x: 40,  y: 30,  w: 210, h: 125, color: '#5ac8ff', desk: [0.72, 0.42], path: [[145, 92], [145, 172], [480, 172], [480, 272]] },
    analyst: { x: 375, y: 22,  w: 210, h: 105, color: '#c38bff', desk: [0.5, 0.48],  path: [[480, 75], [480, 272]] },
    scribe:  { x: 710, y: 30,  w: 210, h: 125, color: '#ffd36b', desk: [0.3, 0.52],  path: [[815, 92], [815, 172], [480, 172], [480, 272]] },
    forge:   { x: 40,  y: 215, w: 225, h: 160, color: '#ff8a5a', desk: [0.5, 0.52],  path: [[152, 300], [480, 300], [480, 272]] },
    ultron:  { x: 365, y: 185, w: 230, h: 175, color: '#46ff9a', desk: [0.5, 0.5],   path: [[480, 272]] },
    auditor: { x: 695, y: 215, w: 225, h: 150, color: '#ff6b8b', desk: [0.5, 0.62],  path: [[807, 290], [480, 290], [480, 272]] },
    ledger:  { x: 225, y: 420, w: 195, h: 95,  color: '#b6ff5a', desk: [0.75, 0.62], path: [[322, 467], [322, 390], [450, 390], [450, 272]] },
    courier: { x: 540, y: 415, w: 225, h: 100, color: '#7ee8ff', desk: [0.25, 0.55], path: [[652, 465], [652, 390], [510, 390], [510, 272]] },
  };
  const PS = 1.5; // props were authored at 2/3 scale

  let ctx, canvas, labelsEl, onSelect = () => {};
  const state = {};
  const packets = [];
  let stars = [], t = 0, last = 0, selected = null, shuttle = { phase: 'docked', t: 0, x: 0 }, ship = null, view = { s: 1, ox: 0, oy: 0 };
  const ultron = { point: null, pointT: 0, talk: 0 };
  // camera: world point at screen centre + zoom
  const cam = { x: W / 2, y: H / 2, z: 1 }, camT = { x: W / 2, y: H / 2, z: 1 };
  let focused = null;
  const toCss = (wx, wy) => [view.ox + (W / 2 + (wx - cam.x) * cam.z) * view.s, view.oy + (H / 2 + (wy - cam.y) * cam.z) * view.s];

  const rnd = (a, b) => a + Math.random() * (b - a);
  function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

  function init(cv, lbl, cb) {
    canvas = cv;
    ctx = cv.getContext('2d'); labelsEl = lbl; onSelect = cb || onSelect;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 420; i++) stars.push({ x: Math.random(), y: Math.random(), s: Math.random() < 0.1 ? 2 : 1, p: rnd(0, 6.28), v: rnd(1, 5) });
    for (const [id, r] of Object.entries(ROOMS)) {
      const s = state[id] = { busy: false, err: false, text: '', crew: [] };
      if (id !== 'ultron') {
        s.lead = { x: r.x + r.w * 0.4, y: r.y + r.h * 0.7, tx: 0, ty: 0, wait: rnd(0, 2), step: 0, face: 1 };
        for (let i = 0; i < 2; i++) s.crew.push({ x: rnd(r.x + 14, r.x + r.w - 14), y: rnd(r.y + 34, r.y + r.h - 10), tx: 0, ty: 0, wait: rnd(0, 3), step: 0 });
      }
      const el = document.createElement('div');
      el.className = 'rlabel'; el.dataset.id = id;
      el.textContent = id.toUpperCase();
      el.addEventListener('click', () => onSelect(id));
      labelsEl.appendChild(el);
      const b = document.createElement('div'); b.className = 'bubble'; b.hidden = true;
      labelsEl.appendChild(b);
      s.el = el; s.bubble = b;
    }
    // scroll to zoom toward the cursor, drag to pan, double-click to reset
    const toWorld = (e) => { const r = canvas.getBoundingClientRect(); return [((e.clientX - r.left - view.ox) / view.s - W / 2) / cam.z + cam.x, ((e.clientY - r.top - view.oy) / view.s - H / 2) / cam.z + cam.y]; };
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const [wx, wy] = toWorld(e), z0 = camT.z, z1 = Math.max(1, Math.min(4, z0 * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
      camT.x = wx - (wx - camT.x) * z0 / z1; camT.y = wy - (wy - camT.y) * z0 / z1; camT.z = z1;
      if (z1 === 1 && !focused) { camT.x = W / 2; camT.y = H / 2; }
      clampCam();
    }, { passive: false });
    let drag = null;
    canvas.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; });
    window.addEventListener('mousemove', (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
      if (!drag.moved) return;
      camT.x -= dx / view.s / camT.z; camT.y -= dy / view.s / camT.z; cam.x = camT.x; cam.y = camT.y;
      drag.x = e.clientX; drag.y = e.clientY; clampCam(); canvas.style.cursor = 'grabbing';
    });
    window.addEventListener('mouseup', () => { if (drag) setTimeout(() => (drag = null), 0); canvas.style.cursor = ''; });
    canvas.addEventListener('dblclick', () => { if (focused) onSelect(null); else Object.assign(camT, { x: W / 2, y: H / 2, z: 1 }); });
    canvas.addEventListener('click', (e) => {
      if (drag?.moved) return;
      const r = canvas.getBoundingClientRect();
      const x = ((e.clientX - r.left - view.ox) / view.s - W / 2) / cam.z + cam.x, y = ((e.clientY - r.top - view.oy) / view.s - H / 2) / cam.z + cam.y;
      for (const [id, room] of Object.entries(ROOMS)) if (x >= room.x && x <= room.x + room.w && y >= room.y && y <= room.y + room.h) { onSelect(id); return; }
      if (focused) onSelect(null);
    });
    new ResizeObserver(placeLabels).observe(canvas);
    placeLabels();
    requestAnimationFrame(loop);
  }

  // the canvas always matches its box, so space fills the whole panel and the station is fitted inside it
  function placeLabels() {
    const r = canvas.getBoundingClientRect();
    const cw = Math.max(1, Math.round(r.width)), ch = Math.max(1, Math.round(r.height));
    if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; ctx.imageSmoothingEnabled = false; }
    view.s = Math.min(cw / W, ch / (H + 16));
    view.ox = (cw - W * view.s) / 2; view.oy = (ch - H * view.s) / 2;
    moveLabels();
  }
  function moveLabels() {
    for (const [id, room] of Object.entries(ROOMS)) {
      const el = state[id].el, [lx, ly] = toCss(room.x + room.w / 2, room.y);
      el.style.left = lx + 'px'; el.style.top = (ly - 2) + 'px';
      el.classList.toggle('dim', !!focused && focused !== id);
      el.classList.toggle('focus', focused === id);
    }
  }
  function placeBubble(id, x, y) {
    const b = state[id].bubble, [bx, by] = toCss(x, y);
    b.style.left = bx + 'px'; b.style.top = by + 'px';
    b.classList.toggle('dim', !!focused && focused !== id);
  }
  function clampCam() { const m = 260; camT.x = Math.max(-m, Math.min(W + m, camT.x)); camT.y = Math.max(-m, Math.min(H + m, camT.y)); }
  // zoom the camera onto a room (null = whole station). panelFrac = share of the view covered by the feed panel on the right
  function focus(id, panelFrac = 0.46) {
    focused = ROOMS[id] ? id : null;
    if (!focused) { Object.assign(camT, { x: W / 2, y: H / 2, z: 1 }); return; }
    const r = ROOMS[focused];
    const z = Math.min((W * (1 - panelFrac) * 0.86) / r.w, (H * 0.8) / r.h, 3.2);
    Object.assign(camT, { z, x: r.x + r.w / 2 + (W * panelFrac / 2) / z, y: r.y + r.h / 2 + 6 / z });
  }

  function setBusy(id, busy, text, err) {
    const s = state[id]; if (!s) return;
    s.busy = !!busy; s.err = !!err; s.text = text || '';
    s.el.classList.toggle('busy', s.busy);
    s.el.classList.toggle('err', s.err);
    s.bubble.textContent = s.text;
    s.bubble.hidden = !(s.busy && s.text);
    s.bubble.classList.toggle('core', id === 'ultron');
    if (id === 'ultron' && busy) ultron.talk = 1;
    if (s.lead) s.lead.tx = 0;
  }
  function highlight(id) { selected = id; }

  function packet(from, to, color) {
    const a = ROOMS[from], b = ROOMS[to]; if (!a || !b) return;
    if (from === 'ultron') { ultron.point = to; ultron.pointT = 1.6; }
    const route = a.path.concat(b.path.slice().reverse().slice(1));
    packets.push({ route, i: 0, x: route[0][0], y: route[0][1], c: color || C.g, trail: [] });
  }
  function launchShuttle() { if (shuttle.phase === 'docked') { shuttle.phase = 'out'; shuttle.t = 0; } }

  // ---------- space ----------
  function drawSpace(dt) {
    const CW = canvas.width, CH = canvas.height, k = Math.max(0.6, view.s);
    px(0, 0, CW, CH, '#020403');
    for (const st of stars) {
      st.x -= st.v * dt * 0.6 / CW; if (st.x < 0) { st.x = 1; st.y = Math.random(); }
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + st.p));
      px(st.x * CW, st.y * CH, st.s * Math.max(1, k * 0.8), st.s * Math.max(1, k * 0.8), st.s > 1 ? '#bfffe0' : '#6f8f80');
    }
    ctx.globalAlpha = 1;
    const plx = CW - 35 * k, ply = CH - 10 * k;
    ctx.fillStyle = '#0d2a1b'; ctx.beginPath(); ctx.arc(plx, ply, 90 * k, 0, 7); ctx.fill();
    ctx.fillStyle = '#123a25'; ctx.beginPath(); ctx.arc(plx - 20 * k, ply - 15 * k, 70 * k, 0, 7); ctx.fill();
    for (let i = 0; i < 7; i++) px(plx - 80 * k + i * 16 * k, ply - 52 * k + (i % 3) * 12 * k, 11 * k, 3 * k, '#1b5236');
    if (!ship && Math.random() < dt * 0.05) ship = { x: -30, y: rnd(0.3, 0.38), v: rnd(40, 80) };
    if (ship) {
      ship.x += ship.v * dt * k; const sy = ship.y * CH;
      px(ship.x, sy, 15 * k, 4 * k, '#6d7a74'); px(ship.x + 15 * k, sy + k, 4 * k, 2 * k, '#9fb'); px(ship.x - 5 * k, sy + k, 5 * k, 2 * k, C.warn);
      if (ship.x > CW + 30) ship = null;
    }
  }

  function corridor(path) {
    for (let i = 0; i < path.length - 1; i++) {
      const [x1, y1] = path[i], [x2, y2] = path[i + 1];
      const x = Math.min(x1, x2) - 9, y = Math.min(y1, y2) - 9, w = Math.abs(x2 - x1) + 18, h = Math.abs(y2 - y1) + 18;
      px(x - 1, y - 1, w + 2, h + 2, '#3b4246'); px(x, y, w, h, '#22282b'); px(x + 3, y + 3, w - 6, h - 6, '#111614');
      const horiz = w > h, len = horiz ? w : h;
      for (let k = 8; k < len - 6; k += 14) {
        const on = ((k / 14 + t * 4) | 0) % 6 === 0;
        if (horiz) px(x + k, y + h / 2 - 1, 3, 2, on ? C.g : '#1c3326'); else px(x + w / 2 - 1, y + k, 2, 3, on ? C.g : '#1c3326');
      }
    }
  }

  function roomShell(id, r) {
    const s = state[id];
    px(r.x - 5, r.y - 5, r.w + 10, r.h + 10, '#41494d');
    px(r.x - 4, r.y - 4, r.w + 8, r.h + 8, '#2a3134');
    for (let i = r.x; i < r.x + r.w; i += 24) px(i, r.y - 4, 1, r.h + 8, '#252b2e');
    px(r.x, r.y, r.w, r.h, '#0f1412');
    for (let gx = r.x; gx < r.x + r.w; gx += 12) px(gx, r.y, 1, r.h, '#141b17');
    for (let gy = r.y; gy < r.y + r.h; gy += 12) px(r.x, gy, r.w, 1, '#141b17');
    px(r.x, r.y, r.w, 17, '#1b2124');
    const col = s.err ? C.bad : s.busy ? C.warn : r.color;
    ctx.globalAlpha = s.busy ? 0.55 + 0.45 * Math.sin(t * 8) : 0.4; px(r.x + 4, r.y + 15, r.w - 8, 2, col); ctx.globalAlpha = 1;
    if (s.busy) { ctx.globalAlpha = 0.05 + 0.04 * Math.sin(t * 6); px(r.x, r.y, r.w, r.h, col); ctx.globalAlpha = 1; }
    if (selected === id) {
      ctx.strokeStyle = C.g; ctx.lineWidth = 1.5; ctx.setLineDash([4, 3]); ctx.lineDashOffset = -t * 12;
      ctx.strokeRect(r.x - 9.5, r.y - 9.5, r.w + 19, r.h + 19); ctx.setLineDash([]);
    }
    if (id === 'ultron') return;
    for (let i = 0; i < Math.floor(r.w / 38); i++) {
      const sx = r.x + 9 + i * 38;
      px(sx, r.y + 3, 27, 10, '#050806');
      px(sx + 3, r.y + 6, 6 + ((t * 3 + i * 2) % 14 | 0), 1, s.busy && Math.sin(t * 10 + i) > 0 ? C.g : C.gd);
      px(sx + 3, r.y + 9, 15, 1, '#14402a');
    }
  }

  // ---------- room props (authored at 2/3 scale, drawn scaled) ----------
  function props(id, r) {
    if (id === 'ultron') return;
    const s = state[id], b = s.busy;
    ctx.save(); ctx.translate(r.x, r.y); ctx.scale(PS, PS);
    const w = r.w / PS, h = r.h / PS, cx = w / 2, cy = h / 2 + 6;
    switch (id) {
      case 'scout': {
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#1d7a48'; ctx.beginPath(); ctx.arc(34, cy + 6, 20, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(34, cy + 6, 12, 0, 7); ctx.stroke();
        const a = t * (b ? 4 : 1.2);
        ctx.strokeStyle = C.g; ctx.beginPath(); ctx.moveTo(34, cy + 6); ctx.lineTo(34 + Math.cos(a) * 20, cy + 6 + Math.sin(a) * 20); ctx.stroke();
        if (b) for (let i = 0; i < 3; i++) px(34 + Math.cos(i * 2 + t) * 14, cy + 6 + Math.sin(i * 2.3 + t) * 12, 2, 2, C.warn);
        for (let i = 0; i < 3; i++) { px(70 + i * 22, cy - 18, 16, 9, '#2a3134'); px(72 + i * 22, cy - 16, 12, 4, b ? C.g : C.gd); }
        break;
      }
      case 'analyst':
        for (let i = 0; i < 4; i++) { const hh = 6 + ((Math.sin(t * (b ? 3 : 0.7) + i * 0.9) + 1) * 8); px(8 + i * 9, h - 8 - hh, 6, hh, i % 2 ? C.gd : '#c38bff'); }
        for (let i = 0; i < 4; i++) { const hh = 6 + ((Math.sin(t * (b ? 3 : 0.7) + i * 1.3) + 1) * 8); px(w - 44 + i * 9, h - 8 - hh, 6, hh, i % 2 ? '#c38bff' : C.gd); }
        px(cx - 16, 16, 32, 14, '#050806'); px(cx - 14, 18, b ? ((t * 20) % 28 | 0) : 10, 2, '#c38bff');
        break;
      case 'scribe':
        for (let i = 0; i < 2; i++) for (let j = 0; j < 2; j++) {
          const dx = 70 + i * 34, dy = 30 + j * 30;
          px(dx, dy, 26, 8, '#3a3125'); px(dx + 8, dy - 6, 10, 6, '#050806');
          px(dx + 9, dy - 5, b ? ((t * 12 + i * 3 + j) % 8 | 0) + 1 : 3, 1, C.g);
        }
        break;
      case 'forge': {
        for (let i = 0; i < 3; i++) {
          const mx = 10 + i * 46, my = 18;
          px(mx, my, 38, 24, '#2e3538'); px(mx + 2, my + 2, 34, 6, '#151a18');
          px(mx + 3 + (b ? (Math.sin(t * 6 + i) + 1) * 14 : 4), my + 3, 4, 4, C.warn);
          px(mx + 6, my + 11, 26, 11, '#e9e6df');
          if (b) { ctx.globalAlpha = 0.85; px(mx + 8, my + 13, Math.min(22, (t * 6 + i * 5) % 22), 7, ['#ff8a5a', '#ffd36b', '#c38bff'][i]); ctx.globalAlpha = 1; }
        }
        px(10, h - 20, w - 20, 1, '#6d7a74');
        const tees = ['#f2efe8', '#f7c6d0', '#cfe8d6', '#2a2e33', '#ffe6a8', '#d9d2ff'];
        for (let i = 0; i < 9; i++) { const tx = 14 + i * 15, ty = h - 18; px(tx, ty, 10, 3, tees[i % 6]); px(tx + 2, ty + 3, 6, 8, tees[i % 6]); }
        break;
      }
      case 'auditor': {
        px(cx + 6, 20, 4, h - 34, '#3a4044'); px(cx + 52, 20, 4, h - 34, '#3a4044');
        const ly = 22 + ((Math.sin(t * (b ? 4 : 1)) + 1) / 2) * (h - 40);
        ctx.globalAlpha = 0.85; px(cx + 10, ly, 42, 1, C.bad); ctx.globalAlpha = 0.2; px(cx + 10, ly - 2, 42, 5, C.bad); ctx.globalAlpha = 1;
        px(10, h - 18, 18, 10, '#2a3134'); px(12, h - 16, 6, 2, b ? C.warn : C.g);
        break;
      }
      case 'ledger': {
        for (let i = 0; i < 5; i++) { const hh = 4 + i * 3 + (b ? ((t * 5 + i) % 3 | 0) : 0); for (let k = 0; k < hh; k += 2) px(10 + i * 9, h - 8 - k, 6, 1, k % 4 ? '#c9a23a' : '#ffd36b'); }
        px(62, 16, 56, 28, '#050806');
        ctx.strokeStyle = C.g; ctx.lineWidth = 1; ctx.beginPath();
        for (let i = 0; i <= 10; i++) { const yy = 40 - i * 2 - Math.sin(i + t * (b ? 3 : 0.5)) * 3; i ? ctx.lineTo(64 + i * 5.2, yy) : ctx.moveTo(64, yy); }
        ctx.stroke();
        break;
      }
      case 'courier': {
        px(w - 4, 14, 4, h - 20, '#55606a');
        for (let i = 0; i < 3; i++) { px(w - 64 + i * 12, h - 16, 9, 8, '#7a5a34'); px(w - 64 + i * 12, h - 13, 9, 1, '#4a3420'); }
        let sx = w - 62, sy = 22;
        if (shuttle.phase !== 'docked') {
          shuttle.t += 1 / 60;
          const k = shuttle.t;
          if (shuttle.phase === 'out') { sx += k * k * 140; if (sx > w + 300) { shuttle.phase = 'back'; shuttle.t = 0; } }
          else { sx = w + 300 - Math.min(1, k / 3) * 300; if (k >= 3) shuttle.phase = 'docked'; }
          if (shuttle.phase === 'out' && Math.sin(t * 40) > 0) px(sx - 6, sy + 6, 6, 3, C.warn);
        }
        px(sx, sy, 34, 14, '#c9d1cc'); px(sx + 26, sy + 3, 8, 6, '#5ac8ff'); px(sx + 4, sy + 14, 20, 3, '#6d7a74'); px(sx - 2, sy + 4, 2, 6, '#6d7a74'); px(sx + 8, sy + 5, 10, 2, C.g);
        break;
      }
    }
    ctx.restore();
  }

  // ---------- agent characters ----------
  function moveTo(c, dt, sp) {
    const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
    if (d < sp * dt) { c.x = c.tx; c.y = c.ty; return true; }
    c.x += dx / d * sp * dt; c.y += dy / d * sp * dt; c.step += dt * sp / 4;
    if (Math.abs(dx) > 0.5) c.face = dx > 0 ? 1 : -1;
    return false;
  }
  function updateLead(id, r, dt) {
    const s = state[id], L = s.lead;
    const deskX = r.x + r.w * r.desk[0], deskY = r.y + r.h * r.desk[1] + 18;
    if (s.busy) {
      L.tx = deskX; L.ty = deskY;
      L.arrived = moveTo(L, dt, 60);
    } else {
      L.arrived = false;
      if (L.wait > 0) L.wait -= dt;
      else {
        if (!L.tx) { L.tx = rnd(r.x + 16, r.x + r.w - 16); L.ty = rnd(r.y + 48, r.y + r.h - 6); }
        if (moveTo(L, dt, 22)) { L.tx = 0; L.wait = rnd(1.5, 5); }
      }
    }
  }
  // a chunky little robot, ~16 x 30 logical px, feet at (x, y)
  const LEAD_SCALE = 1.35;
  function drawLead(id, r) {
    const L0 = state[id].lead;
    ctx.save(); ctx.translate(L0.x, L0.y); ctx.scale(LEAD_SCALE, LEAD_SCALE); ctx.translate(-L0.x, -L0.y);
    drawLeadInner(id, r);
    ctx.restore();
  }
  function drawLeadInner(id, r) {
    const s = state[id], L = s.lead, col = r.color;
    const walking = !L.arrived && (s.busy || L.tx) && L.wait <= 0;
    const leg = walking ? (Math.sin(L.step) > 0 ? 1 : -1) : 0;
    const bob = walking ? Math.abs(Math.sin(L.step)) : 0;
    const x = Math.round(L.x), y = Math.round(L.y - bob);
    const working = s.busy && L.arrived;
    // shadow + glow
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(x, L.y + 1, 9, 3, 0, 0, 7); ctx.fill();
    if (selected === id || s.busy) { ctx.globalAlpha = 0.18 + (s.busy ? 0.1 * Math.sin(t * 8) : 0); ctx.fillStyle = s.busy ? C.warn : col; ctx.beginPath(); ctx.ellipse(x, L.y, 14, 5, 0, 0, 7); ctx.fill(); }
    ctx.globalAlpha = 1;
    // legs
    px(x - 5, y - 8 + Math.max(0, leg) * 1, 4, 8 - Math.max(0, leg), '#2a3134');
    px(x + 1, y - 8 + Math.max(0, -leg) * 1, 4, 8 - Math.max(0, -leg), '#2a3134');
    px(x - 6, y - 1, 5, 2, '#0e1112'); px(x + 1, y - 1, 5, 2, '#0e1112');
    // body
    px(x - 7, y - 20, 14, 12, '#d7dedb'); px(x - 7, y - 20, 14, 2, '#f2f6f4'); px(x - 7, y - 10, 14, 2, '#9aa39e');
    px(x - 5, y - 17, 10, 4, col); // chest plate in agent colour
    if (s.busy) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * 10); px(x - 1, y - 16, 2, 2, '#fff'); ctx.globalAlpha = 1; }
    // arms
    const armY = working ? (Math.sin(t * 18) > 0 ? -1 : 0) : (walking ? -leg : 0);
    px(x - 10, y - 19 + armY, 3, 9, '#b9c2be'); px(x + 7, y - 19 - armY, 3, 9, '#b9c2be');
    // head
    px(x - 6, y - 31, 12, 10, '#e9eeeb'); px(x - 6, y - 31, 12, 2, '#ffffff');
    px(x - 5, y - 28, 10, 4, '#0b1210'); // visor
    const blink = Math.sin(t * 1.3 + x) > 0.97;
    if (!blink) { const ex = L.face > 0 ? 1 : -1; px(x - 3 + ex, y - 27, 2, 2, s.err ? C.bad : col); px(x + 1 + ex, y - 27, 2, 2, s.err ? C.bad : col); }
    accessory(id, x, y, col, s.busy, working, L.face);
  }
  function accessory(id, x, y, col, busy, working, face) {
    switch (id) {
      case 'scout': px(x - 1, y - 37, 2, 6, '#9aa39e'); px(x - 2, y - 39, 4, 3, Math.sin(t * 6) > 0 ? C.g : '#1d7a48'); if (working) { px(x + 4 * face, y - 28, 6 * face, 3, '#3a4044'); } break;
      case 'analyst': px(x - 8, y - 30, 2, 7, '#c38bff'); px(x + 6, y - 30, 2, 7, '#c38bff'); px(x - 7, y - 33, 14, 2, '#c38bff'); px(x + 7, y - 24, 3, 1, '#c38bff'); break;
      case 'scribe': px(x - 5, y - 34, 10, 3, '#3a3125'); px(x - 3, y - 36, 6, 2, '#3a3125'); if (working || busy) { px(x + 8, y - 20, 6, 8, '#f2efe8'); px(x + 9, y - 18, 4, 1, '#666'); px(x + 9, y - 16, 3, 1, '#666'); } break;
      case 'forge': px(x - 6, y - 33, 12, 3, '#ff8a5a'); px(x - 7, y - 31, 14, 1, '#c46a3a'); if (busy) { px(x + 9, y - 19, 2, 9, '#7a5a34'); px(x + 8, y - 21, 4, 3, ['#ff8a5a', '#ffd36b', '#c38bff'][((t * 3) | 0) % 3]); } break;
      case 'auditor': px(x - 6, y - 28, 12, 1, '#ff6b8b'); if (busy) { ctx.strokeStyle = '#d7dedb'; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x + 12 * face, y - 22, 4, 0, 7); ctx.stroke(); px(x + 9 * face, y - 18, 2, 4, '#7a5a34'); } break;
      case 'ledger': px(x - 6, y - 34, 12, 3, '#2a3134'); px(x - 4, y - 37, 8, 3, '#2a3134'); if (busy) { const cy = y - 34 - Math.abs(Math.sin(t * 5)) * 10; px(x + 10, cy, 4, 4, '#ffd36b'); px(x + 11, cy + 1, 2, 2, '#c9a23a'); } break;
      case 'courier': px(x - 6, y - 33, 12, 3, '#7ee8ff'); px(x - 6 - 4 * face, y - 19, 4, 9, '#7a5a34'); if (busy) { px(x - 6, y - 25, 12, 7, '#b58a52'); px(x - 6, y - 22, 12, 1, '#7a5a34'); } break;
    }
  }
  function crew(id, r, dt) {
    const s = state[id];
    for (const c of s.crew) {
      if (c.wait > 0) c.wait -= dt * (s.busy ? 3 : 1);
      else {
        if (!c.tx) { c.tx = rnd(r.x + 10, r.x + r.w - 10); c.ty = rnd(r.y + 30, r.y + r.h - 8); }
        if (moveTo(c, dt, s.busy ? 34 : 12)) { c.tx = 0; c.wait = rnd(0.5, s.busy ? 1 : 4); }
      }
      const bob = c.tx ? (Math.sin(c.step) > 0 ? 1 : 0) : 0;
      px(c.x - 2, c.y - 10, 4, 3, '#e8c9a8');
      px(c.x - 2, c.y - 7, 4, 5, r.color); ctx.globalAlpha = 0.5; px(c.x - 2, c.y - 7, 4, 5, '#000'); ctx.globalAlpha = 1;
      px(c.x - 2, c.y - 2, 1, 2 + bob, '#222'); px(c.x + 1, c.y - 2, 1, 3 - bob, '#222');
    }
  }

  // ---------- ULTRON hologram: an original armoured war-machine, drawn as glowing plates ----------
  // local coordinates: x right, y up is negative, feet at (0, 0), crest tip near y = -166
  const M = (pts) => pts.map(([x, y]) => [-x, y]);
  const SHAPES = {
    thigh:  [[6, -60], [17, -60], [19, -34], [9, -32]],
    shin:   [[9, -30], [20, -32], [19, -8], [11, -6]],
    knee:   [[8, -38], [21, -40], [23, -30], [16, -25], [8, -28]],
    foot:   [[8, -7], [22, -8], [28, 0], [4, 0]],
    pelvis: [[-17, -66], [17, -66], [12, -52], [0, -48], [-12, -52]],
    torso:  [[-31, -116], [31, -116], [27, -98], [15, -70], [-15, -70], [-27, -98]],
    abs1:   [[-14, -78], [14, -78], [12, -71], [-12, -71]],
    abs2:   [[-12, -70], [12, -70], [10, -63], [-10, -63]],
    pecL:   [[-28, -113], [-4, -113], [-4, -95], [-22, -94]],
    neck:   [[-7, -122], [7, -122], [9, -114], [-9, -114]],
    pad:    [[20, -120], [40, -127], [54, -114], [52, -98], [36, -95], [22, -104]],
    padRim: [[36, -95], [52, -98], [50, -91], [35, -89]],
    spike1: [[36, -125], [45, -146], [46, -122]],
    spike2: [[46, -120], [61, -134], [53, -112]],
    head:   [[0, -164], [7, -158], [12, -147], [13, -136], [9, -126], [4, -121], [0, -120], [-4, -121], [-9, -126], [-13, -136], [-12, -147], [-7, -158]],
    crest:  [[0, -166], [3, -170], [6, -152], [2, -150]],
    hornL:  [[-12, -147], [-22, -160], [-14, -140]],
    jaw:    [[-8, -128], [8, -128], [5, -122], [-5, -122]],
    upper:  [[-6, 0], [6, 0], [5, 24], [-5, 24]],          // arm segments drawn in arm space (pointing down)
    fore:   [[-7, 0], [7, 0], [6, 24], [-6, 24]],
    guard:  [[-8, 2], [8, 2], [9, 12], [-9, 12]],
  };
  let glitch = 0;
  function plate(pts, ox, oy, sx, fillA, strokeCol, lw = 1) {
    ctx.beginPath();
    pts.forEach(([x, y], i) => { const X = ox + x * sx, Y = oy + y; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
    ctx.closePath();
    ctx.globalAlpha = fillA; ctx.fill();
    ctx.globalAlpha = Math.min(1, fillA * 5 + 0.35); ctx.strokeStyle = strokeCol; ctx.lineWidth = lw; ctx.stroke();
  }
  function drawUltron(dt) {
    const r = ROOMS.ultron, s = state.ultron, busy = s.busy;
    if (ultron.pointT > 0) ultron.pointT -= dt;
    const cx = r.x + r.w / 2, fy = r.y + r.h - 18, S = 0.93;
    const G = s.err ? C.bad : C.g, RED = '#ff3b3b';
    // holo pad + cone + consoles
    for (let i = 3; i >= 0; i--) { ctx.globalAlpha = 0.18 + i * 0.06; ctx.strokeStyle = C.g; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(cx, fy + 3, 34 + i * 10, 7 + i * 2.4, 0, 0, 7); ctx.stroke(); }
    ctx.globalAlpha = 0.9; ctx.strokeStyle = busy ? RED : C.g; ctx.setLineDash([5, 6]); ctx.lineDashOffset = -t * (busy ? 40 : 12);
    ctx.beginPath(); ctx.ellipse(cx, fy + 3, 60, 13, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    const cone = ctx.createLinearGradient(0, fy, 0, fy - 170);
    cone.addColorStop(0, busy ? 'rgba(255,59,59,0.15)' : 'rgba(70,255,154,0.12)'); cone.addColorStop(1, 'rgba(70,255,154,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = cone;
    ctx.beginPath(); ctx.moveTo(cx - 60, fy + 3); ctx.lineTo(cx + 60, fy + 3); ctx.lineTo(cx + 44, fy - 170); ctx.lineTo(cx - 44, fy - 170); ctx.closePath(); ctx.fill();
    for (let i = 0; i < 6; i++) { const a = Math.PI + i / 5 * Math.PI; const kx = cx + Math.cos(a) * 98, ky = fy + Math.sin(a) * 50; px(kx - 7, ky - 4, 14, 8, '#2a3134'); px(kx - 5, ky - 3, 10, 2, busy && Math.sin(t * 9 + i) > 0 ? RED : C.g); }

    // pose
    const turn = Math.sin(t * 0.35);                       // slow menacing sway
    const sxBody = 0.86 + 0.14 * Math.cos(turn * 0.9);     // pseudo-3D: narrower when turned
    const lean = turn * 3;
    const breathe = Math.sin(t * 1.5) * 1.2;
    const tgt = ultron.pointT > 0 && ROOMS[ultron.point] ? ROOMS[ultron.point] : null;
    const tdir = tgt ? (tgt.x + tgt.w / 2 > cx ? 1 : -1) : 0;
    const headShift = tgt ? tdir * 4 : turn * 2.5;
    if (Math.random() < dt * 0.6) glitch = 0.12;
    if (glitch > 0) glitch -= dt;
    const gx = glitch > 0 ? (Math.random() - 0.5) * 6 : 0;
    const ox = cx + lean + gx, oy = fy;
    const tox = (lx) => ox + lx * S * sxBody, toy = (ly) => oy + (ly < -60 ? ly + breathe : ly) * S;

    ctx.save();
    ctx.translate(ox, oy); ctx.scale(S * sxBody, S); ctx.translate(-ox, -oy);
    const fillG = ctx.createLinearGradient(0, oy - 170, 0, oy);
    fillG.addColorStop(0, 'rgba(120,255,190,1)'); fillG.addColorStop(1, 'rgba(30,140,80,1)');
    ctx.fillStyle = fillG;
    const fa = busy ? 0.16 : 0.11;
    const P = (pts, a = fa, col = G, lw = 1, dy = 0) => plate(pts, ox, oy + dy, 1, a, col, lw);
    const B = (ly) => (ly < -60 ? breathe : 0);

    // arm builder: shoulder (sx, -106), returns hand point in local coords
    const arm = (side, far) => {
      const shX = side * 40, shY = -104 + breathe;
      let a1, a2;
      if (tdir === side) { a1 = -side * (Math.PI * 0.62); a2 = -side * 0.1; }       // point at the room
      else if (busy && side === 1) { a1 = -0.35 - Math.max(0, Math.sin(t * 3)) * 0.9; a2 = -0.9; } // gesturing
      else { a1 = side * (0.1 + Math.sin(t * 1.1 + side) * 0.04); a2 = -side * 0.22; }
      ctx.save(); ctx.translate(ox + shX, oy + shY); ctx.rotate(a1);
      ctx.globalAlpha = 1;
      plate(SHAPES.upper, 0, 0, 1, far ? fa * 0.6 : fa, G);
      ctx.translate(0, 24); ctx.beginPath(); ctx.arc(0, 0, 6, 0, 7); ctx.globalAlpha = 0.6; ctx.strokeStyle = G; ctx.stroke();
      ctx.rotate(a2);
      plate(SHAPES.fore, 0, 0, 1, far ? fa * 0.7 : fa * 1.3, G, 1.2);
      plate(SHAPES.guard, 0, 0, 1, fa * 1.6, G);
      // talons
      ctx.globalAlpha = 0.95; ctx.strokeStyle = G; ctx.lineWidth = 1.4;
      const open = tdir === side ? 1 : busy ? 0.6 : 0.25;
      for (const f of [-1, 0, 1]) { ctx.beginPath(); ctx.moveTo(f * 4, 24); ctx.quadraticCurveTo(f * (6 + open * 4), 31, f * (3 + open * 6), 38); ctx.stroke(); }
      ctx.restore();
      const hx = shX + Math.sin(-a1) * 24 + Math.sin(-(a1 + a2)) * 36, hy = shY + Math.cos(a1) * 24 + Math.cos(a1 + a2) * 36;
      return [hx, hy];
    };

    // far arm first (behind the body)
    const farSide = turn > 0 ? -1 : 1;
    const hands = {};
    hands[farSide] = arm(farSide, true);
    // legs
    for (const [sh, side] of [[SHAPES, 1], [SHAPES, -1]]) {
      const f = side === 1 ? (p) => p : M;
      P(f(sh.thigh)); P(f(sh.shin)); P(f(sh.knee), fa * 1.6); P(f(sh.foot), fa * 1.4);
    }
    // body
    P(SHAPES.pelvis, fa * 1.2);
    P(SHAPES.torso, fa * 1.1, G, 1.4, breathe);
    P(SHAPES.pecL, fa * 1.5, G, 1, breathe); P(M(SHAPES.pecL), fa * 1.5, G, 1, breathe);
    P(SHAPES.abs1, fa * 1.4, G, 1, breathe); P(SHAPES.abs2, fa * 1.4, G, 1, breathe);
    // ribs
    ctx.globalAlpha = 0.5; ctx.strokeStyle = G; ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) { const y = oy - 90 + i * 6 + breathe; ctx.beginPath(); ctx.moveTo(ox - 22 + i * 3, y); ctx.lineTo(ox - 6, y + 3); ctx.moveTo(ox + 22 - i * 3, y); ctx.lineTo(ox + 6, y + 3); ctx.stroke(); }
    P(SHAPES.neck, fa * 1.3, G, 1, breathe);
    // pauldrons with spikes
    for (const side of [1, -1]) {
      const f = side === 1 ? (p) => p : M;
      P(f(SHAPES.pad), fa * 1.5, G, 1.4, breathe); P(f(SHAPES.padRim), fa * 2, G, 1, breathe);
      P(f(SHAPES.spike1), fa * 1.8, G, 1, breathe); P(f(SHAPES.spike2), fa * 1.8, G, 1, breathe);
    }
    // head (turns toward target)
    ctx.save(); ctx.translate(headShift, breathe);
    P(SHAPES.crest, fa * 2); P(SHAPES.hornL, fa * 1.8); P(M(SHAPES.hornL), fa * 1.8);
    P(SHAPES.head, fa * 1.6, G, 1.5);
    P(SHAPES.jaw, fa * 2.2);
    ctx.globalAlpha = 0.6; ctx.strokeStyle = G; ctx.lineWidth = 1;
    for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.moveTo(ox + i * 3, oy - 127); ctx.lineTo(ox + i * 3, oy - 123); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(ox, oy - 163); ctx.lineTo(ox, oy - 145); ctx.stroke();
    // angry V visor
    const flare = busy ? 0.75 + 0.25 * Math.sin(t * 14) : 0.7 + 0.15 * Math.sin(t * 2);
    const vis = [[-11, -144], [-3, -138], [0, -139], [3, -138], [11, -144], [10, -140], [2, -134], [-2, -134], [-10, -140]];
    ctx.fillStyle = RED; ctx.shadowColor = RED; ctx.shadowBlur = 12 * flare;
    ctx.beginPath(); vis.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x, oy + y) : ctx.moveTo(ox + x, oy + y))); ctx.closePath();
    ctx.globalAlpha = flare; ctx.fill();
    ctx.fillStyle = '#ffe3e3'; ctx.globalAlpha = 1; ctx.fillRect(ox - 7, oy - 141, 3, 2); ctx.fillRect(ox + 4, oy - 141, 3, 2);
    ctx.shadowBlur = 0;
    ctx.restore();
    // reactor
    const pulse = busy ? 0.7 + 0.3 * Math.sin(t * 10) : 0.5 + 0.2 * Math.sin(t * 2);
    const ry = oy - 100 + breathe;
    const cg = ctx.createRadialGradient(ox, ry, 0, ox, ry, 14);
    cg.addColorStop(0, `rgba(255,230,230,${pulse})`); cg.addColorStop(0.35, `rgba(255,59,59,${pulse * 0.85})`); cg.addColorStop(1, 'rgba(255,59,59,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(ox, ry, 14, 0, 7); ctx.fill();
    ctx.strokeStyle = RED; ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.arc(ox, ry, 6, 0, 7); ctx.stroke();
    // near arm on top
    ctx.fillStyle = fillG;
    hands[-farSide] = arm(-farSide, false);
    // scanline sweep + interlace
    const scanY = oy - ((t * 70) % 175);
    ctx.globalAlpha = 0.35; ctx.fillStyle = busy ? RED : '#d8ffe9'; ctx.fillRect(ox - 70, scanY, 140, 1.5);
    ctx.globalAlpha = 0.13; ctx.fillStyle = '#000'; for (let yy = oy - 172; yy < oy; yy += 3) ctx.fillRect(ox - 75, yy, 150, 1);
    ctx.restore();
    ctx.globalAlpha = 1; ctx.lineWidth = 1;

    // order beam from the pointing claw
    if (tdir && ultron.pointT > 0) {
      const h = hands[tdir]; const hx = tox(h[0]), hy = toy(h[1]);
      const tx = tgt.x + tgt.w / 2, ty = tgt.y + tgt.h / 2;
      ctx.globalAlpha = Math.min(1, ultron.pointT) * 0.85; ctx.strokeStyle = RED; ctx.lineWidth = 1.5; ctx.setLineDash([3, 5]); ctx.lineDashOffset = -t * 70;
      ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
      ctx.globalAlpha = 0.7; px(hx - 3, hy - 3, 6, 6, RED); ctx.globalAlpha = 1;
    }
    placeBubble('ultron', cx, fy - 168);
  }

  function drawPackets(dt) {
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i], tgt = p.route[p.i + 1];
      if (!tgt) { packets.splice(i, 1); continue; }
      const dx = tgt[0] - p.x, dy = tgt[1] - p.y, d = Math.hypot(dx, dy), sp = 220 * dt;
      if (d <= sp) { p.x = tgt[0]; p.y = tgt[1]; p.i++; } else { p.x += dx / d * sp; p.y += dy / d * sp; }
      p.trail.push([p.x, p.y]); if (p.trail.length > 12) p.trail.shift();
      p.trail.forEach((q, k) => { ctx.globalAlpha = k / 16; px(q[0] - 1.5, q[1] - 1.5, 3, 3, p.c); });
      ctx.globalAlpha = 1; px(p.x - 3, p.y - 3, 6, 6, p.c); ctx.globalAlpha = 0.25; px(p.x - 6, p.y - 6, 12, 12, p.c); ctx.globalAlpha = 1;
    }
  }

  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts; t += dt;
    const k = Math.min(1, dt * 5);
    cam.x += (camT.x - cam.x) * k; cam.y += (camT.y - cam.y) * k; cam.z += (camT.z - cam.z) * k;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawSpace(dt);
    const kz = view.s * cam.z;
    ctx.setTransform(kz, 0, 0, kz, view.ox + (W / 2 - cam.x * cam.z) * view.s, view.oy + (H / 2 - cam.y * cam.z) * view.s);
    for (const r of Object.values(ROOMS)) corridor(r.path);
    for (const [id, r] of Object.entries(ROOMS)) roomShell(id, r);
    for (const [id, r] of Object.entries(ROOMS)) props(id, r);
    for (const [id, r] of Object.entries(ROOMS)) {
      if (id === 'ultron') continue;
      crew(id, r, dt);
      updateLead(id, r, dt);
      drawLead(id, r);
      const L = state[id].lead;
      placeBubble(id, Math.max(r.x + 60, Math.min(r.x + r.w - 60, L.x)), Math.max(r.y + 32, L.y - 40 * LEAD_SCALE - 4));
    }
    drawUltron(dt);
    drawPackets(dt);
    if (focused) {
      const r = ROOMS[focused];
      ctx.save(); ctx.globalAlpha = Math.min(0.62, (cam.z - 1) * 0.6);
      ctx.beginPath(); ctx.rect(-5000, -5000, 10000, 10000); ctx.rect(r.x - 12, r.y - 12, r.w + 24, r.h + 24);
      ctx.fillStyle = '#000'; ctx.fill('evenodd'); ctx.restore();
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    moveLabels();
    requestAnimationFrame(loop);
  }

  // ---------- commander core (wireframe sphere in the side panel) ----------
  const Core = (() => {
    let c, x, active = false, tt = 0; const pts = [];
    function init(cv) {
      c = cv; x = cv.getContext('2d');
      const N = 160, g = Math.PI * (3 - Math.sqrt(5));
      for (let i = 0; i < N; i++) { const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i; pts.push([Math.cos(th) * r, y, Math.sin(th) * r]); }
      requestAnimationFrame(draw);
    }
    function draw() {
      tt += active ? 0.03 : 0.008;
      const w = c.width, h = c.height, R = w * 0.34;
      x.clearRect(0, 0, w, h);
      const rot = pts.map(([a, b, d]) => { const ca = Math.cos(tt), sa = Math.sin(tt), cb = Math.cos(0.4), sb = Math.sin(0.4); const X = a * ca - d * sa, Z = a * sa + d * ca; return [X, b * cb - Z * sb, b * sb + Z * cb]; });
      x.lineWidth = 1;
      for (let i = 0; i < rot.length; i++) for (let j = i + 1; j < rot.length; j++) {
        const p = rot[i], q = rot[j], d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2;
        if (d < 0.07) { const z = (p[2] + q[2]) / 2; x.strokeStyle = `rgba(70,255,154,${0.12 + (z + 1) * 0.25})`; x.beginPath(); x.moveTo(w / 2 + p[0] * R, h / 2 + p[1] * R); x.lineTo(w / 2 + q[0] * R, h / 2 + q[1] * R); x.stroke(); }
      }
      const pulse = active ? 0.6 + 0.4 * Math.sin(tt * 12) : 0.5;
      const gr = x.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, R * 0.6);
      gr.addColorStop(0, `rgba(180,255,215,${pulse})`); gr.addColorStop(1, 'rgba(70,255,154,0)');
      x.fillStyle = gr; x.beginPath(); x.arc(w / 2, h / 2, R * 0.6, 0, 7); x.fill();
      requestAnimationFrame(draw);
    }
    return { init, setActive: (v) => { active = !!v; } };
  })();

  window.Station = { init, setBusy, packet, highlight, launchShuttle, focus, ROOMS, relayout: () => { placeLabels(); if (!focused) Object.assign(camT, { x: W / 2, y: H / 2, z: 1 }); } };
  window.Core = Core;
})();
