// Kivo Ultron — MARKETING department: campaign pipeline, content studio, edit studio, calendar, publishing scheduler
(() => {
  const K = window.KU;
  const $ = (s) => document.querySelector(s);
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const btn = (l, f, c) => { const b = el('button', 'hw-btn ' + (c || ''), l); b.onclick = f; return b; };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const DAY = 864e5;

  const ROLE = {
    ultron: 'Chief of Staff · plans each campaign',
    'mk.trend': 'Finds trends, formats and angles that are working now',
    'mk.rival': 'Studies what similar shops post and what to avoid',
    'mk.strategy': 'Turns it into a post plan: platform, format, product, angle',
    'mk.schedule': 'Picks posting times and keeps the calendar spaced out',
    'mk.hooks': 'Writes scroll-stopping first lines and on-screen hooks',
    'mk.captions': 'Writes captions, hashtags, pin titles and descriptions',
    'mk.script': 'Writes the beat-by-beat script for each short video',
    'mk.art': 'Chooses the layout, colours and headline for every visual',
    'mk.designer': 'Renders the post images for each platform size',
    'mk.video': 'Cuts short vertical videos from your designs or footage',
    'mk.cover': 'Makes covers and thumbnails for every video',
    'mk.publish': 'Posts on schedule to Instagram, TikTok and Pinterest',
    'mk.community': 'Reads comments and drafts replies for you',
    'mk.analyst': 'Pulls views, likes and saves for every post',
    'mk.report': 'Sums up what’s working and feeds it back into planning',
  };
  const AI = new Set(['ultron', 'mk.trend', 'mk.rival', 'mk.strategy', 'mk.hooks', 'mk.captions', 'mk.script', 'mk.art', 'mk.video', 'mk.community', 'mk.report']);
  const DEFAULT_MODEL = { 'mk.trend': 'claude-haiku-5-5', 'mk.rival': 'claude-haiku-5-5', 'mk.report': 'claude-haiku-5-5', 'mk.community': 'claude-haiku-5-5', 'mk.strategy': 'claude-sonnet-5-5', 'mk.hooks': 'claude-sonnet-5-5', 'mk.captions': 'claude-sonnet-5-5', 'mk.script': 'claude-sonnet-5-5', 'mk.art': 'claude-sonnet-5-5', 'mk.video': 'claude-sonnet-5-5' };
  const PLAT = {
    instagram: { name: 'Instagram', short: 'IG', color: '#ff4fa3', times: [[12, 0], [19, 0]] },
    tiktok: { name: 'TikTok', short: 'TT', color: '#25f4ee', times: [[19, 30], [21, 0]] },
    pinterest: { name: 'Pinterest', short: 'PIN', color: '#e60023', times: [[20, 0], [14, 0]] },
  };
  const SIZES = { feed: [1080, 1350], story: [1080, 1920], pin: [1000, 1500] };

  let running = false, abort = false, progress = null;
  const thumbs = new Map(); // post id -> Image for the walls

  // ---------- state ----------
  function M() {
    const D = K.D;
    if (!D.mk) D.mk = {};
    const m = D.mk;
    if (!m.settings) m.settings = {};
    const defs = { brief: 'Promote my best designs and get people to my Etsy shop. Mix product posts, gift ideas and funny relatable ones.', perRun: 6, platforms: { instagram: true, tiktok: true, pinterest: true }, mode: 'review', auto: false, everyDays: 7, handle: '' };
    for (const [k, v] of Object.entries(defs)) if (m.settings[k] === undefined) m.settings[k] = v;
    m.posts = m.posts || []; m.footage = m.footage || []; m.campaigns = m.campaigns || [];
    m.accounts = m.accounts || {}; m.comments = m.comments || [];
    for (const [k, v] of Object.entries(DEFAULT_MODEL)) if (!D.settings.agentModels[k]) D.settings.agentModels[k] = v;
    return m;
  }
  const save = () => K.persist();
  const say = (agent, msg, kind) => K.log(agent, msg, kind);
  const work = (agent, text) => K.setAgent(agent, 'WORKING', text);
  const idle = (agent, err) => K.setAgent(agent, 'IDLE', '', !!err);
  const pkt = (a, b) => Office.packet(a, b);
  const platformsOn = () => Object.entries(M().settings.platforms).filter(([, v]) => v).map(([k]) => k);
  function checkAbort() { if (abort) throw new Error('ABORTED'); }

  // ---------- products to promote ----------
  function catalog() {
    return K.D.products.filter((p) => p.svg && p.listing && ['published', 'uploaded', 'ready', 'review'].includes(p.status))
      .sort((a, b) => (b.sales?.qty || 0) - (a.sales?.qty || 0) || (b.status === 'published') - (a.status === 'published') || b.createdAt - a.createdAt);
  }
  const prodById = (id) => K.D.products.find((p) => p.id === id);

  // ---------- canvas helpers ----------
  const loadImg = (src) => new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error('image failed to load')); i.src = src; });
  const imgCache = new Map();
  async function artImg(p) { if (!p?.svg) return null; if (!imgCache.has(p.id)) imgCache.set(p.id, await loadImg(K.svgURL(p.svg)).catch(() => null)); return imgCache.get(p.id); }
  async function mockImg(p) {
    const src = p?.printify?.mockups?.[0]; if (!src) return null;
    const key = 'm:' + src; if (imgCache.has(key)) return imgCache.get(key);
    try { const r = await kivo.fetchImage(src); const im = await loadImg('data:' + r.type + ';base64,' + r.data); imgCache.set(key, im); return im; } catch { imgCache.set(key, null); return null; }
  }
  function wrap(x, text, maxW) {
    const words = String(text || '').split(/\s+/), lines = []; let line = '';
    for (const w of words) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > maxW && line) { lines.push(line); line = w; } else line = t; }
    if (line) lines.push(line); return lines;
  }
  function fitText(x, text, maxW, maxH, font, start, min = 28, lh = 1.12) {
    let size = start, lines;
    for (; size >= min; size -= 4) { x.font = font.replace('%', size); lines = wrap(x, text, maxW); if (lines.length * size * lh <= maxH) break; }
    return { size, lines, lh: size * lh };
  }
  function drawLines(x, f, cx, top, align = 'center') { x.textAlign = align; x.textBaseline = 'top'; f.lines.forEach((l, i) => x.fillText(l, cx, top + i * f.lh)); return top + f.lines.length * f.lh; }
  function tee(x, cx, cy, w, color) {
    const h = w * 1.12, s = w / 100;
    x.save(); x.translate(cx - w / 2, cy - h / 2);
    x.beginPath();
    x.moveTo(30 * s, 0); x.quadraticCurveTo(50 * s, 12 * s, 70 * s, 0); x.lineTo(100 * s, 14 * s); x.lineTo(92 * s, 38 * s); x.lineTo(80 * s, 33 * s);
    x.lineTo(80 * s, 112 * s); x.lineTo(20 * s, 112 * s); x.lineTo(20 * s, 33 * s); x.lineTo(8 * s, 38 * s); x.lineTo(0, 14 * s); x.closePath();
    x.shadowColor = 'rgba(0,0,0,.28)'; x.shadowBlur = 40 * s; x.shadowOffsetY = 14 * s;
    x.fillStyle = color; x.fill(); x.shadowColor = 'transparent';
    x.strokeStyle = 'rgba(0,0,0,.08)'; x.lineWidth = 2 * s; x.stroke();
    x.restore();
    return { x: cx - w * 0.22, y: cy - h / 2 + h * 0.3, w: w * 0.44, h: w * 0.44 * 1.2 };
  }
  const shirtColor = (p) => (p?.tone === 'dark' ? '#23252b' : '#f3efe6');

  // ---------- Designer: render a post visual ----------
  async function renderVisual(post, size) {
    const [W, H] = SIZES[size];
    const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const a = post.art || {}, pal = a.palette || { bg: '#f6efe6', fg: '#2b2420', accent: '#d9577b' };
    const prods = (post.productIds || []).map(prodById).filter(Boolean);
    const p = prods[0];
    x.fillStyle = pal.bg; x.fillRect(0, 0, W, H);
    // soft texture
    const g = x.createRadialGradient(W * 0.5, H * 0.45, 10, W * 0.5, H * 0.5, H * 0.8); g.addColorStop(0, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(0,0,0,.08)');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    const pad = W * 0.08;
    const head = a.headline || post.hook || '', sub = a.sub || '';
    const layout = size === 'pin' ? 'pin' : a.layout || 'hero';
    if (layout === 'quote' && p) {
      x.fillStyle = pal.fg; const f = fitText(x, head, W - pad * 2, H * 0.5, '700 %px Georgia, serif', 120, 48);
      const top = drawLines(x, f, W / 2, H * 0.14);
      const art = await artImg(p); const box = tee(x, W / 2, top + (H - top) * 0.48, Math.min(W * 0.5, (H - top) * 0.75), shirtColor(p));
      if (art) x.drawImage(art, box.x, box.y, box.w, box.h);
    } else if (layout === 'grid' && prods.length > 1) {
      x.fillStyle = pal.fg; const f = fitText(x, head, W - pad * 2, H * 0.18, '700 %px Georgia, serif', 96, 44);
      const top = drawLines(x, f, W / 2, H * 0.07) + H * 0.03;
      const n = Math.min(4, prods.length), cols = 2, cw = (W - pad * 2) / cols, rows = Math.ceil(n / cols), chh = (H - top - H * 0.12) / rows;
      for (let i = 0; i < n; i++) {
        const q = prods[i], cx = pad + cw * (i % cols) + cw / 2, cy = top + chh * Math.floor(i / cols) + chh / 2;
        const art = await artImg(q); const box = tee(x, cx, cy, Math.min(cw, chh * 0.85) * 0.9, shirtColor(q)); if (art) x.drawImage(art, box.x, box.y, box.w, box.h);
      }
    } else if (layout === 'pin') {
      const mock = await mockImg(p);
      if (mock) { const r = Math.max(W / mock.width, (H * 0.72) / mock.height); x.drawImage(mock, (W - mock.width * r) / 2, 0, mock.width * r, mock.height * r); }
      else { const art = await artImg(p); const box = tee(x, W / 2, H * 0.36, W * 0.62, shirtColor(p)); if (art) x.drawImage(art, box.x, box.y, box.w, box.h); }
      x.fillStyle = pal.accent; x.fillRect(0, H * 0.72, W, H * 0.28);
      x.fillStyle = '#fff'; const f = fitText(x, a.pinTitle || head, W - pad * 2, H * 0.17, '700 %px Georgia, serif', 76, 36);
      drawLines(x, f, W / 2, H * 0.745);
      x.font = '600 30px Inter, sans-serif'; x.textAlign = 'center'; x.fillStyle = 'rgba(255,255,255,.9)'; x.fillText(sub || 'Shop on Etsy', W / 2, H * 0.955);
    } else {
      // hero (default): headline, shirt with the design, sub line
      const mock = layout === 'mockup' ? await mockImg(p) : null;
      if (mock) { const r = Math.max(W / mock.width, H / mock.height); x.drawImage(mock, (W - mock.width * r) / 2, (H - mock.height * r) / 2, mock.width * r, mock.height * r); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(0, 0, W, H * 0.3); }
      x.fillStyle = mock ? '#fff' : pal.fg; const f = fitText(x, head, W - pad * 2, H * 0.24, '700 %px Georgia, serif', 104, 44);
      drawLines(x, f, W / 2, H * 0.06);
      if (!mock && p) { const art = await artImg(p); const box = tee(x, W / 2, H * 0.6, Math.min(W * 0.72, H * 0.5), shirtColor(p)); if (art) x.drawImage(art, box.x, box.y, box.w, box.h); }
      if (sub) { x.fillStyle = pal.accent; x.beginPath(); x.roundRect(W / 2 - W * 0.32, H * 0.9, W * 0.64, H * 0.058, H * 0.03); x.fill(); x.fillStyle = '#fff'; x.font = `600 ${Math.round(H * 0.026)}px Inter, sans-serif`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(sub, W / 2, H * 0.929); }
    }
    if (M().settings.handle) { x.font = `500 ${Math.round(W * 0.024)}px Inter, sans-serif`; x.fillStyle = mockLike(pal.bg) ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.45)'; x.textAlign = 'center'; x.textBaseline = 'alphabetic'; if (layout !== 'pin') x.fillText(M().settings.handle, W / 2, H * 0.985); }
    return c;
  }
  const mockLike = (hex) => { const n = parseInt(String(hex).slice(1), 16); return ((n >> 16) * 0.3 + ((n >> 8) & 255) * 0.59 + (n & 255) * 0.11) < 110; };
  async function renderSlide(post, beat, i, n) {
    const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    const pal = post.art?.palette || { bg: '#f6efe6', fg: '#2b2420', accent: '#d9577b' };
    const prods = (post.productIds || []).map(prodById).filter(Boolean);
    const p = prods[i % Math.max(1, prods.length)] || prods[0];
    x.fillStyle = i % 2 ? pal.accent : pal.bg; x.fillRect(0, 0, W, H);
    const fg = i % 2 ? '#fff' : pal.fg;
    const art = await artImg(p);
    if (beat.shot !== 'text' && p) { const box = tee(x, W / 2, H * 0.6, W * 0.78, shirtColor(p)); if (art) x.drawImage(art, box.x, box.y, box.w, box.h); }
    x.fillStyle = fg;
    const f = fitText(x, beat.text, W * 0.84, beat.shot === 'text' ? H * 0.6 : H * 0.26, '800 %px Georgia, serif', beat.shot === 'text' ? 120 : 92, 48);
    if (beat.shot === 'text') drawLines(x, f, W / 2, H / 2 - (f.lines.length * f.lh) / 2);
    else { x.fillStyle = 'rgba(0,0,0,.0)'; x.fillStyle = fg; drawLines(x, f, W / 2, H * 0.12); }
    if (i === n - 1) { x.fillStyle = i % 2 ? '#fff' : pal.accent; x.beginPath(); x.roundRect(W * 0.2, H * 0.88, W * 0.6, 110, 55); x.fill(); x.fillStyle = i % 2 ? pal.accent : '#fff'; x.font = '700 46px Inter, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('Shop link in bio', W / 2, H * 0.88 + 55); }
    return c;
  }
  const b64 = (c, type = 'image/png', q) => c.toDataURL(type, q).split(',')[1];
  function thumbOf(c, w = 270) { const t = document.createElement('canvas'); t.width = w; t.height = Math.round(c.height * w / c.width); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', 0.8); }

  // ---------- campaign pipeline ----------
  async function runCampaign(brief, count, opts = {}) {
    if (running) { K.toast('A marketing run is already going.', true); return; }
    const m = M(), plats = opts.platforms || platformsOn();
    if (!plats.length) { K.toast('Turn on at least one platform.', true); return; }
    const prods = catalog();
    if (!prods.length) { K.toast('Make some designs in the Store first — the marketing crew promotes your products.', true); return; }
    running = true; abort = false; progress = { stage: 'Planning', i: 0, n: count }; renderControls();
    const camp = { id: uid(), createdAt: Date.now(), brief, count, platforms: plats };
    m.campaigns.push(camp);
    const made = [];
    try {
      work('ultron', 'Planning the campaign');
      say('ultron', `Marketing run: "${brief}" · ${count} posts · ${plats.map((p) => PLAT[p].name).join(', ')}`);
      const catalogTxt = prods.slice(0, 20).map((p, i) => `${i + 1}. [${p.id}] "${p.trend.phrase}" — ${p.listing.title.slice(0, 80)} · ${p.status}${p.sales?.qty ? ` · ${p.sales.qty} sold` : ''}`).join('\n');
      const perf = performanceSummary();
      const plan = await K.askJSON(`You are ULTRON, Chief of Staff of a marketing team for an Etsy print-on-demand shirt shop. Plan this run.
${K.shopContext()}
Owner's brief: ${brief}
Posts to make: ${count}. Platforms: ${plats.join(', ')}.
Products available (id in brackets):
${catalogTxt}
What has worked so far: ${perf}${window.SP?.crewNotes('marketing') || ''}
Reply with JSON only: {"name": "short campaign name", "goal": "one sentence", "focusProductIds": ["ids of the products to feature, best first"], "notes": "2 sentences of direction for the team"}`, { agent: 'ultron', task: 'Planning the campaign', maxTokens: 900 });
      camp.name = plan.name; camp.goal = plan.goal;
      say('ultron', `Campaign "${plan.name}": ${plan.goal}`, 'ok'); checkAbort();
      const focus = (plan.focusProductIds || []).map(prodById).filter(Boolean);
      const featured = (focus.length ? focus : prods).slice(0, 8);
      const featTxt = featured.map((p) => `[${p.id}] "${p.trend.phrase}" (${p.trend.niche}; buyer: ${p.trend.audience})`).join('\n');

      pkt('ultron', 'mk.trend'); work('mk.trend', 'Scanning formats and trends');
      const trends = await K.askJSON(`You are the Trend Scout for an Etsy shirt shop's social media. ${K.shopContext()}
Products being promoted:\n${featTxt}
List the content formats and angles working right now on Instagram Reels, TikTok and Pinterest for this niche (e.g. POV, "gift for the X in your life", relatable humour, before/after, packing orders). Use the selling calendar for timely angles.
Reply with JSON only: {"angles": ["8 short angle ideas"], "formats": ["5 formats"], "timely": "one sentence on what's seasonal now"}`, { agent: 'mk.trend', task: 'Scanning formats and trends', maxTokens: 1000 });
      say('mk.trend', `${trends.timely || ''} Angles: ${(trends.angles || []).slice(0, 4).join(' · ')}`, 'ok'); idle('mk.trend'); checkAbort();

      pkt('mk.trend', 'mk.rival'); work('mk.rival', 'Studying similar shops');
      const rivals = await K.askJSON(`You are Competitor Watch for an Etsy print-on-demand shirt shop. Based on what successful small Etsy/POD apparel brands commonly post, list what to copy and what to avoid for these products:\n${featTxt}
Don't name or imitate specific real accounts. Reply with JSON only: {"do": ["5 things"], "avoid": ["4 things"]}`, { agent: 'mk.rival', task: 'Studying similar shops', maxTokens: 800 });
      say('mk.rival', `Do: ${(rivals.do || []).slice(0, 3).join('; ')}`, 'ok'); idle('mk.rival'); checkAbort();

      pkt('mk.rival', 'mk.strategy'); work('mk.strategy', `Planning ${count} posts`); progress.stage = 'Strategy'; renderControls();
      const strat = await K.askJSON(`You are the Strategist. Plan exactly ${count} social posts for an Etsy shirt shop.
${K.shopContext()}
Brief: ${brief}. Direction from the chief: ${plan.notes || ''}
Platforms to use: ${plats.join(', ')} (spread posts across them; Pinterest = image pins, TikTok = video, Instagram = mix of image and Reels).
Products:\n${featTxt}
Angles to draw from: ${(trends.angles || []).join('; ')}
Do: ${(rivals.do || []).join('; ')}. Avoid: ${(rivals.avoid || []).join('; ')}.${window.SP?.crewNotes('marketing') || ''}
Reply with JSON only: {"posts": [{"platform": "instagram"|"tiktok"|"pinterest", "format": "image"|"video", "productIds": ["1-4 product ids"], "angle": "the angle", "goal": "sales"|"reach"|"saves"}]}`, { agent: 'mk.strategy', task: `Planning ${count} posts`, maxTokens: 2200 });
      let plan2 = (strat.posts || []).filter((x) => PLAT[x.platform] && plats.includes(x.platform)).slice(0, count);
      if (!plan2.length) throw new Error('Strategist came back empty');
      for (const x of plan2) { if (x.platform === 'tiktok') x.format = 'video'; if (x.platform === 'pinterest') x.format = 'image'; x.productIds = (x.productIds || []).filter(prodById); if (!x.productIds.length) x.productIds = [featured[0].id]; }
      say('mk.strategy', `${plan2.length} posts planned: ` + plan2.map((x) => `${PLAT[x.platform].short} ${x.format}`).join(', '), 'ok'); idle('mk.strategy'); checkAbort();

      // Scheduler: deterministic, no AI
      pkt('mk.strategy', 'mk.schedule'); work('mk.schedule', 'Booking time slots');
      const posts = plan2.map((x) => ({ id: uid(), campaignId: camp.id, createdAt: Date.now(), status: 'drafting', ...x }));
      schedule(posts);
      say('mk.schedule', 'Slots booked: ' + posts.map((p) => `${PLAT[p.platform].short} ${fmtWhen(p.scheduledAt)}`).join(' · '), 'ok');
      m.posts.push(...posts); save(); renderAll(); await sleep(300); idle('mk.schedule');

      const brief2 = posts.map((p, i) => `${i + 1}. ${p.platform} ${p.format} · angle: ${p.angle} · products: ${p.productIds.map((id) => '"' + prodById(id).trend.phrase + '"').join(', ')}`).join('\n');
      pkt('mk.schedule', 'mk.hooks'); work('mk.hooks', 'Drafting hooks'); progress.stage = 'Writing'; renderControls();
      const hooks = await K.askJSON(`You are the Hook Writer. Write a scroll-stopping hook (max 9 words, no hashtags, no emojis at the start) for each post. Match the platform.
${K.shopContext()}
Posts:\n${brief2}
Reply with JSON only: {"hooks": ["${posts.length} hooks in order"]}`, { agent: 'mk.hooks', task: 'Drafting hooks', maxTokens: 1000 });
      posts.forEach((p, i) => (p.hook = String(hooks.hooks?.[i] || p.angle)));
      say('mk.hooks', posts.map((p) => `“${p.hook}”`).join(' · '), 'ok'); idle('mk.hooks'); checkAbort();

      pkt('mk.hooks', 'mk.captions'); work('mk.captions', 'Writing captions');
      const caps = await K.askJSON(`You are the Caption Writer. Write the caption for each post, in the shop's voice, British English.
${K.shopContext()}
Rules: Instagram — 2-4 short lines, a call to action ("link in bio"), then 5-8 relevant hashtags. TikTok — 1-2 punchy lines + 3-5 hashtags. Pinterest — "pinTitle" (max 90 chars, keyword-rich) and a 150-300 character keyword-rich description, no hashtags.
Posts (with hooks):\n${posts.map((p, i) => `${i + 1}. ${p.platform} ${p.format} · hook: ${p.hook} · angle: ${p.angle}`).join('\n')}
Reply with JSON only: {"captions": [{"caption": "...", "hashtags": ["#tag"], "pinTitle": "only for pinterest"}]}`, { agent: 'mk.captions', task: 'Writing captions', maxTokens: 3000 });
      posts.forEach((p, i) => { const c = caps.captions?.[i] || {}; p.caption = String(c.caption || p.hook); p.hashtags = (c.hashtags || []).map((h) => '#' + String(h).replace(/^#/, '').replace(/\s+/g, '')).slice(0, 10); if (c.pinTitle) p.pinTitle = String(c.pinTitle).slice(0, 100); });
      say('mk.captions', `${posts.length} captions written`, 'ok'); idle('mk.captions'); checkAbort();

      const vids = posts.filter((p) => p.format === 'video');
      if (vids.length) {
        pkt('mk.captions', 'mk.script'); work('mk.script', `Scripting ${vids.length} video${vids.length > 1 ? 's' : ''}`);
        const sc = await K.askJSON(`You are the Script Writer for short vertical videos (7-12 seconds, no voiceover, text on screen over the product). For each video write 3-5 beats; each beat is short on-screen text (max 8 words) and a shot type: "product" (design on a shirt) or "text" (big text card). First beat = the hook, last beat = call to action.
Videos:\n${vids.map((p, i) => `${i + 1}. hook: ${p.hook} · angle: ${p.angle}`).join('\n')}
Reply with JSON only: {"videos": [{"beats": [{"text": "...", "shot": "product"|"text"}]}]}`, { agent: 'mk.script', task: 'Scripting videos', maxTokens: 2000 });
        vids.forEach((p, i) => (p.beats = (sc.videos?.[i]?.beats || [{ text: p.hook, shot: 'text' }, { text: 'Made to order', shot: 'product' }, { text: 'Link in bio', shot: 'product' }]).slice(0, 5)));
        say('mk.script', `${vids.length} video scripts ready`, 'ok'); idle('mk.script'); checkAbort();
      }

      pkt('mk.script', 'mk.art'); work('mk.art', 'Art directing'); progress.stage = 'Design'; renderControls();
      const art = await K.askJSON(`You are the Art Director. For each post choose a layout and palette that suits the product artwork and platform.
Layouts: "hero" (shirt with the design + headline), "quote" (big headline, small shirt), "grid" (several products, only when 2+ products), "mockup" (real product photo, only if a photo exists).
Palette: hex colours — "bg" (background, soft and on-brand), "fg" (text, high contrast on bg), "accent" (buttons/bands).
Headline: max 7 words, can reuse the hook. "sub": short call to action (max 4 words) or empty.
Posts:\n${posts.map((p, i) => `${i + 1}. ${p.platform} ${p.format} · hook: ${p.hook} · products: ${p.productIds.map((id) => prodById(id).trend.style + ' (' + (prodById(id).printify?.mockups?.length ? 'has photo' : 'no photo') + ')').join('; ')}`).join('\n')}
Reply with JSON only: {"art": [{"layout": "...", "palette": {"bg": "#hex", "fg": "#hex", "accent": "#hex"}, "headline": "...", "sub": "..."}]}`, { agent: 'mk.art', task: 'Art directing', maxTokens: 2000 });
      posts.forEach((p, i) => { const a = art.art?.[i] || {}; p.art = { layout: a.layout || 'hero', palette: validPal(a.palette), headline: a.headline || p.hook, sub: a.sub || '', pinTitle: p.pinTitle }; });
      say('mk.art', `Layouts: ${posts.map((p) => p.art.layout).join(', ')}`, 'ok'); idle('mk.art'); checkAbort();

      // Designer + Video Editor + Cover Maker
      let i = 0;
      for (const p of posts) {
        checkAbort(); progress = { stage: 'Rendering', i: ++i, n: posts.length }; renderControls();
        await produceMedia(p);
        p.status = m.settings.mode === 'make' ? 'ready' : m.settings.mode === 'review' ? 'review' : 'scheduled';
        made.push(p); save(); renderAll();
      }
      pkt('mk.cover', 'mk.publish');
      const sum = `${made.length} posts ready` + (m.settings.mode === 'auto' ? ' and scheduled' : m.settings.mode === 'review' ? ' — waiting for your approval' : '');
      say('ultron', `Campaign "${camp.name}" done: ${sum}.`, 'ok');
      K.notify('Marketing run complete', sum); K.toast(sum);
      const recap = `Campaign "${camp.name}" (${brief}): ${sum}. Posts: ${made.map((p) => `${PLAT[p.platform].name} ${p.format} · hook "${p.hook}" · caption: ${(p.caption || '').slice(0, 160)} ${(p.hashtags || []).join(' ')}`).join(' | ')}`;
      setTimeout(() => window.SP?.afterRun('marketing', recap), 0);
    } catch (e) {
      if (e.message === 'ABORTED') say('ultron', 'Marketing run stopped.', 'err');
      else { say('ultron', 'Marketing run failed: ' + e.message, 'err'); K.toast(e.message, true); }
      for (const p of m.posts) if (p.status === 'drafting' || p.status === 'rendering') { p.status = p.files?.feed || p.files?.video ? 'review' : 'failed'; p.error = p.error || e.message; }
    } finally {
      running = false; progress = null;
      for (const a of Office.BASE_AGENTS) if (K.agentState[a.id]?.status === 'WORKING') idle(a.id);
      if (K.agentState.ultron?.status === 'WORKING') idle('ultron');
      renderAll(); save();
    }
  }
  function validPal(p) {
    const ok = (h) => /^#[0-9a-f]{6}$/i.test(h || '');
    return { bg: ok(p?.bg) ? p.bg : '#f6efe6', fg: ok(p?.fg) ? p.fg : '#2b2420', accent: ok(p?.accent) ? p.accent : '#d9577b' };
  }
  async function produceMedia(p) {
    p.status = 'rendering'; p.files = p.files || {}; renderAll();
    if (p.format === 'image') {
      pkt('mk.art', 'mk.designer'); work('mk.designer', `Rendering ${PLAT[p.platform].name} post`);
      const size = p.platform === 'pinterest' ? 'pin' : 'feed';
      const c = await renderVisual(p, size);
      p.files[size] = await kivo.mediaSave({ name: `${p.id}-${size}.png`, data: b64(c) });
      p.thumb = thumbOf(c); p.size = size;
      say('mk.designer', `Rendered ${PLAT[p.platform].name} ${SIZES[size].join('×')} for “${p.hook}”`, 'ok'); idle('mk.designer');
    } else {
      pkt('mk.script', 'mk.video'); work('mk.video', `Cutting video: ${p.beats?.length || 3} beats`);
      const beats = p.beats?.length ? p.beats : [{ text: p.hook, shot: 'text' }, { text: p.art?.headline || p.hook, shot: 'product' }];
      const slides = [];
      for (let k = 0; k < beats.length; k++) { const c = await renderSlide(p, beats[k], k, beats.length); slides.push({ data: b64(c, 'image/jpeg', 0.92), dur: k === 0 ? 2.2 : 2.6 }); if (k === 0) { p.thumb = thumbOf(c); } }
      p.files.video = await kivo.videoSlides({ name: `${p.id}.mp4`, slides });
      idle('mk.video');
      pkt('mk.video', 'mk.cover'); work('mk.cover', 'Making the cover');
      const cov = await renderSlide(p, beats[0], 0, beats.length);
      p.files.cover = await kivo.mediaSave({ name: `${p.id}-cover.jpg`, data: b64(cov, 'image/jpeg', 0.9) });
      say('mk.video', `Video rendered (${beats.length} beats, ~${Math.round(beats.length * 2.5)}s, 1080×1920 MP4) for “${p.hook}”`, 'ok'); idle('mk.cover');
    }
    p.error = undefined; refreshWalls();
  }

  // ---------- Scheduler ----------
  function schedule(posts) {
    const taken = M().posts.filter((p) => p.scheduledAt && !['failed'].includes(p.status)).map((p) => p.scheduledAt);
    const start = new Date(); start.setHours(0, 0, 0, 0); start.setDate(start.getDate() + 1);
    for (const p of posts) {
      const times = PLAT[p.platform].times;
      for (let d = 0; d < 60 && !p.scheduledAt; d++) {
        for (const [h, mi] of times) {
          const t = new Date(start.getTime() + d * DAY); t.setHours(h, mi, 0, 0);
          const clash = taken.some((x) => Math.abs(x - t.getTime()) < 3 * 3600e3) || M().posts.concat(posts).some((q) => q !== p && q.platform === p.platform && q.scheduledAt && Math.abs(q.scheduledAt - t.getTime()) < 20 * 3600e3);
          if (!clash) { p.scheduledAt = t.getTime(); taken.push(p.scheduledAt); break; }
        }
      }
      if (!p.scheduledAt) p.scheduledAt = start.getTime() + 12 * 3600e3;
    }
  }
  const fmtWhen = (ts) => { const d = new Date(ts); return d.toLocaleDateString([], { weekday: 'short' }) + ' ' + d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); };

  // ---------- Publisher ----------
  let tickBusy = false;
  async function tick() {
    if (tickBusy) return; tickBusy = true;
    try {
      const m = M(), now = Date.now();
      for (const p of m.posts.filter((x) => x.status === 'scheduled' && x.scheduledAt <= now)) {
        if (window.SOCIAL?.connected(p.platform)) await publish(p);
        else if (!p.reminded) { p.reminded = true; p.status = 'ready'; K.notify(`Time to post on ${PLAT[p.platform].name}`, `“${p.hook}” — open Kivo Ultron to copy the caption and file.`); say('mk.publish', `${PLAT[p.platform].name} isn’t connected — “${p.hook}” is ready for you to post by hand.`); save(); renderAll(); }
      }
      if (window.SOCIAL && now - (m.lastMetrics || 0) > 6 * 3600e3 && m.posts.some((p) => p.status === 'posted')) { m.lastMetrics = now; await pullMetrics(); }
    } finally { tickBusy = false; }
  }
  async function publish(p) {
    if (!window.SOCIAL?.connected(p.platform)) { K.toast(`Connect ${PLAT[p.platform].name} in the Accounts tab first.`, true); return; }
    work('mk.publish', `Posting to ${PLAT[p.platform].name}`); p.status = 'posting'; renderAll();
    try {
      const r = await window.SOCIAL.publish(p.platform, p, (msg) => K.setAgent('mk.publish', 'WORKING', msg));
      Object.assign(p, { status: 'posted', postedAt: Date.now(), remoteId: r.id, url: r.url || p.url, error: undefined });
      say('mk.publish', `Posted to ${PLAT[p.platform].name}: “${p.hook}”${r.note ? ' — ' + r.note : ''}`, 'ok');
      K.notify(`Posted to ${PLAT[p.platform].name}`, p.hook);
    } catch (e) {
      p.status = 'failed'; p.error = K.cleanErr(e); p.retryable = true;
      say('mk.publish', `${PLAT[p.platform].name} post failed: ${p.error}`, 'err'); K.notify(`${PLAT[p.platform].name} post failed`, p.error);
    }
    idle('mk.publish'); save(); renderAll();
  }
  async function pullMetrics() {
    work('mk.analyst', 'Pulling post stats');
    let n = 0;
    for (const p of M().posts.filter((x) => x.status === 'posted' && x.remoteId).slice(-40)) {
      try { const mt = await window.SOCIAL.metrics(p.platform, p); if (mt) { p.metrics = { ...p.metrics, ...mt, at: Date.now() }; n++; } } catch (e) { p.metricsError = K.cleanErr(e); }
    }
    say('mk.analyst', `Stats updated for ${n} post${n === 1 ? '' : 's'}.`, 'ok'); idle('mk.analyst'); save(); refreshWalls(); renderAll();
  }
  function performanceSummary() {
    const posted = M().posts.filter((p) => p.metrics?.views != null);
    if (!posted.length) return M().report?.text || 'No post stats yet.';
    const top = [...posted].sort((a, b) => (b.metrics.views || 0) - (a.metrics.views || 0)).slice(0, 4);
    return 'Top posts: ' + top.map((p) => `${p.platform} ${p.format} "${p.hook}" (${p.metrics.views} views, ${p.metrics.likes || 0} likes)`).join('; ') + (M().report?.text ? ' Report: ' + M().report.text : '');
  }
  async function writeReport() {
    const posted = M().posts.filter((p) => p.metrics);
    if (!posted.length) { K.toast('No stats yet — post something first, or add views by hand in a post.', true); return; }
    work('mk.report', 'Writing the report');
    try {
      const txt = await K.ask(`You are the Reporter for an Etsy shirt shop's social media. In 4-6 short bullet points, say what is working, what isn't, and what to make more of next week. Be specific.
Posts with stats:\n${posted.slice(-30).map((p) => `${p.platform} ${p.format} · hook "${p.hook}" · layout ${p.art?.layout} · ${JSON.stringify(p.metrics)}`).join('\n')}`, { agent: 'mk.report', task: 'Writing the report', maxTokens: 800 });
      M().report = { text: txt.trim(), at: Date.now() }; say('mk.report', 'Weekly report ready — the Strategist will use it next run.', 'ok');
    } catch (e) { K.toast(K.cleanErr(e), true); }
    idle('mk.report'); save(); renderAll();
  }

  // ---------- Community ----------
  async function checkComments() {
    if (!window.SOCIAL?.connected('instagram')) { K.toast('Connect Instagram to read comments.', true); return; }
    work('mk.community', 'Reading comments');
    try {
      const fresh = [];
      for (const p of M().posts.filter((x) => x.platform === 'instagram' && x.remoteId).slice(-15)) {
        const list = await window.SOCIAL.comments('instagram', p);
        for (const c of list) if (!M().comments.some((x) => x.id === c.id)) fresh.push({ ...c, postId: p.id, hook: p.hook, status: 'new' });
      }
      if (fresh.length) {
        const r = await K.askJSON(`You are the Community Manager for an Etsy shirt shop on Instagram. Draft a short, warm, human reply (max 2 sentences, British English, no hashtags) to each comment. If it's spam or abuse, reply "".
${K.shopContext()}
Comments:\n${fresh.map((c, i) => `${i + 1}. on post "${c.hook}": ${c.text}`).join('\n')}
Reply with JSON only: {"replies": ["${fresh.length} replies in order"]}`, { agent: 'mk.community', task: 'Drafting replies', maxTokens: 1500 });
        fresh.forEach((c, i) => (c.draft = String(r.replies?.[i] || '')));
        M().comments.push(...fresh);
      }
      say('mk.community', fresh.length ? `${fresh.length} new comment${fresh.length > 1 ? 's' : ''} with draft replies.` : 'No new comments.', 'ok');
    } catch (e) { say('mk.community', 'Comment check failed: ' + K.cleanErr(e), 'err'); }
    idle('mk.community'); save(); renderAll();
  }

  // ---------- Edit Studio: your footage → a cut ----------
  async function addFootage() {
    const paths = await kivo.videoPick(); if (!paths?.length) return;
    for (const path of paths) M().footage.push({ id: uid(), path, name: path.split(/[\\/]/).pop(), status: 'queued', addedAt: Date.now() });
    save(); renderAll();
    for (const f of M().footage.filter((x) => x.status === 'queued')) await cutFootage(f);
  }
  async function cutFootage(f) {
    work('mk.video', `Watching ${f.name}`); f.status = 'watching'; renderAll();
    try {
      const info = await kivo.videoFrames({ path: f.path, count: 16 });
      f.duration = info.duration;
      const prods = catalog().slice(0, 10);
      const plan = await K.askJSON(`You are the Video Editor for an Etsy shirt shop. These are ${info.frames.length} frames sampled from the owner's raw footage (${info.duration.toFixed(1)}s long), in order, with timestamps: ${info.frames.map((x) => x.t.toFixed(1) + 's').join(', ')}.
Cut a 10-25 second vertical short: pick 2-6 segments (start/end seconds within the video, best moments first, skip shaky/dark/boring bits), and write short on-screen text for each (max 7 words; first = hook). Also write the caption (2 lines + 5 hashtags).
${K.shopContext()}
Shop products for context: ${prods.map((p) => '"' + p.trend.phrase + '"').join(', ')}
Reply with JSON only: {"segments": [{"start": 0, "end": 3.5, "text": "..."}], "hook": "...", "caption": "...", "hashtags": ["#..."]}`,
        { agent: 'mk.video', task: `Watching ${f.name}`, maxTokens: 1500, images: info.frames.map((x) => ({ media_type: 'image/jpeg', data: x.data })) });
      const segs = (plan.segments || []).map((s) => ({ start: Math.max(0, +s.start || 0), end: Math.min(info.duration, +s.end || 0), text: String(s.text || '') })).filter((s) => s.end - s.start >= 0.6).slice(0, 6);
      if (!segs.length) throw new Error('Editor found nothing usable in this clip');
      work('mk.video', `Cutting ${segs.length} segments`); f.status = 'cutting'; renderAll();
      const overlays = segs.map((s) => b64(overlayPNG(s.text)));
      const out = await kivo.videoEdit({ path: f.path, name: `cut-${f.id}.mp4`, segments: segs.map((s, i) => ({ start: s.start, end: s.end, overlay: overlays[i] })) });
      const cover = overlayPNG(plan.hook || segs[0].text, true);
      const post = { id: uid(), createdAt: Date.now(), platform: M().settings.platforms.tiktok ? 'tiktok' : 'instagram', format: 'video', productIds: [], angle: 'Your footage', hook: plan.hook || segs[0].text, caption: plan.caption || '', hashtags: (plan.hashtags || []).slice(0, 8), files: { video: out }, thumb: thumbOf(cover), status: 'review', fromFootage: f.id };
      schedule([post]); M().posts.push(post);
      Object.assign(f, { status: 'done', out, postId: post.id, segments: segs });
      say('mk.video', `Cut “${f.name}” into ${segs.length} shots (${segs.reduce((a, s) => a + s.end - s.start, 0).toFixed(1)}s). It’s in Content for review.`, 'ok');
    } catch (e) { f.status = 'failed'; f.error = K.cleanErr(e); say('mk.video', `Couldn’t cut ${f.name}: ${f.error}`, 'err'); }
    idle('mk.video'); save(); refreshWalls(); renderAll();
  }
  function overlayPNG(text, solid) {
    const W = 1080, H = 1920, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d');
    if (solid) { x.fillStyle = '#111'; x.fillRect(0, 0, W, H); }
    x.font = '800 78px Inter, sans-serif';
    const f = fitText(x, text, W * 0.82, H * 0.22, '800 %px Inter, sans-serif', 84, 44);
    const h = f.lines.length * f.lh + 50, y = solid ? H / 2 - h / 2 : H * 0.12;
    x.fillStyle = 'rgba(0,0,0,.55)'; x.beginPath(); x.roundRect(W * 0.06, y, W * 0.88, h, 28); x.fill();
    x.fillStyle = '#fff'; drawLines(x, f, W / 2, y + 25);
    return c;
  }

  // ---------- walls ----------
  function refreshWalls() {
    const m = M();
    const list = m.posts.filter((p) => p.thumb).sort((a, b) => (b.metrics?.views || 0) - (a.metrics?.views || 0) || b.createdAt - a.createdAt).slice(0, 18);
    Office.setMedia(list.map((p) => {
      let im = thumbs.get(p.id);
      if (!im || im.dataset.src !== p.thumb) { im = new Image(); im.src = p.thumb; im.dataset.src = p.thumb; thumbs.set(p.id, im); }
      return { img: im, label: p.metrics?.views != null ? `${p.metrics.views.toLocaleString()} views` : `${PLAT[p.platform].short} · ${p.status}` };
    }));
    const views = m.posts.reduce((a, p) => a + (p.metrics?.views || 0), 0), posted = m.posts.filter((p) => p.status === 'posted').length;
    Office.setHeaders(`${m.settings.handle || '@yourshop'} · ${posted} posted · ${views.toLocaleString()} views`, `Content library · ${m.posts.filter((p) => p.thumb).length} pieces`);
  }

  // ---------- UI ----------
  const STATUS = { drafting: ['DRAFTING', 'working'], rendering: ['RENDERING', 'working'], review: ['NEEDS REVIEW', 'medium'], ready: ['READY TO POST', 'ready'], scheduled: ['SCHEDULED', 'uploaded'], posting: ['POSTING', 'working'], posted: ['POSTED', 'published'], failed: ['FAILED', 'failed'] };
  let tab = 'content', openPost = null;
  function renderAll() { K.checkTerm?.(); renderTerminal(); renderControls(); renderNeedsInto(); renderReadouts(); K.feedTouch?.(K.feedAgent || ''); }
  function renderReadouts() {
    const ps = M().posts, n = (st) => ps.filter((p) => p.status === st).length, sum = (k) => ps.reduce((a, p) => a + (p.metrics?.[k] || 0), 0);
    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('mk-ro-sched', n('scheduled')); set('mk-ro-posted', n('posted')); set('mk-ro-views', sum('views').toLocaleString()); set('mk-ro-likes', sum('likes').toLocaleString()); set('mk-ro-review', n('review') + n('ready'));
  }
  function renderControls() {
    const b = $('#mk-run'); if (!b) return;
    b.classList.toggle('stop', running); b.textContent = running ? '■ STOP' : '▶ RUN CAMPAIGN';
    $('#mk-status').textContent = running ? `${progress?.stage || 'Working'}${progress?.i ? ` · post ${progress.i} of ${progress.n}` : ''}` : `Makes ${$('#mk-count').value} posts for ${platformsOn().map((p) => PLAT[p].name).join(', ') || 'no platforms'}`;
    const s = M().settings;
    $('#mk-auto').checked = s.auto;
    $('#mk-auto-desc').textContent = s.auto ? `On · a ${s.perRun}-post campaign every ${s.everyDays} days` : 'Off · runs only when you press Run';
  }
  function renderNeedsInto() { const box = $('#mk-needs'); if (!box) return; box.textContent = ''; for (const n of needs()) { const r = el('div', 'need ' + n.level); r.append(el('span', 'led ' + (n.level === 'warn' ? 'busy' : n.level === 'good' ? 'on' : '')), el('span', 'nt', n.text)); if (n.fn) r.append(btn(n.label, n.fn, 'mini')); box.append(r); } }
  function needs() {
    const m = M(), out = [];
    const rev = m.posts.filter((p) => p.status === 'review').length, ready = m.posts.filter((p) => p.status === 'ready').length, fail = m.posts.filter((p) => p.status === 'failed').length;
    const conn = ['instagram', 'tiktok', 'pinterest'].filter((p) => window.SOCIAL?.connected(p));
    if (!catalog().length) out.push({ level: 'warn', text: 'No designs yet — the crew promotes what the Store makes.' });
    if (rev) out.push({ level: 'warn', text: `${rev} post${rev > 1 ? 's' : ''} waiting for your approval.`, label: 'REVIEW', fn: () => { tab = 'content'; filter = 'review'; renderAll(); } });
    if (ready) out.push({ level: 'warn', text: `${ready} post${ready > 1 ? 's' : ''} ready for you to post by hand.`, label: 'VIEW', fn: () => { tab = 'content'; filter = 'ready'; renderAll(); } });
    if (fail) out.push({ level: 'warn', text: `${fail} post${fail > 1 ? 's' : ''} failed.`, label: 'VIEW', fn: () => { tab = 'content'; filter = 'failed'; renderAll(); } });
    if (!conn.length) out.push({ level: 'info', text: 'No accounts connected — posts come out as ready-to-post packs.', label: 'CONNECT', fn: () => { tab = 'accounts'; renderAll(); } });
    const next = m.posts.filter((p) => p.status === 'scheduled').sort((a, b) => a.scheduledAt - b.scheduledAt)[0];
    if (next) out.push({ level: 'good', text: `Next post: ${PLAT[next.platform].name} ${fmtWhen(next.scheduledAt)} — “${next.hook}”` });
    if (!out.some((x) => x.level === 'warn')) out.push({ level: 'good', text: 'Marketing is on track.' });
    return out;
  }
  let filter = 'all';
  function renderTerminal() {
    const host = $('#term-mk'); if (!host || host.hidden) return;
    const tabs = $('#mk-tabs'); tabs.querySelectorAll('.tab').forEach((t) => t.classList.toggle('on', t.dataset.mk === tab));
    const body = $('#mk-body'); body.textContent = '';
    ({ content: viewContent, calendar: viewCalendar, edit: viewEdit, accounts: viewAccounts, results: viewResults, community: viewCommunity }[tab] || viewContent)(body);
  }
  function platIcon(pl) { const s = el('span', 'plat', PLAT[pl]?.short || pl); s.style.setProperty('--pc', PLAT[pl]?.color || '#999'); return s; }
  function viewContent(body) {
    const bar = el('div', 'mk-bar');
    const sel = el('select'); for (const [k, v] of [['all', 'All'], ['review', 'Needs review'], ['scheduled', 'Scheduled'], ['ready', 'Ready to post'], ['posted', 'Posted'], ['failed', 'Failed']]) { const o = el('option', '', v); o.value = k; sel.append(o); }
    sel.value = filter; sel.onchange = () => { filter = sel.value; renderAll(); };
    bar.append(sel);
    const rv = M().posts.filter((p) => p.status === 'review');
    if (rv.length) bar.append(btn(`APPROVE ALL ${rv.length}`, () => { for (const p of rv) p.status = 'scheduled'; save(); renderAll(); K.toast(`${rv.length} posts scheduled`); }, 'go'));
    body.append(bar);
    const strip = el('div', 'pipeline mk-strip');
    const list = M().posts.filter((p) => filter === 'all' || p.status === filter).sort((a, b) => (a.scheduledAt || 0) - (b.scheduledAt || 0)).reverse();
    if (!list.length) { const e = el('div', 'empty'); e.innerHTML = 'No posts yet.<br>Press <b>RUN CAMPAIGN</b> and the marketing crew will plan, write, design and schedule them.'; strip.append(e); }
    for (const p of list) {
      const c = el('div', 'card mk-card' + (p.status === 'review' ? ' attn' : '')); c.tabIndex = 0;
      const th = el('div', 'thumb mk-thumb'); if (p.thumb) { const i = new Image(); i.src = p.thumb; th.append(i); } else th.append(el('div', 'wip', p.status === 'failed' ? 'FAILED' : 'MAKING…'));
      if (p.format === 'video') th.append(el('span', 'vid', '▶'));
      const mt = el('div', 'meta'); const pr = el('div', 'pill-row'); pr.append(platIcon(p.platform), el('span', 'pill ' + (STATUS[p.status]?.[1] || ''), STATUS[p.status]?.[0] || p.status));
      mt.append(pr, el('div', 'ph', p.hook || p.angle || '…'), el('div', 'tiny dim', p.status === 'posted' ? 'Posted ' + fmtWhen(p.postedAt) + (p.metrics?.views != null ? ` · ${p.metrics.views} views` : '') : p.scheduledAt ? fmtWhen(p.scheduledAt) : ''));
      if (p.error && p.status === 'failed') mt.append(el('div', 'err-line', p.error));
      c.append(th, mt); c.onclick = () => openPostDrawer(p.id); strip.append(c);
    }
    body.append(strip);
  }
  function viewCalendar(body) {
    const grid = el('div', 'cal-grid'); const start = new Date(); start.setHours(0, 0, 0, 0);
    for (let d = 0; d < 14; d++) {
      const day = new Date(start.getTime() + d * DAY), col = el('div', 'cal-day' + (d === 0 ? ' today' : ''));
      col.append(el('div', 'cal-h', day.toLocaleDateString([], { weekday: 'short', day: 'numeric' })));
      for (const p of M().posts.filter((x) => x.scheduledAt && new Date(x.scheduledAt).toDateString() === day.toDateString()).sort((a, b) => a.scheduledAt - b.scheduledAt)) {
        const it = el('button', 'cal-item ' + p.status); it.append(platIcon(p.platform), el('span', '', new Date(p.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + ' ' + (p.hook || ''))); it.onclick = () => openPostDrawer(p.id); col.append(it);
      }
      grid.append(col);
    }
    body.append(grid);
  }
  function viewEdit(body) {
    const drop = el('div', 'drop'); drop.append(el('div', 'drop-ic', '⇪'), el('b', '', 'Drop your footage here'), el('span', 'tiny dim', 'Phone clips of packing orders, unboxings, you wearing the shirts… The Video Editor watches them, picks the best moments, adds on-screen text and cuts a vertical short.'), btn('CHOOSE VIDEOS', addFootage, 'go'));
    drop.ondragover = (e) => { e.preventDefault(); drop.classList.add('over'); }; drop.ondragleave = () => drop.classList.remove('over');
    drop.ondrop = async (e) => { e.preventDefault(); drop.classList.remove('over'); const files = [...e.dataTransfer.files].filter((f) => /video/.test(f.type)); for (const f of files) { const path = kivo.pathOf?.(f); if (path) M().footage.push({ id: uid(), path, name: f.name, status: 'queued', addedAt: Date.now() }); } save(); renderAll(); for (const f of M().footage.filter((x) => x.status === 'queued')) await cutFootage(f); };
    body.append(drop);
    const list = el('div', 'foot-list');
    for (const f of [...M().footage].reverse()) {
      const r = el('div', 'foot ' + f.status); r.append(el('b', '', f.name), el('span', 'pill ' + (f.status === 'done' ? 'pass' : f.status === 'failed' ? 'fail' : 'working'), f.status.toUpperCase()), el('span', 'tiny dim', f.status === 'done' ? `${f.segments.length} shots` : f.error || ''));
      if (f.postId) r.append(btn('OPEN', () => openPostDrawer(f.postId), 'mini'));
      if (f.status === 'failed') r.append(btn('RETRY', () => cutFootage(f), 'mini'));
      list.append(r);
    }
    body.append(list);
  }
  function viewAccounts(body) {
    const g = el('div', 'acc-grid');
    for (const pl of ['instagram', 'tiktok', 'pinterest']) g.append(window.SOCIAL ? window.SOCIAL.accountCard(pl) : el('div', 'tiny dim', 'Loading…'));
    body.append(g);
  }
  function viewResults(body) {
    const posts = M().posts.filter((p) => p.status === 'posted');
    const tiles = el('div', 'tiles');
    const sum = (k) => posts.reduce((a, p) => a + (p.metrics?.[k] || 0), 0);
    for (const [k, v] of [['POSTED', posts.length], ['VIEWS', sum('views').toLocaleString()], ['LIKES', sum('likes').toLocaleString()], ['SAVES', sum('saves').toLocaleString()], ['COMMENTS', sum('comments').toLocaleString()]]) { const t = el('div', 'tile'); t.append(el('label', '', k), el('b', '', String(v))); tiles.append(t); }
    body.append(tiles);
    const row = el('div', 'row'); row.append(btn('PULL STATS NOW', pullMetrics), btn('WRITE REPORT', writeReport, 'go')); body.append(row);
    if (M().report) { const r = el('div', 'glass ledger'); r.style.whiteSpace = 'pre-wrap'; r.textContent = M().report.text; body.append(el('div', 'lbl', 'REPORTER · ' + new Date(M().report.at).toLocaleDateString()), r); }
    const t = el('table', 'cost-table'); t.innerHTML = '<thead><tr><th>POST</th><th>PLATFORM</th><th>POSTED</th><th>VIEWS</th><th>LIKES</th><th>SAVES</th></tr></thead>';
    const tb = el('tbody');
    for (const p of [...posts].sort((a, b) => (b.metrics?.views || 0) - (a.metrics?.views || 0)).slice(0, 30)) { const tr = el('tr'); tr.append(el('td', '', p.hook), el('td', '', PLAT[p.platform].name), el('td', '', fmtWhen(p.postedAt)), el('td', 'n', String(p.metrics?.views ?? '—')), el('td', 'n', String(p.metrics?.likes ?? '—')), el('td', 'n', String(p.metrics?.saves ?? '—'))); tr.onclick = () => openPostDrawer(p.id); tb.append(tr); }
    t.append(tb); body.append(t);
  }
  function viewCommunity(body) {
    const row = el('div', 'row'); row.append(btn('CHECK COMMENTS', checkComments, 'go'), el('span', 'tiny dim', 'Instagram comments on your posts, with a drafted reply for each.')); body.append(row);
    for (const c of [...M().comments].reverse().slice(0, 40)) {
      if (c.status === 'done') continue;
      const r = el('div', 'cm'); r.append(el('div', 'tiny dim', `${c.username || 'someone'} on “${c.hook}”`), el('div', 'cm-q', c.text));
      const ta = el('textarea'); ta.rows = 2; ta.value = c.draft || ''; r.append(ta);
      const acts = el('div', 'row');
      acts.append(btn('SEND REPLY', async () => { try { await window.SOCIAL.reply('instagram', c, ta.value); c.status = 'done'; say('mk.community', `Replied to ${c.username || 'a comment'}.`, 'ok'); save(); renderAll(); } catch (e) { K.toast(K.cleanErr(e), true); } }, 'go mini'), btn('SKIP', () => { c.status = 'done'; save(); renderAll(); }, 'mini'));
      r.append(acts); body.append(r);
    }
  }

  // ---------- post drawer ----------
  async function openPostDrawer(id) {
    const p = M().posts.find((x) => x.id === id); if (!p) return; openPost = id;
    const box = $('#mk-drawer-body'); box.textContent = '';
    $('#mk-drawer-title').textContent = `${PLAT[p.platform].name.toUpperCase()} ${p.format.toUpperCase()}`;
    const left = el('div', 'd-left'), right = el('div', 'd-form');
    const prev = el('div', 'glass mk-prev');
    const file = p.files?.video || p.files?.feed || p.files?.pin;
    if (file) {
      try {
        const r = await kivo.mediaRead(file);
        if (p.format === 'video') { const v = el('video'); v.src = URL.createObjectURL(new Blob([Uint8Array.from(atob(r.data), (ch) => ch.charCodeAt(0))], { type: 'video/mp4' })); v.controls = true; v.loop = true; v.autoplay = true; v.muted = true; prev.append(v); }
        else { const i = new Image(); i.src = 'data:image/png;base64,' + r.data; prev.append(i); }
      } catch { if (p.thumb) { const i = new Image(); i.src = p.thumb; prev.append(i); } }
    } else if (p.thumb) { const i = new Image(); i.src = p.thumb; prev.append(i); } else prev.append(el('div', 'wip', 'NOT RENDERED'));
    left.append(prev);
    const pills = el('div', 'pill-row'); pills.append(platIcon(p.platform), el('span', 'pill ' + (STATUS[p.status]?.[1] || ''), STATUS[p.status]?.[0] || p.status)); if (p.art?.layout) pills.append(el('span', 'pill', p.art.layout.toUpperCase()));
    right.append(pills);
    const field = (label, val, rows, key) => { right.append(el('label', 'lbl', label)); const ta = el('textarea'); ta.rows = rows; ta.value = val || ''; ta.dataset.key = key; right.append(ta); return ta; };
    const fHook = field('HOOK', p.hook, 1, 'hook');
    const fCap = field(p.platform === 'pinterest' ? 'PIN DESCRIPTION' : 'CAPTION', p.caption, 5, 'caption');
    const fTags = field('HASHTAGS', (p.hashtags || []).join(' '), 1, 'hashtags');
    let fPin; if (p.platform === 'pinterest') fPin = field('PIN TITLE', p.pinTitle || p.art?.pinTitle || '', 1, 'pinTitle');
    right.append(el('label', 'lbl', 'POST AT'));
    const when = el('input'); when.type = 'datetime-local'; if (p.scheduledAt) { const d = new Date(p.scheduledAt); when.value = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); } right.append(when);
    if (p.status === 'posted') {
      right.append(el('label', 'lbl', 'STATS (fill in by hand if the account isn’t connected)'));
      const r = el('div', 'row');
      for (const k of ['views', 'likes', 'saves']) { const f = el('div', 'field'); const i = el('input'); i.type = 'number'; i.placeholder = k; i.value = p.metrics?.[k] ?? ''; i.onchange = () => { p.metrics = { ...p.metrics, [k]: +i.value || 0, at: Date.now() }; save(); refreshWalls(); }; f.append(el('label', 'lbl', k.toUpperCase()), i); r.append(f); }
      right.append(r);
    }
    if (p.error) right.append(el('div', 'issue', '⚑ ' + p.error));
    const collect = () => { p.hook = fHook.value.trim(); p.caption = fCap.value; p.hashtags = fTags.value.split(/[\s,]+/).filter(Boolean).map((h) => '#' + h.replace(/^#/, '')); if (fPin) p.pinTitle = fPin.value.slice(0, 100); if (when.value) p.scheduledAt = new Date(when.value).getTime(); };
    const acts = el('div', 'row wrap');
    if (['review', 'ready', 'failed'].includes(p.status)) acts.append(btn(p.status === 'failed' ? 'RESCHEDULE' : 'APPROVE & SCHEDULE', () => { collect(); p.status = 'scheduled'; p.reminded = false; delete p.error; save(); closeDrawer(); renderAll(); K.toast('Scheduled for ' + fmtWhen(p.scheduledAt)); }, 'go'));
    if (p.status !== 'posted' && window.SOCIAL?.connected(p.platform)) acts.append(btn('POST NOW', async () => { collect(); closeDrawer(); await publish(p); }, 'go'));
    acts.append(btn('SAVE', () => { collect(); save(); renderAll(); K.toast('Saved'); }));
    if (p.productIds?.length) acts.append(btn('RE-RENDER', async () => { collect(); closeDrawer(); await produceMedia(p); p.status = p.status === 'posted' ? 'posted' : 'review'; save(); renderAll(); }));
    acts.append(btn('COPY CAPTION', async () => { collect(); const txt = p.platform === 'pinterest' ? `${p.pinTitle || ''}\n\n${p.caption}` : `${p.caption}\n\n${(p.hashtags || []).join(' ')}`; try { await navigator.clipboard.writeText(txt); K.toast('Caption copied'); } catch { K.toast('Couldn’t copy — select the text instead', true); } }));
    if (file) acts.append(btn(p.format === 'video' ? 'SAVE VIDEO' : 'SAVE IMAGE', async () => { const r = await kivo.mediaRead(file); const f = await kivo.saveFile({ name: file.split(/[\\/]/).pop(), data: r.data, encoding: 'base64' }); if (f) K.toast('Saved ' + f); }));
    acts.append(btn('OPEN ' + PLAT[p.platform].name.toUpperCase(), () => kivo.openUrl(p.url || { instagram: 'https://www.instagram.com/', tiktok: 'https://www.tiktok.com/upload', pinterest: 'https://www.pinterest.com/pin-creation-tool/' }[p.platform])));
    const del = btn('DELETE', () => { if (del.dataset.armed !== '1') { del.dataset.armed = '1'; del.textContent = 'CLICK AGAIN'; setTimeout(() => { del.dataset.armed = ''; del.textContent = 'DELETE'; }, 3000); return; } M().posts = M().posts.filter((x) => x.id !== p.id); save(); closeDrawer(); refreshWalls(); renderAll(); }, 'danger');
    acts.append(del);
    right.append(acts);
    if (p.status === 'posted') right.append(el('div', 'tiny dim', 'Already posted. Changes here don’t edit the live post.'));
    box.append(left, right);
    $('#mk-drawer').hidden = false;
  }
  function closeDrawer() { $('#mk-drawer').hidden = true; openPost = null; }

  // ---------- feed (zoomed-in agent panel) ----------
  function renderFeed(box, id, live, full) {
    const a = id === 'ultron' ? { id, name: 'ULTRON', zone: 'chief' } : Office.AGENTS.find((x) => x.id === id);
    if (!a) return;
    const stt = K.agentState[id] || {};
    if (full || box.dataset.agent !== id) {
      box.dataset.agent = id; box.hidden = false; box.textContent = ''; box.style.setProperty('--agent', '#9b6bff');
      const head = el('div', 'feed-head'); head.append(el('span', 'led'), el('b', '', a.name.toUpperCase()), el('span', 'feed-role', ROLE[id] || ''));
      if (AI.has(id)) { const sel = el('select', 'feed-model'); for (const [mid, n, d] of K.MODEL_CHOICES) { const o = el('option', '', `${n} · ${d}`); o.value = mid; sel.append(o); } sel.value = K.modelFor(id); sel.onchange = () => K.setAgentModel(id, sel.value); head.append(sel); }
      const x = el('button', 'wc close', '✕'); x.onclick = () => K.selectAgent(null); head.append(x);
      box.append(head);
      if (AI.has(id)) box.append(el('div', 'feed-cost'));
      box.append(el('div', 'feed-now'), el('div', 'feed-widget'), el('div', 'lbl', 'LIVE OUTPUT'), el('pre', 'feed-term'), el('div', 'lbl', 'RECENT'), el('div', 'feed-recent'));
    }
    const working = stt.status === 'WORKING';
    box.querySelector('.feed-head .led').className = 'led ' + (stt.err ? 'err' : working ? 'busy' : 'on');
    const fc = box.querySelector('.feed-cost'); if (fc) { const t = K.D.cost?.today?.[id], al = K.D.cost?.all?.[id]; fc.textContent = `COST TODAY ${K.usd(t?.usd || 0)} · ${t?.calls || 0} calls   ·   ALL TIME ${K.usd(al?.usd || 0)}`; }
    box.querySelector('.feed-now').textContent = working ? '▶ ' + (stt.text || 'Working') : 'Idle. ' + (live?.task ? 'Last job: ' + live.task : 'Waiting for the next campaign.');
    const term = box.querySelector('.feed-term'); const txt = live?.text || '';
    term.textContent = txt ? (txt.length > 2200 ? '…' + txt.slice(-2200) : txt) + (live?.busy ? '▌' : '') : AI.has(id) ? 'Output streams here live while this agent works.' : 'This agent works with files and schedules rather than writing text — see above.';
    term.classList.toggle('busy', !!live?.busy); term.scrollTop = term.scrollHeight;
    const rec = box.querySelector('.feed-recent'); rec.textContent = '';
    for (const l of K.D.log.filter((x) => x.agent === id).slice(-5).reverse()) { const r = el('div', 'ln ' + l.kind); r.append(el('span', 't', K.stamp(l.ts) + ' '), el('span', 'm', l.msg)); rec.append(r); }
    if (!rec.childNodes.length) rec.append(el('div', 'tiny dim', 'No activity yet.'));
    const w = box.querySelector('.feed-widget'); w.textContent = '';
    const posts = M().posts;
    if (['mk.designer', 'mk.art', 'mk.cover', 'mk.video'].includes(id)) {
      const g = el('div', 'mk-feedgrid');
      for (const p of posts.filter((x) => x.thumb && (id === 'mk.video' || id === 'mk.cover' ? x.format === 'video' : x.format === 'image')).slice(-6).reverse()) { const i = new Image(); i.src = p.thumb; i.title = p.hook; i.onclick = () => openPostDrawer(p.id); g.append(i); }
      if (!g.childNodes.length) g.append(el('div', 'tiny dim', 'Finished visuals appear here.'));
      w.append(g);
    } else if (['mk.hooks', 'mk.captions', 'mk.script'].includes(id)) {
      for (const p of posts.slice(-6).reverse()) { const r = el('div', 'concept'); r.append(el('b', '', '“' + (p.hook || '…') + '”'), el('span', '', id === 'mk.captions' ? (p.caption || '').slice(0, 140) : id === 'mk.script' ? (p.beats || []).map((b) => b.text).join(' → ') : PLAT[p.platform].name + ' · ' + p.angle)); w.append(r); }
    } else if (id === 'mk.schedule' || id === 'mk.publish') {
      for (const p of posts.filter((x) => ['scheduled', 'posting', 'posted', 'ready'].includes(x.status)).sort((a, b) => a.scheduledAt - b.scheduledAt).slice(0, 8)) { const r = el('div', 'cal-row'); r.append(el('span', '', p.hook), el('span', 'dim', fmtWhen(p.scheduledAt)), platIcon(p.platform)); w.append(r); }
    } else if (id === 'mk.analyst' || id === 'mk.report') {
      viewResults(w);
    } else if (id === 'ultron') {
      const c = M().campaigns.slice(-1)[0];
      if (c) { const pl = el('div', 'plan'); pl.append(el('b', '', 'CAMPAIGN ' + String(c.name || '').toUpperCase()), el('div', '', c.goal || c.brief)); w.append(pl); }
    }
  }

  // ---------- ULTRON hooks ----------
  function summary() {
    const m = M(), by = {}; for (const p of m.posts) by[p.status] = (by[p.status] || 0) + 1;
    return `Marketing: ${running ? 'a campaign is running now' : 'idle'}; posts by status ${JSON.stringify(by)}; connected: ${['instagram', 'tiktok', 'pinterest'].filter((p) => window.SOCIAL?.connected(p)).join(', ') || 'none'}; mode ${m.settings.mode}. ${performanceSummary()}`;
  }
  function stop() { if (!running) return; abort = true; K.cancelAgents(['ultron', ...Office.BASE_AGENTS.map((a) => a.id)]); K.toast('Stopping the marketing run…'); }

  // ---------- wiring ----------
  function init() {
    const m = M(), s = m.settings;
    $('#mk-brief').value = s.brief; $('#mk-count').value = s.perRun; $('#mk-mode').value = s.mode; $('#mk-handle').value = s.handle || '';
    for (const pl of Object.keys(PLAT)) { const c = $(`#mk-pl-${pl}`); c.checked = !!s.platforms[pl]; c.onchange = () => { s.platforms[pl] = c.checked; save(); renderControls(); }; }
    $('#mk-brief').onchange = () => { s.brief = $('#mk-brief').value; save(); };
    $('#mk-handle').onchange = () => { s.handle = $('#mk-handle').value.trim(); save(); refreshWalls(); };
    $('#mk-count').oninput = () => { s.perRun = Math.max(1, Math.min(20, +$('#mk-count').value || 6)); save(); renderControls(); };
    $('#mk-cdn').onclick = () => { $('#mk-count').value = Math.max(1, +$('#mk-count').value - 1); $('#mk-count').oninput(); };
    $('#mk-cup').onclick = () => { $('#mk-count').value = Math.min(20, +$('#mk-count').value + 1); $('#mk-count').oninput(); };
    $('#mk-mode').onchange = () => { s.mode = $('#mk-mode').value; save(); };
    $('#mk-run').onclick = () => (running ? stop() : runCampaign($('#mk-brief').value.trim() || s.brief, +$('#mk-count').value || 6));
    $('#mk-auto').onchange = () => { s.auto = $('#mk-auto').checked; if (s.auto && !m.lastAuto) m.lastAuto = Date.now() - s.everyDays * DAY; save(); renderControls(); };
    document.querySelectorAll('#mk-tabs .tab').forEach((t) => (t.onclick = () => { tab = t.dataset.mk; renderAll(); }));
    $('#mk-drawer-close').onclick = closeDrawer;
    $('#mk-drawer').addEventListener('mousedown', (e) => { if (e.target === $('#mk-drawer')) closeDrawer(); });
    for (const p of m.posts) if (['drafting', 'rendering', 'posting'].includes(p.status)) { p.status = p.files?.feed || p.files?.pin || p.files?.video ? 'review' : 'failed'; p.error = p.error || 'App closed while this was being made'; }
    for (const f of m.footage) if (['watching', 'cutting', 'queued'].includes(f.status)) { f.status = 'failed'; f.error = 'App closed mid-cut'; }
    refreshWalls(); renderAll();
    setInterval(async () => { await tick(); autoTick(); }, 30000); setTimeout(tick, 5000);
  }
  function autoTick() {
    const m = M(), s = m.settings;
    if (!s.auto || running || !K.keys.anthropic) return;
    if (Date.now() - (m.lastAuto || 0) < s.everyDays * DAY) return;
    m.lastAuto = Date.now(); save();
    say('ultron', 'Marketing autopilot: starting this week’s campaign.');
    runCampaign(s.brief, s.perRun);
  }

  window.MK = { init, runCampaign, stop, tick, pullMetrics, addFootage, renderAll, renderFeed, refreshWalls, summary, needs, ROLE, AI, PLAT, publish, openPostDrawer, get running() { return running; }, M };
})();
