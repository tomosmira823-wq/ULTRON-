// Kivo Ultron — isometric neon office floor. One factory, used by the Marketing floor and every custom space.
(function () {
  const TW = 48, TH = 24, ZU = 24;           // tile width/height (2:1 iso), pixels per height unit
  const N = 24;                              // floor is N x N tiles; back corner at (0,0)
  const WALL_H = 7.2;
  const OK = '#46ff9a', BAD = '#ff5a4f';
  const iso = (u, v, z = 0) => [(u - v) * TW / 2, (u + v) * TH / 2 - z * ZU];

  // colour theme from one hue (260 = the original marketing purple)
  function theme(h) {
    h = Math.round(((Number(h) % 360) + 360) % 360);
    const c = (s, l, a) => (a == null ? `hsl(${h} ${s}% ${l}%)` : `hsl(${h} ${s}% ${l}% / ${a})`);
    const b = (h + 345) % 360;
    return {
      hue: h, neon: c(100, 71), neon2: c(100, 83), a: (x) => c(100, 71, x), a2: (x) => c(100, 83, x), ink: (x) => c(100, 90, x),
      floor: c(46, 6), grid: c(40, 49), wallR: c(46, 8), wallL: c(46, 7), deskTop: c(46, 13), deskL: c(48, 9), deskR: c(46, 11),
      plat: [c(48, 11), c(48, 8), c(48, 10)], body1: `hsl(${b} 67% 51%)`, body2: `hsl(${b} 100% 68%)`, chest: c(100, 83), chestIdle: `hsl(${b} 100% 74%)`,
      eye: c(100, 90), eyeIdle: c(100, 83), scrOn: c(100, 93), scrOff: c(60, 74), panel: c(52, 8, 0.92), chip: c(44, 7, 0.92),
      chipTxt: c(100, 96), chipSub: c(30, 77), chipIdle: c(15, 59), bg1: c(56, 9), bg2: c(60, 2), card: c(45, 4),
      brain: `hsl(${(h + 60) % 360} 100% 74%)`, brainGlow: `hsl(${(h + 25) % 360} 100% 71%)`, brainHalo: (x) => `hsl(${(h + 20) % 360} 100% 74% / ${x})`,
    };
  }

  const STYLES = { office: 'Neon office', trading: 'Trading floor', studio: 'Studio', lab: 'Lab', workshop: 'Print shop', station: 'Space station' };
  // the seven floor slots around the hub, used for zones
  const SLOTS = [
    { u: [8, 13.5], v: [1.2, 4.6] }, { u: [15, 22.5], v: [1.2, 5.2] }, { u: [15.5, 22.5], v: [7.6, 12.4] }, { u: [13.5, 22.5], v: [15.5, 20.5] },
    { u: [6.5, 12.5], v: [16, 22.5] }, { u: [1.2, 5.5], v: [15, 22.5] }, { u: [1.2, 5.2], v: [7.5, 13] },
  ];
  // extra desks for bots hired onto the marketing floor (free space between the chief, the hub and the zones)
  const EXTRA = [{ u: [6.2, 14.6], v: [5.4, 7.9], label: 'NEW HIRES', gap: 1.95 }, { u: [5.9, 8.7], v: [8.5, 14.3], label: 'NEW HIRES', gap: 1.95 }];
  const deskSlots = (z) => {
    const du = z.u[1] - z.u[0], dv = z.v[1] - z.v[0], alongU = du >= dv, L = alongU ? du : dv, S = alongU ? dv : du;
    const cols = Math.max(1, Math.floor((L - 0.4) / (z.gap || 2.4))), rows = Math.max(1, Math.floor((S - 0.6) / 2.3));
    const out = [];
    for (let r = 0; r < rows; r++) for (let k = 0; k < cols; k++) {
      const a = (alongU ? z.u[0] : z.v[0]) + (k + 0.5) * L / cols;
      const b = (alongU ? z.v[0] : z.u[0]) + (rows === 1 ? S / 2 - 0.2 : (r + 0.5) * S / rows - 0.2);
      out.push(alongU ? { u: a, v: b } : { u: b, v: a });
    }
    return out;
  };
  // lay out any list of agents [{id, name, team, icon}] onto the slots, grouped by team
  function autoLayout(list) {
    const caps = SLOTS.map(deskSlots), used = SLOTS.map(() => 0), zones = [], agents = [];
    const teamOf = (a) => (a.team || 'TEAM').toUpperCase().slice(0, 18);
    const teams = [...new Set(list.map(teamOf))];
    const free = (i) => used[i] < caps[i].length;
    let s = -1;
    for (const team of teams) {
      // each team gets its own zone while there are empty zones left
      const next = used.findIndex((u, i) => i > s && u === 0);
      s = next >= 0 ? next : used.findIndex((u, i) => free(i));
      for (const a of list.filter((x) => teamOf(x) === team)) {
        if (s < 0 || !free(s)) s = used.findIndex((u, i) => u === 0) >= 0 ? used.findIndex((u) => u === 0) : used.findIndex((u, i) => free(i));
        if (s < 0) break;
        const zid = 'z' + s;
        let z = zones.find((x) => x.id === zid);
        if (!z) { z = { id: zid, label: team, u: SLOTS[s].u, v: SLOTS[s].v }; zones.push(z); }
        else if (!z.label.split(' · ').includes(team)) z.label = (z.label + ' · ' + team).slice(0, 30);
        const p = caps[s][used[s]++];
        agents.push({ id: a.id, zone: zid, u: p.u, v: p.v, name: a.name, icon: a.icon || 'doc' });
      }
    }
    return { zones, agents, capacity: caps.reduce((n, c) => n + c.length, 0) };
  }

  function create(cfg) {
    let ZONES = cfg.zones || [], AGENTS = cfg.agents || [], BASE = { zones: ZONES, agents: AGENTS };
    let style = STYLES[cfg.style] ? cfg.style : 'office', ticker = cfg.ticker || '';
    let T = theme(cfg.hue ?? 260), chiefTitle = cfg.chiefTitle || 'ULTRON · CHIEF OF STAFF', chiefIdle = cfg.chiefIdle || 'Coordinating the team';
    const CHIEF = { id: 'ultron', u: 4.0, v: 4.0, name: 'ULTRON', role: 'Chief of Staff' };
    const HUB = { u: 11.2, v: 10.8 };
    let room = null;      // a fixed, hand-made layout (rooms.js) instead of the generic slots
    let hovered = null;   // agent under the mouse
    const walkers = [];   // bots walking work over to the next desk
    let hubKind = null;   // room centrepiece style
    let canvas, ctx, onSelect = () => {}, t = 0, last = 0;
    const view = { s: 1 };
    const cam = { x: 0, y: 0, z: 1 }, camT = { x: 0, y: 0, z: 1 };
    let focused = null, visible = false;
    const st = { ultron: { busy: false, text: '', err: false, bob: 0 } };
    const zoneBusy = {};
    const packets = [];
    let media = [];               // [{img, label}]
    let headL = cfg.headL || '', headR = cfg.headR || '';
    let bounds = null;
    const ensure = () => { for (const a of AGENTS) if (!st[a.id]) st[a.id] = { busy: false, text: '', err: false, bob: Math.random() * 6 }; };
    ensure();

    function computeBounds() {
      bounds = { x0: iso(0, N)[0] - 18, x1: iso(N, 0)[0] + 18, y0: iso(0, 0, 6.3)[1] - 6, y1: iso(N, N)[1] + 14 };
      bounds.w = bounds.x1 - bounds.x0; bounds.h = bounds.y1 - bounds.y0;
      bounds.cx = (bounds.x0 + bounds.x1) / 2; bounds.cy = (bounds.y0 + bounds.y1) / 2;
    }
    computeBounds();
    cam.x = camT.x = bounds.cx; cam.y = camT.y = bounds.cy;

    function init(cv, cb) {
      canvas = cv; ctx = cv.getContext('2d'); onSelect = cb || onSelect;
      canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        const [wx, wy] = screenToWorld(e);
        const z0 = camT.z, z1 = Math.max(1, Math.min(4, z0 * (e.deltaY < 0 ? 1.18 : 1 / 1.18)));
        camT.x = wx - (wx - camT.x) * z0 / z1; camT.y = wy - (wy - camT.y) * z0 / z1; camT.z = z1;
        if (z1 === 1 && !focused) { camT.x = bounds.cx; camT.y = bounds.cy; }
      }, { passive: false });
      let drag = null;
      canvas.addEventListener('mousedown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: false }; });
      canvas.addEventListener('mousemove', (e) => { if (drag?.moved) return; const [wx, wy] = screenToWorld(e); const h = hitAgent(wx, wy); if (h !== hovered) { hovered = h; canvas.style.cursor = h ? 'pointer' : ''; } });
      canvas.addEventListener('mouseleave', () => { hovered = null; });
      window.addEventListener('mousemove', (e) => {
        if (!drag || !visible) return;
        const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;
        if (!drag.moved) return;
        camT.x -= dx / (view.s * camT.z); camT.y -= dy / (view.s * camT.z); cam.x = camT.x; cam.y = camT.y;
        drag.x = e.clientX; drag.y = e.clientY; canvas.style.cursor = 'grabbing';
      });
      window.addEventListener('mouseup', () => { if (drag) setTimeout(() => (drag = null), 0); if (canvas) canvas.style.cursor = ''; });
      canvas.addEventListener('dblclick', () => { if (focused) onSelect(null); else Object.assign(camT, { x: bounds.cx, y: bounds.cy, z: 1 }); });
      canvas.addEventListener('click', (e) => {
        if (drag?.moved) return;
        const [wx, wy] = screenToWorld(e);
        const hit = hitTest(wx, wy);
        if (hit) onSelect(hit); else if (focused) onSelect(null);
      });
      new ResizeObserver(fit).observe(canvas);
      fit();
      requestAnimationFrame(loop);
    }
    function screenToWorld(e) {
      const r = canvas.getBoundingClientRect();
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      const k = view.s * cam.z;
      return [(sx - canvas.width / 2) / k + cam.x, (sy - canvas.height / 2) / k + cam.y];
    }
    function fit() {
      if (!canvas) return;
      const r = canvas.getBoundingClientRect();
      const cw = Math.max(1, Math.round(r.width)), ch = Math.max(1, Math.round(r.height));
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      view.s = Math.min(cw / bounds.w, ch / bounds.h);
    }
    function hitAgent(wx, wy) {
      for (const a of AGENTS) { const [x, y] = iso(a.u, a.v); if (Math.hypot(wx - x, (wy - (y - 18)) * 1.4) < 22) return a.id; }
      const [cx, cy] = iso(CHIEF.u, CHIEF.v, 1.4); if (Math.hypot(wx - cx, wy - (cy - 16)) < 34) return 'ultron';
      return null;
    }
    function hitTest(wx, wy) {
      for (const a of AGENTS) { const [x, y] = iso(a.u, a.v); if (Math.hypot(wx - x, (wy - (y - 18)) * 1.4) < 26) return a.id; }
      const [cx, cy] = iso(CHIEF.u, CHIEF.v, 1.4); if (Math.hypot(wx - cx, wy - (cy - 16)) < 40) return 'ultron';
      const u = (wx / (TW / 2) + wy / (TH / 2)) / 2, v = (wy / (TH / 2) - wx / (TW / 2)) / 2;
      for (const z of ZONES) if (u >= z.u[0] && u <= z.u[1] && v >= z.v[0] && v <= z.v[1]) return AGENTS.find((a) => a.zone === z.id)?.id || (z.empty ? z.empty : room && z.spare ? 'hire' : null);
      return null;
    }

    // ---------- public state ----------
    function recalcZones() { for (const z of ZONES) zoneBusy[z.id] = AGENTS.some((a) => a.zone === z.id && st[a.id]?.busy); }
    function setBusy(id, busy, text, err) {
      const s = st[id]; if (!s) return;
      s.busy = !!busy; s.text = text || ''; s.err = !!err;
      recalcZones();
    }
    const find = (id) => (id === 'ultron' ? CHIEF : AGENTS.find((x) => x.id === id));
    function packet(from, to, color) {
      const a = find(from), b = find(to);
      if (!a || !b) return;
      if (from !== 'ultron' && to !== 'ultron' && from !== to && st[from]) { walk(a, b); return; }
      const mid = room && !room.hub ? [(a.u + b.u) / 2 + 0.6, (a.v + b.v) / 2 + 0.6] : [HUB.u, HUB.v];
      packets.push({ pts: [iso(a.u, a.v, 0.2), iso(mid[0], mid[1], 0.2), iso(b.u, b.v, 0.2)], i: 0, p: 0, c: color || T.neon2 });
    }
    function focus(id) {
      focused = id && find(id) ? id : null;
      if (!focused) { Object.assign(camT, { x: bounds.cx, y: bounds.cy, z: 1 }); return; }
      const a = find(focused);
      const zone = ZONES.find((z) => z.id === a.zone);
      const [x, y] = zone ? iso((zone.u[0] + zone.u[1]) / 2, (zone.v[0] + zone.v[1]) / 2) : iso(a.u, a.v, 1);
      const z = 2.3;
      Object.assign(camT, { z, x: x + ((canvas?.width || 800) * 0.46 / 2) / (view.s * z), y: y - 30 });
    }
    // replace the whole floor (custom spaces)
    // place a crew on a room's desks: desks with "for" go to that agent id, the rest fill in order, extras use spare desks
    function roomLayout(rm, list) {
      const desks = rm.desks.map((d) => ({ ...d })), spare = (rm.spare || []).map((d) => ({ ...d, spare: true })), used = new Set(), out = [];
      const take = (d, a) => { used.add(d); out.push({ id: a.id, zone: d.zone, u: d.u, v: d.v, name: a.name, icon: a.icon || d.icon || 'doc', kind: d.kind || 'desk', hired: !!d.spare }); };
      const rest = [];
      for (const a of list) { const d = desks.find((x) => x.for === a.id); if (d) take(d, a); else rest.push(a); }
      const free = [...desks.filter((d) => !d.for && !used.has(d)), ...spare];
      rest.forEach((a, i) => { if (free[i]) take(free[i], a); });
      return out;
    }
    function applyRoom(rm, list) {
      room = rm;
      Object.assign(CHIEF, rm.chief || { u: 4, v: 4 });
      if (rm.hub) Object.assign(HUB, rm.hub); hubKind = rm.hub?.kind || null;
      ZONES = rm.zones.map((z) => ({ ...z }));
      AGENTS = roomLayout(rm, list || []);
      for (const z of ZONES) z.spare = !AGENTS.some((a) => a.zone === z.id) && (rm.spare || []).some((d) => d.zone === z.id);
      BASE = { zones: ZONES, agents: AGENTS, list: list || [] };
    }
    function configure(o) {
      if (o.room !== undefined) {
        if (o.room) { if (o.hue == null) T = theme(o.room.hue); if (o.room.style) style = o.room.style; applyRoom(o.room, o.agents || BASE.list || []); }
        else { room = null; hubKind = null; Object.assign(CHIEF, { u: 4, v: 4 }); Object.assign(HUB, { u: 11.2, v: 10.8 }); }
      }
      if (o.hue != null) T = theme(o.hue);
      if (o.style && STYLES[o.style]) style = o.style;
      if (o.ticker != null) ticker = o.ticker;
      if (o.chiefTitle) chiefTitle = o.chiefTitle;
      if (o.chiefIdle) chiefIdle = o.chiefIdle;
      if (o.agents && room) applyRoom(room, o.agents);
      else if (o.agents) {
        const L = autoLayout(o.agents);
        ZONES = L.zones; AGENTS = L.agents;
        if (!AGENTS.length) ZONES = [{ id: 'z0', label: 'EMPTY DESKS · CLICK TO HIRE', u: SLOTS[0].u, v: SLOTS[0].v, empty: 'hire' }];
        BASE = { zones: ZONES, agents: AGENTS };
      }
      if (o.headers) { headL = o.headers[0]; headR = o.headers[1]; }
      if (o.media) media = o.media;
      ensure(); recalcZones();
      if (focused && !find(focused)) focus(null);
    }
    // bots hired onto a fixed floor (marketing): extra desks in the free space
    function setExtras(list) {
      if (room) { applyRoom(room, [...BASE.list.filter((a) => !a.hired), ...list.map((a) => ({ ...a, hired: true }))]); ensure(); recalcZones(); return { placed: AGENTS.filter((a) => a.hired).length, capacity: (room.spare || []).length }; }
      const zs = [], as = [];
      let i = 0;
      EXTRA.forEach((z, zi) => {
        const slots = deskSlots(z), zid = 'hire' + zi, mine = [];
        for (const p of slots) { const a = list[i]; if (!a) break; mine.push({ id: a.id, zone: zid, u: p.u, v: p.v, name: a.name, icon: a.icon || 'doc', hired: true }); i++; }
        if (mine.length) { zs.push({ id: zid, label: z.label, u: z.u, v: z.v }); as.push(...mine); }
      });
      ZONES = [...BASE.zones, ...zs]; AGENTS = [...BASE.agents, ...as];
      ensure(); recalcZones();
      return { placed: i, capacity: EXTRA.reduce((n, z) => n + deskSlots(z).length, 0) };
    }
    // the sender gets up, carries the work to the next desk, drops it and walks back
    function walk(a, b) {
      for (let i = walkers.length - 1; i >= 0; i--) if (walkers[i].id === a.id) walkers.splice(i, 1);
      const aisle = (x) => [x.u + 0.2, x.v + 1.15];
      const out = [[a.u, a.v - 0.1], aisle(a), [aisle(b)[0], aisle(a)[1]], aisle(b), [b.u + 0.75, b.v + 0.95]];
      walkers.push({ id: a.id, to: b.id, pts: out, back: [...out].reverse(), i: 0, p: 0, phase: 'out', drop: 0 });
      st[a.id].away = true;
    }
    function stepWalkers(dt) {
      for (let k = walkers.length - 1; k >= 0; k--) {
        const w = walkers[k], path = w.phase === 'out' ? w.pts : w.back;
        if (w.phase === 'drop') { w.drop += dt; if (w.drop > 0.6) { w.phase = 'back'; w.i = 0; w.p = 0; } continue; }
        const A = path[w.i], B = path[w.i + 1];
        if (!B) { if (w.phase === 'out') { w.phase = 'drop'; w.drop = 0; } else { walkers.splice(k, 1); if (st[w.id]) st[w.id].away = false; } continue; }
        const len = Math.hypot(B[0] - A[0], B[1] - A[1]) || 0.01; w.p += (dt * 4.2) / len;
        if (w.p >= 1) { w.p = 0; w.i++; }
      }
    }
    function walkerPos(w) {
      const path = w.phase === 'back' ? w.back : w.pts;
      if (w.phase === 'drop') return path[path.length - 1];
      const A = path[w.i], B = path[w.i + 1] || A;
      return [A[0] + (B[0] - A[0]) * w.p, A[1] + (B[1] - A[1]) * w.p];
    }
    function drawWalker(w) {
      const [u, v] = walkerPos(w), [x, y] = iso(u, v, 0.05), moving = w.phase !== 'drop';
      const step = moving ? Math.sin(t * 14) : 0;
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.beginPath(); ctx.ellipse(x, y + 1, 7, 2.6, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = '#2a2d33'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(x - 2.5, y - 8); ctx.lineTo(x - 2.5 + step * 2, y); ctx.moveTo(x + 2.5, y - 8); ctx.lineTo(x + 2.5 - step * 2, y); ctx.stroke();
      robot(x, y - 7, 0.72, false, false, 0);
      if (w.phase === 'out' || w.phase === 'drop') {
        const fy = y - 30 - (w.phase === 'drop' ? w.drop * 16 : 0); ctx.globalAlpha = w.phase === 'drop' ? Math.max(0, 1 - w.drop / 0.6) : 1;
        ctx.fillStyle = '#f4f2ea'; ctx.fillRect(x + 6, fy, 8, 10); ctx.fillStyle = T.neon; ctx.fillRect(x + 7.5, fy + 2.5, 5, 1); ctx.fillRect(x + 7.5, fy + 5, 4, 1);
        ctx.globalAlpha = 1;
      }
    }
    function setMedia(list) { media = list || []; }
    function setHeaders(l, r) { headL = l; headR = r; }
    function show(on) { visible = !!on; if (on) requestAnimationFrame(fit); }

    // ---------- drawing helpers ----------
    function poly(pts, fill, stroke, lw = 1, glow = 0) {
      ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath();
      if (fill) { ctx.fillStyle = fill; ctx.fill(); }
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; if (glow) { ctx.shadowColor = stroke; ctx.shadowBlur = glow; } ctx.stroke(); ctx.shadowBlur = 0; }
    }
    const rectUV = (u0, u1, v0, v1, z = 0) => [iso(u0, v0, z), iso(u1, v0, z), iso(u1, v1, z), iso(u0, v1, z)];
    function box(u0, u1, v0, v1, z0, z1, top, left, right, edge) {
      const TT = rectUV(u0, u1, v0, v1, z1);
      poly([iso(u0, v1, z0), iso(u1, v1, z0), iso(u1, v1, z1), iso(u0, v1, z1)], left);
      poly([iso(u1, v0, z0), iso(u1, v1, z0), iso(u1, v1, z1), iso(u1, v0, z1)], right);
      poly(TT, top, edge, 1);
    }
    function chip(x, y, title, text, busy, err) {
      ctx.font = '600 11px Inter, sans-serif';
      if (text && text.length > 34) text = text.slice(0, 33) + '…';
      const tw = ctx.measureText(title).width; ctx.font = '400 11px Inter, sans-serif';
      const xw = text ? ctx.measureText(text).width + 8 : 0;
      const w = tw + xw + 28, h = 20, x0 = x - w / 2, y0 = y - h;
      ctx.beginPath(); ctx.roundRect(x0, y0, w, h, 10);
      ctx.fillStyle = T.chip; ctx.fill();
      ctx.strokeStyle = err ? BAD : busy ? T.neon2 : T.a2(0.45); ctx.lineWidth = 1;
      if (busy) { ctx.shadowColor = T.neon; ctx.shadowBlur = 10; } ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = err ? BAD : busy ? OK : T.chipIdle; ctx.beginPath(); ctx.arc(x0 + 11, y0 + 10, 3, 0, 7); ctx.fill();
      ctx.fillStyle = T.chipTxt; ctx.font = '600 11px Inter, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(title, x0 + 19, y0 + 10.5);
      if (text) { ctx.fillStyle = T.chipSub; ctx.font = '400 11px Inter, sans-serif'; ctx.fillText(text, x0 + 23 + tw, y0 + 10.5); }
    }
    function floorText(text, u, v, axis, size = 12) {
      const [x, y] = iso(u, v);
      ctx.save(); ctx.translate(x, y);
      if (axis === 'u') ctx.transform(1, 0.5, 0, 1, 0, 0); else ctx.transform(1, -0.5, 0, 1, 0, 0);
      ctx.font = `600 ${room ? Math.min(size, 9) : size}px Michroma, sans-serif`; ctx.fillStyle = T.a2(room ? 0.42 : 0.75); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.letterSpacing = '3px'; ctx.fillText(text, 0, 0); ctx.letterSpacing = '0px';
      ctx.restore(); ctx.textAlign = 'left';
    }

    // ---------- scene ----------
    const line = (a, b) => { ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); };
    const styleRef = () => style;
    function drawFloor() {
      const style = room?.floor || styleRef();
      const base = room?.floorColor || { office: T.floor, workshop: `hsl(${T.hue} 6% 9%)`, trading: `hsl(${T.hue} 30% 5%)`, studio: 'hsl(24 34% 13%)', lab: `hsl(${T.hue} 16% 17%)`, station: `hsl(${T.hue} 12% 7%)`, carpet: `hsl(${T.hue} 18% 11%)` }[style] || T.floor;
      poly(rectUV(0, N, 0, N), base, T.a(0.35), 1.2);
      ctx.lineWidth = 0.6;
      if (style === 'studio') {
        ctx.strokeStyle = 'hsl(24 30% 8%)'; ctx.globalAlpha = 0.9;
        for (let i = 1; i < N; i++) line(iso(0, i), iso(N, i));
        for (let i = 0; i < N; i++) for (let k = (i % 3) * 2 + 1; k < N; k += 6) line(iso(k, i), iso(k, i + 1));
      } else if (style === 'workshop') {
        ctx.strokeStyle = `hsl(${T.hue} 6% 16%)`; ctx.globalAlpha = 0.9;
        for (let i = 4; i < N; i += 4) { line(iso(i, 0), iso(i, N)); line(iso(0, i), iso(N, i)); }
        ctx.globalAlpha = 0.5; ctx.strokeStyle = '#ffc247'; ctx.setLineDash([6, 6]); line(iso(0.6, 0.6), iso(N - 0.6, 0.6)); line(iso(0.6, 0.6), iso(0.6, N - 0.6)); ctx.setLineDash([]);
      } else if (style === 'lab') {
        ctx.strokeStyle = T.a2(0.35); ctx.globalAlpha = 0.7;
        for (let i = 1; i < N; i++) { line(iso(i, 0), iso(i, N)); line(iso(0, i), iso(N, i)); }
      } else if (style === 'station') {
        ctx.strokeStyle = T.grid; ctx.globalAlpha = 0.3;
        for (let i = 3; i < N; i += 3) { line(iso(i, 0), iso(i, N)); line(iso(0, i), iso(N, i)); }
        ctx.globalAlpha = 0.45; ctx.fillStyle = T.a2(0.6);
        for (let i = 3; i < N; i += 3) for (let k = 3; k < N; k += 3) { const [x, y] = iso(i, k); ctx.fillRect(x - 0.8, y - 0.8, 1.6, 1.6); }
      } else if (style === 'trading') {
        ctx.strokeStyle = T.a(0.5); ctx.globalAlpha = 0.25;
        for (let i = 3; i < N; i += 3) line(iso(0, i), iso(N, i));
      } else {
        ctx.globalAlpha = 0.18; ctx.strokeStyle = T.grid;
        for (let i = 2; i < N; i += 2) { line(iso(i, 0), iso(i, N)); line(iso(0, i), iso(N, i)); }
      }
      ctx.globalAlpha = 1;
    }
    // decoration painted on the walls above the media cards
    function wallQuad(wall, s0, s1, z0, z1, fill, stroke, lw = 1) { poly([wallBasis(wall, s0, z0), wallBasis(wall, s1, z0), wallBasis(wall, s1, z1), wallBasis(wall, s0, z1)], fill, stroke, lw); }
    function drawWallDecor() {
      for (const wall of ['left', 'right']) {
        if (style === 'trading') {
          wallQuad(wall, 0.3, N - 0.3, 5.15, 5.95, '#020203', T.a(0.6));
          const txt = (ticker || `${headL}     ${headR}`).toUpperCase() + '     ';
          ctx.save(); ctx.beginPath(); const q = [wallBasis(wall, 0.3, 5.15), wallBasis(wall, N - 0.3, 5.15), wallBasis(wall, N - 0.3, 5.95), wallBasis(wall, 0.3, 5.95)]; q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
          const off = ((t * 1.6) % 14);
          for (let k = -1; k < 3; k++) wallText(txt, wall, 0.5 + k * 14 - off, 5.55, OK, 9);
          ctx.restore();
        } else if (style === 'studio') {
          for (let i = 0; i < 22; i++) for (let j = 0; j < 2; j++) { const s0 = 0.4 + i * 1.06, z0 = 5.05 + j * 0.72; wallQuad(wall, s0, s0 + 0.98, z0, z0 + 0.66, (i + j) % 2 ? 'hsl(0 0% 9%)' : 'hsl(0 0% 6%)', 'rgba(0,0,0,.6)'); }
          if (wall === 'right') { wallQuad(wall, N - 4.6, N - 1.2, 3.3, 4.3, Math.sin(t * 2) > -0.6 ? 'hsl(0 90% 45%)' : 'hsl(0 50% 18%)', '#ff6b6b', 1.4); wallText('ON AIR', wall, N - 4.0, 3.8, '#fff', 11); }
        } else if (style === 'lab') {
          for (let i = 0; i <= N; i += 2.4) { ctx.strokeStyle = T.a2(0.3); ctx.lineWidth = 1; line(wallBasis(wall, i, 0), wallBasis(wall, i, WALL_H)); }
          wallQuad(wall, 0.2, N - 0.2, 5.1, 6.2, T.a(0.06), T.a2(0.25));
        } else if (style === 'workshop') {
          wallQuad(wall, 0.3, N - 0.3, 5.05, 6.3, `hsl(${T.hue} 8% 12%)`, T.a(0.3));
          ctx.fillStyle = 'rgba(0,0,0,.6)'; for (let i = 0.6; i < N - 0.4; i += 0.5) for (let z = 5.25; z < 6.2; z += 0.3) { const [x, y] = wallBasis(wall, i, z); ctx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8); }
          for (let i = 0.3; i < N - 0.6; i += 0.9) wallQuad(wall, i, i + 0.45, 0, 0.35, '#ffc247', null), wallQuad(wall, i + 0.45, i + 0.9, 0, 0.35, '#111', null);
        } else if (style === 'station') {
          for (let i = 0; i < 4; i++) {
            const s0 = 1 + i * 5.7, s1 = s0 + 4.6;
            wallQuad(wall, s0, s1, 5.0, 6.4, '#01020a', T.a(0.7), 1.4);
            ctx.fillStyle = '#fff';
            for (let k = 0; k < 14; k++) { const ss = s0 + ((k * 0.37 + i * 0.9 + t * 0.05 * (k % 3 + 1)) % 1) * (s1 - s0), zz = 5.1 + ((k * 0.61) % 1) * 1.2; const [x, y] = wallBasis(wall, ss, zz); ctx.globalAlpha = 0.4 + 0.6 * Math.abs(Math.sin(t + k)); ctx.fillRect(x, y, k % 5 ? 1 : 2, k % 5 ? 1 : 2); }
            ctx.globalAlpha = 1;
          }
        }
      }
    }
    function drawWalls() {
      poly([iso(0, 0), iso(N, 0), iso(N, 0, WALL_H), iso(0, 0, WALL_H)], T.wallR, T.a(0.55), 1.2, 6);
      poly([iso(0, 0), iso(0, N), iso(0, N, WALL_H), iso(0, 0, WALL_H)], T.wallL, T.a(0.55), 1.2, 6);
      for (const [a, b] of [[iso(0, 0, WALL_H), iso(N, 0, WALL_H)], [iso(0, 0, WALL_H), iso(0, N, WALL_H)], [iso(0, 0), iso(0, 0, WALL_H)]]) {
        ctx.strokeStyle = T.neon; ctx.lineWidth = 2; ctx.shadowColor = T.neon; ctx.shadowBlur = 14; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.shadowBlur = 0;
      }
      if (room?.walls) room.walls(API); else drawWallDecor();
      wallText(String(headL).toUpperCase(), 'left', 2.6, WALL_H - 0.55);
      wallText(String(headR).toUpperCase(), 'right', 2.6, WALL_H - 0.55);
      const per = 9, cw = 1.9, gap = 0.55, ch = 3.2;
      let k = 0;
      for (const wall of ['left', 'right']) {
        const slots = room?.cards ? room.cards[wall] || [] : [0, 1, 2, 3, 4, 5, 6, 7, 8];
        for (const i of slots) {
          const s0 = 1.1 + i * (cw + gap);
          const z0 = room?.cardZ || 1.6, z1 = z0 + ch;
          wallCard(wall, s0, s0 + cw, z0, z1, media[k], k); k++;
        }
      }
    }
    function wallBasis(wall, s, z) { return wall === 'right' ? iso(s, 0, z) : iso(0, s, z); }
    function wallText(text, wall, s, z, color, size) {
      const [x, y] = wallBasis(wall, s, z);
      ctx.save(); ctx.translate(x, y);
      ctx.transform(1, wall === 'right' ? 0.5 : -0.5, 0, 1, 0, 0);
      ctx.font = `600 ${size || 10}px Michroma, sans-serif`; ctx.fillStyle = color || T.ink(0.85); ctx.textBaseline = 'middle';
      ctx.letterSpacing = '2px'; ctx.fillText(text, wall === 'left' ? -ctx.measureText(text).width : 0, 0); ctx.letterSpacing = '0px';
      ctx.restore();
    }
    function wallCard(wall, s0, s1, z0, z1, item, k) {
      if (room && !item) return; // rooms only hang real work on the walls, no empty frames
      const p00 = wallBasis(wall, s0, z0), p10 = wallBasis(wall, s1, z0), p11 = wallBasis(wall, s1, z1), p01 = wallBasis(wall, s0, z1);
      const quad = wall === 'right' ? [p01, p11, p10, p00] : [p11, p01, p00, p10];
      poly(quad, T.card, item ? T.a2(0.85) : T.a(0.35), 1.2, item ? 10 : 0);
      if (item?.img?.complete && item.img.naturalWidth) {
        const [tl, tr, , bl] = quad;
        const w = item.img.naturalWidth, h = item.img.naturalHeight;
        ctx.save();
        ctx.beginPath(); quad.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
        ctx.setTransform(...matMul(ctx.getTransform(), [(tr[0] - tl[0]) / w, (tr[1] - tl[1]) / w, (bl[0] - tl[0]) / h, (bl[1] - tl[1]) / h, tl[0], tl[1]]));
        ctx.drawImage(item.img, 0, 0);
        ctx.restore();
        if (item.label) { const [bx, by] = quad[3]; ctx.font = '600 9px Inter, sans-serif'; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(bx + 3, by - 15, ctx.measureText(item.label).width + 8, 12); ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(item.label, bx + 7, by - 9); }
      } else {
        const c = quad.reduce((a, p) => [a[0] + p[0] / 4, a[1] + p[1] / 4], [0, 0]);
        ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t * 1.5 + k); ctx.strokeStyle = T.neon2; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(c[0], c[1], 6, 0, 7); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(c[0] - 2, c[1] - 3); ctx.lineTo(c[0] + 3, c[1]); ctx.lineTo(c[0] - 2, c[1] + 3); ctx.closePath(); ctx.fillStyle = T.neon2; ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
    function matMul(m, n) {
      const [a, b, c, d, e, f] = n;
      return [m.a * a + m.c * b, m.b * a + m.d * b, m.a * c + m.c * d, m.b * c + m.d * d, m.a * e + m.c * f + m.e, m.b * e + m.d * f + m.f];
    }
    function drawZones() {
      for (const z of ZONES) {
        const busy = zoneBusy[z.id];
        if (room) poly(rectUV(z.u[0], z.u[1], z.v[0], z.v[1], 0.02), busy ? T.a(0.08) : null, busy ? T.neon2 : T.a(0.28), busy ? 1.6 : 0.9, busy ? 14 : 0);
        else {
          poly(rectUV(z.u[0], z.u[1], z.v[0], z.v[1], 0.02), busy ? T.a(0.10) : T.a(0.04), busy ? T.neon2 : T.a(0.7), busy ? 1.8 : 1.2, busy ? 16 : 8);
          poly(rectUV(z.u[0] + 0.25, z.u[1] - 0.25, z.v[0] + 0.25, z.v[1] - 0.25, 0.02), null, T.a(0.18), 1);
        }
        const alongU = (z.u[1] - z.u[0]) >= (z.v[1] - z.v[0]);
        const size = z.label.length > 16 ? 9 : 11;
        if (alongU) floorText(z.label, (z.u[0] + z.u[1]) / 2, z.v[1] + 0.55, 'u', size);
        else floorText(z.label, z.u[1] + 0.55, (z.v[0] + z.v[1]) / 2, 'v', size);
        if (z.empty) { const [x, y] = iso((z.u[0] + z.u[1]) / 2, (z.v[0] + z.v[1]) / 2); ctx.globalAlpha = 0.5 + 0.3 * Math.sin(t * 2); ctx.fillStyle = T.neon2; ctx.font = '600 30px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', x, y); ctx.textAlign = 'left'; ctx.globalAlpha = 1; }
      }
    }
    function drawLinks() {
      const hub = iso(HUB.u, HUB.v, 0.02);
      ctx.setLineDash([3, 6]); ctx.lineDashOffset = -t * 20;
      for (const z of ZONES) {
        const c = iso((z.u[0] + z.u[1]) / 2, (z.v[0] + z.v[1]) / 2, 0.02);
        ctx.strokeStyle = zoneBusy[z.id] ? T.a2(0.75) : T.a(0.28); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(hub[0], hub[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
      }
      const ch = iso(CHIEF.u, CHIEF.v, 0.02);
      ctx.strokeStyle = T.a2(0.5); ctx.beginPath(); ctx.moveTo(hub[0], hub[1]); ctx.lineTo(ch[0], ch[1]); ctx.stroke();
      ctx.setLineDash([]);
    }
    function drawHub() {
      const [x, y] = iso(HUB.u, HUB.v);
      const busy = st.ultron.busy || Object.values(zoneBusy).some(Boolean);
      for (let i = 0; i < 3; i++) { ctx.strokeStyle = T.a(0.5 - i * 0.12); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.ellipse(x, y, 70 + i * 18, 35 + i * 9, 0, 0, 7); ctx.stroke(); }
      ctx.setLineDash([4, 8]); ctx.lineDashOffset = t * (busy ? 30 : 8); ctx.strokeStyle = T.a2(0.6); ctx.beginPath(); ctx.ellipse(x, y, 58, 29, 0, 0, 7); ctx.stroke(); ctx.setLineDash([]);
      const by = y - 46 + Math.sin(t * 1.4) * 3, pulse = busy ? 0.75 + 0.25 * Math.sin(t * 6) : 0.55 + 0.1 * Math.sin(t * 2);
      const hk = room ? hubKind : style; if (hk && hk !== 'office' && hk !== 'brain') { drawHubAlt(x, y, by, pulse, busy, hk); return; }
      const g = ctx.createRadialGradient(x, by, 4, x, by, 70); g.addColorStop(0, T.brainHalo(0.35 * pulse)); g.addColorStop(1, T.a(0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, by, 72, 50, 0, 0, 7); ctx.fill();
      ctx.save(); ctx.translate(x, by); ctx.strokeStyle = T.brain; ctx.lineWidth = 2; ctx.shadowColor = T.brainGlow; ctx.shadowBlur = 16 * pulse; ctx.globalAlpha = 0.8 + 0.2 * pulse;
      const lobe = (sx) => {
        ctx.beginPath(); ctx.moveTo(0, -24); ctx.bezierCurveTo(sx * 18, -34, sx * 44, -26, sx * 42, -6); ctx.bezierCurveTo(sx * 50, 6, sx * 38, 24, sx * 18, 22); ctx.bezierCurveTo(sx * 10, 26, 0, 22, 0, 18); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx * 8, -16); ctx.bezierCurveTo(sx * 22, -20, sx * 30, -8, sx * 22, 0); ctx.bezierCurveTo(sx * 30, 8, sx * 22, 16, sx * 10, 12); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(sx * 30, -18); ctx.bezierCurveTo(sx * 36, -10, sx * 34, -2, sx * 38, 4); ctx.stroke();
      };
      lobe(1); lobe(-1); ctx.beginPath(); ctx.moveTo(0, -24); ctx.lineTo(0, 18); ctx.stroke();
      ctx.restore(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
      const bg = ctx.createLinearGradient(0, y, 0, by); bg.addColorStop(0, T.a(0.18)); bg.addColorStop(1, T.a(0));
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.lineTo(x + 26, y); ctx.lineTo(x + 40, by); ctx.lineTo(x - 40, by); ctx.closePath(); ctx.fill();
    }
    function drawHubAlt(x, y, by, pulse, busy, style) {
      const g = ctx.createRadialGradient(x, by, 4, x, by, 70); g.addColorStop(0, T.a2(0.3 * pulse)); g.addColorStop(1, T.a(0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, by, 72, 50, 0, 0, 7); ctx.fill();
      const bg = ctx.createLinearGradient(0, y, 0, by); bg.addColorStop(0, T.a(0.18)); bg.addColorStop(1, T.a(0));
      ctx.fillStyle = bg; ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.lineTo(x + 26, y); ctx.lineTo(x + 40, by); ctx.lineTo(x - 40, by); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(x, by); ctx.strokeStyle = T.neon2; ctx.fillStyle = T.neon2; ctx.lineWidth = 1.6; ctx.shadowColor = T.neon; ctx.shadowBlur = 14 * pulse;
      const sp = t * (busy ? 1.6 : 0.5);
      if (style === 'trading' || style === 'station' || style === 'globe') {
        // wireframe globe
        const R = 34; ctx.beginPath(); ctx.arc(0, 0, R, 0, 7); ctx.stroke();
        for (let i = 0; i < 4; i++) { const a = sp + i * Math.PI / 4; ctx.globalAlpha = 0.35 + 0.5 * Math.abs(Math.cos(a)); ctx.beginPath(); ctx.ellipse(0, 0, Math.abs(Math.cos(a)) * R, R, 0, 0, 7); ctx.stroke(); }
        ctx.globalAlpha = 0.6; for (const k of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.ellipse(0, k * R, R * Math.sqrt(1 - k * k), 6 * Math.sqrt(1 - k * k), 0, 0, 7); ctx.stroke(); }
        if (style === 'station') { ctx.globalAlpha = 0.8; ctx.beginPath(); ctx.ellipse(0, 0, R * 1.6, R * 0.45, -0.3, 0, 7); ctx.stroke(); const a = sp * 2; ctx.beginPath(); ctx.arc(Math.cos(a) * R * 1.6 * Math.cos(-0.3) - Math.sin(a) * R * 0.45 * Math.sin(-0.3), Math.cos(a) * R * 1.6 * Math.sin(-0.3) + Math.sin(a) * R * 0.45 * Math.cos(-0.3), 3, 0, 7); ctx.fill(); }
      } else if (style === 'studio') {
        // speaker cone + live waveform ring
        for (let i = 0; i < 3; i++) { ctx.globalAlpha = 0.9 - i * 0.25; ctx.beginPath(); ctx.arc(0, 0, 10 + i * 10 + (busy ? Math.sin(t * 12) * 1.5 : 0), 0, 7); ctx.stroke(); }
        ctx.globalAlpha = 0.9; ctx.beginPath();
        for (let i = 0; i <= 64; i++) { const a = i / 64 * Math.PI * 2, r = 40 + Math.sin(i * 1.7 + t * 6) * Math.sin(i * 0.5 + t * 2) * (busy ? 8 : 3); i ? ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r * 0.9) : ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r * 0.9); }
        ctx.closePath(); ctx.stroke();
      } else if (style === 'lab' || style === 'helix') {
        // rotating double helix
        for (let i = 0; i <= 26; i++) {
          const yy = -34 + i * 2.6, a = sp * 2 + i * 0.45, x1 = Math.sin(a) * 18, x2 = -x1, d = Math.cos(a);
          ctx.globalAlpha = 0.35 + 0.3 * (d + 1); ctx.beginPath(); ctx.arc(x1, yy, 2.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(x2, yy, 2.2, 0, 7); ctx.fill();
          if (i % 2 === 0) { ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.moveTo(x1, yy); ctx.lineTo(x2, yy); ctx.stroke(); }
        }
      } else if (style === 'workshop') {
        // turning gear over a print press
        const teeth = 12, R = 30;
        ctx.beginPath();
        for (let i = 0; i < teeth * 2; i++) { const a = sp + i * Math.PI / teeth, r = i % 2 ? R : R + 7; const a2 = a + Math.PI / teeth; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); ctx.lineTo(Math.cos(a2) * r, Math.sin(a2) * r); }
        ctx.closePath(); ctx.stroke(); ctx.beginPath(); ctx.arc(0, 0, 10, 0, 7); ctx.stroke();
        for (let i = 0; i < 6; i++) { const a = -sp * 1.5 + i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 10, Math.sin(a) * 10); ctx.lineTo(Math.cos(a) * R * 0.8, Math.sin(a) * R * 0.8); ctx.stroke(); }
      }
      ctx.restore(); ctx.shadowBlur = 0; ctx.globalAlpha = 1;
    }
    function robot(x, y, s, busy, err, bob, faceRed) {
      y += Math.sin(t * (busy ? 6 : 1.6) + bob) * (busy ? 1.4 : 0.8);
      ctx.fillStyle = T.a(busy ? 0.35 : 0.18); ctx.beginPath(); ctx.ellipse(x, y + 2, 12 * s, 5 * s, 0, 0, 7); ctx.fill();
      const bodyG = ctx.createLinearGradient(x - 9 * s, 0, x + 9 * s, 0); bodyG.addColorStop(0, T.body1); bodyG.addColorStop(1, T.body2);
      ctx.fillStyle = bodyG; ctx.beginPath(); ctx.roundRect(x - 8 * s, y - 20 * s, 16 * s, 18 * s, 6 * s); ctx.fill();
      ctx.fillStyle = busy ? T.chest : T.chestIdle; ctx.beginPath(); ctx.roundRect(x - 3 * s, y - 14 * s, 6 * s, 6 * s, 2 * s); ctx.fill();
      ctx.fillStyle = '#f4f2fb'; ctx.beginPath(); ctx.ellipse(x, y - 28 * s, 11 * s, 9 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = '#121019'; ctx.beginPath(); ctx.roundRect(x - 8 * s, y - 32 * s, 16 * s, 8 * s, 4 * s); ctx.fill();
      const blink = Math.sin(t * 0.9 + bob * 3) > 0.985;
      ctx.fillStyle = err ? BAD : faceRed ? '#ff3b3b' : busy ? T.eye : T.eyeIdle;
      if (!blink) { ctx.beginPath(); ctx.arc(x - 3.5 * s, y - 28 * s, 1.8 * s, 0, 7); ctx.arc(x + 3.5 * s, y - 28 * s, 1.8 * s, 0, 7); ctx.fill(); }
      if (busy) { ctx.strokeStyle = T.a2(0.7); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x, y - 28 * s, 13 * s, 11 * s, 0, 0, 7); ctx.stroke(); }
    }
    function screenIcon(kind, x, y, w, h, busy) {
      ctx.strokeStyle = busy ? T.scrOn : T.scrOff; ctx.fillStyle = busy ? T.scrOn : T.scrOff; ctx.lineWidth = 1.2;
      const k = t * (busy ? 3 : 0.6);
      switch (kind) {
        case 'wave': ctx.beginPath(); for (let i = 0; i <= 18; i++) { const xx = x + 4 + i * (w - 8) / 18, hh = Math.sin(i * 1.3 + k) * Math.sin(i * 0.4 + k * 0.5) * h * 0.32; ctx.moveTo(xx, y + h / 2 - hh); ctx.lineTo(xx, y + h / 2 + hh); } ctx.stroke(); break;
        case 'chart': for (let i = 0; i < 5; i++) { const hh = (0.25 + 0.6 * Math.abs(Math.sin(i * 1.7 + k))) * (h - 8); ctx.fillRect(x + 5 + i * (w - 10) / 5, y + h - 4 - hh, (w - 10) / 5 - 3, hh); } break;
        case 'cal': for (let r = 0; r < 3; r++) for (let c = 0; c < 5; c++) { ctx.globalAlpha = (r * 5 + c + Math.floor(k)) % 7 === 0 ? 1 : 0.35; ctx.fillRect(x + 5 + c * (w - 10) / 5, y + 5 + r * (h - 10) / 3, (w - 10) / 5 - 2, (h - 10) / 3 - 2); } ctx.globalAlpha = 1; break;
        case 'radar': ctx.beginPath(); ctx.arc(x + w / 2, y + h / 2, h * 0.36, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + w / 2, y + h / 2); ctx.lineTo(x + w / 2 + Math.cos(k) * h * 0.36, y + h / 2 + Math.sin(k) * h * 0.36); ctx.stroke(); break;
        case 'image': case 'grid': for (let r = 0; r < 2; r++) for (let c = 0; c < 3; c++) ctx.strokeRect(x + 5 + c * (w - 10) / 3, y + 5 + r * (h - 10) / 2, (w - 10) / 3 - 3, (h - 10) / 2 - 3); break;
        case 'palette': ['#ff7ad9', '#ffc247', '#46ff9a', '#5ac8ff'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(x + 9 + i * (w - 18) / 3, y + h / 2, 3.5, 0, 7); ctx.fill(); }); break;
        case 'film': ctx.strokeRect(x + 4, y + 4, w - 8, h - 8); for (let i = 0; i < 4; i++) ctx.fillRect(x + 6 + i * (w - 12) / 4, y + 5, 3, 2); ctx.fillRect(x + 4 + ((k * 6) % (w - 10)), y + 8, 2, h - 14); break;
        case 'send': ctx.beginPath(); ctx.moveTo(x + 6, y + h / 2); ctx.lineTo(x + w - 6, y + 5); ctx.lineTo(x + w / 2, y + h - 5); ctx.closePath(); ctx.stroke(); break;
        case 'chat': ctx.beginPath(); ctx.roundRect(x + 5, y + 5, w * 0.55, h * 0.35, 3); ctx.stroke(); ctx.beginPath(); ctx.roundRect(x + w * 0.35, y + h * 0.5, w * 0.55, h * 0.35, 3); ctx.stroke(); break;
        case 'flow': ctx.strokeRect(x + 5, y + 5, 10, 8); ctx.strokeRect(x + w - 15, y + 5, 10, 8); ctx.strokeRect(x + w / 2 - 5, y + h - 13, 10, 8); ctx.beginPath(); ctx.moveTo(x + 15, y + 9); ctx.lineTo(x + w - 15, y + 9); ctx.moveTo(x + w / 2, y + 9); ctx.lineTo(x + w / 2, y + h - 13); ctx.stroke(); break;
        case 'code': ctx.font = '600 9px monospace'; ctx.textBaseline = 'top'; ctx.fillText('</>', x + w / 2 - 9, y + 4); for (let i = 0; i < 2; i++) ctx.fillRect(x + 6 + (i ? 6 : 0), y + 15 + i * 5, (w - 16) * (0.5 + 0.4 * Math.abs(Math.sin(k + i))), 2); break;
        case 'money': ctx.font = '700 13px Inter, sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText('£', x + 6, y + h / 2); ctx.beginPath(); for (let i = 0; i <= 8; i++) { const xx = x + 16 + i * (w - 20) / 8, yy = y + h - 5 - (i * 1.4 + Math.sin(i + k) * 2.5); i ? ctx.lineTo(xx, yy) : ctx.moveTo(xx, yy); } ctx.stroke(); break;
        case 'search': ctx.beginPath(); ctx.arc(x + w / 2 - 2, y + h / 2 - 2, 6, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.moveTo(x + w / 2 + 2, y + h / 2 + 2); ctx.lineTo(x + w / 2 + 7, y + h / 2 + 7); ctx.stroke(); break;
        case 'mail': ctx.strokeRect(x + 8, y + 5, w - 16, h - 10); ctx.beginPath(); ctx.moveTo(x + 8, y + 5); ctx.lineTo(x + w / 2, y + h / 2 + 1); ctx.lineTo(x + w - 8, y + 5); ctx.stroke(); break;
        case 'check': ctx.beginPath(); ctx.moveTo(x + w / 2 - 8, y + h / 2); ctx.lineTo(x + w / 2 - 2, y + h / 2 + 6); ctx.lineTo(x + w / 2 + 9, y + h / 2 - 7); ctx.stroke(); break;
        default: for (let i = 0; i < 4; i++) ctx.fillRect(x + 5, y + 6 + i * (h - 10) / 4, (w - 10) * (i === 3 ? 0.5 : 0.9), 2);
      }
    }
    function deskFor(kind, u, v, busy) {
      if (kind === 'seat' || kind === 'stand' || kind === 'sofa') return;
      const top = room?.deskTop || T.deskTop, l = room?.deskL || T.deskL, r = room?.deskR || T.deskR;
      box(u - 0.55, u + 0.55, v + 0.15, v + 0.75, 0, 0.55, top, l, r, T.a(0.6));
      poly(rectUV(u - 0.42, u + 0.42, v + 0.3, v + 0.6, 0.56), busy ? T.a2(0.75) : T.a(0.35), null);
    }
    function deskGear(kind, u, v, busy) {
      if (kind === 'seat' || kind === 'stand' || kind === 'sofa') return;
      if (kind === 'trader') { monitor(u - 0.42, v + 0.32, 0.56, 0.36, 0.42, busy, 'chart'); monitor(u, v + 0.32, 0.56, 0.36, 0.42, busy, 'ticker'); monitor(u + 0.42, v + 0.32, 0.56, 0.36, 0.42, busy, 'candles'); }
      else if (kind === 'dual') { monitor(u - 0.24, v + 0.32, 0.56, 0.44, 0.4, busy, 'code'); monitor(u + 0.24, v + 0.32, 0.56, 0.44, 0.4, busy, 'code'); }
      else if (kind === 'edit') { monitor(u, v + 0.32, 0.56, 0.9, 0.55, busy, 'timeline'); }
      else if (kind === 'console') { poly(rectUV(u - 0.5, u + 0.5, v + 0.2, v + 0.7, 0.57), '#0c0d10', null); for (let i = 0; i < 8; i++) { const [x, y] = iso(u - 0.42 + i * 0.12, v + 0.45, 0.6); ctx.fillStyle = i % 3 ? '#9aa' : busy ? OK : '#555'; ctx.fillRect(x - 0.8, y - 3 - (busy ? Math.abs(Math.sin(t * 6 + i)) * 2 : 0), 1.6, 3); } }
      else if (kind === 'bench') { const [x, y] = iso(u + 0.35, v + 0.45, 0.56); ctx.strokeStyle = T.a2(0.85); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 2, y - 9); ctx.lineTo(x - 2, y - 5); ctx.lineTo(x - 5, y); ctx.lineTo(x + 5, y); ctx.lineTo(x + 2, y - 5); ctx.lineTo(x + 2, y - 9); ctx.stroke(); ctx.fillStyle = busy ? OK : T.a(0.6); ctx.fillRect(x - 4, y - 3, 8, 3); if (busy) { ctx.fillStyle = OK; ctx.beginPath(); ctx.arc(x, y - 11 - ((t * 8) % 6), 1.2, 0, 7); ctx.fill(); } monitor(u - 0.25, v + 0.32, 0.56, 0.4, 0.36, busy, 'chart'); }
      else if (kind === 'headset') monitor(u, v + 0.32, 0.56, 0.5, 0.4, busy, 'lines');
      else monitor(u, v + 0.32, 0.56, 0.5, 0.4, busy, 'lines');
    }
    function emptyDesk(sp) {
      deskFor(sp.kind || 'desk', sp.u, sp.v, false); deskGear(sp.kind || 'desk', sp.u, sp.v, false);
      if (sp.kind === 'seat') chair(sp.u, sp.v, room?.chairColor);
      const [x, y] = iso(sp.u, sp.v, 1.2); ctx.globalAlpha = 0.35 + 0.2 * Math.sin(t * 2 + sp.u); ctx.fillStyle = T.neon2; ctx.font = '600 14px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('+', x, y); ctx.textAlign = 'left'; ctx.globalAlpha = 1;
    }
    function drawAgent(a) {
      const s = st[a.id], busy = s.busy;
      if (room) {
        if (a.kind === 'seat') chair(a.u, a.v, room.chairColor);
        deskFor(a.kind, a.u, a.v, busy);
      } else {
      box(a.u - 0.55, a.u + 0.55, a.v + 0.15, a.v + 0.75, 0, 0.55, T.deskTop, T.deskL, T.deskR, T.a(0.6));
      poly(rectUV(a.u - 0.42, a.u + 0.42, a.v + 0.3, a.v + 0.6, 0.56), busy ? T.a2(0.75) : T.a(0.45), null);
      }
      const [rx, ry] = iso(a.u, a.v - 0.1, a.kind === 'seat' || a.kind === 'sofa' ? 0.15 : 0.3);
      if (!room) {
      if (style === 'trading') { const [mx, my] = iso(a.u + 0.45, a.v + 0.35, 0.56); ctx.fillStyle = '#05060a'; ctx.strokeStyle = busy ? T.neon2 : T.a(0.6); ctx.lineWidth = 1; ctx.beginPath(); ctx.rect(mx - 2, my - 13, 14, 11); ctx.fill(); ctx.stroke(); ctx.strokeStyle = OK; ctx.beginPath(); for (let i = 0; i < 6; i++) { const yy = my - 5 - Math.sin(i + t * (busy ? 3 : 0.5)) * 3; i ? ctx.lineTo(mx + i * 2, yy) : ctx.moveTo(mx, yy); } ctx.stroke(); }
      else if (style === 'studio') { const [mx, my] = iso(a.u - 0.6, a.v + 0.3, 0); ctx.strokeStyle = '#888'; ctx.lineWidth = 1.2; line([mx, my], [mx, my - 20]); line([mx, my - 20], [mx + 6, my - 24]); ctx.fillStyle = busy ? '#ff5a4f' : '#bbb'; ctx.beginPath(); ctx.ellipse(mx + 7, my - 26, 2.5, 3.5, 0.5, 0, 7); ctx.fill(); }
      else if (style === 'lab') { const [mx, my] = iso(a.u + 0.4, a.v + 0.4, 0.56); ctx.strokeStyle = T.a2(0.8); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(mx - 2, my - 9); ctx.lineTo(mx - 2, my - 5); ctx.lineTo(mx - 5, my); ctx.lineTo(mx + 5, my); ctx.lineTo(mx + 2, my - 5); ctx.lineTo(mx + 2, my - 9); ctx.stroke(); ctx.fillStyle = busy ? OK : T.a(0.6); ctx.fillRect(mx - 4, my - 3, 8, 3); if (busy) { ctx.fillStyle = OK; ctx.beginPath(); ctx.arc(mx, my - 11 - ((t * 8) % 6), 1.2, 0, 7); ctx.fill(); } }
      else if (style === 'workshop') { const [mx, my] = iso(a.u + 0.35, a.v + 0.45, 0.56); ctx.fillStyle = busy ? '#ffc247' : '#776'; ctx.fillRect(mx - 5, my - 5, 10, 4); ctx.fillStyle = '#f2efe8'; ctx.fillRect(mx - 3, my - 9, 6, 4); }
      }
      if (!s.away) robot(rx, ry, 0.85, busy, s.err, s.bob);
      if (room) deskGear(a.kind, a.u, a.v, busy);
      if (room && a.kind === 'headset') { ctx.strokeStyle = '#222'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(rx, ry - 24, 9, Math.PI * 1.05, Math.PI * 1.95); ctx.stroke(); ctx.fillStyle = busy ? OK : '#333'; ctx.beginPath(); ctx.arc(rx - 8.5, ry - 22, 2.2, 0, 7); ctx.fill(); }
      const showScreen = !room || busy || hovered === a.id || focused === a.id || (focused && find(focused)?.zone === a.zone);
      if (!showScreen) {
        const [nx, ny] = iso(a.u + 0.15, a.v + 1.0, 0);
        ctx.font = '600 8px Inter, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        const w = ctx.measureText(a.name).width + 8; ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.beginPath(); ctx.roundRect(nx - w / 2, ny - 6, w, 12, 3); ctx.fill();
        ctx.fillStyle = s.err ? BAD : T.a2(0.8); ctx.fillText(a.name, nx, ny + 0.3); ctx.textAlign = 'left';
        return;
      }
      const [px, py] = iso(a.u, a.v, 2.6);
      const [qx, qy] = iso(a.u, a.v - 0.1, 1.4);
      ctx.strokeStyle = T.a(0.5); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(qx + 14, qy); ctx.lineTo(px + 14, py); ctx.stroke();
      const sw = 46, sh = 30, sx = px - 6, sy = py - sh - 6;
      ctx.save(); ctx.translate(sx, sy); ctx.transform(1, -0.12, 0, 1, 0, 0);
      ctx.fillStyle = T.panel; ctx.strokeStyle = busy ? T.neon2 : T.a(0.6); ctx.lineWidth = 1;
      if (busy) { ctx.shadowColor = T.neon; ctx.shadowBlur = 10; }
      ctx.beginPath(); ctx.roundRect(0, 0, sw, sh, 3); ctx.fill(); ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = T.a2(0.85); ctx.font = '600 6px Inter, sans-serif'; ctx.textBaseline = 'top';
      let nm = a.name; while (nm.length > 3 && ctx.measureText(nm).width > sw - 6) nm = nm.slice(0, -1); ctx.fillText(nm === a.name ? nm : nm + '…', 4, 2);
      screenIcon(a.icon, 0, 8, sw, sh - 8, busy);
      ctx.restore();
    }
    function drawChief() {
      const s = st.ultron;
      for (let i = 0; i < 3; i++) {
        const r = 1.9 - i * 0.45, z = i * 0.35;
        box(CHIEF.u - r, CHIEF.u + r, CHIEF.v - r, CHIEF.v + r, z, z + 0.35, T.plat[0], T.plat[1], T.plat[2], i === 2 ? T.neon2 : T.a(0.65));
      }
      const [x, y] = iso(CHIEF.u, CHIEF.v, 1.05);
      robot(x, y, 1.35, s.busy, s.err, 0, true);
      const ry = y - 70 + Math.sin(t * 2) * 2;
      ctx.strokeStyle = T.neon2; ctx.lineWidth = 2.5; ctx.shadowColor = T.neon; ctx.shadowBlur = 14;
      ctx.beginPath(); ctx.arc(x, ry, 8, 0, 7); ctx.stroke(); ctx.shadowBlur = 0;
      chip(x, ry - 16, 'Chief', s.busy && s.text ? s.text : chiefIdle, s.busy, s.err);
      ctx.font = '600 9px Michroma, sans-serif'; ctx.fillStyle = T.ink(0.9); ctx.textAlign = 'center'; ctx.fillText(chiefTitle, x, y + 18); ctx.textAlign = 'left';
    }
    function drawZoneChips() {
      for (const z of ZONES) {
        const lead = AGENTS.filter((a) => a.zone === z.id);
        if (!lead.length) continue;
        const busyA = lead.find((a) => st[a.id].busy);
        const hov = lead.find((a) => a.id === hovered);
        if (room && !busyA && !hov && !lead.some((a) => st[a.id].err)) continue;
        const show = busyA || hov || lead[0];
        const [x, y] = iso((z.u[0] + z.u[1]) / 2, (z.v[0] + z.v[1]) / 2, 4.3);
        chip(x, y, show.name, busyA ? (st[busyA.id].text || 'Working') : 'Ready', !!busyA, lead.some((a) => st[a.id].err));
      }
    }
    function drawPackets(dt) {
      for (let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i]; p.p += dt * 1.6;
        if (p.p >= 1) { p.p = 0; p.i++; }
        if (p.i >= p.pts.length - 1) { packets.splice(i, 1); continue; }
        const a = p.pts[p.i], b = p.pts[p.i + 1];
        const x = a[0] + (b[0] - a[0]) * p.p, y = a[1] + (b[1] - a[1]) * p.p;
        ctx.fillStyle = p.c; ctx.shadowColor = p.c; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 7); ctx.fill(); ctx.shadowBlur = 0;
      }
    }


    // ---------- prop library for hand-made rooms (all in floor units: u, v, height z) ----------
    const RX = TW / Math.SQRT2, RY = TH / Math.SQRT2;
    function cyl(u, v, r, z0, z1, top, side, edge) {
      const [x, y0] = iso(u, v, z0), [, y1] = iso(u, v, z1), rx = r * RX, ry = r * RY;
      ctx.fillStyle = side; ctx.beginPath(); ctx.ellipse(x, y0, rx, ry, 0, 0, Math.PI); ctx.lineTo(x - rx, y1); ctx.lineTo(x + rx, y1); ctx.closePath(); ctx.fill();
      ctx.fillRect(x - rx, y1, rx * 2, y0 - y1);
      ctx.fillStyle = top; ctx.beginPath(); ctx.ellipse(x, y1, rx, ry, 0, 0, 7); ctx.fill();
      if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke(); }
    }
    function disc(u, v, r, z, fill, stroke, lw = 1) { const [x, y] = iso(u, v, z); ctx.beginPath(); ctx.ellipse(x, y, r * RX, r * RY, 0, 0, 7); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke(); } }
    function rug(u0, u1, v0, v1, fill, stroke) { poly(rectUV(u0, u1, v0, v1, 0.01), fill, stroke, 1); }
    // a flat screen standing upright, facing the viewer (plane of constant v)
    function screenAt(u0, u1, vv, z0, z1, fn, frame = '#0b0c10') {
      const p0 = iso(u0, vv, z1), p1 = iso(u1, vv, z1), p3 = iso(u0, vv, z0), p2 = iso(u1, vv, z0);
      poly([p0, p1, p2, p3], frame, 'rgba(255,255,255,.12)', 0.8);
      ctx.save(); ctx.beginPath(); [p0, p1, p2, p3].forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip();
      ctx.transform((p1[0] - p0[0]) / 100, (p1[1] - p0[1]) / 100, (p3[0] - p0[0]) / 60, (p3[1] - p0[1]) / 60, p0[0], p0[1]);
      fn(ctx); ctx.restore();
    }
    function screenArt(kind, on, hue) {
      const c1 = on ? OK : T.a2(0.6), c2 = on ? '#ffc247' : T.a(0.5), k = t * (on ? 2 : 0.4);
      return (x) => {
        x.lineWidth = 3;
        if (kind === 'chart') { x.strokeStyle = c1; x.beginPath(); for (let i = 0; i <= 12; i++) { const yy = 40 - i * 1.6 - Math.sin(i * 1.3 + k) * 8; i ? x.lineTo(8 + i * 7, yy) : x.moveTo(8, yy); } x.stroke(); }
        else if (kind === 'candles') { for (let i = 0; i < 9; i++) { const up = Math.sin(i * 2.1 + Math.floor(k)) > 0, h = 8 + Math.abs(Math.sin(i * 1.7 + k * 0.3)) * 22, y = 14 + Math.abs(Math.cos(i + k * 0.2)) * 18; x.fillStyle = up ? OK : BAD; x.fillRect(8 + i * 10, y, 6, h); } }
        else if (kind === 'ticker') { x.font = '700 11px monospace'; for (let i = 0; i < 4; i++) { x.fillStyle = (i + Math.floor(k)) % 3 ? OK : BAD; x.fillText(['FTSE ▲0.4', 'NVDA ▲1.2', 'GBP ▼0.1', 'BTC ▲2.3', 'AAPL ▼0.6'][(i + Math.floor(k / 2)) % 5], 6, 14 + i * 13); } }
        else if (kind === 'code') { const cs = ['#7ee8ff', '#ff8a5a', '#c38bff', '#b6ff5a', '#ffd36b']; for (let i = 0; i < 6; i++) { x.fillStyle = cs[(i + Math.floor(k)) % 5]; x.fillRect(8 + (i % 3) * 8, 7 + i * 8, 20 + ((i * 37 + Math.floor(k * 3)) % 50), 4); } }
        else if (kind === 'timeline') { const cs = ['#ff5a4f', '#5ac8ff', '#ffc247', '#46ff9a']; for (let r = 0; r < 3; r++) for (let i = 0; i < 4; i++) { x.fillStyle = cs[(r + i) % 4]; x.fillRect(6 + i * 23 + r * 5, 10 + r * 14, 18, 9); } x.fillStyle = '#fff'; x.fillRect(6 + ((k * 12) % 88), 4, 2, 52); }
        else if (kind === 'wave') { x.strokeStyle = c1; x.beginPath(); for (let i = 0; i <= 40; i++) { const xx = 6 + i * 2.2, a = Math.sin(i * 0.9 + k * 3) * Math.sin(i * 0.25 + k) * (on ? 20 : 6); x.moveTo(xx, 30 - a); x.lineTo(xx, 30 + a); } x.stroke(); }
        else { x.fillStyle = c1; for (let i = 0; i < 5; i++) x.fillRect(8, 8 + i * 10, (i === 4 ? 40 : 80) * (on ? 0.6 + 0.4 * Math.abs(Math.sin(k + i)) : 0.8), 4); x.fillStyle = c2; x.fillRect(70, 8, 22, 4); }
      };
    }
    function monitor(u, v, z, w, h, on, kind) { const [sx, sy] = iso(u, v, z); ctx.fillStyle = '#222'; ctx.fillRect(sx - 1, sy - 4, 2, 4); screenAt(u - w / 2, u + w / 2, v, z + 0.12, z + 0.12 + h, screenArt(kind, on)); }
    function chair(u, v, col) {
      const c = col || '#2a2d33';
      box(u - 0.3, u + 0.3, v - 0.35, v + 0.2, 0.32, 0.42, c, '#16181c', '#1d2024', null);
      box(u - 0.3, u + 0.3, v - 0.5, v - 0.38, 0.4, 1.15, c, '#16181c', '#1d2024', null);
    }
    function plant(u, v, s2 = 1) {
      cyl(u, v, 0.28 * s2, 0, 0.55 * s2, '#3a2a20', '#5a3d2a');
      const [x, y] = iso(u, v, 0.55 * s2);
      for (let i = 0; i < 7; i++) { const a = i / 7 * Math.PI * 2 + 0.3, r = 9 * s2; ctx.fillStyle = i % 2 ? '#2f8a4c' : '#3fae62'; ctx.beginPath(); ctx.ellipse(x + Math.cos(a) * r * 0.7, y - 10 * s2 + Math.sin(a) * r * 0.35 - Math.sin(t + i) * 0.6, 6 * s2, 3.4 * s2, a, 0, 7); ctx.fill(); }
      ctx.fillStyle = '#4cc274'; ctx.beginPath(); ctx.ellipse(x, y - 15 * s2, 5 * s2, 6 * s2, 0, 0, 7); ctx.fill();
    }
    // microphone on a boom arm, from a point on a table toward a seat
    function micArm(u0, v0, z0, u1, v1, live) {
      const a = iso(u0, v0, z0), b = iso(u0 + (u1 - u0) * 0.35, v0 + (v1 - v0) * 0.35, z0 + 1.1), c = iso(u0 + (u1 - u0) * 0.6, v0 + (v1 - v0) * 0.6, z0 + 0.95);
      ctx.strokeStyle = '#2b2d33'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
      ctx.fillStyle = '#15161a'; ctx.beginPath(); ctx.ellipse(c[0], c[1] + 2, 3.2, 5.5, 0.3, 0, 7); ctx.fill();
      ctx.strokeStyle = live ? '#ff5a4f' : '#555'; ctx.lineWidth = 1; ctx.stroke();
    }
    function tripod(u, v, h, aimU, aimV) {
      const top = iso(u, v, h);
      ctx.strokeStyle = '#3b3e45'; ctx.lineWidth = 1.5;
      for (const [du, dv] of [[0.45, 0], [-0.25, 0.4], [-0.25, -0.4]]) line(top, iso(u + du, v + dv, 0));
      const dir = Math.sign((aimU - aimV) - (u - v)) || 1;
      box(u - 0.28, u + 0.28, v - 0.2, v + 0.2, h, h + 0.5, '#2a2c31', '#17181b', '#202227', null);
      const [lx, ly] = iso(u, v, h + 0.25); ctx.fillStyle = '#0a0a0c'; ctx.beginPath(); ctx.ellipse(lx + dir * 9, ly + 2, 4, 5, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#555'; ctx.stroke();
      ctx.fillStyle = Math.sin(t * 3) > 0 ? '#ff3b3b' : '#550000'; ctx.beginPath(); ctx.arc(lx - dir * 5, ly - 5, 1.4, 0, 7); ctx.fill();
    }
    function softbox(u, v, h, warm) {
      const base = iso(u, v, 0), top = iso(u, v, h);
      ctx.strokeStyle = '#33353b'; ctx.lineWidth = 1.5; line(base, top); line(iso(u + 0.4, v, 0), top); line(iso(u, v + 0.4, 0), top);
      screenAt(u - 0.5, u + 0.5, v, h - 0.2, h + 0.8, (x) => { const g = x.createLinearGradient(0, 0, 0, 60); g.addColorStop(0, warm ? '#fff1d6' : '#ffffff'); g.addColorStop(1, warm ? '#ffd9a0' : '#dfe8ff'); x.fillStyle = g; x.fillRect(0, 0, 100, 60); }, '#444');
      const [gx, gy] = iso(u, v + 1.2, 0); const gg = ctx.createRadialGradient(gx, gy, 2, gx, gy, 60); gg.addColorStop(0, 'rgba(255,240,210,.10)'); gg.addColorStop(1, 'rgba(255,240,210,0)'); ctx.fillStyle = gg; ctx.beginPath(); ctx.ellipse(gx, gy, 60, 30, 0, 0, 7); ctx.fill();
    }
    function rack(u0, u1, v0, v1, h, busy) {
      box(u0, u1, v0, v1, 0, h, '#16181c', '#0d0e11', '#121317', T.a(0.5));
      for (let r = 0; r < Math.floor(h / 0.28); r++) for (let i = 0; i < 4; i++) {
        const [x, y] = iso(u0 + 0.12 + i * (u1 - u0 - 0.24) / 3, v1, 0.2 + r * 0.28);
        const on = Math.sin(t * (busy ? 9 : 3) + r * 1.7 + i * 2.3 + u0) > 0.2;
        ctx.fillStyle = on ? (i === 3 ? '#ffc247' : OK) : '#123'; ctx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8);
      }
    }
    function sofa(u0, u1, v0, v1, col, back) {
      const c = col || '#3a3f4a', d = '#262a32', e = '#2e333c';
      box(u0, u1, v0, v1, 0, 0.42, c, d, e, null);
      if (back === 'u') box(u0, u0 + 0.3, v0, v1, 0.42, 1.05, c, d, e, null); else box(u0, u1, v0, v0 + 0.3, 0.42, 1.05, c, d, e, null);
    }
    function glassWall(u0, v0, u1, v1, h) {
      poly([iso(u0, v0, 0), iso(u1, v1, 0), iso(u1, v1, h), iso(u0, v0, h)], 'rgba(170,220,255,.07)', 'rgba(170,220,255,.35)', 1);
      ctx.strokeStyle = 'rgba(200,235,255,.35)'; ctx.lineWidth = 1; line(iso(u0, v0, h), iso(u1, v1, h));
      ctx.globalAlpha = 0.18; ctx.strokeStyle = '#fff'; line(iso(u0 + (u1 - u0) * 0.2, v0 + (v1 - v0) * 0.2, h * 0.8), iso(u0 + (u1 - u0) * 0.32, v0 + (v1 - v0) * 0.32, h * 0.3)); ctx.globalAlpha = 1;
    }
    function crate(u, v, s2, col) { box(u - s2 / 2, u + s2 / 2, v - s2 / 2, v + s2 / 2, 0, s2 * 0.8, col || '#b58a52', '#8a6438', '#9e7444', 'rgba(0,0,0,.3)'); const [x, y] = iso(u, v, s2 * 0.8); ctx.strokeStyle = 'rgba(80,50,20,.6)'; ctx.beginPath(); ctx.moveTo(x - s2 * 12, y); ctx.lineTo(x + s2 * 12, y); ctx.stroke(); }
    function wallQuadAPI(wall, s0, s1, z0, z1, fill, stroke, lw) { poly([wallBasis(wall, s0, z0), wallBasis(wall, s1, z0), wallBasis(wall, s1, z1), wallBasis(wall, s0, z1)], fill, stroke, lw); }
    // draw into a wall rectangle with a 100 x 60 local canvas
    function wallPaint(wall, s0, s1, z0, z1, fn) {
      const p0 = wallBasis(wall, wall === 'right' ? s0 : s1, z1), p1 = wallBasis(wall, wall === 'right' ? s1 : s0, z1), p3 = wallBasis(wall, wall === 'right' ? s0 : s1, z0);
      ctx.save(); ctx.transform((p1[0] - p0[0]) / 100, (p1[1] - p0[1]) / 100, (p3[0] - p0[0]) / 60, (p3[1] - p0[1]) / 60, p0[0], p0[1]); fn(ctx); ctx.restore();
    }
    const API = {
      get ctx() { return ctx; }, get T() { return T; }, get t() { return t; }, N, WALL_H, OK, BAD,
      iso, poly, box, rectUV, line, cyl, disc, rug, screenAt, screenArt, monitor, chair, plant, micArm, tripod, softbox, rack, sofa, glassWall, crate,
      wallQuad: wallQuadAPI, wallPaint, wallClip(wall, s0, s1, z0, z1, fn) { const q = [wallBasis(wall, s0, z0), wallBasis(wall, s1, z0), wallBasis(wall, s1, z1), wallBasis(wall, s0, z1)]; ctx.save(); ctx.beginPath(); q.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); ctx.clip(); fn(); ctx.restore(); }, wallText: (...a) => wallText(...a), wallBasis: (...a) => wallBasis(...a), floorText: (...a) => floorText(...a),
      busy: (id) => !!st[id]?.busy, anyBusy: () => st.ultron.busy || AGENTS.some((a) => st[a.id]?.busy), agentAt: (id) => AGENTS.find((a) => a.id === id),
    };
    function drawScene(dt) {
      drawWalls(); drawFloor();
      if (room?.floorProps) room.floorProps(API);
      drawZones();
      if (!room || room.hub) { if (!room) drawLinks(); drawHub(); }
      stepWalkers(dt || 0);
      const items = [...AGENTS.map((a) => ({ d: a.u + a.v, f: () => drawAgent(a) })), { d: CHIEF.u + CHIEF.v, f: drawChief }, ...walkers.map((w) => { const [u, v] = walkerPos(w); return { d: u + v + 0.3, f: () => drawWalker(w) }; })];
      if (room) {
        for (const pr of room.props || []) items.push({ d: pr.d ?? pr.u + pr.v, f: () => pr.draw(API, pr) });
        for (const sp of room.spare || []) if (!AGENTS.some((a) => a.u === sp.u && a.v === sp.v)) items.push({ d: sp.u + sp.v, f: () => emptyDesk(sp) });
      }
      items.sort((a, b) => a.d - b.d).forEach((x) => x.f());
      drawZoneChips(); drawPackets(dt);
    }
    // one still frame of the room for previews (room picker cards)
    function snapshot(w, h) {
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const save = ctx; ctx = c.getContext('2d');
      const s2 = Math.min(w / bounds.w, h / bounds.h) * 1.12;
      const g = ctx.createRadialGradient(w / 2, h * 0.4, 5, w / 2, h / 2, Math.max(w, h)); g.addColorStop(0, T.bg1); g.addColorStop(1, T.bg2);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      ctx.setTransform(s2, 0, 0, s2, w / 2 - bounds.cx * s2, h / 2 - bounds.cy * s2);
      const keep = packets.splice(0);
      t = t || 1.3; drawScene(0);
      packets.push(...keep);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const url = c.toDataURL('image/png'); ctx = save; return url;
    }
    function loop(ts) {
      const dt = Math.min(0.05, (ts - last) / 1000 || 0.016); last = ts; t += dt;
      if (visible && canvas.width > 2) {
        const k = Math.min(1, dt * 5);
        cam.x += (camT.x - cam.x) * k; cam.y += (camT.y - cam.y) * k; cam.z += (camT.z - cam.z) * k;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        const bg = ctx.createRadialGradient(canvas.width / 2, canvas.height * 0.4, 10, canvas.width / 2, canvas.height * 0.5, Math.max(canvas.width, canvas.height));
        bg.addColorStop(0, T.bg1); bg.addColorStop(1, T.bg2);
        ctx.fillStyle = bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        const kz = view.s * cam.z;
        ctx.setTransform(kz, 0, 0, kz, canvas.width / 2 - cam.x * kz, canvas.height / 2 - cam.y * kz);
        drawScene(dt);
        if (focused) {
          const a = find(focused);
          const zone = ZONES.find((z) => z.id === a.zone);
          const hole = zone ? rectUV(zone.u[0] - 0.4, zone.u[1] + 0.4, zone.v[0] - 0.4, zone.v[1] + 0.4) : rectUV(a.u - 2.4, a.u + 2.4, a.v - 2.4, a.v + 2.4);
          ctx.save(); ctx.globalAlpha = Math.min(0.5, (cam.z - 1) * 0.45); ctx.beginPath(); ctx.rect(-5000, -5000, 10000, 10000);
          ctx.moveTo(hole[0][0], hole[0][1]); hole.slice(1).forEach(([x, y]) => ctx.lineTo(x, y)); ctx.closePath();
          ctx.fillStyle = '#000'; ctx.fill('evenodd'); ctx.restore();
        }
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
      requestAnimationFrame(loop);
    }

    return {
      init, setBusy, packet, focus, setMedia, setHeaders, show, configure, setExtras, snapshot, get room() { return room; },
      mediaCount: () => media.filter((m) => m.img).length,
      relayout: () => { fit(); if (!focused) Object.assign(camT, { x: bounds.cx, y: bounds.cy, z: 1 }); },
      highlight: () => {},
      get AGENTS() { return AGENTS; }, get style() { return style; }, get ZONES() { return ZONES; }, get BASE_AGENTS() { return BASE.agents; },
      get busy() { return st.ultron.busy || AGENTS.some((a) => st[a.id]?.busy); },
      get walking() { return walkers.length; },
    };
  }

  // ---------- the marketing floor ----------
  const MK_ZONES = [
    { id: 'research',   label: 'RESEARCH',   u: [8, 13.5], v: [1.2, 4.6] },
    { id: 'analytics',  label: 'ANALYTICS',  u: [15, 22.5], v: [1.2, 5.2] },
    { id: 'planning',   label: 'PLANNING',   u: [15.5, 22.5], v: [7.6, 12.4] },
    { id: 'scripting',  label: 'SCRIPTING',  u: [13.5, 22.5], v: [15.5, 20.5] },
    { id: 'design',     label: 'DESIGN',     u: [6.5, 12.5], v: [16, 22.5] },
    { id: 'editing',    label: 'EDITING',    u: [1.2, 5.5], v: [15, 22.5] },
    { id: 'publishing', label: 'PUBLISHING', u: [1.2, 5.2], v: [7.5, 13] },
  ];
  const MK_AGENTS = [
    { id: 'mk.trend',    zone: 'research',   u: 9.6,  v: 3.0, name: 'Trend Scout',     icon: 'radar' },
    { id: 'mk.rival',    zone: 'research',   u: 12.2, v: 3.0, name: 'Competitor Watch', icon: 'grid' },
    { id: 'mk.analyst',  zone: 'analytics',  u: 17.2, v: 3.2, name: 'Analyst',         icon: 'chart' },
    { id: 'mk.report',   zone: 'analytics',  u: 20.6, v: 3.2, name: 'Reporter',        icon: 'doc' },
    { id: 'mk.strategy', zone: 'planning',   u: 17.4, v: 10.0, name: 'Strategist',     icon: 'flow' },
    { id: 'mk.schedule', zone: 'planning',   u: 20.8, v: 10.0, name: 'Scheduler',      icon: 'cal' },
    { id: 'mk.hooks',    zone: 'scripting',  u: 15.4, v: 18.0, name: 'Hook Writer',    icon: 'lines' },
    { id: 'mk.captions', zone: 'scripting',  u: 18.2, v: 18.0, name: 'Caption Writer', icon: 'doc' },
    { id: 'mk.script',   zone: 'scripting',  u: 21.0, v: 18.0, name: 'Script Writer',  icon: 'wave' },
    { id: 'mk.art',      zone: 'design',     u: 8.4,  v: 19.2, name: 'Art Director',   icon: 'palette' },
    { id: 'mk.designer', zone: 'design',     u: 11.0, v: 19.2, name: 'Designer',       icon: 'image' },
    { id: 'mk.video',    zone: 'editing',    u: 3.4,  v: 17.0, name: 'Video Editor',   icon: 'film' },
    { id: 'mk.cover',    zone: 'editing',    u: 3.4,  v: 20.4, name: 'Cover Maker',    icon: 'image' },
    { id: 'mk.publish',  zone: 'publishing', u: 3.2,  v: 9.0,  name: 'Publisher',      icon: 'send' },
    { id: 'mk.community',zone: 'publishing', u: 3.2,  v: 11.8, name: 'Community',      icon: 'chat' },
  ];
  window.OfficeKit = { create, autoLayout, theme, STYLES, ICONS: ['doc', 'search', 'radar', 'chart', 'flow', 'cal', 'lines', 'wave', 'palette', 'image', 'film', 'send', 'chat', 'code', 'money', 'mail', 'check', 'grid'] };
  window.Office = create({ zones: MK_ZONES, agents: MK_AGENTS, hue: 260, headL: '@yourshop · 0 posts', headR: 'CONTENT LIBRARY' });
})();
