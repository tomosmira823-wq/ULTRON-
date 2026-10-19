// Kivo Ultron — agents, mission control, Printify/Etsy pipeline
(() => {
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const AGENTS = [
    { id: 'ultron',  name: 'ULTRON',  role: 'Commander · plans missions and delegates' },
    { id: 'analyst', name: 'ANALYST', role: 'Reads your orders and finds what sells' },
    { id: 'scout',   name: 'SCOUT',   role: 'Trend scan · niches, phrases, buyers' },
    { id: 'forge',   name: 'FORGE',   role: 'Designer · print-ready artwork' },
    { id: 'scribe',  name: 'SCRIBE',  role: 'Etsy title, 13 tags, description' },
    { id: 'auditor', name: 'AUDITOR', role: 'QA · trademark and Etsy rule checks' },
    { id: 'ledger',  name: 'LEDGER',  role: 'Fees, cost, price and margin' },
    { id: 'courier', name: 'COURIER', role: 'Uploads to Printify, publishes to Etsy' },
  ];

  const DEFAULTS = {
    model: 'claude-sonnet-5-5', fast: 'claude-haiku-5-5',
    currency: 'GBP', defaultCost: 9.5, minMargin: 25, vat: true,
    shopId: '', shopTitle: '', blueprintId: '', blueprintTitle: '', providerId: '', providerTitle: '',
    colours: 'White', variants: [],
    auto: false, hours: 6, acount: 3, abrief: '',
  };
  let D = { products: [], log: [], orders: [], settings: { ...DEFAULTS }, stats: { calls: 0, tokens: 0 }, ui: { brief: '', count: 4, tone: 'light', push: false, publish: false }, lastAuto: 0 };
  let keys = { anthropic: false, printify: false };
  let running = false, abortFlag = false, logFilter = null, openId = null;
  const agentState = {};

  // ---------- persistence ----------
  let saveT;
  function persist() { clearTimeout(saveT); saveT = setTimeout(() => kivo.save(D), 300); }

  // ---------- helpers ----------
  const SYM = { GBP: '£', USD: '$', EUR: '€' };
  const money = (n) => (n == null || isNaN(n)) ? '—' : (SYM[D.settings.currency] || '') + Number(n).toFixed(2);
  function toast(msg, err) {
    const t = $('#toast'); t.textContent = msg; t.className = err ? 'err' : ''; t.hidden = false;
    clearTimeout(toast._t); toast._t = setTimeout(() => (t.hidden = true), err ? 6000 : 3200);
  }
  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function stamp(ts) { const d = new Date(ts); return d.toTimeString().slice(0, 8); }

  function log(agent, msg, kind) {
    D.log.push({ ts: Date.now(), agent, msg, kind: kind || '' });
    if (D.log.length > 500) D.log.splice(0, D.log.length - 500);
    renderLog(); persist();
  }
  function renderLog() {
    const box = $('#log'); const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
    box.textContent = '';
    for (const l of D.log.slice(-200)) {
      if (logFilter && l.agent !== logFilter) continue;
      const ln = el('div', 'ln ' + l.kind);
      ln.append(el('span', 't', stamp(l.ts) + ' '), el('span', 'a', '[' + l.agent.toUpperCase() + '] '), el('span', 'm', l.msg));
      box.append(ln);
    }
    if (atBottom) box.scrollTop = box.scrollHeight;
  }

  function setAgent(id, status, text, err) {
    agentState[id] = { status, text: text || '', err: !!err };
    Station.setBusy(id, status === 'WORKING', text || (status === 'WORKING' ? '' : ''), err);
    if (id === 'ultron') Core.setActive(status === 'WORKING');
    renderRoster();
  }
  function renderRoster() {
    const ul = $('#roster'); ul.textContent = '';
    for (const a of AGENTS) {
      const s = agentState[a.id] || { status: 'IDLE' };
      const li = el('li', (s.status === 'WORKING' ? 'busy ' : '') + (logFilter === a.id ? 'sel' : ''));
      li.append(el('span', 'led ' + (s.err ? 'err' : s.status === 'WORKING' ? 'busy' : 'on')), el('span', 'nm', a.name), el('span', 'st', s.err ? 'FAULT' : s.status));
      li.append(el('span', 'rl', s.status === 'WORKING' && s.text ? s.text : a.role));
      li.title = a.role + ' — click to filter the comms log';
      li.onclick = () => selectAgent(a.id);
      ul.append(li);
    }
  }
  function selectAgent(id) {
    logFilter = logFilter === id ? null : id;
    Station.highlight(logFilter);
    renderRoster(); renderLog();
  }

  // ---------- Claude ----------
  async function ask(agent, prompt, { fast = false, maxTokens = 4000 } = {}) {
    if (!keys.anthropic) throw new Error('Add your Anthropic API key in Settings.');
    const model = fast ? D.settings.fast : D.settings.model;
    const r = await kivo.ask({ prompt, model, maxTokens });
    D.stats.calls++; D.stats.tokens += (r.usage.input_tokens || 0) + (r.usage.output_tokens || 0);
    renderCmd(); persist();
    return r.text;
  }
  function parseJSON(text) {
    const f = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    let s = f ? f[1] : text;
    try { return JSON.parse(s); } catch {}
    const a = s.search(/[\[{]/); const b = Math.max(s.lastIndexOf('}'), s.lastIndexOf(']'));
    if (a >= 0 && b > a) return JSON.parse(s.slice(a, b + 1));
    throw new Error('Agent returned unreadable data');
  }
  async function askJSON(agent, prompt, opts) {
    let lastErr;
    for (let i = 0; i < 2; i++) {
      try { return parseJSON(await ask(agent, prompt + (i ? '\n\nIMPORTANT: reply with valid JSON only.' : ''), opts)); }
      catch (e) { lastErr = e; if (/API key|401|403|credit|billing/i.test(e.message)) throw e; }
    }
    throw lastErr;
  }

  // ---------- SVG ----------
  function sanitizeSVG(raw) {
    let s = String(raw).replace(/```(?:svg|xml)?/g, '');
    const a = s.indexOf('<svg'), b = s.lastIndexOf('</svg>');
    if (a < 0 || b < 0) throw new Error('No SVG in design output');
    s = s.slice(a, b + 6);
    const doc = new DOMParser().parseFromString(s, 'image/svg+xml');
    if (doc.querySelector('parsererror')) throw new Error('Design SVG was malformed');
    const root = doc.documentElement;
    root.querySelectorAll('script,foreignObject,image,iframe,use[href^="http"]').forEach((n) => n.remove());
    root.querySelectorAll('*').forEach((n) => { for (const at of [...n.attributes]) { if (/^on/i.test(at.name) || (/href$/i.test(at.name) && !/^#/.test(at.value))) n.removeAttribute(at.name); } });
    root.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', '0 0 900 1080');
    root.setAttribute('width', '900'); root.setAttribute('height', '1080');
    return new XMLSerializer().serializeToString(root);
  }
  const svgURL = (svg) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  function svgText(svg) { try { const d = new DOMParser().parseFromString(svg, 'image/svg+xml'); return [...d.querySelectorAll('text,tspan')].map((n) => n.textContent.trim()).filter(Boolean).join(' / '); } catch { return ''; } }
  function svgToPNG(svg, w = 4500, h = 5400) {
    return new Promise((res, rej) => {
      const img = new Image();
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = w; c.height = h;
        const x = c.getContext('2d'); x.drawImage(img, 0, 0, w, h);
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
    const p = (cost + (f.list + f.fix) * v) / (1 - (0.065 + f.pct) * v - m);
    return Math.ceil(p) - 0.01;
  }

  // ---------- mission ----------
  function checkAbort() { if (abortFlag) throw new Error('ABORTED'); }

  async function runMission(brief, count, opts) {
    if (running) return;
    if (!keys.anthropic) { toast('Add your Anthropic API key first.', true); openSettings(); return; }
    running = true; abortFlag = false; uiRunning(true);
    const tone = opts.tone || 'light';
    try {
      setAgent('ultron', 'WORKING', 'Planning mission');
      log('ultron', `Mission received: "${brief}" · ${count} designs · ${tone} garments`);

      // ANALYST
      let insights = 'No sales history yet.';
      if (D.orders.length) {
        setAgent('analyst', 'WORKING', 'Reading orders');
        const tally = {};
        for (const o of D.orders) for (const it of o.items) tally[it.title] = (tally[it.title] || 0) + it.qty;
        const top = Object.entries(tally).sort((a, b) => b[1] - a[1]).slice(0, 8);
        insights = 'Best sellers so far: ' + top.map(([t, q]) => `${t} (${q} sold)`).join('; ');
        log('analyst', insights, 'ok');
        Station.packet('analyst', 'ultron', '#c38bff');
        await sleep(600);
        setAgent('analyst', 'IDLE');
      }

      const existing = D.products.slice(-80).map((p) => p.trend?.phrase).filter(Boolean);
      const plan = await askJSON('ultron', `You are ULTRON, commander of an autonomous print-on-demand Etsy studio. Turn the owner's brief into a mission plan.
Brief: ${brief}
Number of designs: ${count}
Garments: ${tone === 'dark' ? 'dark (black/charcoal/navy)' : 'light (white/cream/pastel)'} shirts
Sales insight: ${insights}
Phrases already made (do not repeat): ${existing.join(' | ') || 'none'}
Reply with JSON only: {"codename": "two-word mission codename", "directive": "2 sentences telling the scout what to hunt for", "angles": ["${count} distinct angles, each a few words"]}`, { fast: true, maxTokens: 800 });
      checkAbort();
      $('#mission-chip').textContent = `MISSION ${String(plan.codename || 'UNNAMED').toUpperCase()} · ${count} DESIGNS`;
      log('ultron', `Codename ${plan.codename}. ${plan.directive}`, 'ok');
      setAgent('ultron', 'WORKING', 'Delegating');
      Station.packet('ultron', 'scout');

      // SCOUT
      setAgent('scout', 'WORKING', 'Scanning trends');
      const trends = await askJSON('scout', `You are SCOUT, the trend agent for an Etsy print-on-demand t-shirt shop. Find ${count} concrete, sellable design concepts.
Mission directive: ${plan.directive}
Angles to cover (one concept each): ${(plan.angles || []).join('; ')}
Owner's brief: ${brief}
Avoid these existing phrases: ${existing.join(' | ') || 'none'}
Rules: original phrases only, no trademarks, brands, celebrities, characters, sports teams or song lyrics. Think about what Etsy buyers actually search for and gift.
Reply with a JSON array of ${count} objects: {"phrase": "the words printed on the shirt (short)", "niche": "...", "audience": "who buys it", "style": "visual style, e.g. vintage botanical line art", "palette": ["#hex", "#hex", "#hex"], "why": "one sentence why it sells", "keywords": ["5 search keywords"]}`, { maxTokens: 2500 });
      checkAbort();
      const list = (Array.isArray(trends) ? trends : trends.items || []).slice(0, count);
      log('scout', `Found ${list.length} concepts: ${list.map((x) => '"' + x.phrase + '"').join(', ')}`, 'ok');
      setAgent('scout', 'IDLE');

      const items = list.map((tr) => {
        const p = { id: uid(), createdAt: Date.now(), mission: plan.codename, tone, status: 'working', stage: 'design', trend: tr, svg: '', listing: null, qa: null, ledger: null, printify: {} };
        D.products.push(p); return p;
      });
      renderPipeline(); persist();

      for (const p of items) {
        checkAbort();
        try { await produce(p, opts); }
        catch (e) {
          if (e.message === 'ABORTED') throw e;
          p.status = 'failed'; p.error = e.message; log('ultron', `"${p.trend.phrase}" failed: ${e.message}`, 'err');
          renderPipeline(); persist();
        }
      }
      const ok = items.filter((p) => p.status !== 'failed').length;
      log('ultron', `Mission ${plan.codename} complete. ${ok}/${items.length} products through the line.`, 'ok');
      toast(`Mission complete · ${ok} products ready`);
    } catch (e) {
      if (e.message === 'ABORTED') log('ultron', 'Mission aborted by commander.', 'err');
      else { log('ultron', 'Mission failed: ' + e.message, 'err'); toast(e.message, true); }
      for (const p of D.products) if (p.status === 'working') { p.status = 'failed'; p.error = p.error || 'Mission stopped'; }
    } finally {
      running = false; uiRunning(false);
      for (const a of AGENTS) if (agentState[a.id]?.status === 'WORKING') setAgent(a.id, 'IDLE');
      $('#mission-chip').textContent = 'NO ACTIVE MISSION';
      renderPipeline(); renderReadouts(); persist();
    }
  }

  async function forge(p) {
    setAgent('forge', 'WORKING', `Drawing "${p.trend.phrase}"`);
    p.stage = 'design'; renderPipeline();
    const tr = p.trend;
    const prompt = `You are FORGE, the design agent in a print-on-demand t-shirt studio. Create ONE original, high-quality t-shirt graphic as SVG.
Phrase printed on the design: "${tr.phrase}"
Niche: ${tr.niche}. Buyer: ${tr.audience}. Style: ${tr.style}. Suggested palette: ${(tr.palette || []).join(', ')}.
Garment: ${p.tone === 'dark' ? 'BLACK / dark shirts — use light, bright inks that pop on black' : 'WHITE / light shirts — use mid-to-dark inks that read on white'}.
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
      try { svg = sanitizeSVG(await ask('forge', prompt, { maxTokens: 9000 })); } catch (e) { err = e; if (/API key|401|403/.test(e.message)) throw e; }
    }
    if (!svg) throw err || new Error('Design failed');
    p.svg = svg; renderPipeline(); persist();
    log('forge', `Artwork done for "${tr.phrase}" (${(svg.length / 1024).toFixed(1)} KB)`, 'ok');
    setAgent('forge', 'IDLE');
  }

  async function produce(p, opts) {
    const tr = p.trend;
    Station.packet('scout', 'forge', '#5ac8ff');
    await forge(p); checkAbort();

    // SCRIBE
    Station.packet('forge', 'scribe', '#ff8a5a');
    setAgent('scribe', 'WORKING', `Writing "${tr.phrase}"`);
    p.stage = 'listing'; renderPipeline();
    const product = D.settings.blueprintTitle || 'Unisex cotton t-shirt';
    const L = await askJSON('scribe', `You are SCRIBE, an Etsy SEO copywriter. Write the listing for this print-on-demand ${product}.
Design phrase: "${tr.phrase}". Niche: ${tr.niche}. Buyer: ${tr.audience}. Style: ${tr.style}. Keywords: ${(tr.keywords || []).join(', ')}.
Currency: ${D.settings.currency}.
Etsy rules: title max 140 characters, front-load the strongest search phrase, natural wording, no ALL CAPS words, no repeated words, max one of each of these symbols: & : and no other special characters. Exactly 13 tags, each 20 characters or fewer, lowercase, multi-word phrases buyers type, no repeats of the title's exact phrase.
Description: warm and specific, 120-200 words, then a short "Details" section with care and fit notes suitable for a ${product}, and a gift line. Use plain line breaks, no markdown symbols.
Reply with JSON only: {"title": "...", "tags": ["13 tags"], "description": "...", "price": suggested retail price as a number for the Etsy market}`, { maxTokens: 2000 });
    checkAbort();
    p.listing = {
      title: String(L.title || tr.phrase).slice(0, 140),
      tags: (L.tags || []).map((t) => String(t).toLowerCase().slice(0, 20)).filter(Boolean).slice(0, 13),
      description: String(L.description || ''),
      price: Number(L.price) || 24.99,
    };
    log('scribe', `Listing: ${p.listing.title}`, 'ok');
    setAgent('scribe', 'IDLE'); renderPipeline(); persist();

    // AUDITOR
    Station.packet('scribe', 'auditor', '#ffd36b');
    await audit(p); checkAbort();

    // LEDGER
    Station.packet('auditor', 'ledger', '#ff6b8b');
    setAgent('ledger', 'WORKING', 'Pricing');
    price(p);
    log('ledger', `Price ${money(p.ledger.price)} · cost ${money(p.ledger.cost)} · fees ${money(p.ledger.fees)} · profit ${money(p.ledger.profit)} (${(p.ledger.margin * 100).toFixed(0)}%)`, 'ok');
    await sleep(400); setAgent('ledger', 'IDLE');

    p.status = p.qa?.verdict === 'fail' || p.qa?.trademark_risk === 'high' ? 'held' : 'ready';
    p.stage = '';
    if (p.status === 'held') log('auditor', `HOLD on "${tr.phrase}" — review before publishing.`, 'err');
    renderPipeline(); renderReadouts(); persist();

    if (p.status === 'ready' && opts.push) {
      Station.packet('ledger', 'courier', '#b6ff5a');
      await push(p);
      if (opts.publish) await publish(p);
    }
  }

  async function audit(p) {
    setAgent('auditor', 'WORKING', `Checking "${p.trend.phrase}"`);
    p.stage = 'qa'; renderPipeline();
    const Q = await askJSON('auditor', `You are AUDITOR, the QA agent for an Etsy print-on-demand shop. Check this product before it goes live.
Phrase: "${p.trend.phrase}"
Text actually in the artwork: "${svgText(p.svg) || '(none found)'}"
Title (${p.listing.title.length} chars): ${p.listing.title}
Tags: ${p.listing.tags.map((t) => `${t} (${t.length})`).join(', ')}
Check: trademarked words or phrases (brands, franchises, celebrities, teams, song lyrics, trademarked slogans), spelling mistakes in the artwork text versus the phrase, Etsy title rules (≤140 chars, no ALL CAPS, limited symbols), 13 tags each ≤20 chars, anything that breaks Etsy policy.
Reply with JSON only: {"score": 0-100 overall quality and safety, "trademark_risk": "low"|"medium"|"high", "issues": ["short issue", ...], "verdict": "pass"|"fix"|"fail"}`, { fast: true, maxTokens: 800 });
    p.qa = { score: Number(Q.score) || 0, trademark_risk: Q.trademark_risk || 'low', issues: Q.issues || [], verdict: Q.verdict || 'pass' };
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
  function pfReady() {
    if (!keys.printify) return 'Add your Printify token in Settings.';
    if (!D.settings.shopId) return 'Pick your Printify shop in Settings.';
    if (!D.settings.blueprintId || !D.settings.providerId) return 'Pick a product and print provider in Settings.';
    if (!D.settings.variants.length) return 'No variants loaded — re-select the print provider in Settings.';
    return '';
  }
  function chosenVariants() {
    const cols = D.settings.colours.split(',').map((c) => c.trim().toLowerCase()).filter(Boolean);
    const v = D.settings.variants.filter((x) => !cols.length || cols.some((c) => x.title.toLowerCase().includes(c)));
    return v.slice(0, 100);
  }
  async function push(p) {
    const why = pfReady(); if (why) { log('courier', why, 'err'); toast(why, true); return; }
    if (p.printify.productId) { toast('Already on Printify.'); return; }
    setAgent('courier', 'WORKING', 'Uploading artwork');
    try {
      const vars = chosenVariants();
      if (!vars.length) throw new Error('No variants match your colours setting');
      const b64 = await svgToPNG(p.svg);
      const slug = p.trend.phrase.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
      const up = await kivo.printify({ method: 'POST', url: '/v1/uploads/images.json', body: { file_name: `${slug}.png`, contents: b64 } });
      log('courier', `Artwork uploaded to Printify (${up.id})`);
      setAgent('courier', 'WORKING', 'Creating product');
      const cents = Math.round(p.listing.price * 100);
      const body = {
        title: p.listing.title, description: p.listing.description, tags: p.listing.tags,
        blueprint_id: Number(D.settings.blueprintId), print_provider_id: Number(D.settings.providerId),
        variants: vars.map((v) => ({ id: v.id, price: cents, is_enabled: true })),
        print_areas: [{ variant_ids: vars.map((v) => v.id), placeholders: [{ position: 'front', images: [{ id: up.id, x: 0.5, y: 0.5, scale: 1, angle: 0 }] }] }],
      };
      const prod = await kivo.printify({ method: 'POST', url: `/v1/shops/${D.settings.shopId}/products.json`, body });
      p.printify = { ...p.printify, imageId: up.id, productId: prod.id };
      const costs = (prod.variants || []).filter((v) => v.is_enabled && v.cost).map((v) => v.cost);
      if (costs.length) {
        p.printify.cost = Math.max(...costs) / 100;
        p.ledger = ledger(p.listing.price, p.printify.cost);
        log('ledger', `Real Printify cost ${money(p.printify.cost)} → profit ${money(p.ledger.profit)} (${(p.ledger.margin * 100).toFixed(0)}%)`, p.ledger.margin < D.settings.minMargin / 100 ? 'err' : 'ok');
      }
      p.status = 'uploaded';
      log('courier', `Product created on Printify with ${vars.length} variants`, 'ok');
    } catch (e) { log('courier', 'Printify push failed: ' + e.message, 'err'); toast(e.message, true); setAgent('courier', 'IDLE', '', true); renderPipeline(); persist(); return; }
    setAgent('courier', 'IDLE'); renderPipeline(); renderReadouts(); persist();
  }
  async function publish(p) {
    const why = pfReady(); if (why) { toast(why, true); return; }
    if (!p.printify.productId) { toast('Push it to Printify first.', true); return; }
    setAgent('courier', 'WORKING', 'Publishing to Etsy');
    try {
      await kivo.printify({ method: 'POST', url: `/v1/shops/${D.settings.shopId}/products/${p.printify.productId}/publish.json`, body: { title: true, description: true, images: true, variants: true, tags: true, keyFeatures: true, shipping_template: true } });
      p.status = 'published'; p.printify.publishedAt = Date.now();
      Station.launchShuttle();
      log('courier', `"${p.listing.title.slice(0, 60)}" sent to Etsy. It goes live once Etsy accepts it (usually a few minutes).`, 'ok');
    } catch (e) { log('courier', 'Publish failed: ' + e.message, 'err'); toast(e.message, true); setAgent('courier', 'IDLE', '', true); renderPipeline(); persist(); return; }
    setAgent('courier', 'IDLE'); renderPipeline(); renderReadouts(); persist();
  }
  async function refreshLink(p) {
    if (!p.printify.productId || pfReady()) return;
    try {
      const prod = await kivo.printify({ url: `/v1/shops/${D.settings.shopId}/products/${p.printify.productId}.json` });
      if (prod.external?.handle) { p.printify.url = prod.external.handle; persist(); }
    } catch {}
  }

  async function syncOrders() {
    if (!keys.printify || !D.settings.shopId) { toast('Connect Printify in Settings first.', true); openSettings(); return; }
    setAgent('analyst', 'WORKING', 'Syncing orders');
    try {
      const all = [];
      for (let page = 1; page <= 10; page++) {
        const r = await kivo.printify({ url: `/v1/shops/${D.settings.shopId}/orders.json?limit=50&page=${page}` });
        for (const o of r.data || []) {
          const items = (o.line_items || []).map((li) => ({ title: li.metadata?.title || 'Item', qty: li.quantity || 1, price: (li.metadata?.price || 0) / 100, cost: ((li.cost || 0) + (li.shipping_cost || 0)) / 100 }));
          all.push({ id: o.id, created: o.created_at, status: o.status, label: o.label || o.id, items, sales: items.reduce((s, i) => s + i.price * i.qty, 0), cost: items.reduce((s, i) => s + i.cost, 0) });
        }
        if (!r.last_page || page >= r.last_page) break;
      }
      D.orders = all;
      log('analyst', `Synced ${all.length} orders · sales ${money(all.reduce((s, o) => s + o.sales, 0))}`, 'ok');
    } catch (e) { log('analyst', 'Order sync failed: ' + e.message, 'err'); toast(e.message, true); }
    setAgent('analyst', 'IDLE'); renderOrders(); renderReadouts(); persist();
  }

  // ---------- rendering ----------
  function statusLabel(p) {
    if (p.status === 'working') return { t: (p.stage || 'working').toUpperCase(), c: 'working' };
    return { t: { ready: 'READY', held: 'ON HOLD', uploaded: 'ON PRINTIFY', published: 'LIVE', failed: 'FAILED' }[p.status] || p.status.toUpperCase(), c: p.status === 'held' ? 'medium' : p.status };
  }
  function renderPipeline() {
    const box = $('#tab-pipeline'); box.textContent = '';
    const f = $('#filter').value;
    const list = D.products.filter((p) => f === 'all' || p.status === f).slice().reverse();
    if (!list.length) {
      const e = el('div', 'empty');
      e.innerHTML = keys.anthropic
        ? 'No products yet.<br>Write a brief in the commander panel and hit <b>RUN MISSION</b>.<br>The crew will scout trends, draw the artwork, write the Etsy listing, check it and price it.'
        : 'Station offline.<br>Open <b>SETTINGS</b> and add your Anthropic API key to bring the crew online.';
      box.append(e); return;
    }
    for (const p of list) {
      const c = el('div', 'card'); c.tabIndex = 0;
      const th = el('div', 'thumb' + (p.tone === 'dark' ? ' dark' : ''));
      if (p.svg) { const i = new Image(); i.src = svgURL(p.svg); i.alt = p.trend?.phrase || ''; th.append(i); }
      else th.append(el('div', 'wip', p.status === 'failed' ? 'NO ART' : 'FORGING…'));
      const m = el('div', 'meta');
      const s = statusLabel(p);
      const pr = el('div', 'pill-row'); pr.append(el('span', 'pill ' + s.c, s.t));
      if (p.qa) pr.append(el('span', 'pill ' + (p.qa.verdict === 'pass' ? 'pass' : p.qa.verdict === 'fail' ? 'fail' : 'medium'), 'QA ' + p.qa.score));
      m.append(pr, el('div', 'ph', p.listing?.title || p.trend?.phrase || '…'));
      const n = el('div', 'nums'); n.append(el('span', '', p.listing ? money(p.listing.price) : '—'), el('span', 'p', p.ledger ? '+' + money(p.ledger.profit) : ''));
      m.append(n);
      c.append(th, m);
      c.onclick = () => openDrawer(p.id);
      c.onkeydown = (e) => { if (e.key === 'Enter') openDrawer(p.id); };
      box.append(c);
    }
  }
  function renderOrders() {
    const box = $('#tab-orders'); box.textContent = '';
    if (!D.orders.length) { box.append(Object.assign(el('div', 'empty'), { innerHTML: 'No orders synced.<br>Connect Printify in Settings, then hit <b>SYNC ORDERS</b>.' })); return; }
    const t = el('table'); t.innerHTML = '<thead><tr><th>DATE</th><th>ORDER</th><th>ITEMS</th><th>STATUS</th><th style="text-align:right">SALES</th><th style="text-align:right">PRINTIFY COST</th></tr></thead>';
    const tb = el('tbody');
    for (const o of D.orders) {
      const tr = el('tr');
      tr.append(el('td', '', (o.created || '').slice(0, 10)), el('td', '', String(o.label).slice(0, 18)), el('td', '', o.items.map((i) => `${i.qty}× ${i.title}`).join(', ')), el('td', '', o.status), el('td', 'n', money(o.sales)), el('td', 'n', money(o.cost)));
      tb.append(tr);
    }
    t.append(tb); box.append(t);
  }
  function renderReadouts() {
    const sales = D.orders.reduce((s, o) => s + o.sales, 0);
    $('#ro-sales').textContent = D.orders.length ? money(sales) : '—';
    $('#ro-orders').textContent = D.orders.length ? D.orders.length : '—';
    $('#ro-live').textContent = D.products.filter((p) => p.status === 'published').length;
    $('#ro-pipe').textContent = D.products.length;
    const ms = D.products.filter((p) => p.ledger).map((p) => p.ledger.margin);
    $('#ro-margin').textContent = ms.length ? (ms.reduce((a, b) => a + b, 0) / ms.length * 100).toFixed(0) + '%' : '—';
  }
  function renderCmd() {
    $('#cmd-model').textContent = D.settings.model;
    $('#cmd-calls').textContent = D.stats.calls;
    $('#cmd-tokens').textContent = D.stats.tokens > 9999 ? (D.stats.tokens / 1000).toFixed(1) + 'k' : D.stats.tokens;
    $('#cmd-state').textContent = running ? 'Mission in progress.' : keys.anthropic ? 'Standing by.' : 'Offline — no API key.';
  }
  function uiRunning(on) {
    $('#btn-run').disabled = on; $('#btn-abort').disabled = !on;
    $('#btn-run').textContent = on ? 'RUNNING…' : 'RUN MISSION';
    renderCmd();
  }
  function renderAuto() {
    const on = D.settings.auto;
    $('#led-auto').className = 'led' + (on ? ' on' : '');
    $('#auto-label').textContent = on ? `AUTOPILOT · EVERY ${D.settings.hours}H` : 'AUTOPILOT OFF';
    if (on) {
      const next = (D.lastAuto || 0) + D.settings.hours * 3600e3;
      $('#next-run').textContent = next <= Date.now() ? 'Next run: now' : 'Next run ' + new Date(next).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else $('#next-run').textContent = 'Turn on in Settings to run missions on a timer.';
  }

  // ---------- drawer ----------
  function openDrawer(id) {
    const p = D.products.find((x) => x.id === id); if (!p) return;
    openId = id;
    $('#d-title').textContent = (p.trend?.phrase || 'PRODUCT').toUpperCase();
    const art = $('#d-art'); art.textContent = ''; art.className = 'glass art' + (p.tone === 'dark' ? ' dark' : '');
    if (p.svg) { const i = new Image(); i.src = svgURL(p.svg); art.append(i); } else art.append(el('div', 'wip', 'NO ARTWORK'));
    const pills = $('#d-pills'); pills.textContent = '';
    const s = statusLabel(p); pills.append(el('span', 'pill ' + s.c, s.t));
    if (p.mission) pills.append(el('span', 'pill', 'MISSION ' + String(p.mission).toUpperCase()));
    if (p.trend?.niche) pills.append(el('span', 'pill', p.trend.niche.toUpperCase().slice(0, 30)));
    $('#d-ltitle').value = p.listing?.title || '';
    $('#d-tags').value = (p.listing?.tags || []).join(', ');
    $('#d-desc').value = p.listing?.description || '';
    $('#d-price').value = p.listing?.price ?? '';
    $('#d-cost').value = p.printify?.cost ?? D.settings.defaultCost;
    updateDrawerCalc(p);
    const qa = $('#d-qa'); qa.textContent = '';
    if (p.qa) {
      qa.append(el('div', '', `QA SCORE ${p.qa.score} · TRADEMARK RISK ${p.qa.trademark_risk.toUpperCase()} · ${p.qa.verdict.toUpperCase()}`));
      for (const i of p.qa.issues) qa.append(el('div', 'issue', '• ' + i));
      if (p.trend?.why) qa.append(el('div', 'dim', 'Scout: ' + p.trend.why));
    } else qa.append(el('div', 'dim', p.error ? 'Error: ' + p.error : 'Not checked yet.'));
    if (p.printify?.url) { const a = el('button', 'link', 'Open on Etsy ↗'); a.onclick = () => kivo.openUrl(p.printify.url); qa.append(a); }
    else if (p.status === 'published') refreshLink(p).then(() => { if (p.printify.url && openId === p.id) openDrawer(p.id); });
    $('#d-push').disabled = !p.svg || !p.listing || !!p.printify?.productId;
    $('#d-pub').disabled = !p.printify?.productId || p.status === 'published';
    $('#d-png').disabled = $('#d-svg').disabled = !p.svg;
    $('#drawer').hidden = false;
  }
  function updateDrawerCalc(p) {
    const pr = Number($('#d-price').value) || 0, co = Number($('#d-cost').value) || 0;
    const L = ledger(pr, co);
    const box = $('#d-ledger'); box.textContent = '';
    const row = (a, b, cls) => { const r = el('div', 'r ' + (cls || '')); r.append(el('span', '', a), el('span', '', b)); box.append(r); };
    row('Price', money(L.price)); row('Production cost', '−' + money(L.cost));
    row('Etsy listing fee', '−' + money(L.listing)); row('Etsy transaction 6.5%', '−' + money(L.transaction)); row('Payment processing', '−' + money(L.processing));
    row(`Profit (${(L.margin * 100).toFixed(0)}%)`, money(L.profit), 'tot' + (L.profit < 0 ? ' neg' : ''));
    const t = $('#d-ltitle').value.length; $('#d-tlen').textContent = `${t}/140`;
  }
  function drawerSave() {
    const p = D.products.find((x) => x.id === openId); if (!p) return;
    p.listing = p.listing || {};
    p.listing.title = $('#d-ltitle').value.trim().slice(0, 140);
    p.listing.tags = $('#d-tags').value.split(',').map((t) => t.trim().toLowerCase().slice(0, 20)).filter(Boolean).slice(0, 13);
    p.listing.description = $('#d-desc').value;
    p.listing.price = Number($('#d-price').value) || 0;
    const cost = Number($('#d-cost').value) || 0;
    p.printify = p.printify || {}; p.printify.cost = cost;
    p.ledger = ledger(p.listing.price, cost);
    if (p.status === 'held') p.status = 'ready';
    renderPipeline(); renderReadouts(); persist(); toast('Saved');
    return p;
  }

  // ---------- export ----------
  function csvCell(v) { return '"' + String(v ?? '').replace(/"/g, '""') + '"'; }
  async function exportReady() {
    const list = D.products.filter((p) => ['ready', 'uploaded', 'published'].includes(p.status) && p.svg);
    if (!list.length) { toast('Nothing ready to export yet.', true); return; }
    toast(`Rendering ${list.length} print files at 4500×5400…`);
    const files = [];
    const rows = [['title', 'description', 'price', 'currency', 'tags', 'print_file', 'qa_score', 'profit'].join(',')];
    for (const p of list) {
      const name = p.trend.phrase.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40) + '-' + p.id.slice(-4) + '.png';
      files.push({ name, data: await svgToPNG(p.svg), encoding: 'base64' });
      rows.push([p.listing.title, p.listing.description, p.listing.price, D.settings.currency, p.listing.tags.join(','), name, p.qa?.score, p.ledger?.profit?.toFixed(2)].map(csvCell).join(','));
    }
    files.push({ name: 'listings.csv', data: rows.join('\r\n') });
    const dir = await kivo.saveDir({ files });
    if (dir) toast(`Exported ${list.length} products to ${dir}`);
  }

  // ---------- settings ----------
  let blueprintCache = null;
  async function openSettings() {
    const s = D.settings;
    $('#s-akey').value = ''; $('#s-pkey').value = '';
    $('#s-akey-st').textContent = keys.anthropic ? '· saved' : '· not set';
    $('#s-pkey-st').textContent = keys.printify ? '· saved' : '· not set';
    $('#s-model').value = s.model; $('#s-fast').value = s.fast;
    $('#s-cur').value = s.currency; $('#s-cost').value = s.defaultCost; $('#s-minm').value = s.minMargin; $('#s-vat').checked = s.vat;
    $('#s-colours').value = s.colours;
    $('#s-auto').checked = s.auto; $('#s-hours').value = s.hours; $('#s-acount').value = s.acount; $('#s-abrief').value = s.abrief;
    fillSelect('#s-shop', s.shopId ? [{ id: s.shopId, title: s.shopTitle }] : [], s.shopId, 'Load shops first');
    fillSelect('#s-bp', s.blueprintId ? [{ id: s.blueprintId, title: s.blueprintTitle }] : [], s.blueprintId, 'Search for a product');
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
    try { await fn(); $('#s-pf-msg').textContent = ''; } catch (e) { $('#s-pf-msg').textContent = e.message; }
  }
  async function savePfKeyFirst() {
    const k = $('#s-pkey').value.trim();
    if (k) { await kivo.setKeys({ printify: k }); keys = await kivo.keyStatus(); $('#s-pkey').value = ''; $('#s-pkey-st').textContent = '· saved'; }
  }

  // ---------- autopilot ----------
  function autoTick() {
    renderAuto();
    if (!D.settings.auto || running || !keys.anthropic) return;
    if (Date.now() - (D.lastAuto || 0) < D.settings.hours * 3600e3) return;
    const brief = D.settings.abrief || $('#brief').value.trim();
    if (!brief) { log('ultron', 'Autopilot skipped: no brief set.', 'err'); D.lastAuto = Date.now(); persist(); return; }
    D.lastAuto = Date.now(); persist();
    log('ultron', 'Autopilot engaged.');
    runMission(brief, D.settings.acount, { tone: $('#tone').value, push: $('#auto-push').checked, publish: $('#auto-publish').checked });
  }

  // ---------- wiring ----------
  function wire() {
    $('#wc-min').onclick = kivo.min; $('#wc-max').onclick = kivo.max; $('#wc-close').onclick = kivo.close;
    $('#btn-settings').onclick = openSettings;
    $('#s-close').onclick = () => ($('#settings').hidden = true);
    $('#d-close').onclick = () => { $('#drawer').hidden = true; openId = null; };
    for (const o of ['#settings', '#drawer']) $(o).addEventListener('mousedown', (e) => { if (e.target === $(o)) { $(o).hidden = true; openId = null; } });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') { $('#settings').hidden = true; $('#drawer').hidden = true; openId = null; } });

    const cnt = $('#count');
    $('#cnt-up').onclick = () => { cnt.value = Math.min(12, (+cnt.value || 1) + 1); saveUI(); };
    $('#cnt-dn').onclick = () => { cnt.value = Math.max(1, (+cnt.value || 1) - 1); saveUI(); };
    for (const s of ['#brief', '#count', '#tone', '#auto-push', '#auto-publish']) $(s).addEventListener('change', saveUI);
    $('#auto-publish').addEventListener('change', () => { if ($('#auto-publish').checked) $('#auto-push').checked = true; saveUI(); });
    $('#auto-push').addEventListener('change', () => { if (!$('#auto-push').checked) $('#auto-publish').checked = false; saveUI(); });

    $('#btn-run').onclick = () => {
      const brief = $('#brief').value.trim();
      if (!brief) { toast('Write a mission brief first.', true); $('#brief').focus(); return; }
      runMission(brief, Math.max(1, Math.min(12, +cnt.value || 4)), { tone: $('#tone').value, push: $('#auto-push').checked, publish: $('#auto-publish').checked });
    };
    $('#btn-abort').onclick = () => { abortFlag = true; log('ultron', 'Abort requested — finishing current step…', 'err'); };
    $('#log-clear').onclick = () => { D.log = []; renderLog(); persist(); };

    $$('.tab').forEach((b) => (b.onclick = () => {
      $$('.tab').forEach((x) => x.classList.toggle('on', x === b));
      $('#tab-pipeline').hidden = b.dataset.tab !== 'pipeline';
      $('#tab-orders').hidden = b.dataset.tab !== 'orders';
      $('#filter').hidden = b.dataset.tab !== 'pipeline';
    }));
    $('#filter').onchange = renderPipeline;
    $('#btn-export').onclick = exportReady;
    $('#btn-sync').onclick = syncOrders;

    // drawer
    for (const s of ['#d-price', '#d-cost', '#d-ltitle']) $(s).addEventListener('input', () => { const p = D.products.find((x) => x.id === openId); if (p) updateDrawerCalc(p); });
    $('#d-save').onclick = drawerSave;
    $('#d-redo').onclick = async () => {
      const p = D.products.find((x) => x.id === openId); if (!p || running) return;
      $('#drawer').hidden = true;
      try { running = true; uiRunning(true); p.status = 'working'; await forge(p); await audit(p); p.status = p.qa.verdict === 'fail' ? 'held' : 'ready'; }
      catch (e) { p.status = 'failed'; p.error = e.message; toast(e.message, true); setAgent('forge', 'IDLE'); }
      finally { running = false; uiRunning(false); renderPipeline(); persist(); }
    };
    $('#d-png').onclick = async () => {
      const p = D.products.find((x) => x.id === openId); if (!p?.svg) return;
      const data = await svgToPNG(p.svg);
      const f = await kivo.saveFile({ name: p.trend.phrase.replace(/[^\w]+/g, '-') + '.png', data, encoding: 'base64', filters: [{ name: 'PNG', extensions: ['png'] }] });
      if (f) toast('Saved ' + f);
    };
    $('#d-svg').onclick = async () => {
      const p = D.products.find((x) => x.id === openId); if (!p?.svg) return;
      const f = await kivo.saveFile({ name: p.trend.phrase.replace(/[^\w]+/g, '-') + '.svg', data: p.svg, filters: [{ name: 'SVG', extensions: ['svg'] }] });
      if (f) toast('Saved ' + f);
    };
    $('#d-push').onclick = async () => { const p = drawerSave(); if (!p) return; $('#drawer').hidden = true; await push(p); };
    $('#d-pub').onclick = async () => { const p = D.products.find((x) => x.id === openId); if (!p) return; $('#drawer').hidden = true; await publish(p); };
    $('#d-del').onclick = () => {
      const b = $('#d-del');
      if (b.dataset.armed !== '1') { b.dataset.armed = '1'; b.textContent = 'CLICK AGAIN TO DELETE'; setTimeout(() => { b.dataset.armed = ''; b.textContent = 'DELETE'; }, 3000); return; }
      b.dataset.armed = ''; b.textContent = 'DELETE';
      D.products = D.products.filter((x) => x.id !== openId); $('#drawer').hidden = true; openId = null;
      renderPipeline(); renderReadouts(); persist(); toast('Deleted from Kivo Ultron (Printify/Etsy copies are untouched)');
    };

    // settings
    $('#s-load-shops').onclick = () => pfMsg(async () => {
      await savePfKeyFirst();
      const shops = await kivo.printify({ url: '/v1/shops.json' });
      if (!shops.length) throw new Error('No shops on this Printify account');
      fillSelect('#s-shop', shops.map((s) => ({ id: s.id, title: `${s.title} (${s.sales_channel})` })), D.settings.shopId || shops[0].id);
    }, 'Loading shops…');
    $('#s-bp-find').onclick = () => pfMsg(async () => {
      await savePfKeyFirst();
      if (!blueprintCache) blueprintCache = await kivo.printify({ url: '/v1/catalog/blueprints.json' });
      const q = $('#s-bp-search').value.trim().toLowerCase();
      const hits = blueprintCache.filter((b) => !q || (b.title + ' ' + (b.brand || '') + ' ' + (b.model || '')).toLowerCase().includes(q)).slice(0, 60);
      if (!hits.length) throw new Error('No products match that search');
      fillSelect('#s-bp', hits.map((b) => ({ id: b.id, title: `${b.title} · ${b.brand || ''} ${b.model || ''}`.trim() })), hits[0].id);
      $('#s-bp').dispatchEvent(new Event('change'));
    }, 'Searching catalog…');
    $('#s-bp').onchange = () => pfMsg(async () => {
      const bp = $('#s-bp').value; if (!bp) return;
      const pps = await kivo.printify({ url: `/v1/catalog/blueprints/${bp}/print_providers.json` });
      fillSelect('#s-pp', pps.map((p) => ({ id: p.id, title: p.title + (p.location?.country ? ` (${p.location.country})` : '') })), pps[0]?.id, 'No providers');
      $('#s-pp').dispatchEvent(new Event('change'));
    }, 'Loading providers…');
    $('#s-pp').onchange = () => pfMsg(async () => {
      const bp = $('#s-bp').value, pp = $('#s-pp').value; if (!bp || !pp) return;
      const r = await kivo.printify({ url: `/v1/catalog/blueprints/${bp}/print_providers/${pp}/variants.json` });
      D.settings.variants = (r.variants || []).map((v) => ({ id: v.id, title: v.title }));
      varMsg();
    }, 'Loading variants…');
    $('#s-colours').addEventListener('input', () => { D.settings.colours = $('#s-colours').value; varMsg(); });

    $('#s-save').onclick = async () => {
      const s = D.settings;
      const ak = $('#s-akey').value.trim(), pk = $('#s-pkey').value.trim();
      if (ak || pk) await kivo.setKeys({ anthropic: ak, printify: pk });
      keys = await kivo.keyStatus();
      s.model = $('#s-model').value.trim() || DEFAULTS.model; s.fast = $('#s-fast').value.trim() || DEFAULTS.fast;
      s.currency = $('#s-cur').value; s.defaultCost = Number($('#s-cost').value) || DEFAULTS.defaultCost; s.minMargin = Number($('#s-minm').value) || 0; s.vat = $('#s-vat').checked;
      const shop = $('#s-shop'); if (shop.value) { s.shopId = shop.value; s.shopTitle = shop.selectedOptions[0].textContent; }
      const bp = $('#s-bp'); if (bp.value) { s.blueprintId = bp.value; s.blueprintTitle = bp.selectedOptions[0].textContent.split(' · ')[0]; }
      const pp = $('#s-pp'); if (pp.value) { s.providerId = pp.value; s.providerTitle = pp.selectedOptions[0].textContent; }
      s.colours = $('#s-colours').value;
      const wasAuto = s.auto;
      s.auto = $('#s-auto').checked; s.hours = Math.max(1, Number($('#s-hours').value) || 6); s.acount = Math.max(1, Math.min(12, Number($('#s-acount').value) || 3)); s.abrief = $('#s-abrief').value.trim();
      if (s.auto && !wasAuto) D.lastAuto = Date.now();
      persist(); renderCmd(); renderAuto(); renderPipeline();
      $('#settings').hidden = true; toast('Settings saved');
      if (keys.anthropic) log('ultron', 'Crew online. Awaiting orders.', 'ok');
    };

    // updates
    kivo.onUpdate?.((st) => {
      if (st.state === 'available') log('ultron', `Update ${st.version} found — downloading.`);
      if (st.state === 'downloaded') { $('#btn-update').hidden = false; $('#btn-update').textContent = `UPDATE ${st.version} · RESTART`; toast(`Update ${st.version} ready — restart to install`); }
    });
    $('#btn-update').onclick = () => kivo.installUpdate?.();
  }
  function saveUI() {
    D.ui = { brief: $('#brief').value, count: +$('#count').value || 4, tone: $('#tone').value, push: $('#auto-push').checked, publish: $('#auto-publish').checked };
    persist();
  }

  // ---------- boot ----------
  async function boot() {
    const saved = await kivo.load();
    if (saved && saved.products) D = { ...D, ...saved, settings: { ...DEFAULTS, ...(saved.settings || {}) }, ui: { ...D.ui, ...(saved.ui || {}) } };
    for (const p of D.products) if (p.status === 'working') { p.status = 'failed'; p.error = 'App closed mid-mission'; }
    keys = await kivo.keyStatus();
    $('#brief').value = D.ui.brief; $('#count').value = D.ui.count; $('#tone').value = D.ui.tone;
    $('#auto-push').checked = D.ui.push; $('#auto-publish').checked = D.ui.publish;
    Station.init($('#station'), $('#room-labels'), selectAgent);
    Core.init($('#core'));
    wire();
    for (const a of AGENTS) agentState[a.id] = { status: keys.anthropic ? 'IDLE' : 'OFFLINE' };
    $('#ro-agents').textContent = keys.anthropic ? `${AGENTS.length} ONLINE` : 'OFFLINE';
    renderRoster(); renderLog(); renderPipeline(); renderOrders(); renderReadouts(); renderCmd(); renderAuto();
    const ver = await kivo.version?.(); if (ver) $('#s-ver').textContent = 'Kivo Ultron v' + ver;
    if (!keys.anthropic) { log('ultron', 'Station offline. Add your Anthropic API key in Settings to wake the crew.', 'err'); setTimeout(openSettings, 600); }
    else log('ultron', 'Station online. Crew standing by.', 'ok');
    setInterval(autoTick, 30000); setTimeout(autoTick, 5000);
    setInterval(() => { $('#ro-agents').textContent = keys.anthropic ? `${AGENTS.length} ONLINE` : 'OFFLINE'; }, 5000);
  }
  boot();
})();
