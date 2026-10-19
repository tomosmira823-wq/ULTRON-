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

  const rnd = (a, b) => a + Math.random() * (b - a);
  function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

  function init(cv, lbl, cb) {
    canvas = cv; canvas.width = W; canvas.height = H;
    ctx = cv.getContext('2d'); labelsEl = lbl; onSelect = cb || onSelect;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 320; i++) stars.push({ x: rnd(0, W), y: rnd(0, H), s: Math.random() < 0.1 ? 2 : 1, p: rnd(0, 6.28), v: rnd(1, 5) });
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
    canvas.addEventListener('click', (e) => {
      const r = canvas.getBoundingClientRect();
      const x = (e.clientX - r.left - view.ox) / view.s, y = (e.clientY - r.top - view.oy) / view.s;
      for (const [id, room] of Object.entries(ROOMS)) if (x >= room.x && x <= room.x + room.w && y >= room.y && y <= room.y + room.h) { onSelect(id); return; }
    });
    new ResizeObserver(placeLabels).observe(canvas);
    placeLabels();
    requestAnimationFrame(loop);
  }

  function placeLabels() {
    const r = canvas.getBoundingClientRect();
    view.s = Math.min(r.width / W, r.height / H);
    view.ox = (r.width - W * view.s) / 2; view.oy = (r.height - H * view.s) / 2;
    for (const [id, room] of Object.entries(ROOMS)) {
      const el = state[id].el;
      el.style.left = (view.ox + (room.x + room.w / 2) * view.s) + 'px';
      el.style.top = (view.oy + room.y * view.s - 2) + 'px';
    }
  }
  function placeBubble(id, x, y) {
    const b = state[id].bubble;
    b.style.left = (view.ox + x * view.s) + 'px';
    b.style.top = (view.oy + y * view.s) + 'px';
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
    px(0, 0, W, H, '#020403');
    for (const s of stars) {
      s.x -= s.v * dt * 0.6; if (s.x < 0) { s.x = W; s.y = rnd(0, H); }
      ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + s.p));
      px(s.x, s.y, s.s, s.s, s.s > 1 ? '#bfffe0' : '#6f8f80');
    }
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#0d2a1b'; ctx.beginPath(); ctx.arc(925, 530, 90, 0, 7); ctx.fill();
    ctx.fillStyle = '#123a25'; ctx.beginPath(); ctx.arc(905, 515, 70, 0, 7); ctx.fill();
    for (let i = 0; i < 7; i++) px(845 + i * 16, 478 + (i % 3) * 12, 11, 3, '#1b5236');
    if (!ship && Math.random() < dt * 0.05) ship = { x: -30, y: rnd(165, 205), v: rnd(40, 80) };
    if (ship) {
      ship.x += ship.v * dt;
      px(ship.x, ship.y, 15, 4, '#6d7a74'); px(ship.x + 15, ship.y + 1, 4, 2, '#9fb'); px(ship.x - 5, ship.y + 1, 5, 2, C.warn);
      if (ship.x > W + 30) ship = null;
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

  // ---------- ULTRON hologram ----------
  const BODY = (() => {
    // rings: [y, rx, rz] stacked into a low-poly figure; feet at y = 0, head top at -138
    const head = [[-138, 3, 3], [-134, 8, 8], [-127, 11, 10], [-119, 11, 10], [-112, 9, 9], [-106, 5, 5]];
    const torso = [[-102, 5, 4], [-96, 22, 10], [-86, 21, 10], [-74, 17, 9], [-64, 14, 8], [-56, 17, 9], [-50, 15, 9]];
    return { head, torso };
  })();
  function ultronSegments(busy) {
    const segs = [], N = 8;
    const ringPts = (yc, rx, rz, ox = 0) => Array.from({ length: N }, (_, i) => { const a = i / N * Math.PI * 2; return [ox + Math.cos(a) * rx, yc, Math.sin(a) * rz]; });
    const stack = (rings) => {
      const pts = rings.map(([yy, rx, rz]) => ringPts(yy, rx, rz));
      for (let i = 0; i < pts.length; i++) for (let j = 0; j < N; j++) {
        segs.push([pts[i][j], pts[i][(j + 1) % N], i]);
        if (i < pts.length - 1) segs.push([pts[i][j], pts[i + 1][j], i]);
      }
    };
    stack(BODY.head); stack(BODY.torso);
    // limbs as thin tubes
    const tube = (a, b, r) => {
      const n = 5, ra = [], rb = [];
      for (let i = 0; i < n; i++) { const ang = i / n * Math.PI * 2; ra.push([a[0] + Math.cos(ang) * r, a[1], a[2] + Math.sin(ang) * r]); rb.push([b[0] + Math.cos(ang) * r, b[1], b[2] + Math.sin(ang) * r]); }
      for (let i = 0; i < n; i++) { segs.push([ra[i], rb[i], 9]); segs.push([rb[i], rb[(i + 1) % n], 9]); }
    };
    const sway = Math.sin(t * 1.2) * 2;
    // arms: right arm raises when talking / pointing
    const point = ultron.pointT > 0 ? (ROOMS[ultron.point]?.x + (ROOMS[ultron.point]?.w || 0) / 2 > 480 ? 1 : -1) : 0;
    const talk = busy ? Math.sin(t * 5) : 0;
    const R = point === 1 ? [[22, -94, 0], [40, -104, 6], [58, -116, 10]] : [[22, -94, 0], [27, -74, 2 + talk * 3], [28 + talk * 6, -54 - Math.max(0, talk) * 18, 6 + talk * 4]];
    const Lm = point === -1 ? [[-22, -94, 0], [-40, -104, 6], [-58, -116, 10]] : [[-22, -94, 0], [-27, -74, 2], [-26, -54 + sway, 4]];
    tube(R[0], R[1], 3.5); tube(R[1], R[2], 3);
    tube(Lm[0], Lm[1], 3.5); tube(Lm[1], Lm[2], 3);
    // legs
    tube([9, -50, 0], [10, -26, 2], 4.5); tube([10, -26, 2], [10, -2, 0], 3.5);
    tube([-9, -50, 0], [-10, -26, 2], 4.5); tube([-10, -26, 2], [-10, -2, 0], 3.5);
    return { segs, hand: point ? (point === 1 ? R[2] : Lm[2]) : null };
  }
  function drawUltron(dt) {
    const r = ROOMS.ultron, s = state.ultron, busy = s.busy;
    if (ultron.pointT > 0) ultron.pointT -= dt;
    const cx = r.x + r.w / 2, fy = r.y + r.h - 22, scale = 0.98;
    // holo pad
    for (let i = 3; i >= 0; i--) {
      ctx.globalAlpha = 0.18 + i * 0.06; ctx.strokeStyle = C.g; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.ellipse(cx, fy + 4, 30 + i * 9, 7 + i * 2.2, 0, 0, 7); ctx.stroke();
    }
    ctx.globalAlpha = 0.9; ctx.setLineDash([5, 6]); ctx.lineDashOffset = -t * (busy ? 40 : 12);
    ctx.beginPath(); ctx.ellipse(cx, fy + 4, 52, 12, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    // light cone
    const g = ctx.createLinearGradient(0, fy, 0, fy - 150);
    g.addColorStop(0, `rgba(70,255,154,${busy ? 0.22 : 0.13})`); g.addColorStop(1, 'rgba(70,255,154,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = g;
    ctx.beginPath(); ctx.moveTo(cx - 48, fy + 4); ctx.lineTo(cx + 48, fy + 4); ctx.lineTo(cx + 34, fy - 150); ctx.lineTo(cx - 34, fy - 150); ctx.closePath(); ctx.fill();
    // console ring around the pad
    for (let i = 0; i < 6; i++) { const a = Math.PI + i / 5 * Math.PI; const kx = cx + Math.cos(a) * 92, ky = fy - 50 + Math.sin(a) * 52 + 50; px(kx - 7, ky - 4, 14, 8, '#2a3134'); px(kx - 5, ky - 3, 10, 2, busy && Math.sin(t * 9 + i) > 0 ? C.warn : C.g); }
    // figure
    const rot = Math.sin(t * 0.45) * 0.75 + (ultron.pointT > 0 ? 0 : 0);
    const cr = Math.cos(rot), sr = Math.sin(rot);
    const proj = ([x, y, z]) => { const X = x * cr - z * sr, Z = x * sr + z * cr; return [cx + X * scale, fy + (y + Math.sin(t * 1.6) * 1.5) * scale, Z]; };
    const { segs, hand } = ultronSegments(busy);
    const flick = 0.85 + Math.random() * 0.15;
    const scanY = fy - ((t * 60) % 160);
    ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(70,255,154,0.10)';
    ctx.beginPath(); for (const [a, b] of segs) { const p = proj(a), q = proj(b); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); } ctx.stroke();
    ctx.lineWidth = 1;
    for (const [a, b] of segs) {
      const p = proj(a), q = proj(b), z = (p[2] + q[2]) / 2;
      const near = Math.abs((p[1] + q[1]) / 2 - scanY) < 6;
      ctx.globalAlpha = Math.max(0.15, Math.min(1, (0.45 + z / 40) * flick + (near ? 0.5 : 0)));
      ctx.strokeStyle = near ? '#d8ffe9' : (s.err ? C.bad : C.g);
      ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
    }
    // eyes + core
    const eyeL = proj([-4, -124, 9.5]), eyeR = proj([4, -124, 9.5]);
    if (eyeL[2] > -2) { ctx.globalAlpha = 1; px(eyeL[0] - 1.5, eyeL[1] - 1, 3, 2, busy ? '#fff' : '#bfffe0'); px(eyeR[0] - 1.5, eyeR[1] - 1, 3, 2, busy ? '#fff' : '#bfffe0'); }
    const core = proj([0, -84, 9]);
    const pulse = busy ? 0.6 + 0.4 * Math.sin(t * 10) : 0.5 + 0.2 * Math.sin(t * 2);
    const cg = ctx.createRadialGradient(core[0], core[1], 0, core[0], core[1], 10);
    cg.addColorStop(0, `rgba(216,255,233,${pulse})`); cg.addColorStop(1, 'rgba(70,255,154,0)');
    ctx.globalAlpha = 1; ctx.fillStyle = cg; ctx.beginPath(); ctx.arc(core[0], core[1], 10, 0, 7); ctx.fill();
    // beam to the room it is delegating to
    if (hand && ultron.pointT > 0) {
      const h = proj(hand), tr = ROOMS[ultron.point];
      const tx = tr.x + tr.w / 2, ty = tr.y + tr.h / 2;
      ctx.globalAlpha = Math.min(1, ultron.pointT) * 0.7; ctx.strokeStyle = C.g; ctx.lineWidth = 1.5; ctx.setLineDash([2, 5]); ctx.lineDashOffset = -t * 60;
      ctx.beginPath(); ctx.moveTo(h[0], h[1]); ctx.lineTo(tx, ty); ctx.stroke(); ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
    // scanlines over the figure
    ctx.globalAlpha = 0.12; for (let yy = fy - 140; yy < fy; yy += 3) px(cx - 60, yy, 120, 1, '#000'); ctx.globalAlpha = 1;
    placeBubble('ultron', cx, fy - 150);
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
    drawSpace(dt);
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

  window.Station = { init, setBusy, packet, highlight, launchShuttle, ROOMS };
  window.Core = Core;
})();
