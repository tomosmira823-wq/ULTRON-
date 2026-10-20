// Kivo Ultron — agents, autopilot, Printify/Etsy operations
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => new Date().toISOString().slice(0, 10);
  const DAY = 86400e3;

  const AGENTS = [
    { id: 'ultron',  name: 'ULTRON',  role: 'Commander · plans missions, takes your orders' },
    { id: 'analyst', name: 'ANALYST', role: 'Syncs orders, learns what sells' },
    { id: 'scout',   name: 'SCOUT',   role: 'Trend scan · niches, phrases, buyers' },
    { id: 'forge',   name: 'FORGE',   role: 'Designer · print-ready artwork' },
    { id: 'scribe',  name: 'SCRIBE',  role: 'Etsy title, 13 tags, description' },
    { id: 'auditor', name: 'AUDITOR', role: 'QA · trademark and Etsy rule checks' },
    { id: 'ledger',  name: 'LEDGER',  role: 'Fees, cost, price and profit' },
    { id: 'courier', name: 'COURIER', role: 'Printify upload, Etsy publish, orders to print' },
  ];
  const AI_AGENTS = ['ultron', 'scout', 'forge', 'scribe', 'auditor'];
  const MODEL_CHOICES = [['claude-opus-5-5', 'Opus 5.5', 'smartest, priciest'], ['claude-sonnet-5-5', 'Sonnet 5.5', 'balanced'], ['claude-haiku-5-5', 'Haiku 5.5', 'fastest, cheapest']];
  const modelName = (id) => (MODEL_CHOICES.find((m) => m[0] === id) || [id, id])[1];
  function resolveModel(v) {
    const x = String(v || '').toLowerCase().trim();
    if (/^claude-[a-z0-9.-]+$/.test(x)) return x;
    const hit = MODEL_CHOICES.find((m) => x.includes(m[1].split(' ')[0].toLowerCase()));
    return hit ? hit[0] : null;
  }
  // Claude API list prices, USD per million tokens [input, output] (platform.claude.com/docs/en/about-claude/pricing)
  const PRICES = { 'claude-opus-5-5': [4, 20], 'claude-sonnet-5-5': [2, 10], 'claude-haiku-5-5': [0.1, 0.5], 'claude-fable-5-1': [10, 50] };
  function priceOf(model, inTok, outTok) {
    let p = PRICES[model];
    if (model === 'claude-haiku-5-5' && inTok > 100000) p = [0.5, 2.5];
    if (!p) p = /opus/.test(model) ? [5, 25] : /haiku/.test(model) ? [1, 5] : [3, 15]; // older models: conservative estimate
    return (inTok * p[0] + outTok * p[1]) / 1e6;
  }
  const usd = (n) => '$' + (n < 0.01 && n > 0 ? n.toFixed(4) : n < 1 ? n.toFixed(3) : n.toFixed(2));
  function recordCost(agent, model, u) {
    const inT = u.input_tokens || 0, outT = u.output_tokens || 0, c = priceOf(model, inT, outT) + (u.searches || 0) * 0.01, a = agent || 'other';
    rollDay();
    D.cost = D.cost || { all: {}, today: {} };
    for (const bucket of [D.cost.all, D.cost.today]) { const x = bucket[a] = bucket[a] || { usd: 0, calls: 0, in: 0, out: 0 }; x.usd += c; x.calls++; x.in += inT; x.out += outT; }
    D.day.usd = (D.day.usd || 0) + c;
    const pid = agent && cur[agent]; const p = pid && D.products.find((x) => x.id === pid);
    if (p && agent !== 'ultron') p.aiCost = (p.aiCost || 0) + c;
    return c;
  }
  const costOf = (a, when = 'today') => D.cost?.[when]?.[a]?.usd || 0;
  const modelFor = (agent, fast) => (agent && D.settings.agentModels?.[agent]) || (fast ? D.settings.fast : D.settings.model);
  function setAgentModel(agent, model, quiet) {
    D.settings.agentModels = { ...D.settings.agentModels, [agent]: model };
    persist(); if (!quiet) { log(agent, `Now running on ${modelName(model)}.`, 'ok'); toast(`${agent.toUpperCase()} → ${modelName(model)}`); }
    if (feedAgent === agent) renderFeed(true);
  }
  const MODES = { auto: 'FULL AUTO', review: 'REVIEW FIRST', design: 'DESIGN ONLY' };

  const DEFAULTS = {
    model: 'claude-sonnet-5-5', fast: 'claude-haiku-5-5',
    agentModels: { ultron: 'claude-sonnet-5-5', scout: 'claude-sonnet-5-5', forge: 'claude-sonnet-5-5', scribe: 'claude-sonnet-5-5', auditor: 'claude-haiku-5-5' },
    template: 'cottagecore', shopName: '', voice: '', defaultBrief: '',
    mode: 'review', currency: 'GBP', defaultCost: 11, minMargin: 25, vat: true,
    shopId: '', shopTitle: '', shopChannel: '', blueprintId: '', blueprintTitle: '', providerId: '', providerTitle: '',
    colours: 'White', variants: [],
    auto: false, hours: 6, acount: 3, maxPerDay: 10, qaMin: 85, retireDays: 60, tokenCap: 0, spendCap: 0,
    autoApprove: true, winners: true,
  };
  let D = {
    setupDone: false, products: [], log: [], orders: [], chat: [],
    settings: { ...DEFAULTS }, day: { date: today(), tokens: 0, designs: 0 }, history: {},
    ui: { brief: '', count: 3, tone: 'light' }, lastAuto: 0, lastSync: 0, lastRetire: 0, lastSeenOrders: 0, ackApproval: false,
  };
  let keys = { anthropic: false, printify: false };
  let prefs = { closeToTray: true, openAtLogin: true };
  let running = false, abortFlag = false, logFilter = null, openId = null, syncing = false;
  let feedAgent = null, lastPlan = null, lastTrends = [], courierRun = null, progress = null, stopping = false;
  const cur = {};
  const agentState = {};

  // ---------- persistence ----------
  let saveT;
  function persist() { clearTimeout(saveT); saveT = setTimeout(() => kivo.save(D), 300); }

  // ---------- helpers ----------
  const SYM = { GBP: '£', USD: '$', EUR: '€' };
  const money = (n) => (n == null || isNaN(n)) ? '—' : (n < 0 ? '−' : '') + (SYM[D.settings.currency] || '') + Math.abs(Number(n)).toFixed(2);
  function toast(msg, err) {
    const t = $('#toast'); t.textContent = msg; t.className = err ? 'err' : ''; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), err ? 6000 : 3200);
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(label, fn, cls) { const b = el('button', 'hw-btn ' + (cls || ''), label); b.onclick = fn; return b; }
  const stamp = (ts) => new Date(ts).toTimeString().slice(0, 8);
  const tpl = () => TEMPLATES.find((t) => t.id === D.settings.template) || TEMPLATES[0];
  const notify = (t, b) => kivo.notify(t, b);
  function rollDay() {
    if (D.day.date !== today()) { D.history[D.day.date] = { tokens: D.day.tokens, designs: D.day.designs, usd: D.day.usd || 0 }; D.day = { date: today(), tokens: 0, designs: 0, usd: 0 }; if (D.cost) D.cost.today = {}; }
  }

  function log(agent, msg, kind) {
    D.log.push({ ts: Date.now(), agent, msg, kind: kind || '' }); feedTouch(agent);
    if (D.log.length > 600) D.log.splice(0, D.log.length - 600);
    renderLog(); persist();
  }
  function renderLog() {
    const box = $('#log'); const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.textContent = '';
    for (const l of D.log.slice(-250)) {
      if (logFilter && l.agent !== logFilter) continue;
      const ln = el('div', 'ln ' + l.kind);
      ln.append(el('span', 't', stamp(l.ts) + ' '), el('span', 'a', '[' + nameOf(l.agent) + '] '), el('span', 'm', l.msg));
      box.append(ln);
    }
    if (atBottom) box.scrollTop = box.scrollHeight;
  }

  const nameOf = (id) => (AGENTS.find((a) => a.id === id)?.name || window.Office?.AGENTS.find((a) => a.id === id)?.name || window.SP?.nameOf(id) || id).toUpperCase();
  const dept = () => D.ui.dept || 'store';
  function setAgent(id, status, text, err) {
    agentState[id] = { status, text: text || '', err: !!err };
    if (id.startsWith('sp.') || id === 'ultron') window.SP?.setBusy(id, status === 'WORKING', text || '', err);
    if (id.startsWith('mk.') || id === 'ultron') window.Office?.setBusy(id, status === 'WORKING', text || '', err);
    if (!id.startsWith('mk.') && !id.startsWith('sp.')) Station.setBusy(id, status === 'WORKING', text || '', err);
    if (id === 'ultron') Core.setActive(status === 'WORKING');
    renderRoster(); feedTouch(id); if (feedAgent === 'ultron') feedTouch('ultron'); if (running) renderControls();
  }
  function renderRoster() {
    const ul = $('#roster'); ul.textContent = '';
    if (window.SP?.get(dept())) { SP.renderRoster(ul); return; }
    if (dept() === 'marketing' && window.MK) {
      const list = [{ id: 'ultron', name: 'ULTRON', zone: 'chief' }, ...Office.BASE_AGENTS];
      let zone = '';
      for (const a of list) {
        if (a.zone !== zone) { zone = a.zone; ul.append(el('li', 'zone-h', zone === 'chief' ? 'CHIEF OF STAFF' : zone.toUpperCase())); }
        const s = agentState[a.id] || { status: keys.anthropic ? 'IDLE' : 'OFFLINE' };
        const li = el('li', (s.status === 'WORKING' ? 'busy ' : '') + (feedAgent === a.id ? 'sel' : ''));
        li.append(el('span', 'led ' + (s.err ? 'err' : s.status === 'WORKING' ? 'busy' : 'on')), el('span', 'nm', a.name.toUpperCase()), el('span', 'st', s.err ? 'FAULT' : s.status || 'IDLE'));
        li.append(el('span', 'rl', s.status === 'WORKING' && s.text ? s.text : MK.ROLE[a.id] || ''));
        if (MK.AI.has(a.id)) li.append(el('span', 'cost', `${modelName(modelFor(a.id)).split(' ')[0]} · ${usd(costOf(a.id))} today`));
        li.onclick = () => selectAgent(a.id); ul.append(li);
      }
      window.SP?.rosterHires(ul, 'marketing');
      return;
    }
    for (const a of AGENTS) {
      const s = agentState[a.id] || { status: 'IDLE' };
      const li = el('li', (s.status === 'WORKING' ? 'busy ' : '') + (logFilter === a.id ? 'sel' : ''));
      li.append(el('span', 'led ' + (s.err ? 'err' : s.status === 'WORKING' ? 'busy' : s.status === 'OFFLINE' ? '' : 'on')), el('span', 'nm', a.name), el('span', 'st', s.err ? 'FAULT' : s.status));
      li.append(el('span', 'rl', s.status === 'WORKING' && s.text ? s.text : a.role));
      if (AI_AGENTS.includes(a.id)) li.append(el('span', 'cost', `${modelName(modelFor(a.id)).split(' ')[0]} · ${usd(costOf(a.id))} today`));
      li.title = a.role + ' — click to see only this agent in the comms log';
      li.onclick = () => selectAgent(a.id);
      ul.append(li);
    }
    window.SP?.rosterHires(ul, 'store');
  }
  function selectAgent(id) {
    if (id === 'hire') { SP.openHire(dept()); return; }
    const next = id && feedAgent !== id ? id : null;
    feedAgent = next; logFilter = next;
    if (SP.get(dept())) SP.focus(next);
    else if (dept() === 'marketing') { Office.focus(next); Office.highlight(next); }
    else { Station.focus(next); Station.highlight(next); }
    renderRoster(); renderLog(); renderFeed(true);
  }

  // ---------- Claude ----------
  const live = {}, reqAgent = {}; let reqSeq = 0;
  const cleanErr = (e) => String(e?.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  async function ask(prompt, { fast = false, maxTokens = 4000, agent = null, task = '', model: forceModel = null, images = null, web = 0, onCost = null } = {}) {
    if (!keys.anthropic) throw new Error('Add your Anthropic API key in Settings.');
    rollDay();
    if (D.settings.spendCap && (D.day.usd || 0) >= D.settings.spendCap) throw new Error(`Daily spend cap of $${D.settings.spendCap} reached — raise it in Settings or wait until tomorrow.`);
    const model = forceModel || modelFor(agent, fast);
    const reqId = ++reqSeq;
    if (agent) { live[agent] = { task, text: '', busy: true, at: Date.now(), search: '' }; reqAgent[reqId] = agent; feedTouch(agent); }
    try {
      let r;
    try { r = await kivo.ask({ prompt, model, maxTokens, stream: !!agent, reqId, images, web: web || undefined }); }
    catch (e) { const m = cleanErr(e); throw new Error(/ABORTED/.test(m) ? 'ABORTED' : m); }
      if (agent) live[agent].text = r.text;
      D.day.tokens += (r.usage.input_tokens || 0) + (r.usage.output_tokens || 0);
      const c = recordCost(agent, model, r.usage); if (onCost) onCost(c);
      renderCmd(); persist();
      return r.text;
    } finally { if (agent) { live[agent].busy = false; delete reqAgent[reqId]; feedTouch(agent); } }
  }
  function parseJSON(text) {
    const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    const s = f ? f[1] : text;
    try { return JSON.parse(s); } catch {}
    const a = s.search(/[\[{]/); const b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
    throw new Error('Agent returned unreadable data');
  }
  const fatal = (e) => /ABORTED|API key|x-api-key|401|403|credit|billing|cap reached/i.test(e.message);
  // ask for JSON; if the reply is malformed, repair it cheaply before re-asking
  const localRepair = (t) => t.replace(/[\u201c\u201d]/g, '"').replace(/,\s*([}\]])/g, '$1');
  async function askJSON(prompt, opts = {}) {
    let raw = await ask(prompt, opts);
    try { return parseJSON(raw); } catch {}
    try { return parseJSON(localRepair(raw)); } catch {}
    try {
      const fixed = await ask(`The text below was meant to be valid JSON but has a syntax error (often an unescaped quote inside a string). Return ONLY the corrected JSON with the same content — escape inner quotes, no commentary.\n\n${raw.slice(0, 20000)}`,
        { ...opts, model: 'claude-haiku-5-5', task: (opts.task || 'Working') + ' (fixing format)', maxTokens: Math.max(2000, opts.maxTokens || 2000) });
      return parseJSON(fixed);
    } catch (e) { if (fatal(e)) throw e; }
    raw = await ask(prompt + '\n\nIMPORTANT: reply with valid JSON only. Escape any double quotes inside strings as \\".', opts);
    return parseJSON(raw);
  }

  function shopContext() {
    const s = D.settings, t = tpl();
    return `Today is ${new Date().toDateString()}. Shop: ${s.shopName || 'an Etsy print-on-demand shop'}. Brand voice: ${s.voice || t.voice}. Shop focus: ${s.defaultBrief || t.brief}
Selling calendar (made-to-order shirts take ~10 days to arrive, new listings take a few days to show in search): ${calendarText()}.
Calendar rules: PRIME = the best holidays to design for now. LAST CHANCE = only worth it for quick wins, at most one design. TOO LATE = don't design for it, unless the owner's brief explicitly asks for it. EARLY = fine for a head start. If the owner's brief names a holiday, always follow the brief.${window.SP?.crewNotes('store') || ''}`;
  }

  // ---------- selling calendar ----------
  // Print-on-demand needs ~10 days from order to doorstep, and a new Etsy listing needs a few days to show in search.
  function easter(y) { const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = ((h + l - 7 * m + 114) % 31) + 1; return new Date(y, mo - 1, da); }
  const nthDow = (y, m, dow, n) => { const d = new Date(y, m, 1); const off = (dow - d.getDay() + 7) % 7; return new Date(y, m, 1 + off + (n - 1) * 7); };
  function sellingCalendar(now = new Date()) {
    const uk = D.settings.currency === 'GBP', out = [];
    for (const y of [now.getFullYear(), now.getFullYear() + 1]) {
      const e = easter(y), thanks = nthDow(y, 10, 4, 4);
      const list = [
        ['New Year', new Date(y, 0, 1)], ['Valentine’s Day', new Date(y, 1, 14)], ['St Patrick’s Day', new Date(y, 2, 17)],
        ['Mother’s Day', uk ? new Date(e.getFullYear(), e.getMonth(), e.getDate() - 21) : nthDow(y, 4, 0, 2)], ['Easter', e],
        ['Father’s Day', nthDow(y, 5, 0, 3)], ['Pride Month', new Date(y, 5, 1)], ['Graduation season', new Date(y, 5, 15)], ['Summer holidays', new Date(y, 6, 20)],
        ['Back to school', new Date(y, 8, 1)], ['Halloween', new Date(y, 9, 31)], ['Bonfire Night', uk ? new Date(y, 10, 5) : null],
        ['Thanksgiving', uk ? null : thanks], ['Black Friday & Cyber Monday', new Date(thanks.getFullYear(), 10, thanks.getDate() + 1)], ['Christmas', new Date(y, 11, 25)],
      ];
      for (const [name, date] of list) {
        if (!date) continue;
        const days = Math.ceil((date - now) / DAY);
        if (days < -1 || days > 150) continue;
        const cutoff = days - 10; // last order date for delivery on time
        const status = cutoff < 3 ? 'TOO LATE' : cutoff < 14 ? 'LAST CHANCE' : days <= 75 ? 'PRIME' : 'EARLY';
        out.push({ name, date, days, status });
      }
    }
    return out.sort((a, b) => a.days - b.days);
  }
  const calendarText = () => sellingCalendar().map((h) => `${h.name} (${h.date.toDateString().slice(4, 10)}, ${h.days} days away): ${h.status}`).join('; ');

  // ---------- SVG ----------
  function sanitizeSVG(raw) {
    let s = String(raw).replace(/```(?:svg|xml)?/g, '');
    const a = s.indexOf('<svg'), b = s.lastIndexOf('</svg>');
    if (a < 0 || b < 0) throw new Error('No SVG in design output');
    s = s.slice(a, b + 6);
    const doc = new DOMParser().parseFromString(s, 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('Design SVG was malformed');
    const root = doc.documentElement;
    root.querySelectorAll('script,foreignObject,image,iframe').forEach((n) => n.remove());
    root.querySelectorAll('*').forEach((n) => { for (const at of [...n.attributes]) { if (/^on/i.test(at.name) || (/href$/i.test(at.name) && !/^#/.test(at.value))) n.removeAttribute(at.name); } });
    for (const at of [...root.attributes]) if (/^on/i.test(at.name)) root.removeAttribute(at.name);
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', '0 0 900 1080');
    root.setAttribute('width', '900'); root.setAttribute('height', '1080');
    return new XMLSerializer().serializeToString(root);
  }
  const svgURL = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  function svgText(svg) { try { const d = new DOMParser().parseFromString(svg, 'image/svg+xml'); return [...d.querySelectorAll('text')].map((n) => n.textContent.trim()).filter(Boolean).join(' / '); } catch { return ''; } }
  function svgToPNG(svg, w = 4500, h = 5400) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        res(c.toDataURL('image/png').split(',')[1]);
      };
      img.onerror = () => rej(new Error('Could not render design to PNG'));
      img.src = svgURL(svg);
    });
  }

  // ---------- Ledger ----------
  const FEES = { GBP: { list: 0.16, pct: 0.04, fix: 0.20 }, USD: { list: 0.20, pct: 0.03, fix: 0.25 }, EUR: { list: 0.19, pct: 0.04, fix: 0.30 } };
  function ledger(price, cost) {
    const f = FEES[D.settings.currency] || FEES.GBP, v = D.settings.vat ? 1.2 : 1;
    const listing = f.list * v, transaction = price * 0.065 * v, processing = (price * f.pct + f.fix) * v;
    const fees = listing + transaction + processing;
    const profit = price - cost - fees;
    return { price, cost, listing, transaction, processing, fees, profit, margin: price ? profit / price : 0 };
  }
  function minPrice(cost) {
    const f = FEES[D.settings.currency] || FEES.GBP, v = D.settings.vat ? 1.2 : 1, m = D.settings.minMargin / 100;
    return Math.ceil((cost + (f.list + f.fix) * v) / (1 - (0.065 + f.pct) * v - m)) - 0.01;
  }
  function orderProfit(o) { // shipping is paid by the buyer on Etsy, so it nets out
    const f = FEES[D.settings.currency] || FEES.GBP, v = D.settings.vat ? 1.2 : 1;
    const qty = o.items.reduce((s, i) => s + i.qty, 0);
    const fees = (o.sales * (0.065 + f.pct) + f.fix + f.list * qty) * v;
    return o.sales - o.itemCost - fees;
  }

  // ---------- learning ----------
  function salesInsight() {
    const sold = D.products.filter((p) => p.sales?.qty > 0).sort((a, b) => b.sales.qty - a.sales.qty).slice(0, 6);
    const dead = D.products.filter((p) => p.status === 'published' && !(p.sales?.qty > 0) && Date.now() - (p.printify?.publishedAt || Date.now()) > 14 * DAY).slice(-8);
    let s = '';
    if (sold.length) s += 'Best sellers: ' + sold.map((p) => `"${p.trend.phrase}" (${p.trend.style}, ${p.sales.qty} sold)`).join('; ') + '. ';
    if (dead.length) s += 'Not selling after 2+ weeks: ' + dead.map((p) => `"${p.trend.phrase}" (${p.trend.style})`).join('; ') + '. ';
    return s || 'No sales data yet.';
  }

  // ---------- mission ----------
  function checkAbort() { if (abortFlag) throw new Error('ABORTED'); }

  async function runMission(brief, count, opts = {}) {
    if (running) return;
    if (!keys.anthropic) { toast('Add your Anthropic API key first.', true); openWizard(1); return; }
    const mode = opts.mode || D.settings.mode;
    const tone = opts.tone || D.ui.tone || tpl().tone;
    running = true; abortFlag = false; uiRunning(true);
    const made = []; let parked = 0;
    try {
      setAgent('ultron', 'WORKING', 'Planning mission');
      log('ultron', `Mission received: "${brief}" · ${count} designs · ${tone} shirts · ${MODES[mode]}`);

      if (keys.printify && D.settings.shopId && Date.now() - D.lastSync > 30 * 60e3) await syncAll(true);
      let insights = salesInsight();
      if (insights !== 'No sales data yet.') {
        setAgent('analyst', 'WORKING', 'Briefing commander');
        log('analyst', insights, 'ok');
        Station.packet('analyst', 'ultron', '#c38bff'); await sleep(500);
        setAgent('analyst', 'IDLE');
      }

      const existing = D.products.slice(-120).map((p) => p.trend?.phrase).filter(Boolean);
      const plan = await askJSON(`You are ULTRON, commander of an autonomous print-on-demand Etsy studio. Turn the brief into a mission plan.
${shopContext()}
Mission brief: ${brief}
Number of designs: ${count}
Shirts: ${tone === 'dark' ? 'dark (black/charcoal/navy)' : 'light (white/cream/pastel)'}
Sales data: ${insights}
${D.settings.winners ? 'If there are best sellers, use up to a third of the angles for fresh variations on what is selling (new phrase, same buyer and style). Avoid styles that are not selling.' : ''}
Phrases already made (never repeat): ${existing.join(' | ') || 'none'}
Reply with JSON only: {"codename": "two-word codename", "directive": "2 sentences telling the scout what to hunt for", "angles": ["${count} distinct angles, each a few words"]}`, { fast: true, maxTokens: 900, agent: 'ultron', task: 'Planning the mission' });
      lastPlan = plan;
      checkAbort();
      $('#mission-chip').textContent = `MISSION ${String(plan.codename || 'UNNAMED').toUpperCase()} · ${count} DESIGNS`;
      log('ultron', `Codename ${plan.codename}. ${plan.directive}`, 'ok');
      setAgent('ultron', 'WORKING', 'Delegating');
      Station.packet('ultron', 'scout');

      setAgent('scout', 'WORKING', 'Scanning trends');
      const trends = await askJSON(`You are SCOUT, the trend agent for an Etsy print-on-demand t-shirt shop. Find ${count} concrete, sellable design concepts.
${shopContext()}
Mission directive: ${plan.directive}
Angles (one concept each): ${(plan.angles || []).join('; ')}
Brief: ${brief}
Avoid these existing phrases: ${existing.join(' | ') || 'none'}
Rules: original phrases only. No trademarks, brands, franchises, celebrities, characters, sports teams, real book/film/song titles or lyrics. Think about what Etsy buyers search for and gift.
Reply with a JSON array of ${count} objects: {"phrase": "the words printed on the shirt (short)", "niche": "...", "audience": "who buys it", "style": "visual style", "palette": ["#hex", "#hex", "#hex"], "why": "one sentence why it sells", "keywords": ["5 search keywords"]}`, { maxTokens: 2500, agent: 'scout', task: 'Scanning for trends' });
      checkAbort();
      const list = (Array.isArray(trends) ? trends : trends.items || trends.concepts || []).filter((x) => x && x.phrase).slice(0, count);
      lastTrends = list;
      if (!list.length) throw new Error('Scout came back empty');
      log('scout', `Found ${list.length} concepts: ${list.map((x) => '"' + x.phrase + '"').join(', ')}`, 'ok');
      setAgent('scout', 'IDLE');

      const items = list.map((tr) => {
        const p = { id: uid(), createdAt: Date.now(), mission: plan.codename, tone, status: 'working', stage: 'design', trend: tr, svg: '', listing: null, qa: null, ledger: null, printify: {}, sales: { qty: 0, revenue: 0 } };
        D.products.push(p); return p;
      });
      renderPipeline(); persist();

      let idx = 0;
      for (const p of items) {
        checkAbort(); progress = { i: ++idx, n: items.length, phrase: p.trend.phrase }; renderControls();
        if (await produceWithRetry(p, mode)) made.push(p); else parked++;
      }
      const live = made.filter((p) => p.status === 'published').length, rev = made.filter((p) => p.status === 'review').length;
      const sum = `${made.length}/${items.length} designs made` + (live ? ` · ${live} live on Etsy` : '') + (rev ? ` · ${rev} waiting for your review` : '') + (parked ? ` · ${parked} parked for a retry` : '');
      log('ultron', `Mission ${plan.codename} complete. ${sum}.`, 'ok');
      toast('Mission complete · ' + sum);
      notify(`Mission ${plan.codename} complete`, sum);
      const recap = `Mission "${plan.codename}" (${brief}): ${sum}. New designs: ${made.map((p) => `"${p.trend.phrase}" [${p.status}] title: ${p.listing?.title || ''} · tags: ${(p.listing?.tags || []).join(', ')} · price ${p.ledger ? money(p.ledger.price) : '?'}`).join(' | ')}`;
      setTimeout(() => window.SP?.afterRun('store', recap), 0);
    } catch (e) {
      if (e.message === 'ABORTED') log('ultron', 'Mission aborted.', 'err');
      else { log('ultron', 'Mission failed: ' + e.message, 'err'); toast(e.message, true); notify('Mission failed', e.message); }
      for (const p of D.products) if (p.status === 'working') { p.status = 'failed'; p.error = p.error || 'Mission stopped'; }
    } finally {
      running = false; uiRunning(false);
      for (const a of AGENTS) if (agentState[a.id]?.status === 'WORKING') setAgent(a.id, 'IDLE');
      $('#mission-chip').textContent = 'NO ACTIVE MISSION';
      renderAll(); persist();
      if (missionQueue.length && !abortFlag) { const j = missionQueue.shift(); log('ultron', `Starting queued mission: ${j.n} designs.`); runMission(j.brief, j.n, j.opts); }
      else if (abortFlag && missionQueue.length) { log('ultron', `Cleared ${missionQueue.length} queued mission(s) after abort.`, 'err'); missionQueue.length = 0; }
    }
  }

  async function forge(p) {
    cur.forge = p.id; setAgent('forge', 'WORKING', `Drawing "${p.trend.phrase}"`);
    p.stage = 'design'; renderPipeline();
    const tr = p.trend;
    const prompt = `You are FORGE, the design agent in a print-on-demand t-shirt studio. Create ONE original, high-quality t-shirt graphic as SVG.
Phrase printed on the design: "${tr.phrase}"
Niche: ${tr.niche}. Buyer: ${tr.audience}. Style: ${tr.style}. Suggested palette: ${(tr.palette || []).join(', ')}.
Shirt: ${p.tone === 'dark' ? 'BLACK / dark shirts — use light, bright inks that pop on black' : 'WHITE / light shirts — use mid-to-dark inks that read on white'}.
Rules:
- Output ONLY the SVG markup, starting with <svg and ending with </svg>. No commentary, no code fences.
- Root element exactly: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 1080" width="900" height="1080">
- Transparent background: never draw a full-canvas background rectangle.
- A real illustration, not just text: build it from paths, circles and ellipses (flowers, leaves, objects, badges, banners) with care and detail, composed as a centred chest print.
- Lettering with <text>, font-family from: Georgia, 'Times New Roman', serif, cursive, 'Brush Script MT', 'Trebuchet MS', Impact, sans-serif. Large, legible from 2 metres, every glyph at least 60px inside the canvas edges. Spell the phrase exactly.
- 3 to 6 solid colours, screen-print friendly. No gradients, filters, masks, <image>, external references or scripts.
- Original artwork only: no logos, brands, characters or celebrities.
- Keep it under 16KB.`;
    let svg, err;
    for (let i = 0; i < 2 && !svg; i++) {
      try { svg = sanitizeSVG(await ask(prompt, { maxTokens: 9000, agent: 'forge', task: `Drawing "${tr.phrase}"` })); } catch (e) { err = e; if (fatal(e)) throw e; }
    }
    if (!svg) throw err || new Error('Design failed');
    p.svg = svg; rollDay(); D.day.designs++; renderPipeline(); persist();
    log('forge', `Artwork done for "${tr.phrase}" (${(svg.length / 1024).toFixed(1)} KB)`, 'ok');
    setAgent('forge', 'IDLE');
  }

  // up to 3 attempts per design; each attempt resumes from the step that broke
  async function produceWithRetry(p, mode, tries = 3) {
    for (let i = 1; i <= tries; i++) {
      try {
        p.attempts = (p.attempts || 0) + 1;
        await produce(p, mode);
        delete p.retryable;
        return true;
      } catch (e) {
        if (e.message === 'ABORTED' || fatal(e)) { parkProduct(p, e); throw e; }
        if (i < tries) {
          log('ultron', `"${p.trend.phrase}" hit a snag at ${p.lastStep || 'design'} (${e.message}). Retrying ${i + 1}/${tries}…`, 'err');
          p.status = 'working'; renderPipeline();
          await sleep(2000 * i); checkAbort();
        } else { parkProduct(p, e); log('ultron', `"${p.trend.phrase}" still failing after ${tries} tries — parked. Autopilot will try again later.`, 'err'); }
      }
    }
    return false;
  }
  function parkProduct(p, e) {
    p.stage = '';
    if (e.message === 'ABORTED') { p.status = 'failed'; p.error = 'Mission aborted'; }
    else if (p.svg && p.listing) { p.status = 'review'; p.reviewReason = `Stopped at ${p.lastStep || 'a late step'}: ${e.message}`; p.retryable = true; }
    else { p.status = 'failed'; p.error = e.message; p.retryable = !fatal(e); }
    renderPipeline(); persist();
  }
  async function retryAll() {
    if (running) { toast('Wait for the current mission to finish.', true); return; }
    abortFlag = false;
    const list = D.products.filter((p) => p.retryable && ['failed', 'review'].includes(p.status) && p.trend);
    log('ultron', `Retrying ${list.length} unfinished design${list.length > 1 ? 's' : ''}.`);
    for (const p of list) { p.attempts = 0; await retryProduct(p); if (abortFlag) break; }
  }
  async function retryProduct(p) {
    running = true; uiRunning(true); p.status = 'working'; delete p.reviewReason; delete p.error; renderPipeline();
    try { await produceWithRetry(p, D.settings.mode, 2); }
    catch (e) { toast(e.message, true); }
    finally { running = false; uiRunning(false); for (const a of AGENTS) if (agentState[a.id]?.status === 'WORKING') setAgent(a.id, 'IDLE'); renderAll(); persist(); }
  }

  async function produce(p, mode) {
    const tr = p.trend;
    if (!p.svg) { Station.packet('scout', 'forge', '#5ac8ff'); p.lastStep = 'the design'; await forge(p); checkAbort(); }
    if (p.listing) { await finish(p, mode); return; }
    p.lastStep = 'the listing';

    Station.packet('forge', 'scribe', '#ff8a5a');
    cur.scribe = p.id; setAgent('scribe', 'WORKING', `Writing "${tr.phrase}"`);
    p.stage = 'listing'; renderPipeline();
    const product = D.settings.blueprintTitle || 'Unisex cotton t-shirt';
    const L = await askJSON(`You are SCRIBE, an Etsy SEO copywriter. Write the listing for this print-on-demand ${product}.
${shopContext()}
Design phrase: "${tr.phrase}". Niche: ${tr.niche}. Buyer: ${tr.audience}. Style: ${tr.style}. Keywords: ${(tr.keywords || []).join(', ')}.
Currency: ${D.settings.currency}. Template price guide: ${tpl().price}.
Etsy rules: title max 140 characters, front-load the strongest search phrase, natural wording, no ALL CAPS words, no repeated words, at most one each of & and :, no other special characters. Exactly 13 tags, each 20 characters or fewer, lowercase, multi-word phrases buyers type.
Description: in the brand voice, 120-200 words, then a short "Details" section with care and fit notes for a ${product}, then a gift line. Plain line breaks, no markdown symbols.
Reply with JSON only: {"title": "...", "tags": ["13 tags"], "description": "...", "price": suggested retail price as a number}`, { maxTokens: 2000, agent: 'scribe', task: `Writing the listing for "${tr.phrase}"` });
    checkAbort();
    p.listing = {
      title: String(L.title || tr.phrase).replace(/\s+/g, ' ').trim().slice(0, 140),
      tags: [...new Set((L.tags || []).map((t) => String(t).toLowerCase().trim().slice(0, 20)).filter(Boolean))].slice(0, 13),
      description: String(L.description || ''),
      price: Number(L.price) || tpl().price,
    };
    log('scribe', `Listing: ${p.listing.title}`, 'ok');
    setAgent('scribe', 'IDLE'); renderPipeline(); persist();
    await finish(p, mode);
  }

  async function finish(p, mode) {
    const tr = p.trend;
    Station.packet('scribe', 'auditor', '#ffd36b');
    p.lastStep = 'the QA check';
    await audit(p); checkAbort();
    p.lastStep = 'pricing';

    Station.packet('auditor', 'ledger', '#ff6b8b');
    cur.ledger = p.id; setAgent('ledger', 'WORKING', 'Pricing');
    price(p);
    log('ledger', `Price ${money(p.ledger.price)} · cost ${money(p.ledger.cost)} · fees ${money(p.ledger.fees)} · profit ${money(p.ledger.profit)} (${(p.ledger.margin * 100).toFixed(0)}%)`, 'ok');
    await sleep(300); setAgent('ledger', 'IDLE');
    p.stage = '';

    const risky = p.qa.trademark_risk === 'high' || p.qa.verdict === 'fail';
    const passes = p.qa.verdict === 'pass' && p.qa.trademark_risk === 'low' && p.qa.score >= D.settings.qaMin;
    const canSell = keys.printify && !pfReady();
    p.lastStep = 'the Printify upload';
    if (mode === 'design' || !canSell) {
      p.status = risky ? 'review' : 'ready';
      if (risky) p.reviewReason = 'Auditor flagged it: ' + (p.qa.issues[0] || 'trademark risk');
      if (mode !== 'design' && !canSell) log('courier', 'Printify not set up — kept as design only.', 'err');
    } else if (risky) {
      p.status = 'review'; p.reviewReason = 'Auditor flagged it: ' + (p.qa.issues[0] || 'trademark risk');
      log('auditor', `HOLD "${tr.phrase}" — ${p.reviewReason}`, 'err');
    } else {
      Station.packet('ledger', 'courier', '#b6ff5a');
      await push(p);
      if (p.pushError) { const m = p.pushError; delete p.pushError; throw new Error('Printify said: ' + m); }
      if (p.status === 'uploaded') {
        if (mode === 'auto' && passes) await publish(p);
        else {
          p.status = 'review';
          p.reviewReason = mode === 'auto' ? `QA ${p.qa.score} is under your auto-publish bar of ${D.settings.qaMin}` : 'Waiting for your approval';
        }
      }
    }
    delete p.lastStep; if (p.status !== 'failed') delete p.error;
    renderAll(); persist();
  }

  async function audit(p) {
    cur.auditor = p.id; setAgent('auditor', 'WORKING', `Checking "${p.trend.phrase}"`);
    p.stage = 'qa'; renderPipeline();
    let Q;
    const auditPrompt = `You are AUDITOR, the QA agent for an Etsy print-on-demand shop. Check this product before it goes live.
Phrase: "${p.trend.phrase}"
Text actually in the artwork: "${svgText(p.svg) || '(none found)'}"
Title (${p.listing.title.length} chars): ${p.listing.title}
Tags: ${p.listing.tags.map((t) => `${t} (${t.length})`).join(', ')}
Check: trademarked words or phrases (brands, franchises, theme parks, celebrities, teams, song lyrics, trademarked slogans), spelling in the artwork versus the phrase, Etsy title rules, 13 tags each ≤20 chars, anything against Etsy policy. Also judge how sellable and appealing the concept is.
Reply with JSON only, issues kept under 12 words each, at most 5 issues: {"score": 0-100 overall quality, sellability and safety, "trademark_risk": "low"|"medium"|"high", "issues": ["short issue", ...], "verdict": "pass"|"fix"|"fail"}`;
    try { Q = await askJSON(auditPrompt, { fast: true, maxTokens: 2000, agent: 'auditor', task: `Checking "${p.trend.phrase}"` }); }
    catch (e) {
      if (fatal(e)) throw e;
      log('auditor', 'Fast check failed (' + e.message + ') — rechecking with the main model.', 'err');
      try { Q = await askJSON(auditPrompt, { maxTokens: 2000, agent: 'auditor', task: `Rechecking "${p.trend.phrase}"`, model: modelFor('auditor') === D.settings.model ? 'claude-sonnet-5-5' : D.settings.model }); }
      catch (e2) { if (fatal(e2)) throw e2; Q = { score: 0, trademark_risk: 'medium', issues: ['The auditor couldn’t check this one: ' + e2.message], verdict: 'fix' }; }
    }
    p.qa = { score: Math.max(0, Math.min(100, Number(Q.score) || 0)), trademark_risk: ['low', 'medium', 'high'].includes(Q.trademark_risk) ? Q.trademark_risk : 'medium', issues: (Q.issues || []).map(String), verdict: ['pass', 'fix', 'fail'].includes(Q.verdict) ? Q.verdict : 'fix' };
    log('auditor', `"${p.trend.phrase}" scored ${p.qa.score} · trademark ${p.qa.trademark_risk} · ${p.qa.verdict.toUpperCase()}${p.qa.issues.length ? ' · ' + p.qa.issues.join('; ') : ''}`, p.qa.verdict === 'fail' ? 'err' : 'ok');
    setAgent('auditor', 'IDLE'); renderPipeline(); persist();
  }

  function price(p) {
    const cost = p.printify?.cost ?? D.settings.defaultCost;
    let pr = p.listing.price;
    const floor = minPrice(cost);
    if (pr < floor) { log('ledger', `Raised ${money(pr)} → ${money(floor)} to keep a ${D.settings.minMargin}% margin`); pr = floor; }
    p.listing.price = Math.round(pr * 100) / 100;
    p.ledger = ledger(p.listing.price, cost);
  }

  // ---------- Printify ----------
  const pf = (url, method, body) => kivo.printify({ url, method, body }).catch((e) => { throw new Error(cleanErr(e)); });
  function pfReady() {
    if (!keys.printify) return 'Connect Printify in Settings.';
    if (!D.settings.shopId) return 'Pick your Printify shop in Settings.';
    if (!D.settings.blueprintId || !D.settings.providerId || !D.settings.variants.length) return 'Pick a product in Settings (or click Auto-pick).';
    return '';
  }
  function chosenVariants() {
    const cols = D.settings.colours.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
    return D.settings.variants.filter((x) => !cols.length || cols.some((c) => x.title.toLowerCase().split('/')[0].includes(c))).slice(0, 100);
  }
  async function push(p) {
    const why = pfReady(); if (why) { log('courier', why, 'err'); return; }
    if (p.printify.productId) return;
    cur.courier = p.id; courierRun = { pid: p.id, steps: [['Render 4500×5400 print file', 'active'], ['Upload artwork to Printify', ''], ['Create product + variants', ''], ['Read real cost + mockups', '']] };
    setAgent('courier', 'WORKING', 'Uploading artwork');
    try {
      const vars = chosenVariants();
      if (!vars.length) throw new Error('None of your shirt colours exist for this product — change the colours in Settings');
      const b64 = await svgToPNG(p.svg);
      cstep(0, 'done'); cstep(1, 'active');
      const slug = p.trend.phrase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'design';
      const up = await pf('/v1/uploads/images.json', 'POST', { file_name: `${slug}.png`, contents: b64 });
      cstep(1, 'done'); cstep(2, 'active');
      setAgent('courier', 'WORKING', 'Creating product');
      const cents = Math.round(p.listing.price * 100);
      const prod = await pf(`/v1/shops/${D.settings.shopId}/products.json`, 'POST', {
        title: p.listing.title, description: p.listing.description, tags: p.listing.tags,
        blueprint_id: Number(D.settings.blueprintId), print_provider_id: Number(D.settings.providerId),
        variants: vars.map((v) => ({ id: v.id, price: cents, is_enabled: true })),
        print_areas: [{ variant_ids: vars.map((v) => v.id), placeholders: [{ position: 'front', images: [{ id: up.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }] }],
      });
      cstep(2, 'done'); cstep(3, 'active');
      p.printify = { ...p.printify, imageId: up.id, productId: prod.id, variantIds: vars.map((v) => v.id), mockups: (prod.images || []).map((i) => i.src).filter(Boolean).slice(0, 4) };
      const costs = (prod.variants || []).filter((v) => v.is_enabled && v.cost).map((v) => v.cost);
      if (costs.length) {
        p.printify.cost = Math.max(...costs) / 100;
        const floor = minPrice(p.printify.cost);
        if (p.listing.price < floor) {
          p.listing.price = floor;
          await pf(`/v1/shops/${D.settings.shopId}/products/${prod.id}.json`, 'PUT', { variants: vars.map((v) => ({ id: v.id, price: Math.round(floor * 100) })) });
          log('ledger', `Real cost ${money(p.printify.cost)} — raised price to ${money(floor)} to keep your margin`);
        }
        p.ledger = ledger(p.listing.price, p.printify.cost);
      }
      p.status = 'uploaded'; cstep(3, 'done');
      log('courier', `"${p.trend.phrase}" is on Printify with ${vars.length} variants · real cost ${money(p.printify.cost)} · profit ${money(p.ledger.profit)}`, 'ok');
      setAgent('courier', 'IDLE');
    } catch (e) {
      if (courierRun) { const i = courierRun.steps.findIndex((x) => x[1] === 'active'); if (i >= 0) cstep(i, 'fail'); }
      log('courier', 'Printify upload failed: ' + e.message, 'err');
      p.reviewReason = 'Printify upload failed: ' + e.message; p.status = 'review'; p.pushError = e.message;
      setAgent('courier', 'IDLE', '', true);
    }
    renderPipeline(); renderReadouts(); persist();
  }
  async function publish(p) {
    const why = pfReady(); if (why) { toast(why, true); return; }
    if (!p.printify.productId) await push(p);
    if (!p.printify.productId) return;
    cur.courier = p.id;
    if (!courierRun || courierRun.pid !== p.id) courierRun = { pid: p.id, steps: [] };
    courierRun.steps.push(['Publish to Etsy', 'active']); feedTouch('courier');
    setAgent('courier', 'WORKING', 'Publishing to Etsy');
    try {
      await pf(`/v1/shops/${D.settings.shopId}/products/${p.printify.productId}/publish.json`, 'POST', { title: true, description: true, images: true, variants: true, tags: true, keyFeatures: true, shipping_template: true });
      p.status = 'published'; p.printify.publishedAt = Date.now(); delete p.reviewReason; cstep(courierRun.steps.length - 1, 'done');
      Station.launchShuttle();
      log('courier', `"${p.listing.title.slice(0, 60)}" sent to Etsy. It shows up in your shop within a few minutes.`, 'ok');
      setAgent('courier', 'IDLE');
    } catch (e) { cstep(courierRun.steps.length - 1, 'fail'); log('courier', 'Publish failed: ' + e.message, 'err'); toast(e.message, true); setAgent('courier', 'IDLE', '', true); }
    renderAll(); persist();
  }
  async function pushEdits(p) {
    if (!p.printify.productId || pfReady()) return;
    setAgent('courier', 'WORKING', 'Updating listing');
    try {
      await pf(`/v1/shops/${D.settings.shopId}/products/${p.printify.productId}.json`, 'PUT', {
        title: p.listing.title, description: p.listing.description, tags: p.listing.tags,
        variants: (p.printify.variantIds || []).map((id) => ({ id, price: Math.round(p.listing.price * 100) })),
      });
      if (p.status === 'published') await pf(`/v1/shops/${D.settings.shopId}/products/${p.printify.productId}/publish.json`, 'POST', { title: true, description: true, images: false, variants: true, tags: true, keyFeatures: false, shipping_template: false });
      log('courier', `Updated "${p.listing.title.slice(0, 50)}"${p.status === 'published' ? ' on Etsy' : ' on Printify'}`, 'ok');
    } catch (e) { log('courier', 'Update failed: ' + e.message, 'err'); toast(e.message, true); }
    setAgent('courier', 'IDLE');
  }

  // ---------- sync: orders, approvals, links, mockups, retire ----------
  async function syncAll(quiet) {
    if (syncing || !keys.printify || !D.settings.shopId) { if (!quiet) { toast('Connect Printify in Settings first.', true); } return; }
    syncing = true;
    setAgent('analyst', 'WORKING', 'Syncing orders');
    try {
      const all = [];
      for (let page = 1; page <= 20; page++) {
        const r = await pf(`/v1/shops/${D.settings.shopId}/orders.json?limit=50&page=${page}`);
        for (const o of r.data || []) {
          const items = (o.line_items || []).map((li) => ({ productId: li.product_id, title: li.metadata?.title || 'Item', variant: li.metadata?.variant_label || '', qty: li.quantity || 1, price: (li.metadata?.price || 0) / 100, cost: (li.cost || 0) / 100, ship: (li.shipping_cost || 0) / 100, status: li.status }));
          const a = o.address_to || {};
          all.push({
            id: o.id, created: o.created_at, status: o.status, label: o.metadata?.shop_order_label || o.label || o.id,
            customer: [a.first_name, a.last_name].filter(Boolean).join(' '), country: a.country || '',
            items, sales: items.reduce((s, i) => s + i.price * i.qty, 0), itemCost: items.reduce((s, i) => s + i.cost, 0), shipCost: items.reduce((s, i) => s + i.ship, 0),
            shipments: (o.shipments || []).map((s) => ({ carrier: s.carrier, number: s.number, url: s.url, delivered: s.delivered_at })),
          });
        }
        if (!r.last_page || page >= r.last_page) break;
      }
      const known = new Set(D.orders.map((o) => o.id));
      const fresh = D.lastSync ? all.filter((o) => !known.has(o.id)) : [];
      D.orders = all; D.lastSync = Date.now();
      // per-product sales
      for (const p of D.products) p.sales = { qty: 0, revenue: 0 };
      const byPid = Object.fromEntries(D.products.filter((p) => p.printify?.productId).map((p) => [p.printify.productId, p]));
      for (const o of all) for (const i of o.items) { const p = byPid[i.productId]; if (p) { p.sales.qty += i.qty; p.sales.revenue += i.price * i.qty; } }
      log('analyst', `Synced ${all.length} orders · sales ${money(all.reduce((s, o) => s + o.sales, 0))}` + (fresh.length ? ` · ${fresh.length} new` : ''), 'ok');
      if (fresh.length) notify(`${fresh.length} new order${fresh.length > 1 ? 's' : ''}`, fresh.map((o) => o.items.map((i) => i.title).join(', ')).join(' · ').slice(0, 180));

      if (D.settings.autoApprove) {
        for (const o of all.filter((x) => x.status === 'on-hold')) await sendToPrint(o, true);
      }
      // Etsy links + mockups for live products
      for (const p of D.products.filter((x) => x.printify?.productId && (!x.printify.url && x.status === 'published' || !x.printify.mockups?.length)).slice(0, 10)) {
        try {
          const prod = await pf(`/v1/shops/${D.settings.shopId}/products/${p.printify.productId}.json`);
          if (prod.external?.handle) p.printify.url = prod.external.handle;
          if (prod.images?.length) p.printify.mockups = prod.images.map((i) => i.src).filter(Boolean).slice(0, 4);
        } catch {}
      }
      if (D.settings.retireDays > 0 && Date.now() - D.lastRetire > DAY) { D.lastRetire = Date.now(); await retireDead(); }
    } catch (e) { log('analyst', 'Sync failed: ' + e.message, 'err'); if (!quiet) toast(e.message, true); }
    syncing = false;
    setAgent('analyst', 'IDLE'); renderAll(); persist();
  }
  async function sendToPrint(o, auto) {
    try {
      await pf(`/v1/shops/${D.settings.shopId}/orders/${o.id}/send_to_production.json`, 'POST');
      o.status = 'sending-to-production';
      log('courier', `Order ${o.label} sent to print${auto ? ' automatically' : ''}.`, 'ok');
    } catch (e) { log('courier', `Couldn't send order ${o.label} to print: ${e.message}`, 'err'); if (!auto) toast(e.message, true); }
    renderOrders(); persist();
  }
  async function retireDead() {
    const cutoff = Date.now() - D.settings.retireDays * DAY;
    const dead = D.products.filter((p) => p.status === 'published' && (p.printify.publishedAt || Date.now()) < cutoff && !(p.sales?.qty > 0));
    for (const p of dead) {
      try {
        await pf(`/v1/shops/${D.settings.shopId}/products/${p.printify.productId}.json`, 'DELETE');
        p.status = 'retired'; p.retiredAt = Date.now();
        log('courier', `Retired "${p.listing.title.slice(0, 50)}" — no sales in ${D.settings.retireDays} days.`);
      } catch (e) {
        if (/Printify 404/.test(e.message)) { p.status = 'retired'; p.retiredAt = Date.now(); log('courier', `"${p.trend.phrase}" was already removed from Printify — marked retired.`); }
        else log('courier', `Couldn't retire "${p.trend.phrase}": ${e.message}`, 'err');
      }
    }
    if (dead.length) notify('Shop tidied', `${dead.length} listing${dead.length > 1 ? 's' : ''} with no sales retired.`);
  }

  // ---------- auto-pick product ----------
  async function autoPickProduct(msgEl) {
    const say = (t) => { if (msgEl) msgEl.textContent = t; };
    say('Finding the best blank tee…');
    const cat = await pf('/v1/catalog/blueprints.json');
    let bp = null;
    for (const pref of PREFERRED_BLANKS) { bp = cat.find((b) => (b.brand || '').toLowerCase().includes(pref.brand.toLowerCase()) && String(b.model || '').trim() === pref.model); if (bp) break; }
    if (!bp) bp = cat.find((b) => /t-?shirt|tee/i.test(b.title));
    if (!bp) throw new Error('No t-shirt found in the Printify catalog');
    say(`Checking print providers for ${bp.brand} ${bp.model}…`);
    const pps = await pf(`/v1/catalog/blueprints/${bp.id}/print_providers.json`);
    const cols = D.settings.colours.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
    let best = null;
    for (const pp of pps.slice(0, 6)) {
      try {
        const r = await pf(`/v1/catalog/blueprints/${bp.id}/print_providers/${pp.id}/variants.json`);
        const vars = (r.variants || []).map((v) => ({ id: v.id, title: v.title }));
        const match = vars.filter((x) => cols.some((c) => x.title.toLowerCase().split('/')[0].includes(c))).length;
        const local = /united kingdom|uk|gb/i.test(JSON.stringify(pp.location || pp.title)) && D.settings.currency === 'GBP';
        const score = match * 10 + (local ? 5 : 0) + Math.min(vars.length, 50) / 100;
        if (!best || score > best.score) best = { pp, vars, match, score };
      } catch {}
    }
    if (!best || !best.vars.length) throw new Error('No print provider found for this tee');
    Object.assign(D.settings, { blueprintId: String(bp.id), blueprintTitle: `${bp.brand} ${bp.model} ${bp.title}`.trim(), providerId: String(best.pp.id), providerTitle: best.pp.title, variants: best.vars });
    persist();
    say(`${bp.brand} ${bp.model} via ${best.pp.title} · ${best.match} variants in your colours`);
    log('courier', `Product set: ${D.settings.blueprintTitle} via ${best.pp.title} (${best.match} variants in your colours).`, 'ok');
    return best;
  }

  // ---------- ULTRON chat ----------
  function stateSummary() {
    const s = D.settings, by = {};
    const now = running ? `A mission IS running right now (${$('#mission-chip').textContent}).` : 'No mission is running right now.';
    for (const p of D.products) by[p.status] = (by[p.status] || 0) + 1;
    const sales = D.orders.reduce((a, o) => a + o.sales, 0);
    const top = D.products.filter((p) => p.sales?.qty).sort((a, b) => b.sales.qty - a.sales.qty).slice(0, 5).map((p) => `${p.trend.phrase} (${p.sales.qty})`).join(', ');
    return `${window.MK ? MK.summary() + '\n' : ''}${now} Queued missions: ${missionQueue.length ? missionQueue.map((j) => j.n + ' designs').join(', ') : 'none'}.
Template: ${tpl().name}. Mode: ${MODES[s.mode]}. Autopilot: ${s.auto ? `on, every ${s.hours}h, ${s.acount} per run, max ${s.maxPerDay}/day` : 'off'}. QA bar ${s.qaMin}. Printify: ${keys.printify ? (s.shopId ? 'connected to ' + s.shopTitle : 'token set, no shop') : 'not connected'}. Product: ${s.blueprintTitle || 'none'} in ${s.colours}. Agent models: ${AI_AGENTS.map((a) => `${a} ${modelName(modelFor(a))}`).join(', ')}. AI spend today ${usd(D.day.usd || 0)} (${AI_AGENTS.map((a) => `${a} ${usd(costOf(a))}`).join(', ')}); all time ${usd(Object.values(D.cost?.all || {}).reduce((s, x) => s + x.usd, 0))}.
Products by status: ${JSON.stringify(by)}. Designs today: ${D.day.designs}. Orders: ${D.orders.length}, sales ${money(sales)}, profit ${money(D.orders.reduce((a, o) => a + orderProfit(o), 0))}. Best sellers: ${top || 'none yet'}.
${salesInsight()}
Recent designs: ${D.products.slice(-10).map((p) => `${p.trend?.phrase} [${p.status}${p.qa ? ', QA ' + p.qa.score : ''}]`).join('; ')}`;
  }
  async function chatSend() {
    const box = $('#chat-input'); const msg = box.value.trim(); if (!msg) return;
    if (!keys.anthropic) { toast('Add your Anthropic API key first.', true); return; }
    box.value = ''; D.chat.push({ role: 'user', text: msg, ts: Date.now() }); renderChat();
    setAgent('ultron', 'WORKING', 'Thinking');
    $('#chat-send').disabled = true;
    try {
      const hist = D.chat.slice(-12).map((m) => `${m.role === 'user' ? 'OWNER' : 'ULTRON'}: ${m.text}`).join('\n');
      const r = await askJSON(`You are ULTRON, the commander AI inside Kivo Ultron, a suite of AI departments ("spaces"): STORE runs an Etsy print-on-demand shop, MARKETING runs its social media, and the owner can build their own spaces with their own bots and hire extra bots into any space. The store crew (Scout finds trends, Forge designs, Scribe writes listings, Auditor checks trademarks, Ledger prices, Courier uploads to Printify and publishes to Etsy, Analyst reads orders). Talk to the shop owner: be direct, practical, upbeat, British English, no waffle. You can take actions.
${shopContext()}
Current state:
${stateSummary()}
${window.SP?.summary() || ''}
Conversation:
${hist}
Available actions (use only when the owner asks for them or clearly wants them):
- {"type":"mission","brief":"...","count":1-25,"tone":"light"|"dark"} start designing now (if a mission is already running it is queued and starts automatically afterwards)
- {"type":"campaign","brief":"...","count":1-20} start a MARKETING run: the marketing crew makes social posts (Instagram, TikTok, Pinterest) promoting the shop's designs
- {"type":"autopilot","on":true|false}
- {"type":"set","field":"mode"|"hours"|"acount"|"maxPerDay"|"qaMin"|"defaultBrief"|"colours","value":...}  mode is "auto","review" or "design"
- {"type":"sync"} pull orders and sales now
- {"type":"model","agent":"ultron"|"scout"|"forge"|"scribe"|"auditor"|"all","model":"opus"|"sonnet"|"haiku"} switch the Claude model an agent uses (Opus = best quality but roughly 2x Sonnet's cost; Haiku is about 20x cheaper than Sonnet; Haiku = fastest and cheapest, fine for checks)
- {"type":"show","status":"review"|"published"|"ready"|"failed"|"all"} show those products in the terminal
- {"type":"hire","space":"store"|"marketing"|"<custom space name>"|"current","count":1-6,"brief":"what the new bots should do"} hire new bots into a space (the app designs them from the brief; or give "agents":[{"name","job","team"}])
- {"type":"newspace","name":"...","mission":"what the space is for","template":"sales"|"youtube"|"research"|"finance"|"trading"|"support"|"dev"|"life"|"product"|"blank","count":2-8} build a new space (department) with its own team of bots; leave out template to have the team designed from the mission
- {"type":"runspace","space":"<custom space name>","brief":"..."} give a custom space a job and start it
IMPORTANT: actions only happen if you put them in "actions". Never say you started, queued or changed something unless the matching action is in your list — the app confirms each action to the owner itself. If the owner asks for designs, always include a mission action.
Reply with JSON only: {"reply": "what you say to the owner", "actions": [ ... ]}`, { maxTokens: 1500, agent: 'ultron', task: 'Answering you' });
      D.chat.push({ role: 'ultron', text: String(r.reply || 'Done.'), ts: Date.now() });
      renderChat();
      const acts = Array.isArray(r.actions) ? r.actions : r.actions ? [r.actions] : r.action ? [r.action] : [];
      let started = false;
      const kinds = new Set();
      for (const a of acts) { const r2 = await doAction(a); if (r2) kinds.add(r2); if (r2 === 'mission' || r2 === 'campaign') started = true; }
      if (!kinds.has('hire') && /^\s*(?:(?:can|could|will) you |please |ultron,? )?(?:hire|recruit|add)\b[^?]*\b(bots?|agents?|people|someone|helpers?|staff|\w+ers?)\b/i.test(msg)) { await doAction({ type: 'hire', brief: msg, count: Number((msg.match(/\b(\d{1,2})\b/) || [])[1]) || 1 }); started = true; }
      else if (!kinds.has('newspace') && !kinds.has('hire') && /\b(build|set ?up|create|make|start)\b[^.?!]*\b(space|department|team)\b/i.test(msg) && !/\b(designs?|shirts?|posts?)\b/i.test(msg)) { await doAction({ type: 'newspace', mission: msg, name: (msg.match(/\b(?:a|an|my)\s+([\w ]{3,24}?)\s+(?:space|department|team)\b/i) || [])[1] }); started = true; }
      // safety net: the owner clearly asked for designs but no mission came back
      const want = msg.match(/\b(make|create|design|do|run|generate|give me|knock out|start)\b[^.?!]*?\b(\d{1,2})\b[^.?!]*?\b(designs?|shirts?|tees?|t-?shirts?|products?|listings?)\b/i);
      const wantMk = /\b(posts?|reels?|tiktoks?|pins?|campaign|marketing|social)\b/i.test(msg) && msg.match(/\b(\d{1,2})\b/);
      if (!started && wantMk && /\b(make|create|do|run|generate|give me|start)\b/i.test(msg)) await doAction({ type: 'campaign', count: Number(wantMk[1]), brief: msg });
      else if (!started && want) await doAction({ type: 'mission', count: Number(want[2]), brief: msg });
    } catch (e) { D.chat.push({ role: 'ultron', text: 'Comms error: ' + e.message, ts: Date.now(), err: true }); renderChat(); }
    $('#chat-send').disabled = false;
    setAgent('ultron', running ? 'WORKING' : 'IDLE');
    persist();
  }
  const missionQueue = [];
  function normAction(a) {
    if (!a || typeof a !== 'object') return {};
    const p = { ...a, ...(a.params || a.args || a.parameters || a.data || {}) };
    let t = String(a.type || a.action || a.command || a.tool || a.name || '').toLowerCase().replace(/[^a-z]/g, '');
    if (/hire|recruit|addagent|addbot|newbot|newagent/.test(t)) t = 'hire';
    else if (/runspace|startspace|spacerun|runteam/.test(t)) t = 'runspace';
    else if (/space|department|team/.test(t)) t = 'newspace';
    else if (/campaign|marketing|social|post|content|reel|tiktok|instagram|pinterest/.test(t)) t = 'campaign';
    else if (/mission|design|create|make|generate|produce/.test(t)) t = 'mission';
    else if (/autopilot/.test(t)) t = 'autopilot';
    else if (/model/.test(t)) t = 'model';
    else if (/sync|order/.test(t)) t = 'sync';
    else if (/show|filter|view/.test(t)) t = 'show';
    else if (/set|setting|update|change/.test(t)) t = 'set';
    p.type = t;
    p.count = p.count ?? p.designs ?? p.n ?? p.number ?? p.quantity ?? p.amount;
    p.brief = p.brief ?? p.prompt ?? p.theme ?? p.topic ?? p.description;
    if (t === 'autopilot' && p.on === undefined) p.on = p.enabled ?? p.value ?? !/pause|off|stop/.test(String(a.type || a.action));
    return p;
  }
  async function doAction(raw) {
    const s = D.settings, a = normAction(raw);
    const note = (t) => { D.chat.push({ role: 'sys', text: t, ts: Date.now() }); renderChat(); };
    if (a.type === 'mission') {
      const n = Math.max(1, Math.min(25, Number(a.count) || s.acount));
      const job = { brief: String(a.brief || s.defaultBrief || tpl().brief), n, opts: { tone: a.tone === 'dark' ? 'dark' : a.tone === 'light' ? 'light' : undefined } };
      if (running) { missionQueue.push(job); note(`▶ Queued: ${n} designs — starts as soon as the current job finishes (${missionQueue.length} in queue)`); return 'mission'; }
      note(`▶ Mission started: ${n} designs`);
      runMission(job.brief, job.n, job.opts);
      return 'mission';
    } else if (a.type === 'autopilot') { setAuto(!!a.on); note(`▶ Autopilot ${a.on ? 'on' : 'paused'}`); }
    else if (a.type === 'set') {
      const f = a.field, v = a.value;
      if (f === 'mode' && MODES[v]) s.mode = v;
      else if (['hours', 'acount', 'maxPerDay', 'qaMin'].includes(f) && Number(v) >= 0) s[f] = Number(v);
      else if (['defaultBrief', 'colours'].includes(f) && typeof v === 'string') s[f] = v;
      else return;
      note(`▶ ${f} set to ${f === 'mode' ? MODES[v] : v}`); persist(); renderAll();
    } else if (a.type === 'sync') { note('▶ Syncing orders'); await syncAll(false); }
    else if (a.type === 'model') {
      const m = resolveModel(a.model); if (!m) return note('▶ Unknown model: ' + a.model);
      const who = a.agent === 'all' ? AI_AGENTS : AI_AGENTS.includes(a.agent) ? [a.agent] : [];
      for (const ag of who) setAgentModel(ag, m, true);
      if (who.length) note(`▶ ${a.agent === 'all' ? 'All agents' : a.agent.toUpperCase()} now on ${modelName(m)}`);
    }
    else if (['hire', 'newspace', 'runspace'].includes(a.type)) {
      try { return await SP.chatAction(a, note); } catch (e) { note('⚠ ' + cleanErr(e)); return; }
    }
    else if (a.type === 'campaign') {
      if (!window.MK) return;
      if (MK.running) return note('A marketing run is already going.');
      const n = Math.max(1, Math.min(20, Number(a.count) || MK.M().settings.perRun));
      note(`▶ Marketing run started: ${n} posts`); setDept('marketing');
      MK.runCampaign(String(a.brief || MK.M().settings.brief), n);
      return 'campaign';
    }
    else if (!a.type) { note('⚠ ULTRON sent an action the app didn’t understand: ' + JSON.stringify(raw).slice(0, 120)); }
    else if (a.type === 'show') { $('#filter').value = ['review', 'published', 'ready', 'failed'].includes(a.status) ? a.status : 'all'; showTab('pipeline'); renderPipeline(); }
  }
  function renderChat() {
    const box = $('#chat'); box.textContent = '';
    if (!D.chat.length) {
      const e = el('div', 'chat-empty');
      e.append(el('div', '', 'Tell ULTRON what you want in plain English.'));
      for (const q of ['Make 5 Halloween designs for dog mums', 'What’s selling best and why?', 'Switch to full auto and run every 4 hours', 'Show me what needs my review']) {
        const b = el('button', 'chip', q); b.onclick = () => { $('#chat-input').value = q; chatSend(); }; e.append(b);
      }
      box.append(e); return;
    }
    for (const m of D.chat.slice(-60)) {
      const d = el('div', 'msg ' + m.role + (m.err ? ' err' : ''));
      if (m.role !== 'sys') d.append(el('span', 'who', m.role === 'user' ? 'YOU' : 'ULTRON'));
      d.append(el('div', 'txt', m.text));
      box.append(d);
    }
    box.scrollTop = box.scrollHeight;
  }

  // ---------- customer replies ----------
  async function draftReply() {
    const msg = $('#cust-msg').value.trim(); if (!msg) { toast('Paste the customer’s message first.', true); return; }
    if (!keys.anthropic) { toast('Add your Anthropic API key first.', true); return; }
    $('#cust-draft').disabled = true; $('#cust-reply').value = 'Drafting…';
    const words = msg.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
    const match = D.orders.filter((o) => words.some((w) => (o.customer || '').toLowerCase().split(' ').includes(w)) || words.includes(String(o.label).toLowerCase())).slice(0, 3);
    const ctx = match.map((o) => `Order ${o.label} by ${o.customer} (${o.country}) on ${(o.created || '').slice(0, 10)}: ${o.items.map((i) => `${i.qty}× ${i.title} ${i.variant}`).join(', ')}. Status: ${o.status}. Tracking: ${o.shipments.map((s) => `${s.carrier} ${s.number} ${s.url || ''}`).join(', ') || 'not shipped yet'}.`).join('\n');
    try {
      const t = await ask(`You are the customer service assistant for ${D.settings.shopName || 'an Etsy shop'} that sells print-on-demand shirts made to order by a print partner (usually 2-5 working days to make, then shipping). Brand voice: ${D.settings.voice || tpl().voice}.
Write a reply to this customer message. Warm, short, specific and helpful. Use any matching order details below (tracking links etc.). If there's a problem, apologise once and offer a clear fix (replacement or refund for damaged or wrong items). Never invent tracking numbers or dates. Sign off with the shop name. Reply with only the message text.
Customer message:
${msg}
Matching orders:
${ctx || 'none found'}`, { maxTokens: 900, agent: 'scribe', task: 'Drafting a customer reply' });
      $('#cust-reply').value = t.trim();
    } catch (e) { $('#cust-reply').value = ''; toast(e.message, true); }
    $('#cust-draft').disabled = false;
  }

  // ---------- rendering ----------
  const STATUS = { ready: ['READY', 'ready'], review: ['NEEDS REVIEW', 'medium'], uploaded: ['ON PRINTIFY', 'uploaded'], published: ['LIVE', 'published'], failed: ['FAILED', 'failed'], retired: ['RETIRED', ''] };
  function statusLabel(p) { if (p.status === 'working') return { t: (p.stage || 'working').toUpperCase(), c: 'working' }; const s = STATUS[p.status] || [p.status.toUpperCase(), '']; return { t: s[0], c: s[1] }; }
  function renderPipeline() {
    const box = $('#tab-pipeline'); box.textContent = '';
    const f = $('#filter').value;
    const list = D.products.filter((p) => f === 'all' || p.status === f).slice().reverse();
    if (!list.length) {
      const e = el('div', 'empty');
      if (!keys.anthropic) { e.innerHTML = 'Station offline.<br>Run <b>SETUP</b> to bring the crew online.'; e.append(el('br')); e.append(btn('RUN SETUP', () => openWizard(1), 'go')); }
      else if (f !== 'all') e.textContent = 'Nothing here right now.';
      else { e.innerHTML = 'No designs yet.<br>Hit <b>RUN MISSION</b> or tell ULTRON what to make.'; }
      box.append(e); return;
    }
    for (const p of list) {
      const c = el('div', 'card' + (p.status === 'review' ? ' attn' : '')); c.tabIndex = 0;
      const th = el('div', 'thumb' + (p.tone === 'dark' ? ' dark' : ''));
      if (p.printify?.mockups?.[0]) { const i = new Image(); i.src = p.printify.mockups[0]; i.className = 'mock'; i.alt = ''; i.onerror = () => { i.remove(); }; th.append(i); }
      if (p.svg) { const i = new Image(); i.src = svgURL(p.svg); i.alt = p.trend?.phrase || ''; th.append(i); }
      else th.append(el('div', 'wip', p.status === 'failed' ? 'NO ART' : 'FORGING…'));
      const m = el('div', 'meta');
      const s = statusLabel(p);
      const pr = el('div', 'pill-row'); pr.append(el('span', 'pill ' + s.c, s.t));
      if (p.qa) pr.append(el('span', 'pill ' + (p.qa.verdict === 'pass' ? 'pass' : p.qa.verdict === 'fail' ? 'fail' : 'medium'), 'QA ' + p.qa.score));
      if (p.sales?.qty) pr.append(el('span', 'pill pass', p.sales.qty + ' SOLD'));
      m.append(pr, el('div', 'ph', p.listing?.title || p.trend?.phrase || '…'));
      if (p.status === 'failed' && p.error) m.append(el('div', 'err-line', p.error));
      const n = el('div', 'nums'); n.append(el('span', '', p.listing ? money(p.listing.price) : '—'), el('span', 'p', p.ledger ? '+' + money(p.ledger.profit) : ''));
      m.append(n);
      if (p.status === 'review' && p.printify?.productId) { const a = btn('APPROVE', (e) => { e.stopPropagation(); publish(p); }, 'go mini'); m.append(a); }
      c.append(th, m);
      c.onclick = () => openDrawer(p.id);
      c.onkeydown = (e) => { if (e.key === 'Enter') openDrawer(p.id); };
      box.append(c);
    }
  }
  function renderOrders() {
    const box = $('#tab-orders'); box.textContent = '';
    if (!D.orders.length) {
      const e = el('div', 'empty'); e.innerHTML = keys.printify ? 'No orders yet.<br>They appear here automatically when someone buys.' : 'Connect Printify to see orders here.';
      box.append(e); return;
    }
    const t = el('table'); t.innerHTML = '<thead><tr><th>DATE</th><th>ORDER</th><th>CUSTOMER</th><th>ITEMS</th><th>STATUS</th><th style="text-align:right">SALE</th><th style="text-align:right">PROFIT</th></tr></thead>';
    const tb = el('tbody');
    for (const o of D.orders) {
      const tr = el('tr', 'click');
      const st = el('td'); st.append(el('span', 'pill ' + (o.status === 'on-hold' ? 'medium' : /fulfilled|production/.test(o.status) ? 'pass' : /cancel|issue|payment/.test(o.status) ? 'fail' : ''), o.status.toUpperCase()));
      tr.append(el('td', '', (o.created || '').slice(0, 10)), el('td', '', String(o.label).slice(0, 18)), el('td', '', o.customer || '—'), el('td', '', o.items.map((i) => `${i.qty}× ${i.title}`).join(', ')), st, el('td', 'n', money(o.sales)), el('td', 'n', money(orderProfit(o))));
      tr.onclick = () => openOrder(o.id);
      tb.append(tr);
    }
    t.append(tb); box.append(t);
  }
  function renderStats() {
    const box = $('#tab-stats'); box.textContent = '';
    const sales = D.orders.reduce((s, o) => s + o.sales, 0), profit = D.orders.reduce((s, o) => s + orderProfit(o), 0);
    const units = D.orders.reduce((s, o) => s + o.items.reduce((a, i) => a + i.qty, 0), 0);
    const live = D.products.filter((p) => p.status === 'published').length;
    const tiles = el('div', 'tiles');
    for (const [k, v] of [['SALES', money(sales)], ['PROFIT', money(profit)], ['ORDERS', D.orders.length], ['SHIRTS SOLD', units], ['LIVE LISTINGS', live], ['AVG ORDER', D.orders.length ? money(sales / D.orders.length) : '—'], ['AI COST TODAY', usd(D.day.usd || 0)]]) {
      const t = el('div', 'tile'); t.append(el('label', '', k), el('b', '', String(v))); tiles.append(t);
    }
    const cols = el('div', 'stat-cols');
    const top = el('div', 'stat-col'); top.append(el('div', 'lbl', 'BEST SELLERS'));
    const best = D.products.filter((p) => p.sales?.qty).sort((a, b) => b.sales.revenue - a.sales.revenue).slice(0, 8);
    if (!best.length) top.append(el('div', 'tiny dim', 'Sales by design show up here once orders come in.'));
    for (const p of best) { const r = el('div', 'srow'); r.append(el('span', '', p.trend.phrase), el('span', 'n', `${p.sales.qty} · ${money(p.sales.revenue)}`)); r.onclick = () => openDrawer(p.id); top.append(r); }
    const act = el('div', 'stat-col'); act.append(el('div', 'lbl', 'DESIGNS MADE · LAST 14 DAYS'));
    const bars = el('div', 'bars'); const days = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * DAY).toISOString().slice(0, 10); days.push([d, d === D.day.date ? D.day.designs : (D.history[d]?.designs || 0)]); }
    const mx = Math.max(1, ...days.map((d) => d[1]));
    for (const [d, n] of days) { const b = el('div', 'bar'); const f = el('i'); f.style.height = (n / mx * 100) + '%'; b.title = `${d}: ${n}`; b.append(f, el('span', '', d.slice(8))); bars.append(b); }
    act.append(bars);
    const ag = el('div', 'stat-col'); ag.append(el('div', 'lbl', 'AI COST BY AGENT (USD)'));
    const tb = el('table', 'cost-table'); tb.innerHTML = '<thead><tr><th>AGENT</th><th>MODEL</th><th>TODAY</th><th>ALL TIME</th><th>CALLS</th><th>PER JOB</th></tr></thead>';
    const body = el('tbody');
    let totT = 0, totA = 0;
    for (const a of AI_AGENTS) {
      const t = D.cost?.today?.[a], al = D.cost?.all?.[a]; totT += t?.usd || 0; totA += al?.usd || 0;
      const tr = el('tr'); tr.append(el('td', '', a.toUpperCase()), el('td', '', modelName(modelFor(a))), el('td', 'n', usd(t?.usd || 0)), el('td', 'n', usd(al?.usd || 0)), el('td', 'n', String(al?.calls || 0)), el('td', 'n', usd(al?.calls ? al.usd / al.calls : 0)));
      body.append(tr);
    }
    const designs = D.products.filter((p) => p.aiCost);
    const tr = el('tr', 'tot'); tr.append(el('td', '', 'TOTAL'), el('td', '', ''), el('td', 'n', usd(totT)), el('td', 'n', usd(totA)), el('td', '', ''), el('td', 'n', designs.length ? usd(designs.reduce((s, p) => s + p.aiCost, 0) / designs.length) + '/design' : '—'));
    body.append(tr); tb.append(body); ag.append(tb);
    cols.append(top, act);
    box.append(tiles, cols, ag);
  }
  function renderReadouts() {
    const sales = D.orders.reduce((s, o) => s + o.sales, 0);
    $('#ro-sales').textContent = D.orders.length ? money(sales) : '—';
    $('#ro-profit').textContent = D.orders.length ? money(D.orders.reduce((s, o) => s + orderProfit(o), 0)) : '—';
    $('#ro-orders').textContent = D.orders.length || '—';
    $('#ro-live').textContent = D.products.filter((p) => p.status === 'published').length;
    rollDay(); $('#ro-today').textContent = `${D.day.designs}/${D.settings.maxPerDay}`;
    $('#ro-agents').textContent = keys.anthropic ? `${AGENTS.length} ONLINE` : 'OFFLINE';
  }
  function renderCmd() {
    $('#cmd-template').textContent = (D.settings.shopName || tpl().name);
    $('#cmd-mode').textContent = MODES[D.settings.mode];
    $('#cmd-tokens').textContent = usd(D.day.usd || 0) + (D.settings.spendCap ? ' / $' + D.settings.spendCap : '');
    $('#cmd-state').textContent = running ? 'Mission in progress.' : !keys.anthropic ? 'Offline — run setup.' : D.settings.auto ? 'Autopilot engaged.' : 'Standing by.';
  }
  function uiRunning(on) {
    if (!on) { progress = null; stopping = false; }
    renderControls(); renderCmd(); kivo.trayState({ running: on, autopilot: D.settings.auto });
  }
  function renderControls() {
    const b = $('#btn-run'), st = $('#mc-status');
    b.classList.toggle('stop', running); b.disabled = stopping;
    b.textContent = stopping ? 'STOPPING…' : running ? '■ STOP' : '▶ RUN NOW';
    const n = Math.max(1, Math.min(25, +$('#count').value || 3));
    const who = AGENTS.find((a) => agentState[a.id]?.status === 'WORKING' && a.id !== 'ultron');
    st.textContent = running
      ? (progress ? `Design ${progress.i} of ${progress.n}` : 'Planning') + (who ? ` · ${who.name} ${String(agentState[who.id].text || '').replace(/^\w+ /, (m) => m.toLowerCase())}` : '') + (missionQueue.length ? ` · ${missionQueue.length} queued` : '')
      : `Makes ${n} design${n > 1 ? 's' : ''} now · ${MODES[$('#mode').value] || ''}`.replace(/ · $/, '');
  }

  function nextRun() { return (D.lastAuto || 0) + D.settings.hours * 3600e3; }
  function renderAuto() {
    const on = D.settings.auto;
    $('#led-auto').className = 'led' + (on ? ' on' : '');
    $('#auto-label').textContent = on ? `AUTOPILOT · EVERY ${D.settings.hours}H` : 'AUTOPILOT OFF';
    $('#auto-switch').checked = on;
    const nx = nextRun();
    $('#auto-desc').textContent = on ? `On · ${D.settings.acount} designs every ${D.settings.hours}h · ${D.day.designs >= D.settings.maxPerDay ? 'daily limit reached' : 'next ' + (nx <= Date.now() ? 'any moment' : new Date(nx).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))}` : 'Off · the crew only works when you press Run';
    if (on) {
      rollDay();
      const capped = D.day.designs >= D.settings.maxPerDay;
      $('#next-run').textContent = capped ? `Daily limit of ${D.settings.maxPerDay} reached — back tomorrow.` : nextRun() <= Date.now() ? 'Next run: any moment' : 'Next run ' + new Date(nextRun()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else $('#next-run').textContent = 'The crew only works when you hit Run.';
    kivo.trayState({ running, autopilot: on });
  }

  // ---------- briefing ----------
  function needs() {
    const s = D.settings, out = [];
    const add = (level, text, label, fn) => out.push({ level, text, label, fn });
    if (!keys.anthropic) add('bad', 'The crew is offline — add your Claude API key.', 'SET UP', () => openWizard(1));
    if (!keys.printify) add('warn', 'Printify isn’t connected, so nothing can go on sale yet.', 'CONNECT', () => openWizard(2));
    else if (!s.shopId) add('warn', 'Pick which Printify shop to sell through.', 'PICK SHOP', openSettings);
    else if (s.shopChannel && s.shopChannel !== 'etsy') add('warn', `Your Printify shop is linked to “${s.shopChannel}”, not Etsy.`, 'OPEN PRINTIFY', () => kivo.openUrl('https://printify.com/app/stores'));
    if (keys.printify && s.shopId && pfReady()) add('warn', 'No shirt chosen yet.', 'AUTO-PICK', async () => { try { await autoPickProduct(); renderAll(); } catch (e) { toast(e.message, true); } });
    const rev = D.products.filter((p) => p.status === 'review').length;
    if (rev) add('warn', `${rev} design${rev > 1 ? 's' : ''} waiting for your review.`, 'REVIEW', () => { $('#filter').value = 'review'; showTab('pipeline'); renderPipeline(); });
    const hold = D.orders.filter((o) => o.status === 'on-hold').length;
    if (hold) add('warn', `${hold} order${hold > 1 ? 's' : ''} waiting to be sent to print.`, 'SEND ALL', async () => { for (const o of D.orders.filter((x) => x.status === 'on-hold')) await sendToPrint(o); renderAll(); });
    const fresh = D.orders.filter((o) => new Date(o.created).getTime() > (D.lastSeenOrders || 0));
    if (fresh.length && D.lastSeenOrders) add('good', `${fresh.length} new order${fresh.length > 1 ? 's' : ''} since you last looked · ${money(fresh.reduce((a, o) => a + o.sales, 0))}`, 'VIEW', () => { D.lastSeenOrders = Date.now(); showTab('orders'); persist(); renderNeeds(); });
    const failed = D.products.filter((p) => p.status === 'failed' && Date.now() - p.createdAt < DAY).length;
    const retryable = D.products.filter((p) => p.retryable && ['failed', 'review'].includes(p.status) && p.trend);
    if (retryable.length) add('warn', `${retryable.length} design${retryable.length > 1 ? 's' : ''} didn’t finish. The crew can pick them up where they stopped.`, 'RETRY ALL', retryAll);
    else if (failed) add('warn', `${failed} design${failed > 1 ? 's' : ''} failed today. Check the comms log for why.`, 'LOG', () => showCtab('log'));
    if (keys.anthropic && !s.auto) add('info', 'Autopilot is off. The crew only works when you press Run.', 'START', () => setAuto(true));
    if (keys.anthropic && s.auto) {
      rollDay();
      add('good', D.day.designs >= s.maxPerDay ? `Daily limit reached (${s.maxPerDay}). Autopilot resumes tomorrow.` : `Autopilot on. Next run ${nextRun() <= Date.now() ? 'any moment' : 'at ' + new Date(nextRun()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.`, '', null);
    }
    if (!out.some((x) => x.level !== 'good' && x.level !== 'info')) add('good', 'All systems go. Nothing needs you right now.', '', null);
    return out;
  }
  function renderNeeds() {
    const box = $('#needs'); box.textContent = '';
    for (const n of needs()) {
      const r = el('div', 'need ' + n.level);
      r.append(el('span', 'led ' + (n.level === 'bad' ? 'err' : n.level === 'warn' ? 'busy' : n.level === 'good' ? 'on' : '')), el('span', 'nt', n.text));
      if (n.fn) r.append(btn(n.label, n.fn, 'mini'));
      box.append(r);
    }
  }
  function renderAll() { renderPipeline(); renderOrders(); renderStats(); renderReadouts(); renderCmd(); renderAuto(); renderNeeds(); }

  // ---------- live agent feed (opens when you click an agent) ----------
  let feedRaf = 0;
  function feedTouch(a) { if (feedAgent && (a === feedAgent || feedAgent === 'ultron') && !feedRaf) feedRaf = requestAnimationFrame(() => { feedRaf = 0; renderFeed(false); }); }
  function cstep(i, st) { if (courierRun?.steps[i]) { courierRun.steps[i][1] = st; feedTouch('courier'); } }
  const unesc = (x) => { try { return JSON.parse('"' + x.replace(/\\$/, '') + '"'); } catch { return x.replace(/\\n/g, '\n').replace(/\\"/g, '"'); } };
  const grab = (txt, key) => { const m = txt.match(new RegExp('"' + key + '"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)')); return m ? unesc(m[1]) : ''; };
  function partialSVG(text) {
    const i = text.indexOf('<svg'); if (i < 0) return null;
    const tpl = document.createElement('template'); tpl.innerHTML = text.slice(i).replace(/```[\s\S]*$/, '');
    const svg = tpl.content.querySelector('svg'); if (!svg) return null;
    svg.querySelectorAll('script,foreignObject,image,iframe').forEach((n) => n.remove());
    for (const n of [svg, ...svg.querySelectorAll('*')]) for (const at of [...n.attributes]) if (/^on/i.test(at.name) || (/href$/i.test(at.name) && !/^#/.test(at.value))) n.removeAttribute(at.name);
    svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!svg.getAttribute('viewBox')) svg.setAttribute('viewBox', '0 0 900 1080');
    return { url: svgURL(new XMLSerializer().serializeToString(svg)), shapes: svg.querySelectorAll('path,circle,ellipse,rect,polygon,line,polyline,text').length };
  }
  const prodFor = (a) => D.products.find((p) => p.id === cur[a]) || null;
  function renderFeed(full) {
    const box = $('#feed');
    if (!feedAgent) { box.hidden = true; box.dataset.agent = ''; return; }
    if (feedAgent.startsWith('sp.') || (feedAgent === 'ultron' && window.SP?.get(dept()))) { SP.renderFeed(box, feedAgent, live[feedAgent], full); return; }
    if (dept() === 'marketing' && window.MK) { MK.renderFeed(box, feedAgent, live[feedAgent], full); return; }
    const a = AGENTS.find((x) => x.id === feedAgent), st = agentState[feedAgent] || {}, L = live[feedAgent];
    if (full || box.dataset.agent !== feedAgent) {
      box.dataset.agent = feedAgent; box.hidden = false; box.textContent = '';
      box.style.setProperty('--agent', Station.ROOMS[feedAgent].color);
      const head = el('div', 'feed-head');
      head.append(el('span', 'led', ''), el('b', '', a.name), el('span', 'feed-role', a.role));
      if (AI_AGENTS.includes(feedAgent)) {
        const sel = el('select', 'feed-model'); sel.title = 'Which Claude model this agent thinks with';
        const curM = modelFor(feedAgent);
        const opts = MODEL_CHOICES.some((m) => m[0] === curM) ? MODEL_CHOICES : [...MODEL_CHOICES, [curM, curM, 'custom']];
        for (const [id, n, d] of opts) { const o = el('option', '', `${n} · ${d}`); o.value = id; sel.append(o); }
        sel.value = curM; sel.onchange = () => setAgentModel(feedAgent, sel.value);
        head.append(sel);
      }
      const x = el('button', 'wc close', '✕'); x.title = 'Back to the station'; x.onclick = () => selectAgent(null); head.append(x);
      if (AI_AGENTS.includes(feedAgent)) { const c = el('div', 'feed-cost'); box.append(head, c); } else box.append(head);
      box.append(el('div', 'feed-now'), el('div', 'feed-widget'), el('div', 'lbl', 'LIVE OUTPUT'), el('pre', 'feed-term'), el('div', 'lbl', 'RECENT'), el('div', 'feed-recent'));
    }
    const working = st.status === 'WORKING';
    const fc = box.querySelector('.feed-cost');
    if (fc) { const t = D.cost?.today?.[feedAgent], al = D.cost?.all?.[feedAgent]; fc.textContent = `COST TODAY ${usd(t?.usd || 0)} · ${t?.calls || 0} calls   ·   ALL TIME ${usd(al?.usd || 0)}   ·   avg ${usd(al?.calls ? al.usd / al.calls : 0)} per job`; }
    box.querySelector('.feed-head .led').className = 'led ' + (st.err ? 'err' : working ? 'busy' : st.status === 'OFFLINE' ? '' : 'on');
    box.querySelector('.feed-now').textContent = working ? '▶ ' + (st.text || L?.task || 'Working') : (st.status === 'OFFLINE' ? 'Offline — add your Claude key in Settings.' : 'Idle. ' + (L?.task ? 'Last job: ' + L.task : 'Waiting for orders from ULTRON.'));
    const term = box.querySelector('.feed-term');
    const txt = L?.text || '';
    term.textContent = txt ? (txt.length > 2200 ? '…' + txt.slice(-2200) : txt) + (L?.busy ? '▌' : '') : (feedAgent === 'courier' || feedAgent === 'ledger' || feedAgent === 'analyst' ? 'This agent works with Printify and the numbers rather than writing text — see above.' : 'Nothing yet. Output streams here live while this agent works.');
    term.classList.toggle('busy', !!L?.busy);
    term.scrollTop = term.scrollHeight;
    const rec = box.querySelector('.feed-recent'); rec.textContent = '';
    for (const l of D.log.filter((x) => x.agent === feedAgent).slice(-5).reverse()) { const r = el('div', 'ln ' + l.kind); r.append(el('span', 't', stamp(l.ts) + ' '), el('span', 'm', l.msg)); rec.append(r); }
    if (!rec.childNodes.length) rec.append(el('div', 'tiny dim', 'No activity yet.'));
    const w = box.querySelector('.feed-widget');
    (WIDGETS[feedAgent] || (() => {}))(w, L, working);
  }
  function kind(w, k) { if (w.dataset.kind !== k) { w.textContent = ''; w.dataset.kind = k; return true; } return false; }
  const WIDGETS = {
    forge(w, L) {
      if (kind(w, 'forge')) { const art = el('div', 'feed-art'); art.append(el('img'), el('div', 'feed-art-wip', 'NO ARTWORK YET')); w.append(art, el('div', 'feed-meta')); }
      const p = prodFor('forge'), img = w.querySelector('img'), wip = w.querySelector('.feed-art-wip'), meta = w.querySelector('.feed-meta');
      w.querySelector('.feed-art').classList.toggle('dark', p?.tone === 'dark');
      let url = null, info = '';
      if (L?.busy) { const ps = partialSVG(L.text || ''); if (ps) { url = ps.url; info = `Drawing live · ${(L.text.length / 1024).toFixed(1)} KB written · ${ps.shapes} shapes`; } else info = 'Sketching…'; }
      else if (p?.svg) { url = svgURL(p.svg); info = `Finished: "${p.trend.phrase}" · ${(p.svg.length / 1024).toFixed(1)} KB`; }
      if (url && img.dataset.src !== url) { img.src = url; img.dataset.src = url; }
      img.hidden = !url; wip.hidden = !!url; wip.textContent = L?.busy ? 'SKETCHING…' : 'NO ARTWORK YET';
      meta.textContent = info || 'Forge turns each concept into print-ready artwork.';
    },
    scribe(w, L) {
      if (kind(w, 'scribe')) {
        const c = el('div', 'etsy'); c.append(el('div', 'etsy-img'), el('div', 'etsy-body'));
        w.append(c);
      }
      const p = prodFor('scribe'); const t = L?.busy ? L.text : '';
      const title = t ? grab(t, 'title') : p?.listing?.title || '';
      const desc = t ? grab(t, 'description') : p?.listing?.description || '';
      const tags = t ? (((t.match(/"tags"\s*:\s*\[([^\]]*)/) || [])[1] || '').match(/"((?:[^"\\]|\\.)*)"/g) || []).map((x) => unesc(x.slice(1, -1))) : p?.listing?.tags || [];
      const pr = t ? Number((t.match(/"price"\s*:\s*([\d.]+)/) || [])[1]) : p?.listing?.price;
      const im = w.querySelector('.etsy-img'); im.textContent = '';
      if (p?.svg) { const i = new Image(); i.src = svgURL(p.svg); im.append(i); }
      const b = w.querySelector('.etsy-body'); b.textContent = '';
      b.append(el('div', 'etsy-shop', (D.settings.shopName || 'YOUR SHOP').toUpperCase() + ' · ETSY PREVIEW'));
      b.append(el('div', 'etsy-title', (title || 'Writing the title…') + (L?.busy && !desc ? '▌' : '')));
      if (pr) b.append(el('div', 'etsy-price', money(pr)));
      const tg = el('div', 'etsy-tags'); for (const x of tags) tg.append(el('span', '', x)); b.append(tg);
      if (desc) b.append(el('div', 'etsy-desc', desc + (L?.busy ? '▌' : '')));
      if (!title && !L?.busy) { b.textContent = ''; b.append(el('div', 'tiny dim', 'Scribe writes the Etsy title, tags and description for each design. The next listing appears here as it’s written.')); }
    },
    scout(w, L) {
      kind(w, 'scout'); w.textContent = '';
      const radar = el('div', 'radar'); radar.append(el('i')); w.append(radar);
      let items = [];
      if (L?.busy) { const t = L.text || ''; const re = /"phrase"\s*:\s*"((?:[^"\\]|\\.)*)"[\s\S]*?(?:"audience"\s*:\s*"((?:[^"\\]|\\.)*)")?/g; let m; while ((m = re.exec(t))) items.push({ phrase: unesc(m[1]), audience: m[2] ? unesc(m[2]) : '' }); }
      else items = lastTrends;
      const g = el('div', 'concepts');
      for (const c of items) { const k = el('div', 'concept'); k.append(el('b', '', '“' + c.phrase + '”'), el('span', '', c.audience || ''), el('i', '', c.why || '')); g.append(k); }
      if (!items.length) g.append(el('div', 'tiny dim', L?.busy ? 'Scanning…' : 'Scout finds niches and phrases buyers search for. Concepts lock on here as they’re found.'));
      w.append(g);
    },
    auditor(w, L, working) {
      kind(w, 'auditor'); w.textContent = '';
      const p = prodFor('auditor'); const q = !L?.busy && p?.qa;
      const row = el('div', 'audit');
      const dial = el('div', 'dial'); dial.style.setProperty('--v', q ? q.score : 0);
      dial.append(el('b', '', q ? String(q.score) : '··'), el('span', '', 'QA'));
      const list = el('div', 'checks');
      const checks = ['Trademarks & brands', 'Artwork spelling', 'Title rules (≤140)', '13 tags ≤20 chars', 'Etsy policy'];
      checks.forEach((c, i) => { const r = el('div', 'check ' + (L?.busy ? 'spin' : q ? (i === 0 && q.trademark_risk !== 'low' ? 'bad' : 'ok') : '')); r.style.animationDelay = (i * 0.15) + 's'; r.append(el('span', 'ic'), el('span', '', c)); list.append(r); });
      row.append(dial, list); w.append(row);
      if (q) { const iss = el('div', 'issues'); iss.append(el('span', 'pill ' + (q.trademark_risk === 'low' ? 'pass' : q.trademark_risk === 'high' ? 'fail' : 'medium'), 'TRADEMARK ' + q.trademark_risk.toUpperCase()), el('span', 'pill ' + (q.verdict === 'pass' ? 'pass' : q.verdict === 'fail' ? 'fail' : 'medium'), q.verdict.toUpperCase())); for (const i of q.issues) iss.append(el('div', '', '• ' + i)); w.append(iss); }
      else if (!L?.busy) w.append(el('div', 'tiny dim', 'Auditor checks every design for trademark risk and Etsy rule problems before anything goes live.'));
    },
    ledger(w) {
      kind(w, 'ledger'); w.textContent = '';
      const p = prodFor('ledger') || [...D.products].reverse().find((x) => x.ledger);
      if (!p?.ledger) { w.append(el('div', 'tiny dim', 'Ledger prices each design: real cost, Etsy fees and your margin. The breakdown shows here.')); return; }
      const L = p.ledger; w.append(el('div', 'feed-meta', `"${p.trend.phrase}" · ${(L.margin * 100).toFixed(0)}% margin`));
      const rows = [['Price', L.price, 'p'], ['Production', -L.cost, 'c'], ['Etsy listing', -L.listing, 'f'], ['Transaction 6.5%', -L.transaction, 'f'], ['Processing', -L.processing, 'f'], ['Profit', L.profit, 'g']];
      const wf = el('div', 'waterfall'); let run = 0;
      for (const [k, v, c] of rows) {
        const r = el('div', 'wf ' + c); const bar = el('i');
        const start = c === 'p' || c === 'g' ? 0 : run + v, width = Math.abs(v);
        bar.style.left = (start / L.price * 100) + '%'; bar.style.width = Math.max(0.5, width / L.price * 100) + '%';
        if (c === 'p') run = v; else if (c !== 'g') run += v;
        const track = el('div', 'track'); track.append(bar);
        r.append(el('span', '', k), track, el('b', '', money(v))); wf.append(r);
      }
      w.append(wf);
    },
    courier(w) {
      kind(w, 'courier'); w.textContent = '';
      const p = prodFor('courier');
      if (courierRun) {
        const steps = el('div', 'steps');
        for (const [n, st] of courierRun.steps) { const r = el('div', 'step ' + st); r.append(el('span', 'ic'), el('span', '', n)); steps.append(r); }
        w.append(el('div', 'feed-meta', p ? `"${p.trend.phrase}"` : ''), steps);
      } else w.append(el('div', 'tiny dim', pfReady() ? 'Courier ships designs to Printify and Etsy. ' + pfReady() : 'Courier uploads each design to Printify, creates the product and publishes it to Etsy. Progress shows here.'));
      if (p?.printify?.mockups?.length) { const m = el('div', 'mockups'); for (const src of p.printify.mockups) { const i = new Image(); i.src = src; i.onerror = () => i.remove(); m.append(i); } w.append(m); }
      if (p?.printify?.url) w.append(btn('OPEN ON ETSY', () => kivo.openUrl(p.printify.url), 'mini'));
    },
    analyst(w) {
      kind(w, 'analyst'); w.textContent = '';
      const sales = D.orders.reduce((s, o) => s + o.sales, 0);
      const tiles = el('div', 'tiles mini');
      for (const [k, v] of [['SALES', D.orders.length ? money(sales) : '—'], ['ORDERS', D.orders.length || '—'], ['PROFIT', D.orders.length ? money(D.orders.reduce((s, o) => s + orderProfit(o), 0)) : '—']]) { const t = el('div', 'tile'); t.append(el('label', '', k), el('b', '', String(v))); tiles.append(t); }
      w.append(tiles);
      const best = D.products.filter((p) => p.sales?.qty).sort((a, b) => b.sales.qty - a.sales.qty).slice(0, 5), mx = best[0]?.sales.qty || 1;
      const bars = el('div', 'hbars');
      for (const p of best) { const r = el('div', 'hbar'); const i = el('i'); i.style.width = (p.sales.qty / mx * 100) + '%'; r.append(el('span', '', p.trend.phrase), i, el('b', '', p.sales.qty)); bars.append(r); }
      if (!best.length) bars.append(el('div', 'tiny dim', keys.printify ? 'Best sellers appear here once orders come in.' : 'Connect Printify and Analyst reads your orders and learns what sells.'));
      w.append(bars, el('div', 'feed-meta', D.lastSync ? 'Last sync ' + new Date(D.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Not synced yet'));
    },
    ultron(w) {
      kind(w, 'ultron'); w.textContent = '';
      if (lastPlan) {
        const m = el('div', 'plan'); m.append(el('b', '', 'MISSION ' + String(lastPlan.codename || '').toUpperCase()), el('div', '', lastPlan.directive || ''));
        const ang = el('div', 'etsy-tags'); for (const x of lastPlan.angles || []) ang.append(el('span', '', x)); m.append(ang); w.append(m);
      } else w.append(el('div', 'tiny dim', 'ULTRON plans each mission and hands work to the crew. Talk to him in the CHAT tab.'));
      const cal = el('div', 'cal'); cal.append(el('div', 'lbl', 'SELLING CALENDAR'));
      for (const h of sellingCalendar().slice(0, 5)) { const r = el('div', 'cal-row'); r.append(el('span', '', h.name), el('span', 'dim', h.days + 'd'), el('span', 'pill ' + ({ PRIME: 'pass', 'LAST CHANCE': 'medium', 'TOO LATE': 'fail' }[h.status] || ''), h.status)); cal.append(r); }
      w.append(cal);
      const grid = el('div', 'crewgrid');
      for (const a of AGENTS.filter((x) => x.id !== 'ultron')) {
        const st = agentState[a.id] || {}; const c = el('button', 'crew ' + (st.status === 'WORKING' ? 'busy' : ''));
        c.style.setProperty('--agent', Station.ROOMS[a.id].color);
        c.append(el('span', 'led ' + (st.err ? 'err' : st.status === 'WORKING' ? 'busy' : st.status === 'OFFLINE' ? '' : 'on')), el('b', '', a.name), el('span', '', st.status === 'WORKING' ? st.text : 'idle'));
        c.onclick = () => selectAgent(a.id); grid.append(c);
      }
      w.append(grid);
    },
  };

  // ---------- tabs ----------
  function showTab(t) {
    $$('.tab').forEach((x) => x.classList.toggle('on', x.dataset.tab === t));
    for (const k of ['pipeline', 'orders', 'stats', 'customers']) $('#tab-' + k).hidden = k !== t;
    $('#filter').hidden = $('#btn-export').hidden = t !== 'pipeline';
    if (t === 'orders') { D.lastSeenOrders = Date.now(); persist(); renderNeeds(); }
  }
  function showCtab(t) {
    $$('.ctab').forEach((x) => x.classList.toggle('on', x.dataset.ctab === t));
    for (const k of ['brief', 'chat', 'log']) $('#cp-' + k).hidden = k !== t;
    if (t === 'log') { const b = $('#log'); b.scrollTop = b.scrollHeight; }
    if (t === 'chat') { renderChat(); $('#chat-input').focus(); }
  }

  // ---------- product drawer ----------
  function openDrawer(id) {
    const p = D.products.find((x) => x.id === id); if (!p) return;
    openId = id;
    $('#d-title').textContent = (p.trend?.phrase || 'PRODUCT').toUpperCase();
    const art = $('#d-art'); art.textContent = ''; art.className = 'glass art' + (p.tone === 'dark' ? ' dark' : '');
    if (p.svg) { const i = new Image(); i.src = svgURL(p.svg); art.append(i); } else art.append(el('div', 'wip', 'NO ARTWORK'));
    const mk = $('#d-mocks'); mk.textContent = '';
    for (const src of p.printify?.mockups || []) { const i = new Image(); i.src = src; i.alt = 'Printify mockup'; i.onerror = () => i.remove(); mk.append(i); }
    const pills = $('#d-pills'); pills.textContent = '';
    const s = statusLabel(p); pills.append(el('span', 'pill ' + s.c, s.t));
    if (p.sales?.qty) pills.append(el('span', 'pill pass', `${p.sales.qty} SOLD · ${money(p.sales.revenue)}`));
    if (p.mission) pills.append(el('span', 'pill', 'MISSION ' + String(p.mission).toUpperCase()));
    $('#d-ltitle').value = p.listing?.title || '';
    $('#d-tags').value = (p.listing?.tags || []).join(', ');
    $('#d-desc').value = p.listing?.description || '';
    $('#d-price').value = p.listing?.price ?? '';
    $('#d-cost').value = p.printify?.cost ?? D.settings.defaultCost;
    updateDrawerCalc(p);
    const qa = $('#d-qa'); qa.textContent = '';
    if (p.reviewReason && p.status === 'review') qa.append(el('div', 'issue', '⚑ ' + p.reviewReason));
    if (p.qa) {
      qa.append(el('div', '', `QA SCORE ${p.qa.score} · TRADEMARK RISK ${p.qa.trademark_risk.toUpperCase()} · ${p.qa.verdict.toUpperCase()}`));
      for (const i of p.qa.issues) qa.append(el('div', 'issue', '• ' + i));
      if (p.trend?.why) qa.append(el('div', 'dim', 'Scout: ' + p.trend.why));
    } else qa.append(el('div', 'dim', p.error ? 'Error: ' + p.error : 'Not checked yet.'));
    const canSell = !pfReady() && p.svg && p.listing;
    $('#d-approve').hidden = !(canSell && ['review', 'ready', 'uploaded'].includes(p.status));
    $('#d-retry').hidden = !(['review', 'failed'].includes(p.status) && (p.retryable || /stopped|Didn’t finish|couldn’t check/i.test((p.reviewReason || '') + (p.error || '') + (p.qa?.issues || []).join(' '))));
    $('#d-approve').textContent = p.status === 'retired' ? 'RELIST' : 'APPROVE & PUBLISH';
    $('#d-etsy').hidden = !p.printify?.url;
    $('#d-png').disabled = $('#d-svg').disabled = !p.svg;
    $('#d-note').textContent = p.printify?.productId ? 'Saving also updates the listing on Printify' + (p.status === 'published' ? ' and Etsy.' : '.') : '';
    $('#drawer').hidden = false;
  }
  function updateDrawerCalc() {
    const pr = Number($('#d-price').value) || 0, co = Number($('#d-cost').value) || 0;
    const L = ledger(pr, co);
    const box = $('#d-ledger'); box.textContent = '';
    const row = (a, b, cls) => { const r = el('div', 'r ' + (cls || '')); r.append(el('span', '', a), el('span', '', b)); box.append(r); };
    row('Price', money(L.price)); row('Production cost', money(-L.cost));
    row('Etsy listing fee', money(-L.listing)); row('Etsy transaction 6.5%', money(-L.transaction)); row('Payment processing', money(-L.processing));
    row(`Profit per sale (${(L.margin * 100).toFixed(0)}%)`, money(L.profit), 'tot' + (L.profit < 0 ? ' neg' : ''));
    const pp = D.products.find((x) => x.id === openId);
    if (pp?.aiCost) row('AI cost to make this design (one-off, USD)', usd(pp.aiCost), 'dim');
    $('#d-tlen').textContent = `${$('#d-ltitle').value.length}/140`;
  }
  async function drawerSave(silent) {
    const p = D.products.find((x) => x.id === openId); if (!p) return;
    const before = JSON.stringify(p.listing);
    p.listing = p.listing || {};
    p.listing.title = $('#d-ltitle').value.replace(/\s+/g, ' ').trim().slice(0, 140);
    p.listing.tags = [...new Set($('#d-tags').value.split(',').map((t) => t.trim().toLowerCase().slice(0, 20)).filter(Boolean))].slice(0, 13);
    p.listing.description = $('#d-desc').value;
    p.listing.price = Number($('#d-price').value) || 0;
    const cost = Number($('#d-cost').value) || 0;
    p.printify = p.printify || {}; p.printify.cost = cost;
    p.ledger = ledger(p.listing.price, cost);
    renderAll(); persist();
    if (!silent) toast('Saved');
    if (before !== JSON.stringify(p.listing) && p.printify.productId) await pushEdits(p);
    return p;
  }

  // ---------- order drawer ----------
  function openOrder(id) {
    const o = D.orders.find((x) => x.id === id); if (!o) return;
    $('#o-title').textContent = 'ORDER ' + o.label;
    const b = $('#o-body'); b.textContent = '';
    const g = el('div', 'glass ledger');
    const row = (a, v, cls) => { const r = el('div', 'r ' + (cls || '')); r.append(el('span', '', a), el('span', '', v)); g.append(r); };
    row('Placed', (o.created || '').slice(0, 16).replace('T', ' ')); row('Customer', `${o.customer || '—'} · ${o.country}`); row('Status', o.status.toUpperCase());
    for (const i of o.items) row(`${i.qty}× ${i.title} ${i.variant}`, money(i.price * i.qty));
    row('Printify cost', money(-o.itemCost)); row('Profit (after Etsy fees)', money(orderProfit(o)), 'tot' + (orderProfit(o) < 0 ? ' neg' : ''));
    b.append(g);
    const sh = el('div', 'glass qa');
    if (!o.shipments.length) sh.append(el('div', 'dim', 'Not shipped yet. Printify adds tracking here when it ships.'));
    for (const s of o.shipments) {
      const r = el('div', ''); r.append(el('span', '', `${s.carrier || 'Carrier'} · ${s.number || ''}${s.delivered ? ' · delivered' : ''} `));
      if (s.url) { const a = el('button', 'link', 'track ↗'); a.onclick = () => kivo.openUrl(s.url); r.append(a); }
      sh.append(r);
    }
    b.append(sh);
    const acts = el('div', 'row wrap');
    if (o.status === 'on-hold') acts.append(btn('SEND TO PRINT', async () => { await sendToPrint(o); openOrder(o.id); renderNeeds(); }, 'go'));
    acts.append(btn('MESSAGE CUSTOMER', () => {
      $('#odrawer').hidden = true; showTab('customers');
      $('#cust-msg').value = `(Proactive update for order ${o.label}, ${o.customer}.) Let them know the current status of their order.`;
      draftReply();
    }));
    acts.append(btn('OPEN IN PRINTIFY', () => kivo.openUrl('https://printify.com/app/orders')));
    b.append(acts);
    $('#odrawer').hidden = false;
  }

  // ---------- export ----------
  const csvCell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  async function exportReady() {
    const list = D.products.filter((p) => ['ready', 'review', 'uploaded', 'published'].includes(p.status) && p.svg && p.listing);
    if (!list.length) { toast('Nothing ready to export yet.', true); return; }
    toast(`Rendering ${list.length} print files at 4500×5400…`);
    const files = [];
    const rows = [['title', 'description', 'price', 'currency', 'tags', 'print_file', 'qa_score', 'profit'].join(',')];
    for (const p of list) {
      const name = (p.trend.phrase.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'design') + '-' + p.id.slice(-4) + '.png';
      files.push({ name, data: await svgToPNG(p.svg), encoding: 'base64' });
      rows.push([p.listing.title, p.listing.description, p.listing.price, D.settings.currency, p.listing.tags.join(','), name, p.qa?.score, p.ledger?.profit?.toFixed(2)].map(csvCell).join(','));
    }
    files.push({ name: 'listings.csv', data: rows.join('\r\n') });
    const dir = await kivo.saveDir({ files });
    if (dir) toast(`Exported ${list.length} designs to ${dir}`);
  }

  // ---------- autopilot ----------
  function setAuto(on) {
    D.settings.auto = !!on;
    if (on && !D.lastAuto) D.lastAuto = Date.now() - D.settings.hours * 3600e3; // first run straight away
    log('ultron', on ? 'Autopilot engaged.' : 'Autopilot paused.', on ? 'ok' : '');
    persist(); renderAll();
    if (on) setTimeout(autoTick, 1500);
  }
  async function autoTick() {
    renderAuto(); renderNeeds();
    if (!keys.anthropic || running) return;
    if (keys.printify && D.settings.shopId && Date.now() - D.lastSync > 60 * 60e3) await syncAll(true);
    if (!D.settings.auto) return;
    const stuck = D.products.find((p) => p.retryable && ['review', 'failed'].includes(p.status) && (p.attempts || 0) < 6 && p.trend);
    if (stuck) { log('ultron', `Retrying "${stuck.trend.phrase}" before starting new work.`); await retryProduct(stuck); return; }
    rollDay();
    if (D.day.designs >= D.settings.maxPerDay) return;
    if (Date.now() < nextRun()) return;
    D.lastAuto = Date.now(); persist();
    const brief = D.settings.defaultBrief || tpl().brief || $('#brief').value.trim();
    if (!brief) { log('ultron', 'Autopilot skipped: no brief set. Add one in Settings → Shop profile.', 'err'); return; }
    const n = Math.max(1, Math.min(D.settings.acount, D.settings.maxPerDay - D.day.designs));
    log('ultron', `Autopilot run: ${n} designs.`);
    runMission(brief, n, { mode: D.settings.mode, tone: tpl().tone });
  }

  // ---------- wizard ----------
  let wz = { step: 1, shops: [], template: null, mode: 'auto', skipPf: false };
  function openWizard(step) {
    wz.step = step || 1;
    wz.template = D.settings.template || 'cottagecore';
    wz.mode = D.settings.mode || 'auto';
    $('#wz-shopname').value = D.settings.shopName || '';
    $('#wz-hours').value = D.settings.hours; $('#wz-per').value = D.settings.acount; $('#wz-cap').value = D.settings.maxPerDay;
    $('#wz-login').checked = prefs.openAtLogin; $('#wz-approve').checked = D.settings.autoApprove;
    $('#wz-akey').value = ''; $('#wz-pkey').value = '';
    $('#wz-amsg').textContent = keys.anthropic ? 'A key is already saved. Leave blank to keep it.' : '';
    $('#wz-pmsg').textContent = keys.printify ? 'A token is already saved. Leave blank to keep it, or test it.' : '';
    renderTemplates(); renderModes(); wzShow();
    $('#wizard').hidden = false;
  }
  function wzShow() {
    $$('.wz-step').forEach((s) => (s.hidden = +s.dataset.step !== wz.step));
    $('#wz-stepno').textContent = `${wz.step} / 4`;
    const dots = $('#wz-dots'); dots.textContent = '';
    for (let i = 1; i <= 4; i++) dots.append(el('span', 'led ' + (i < wz.step ? 'on' : i === wz.step ? 'busy' : '')));
    $('#wz-back').disabled = wz.step === 1;
    $('#wz-skip').hidden = wz.step !== 2;
    $('#wz-next').textContent = { 1: 'TEST KEY & CONTINUE', 2: 'CONNECT & CONTINUE', 3: 'CONTINUE', 4: 'LAUNCH STATION' }[wz.step];
  }
  function renderTemplates() {
    const g = $('#tpl-grid'); g.textContent = '';
    for (const t of TEMPLATES) {
      const c = el('button', 'tpl' + (wz.template === t.id ? ' on' : ''));
      c.append(el('b', '', t.name), el('span', '', t.tagline), el('i', '', t.tone === 'dark' ? 'DARK TEES' : 'LIGHT TEES'));
      c.onclick = () => { wz.template = t.id; renderTemplates(); };
      g.append(c);
    }
  }
  function renderModes() { $$('.mode-card').forEach((c) => { c.classList.toggle('on', c.dataset.mode === wz.mode); c.disabled = c.dataset.mode !== 'design' && wz.skipPf && !keys.printify; }); }
  async function wzNext() {
    const nb = $('#wz-next'); nb.disabled = true;
    try {
      if (wz.step === 1) {
        const k = $('#wz-akey').value.trim();
        if (!k && !keys.anthropic) throw new Error('Paste your API key first.');
        if (k) {
          $('#wz-amsg').textContent = 'Testing…';
          await kivo.ask({ key: k, model: D.settings.fast, maxTokens: 5, prompt: 'Reply with OK' });
          await kivo.setKeys({ anthropic: k }); keys = await kivo.keyStatus();
        }
        $('#wz-amsg').textContent = '✓ Crew online.'; wz.step = 2;
        for (const a of AGENTS) setAgent(a.id, 'IDLE');
      } else if (wz.step === 2) {
        const k = $('#wz-pkey').value.trim();
        if (!k && !keys.printify) throw new Error('Paste your Printify token, or press Skip.');
        $('#wz-pmsg').textContent = 'Connecting…';
        if (!wz.shops.length || k) {
          const shops = await kivo.printify({ url: '/v1/shops.json', key: k || undefined });
          if (k) { await kivo.setKeys({ printify: k }); keys = await kivo.keyStatus(); }
          wz.shops = shops;
          const sel = $('#wz-shop'); sel.textContent = '';
          for (const s of shops) { const o = el('option', '', `${s.title} (${s.sales_channel})`); o.value = s.id; sel.append(o); }
          const etsy = shops.find((s) => s.sales_channel === 'etsy');
          if (etsy) sel.value = etsy.id;
          sel.hidden = $('#wz-shop-l').hidden = shops.length < 2;
          if (!shops.length) throw new Error('Token works, but there are no shops on this Printify account. Connect your Etsy shop in Printify first.');
          $('#wz-pmsg').textContent = etsy ? `✓ Connected to ${etsy.title} on Etsy.` : '⚠ Connected, but no shop is linked to Etsy yet. Link it in Printify, then come back.';
          if (shops.length > 1 || !etsy) return;
        }
        const s = wz.shops.find((x) => String(x.id) === $('#wz-shop').value) || wz.shops[0];
        Object.assign(D.settings, { shopId: String(s.id), shopTitle: s.title, shopChannel: s.sales_channel });
        wz.skipPf = false; wz.step = 3;
      } else if (wz.step === 3) {
        wz.step = 4; if (wz.skipPf && !keys.printify) wz.mode = 'design'; renderModes();
      } else {
        await wzLaunch(); return;
      }
      wzShow();
    } catch (e) {
      const m = wz.step === 1 ? '#wz-amsg' : '#wz-pmsg';
      $(m).textContent = '✗ ' + (/401|invalid|auth/i.test(e.message) ? 'That key was rejected. Check you copied all of it.' : e.message);
    } finally { nb.disabled = false; }
  }
  async function wzLaunch() {
    const t = TEMPLATES.find((x) => x.id === wz.template) || TEMPLATES[0];
    Object.assign(D.settings, {
      template: t.id, shopName: $('#wz-shopname').value.trim(), voice: t.voice, defaultBrief: t.brief, colours: t.colours,
      mode: wz.mode, hours: Math.max(1, +$('#wz-hours').value || 6), acount: Math.max(1, Math.min(12, +$('#wz-per').value || 3)), maxPerDay: Math.max(1, +$('#wz-cap').value || 10),
      autoApprove: $('#wz-approve').checked,
    });
    D.ui.tone = t.tone; D.ui.brief = t.brief; $('#brief').value = t.brief; $('#tone').value = t.tone; $('#mode').value = wz.mode;
    prefs = await kivo.setPrefs({ openAtLogin: $('#wz-login').checked, closeToTray: $('#wz-login').checked });
    D.setupDone = true; persist();
    $('#wz-next').textContent = 'LAUNCHING…';
    if (keys.printify && D.settings.shopId && wz.mode !== 'design') {
      try { await autoPickProduct($('#wz-pmsg')); } catch (e) { log('courier', 'Auto-pick failed: ' + e.message + ' — choose a product in Settings.', 'err'); }
    }
    $('#wizard').hidden = true;
    log('ultron', `Station launched with the ${t.name} template. ${MODES[wz.mode]}.`, 'ok');
    renderAll();
    setAuto(true);
  }

  // ---------- settings ----------
  let blueprintCache = null;
  async function openSettings() {
    const s = D.settings;
    $('#s-akey').value = ''; $('#s-pkey').value = '';
    $('#s-akey-st').textContent = keys.anthropic ? '· saved' : '· not set';
    $('#s-pkey-st').textContent = keys.printify ? '· saved' : '· not set';
    const ts = $('#s-template'); ts.textContent = '';
    for (const t of TEMPLATES) { const o = el('option', '', t.name); o.value = t.id; ts.append(o); }
    ts.value = s.template;
    $('#s-shopname').value = s.shopName; $('#s-voice').value = s.voice || tpl().voice; $('#s-defbrief').value = s.defaultBrief || tpl().brief;
    $('#s-mode').value = s.mode; $('#s-hours').value = s.hours; $('#s-acount').value = s.acount; $('#s-cap').value = s.maxPerDay;
    $('#s-qa').value = s.qaMin; $('#s-retire').value = s.retireDays; $('#s-tokcap').value = s.spendCap;
    $('#s-approve').checked = s.autoApprove; $('#s-winners').checked = s.winners;
    $('#s-login').checked = prefs.openAtLogin; $('#s-tray').checked = prefs.closeToTray;
    const am = $('#s-agent-models'); am.textContent = '';
    for (const ag of AI_AGENTS) {
      const f = el('div', 'field'); const l = el('label', 'lbl', ag.toUpperCase()); l.htmlFor = 's-am-' + ag;
      const sel = el('select'); sel.id = 's-am-' + ag; const curM = modelFor(ag);
      for (const [id, n] of MODEL_CHOICES.some((m) => m[0] === curM) ? MODEL_CHOICES : [...MODEL_CHOICES, [curM, curM]]) { const o = el('option', '', n); o.value = id; sel.append(o); }
      sel.value = curM; f.append(l, sel); am.append(f);
    }
    $('#s-cur').value = s.currency; $('#s-cost').value = s.defaultCost; $('#s-minm').value = s.minMargin; $('#s-vat').checked = s.vat;
    $('#s-colours').value = s.colours;
    fillSelect('#s-shop', s.shopId ? [{ id: s.shopId, title: s.shopTitle }] : [], s.shopId, 'Load shops first');
    fillSelect('#s-bp', s.blueprintId ? [{ id: s.blueprintId, title: s.blueprintTitle }] : [], s.blueprintId, 'Search, or press Auto-pick');
    fillSelect('#s-pp', s.providerId ? [{ id: s.providerId, title: s.providerTitle }] : [], s.providerId, 'Pick a product first');
    varMsg();
    $('#settings').hidden = false;
  }
  function fillSelect(sel, items, value, empty) {
    const e = $(sel); e.textContent = '';
    if (!items.length) { const o = el('option', '', empty); o.value = ''; e.append(o); return; }
    for (const it of items) { const o = el('option', '', it.title); o.value = it.id; if (String(it.id) === String(value)) o.selected = true; e.append(o); }
  }
  function varMsg() {
    const n = D.settings.variants.length;
    $('#s-var-msg').textContent = n ? `${n} variants loaded · ${chosenVariants().length} match your colours` : 'Variants load when you pick a print provider.';
  }
  async function pfMsg(fn, msg) {
    $('#s-pf-msg').textContent = msg || 'Working…';
    try { await fn(); if ($('#s-pf-msg').textContent === msg) $('#s-pf-msg').textContent = ''; } catch (e) { $('#s-pf-msg').textContent = e.message; }
  }
  async function savePfKeyFirst() {
    const k = $('#s-pkey').value.trim();
    if (k) { await kivo.setKeys({ printify: k }); keys = await kivo.keyStatus(); $('#s-pkey').value = ''; $('#s-pkey-st').textContent = '· saved'; }
  }

  // ---------- wiring ----------
  function wire() {
    $('#wc-min').onclick = kivo.min; $('#wc-max').onclick = kivo.max; $('#wc-close').onclick = kivo.close;
    $('#btn-settings').onclick = openSettings;
    $('#s-close').onclick = () => ($('#settings').hidden = true);
    $('#d-close').onclick = () => { $('#drawer').hidden = true; openId = null; };
    $('#o-close').onclick = () => ($('#odrawer').hidden = true);
    for (const o of ['#settings', '#drawer', '#odrawer']) $(o).addEventListener('mousedown', (e) => { if (e.target === $(o)) { $(o).hidden = true; openId = null; } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { const any = ['#settings', '#drawer', '#odrawer'].some((o) => !$(o).hidden); for (const o of ['#settings', '#drawer', '#odrawer']) $(o).hidden = true; openId = null; if (!any && feedAgent) selectAgent(null); } });
    $$('[data-url]').forEach((b) => (b.onclick = () => kivo.openUrl(b.dataset.url)));

    const cnt = $('#count');
    $('#cnt-up').onclick = () => { cnt.value = Math.min(25, (+cnt.value || 1) + 1); saveUI(); };
    $('#cnt-dn').onclick = () => { cnt.value = Math.max(1, (+cnt.value || 1) - 1); saveUI(); };
    for (const s of ['#brief', '#count', '#tone']) $(s).addEventListener('change', saveUI);
    $('#mode').addEventListener('change', () => { D.settings.mode = $('#mode').value; persist(); renderCmd(); });

    $('#btn-run').onclick = () => (running ? stopMission() : runFromUI());
    $('#auto-switch').onchange = () => setAuto($('#auto-switch').checked);
    for (const id of ['#count', '#mode']) $(id).addEventListener('input', renderControls);
    // window layout: crew roster, ULTRON panel and terminal can be closed / reopened / resized
    const PANELS = { roster: '.roster', cmd: '.commander', term: '.terminal' };
    const layout = () => { const L = (D.ui.layout = D.ui.layout || {}); for (const [k, v] of Object.entries({ roster: true, cmd: true, term: true, termH: 300 })) if (L[k] === undefined) L[k] = v; return L; };
    const applyLayout = () => {
      const L = layout(), narrow = window.innerWidth < 1300;
      for (const [k, sel] of Object.entries(PANELS)) $(sel).hidden = !L[k];
      const cols = [L.roster && (narrow ? '200px' : '230px'), 'minmax(0, 1fr)', L.cmd && (narrow ? '300px' : '340px')].filter(Boolean);
      const r1 = [L.roster && 'roster', 'station', L.cmd && 'commander'].filter(Boolean), r2 = [L.roster && 'terminal', 'terminal', L.cmd && 'commander'].filter(Boolean);
      const deck = $('.deck');
      deck.style.gridTemplateColumns = cols.join(' ');
      deck.style.gridTemplateRows = L.term ? `minmax(0, 1fr) ${L.termH}px` : 'minmax(0, 1fr)';
      deck.style.gridTemplateAreas = L.term ? `"${r1.join(' ')}" "${r2.join(' ')}"` : `"${r1.join(' ')}"`;
      $$('.dk').forEach((b) => b.classList.toggle('on', !!L[b.dataset.panel]));
      const allClosed = !L.roster && !L.cmd && !L.term;
      $('#btn-expand').textContent = allClosed ? '⤡ SHRINK' : '⤢ EXPAND';
      requestAnimationFrame(() => Station.relayout());
    };
    const setPanel = (k, on) => { const L = layout(); L[k] = on ?? !L[k]; persist(); applyLayout(); };
    $$('[data-panel]').forEach((b) => (b.onclick = () => setPanel(b.dataset.panel, b.classList.contains('pclose') ? false : undefined)));
    window.addEventListener('resize', applyLayout);
    const expand = () => {
      const L = layout(), allClosed = !L.roster && !L.cmd && !L.term;
      if (allClosed) Object.assign(L, L.before || { roster: true, cmd: true, term: true });
      else { L.before = { roster: L.roster, cmd: L.cmd, term: L.term }; Object.assign(L, { roster: false, cmd: false, term: false }); }
      persist(); applyLayout();
    };
    // drag the terminal's top edge to resize it
    $('#term-resize').addEventListener('mousedown', (e) => {
      e.preventDefault(); const L = layout(), y0 = e.clientY, h0 = L.termH;
      const mv = (ev) => { L.termH = Math.max(150, Math.min(window.innerHeight - 260, h0 - (ev.clientY - y0))); applyLayout(); };
      const up = () => { window.removeEventListener('mousemove', mv); window.removeEventListener('mouseup', up); persist(); };
      window.addEventListener('mousemove', mv); window.addEventListener('mouseup', up);
    });
    applyLayout();
    $('#btn-expand').onclick = () => expand();
    document.addEventListener('keydown', (e) => {
      if (/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'f' || e.key === 'F') expand();
    });
    $('#log-clear').onclick = () => { D.log = []; renderLog(); persist(); };
    $$('.ctab').forEach((b) => (b.onclick = () => showCtab(b.dataset.ctab)));
    $('#chat-send').onclick = chatSend;
    $('#chat-input').addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); chatSend(); } });

    $$('.tab').forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));
    $('#filter').onchange = renderPipeline;
    $('#btn-export').onclick = exportReady;
    $('#btn-sync').onclick = () => syncAll(false);

    $('#cust-draft').onclick = draftReply;
    $('#cust-copy').onclick = async () => { try { await navigator.clipboard.writeText($('#cust-reply').value); toast('Copied — paste it into Etsy'); } catch { $('#cust-reply').select(); } };
    $('#cust-etsy').onclick = () => kivo.openUrl('https://www.etsy.com/messages');

    // wizard
    $('#wz-next').onclick = wzNext;
    $('#wz-back').onclick = () => { wz.step = Math.max(1, wz.step - 1); wzShow(); };
    $('#wz-skip').onclick = () => { wz.skipPf = true; wz.step = 3; wzShow(); };
    $$('.mode-card').forEach((c) => (c.onclick = () => { if (!c.disabled) { wz.mode = c.dataset.mode; renderModes(); } }));
    for (const id of ['#wz-akey', '#wz-pkey']) $(id).addEventListener('keydown', (e) => { if (e.key === 'Enter') wzNext(); });

    // drawer
    for (const s of ['#d-price', '#d-cost', '#d-ltitle']) $(s).addEventListener('input', updateDrawerCalc);
    $('#d-save').onclick = () => drawerSave();
    $('#d-retry').onclick = async () => {
      const p = D.products.find((x) => x.id === openId); if (!p || running) return;
      $('#drawer').hidden = true; p.attempts = 0; await retryProduct(p);
    };
    $('#d-approve').onclick = async () => { const p = await drawerSave(true); if (!p) return; $('#drawer').hidden = true; await publish(p); };
    $('#d-etsy').onclick = () => { const p = D.products.find((x) => x.id === openId); if (p?.printify?.url) kivo.openUrl(p.printify.url); };
    $('#d-redo').onclick = async () => {
      const p = D.products.find((x) => x.id === openId); if (!p || running) return;
      $('#drawer').hidden = true;
      try { running = true; uiRunning(true); await forge(p); await audit(p); p.status = p.printify.productId ? 'review' : (p.qa.verdict === 'fail' ? 'review' : 'ready'); if (p.printify.productId) { p.reviewReason = 'New artwork — the Printify copy still has the old design. Delete and re-run to replace it.'; } }
      catch (e) { p.status = 'failed'; p.error = e.message; toast(e.message, true); setAgent('forge', 'IDLE'); }
      finally { running = false; uiRunning(false); renderAll(); persist(); }
    };
    $('#d-png').onclick = async () => {
      const p = D.products.find((x) => x.id === openId); if (!p?.svg) return;
      const f = await kivo.saveFile({ name: p.trend.phrase.replace(/[^\w]+/g, '-') + '.png', data: await svgToPNG(p.svg), encoding: 'base64', filters: [{ name: 'PNG', extensions: ['png'] }] });
      if (f) toast('Saved ' + f);
    };
    $('#d-svg').onclick = async () => {
      const p = D.products.find((x) => x.id === openId); if (!p?.svg) return;
      const f = await kivo.saveFile({ name: p.trend.phrase.replace(/[^\w]+/g, '-') + '.svg', data: p.svg, filters: [{ name: 'SVG', extensions: ['svg'] }] });
      if (f) toast('Saved ' + f);
    };
    $('#d-del').onclick = async () => {
      const b = $('#d-del'); const p = D.products.find((x) => x.id === openId); if (!p) return;
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = p.printify?.productId ? 'CLICK AGAIN · ALSO REMOVES FROM PRINTIFY' : 'CLICK AGAIN TO DELETE'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'DELETE'; }, 3500); return; }
      b.dataset.armed = ''; b.textContent = 'DELETE';
      if (p.printify?.productId && !pfReady()) { try { await pf(`/v1/shops/${D.settings.shopId}/products/${p.printify.productId}.json`, 'DELETE'); } catch (e) { toast('Removed here, but Printify said: ' + e.message, true); } }
      D.products = D.products.filter((x) => x.id !== openId); $('#drawer').hidden = true; openId = null;
      renderAll(); persist(); toast('Deleted');
    };

    // settings
    $('#s-template').onchange = () => { const t = TEMPLATES.find((x) => x.id === $('#s-template').value); if (t) { $('#s-voice').value = t.voice; $('#s-defbrief').value = t.brief; $('#s-colours').value = t.colours; } };
    $('#s-load-shops').onclick = () => pfMsg(async () => {
      await savePfKeyFirst();
      const shops = await pf('/v1/shops.json');
      if (!shops.length) throw new Error('No shops on this Printify account');
      fillSelect('#s-shop', shops.map((s) => ({ id: s.id, title: `${s.title} (${s.sales_channel})` })), D.settings.shopId || (shops.find((s) => s.sales_channel === 'etsy') || shops[0]).id);
    }, 'Loading shops…');
    $('#s-autopick').onclick = () => pfMsg(async () => {
      await savePfKeyFirst();
      const shop = $('#s-shop'); if (shop.value) { D.settings.shopId = shop.value; D.settings.shopTitle = shop.selectedOptions[0].textContent; }
      D.settings.colours = $('#s-colours').value;
      await autoPickProduct($('#s-pf-msg'));
      fillSelect('#s-bp', [{ id: D.settings.blueprintId, title: D.settings.blueprintTitle }], D.settings.blueprintId);
      fillSelect('#s-pp', [{ id: D.settings.providerId, title: D.settings.providerTitle }], D.settings.providerId);
      varMsg();
    }, 'Auto-picking…');
    $('#s-bp-find').onclick = () => pfMsg(async () => {
      await savePfKeyFirst();
      if (!blueprintCache) blueprintCache = await pf('/v1/catalog/blueprints.json');
      const q = $('#s-bp-search').value.trim().toLowerCase().split(/\s+/).filter(Boolean);
      const hits = blueprintCache.filter((b) => { const t = `${b.title} ${b.brand || ''} ${b.model || ''}`.toLowerCase(); return q.every((w) => t.includes(w)); }).slice(0, 60);
      if (!hits.length) throw new Error('No products match that search');
      fillSelect('#s-bp', hits.map((b) => ({ id: b.id, title: `${b.brand || ''} ${b.model || ''} ${b.title}`.trim() })), hits[0].id);
      $('#s-bp').dispatchEvent(new Event('change'));
    }, 'Searching catalog…');
    $('#s-bp').onchange = () => pfMsg(async () => {
      const bp = $('#s-bp').value; if (!bp) return;
      const pps = await pf(`/v1/catalog/blueprints/${bp}/print_providers.json`);
      fillSelect('#s-pp', pps.map((p) => ({ id: p.id, title: p.title })), pps[0]?.id, 'No providers');
      $('#s-pp').dispatchEvent(new Event('change'));
    }, 'Loading providers…');
    $('#s-pp').onchange = () => pfMsg(async () => {
      const bp = $('#s-bp').value, pp = $('#s-pp').value; if (!bp || !pp) return;
      const r = await pf(`/v1/catalog/blueprints/${bp}/print_providers/${pp}/variants.json`);
      D.settings.variants = (r.variants || []).map((v) => ({ id: v.id, title: v.title }));
      D.settings.blueprintId = bp; D.settings.blueprintTitle = $('#s-bp').selectedOptions[0].textContent;
      D.settings.providerId = pp; D.settings.providerTitle = $('#s-pp').selectedOptions[0].textContent;
      varMsg();
    }, 'Loading variants…');
    $('#s-colours').addEventListener('input', () => { D.settings.colours = $('#s-colours').value; varMsg(); });
    $('#s-wizard').onclick = () => { $('#settings').hidden = true; openWizard(1); };

    $('#s-save').onclick = async () => {
      const s = D.settings;
      const ak = $('#s-akey').value.trim(), pk = $('#s-pkey').value.trim();
      if (ak || pk) await kivo.setKeys({ anthropic: ak, printify: pk });
      keys = await kivo.keyStatus();
      s.template = $('#s-template').value; s.shopName = $('#s-shopname').value.trim(); s.voice = $('#s-voice').value.trim(); s.defaultBrief = $('#s-defbrief').value.trim();
      s.mode = $('#s-mode').value; s.hours = Math.max(1, +$('#s-hours').value || 6); s.acount = Math.max(1, Math.min(12, +$('#s-acount').value || 3)); s.maxPerDay = Math.max(1, +$('#s-cap').value || 10);
      s.qaMin = Math.max(0, Math.min(100, +$('#s-qa').value || 0)); s.retireDays = Math.max(0, +$('#s-retire').value || 0); s.spendCap = Math.max(0, +$('#s-tokcap').value || 0);
      s.autoApprove = $('#s-approve').checked; s.winners = $('#s-winners').checked;
      s.agentModels = { ...s.agentModels }; for (const ag of AI_AGENTS) s.agentModels[ag] = $('#s-am-' + ag).value;
      s.currency = $('#s-cur').value; s.defaultCost = Number($('#s-cost').value) || DEFAULTS.defaultCost; s.minMargin = Number($('#s-minm').value) || 0; s.vat = $('#s-vat').checked;
      const shop = $('#s-shop'); if (shop.value && shop.value !== s.shopId) { s.shopId = shop.value; s.shopTitle = shop.selectedOptions[0].textContent.replace(/ \(\w+\)$/, ''); s.shopChannel = (shop.selectedOptions[0].textContent.match(/\((\w+)\)$/) || [])[1] || s.shopChannel; }
      s.colours = $('#s-colours').value;
      prefs = await kivo.setPrefs({ openAtLogin: $('#s-login').checked, closeToTray: $('#s-tray').checked });
      $('#mode').value = s.mode;
      for (const a of AGENTS) if (agentState[a.id]?.status === 'OFFLINE' && keys.anthropic) setAgent(a.id, 'IDLE');
      persist(); renderAll();
      $('#settings').hidden = true; toast('Settings saved');
    };

    kivo.onUpdate?.((st) => {
      if (st.state === 'available') log('ultron', `Update ${st.version} found — downloading.`);
      if (st.state === 'downloaded') { $('#btn-update').hidden = false; $('#btn-update').textContent = `UPDATE ${st.version} · RESTART`; notify('Kivo Ultron update ready', `Version ${st.version} installs when you restart.`); }
    });
    $('#btn-update').onclick = () => kivo.installUpdate?.();
    kivo.onDelta?.(({ reqId, delta, search }) => { const a = reqAgent[reqId]; if (a && live[a]) { live[a].text += delta; if (search) { live[a].search = search; log(a, `Searching the web: “${search}”`); } feedTouch(a); } });
    kivo.onTray?.((c) => {
      if (c === 'run' && !running) runFromUI();
      if (c === 'toggleAuto') setAuto(!D.settings.auto);
    });
  }
  function runFromUI() {
    if (running) return;
    const brief = $('#brief').value.trim() || D.settings.defaultBrief || tpl().brief;
    if (!brief) { toast('Write a mission brief first.', true); $('#brief').focus(); return; }
    runMission(brief, Math.max(1, Math.min(25, +$('#count').value || 3)), { tone: $('#tone').value, mode: $('#mode').value });
  }
  function stopMission() {
    if (!running || stopping) return;
    stopping = true; abortFlag = true; window.KU.cancelAgents(AGENTS.map((a) => a.id).filter((a) => a !== 'ultron' || !window.SP?.anyRunning));
    const q = missionQueue.length; missionQueue.length = 0;
    log('ultron', 'Stop requested — cancelling the current job' + (q ? ` and ${q} queued mission(s)` : '') + '.', 'err');
    renderControls();
  }
  function setDept(d) {
    const sp = window.SP?.get(d) || null;
    if (!sp && !['store', 'marketing'].includes(d)) d = 'store';
    D.ui.dept = d; persist();
    document.querySelectorAll('.dept').forEach((b) => b.classList.toggle('on', b.dataset.dept === d));
    const kind = sp ? 'space' : d;
    document.body.dataset.dept = kind;
    const mk = kind === 'marketing', st = kind === 'store';
    $('#station').hidden = !st; $('#room-labels').hidden = !st; $('#office').hidden = !mk; Office.show(mk);
    if (sp) SP.show(d); else SP.hideCustom();
    $('#map-title').textContent = sp ? sp.name.toUpperCase() + ' FLOOR' : mk ? 'MARKETING FLOOR' : 'STATION MAP';
    $('#mission-chip').hidden = !st;
    $('#readouts').hidden = !st; $('#readouts-mk').hidden = !mk; $('#readouts-sp').hidden = !sp;
    $('#brief-store').hidden = !st; $('#brief-mk').hidden = !mk; $('#brief-sp').hidden = !sp;
    $('#term-store').hidden = !st; $('#term-mk').hidden = !mk; $('#term-sp').hidden = !sp;
    if (!sp) {
      $('#cmd-template').textContent = mk ? (MK.M().settings.handle || 'Marketing') : (D.settings.shopName || tpl().name);
      $('#cmd-mode').textContent = mk ? { auto: 'AUTO-POST', review: 'REVIEW FIRST', make: 'MAKE ONLY' }[MK.M().settings.mode] : MODES[D.settings.mode];
    }
    if (feedAgent) selectAgent(null);
    renderRoster(); if (sp) SP.renderAll(); else if (mk) MK.renderAll(); else renderAll();
    SP.renderTabs();
    requestAnimationFrame(() => { Station.relayout(); Office.relayout(); });
  }
  function saveUI() { D.ui = { ...D.ui, brief: $('#brief').value, count: +$('#count').value || 3, tone: $('#tone').value }; persist(); }

  // ---------- boot ----------
  async function boot() {
    if (document.readyState === 'loading') await new Promise((r) => document.addEventListener('DOMContentLoaded', r, { once: true }));
    const saved = await kivo.load();
    if (saved && saved.products) {
      D = { ...D, ...saved, settings: { ...DEFAULTS, ...(saved.settings || {}), agentModels: { ...DEFAULTS.agentModels, ...(saved.settings?.agentModels || {}) } }, ui: { ...D.ui, ...(saved.ui || {}) }, day: saved.day || D.day, history: saved.history || {}, chat: saved.chat || [] };
      if (saved.setupDone === undefined) D.setupDone = true; // upgrading from 1.0
    }
    for (const p of D.products) {
      if (p.status === 'working') { p.status = 'failed'; p.error = 'App closed mid-mission'; }
      if (p.status === 'held') p.status = 'review';
      if (p.status === 'failed' && p.svg && p.listing) { p.status = 'review'; p.reviewReason = 'Didn’t finish last time (' + (p.error || 'unknown error') + ')'; p.retryable = true; p.attempts = 0; }
      else if (p.status === 'failed' && p.trend && p.error !== 'Mission aborted') { p.retryable = true; p.attempts = 0; }
      p.sales = p.sales || { qty: 0, revenue: 0 }; p.printify = p.printify || {};
    }
    // migrate the old seasonal brief to the calendar-driven one
    const seasonal = TEMPLATES.find((t) => t.id === 'seasonal');
    if (/^Whatever holiday/.test(D.settings.defaultBrief || '')) D.settings.defaultBrief = seasonal.brief;
    if (/^Whatever holiday/.test(D.ui.brief || '')) D.ui.brief = seasonal.brief;
    rollDay();
    keys = await kivo.keyStatus();
    prefs = await kivo.getPrefs();
    $('#brief').value = D.ui.brief || D.settings.defaultBrief || tpl().brief;
    $('#count').value = D.ui.count; $('#tone').value = D.ui.tone || tpl().tone; $('#mode').value = D.settings.mode;
    Station.init($('#station'), $('#room-labels'), selectAgent);
    Office.init($('#office'), selectAgent);
    Core.init($('#core'));
    wire();
    for (const a of AGENTS) agentState[a.id] = { status: keys.anthropic ? 'IDLE' : 'OFFLINE' };
    await SOCIAL.load(); MK.init(); SP.init();
    document.querySelectorAll('.dept[data-dept="store"], .dept[data-dept="marketing"]').forEach((b) => (b.onclick = () => setDept(b.dataset.dept)));
    renderRoster(); renderLog(); renderChat(); renderAll();
    setDept(D.ui.dept || 'store');
    const ver = await kivo.version?.(); if (ver) $('#s-ver').textContent = 'Kivo Ultron v' + ver;
    if (!keys.anthropic || !D.setupDone) setTimeout(() => openWizard(keys.anthropic ? 2 : 1), 500);
    else log('ultron', 'Station online. ' + needs().filter((n) => n.level === 'warn' || n.level === 'bad').length + ' things need you.', 'ok');
    setInterval(autoTick, 30000); setTimeout(autoTick, 4000);
  }
  window.KU = {
    get D() { return D; }, get keys() { return keys; }, get feedAgent() { return feedAgent; },
    ask, askJSON, log, persist, toast, notify, setAgent, agentState, live, money, usd, svgURL, svgToPNG, shopContext, calendarText,
    tpl, modelFor, setAgentModel, MODEL_CHOICES, modelName, costOf, stamp, fatal, cleanErr, feedTouch, selectAgent, renderReadouts, setDept, renderRoster,
    storeSummary: () => stateSummary(), dept: () => dept(), busyElsewhere: () => running || !!window.MK?.running,
    cancelAgents: (ids) => { const set = new Set(ids); const r = Object.entries(reqAgent).filter(([, a]) => set.has(a)).map(([k]) => Number(k)); if (r.length) kivo.cancelReq?.(r); },
  };
  boot();
})();
