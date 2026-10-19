// Kivo Ultron — pixel-art station renderer + commander core
(function () {
  const W = 640, H = 360;
  const C = { g: '#46ff9a', gd: '#1d7a48', warn: '#ffc247', bad: '#ff5a4f', info: '#5ac8ff' };

  const ROOMS = {
    scout:   { x: 30,  y: 22,  w: 140, h: 86,  crew: '#5ac8ff', path: [[100, 65], [100, 120], [320, 120], [320, 180]] },
    analyst: { x: 250, y: 16,  w: 140, h: 72,  crew: '#c38bff', path: [[320, 52], [320, 180]] },
    scribe:  { x: 470, y: 22,  w: 140, h: 86,  crew: '#ffd36b', path: [[540, 65], [540, 120], [320, 120], [320, 180]] },
    forge:   { x: 30,  y: 150, w: 150, h: 110, crew: '#ff8a5a', path: [[105, 205], [320, 205], [320, 180]] },
    ultron:  { x: 255, y: 130, w: 130, h: 100, crew: '#46ff9a', path: [[320, 180]] },
    auditor: { x: 460, y: 150, w: 150, h: 100, crew: '#ff6b8b', path: [[535, 200], [320, 200], [320, 180]] },
    ledger:  { x: 150, y: 285, w: 130, h: 60,  crew: '#b6ff5a', path: [[215, 315], [215, 258], [300, 258], [300, 180]] },
    courier: { x: 360, y: 280, w: 150, h: 66,  crew: '#7ee8ff', path: [[435, 313], [435, 258], [340, 258], [340, 180]] },
  };

  let ctx, canvas, labelsEl, onSelect = () => {};
  const state = {};
  const packets = [];
  let stars = [], t = 0, last = 0, selected = null, shuttle = { phase: 'docked', t: 0 }, ship = null;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function px(x, y, w, h, c) { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); }

  function init(cv, lbl, cb) {
    canvas = cv; ctx = cv.getContext('2d'); labelsEl = lbl; onSelect = cb || onSelect;
    ctx.imageSmoothingEnabled = false;
    for (let i = 0; i < 220; i++) stars.push({ x: rnd(0, W), y: rnd(0, H), s: Math.random() < 0.1 ? 2 : 1, p: rnd(0, 6.28), v: rnd(1, 4) });
    for (const [id, r] of Object.entries(ROOMS)) {
      state[id] = { busy: false, err: false, text: '', crew: [] };
      const n = id === 'ultron' ? 2 : 3;
      for (let i = 0; i < n; i++) state[id].crew.push({ x: rnd(r.x + 10, r.x + r.w - 10), y: rnd(r.y + 22, r.y + r.h - 10), tx: 0, ty: 0, wait: rnd(0, 2), step: 0 });
      const el = document.createElement('div');
      el.className = 'rlabel'; el.dataset.id = id;
      el.innerHTML = `${id.toUpperCase()}<span class="t"></span>`;
      el.addEventListener('click', () => onSelect(id));
      labelsEl.appendChild(el);
      state[id].el = el;
    }
    new ResizeObserver(placeLabels).observe(canvas);
    placeLabels();
    requestAnimationFrame(loop);
  }

  function placeLabels() {
    const r = canvas.getBoundingClientRect();
    const s = Math.min(r.width / W, r.height / H);
    const ox = (r.width - W * s) / 2, oy = (r.height - H * s) / 2;
    for (const [id, room] of Object.entries(ROOMS)) {
      const el = state[id].el;
      el.style.left = (ox + (room.x + room.w / 2) * s) + 'px';
      el.style.top = (oy + room.y * s - 2) + 'px';
    }
  }

  function setBusy(id, busy, text, err) {
    const s = state[id]; if (!s) return;
    s.busy = !!busy; s.err = !!err; if (text !== undefined) s.text = text || '';
    s.el.classList.toggle('busy', s.busy);
    s.el.querySelector('.t').textContent = s.text;
  }
  function highlight(id) { selected = id; }

  function packet(from, to, color) {
    const a = ROOMS[from], b = ROOMS[to]; if (!a || !b) return;
    const pts = a.path.slice();
    const back = b.path.slice().reverse();
    const route = pts.concat(back.slice(1));
    packets.push({ route, i: 0, x: route[0][0], y: route[0][1], c: color || C.g, trail: [] });
  }
  function launchShuttle() { if (shuttle.phase === 'docked') { shuttle.phase = 'out'; shuttle.t = 0; } }

  // ---------- drawing ----------
  function drawSpace(dt) {
    px(0, 0, W, H, '#020403');
    for (const s of stars) {
      s.x -= s.v * dt * 0.6; if (s.x < 0) { s.x = W; s.y = rnd(0, H); }
      const a = 0.35 + 0.65 * Math.abs(Math.sin(t * 0.8 + s.p));
      ctx.globalAlpha = a; px(s.x, s.y, s.s, s.s, s.s > 1 ? '#bfffe0' : '#6f8f80'); ctx.globalAlpha = 1;
    }
    // planet
    ctx.fillStyle = '#0d2a1b'; ctx.beginPath(); ctx.arc(612, 352, 60, 0, 7); ctx.fill();
    ctx.fillStyle = '#123a25'; ctx.beginPath(); ctx.arc(600, 342, 46, 0, 7); ctx.fill();
    for (let i = 0; i < 6; i++) px(560 + i * 12, 318 + (i % 3) * 9, 8, 2, '#1b5236');
    // passing ship
    if (!ship && Math.random() < dt * 0.05) ship = { x: -20, y: rnd(110, 140), v: rnd(30, 60) };
    if (ship) {
      ship.x += ship.v * dt;
      px(ship.x, ship.y, 10, 3, '#6d7a74'); px(ship.x + 10, ship.y + 1, 3, 1, '#9fb'); px(ship.x - 3, ship.y + 1, 3, 1, C.warn);
      if (ship.x > W + 20) ship = null;
    }
  }

  function corridor(path) {
    for (let i = 0; i < path.length - 1; i++) {
      const [x1, y1] = path[i], [x2, y2] = path[i + 1];
      const x = Math.min(x1, x2) - 6, y = Math.min(y1, y2) - 6;
      const w = Math.abs(x2 - x1) + 12, h = Math.abs(y2 - y1) + 12;
      px(x - 1, y - 1, w + 2, h + 2, '#3b4246');
      px(x, y, w, h, '#22282b');
      px(x + 2, y + 2, w - 4, h - 4, '#111614');
      // runway lights
      const horiz = w > h;
      const len = horiz ? w : h;
      for (let k = 6; k < len - 4; k += 10) {
        const on = ((k / 10 + t * 4) | 0) % 6 === 0;
        if (horiz) px(x + k, y + h / 2, 2, 1, on ? C.g : '#1c3326');
        else px(x + w / 2, y + k, 1, 2, on ? C.g : '#1c3326');
      }
    }
  }

  function roomShell(id, r) {
    const s = state[id];
    // hull
    px(r.x - 4, r.y - 4, r.w + 8, r.h + 8, '#41494d');
    px(r.x - 3, r.y - 3, r.w + 6, r.h + 6, '#2a3134');
    for (let i = r.x; i < r.x + r.w; i += 16) px(i, r.y - 3, 1, r.h + 6, '#252b2e');
    // floor
    px(r.x, r.y, r.w, r.h, '#0f1412');
    for (let gx = r.x; gx < r.x + r.w; gx += 8) px(gx, r.y, 1, r.h, '#141b17');
    for (let gy = r.y; gy < r.y + r.h; gy += 8) px(r.x, gy, r.w, 1, '#141b17');
    // top wall + light strip
    px(r.x, r.y, r.w, 12, '#1b2124');
    const pulse = s.busy ? 0.55 + 0.45 * Math.sin(t * 8) : 0.35;
    const col = s.err ? C.bad : s.busy ? C.warn : C.g;
    ctx.globalAlpha = pulse; px(r.x + 3, r.y + 10, r.w - 6, 1, col); ctx.globalAlpha = 1;
    // room glow
    if (s.busy) { ctx.globalAlpha = 0.06 + 0.04 * Math.sin(t * 6); px(r.x, r.y, r.w, r.h, col); ctx.globalAlpha = 1; }
    if (selected === id) {
      ctx.strokeStyle = C.g; ctx.lineWidth = 1; ctx.setLineDash([3, 2]); ctx.lineDashOffset = -t * 10;
      ctx.strokeRect(r.x - 6.5, r.y - 6.5, r.w + 13, r.h + 13); ctx.setLineDash([]);
    }
    // wall screens
    for (let i = 0; i < Math.floor(r.w / 26); i++) {
      const sx = r.x + 6 + i * 26;
      px(sx, r.y + 2, 18, 7, '#050806');
      const fl = s.busy ? (Math.sin(t * 10 + i) > 0 ? C.g : C.gd) : C.gd;
      px(sx + 2, r.y + 4, 4 + ((t * 3 + i * 2) % 10 | 0), 1, fl);
      px(sx + 2, r.y + 6, 10, 1, '#14402a');
    }
  }

  function crew(id, r, dt) {
    const s = state[id];
    for (const c of s.crew) {
      if (c.wait > 0) { c.wait -= dt * (s.busy ? 3 : 1); }
      else {
        if (!c.tx) { c.tx = rnd(r.x + 8, r.x + r.w - 8); c.ty = rnd(r.y + 18, r.y + r.h - 8); }
        const dx = c.tx - c.x, dy = c.ty - c.y, d = Math.hypot(dx, dy);
        const sp = (s.busy ? 28 : 10) * dt;
        if (d < sp) { c.x = c.tx; c.y = c.ty; c.tx = 0; c.wait = rnd(0.5, s.busy ? 1 : 4); }
        else { c.x += dx / d * sp; c.y += dy / d * sp; c.step += dt * (s.busy ? 12 : 6); }
      }
      const bob = c.tx ? (Math.sin(c.step) > 0 ? 1 : 0) : 0;
      px(c.x - 1, c.y - 6, 3, 2, '#e8c9a8');
      px(c.x - 1, c.y - 4, 3, 3, r.crew);
      px(c.x - 1, c.y - 1, 1, 1 + bob, '#222'); px(c.x + 1, c.y - 1, 1, 2 - bob, '#222');
    }
  }

  function props(id, r) {
    const s = state[id], b = s.busy;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2 + 6;
    switch (id) {
      case 'scout': {
        // radar dish
        ctx.strokeStyle = '#1d7a48'; ctx.beginPath(); ctx.arc(r.x + 34, cy + 6, 20, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.arc(r.x + 34, cy + 6, 12, 0, 7); ctx.stroke();
        const a = t * (b ? 4 : 1.2);
        ctx.strokeStyle = C.g; ctx.beginPath(); ctx.moveTo(r.x + 34, cy + 6); ctx.lineTo(r.x + 34 + Math.cos(a) * 20, cy + 6 + Math.sin(a) * 20); ctx.stroke();
        if (b) for (let i = 0; i < 3; i++) { const bx = r.x + 34 + Math.cos(i * 2 + t) * 14, by = cy + 6 + Math.sin(i * 2.3 + t) * 12; px(bx, by, 2, 2, C.warn); }
        for (let i = 0; i < 3; i++) { px(r.x + 70 + i * 22, cy - 6, 16, 9, '#2a3134'); px(r.x + 72 + i * 22, cy - 4, 12, 4, b ? C.g : C.gd); }
        break;
      }
      case 'analyst': {
        for (let i = 0; i < 9; i++) {
          const h = 6 + ((Math.sin(t * (b ? 3 : 0.7) + i * 0.9) + 1) * 9);
          px(r.x + 12 + i * 13, r.y + r.h - 8 - h, 8, h, i % 3 ? C.gd : '#c38bff');
        }
        break;
      }
      case 'scribe': {
        for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
          const dx = r.x + 14 + i * 42, dy = r.y + 26 + j * 28;
          px(dx, dy, 26, 8, '#3a3125'); px(dx + 8, dy - 6, 10, 6, '#050806');
          px(dx + 9, dy - 5, b ? ((t * 12 + i * 3 + j) % 8 | 0) + 1 : 3, 1, C.g);
        }
        break;
      }
      case 'forge': {
        for (let i = 0; i < 3; i++) {
          const mx = r.x + 10 + i * 46, my = r.y + 22;
          px(mx, my, 38, 26, '#2e3538'); px(mx + 2, my + 2, 34, 6, '#151a18');
          const head = b ? (Math.sin(t * 6 + i) + 1) * 14 : 4;
          px(mx + 3 + head, my + 3, 4, 4, C.warn);
          px(mx + 6, my + 12, 26, 12, '#e9e6df');
          if (b) { ctx.globalAlpha = 0.8; px(mx + 8, my + 14, Math.min(22, ((t * 6 + i * 5) % 22)), 8, ['#ff8a5a', '#ffd36b', '#c38bff'][i]); ctx.globalAlpha = 1; }
        }
        // shirt rack
        px(r.x + 10, r.y + r.h - 22, r.w - 20, 1, '#6d7a74');
        const tees = ['#f2efe8', '#f7c6d0', '#cfe8d6', '#2a2e33', '#ffe6a8', '#d9d2ff'];
        for (let i = 0; i < 9; i++) {
          const tx = r.x + 16 + i * 14, ty = r.y + r.h - 20;
          px(tx, ty, 10, 3, tees[i % tees.length]); px(tx + 2, ty + 3, 6, 8, tees[i % tees.length]);
        }
        break;
      }
      case 'ultron': {
        const rr = 22 + (b ? Math.sin(t * 8) * 2 : 0);
        ctx.strokeStyle = C.gd; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(cx, cy, rr + 8, 0, 7); ctx.stroke();
        ctx.strokeStyle = C.g; ctx.lineWidth = 1;
        for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(cx, cy, rr - i * 6, t * (i + 1) * (b ? 2 : 0.6), t * (i + 1) * (b ? 2 : 0.6) + 4); ctx.stroke(); }
        ctx.globalAlpha = 0.5 + 0.5 * Math.sin(t * (b ? 10 : 2));
        px(cx - 3, cy - 3, 6, 6, '#d8ffe9'); ctx.globalAlpha = 1;
        for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; px(cx + Math.cos(a) * 44 - 4, cy + Math.sin(a) * 34 - 3, 8, 6, '#2a3134'); px(cx + Math.cos(a) * 44 - 2, cy + Math.sin(a) * 34 - 2, 4, 2, C.g); }
        break;
      }
      case 'auditor': {
        px(cx - 30, r.y + 20, 4, r.h - 30, '#3a4044'); px(cx + 26, r.y + 20, 4, r.h - 30, '#3a4044');
        const ly = r.y + 22 + ((Math.sin(t * (b ? 4 : 1)) + 1) / 2) * (r.h - 36);
        ctx.globalAlpha = 0.85; px(cx - 26, ly, 52, 1, C.bad); ctx.globalAlpha = 0.2; px(cx - 26, ly - 2, 52, 5, C.bad); ctx.globalAlpha = 1;
        px(r.x + 10, r.y + r.h - 18, 18, 10, '#2a3134'); px(r.x + r.w - 28, r.y + r.h - 18, 18, 10, '#2a3134');
        px(r.x + 12, r.y + r.h - 16, 6, 2, C.g); px(r.x + r.w - 26, r.y + r.h - 16, 6, 2, b ? C.warn : C.g);
        break;
      }
      case 'ledger': {
        for (let i = 0; i < 5; i++) { const h = 4 + i * 3 + (b ? ((t * 5 + i) % 3 | 0) : 0); for (let k = 0; k < h; k += 2) px(r.x + 12 + i * 10, r.y + r.h - 8 - k, 7, 1, k % 4 ? '#c9a23a' : '#ffd36b'); }
        px(r.x + 70, r.y + 18, 50, 32, '#050806');
        ctx.strokeStyle = C.g; ctx.beginPath();
        for (let i = 0; i <= 10; i++) { const yy = r.y + 44 - i * 2 - Math.sin(i + t * (b ? 3 : 0.5)) * 4; i ? ctx.lineTo(r.x + 72 + i * 4.6, yy) : ctx.moveTo(r.x + 72, yy); }
        ctx.stroke();
        break;
      }
      case 'courier': {
        // bay doors
        px(r.x + r.w - 4, r.y + 14, 4, r.h - 20, '#55606a');
        for (let i = 0; i < 4; i++) { px(r.x + 10 + i * 12, r.y + r.h - 16, 9, 8, '#7a5a34'); px(r.x + 10 + i * 12, r.y + r.h - 13, 9, 1, '#4a3420'); }
        let sx = r.x + 70, sy = r.y + 28;
        if (shuttle.phase !== 'docked') {
          shuttle.t += 1 / 60;
          const k = shuttle.t;
          if (shuttle.phase === 'out') { sx += k * k * 120; if (sx > W + 40) { shuttle.phase = 'back'; shuttle.t = 0; } }
          else { sx = W + 40 - Math.min(1, k / 3) * (W + 40 - (r.x + 70)); if (k >= 3) shuttle.phase = 'docked'; }
          if (shuttle.phase === 'out' && Math.sin(t * 40) > 0) px(sx - 6, sy + 6, 6, 3, C.warn);
        }
        px(sx, sy, 34, 14, '#c9d1cc'); px(sx + 26, sy + 3, 8, 6, '#5ac8ff'); px(sx + 4, sy + 14, 20, 3, '#6d7a74'); px(sx - 2, sy + 4, 2, 6, '#6d7a74');
        px(sx + 8, sy + 5, 10, 2, C.g);
        break;
      }
    }
  }

  function drawPackets(dt) {
    for (let i = packets.length - 1; i >= 0; i--) {
      const p = packets[i];
      const tgt = p.route[p.i + 1];
      if (!tgt) { packets.splice(i, 1); continue; }
      const dx = tgt[0] - p.x, dy = tgt[1] - p.y, d = Math.hypot(dx, dy), sp = 140 * dt;
      if (d <= sp) { p.x = tgt[0]; p.y = tgt[1]; p.i++; } else { p.x += dx / d * sp; p.y += dy / d * sp; }
      p.trail.push([p.x, p.y]); if (p.trail.length > 10) p.trail.shift();
      p.trail.forEach((q, k) => { ctx.globalAlpha = k / 14; px(q[0] - 1, q[1] - 1, 2, 2, p.c); });
      ctx.globalAlpha = 1; px(p.x - 2, p.y - 2, 4, 4, p.c); ctx.globalAlpha = 0.25; px(p.x - 4, p.y - 4, 8, 8, p.c); ctx.globalAlpha = 1;
    }
  }

  function loop(ts) {
    const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts; t += dt;
    drawSpace(dt);
    for (const r of Object.values(ROOMS)) corridor(r.path);
    for (const [id, r] of Object.entries(ROOMS)) roomShell(id, r);
    for (const [id, r] of Object.entries(ROOMS)) { props(id, r); crew(id, r, dt); }
    drawPackets(dt);
    requestAnimationFrame(loop);
  }

  // ---------- commander core (wireframe sphere) ----------
  const Core = (() => {
    let c, x, active = false, tt = 0, pts = [];
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
      const rot = pts.map(([a, b, d]) => { const ca = Math.cos(tt), sa = Math.sin(tt), cb = Math.cos(0.4), sb = Math.sin(0.4); const X = a * ca - d * sa, Z = a * sa + d * ca; const Y = b * cb - Z * sb, Z2 = b * sb + Z * cb; return [X, Y, Z2]; });
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
