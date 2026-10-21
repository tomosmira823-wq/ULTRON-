// Kivo Ultron — SPACES: build your own departments and hire bots into any space (Store, Marketing or your own)
(() => {
  const K = window.KU;
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const btn = (l, f, c) => { const b = el('button', 'hw-btn ' + (c || ''), l); b.onclick = f; return b; };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const HOUR = 3600e3;

  const CAP = { store: 6, marketing: 6, custom: 18 };
  const HUES = [['Cyan', 188], ['Teal', 165], ['Green', 140], ['Gold', 44], ['Orange', 24], ['Red', 356], ['Pink', 322], ['Blue', 215], ['Violet', 280]];
  const TOOL_NAMES = { web: 'Web search', store: 'Store data', marketing: 'Marketing data', memory: 'Past outputs', email: 'Send emails (you approve)' };
  const ICONS = OfficeKit.ICONS;
  const MODEL_SHORT = { 'claude-opus-5-5': 'Opus', 'claude-sonnet-5-5': 'Sonnet', 'claude-haiku-5-5': 'Haiku' };
  const DEF_MODEL = 'claude-sonnet-5-5';

  // ---------- ready-made spaces ----------
  const bot = (name, team, icon, job, tools = {}, extra = {}) => ({ name, team, icon, job, tools, ...extra });
  const TEMPLATES = [
    { id: 'blank', style: 'office', name: 'Blank space', hue: 188, tagline: 'Start empty and hire your own bots.', mission: '', brief: '', agents: [] },
    { id: 'sales', style: 'office', name: 'Sales Team', hue: 188, tagline: 'Find local businesses, research them, write the outreach.',
      mission: 'Find local small businesses that would benefit from a better website, AI automation or custom software, research each one, and write personal outreach that gets replies.',
      brief: 'Find 5 businesses in Cheshire that need a better website and write an outreach email for each.',
      agents: [
        bot('Lead Finder', 'Research', 'search', 'Search the web for real businesses that match the brief. For each give the name, town, website (or "none found"), what they do and why they are a good lead. Only list businesses you actually found.', { web: true }),
        bot('Site Auditor', 'Research', 'check', 'For each lead, look at their website and online presence and list 3 specific, honest problems (speed, mobile, booking, out of date, no site) and the opportunity for each.', { web: true }),
        bot('Offer Writer', 'Pitch', 'money', 'Turn each audit into a short, specific offer: what we would build, the benefit to them in plain English and a starting price range.'),
        bot('Email Writer', 'Pitch', 'mail', 'Write a short personal cold email for each lead (subject + under 120 words). Mention one real detail about their business. Friendly, no hype, one clear call to action.'),
        bot('Checker', 'Quality', 'check', 'Check every email for made-up facts, spelling, tone and spammy wording. Output the final, ready-to-send list as a table: business, email address if known, subject, email.', {}, { approve: true }),
      ] },
    { id: 'youtube', style: 'studio', name: 'YouTube Studio', hue: 356, tagline: 'Ideas, scripts, titles, thumbnails and descriptions.',
      mission: 'Plan and write YouTube videos and Shorts that people actually watch to the end.',
      brief: 'Plan 3 Shorts about weird science facts.',
      agents: [
        bot('Idea Scout', 'Research', 'radar', 'Find video ideas that are getting attention right now in this niche. For each: the idea, why it will work and a working title.', { web: true }),
        bot('Scriptwriter', 'Writing', 'lines', 'Write the full script for each video: a hook in the first 2 seconds, tight beats, and a payoff. Mark on-screen text in [brackets].'),
        bot('Title & Thumbnail', 'Packaging', 'image', 'Write 3 title options and describe 2 thumbnail concepts (text on it, image, colours) for each video.'),
        bot('SEO Writer', 'Packaging', 'doc', 'Write the description, 10 tags and 3 hashtags for each video.'),
        bot('Shot List', 'Production', 'film', 'Turn each script into a shot list and edit notes: shot, visual, on-screen text, sound, duration.'),
      ] },
    { id: 'research', style: 'lab', name: 'Research Lab', hue: 215, tagline: 'Deep dives on any topic, fact-checked and written up.',
      mission: 'Research any question properly using the web and write it up as a clear, sourced report.',
      brief: 'What are the best mini PCs for a small office backup server in 2026?',
      agents: [
        bot('Searcher', 'Research', 'search', 'Search the web widely for the question. Collect the key facts, numbers and options, each with its source link.', { web: true }),
        bot('Fact Checker', 'Research', 'check', 'Check the most important claims against a second source. Mark each as confirmed, disputed or unverified, with links.', { web: true }),
        bot('Analyst', 'Analysis', 'chart', 'Compare the options and findings. Pull out what actually matters, the trade-offs and a recommendation with reasons.'),
        bot('Report Writer', 'Writing', 'doc', 'Write the final report: a 3-line answer first, then sections, a comparison table if useful, and a sources list with links.'),
      ] },
    { id: 'finance', style: 'trading', name: 'Finance Desk', hue: 44, tagline: 'Profit, fees and a tax pot from your store numbers.',
      mission: 'Keep track of how the business is really doing: profit after every cost, where money is leaking, and how much to put aside for tax. Not an accountant: flag anything that needs one.',
      brief: 'Give me this month’s profit picture and what to put aside for tax.',
      agents: [
        bot('Bookkeeper', 'Numbers', 'money', 'From the store data, lay out sales, production costs, Etsy fees, AI spend and profit. Show the working.', { store: true }),
        bot('Profit Analyst', 'Numbers', 'chart', 'Find which products make and lose money and where costs can be cut. Be specific.', { store: true }),
        bot('Tax Pot', 'Planning', 'cal', 'Estimate how much to put aside for UK income tax and National Insurance on this profit, with the assumptions written out. Say clearly that it is an estimate, not tax advice.', { web: true }),
      ] },
    { id: 'trading', style: 'trading', name: 'Trading Research', hue: 140, tagline: 'Market research and a paper-trade journal. No real trades.',
      mission: 'Research markets and keep a paper-trading journal to test ideas. This space never places real trades and is not financial advice.',
      brief: 'Give me a morning brief on my watchlist: AAPL, NVDA, MSFT, and the FTSE 100.',
      agents: [
        bot('Market Scanner', 'Research', 'chart', 'Search for the latest prices, moves and key levels for the watchlist. Give numbers with dates and sources.', { web: true }),
        bot('News Reader', 'Research', 'search', 'Find the news, earnings and events moving each item on the watchlist this week, with links.', { web: true }),
        bot('Analyst', 'Desk', 'flow', 'Write a balanced view on each item: bull case, bear case and what to watch. No hype.'),
        bot('Risk Officer', 'Desk', 'check', 'Point out the risks, what could go wrong and position-size limits for any idea. Remind that this is research, not advice.'),
        bot('Paper Trader', 'Journal', 'cal', 'Record any paper trades as a journal table (date, instrument, side, entry, stop, target, reason). Pretend money only, never real orders.', { memory: true }),
      ] },
    { id: 'support', style: 'office', name: 'Customer Service', hue: 24, tagline: 'Sorts customer messages and drafts the replies.',
      mission: 'Handle customer messages for the shop: work out what each one needs and draft a warm, fixed-it reply.',
      brief: 'Paste customer messages here and I will draft replies.',
      agents: [
        bot('Triage', 'Inbox', 'chat', 'Read each customer message in the brief and label it (where is my order, damaged, wrong item, question, review) with urgency.'),
        bot('Order Checker', 'Inbox', 'search', 'Match each message to the orders in the store data and pull out the status and tracking.', { store: true }),
        bot('Reply Writer', 'Replies', 'mail', 'Write a short, warm reply for each message with a clear fix. Never invent tracking numbers or dates.'),
        bot('Tone Check', 'Replies', 'check', 'Check every reply for tone, accuracy and Etsy rules. Output the final replies ready to copy.'),
      ] },
    { id: 'dev', style: 'station', name: 'Dev Team', hue: 200, tagline: 'Spec, build plan, code, tests and review.',
      mission: 'Turn an app or website idea into a clear spec, a build plan and working code with tests.',
      brief: 'A one-page booking site for a barber shop.',
      agents: [
        bot('Product Manager', 'Plan', 'flow', 'Write the spec: who it is for, user stories, must-haves vs nice-to-haves, and what done looks like.'),
        bot('Architect', 'Plan', 'grid', 'Choose the stack and structure: files, data, APIs and hosting, with reasons. Keep it simple.'),
        bot('Developer', 'Build', 'code', 'Write the code for the plan, file by file, in full. Use fenced code blocks with the filename above each.'),
        bot('Tester', 'Build', 'check', 'Write tests and a manual test checklist for the code. Point out bugs you can see.'),
        bot('Reviewer', 'Review', 'doc', 'Review everything for security, bugs and simplicity. List fixes in priority order.'),
      ] },
    { id: 'life', style: 'office', name: 'Life Admin', hue: 322, tagline: 'Plans, bookings, bills and to-dos sorted.',
      mission: 'Take everyday life admin off my plate: plans, research, bookings and lists.',
      brief: 'Plan a cheap day out with a 1-year-old near Cheshire this Saturday.',
      agents: [
        bot('Planner', 'Plan', 'cal', 'Break the request into a clear plan with times, steps and what to prepare.'),
        bot('Researcher', 'Plan', 'search', 'Look up the real places, prices, opening times and links needed for the plan.', { web: true }),
        bot('List Maker', 'Lists', 'lines', 'Turn it all into a final checklist and a short summary I can send to someone.'),
      ] },
    { id: 'product', style: 'workshop', name: 'Product Lab', hue: 30, tagline: 'New product ideas, checks and spec sheets.',
      mission: 'Come up with new products to sell, check there is real demand and write them up ready to make.',
      brief: 'New product ideas for my shirt shop beyond t-shirts.',
      agents: [
        bot('Idea Generator', 'Ideas', 'radar', 'Come up with 10 product ideas that fit the brief, each with who buys it and why.', { store: true }),
        bot('Demand Check', 'Ideas', 'search', 'Search for evidence of demand and competition for the best ideas. Keep the 3 strongest.', { web: true }),
        bot('Spec Writer', 'Spec', 'doc', 'Write a product spec for each of the 3: materials, sizes, price, cost, listing title and photos needed.'),
      ] },
  ];
  // quick hires for the built-in departments
  const QUICK = {
    store: [
      bot('SEO Checker', 'Hires', 'search', 'After each mission, check the new listings’ titles and tags against what buyers search on Etsy and suggest stronger keywords for each.', { store: true, web: true }),
      bot('Pricing Critic', 'Hires', 'money', 'After each mission, check the prices against similar Etsy shirts and the margins, and flag any that are too low or too high.', { store: true, web: true }),
      bot('Copy Editor', 'Hires', 'doc', 'After each mission, proofread the new listing titles and descriptions and list exact fixes.', { store: true }),
      bot('Trend Watcher', 'Hires', 'radar', 'Look for rising gift trends and holidays coming up that fit the shop and list 5 design ideas for the next mission.', { web: true }),
    ],
    marketing: [
      bot('Hashtag Researcher', 'Hires', 'search', 'After each campaign, find which hashtags and keywords are working now for these posts and suggest swaps.', { marketing: true, web: true }),
      bot('Brand Voice Checker', 'Hires', 'check', 'After each campaign, check every caption sounds like the brand and flag anything off.', { marketing: true }),
      bot('Ad Copywriter', 'Hires', 'lines', 'Write 3 paid-ad versions (headline, primary text, call to action) for the best products.', { store: true, marketing: true }),
      bot('Collab Scout', 'Hires', 'chat', 'Find the kinds of creators and accounts worth collaborating with for this niche, and draft a short outreach DM.', { web: true }),
    ],
    custom: [
      bot('Researcher', 'Research', 'search', 'Search the web for what the task needs and summarise it with sources.', { web: true }),
      bot('Writer', 'Writing', 'doc', 'Write the main output for the task clearly and completely.'),
      bot('Checker', 'Quality', 'check', 'Check the team’s work for mistakes and made-up facts and fix them.'),
      bot('Planner', 'Planning', 'flow', 'Break the task into a clear plan with steps and owners.'),
    ],
  };

  // ---------- state ----------
  function S() {
    const D = K.D;
    if (!D.spaces) D.spaces = {};
    const s = D.spaces;
    s.list = s.list || []; s.hires = s.hires || {}; s.hires.store = s.hires.store || []; s.hires.marketing = s.hires.marketing || []; s.notes = s.notes || {};
    for (const sp of s.list) { sp.agents = sp.agents || []; sp.runs = sp.runs || []; sp.auto = sp.auto || { on: false, hours: 24, last: 0 }; }
    return s;
  }
  const save = () => K.persist();
  const get = (id) => S().list.find((x) => x.id === id) || null;
  const roomOf = (sp) => (sp?.room && window.Rooms ? Rooms.get(sp.room) : null);
  const capOf = (d) => (d === 'store' || d === 'marketing' ? CAP[d] : roomOf(get(d))?.capacity || CAP.custom);
  // which room fits a request best (chat)
  function pickRoom(...txt) {
    const x = txt.join(' ').toLowerCase();
    const m = [['support', /customer service|call cent|support/], ['finance', /finance|tax|bookkeep|accounts/], ['music', /music|beats?|songs?|playlist|artist/], ['podcast', /podcast|episode|guest|interview|show notes/], ['video', /youtube|video|shorts|tiktok|film|script|thumbnail|content/], ['trading', /trad|stock|market|crypto|invest|finance|money|watchlist/], ['sales', /sales|lead|outreach|client|prospect|email|cold/], ['dev', /dev|code|app|website|software|build|program/], ['research', /research|report|study|analy|compare|fact/], ['support', /support|customer|call cent|service|complain|refund/], ['finance', /financ|tax|profit|account|book ?keep|vat/], ['music', /music|beat|song|release|playlist|artist|sinc/]];
    return (m.find(([, re]) => re.test(x)) || ['research'])[0];
  }
  const kindOf = (d) => (d === 'store' || d === 'marketing' ? d : get(d) ? 'custom' : null);
  const agentsIn = (d) => (d === 'store' || d === 'marketing' ? S().hires[d] : get(d)?.agents || []);
  function findAgent(id) {
    const s = S();
    for (const d of ['store', 'marketing']) { const a = s.hires[d].find((x) => x.id === id); if (a) return { a, d, kind: d }; }
    for (const sp of s.list) { const a = sp.agents.find((x) => x.id === id); if (a) return { a, d: sp.id, kind: 'custom', sp }; }
    return null;
  }
  const nameOf = (id) => findAgent(id)?.a.name || null;
  const cleanAgent = (a, kind) => ({
    id: a.id || 'sp.' + uid(), name: String(a.name || 'New bot').slice(0, 28), job: String(a.job || '').slice(0, 2000), team: String(a.team || (kind === 'custom' ? 'Team' : 'Hires')).slice(0, 18),
    model: K.MODEL_CHOICES.some((m) => m[0] === a.model) ? a.model : DEF_MODEL, icon: ICONS.includes(a.icon) ? a.icon : 'doc',
    tools: { web: !!a.tools?.web || a.web === true, store: !!a.tools?.store, marketing: !!a.tools?.marketing, memory: !!a.tools?.memory, email: !!a.tools?.email },
    approve: kind === 'custom' && !!a.approve, when: kind === 'custom' ? undefined : a.when === 'manual' ? 'manual' : 'after', feed: kind !== 'custom' && a.feed !== false,
    out: a.out || '', outAt: a.outAt || 0,
  });

  // ---------- floors ----------
  let floor = null, current = null;
  function syncFloors() {
    const s = S();
    Station.setHires(s.hires.store.map((h) => ({ id: h.id, name: h.name })));
    Office.setExtras(s.hires.marketing.map((h) => ({ id: h.id, name: h.name, icon: h.icon })));
    if (current && floor) {
      const sp = get(current);
      const agents = sp ? sp.agents.map((a) => ({ id: a.id, name: a.name, team: a.team, icon: a.icon })) : [];
      if (sp && roomOf(sp)) floor.configure({ room: roomOf(sp), agents, headers: headers(sp), media: wallMedia(sp) });
      else if (sp) floor.configure({ room: null, hue: sp.hue, style: sp.style || 'office', ticker: sp.style === 'trading' ? ticker(sp) : '', agents, headers: headers(sp), media: wallMedia(sp) });
    }
  }
  function ticker(sp) {
    const done = sp.runs.filter((r) => r.status === 'done');
    const bits = [`JOBS DONE ${done.length}`, `BOTS ${sp.agents.length}`, `SPEND TODAY ${K.usd(sp.agents.reduce((n, a) => n + K.costOf(a.id), 0))}`];
    for (const r of done.slice(-4).reverse()) bits.push('▲ ' + String(r.title || r.brief).toUpperCase().slice(0, 40));
    return bits.join('     ');
  }
  function headers(sp) {
    const done = sp.runs.filter((r) => r.status === 'done').length;
    return [`${sp.name} · ${sp.agents.length} bots · ${done} jobs done`, `Outputs · ${sp.runs.filter((r) => r.final).length}`];
  }
  const wallCache = new Map();
  function wallMedia(sp) {
    return sp.runs.filter((r) => r.final).slice(-18).reverse().map((r) => {
      if (!wallCache.has(r.id)) wallCache.set(r.id, { img: outputCard(sp, r), label: new Date(r.at).toLocaleDateString([], { day: 'numeric', month: 'short' }) });
      return wallCache.get(r.id);
    });
  }
  function outputCard(sp, r) {
    const c = document.createElement('canvas'); c.width = 360; c.height = 606;
    const x = c.getContext('2d'), h = sp.hue;
    const g = x.createLinearGradient(0, 0, 0, 606); g.addColorStop(0, `hsl(${h} 50% 14%)`); g.addColorStop(1, `hsl(${h} 60% 5%)`);
    x.fillStyle = g; x.fillRect(0, 0, 360, 606);
    x.fillStyle = `hsl(${h} 100% 70%)`; x.fillRect(0, 0, 360, 10);
    x.font = '700 30px Inter, sans-serif'; x.fillStyle = '#fff'; x.textBaseline = 'top';
    let y = 40;
    const wrapDraw = (text, font, color, lh, maxLines) => {
      x.font = font; x.fillStyle = color; const words = String(text).split(/\s+/); let line = '', n = 0;
      for (const w of words) { const t = line ? line + ' ' + w : w; if (x.measureText(t).width > 316 && line) { x.fillText(line, 22, y); y += lh; line = w; if (++n >= maxLines) return; } else line = t; }
      if (line && n < maxLines) { x.fillText(line, 22, y); y += lh; }
    };
    wrapDraw(r.title || r.brief, '700 30px Inter, sans-serif', '#fff', 36, 4);
    y += 14;
    const plain = String(r.final).replace(/[#*_`>|]/g, '').replace(/\[([^\]]+)\]\([^)]+\)/g, '$1').replace(/\n+/g, ' ');
    wrapDraw(plain.slice(0, 600), '400 19px Inter, sans-serif', `hsl(${h} 30% 82%)`, 26, 14);
    x.font = '600 16px Inter, sans-serif'; x.fillStyle = `hsl(${h} 100% 80%)`; x.fillText(`${r.steps.filter((s) => s.out).length} bots worked on this`, 22, 560);
    const img = new Image(); img.src = c.toDataURL('image/png'); return img;
  }

  // ---------- running a custom space ----------
  const runs = new Map(); // spaceId -> {run, stop:boolean}
  const waiting = new Map(); // stepKey -> resolve
  const reqs = new Set();
  const isRunning = (id) => runs.has(id);
  function dataBlock(a, sp) {
    const out = [];
    if (a.tools.store) out.push('STORE DATA (the Etsy shop in this app):\n' + K.storeSummary());
    if (a.tools.marketing && window.MK) out.push('MARKETING DATA:\n' + MK.summary());
    if (a.tools.memory && sp) { const prev = sp.runs.filter((r) => r.final && r.status === 'done').slice(-3); if (prev.length) out.push('PAST OUTPUTS FROM THIS SPACE:\n' + prev.map((r) => `[${new Date(r.at).toDateString()}] ${r.title}: ${r.final.slice(0, 1200)}`).join('\n---\n')); }
    return out.join('\n\n');
  }
  async function askBot(a, prompt, task, maxTokens = 6000, onCost) {
    const opt = { agent: a.id, task, model: a.model || DEF_MODEL, maxTokens, web: a.tools.web ? 5 : 0, onCost };
    try { return await K.ask(prompt, opt); }
    catch (e) {
      if (a.tools.web && /web_search|tool|server_tool/i.test(e.message) && !/ABORTED/.test(e.message)) {
        K.log(a.id, 'Web search isn’t switched on for your Claude account (Claude Console → Settings → Privacy / tools). Carrying on without it.', 'err');
        return K.ask(prompt + '\n\n(Web search is unavailable right now: work from what you know and say clearly what needs checking.)', { ...opt, web: 0 });
      }
      throw e;
    }
  }
  const roomCostToday = (sp) => sp.agents.reduce((n, a) => n + K.costOf(a.id), 0);
  const roomSound = (sp) => ({ sales: 'gong', trading: 'bell', podcast: 'chime', video: 'chime' }[sp.room] || 'chime');
  // a short line a bot says when it hands its work over
  function chatter(out, toName) {
    const line = String(out || '').split('\n').map((l) => l.replace(/^[#>*\-\d.\s|]+/, '').replace(/\*\*/g, '').trim()).find((l) => l.length > 8 && !/^[-|: ]+$/.test(l)) || '';
    const first = toName.split(' ')[0];
    return line ? (line.length > 34 ? line.slice(0, 33) + '…' : line) : `Over to you, ${first}`;
  }
  function parseEmails(text) {
    const m = String(text).match(/```json\s*([\s\S]*?)```\s*$/) || String(text).match(/```json\s*([\s\S]*?)```/);
    if (!m) return [];
    try { const j = JSON.parse(m[1]); return (j.emails || []).filter((e) => e && (e.subject || e.body)).slice(0, 25).map((e) => ({ to: String(e.to || '').trim(), subject: String(e.subject || '').slice(0, 200), body: String(e.body || ''), status: 'ready' })); } catch { return []; }
  }
  // what happens when a room finishes: hand on to another room, post to Slack/Discord, save a file, ping the phone
  async function afterSpaceRun(sp, run) {
    const text = `✅ ${sp.name}: ${run.title}\n\n${String(run.final).slice(0, 1400)}`;
    if (sp.hook && K.D.settings.webhook) kivo.hookPost({ url: K.D.settings.webhook, text }).then(() => K.log('ultron', `${sp.name}: posted the result to ${/slack/.test(K.D.settings.webhook) ? 'Slack' : 'Discord'}.`, 'ok')).catch((e) => K.log('ultron', 'Webhook failed: ' + K.cleanErr(e), 'err'));
    if (sp.saveDir) { const name = `${new Date(run.at).toISOString().slice(0, 10)} ${sp.name} - ${(run.title || 'output').replace(/[^\w &-]/g, '')}.md`; kivo.folderWrite({ dir: sp.saveDir, name, data: runMarkdown(sp, run) }).then((f) => K.log('ultron', `${sp.name}: saved ${f}`, 'ok')).catch((e) => K.log('ultron', 'Save failed: ' + K.cleanErr(e), 'err')); }
    window.EX?.phoneDone(sp, run);
    const nx = sp.next || {};
    if (!nx.to || (run.chain || 0) >= 3) return;
    const input = `Input from the ${sp.name} (${run.title}):\n${String(run.final).slice(0, 6000)}`;
    if (nx.to === 'store') {
      const brief = `Design ideas based on this work from ${sp.name}: ${String(run.final).replace(/\s+/g, ' ').slice(0, 1200)}`;
      if (nx.mode === 'auto') { K.log('ultron', `${sp.name} → Store: starting a mission from the result.`, 'ok'); K.startMission?.(brief); }
      else { K.setStoreBrief?.(brief); K.log('ultron', `${sp.name} → Store: the result is waiting as the next mission brief.`, 'ok'); }
      return;
    }
    const tgt = get(nx.to); if (!tgt || tgt.id === sp.id) return;
    const brief = `${input}\n\nWhat to do with it: ${tgt.brief || tgt.mission}`;
    if (nx.mode === 'auto' && !isRunning(tgt.id)) {
      K.log('ultron', `${sp.name} → ${tgt.name}: handing the result over and starting.`, 'ok');
      const before = tgt.runs.length; runSpace(tgt.id, brief).then(() => {}); const r = tgt.runs[before]; if (r) r.chain = (run.chain || 0) + 1;
    } else { tgt.pendingInput = { from: sp.name, text: brief, at: Date.now() }; save(); K.log('ultron', `${sp.name} → ${tgt.name}: result waiting as its next brief.`, 'ok'); renderAll(); }
  }
  const runMarkdown = (sp, r) => `# ${r.title || r.brief}\n\n_${sp.name} · ${new Date(r.at).toLocaleString()}_\n\n**Brief:** ${r.brief}\n\n${r.final}\n\n---\n\n` + r.steps.filter((x) => x.out).map((x) => `## ${x.name}\n\n${x.out}`).join('\n\n');
  async function sendEmail(sp, run, i) {
    const e = run.outbox?.[i]; if (!e || e.status === 'sent') return;
    try { const r = await kivo.mailSend({ to: e.to, subject: e.subject, text: e.body }); e.status = 'sent'; e.sentAt = Date.now(); e.preview = !!r.preview; K.log('ultron', `${sp.name}: email ${r.preview ? 'previewed (not sent)' : 'sent'} to ${e.to}`, 'ok'); }
    catch (err) { e.status = 'failed'; e.error = K.cleanErr(err); K.log('ultron', `Email to ${e.to || '(no address)'} failed: ${e.error}`, 'err'); }
    save(); renderAll();
  }
  async function sendAll(sp, run) { for (let i = 0; i < (run.outbox || []).length; i++) if (run.outbox[i].status !== 'sent' && run.outbox[i].to) await sendEmail(sp, run, i); }
  const BASE_RULES = 'Write in clear Markdown with headings and lists where useful. Be concrete and complete, no preamble or sign-off. British English. Never invent facts, names, numbers or links: if something needs checking, say so.';
  async function runSpace(id, brief) {
    const sp = get(id); if (!sp) return;
    if (!K.keys.anthropic) { K.toast('Add your Anthropic API key first.', true); return; }
    if (isRunning(id)) { K.toast(`${sp.name} is already working.`, true); return; }
    if (!sp.agents.length) { K.toast('Hire at least one bot into this space first.', true); openHire(id); return; }
    brief = String(brief || sp.brief || sp.mission || '').trim();
    if (sp.pendingInput) delete sp.pendingInput;
    if (!brief) { K.toast('Write a brief first.', true); return; }
    const run = { id: uid(), at: Date.now(), brief, status: 'running', steps: [], cost: 0, title: '' };
    sp.runs.push(run); if (sp.runs.length > 40) sp.runs.splice(0, sp.runs.length - 40);
    const ctl = { run, stop: false }; runs.set(id, ctl);
    const addCost = (c) => { run.cost += c; };
    const check = () => { if (ctl.stop) throw new Error('ABORTED'); };
    renderAll();
    try {
      K.setAgent('ultron', 'WORKING', `Planning · ${sp.name}`);
      K.log('ultron', `${sp.name}: "${brief}" · ${sp.agents.length} bots`);
      const roster = sp.agents.map((a) => `- ${a.id} · ${a.name} (${a.team}): ${a.job}${a.tools.web ? ' [has web search]' : ''}`).join('\n');
      let plan = {};
      try {
        plan = await K.askJSON(`You are ULTRON, Chief of Staff of the "${sp.name}" space in Kivo Ultron. Space purpose: ${sp.mission || 'whatever the owner asks'}.
Today is ${new Date().toDateString()}.
Owner's brief: ${brief}
Your team works in this order, each seeing the work before it:
${roster}
Give each bot one specific instruction for this brief (what exactly to produce). Skip a bot only if it truly has nothing to do for this brief.
Reply with JSON only: {"title": "short title for this job (max 8 words)", "tasks": {"<bot id>": "instruction"}, "skip": ["bot ids to skip"]}`, { agent: 'ultron', task: `Planning · ${sp.name}`, maxTokens: 1500, onCost: addCost });
      } catch (e) { if (K.fatal(e)) throw e; K.log('ultron', 'Plan came back unreadable, so every bot works straight from the brief.', 'err'); }
      run.title = String(plan.title || brief).slice(0, 80);
      K.log('ultron', `${sp.name}: ${run.title}`, 'ok'); K.setAgent('ultron', 'IDLE'); check();
      const skip = new Set(Array.isArray(plan.skip) ? plan.skip : []);
      const team = sp.agents.filter((a) => !skip.has(a.id));
      if (!team.length) team.push(...sp.agents);
      let prev = 'ultron';
      for (const a of team) {
        check();
        if (sp.budget > 0 && roomCostToday(sp) >= sp.budget) throw new Error(`Daily budget of $${sp.budget} reached for ${sp.name}. Raise it in EDIT ROOM or try tomorrow.`);
        const task = String(plan.tasks?.[a.id] || a.job);
        const step = { agent: a.id, name: a.name, task, out: '', status: 'working', at: Date.now(), cost: 0 };
        const prevStep = run.steps[run.steps.length - 1];
        run.steps.push(step); renderAll();
        floor?.packet(prev, a.id, null, prevStep ? chatter(prevStep.out, a.name) : ''); prev = a.id;
        let note = '';
        for (let attempt = 0; ; attempt++) {
          K.setAgent(a.id, 'WORKING', attempt ? 'Redoing with your note' : task.slice(0, 60));
          const before = run.steps.filter((x) => x !== step && x.out);
          const ctx = before.map((x, i) => `### ${x.name}\n${i >= before.length - 3 ? x.out.slice(0, 5000) : x.out.slice(0, 700) + (x.out.length > 700 ? '…' : '')}`).join('\n\n');
          const data = dataBlock(a, sp);
          const prompt = `You are ${a.name}, a bot in the "${sp.name}" space of Kivo Ultron (an AI team app). Today is ${new Date().toDateString()}.
Space purpose: ${sp.mission || 'help the owner with this brief'}
Your job: ${a.job}
The owner's brief: ${brief}
Your instruction from ULTRON for this job: ${task}
${data ? '\n' + data + '\n' : ''}${ctx ? `\nWork from the team so far (build on it, don't repeat it):\n${ctx}\n` : ''}${note ? `\nThe owner reviewed your last attempt and asked for this change: ${note}\nYour last attempt:\n${step.out.slice(0, 4000)}\n` : ''}
${a.tools.web ? 'You can search the web: use it for anything current, and link your sources.' : 'You have no internet access in this job.'}
${a.tools.email ? 'You can send emails, but only after the owner approves them. End your reply with the emails to send as a fenced json block: ```json\n{"emails": [{"to": "address", "subject": "...", "body": "plain text"}]}\n``` Only use email addresses that appear in the work above or the brief; if you have no address, leave "to" empty. Never invent addresses.' : ''}
${BASE_RULES}`;
          const t0 = run.cost;
          step.out = (await askBot(a, prompt, task.slice(0, 60), 6000, addCost)).trim();
          step.cost += run.cost - t0;
          a.out = step.out; a.outAt = Date.now();
          if (a.tools.email) { const em = parseEmails(step.out); if (em.length) { run.outbox = em; step.out = step.out.replace(/```json[\s\S]*?```\s*$/, '').trim() + `\n\n(${em.length} email${em.length > 1 ? 's' : ''} ready in the outbox below.)`; } }
          K.log(a.id, `Done: ${step.out.split('\n').find((l) => l.trim())?.replace(/^#+\s*/, '').slice(0, 120) || 'finished'}`, 'ok');
          if (!a.approve) break;
          step.status = 'waiting'; run.status = 'waiting'; K.setAgent(a.id, 'IDLE'); save(); renderAll();
          K.notify(`${sp.name}: ${a.name} needs you`, 'Approve or send it back with a note.');
          window.EX?.askApproval(sp, run, step);
          const ans = await new Promise((res) => waiting.set(run.id + ':' + a.id, res));
          waiting.delete(run.id + ':' + a.id);
          run.status = 'running';
          if (ans.action === 'stop') { ctl.stop = true; check(); }
          if (ans.action === 'approve') break;
          note = String(ans.note || 'Make it better.');
        }
        step.status = 'done'; K.setAgent(a.id, 'IDLE'); save(); renderAll();
      }
      floor?.packet(prev, 'ultron');
      const last = [...run.steps].reverse().find((x) => x.out);
      run.final = last?.out || ''; run.status = 'done';
      const sum = `${run.title} · ${team.length} bots · ${K.usd(run.cost)}`;
      K.log('ultron', `${sp.name} finished: ${sum}`, 'ok'); K.toast(`${sp.name} finished · ${run.title}`); K.notify(`${sp.name} finished`, run.title);
      window.EX?.sound(roomSound(sp));
      setTimeout(() => afterSpaceRun(sp, run), 0);
    } catch (e) {
      run.status = e.message === 'ABORTED' ? 'stopped' : 'failed'; run.error = e.message === 'ABORTED' ? 'Stopped' : e.message;
      for (const st of run.steps) if (st.status !== 'done') st.status = st.out ? 'done' : 'failed';
      const last = [...run.steps].reverse().find((x) => x.out); if (last) run.final = last.out;
      K.log('ultron', `${sp.name} ${run.status === 'stopped' ? 'stopped' : 'failed: ' + e.message}`, 'err');
      if (run.status === 'failed') K.toast(e.message, true);
    } finally {
      runs.delete(id);
      for (const a of sp.agents) if (K.agentState[a.id]?.status === 'WORKING') K.setAgent(a.id, 'IDLE');
      if (K.agentState.ultron?.status === 'WORKING' && !K.busyElsewhere()) K.setAgent('ultron', 'IDLE');
      save(); syncFloors(); renderAll();
    }
  }
  function stopSpace(id) {
    const c = runs.get(id); if (!c) return;
    c.stop = true;
    K.cancelAgents(['ultron', ...(get(id)?.agents || []).map((a) => a.id)]);
    for (const [k, res] of waiting) if (k.startsWith(c.run.id + ':')) res({ action: 'stop' });
    K.toast('Stopping…');
  }
  function answer(runId, agentId, action, note) { const r = waiting.get(runId + ':' + agentId); if (r) r({ action, note }); }

  // ---------- hires in Store / Marketing ----------
  const hireBusy = new Set();
  async function runHire(a, d, context, extra) {
    if (hireBusy.has(a.id)) return;
    hireBusy.add(a.id);
    try {
      K.setAgent(a.id, 'WORKING', extra ? 'On your request' : 'Reviewing the latest run');
      const data = dataBlock(a, null);
      const prompt = `You are ${a.name}, a bot hired into the ${d.toUpperCase()} department of Kivo Ultron (an app that runs an Etsy print-on-demand shirt shop).
${K.shopContext()}
Your job: ${a.job}
${context ? 'What just happened:\n' + context + '\n' : ''}${extra ? 'The owner asked you: ' + extra + '\n' : ''}${data ? '\n' + data + '\n' : ''}
${a.tools.web ? 'You can search the web: use it for anything current, and link your sources.' : ''}
Give short, specific, useful notes the owner and the rest of the crew can act on (max ~300 words). ${BASE_RULES}`;
      a.out = (await askBot(a, prompt, extra ? 'On your request' : 'Reviewing the latest run', 3000)).trim(); a.outAt = Date.now();
      const notes = S().notes[d] = S().notes[d] || [];
      notes.push({ agent: a.id, name: a.name, at: a.outAt, text: a.out }); if (notes.length > 40) notes.splice(0, notes.length - 40);
      K.log(a.id, a.out.split('\n').find((l) => l.trim())?.replace(/^#+\s*/, '').slice(0, 140) || 'Notes ready', 'ok');
      K.setAgent(a.id, 'IDLE');
    } catch (e) {
      K.setAgent(a.id, 'IDLE', '', e.message !== 'ABORTED');
      if (e.message !== 'ABORTED') K.log(a.id, 'Failed: ' + e.message, 'err');
    } finally { hireBusy.delete(a.id); save(); K.feedTouch?.(a.id); }
  }
  async function afterRun(d, context) {
    for (const a of S().hires[d] || []) if (a.when !== 'manual') await runHire(a, d, context);
  }
  // fed into the store and marketing prompts so hires actually change what the crew does
  function crewNotes(d) {
    const hs = (S().hires[d] || []).filter((a) => a.feed && a.out);
    if (!hs.length) return '';
    return `\nNotes from bots the owner hired into ${d} (use them where they help):\n` + hs.slice(0, 4).map((a) => `- ${a.name}: ${a.out.replace(/\s+/g, ' ').slice(0, 500)}`).join('\n');
  }

  // ---------- autopilot ----------
  function autoTick() {
    if (!K.keys.anthropic) return;
    for (const sp of S().list) {
      if (!sp.auto?.on || isRunning(sp.id) || !sp.agents.length) continue;
      if (window.EX && !EX.pro && S().list.indexOf(sp) > 0) continue;
      if (Date.now() - (sp.auto.last || 0) < Math.max(1, sp.auto.hours) * HOUR) continue;
      sp.auto.last = Date.now(); save();
      K.log('ultron', `${sp.name} autopilot: starting a run.`);
      runSpace(sp.id, sp.brief || sp.mission);
    }
  }

  // ---------- markdown (safe: builds DOM, never innerHTML) ----------
  function inline(parent, text) {
    const re = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\((https?:\/\/[^)\s]+)\))/g;
    let i = 0, m;
    while ((m = re.exec(text))) {
      if (m.index > i) parent.append(text.slice(i, m.index));
      const t = m[0];
      if (t.startsWith('**')) parent.append(el('b', '', t.slice(2, -2)));
      else if (t.startsWith('`')) parent.append(el('code', '', t.slice(1, -1)));
      else { const a = el('a', 'mdlink', t.slice(1, t.indexOf(']('))); a.href = '#'; a.title = m[2]; a.onclick = (e) => { e.preventDefault(); kivo.openUrl(m[2]); }; parent.append(a); }
      i = m.index + t.length;
    }
    if (i < text.length) parent.append(text.slice(i));
  }
  function md(text) {
    const root = el('div', 'md');
    const lines = String(text || '').split('\n');
    let list = null, code = null, table = null;
    const flush = () => { list = null; table = null; };
    for (const raw of lines) {
      if (/^```/.test(raw.trim())) { if (code) { code = null; } else { flush(); code = el('pre', 'md-code'); root.append(code); } continue; }
      if (code) { code.textContent += raw + '\n'; continue; }
      const line = raw.trimEnd();
      if (!line.trim()) { flush(); continue; }
      let m;
      if ((m = line.match(/^(#{1,4})\s+(.*)/))) { flush(); const h = el('div', 'md-h' + m[1].length); inline(h, m[2]); root.append(h); continue; }
      if (/^\s*\|.*\|\s*$/.test(line)) {
        if (/^\s*\|[\s:|-]+\|\s*$/.test(line)) continue;
        if (!table) { table = el('table', 'md-table'); root.append(table); }
        const tr = el('tr'); for (const c of line.trim().slice(1, -1).split('|')) { const td = el(table.rows.length ? 'td' : 'th'); inline(td, c.trim()); tr.append(td); } table.append(tr); continue;
      }
      if ((m = line.match(/^\s*(?:[-*•]|\d+[.)])\s+(.*)/))) { table = null; if (!list) { list = el('ul', 'md-ul'); root.append(list); } const li = el('li'); inline(li, m[1]); list.append(li); continue; }
      flush(); const p = el('p'); inline(p, line.replace(/^>\s?/, '')); root.append(p);
    }
    return root;
  }

  // ---------- UI: dept tabs ----------
  const MAX_TABS = 2;
  function renderTabs() {
    const nav = $('#depts'); if (!nav) return;
    nav.querySelectorAll('.dept.sp, .dept.more').forEach((b) => b.remove());
    const add = $('#dept-add'), list = S().list, cur = K.dept();
    const shown = list.filter((sp) => sp.id === cur);
    for (const sp of list) if (shown.length < MAX_TABS && !shown.includes(sp)) shown.push(sp);
    shown.sort((x, y) => list.indexOf(x) - list.indexOf(y));
    for (const sp of shown) {
      const b = el('button', 'dept sp' + (cur === sp.id ? ' on' : ''), sp.name.toUpperCase());
      b.dataset.dept = sp.id; b.style.setProperty('--sp', `hsl(${sp.hue} 100% 70%)`);
      if (isRunning(sp.id)) b.classList.add('busy');
      b.onclick = () => K.setDept(sp.id);
      nav.insertBefore(b, add);
    }
    const rest = list.filter((sp) => !shown.includes(sp));
    if (rest.length) {
      const m = el('button', 'dept more' + (rest.some((sp) => isRunning(sp.id)) ? ' busy' : ''), `+${rest.length} MORE ▾`);
      m.title = rest.map((sp) => sp.name).join(', ');
      m.onclick = (e) => { e.stopPropagation(); toggleMenu(m, rest); };
      nav.insertBefore(m, add);
    }
  }
  function toggleMenu(anchor, rest) {
    let menu = $('#dept-menu');
    if (menu) { menu.remove(); return; }
    menu = el('div', 'dept-menu metal'); menu.id = 'dept-menu';
    for (const sp of rest) {
      const b = el('button', 'dept-mi'); b.style.setProperty('--sp', `hsl(${sp.hue} 100% 70%)`);
      b.append(el('i'), el('b', '', sp.name), el('span', '', `${sp.agents.length} bots${isRunning(sp.id) ? ' · working' : ''}`));
      b.onclick = () => { menu.remove(); K.setDept(sp.id); };
      menu.append(b);
    }
    const n = el('button', 'dept-mi new', '+ NEW SPACE'); n.onclick = () => { menu.remove(); openBuilder(null); }; menu.append(n);
    const r = anchor.getBoundingClientRect();
    menu.style.left = Math.round(r.left) + 'px'; menu.style.top = Math.round(r.bottom + 4) + 'px';
    document.body.append(menu);
    setTimeout(() => document.addEventListener('mousedown', function off(e) { if (!menu.contains(e.target)) { menu.remove(); document.removeEventListener('mousedown', off); } }), 0);
  }

  // ---------- UI: switching to a custom space ----------
  function show(id) {
    current = id;
    const sp = get(id);
    if (!sp) { if (floor) floor.show(false); $('#spacefloor').hidden = true; document.body.style.removeProperty('--accent'); document.body.style.removeProperty('--accent-dim'); document.body.style.removeProperty('--accent-glow'); return; }
    if (!floor) { floor = OfficeKit.create({ zones: [], agents: [], hue: sp.hue, chiefIdle: 'Waiting for a brief' }); floor.init($('#spacefloor'), onFloorClick); }
    $('#spacefloor').hidden = false; floor.show(true);
    document.body.style.setProperty('--accent', `hsl(${sp.hue} 100% 70%)`);
    document.body.style.setProperty('--accent-dim', `hsl(${sp.hue} 60% 32%)`);
    document.body.style.setProperty('--accent-glow', `hsl(${sp.hue} 100% 65% / .4)`);
    syncFloors();
    $('#sp-brief').value = sp.brief || '';
    renderAll();
    requestAnimationFrame(() => floor.relayout());
  }
  function hideCustom() { show(null); }
  function onFloorClick(id) { if (id === 'hire') { openHire(current); return; } K.selectAgent(id); }
  const focus = (id) => floor?.focus(id);
  function setBusy(id, busy, text, err) {
    const f = findAgent(id);
    if (id === 'ultron') { floor?.setBusy('ultron', busy, text, err); return; }
    if (!f) return;
    if (f.kind === 'store') Station.setBusy(id, busy, text, err);
    else if (f.kind === 'marketing') Office.setBusy(id, busy, text, err);
    else if (current === f.d) floor?.setBusy(id, busy, text, err);
    if (f.kind === 'custom') { renderTabs(); if (current === f.d && !raf) raf = requestAnimationFrame(() => { raf = 0; renderAll(); }); }
  }
  let raf = 0;

  // ---------- UI: commander pane, readouts, terminal ----------
  function renderCmd() {
    const sp = get(current); if (!sp) return;
    const r = runs.get(sp.id);
    $('#cmd-k1').textContent = 'JOBS DONE'; $('#cmd-template').textContent = String(sp.runs.filter((x) => x.status === 'done').length);
    $('#cmd-k2').textContent = 'STATUS'; $('#cmd-mode').textContent = r ? (r.run.status === 'waiting' ? 'NEEDS YOU' : 'WORKING') : sp.auto.on ? `AUTO · ${sp.auto.hours}H` : 'READY';
  }
  let tab = 'outputs', openRun = null;
  function renderAll() {
    renderTabs();
    const sp = current && get(current);
    if (!sp) return;
    const r = runs.get(sp.id);
    const waitingSteps = sp.runs.flatMap((x) => x.steps.filter((s) => s.status === 'waiting').map((s) => ({ run: x, step: s })));
    $('#sp-ro-runs').textContent = sp.runs.filter((x) => x.status === 'done').length;
    $('#sp-ro-bots').textContent = sp.agents.length;
    $('#sp-ro-wait').textContent = waitingSteps.length;
    $('#sp-ro-cost').textContent = K.usd(sp.agents.reduce((n, a) => n + K.costOf(a.id), 0));
    $('#sp-name').textContent = sp.name.toUpperCase();
    $('#sp-mission').textContent = sp.mission || 'No purpose written yet. Click EDIT SPACE to add one.';
    const b = $('#sp-run');
    b.classList.toggle('stop', !!r); b.textContent = r ? '■ STOP' : '▶ RUN';
    const workingA = sp.agents.find((a) => K.agentState[a.id]?.status === 'WORKING');
    $('#sp-status').textContent = r ? (r.run.status === 'waiting' ? 'Waiting for your approval' : workingA ? `${workingA.name}: ${K.agentState[workingA.id].text || 'working'}` : 'ULTRON is planning') + ` · ${r.run.steps.filter((s) => s.status === 'done').length}/${sp.agents.length} done` : `${sp.agents.length} bots run in order, each building on the last`;
    $('#sp-auto').checked = !!sp.auto.on; $('#sp-hours').value = sp.auto.hours;
    $('#sp-auto-desc').textContent = sp.auto.on ? `On · runs the brief every ${sp.auto.hours}h` : 'Off';
    renderNeeds(sp, waitingSteps);
    renderTerminal(sp, waitingSteps);
    if (K.dept() === sp.id) renderCmd();
    K.checkTerm?.();
  }
  function renderNeeds(sp, waitingSteps) {
    const box = $('#sp-needs'); box.textContent = '';
    const add = (level, text, label, fn) => { const r = el('div', 'need ' + level); r.append(el('span', 'led ' + (level === 'warn' ? 'busy' : level === 'good' ? 'on' : '')), el('span', 'nt', text)); if (fn) r.append(btn(label, fn, 'mini')); box.append(r); };
    if (!K.keys.anthropic) add('bad', 'Add your Claude key so the bots can work.', 'SETTINGS', () => $('#btn-settings').click());
    if (!sp.agents.length) add('warn', 'No bots yet. Hire your first one, or let ULTRON design the team.', '+ HIRE', () => openHire(sp.id));
    for (const w of waitingSteps.slice(0, 2)) add('warn', `${w.step.name} is waiting for your OK.`, 'REVIEW', () => { tab = 'outputs'; openRun = w.run.id; renderAll(); });
    if (sp.pendingInput) add('warn', `New input from ${sp.pendingInput.from} is waiting.`, 'USE IT', () => { $('#sp-brief').value = sp.pendingInput.text; sp.brief = sp.pendingInput.text; delete sp.pendingInput; save(); renderAll(); });
    if (sp.budget > 0) add(roomCostToday(sp) >= sp.budget ? 'bad' : '', `Budget: ${K.usd(roomCostToday(sp))} of $${sp.budget} used today.`);
    if (sp.agents.some((a) => a.tools.web)) add('', 'Some bots search the web (about 1p per search, on your Claude bill).');
    if (!box.childNodes.length) add('good', 'Ready. Write a brief and press Run.');
  }
  function renderTerminal(sp, waitingSteps) {
    $$('#sp-tabs .tab').forEach((t) => t.classList.toggle('on', t.dataset.sp === tab));
    const wt = $('#sp-tabs [data-sp="outputs"]'); wt.textContent = waitingSteps.length ? `OUTPUTS · ${waitingSteps.length} WAITING` : 'OUTPUTS';
    const body = $('#sp-body'); const keep = body.scrollTop; body.textContent = '';
    if (tab === 'team') viewTeam(body, sp); else viewOutputs(body, sp);
    body.scrollTop = keep;
  }
  function viewOutputs(body, sp) {
    if (!sp.runs.length) { const e = el('div', 'empty'); e.append(el('b', '', 'NO OUTPUTS YET'), el('div', '', 'Write a brief in the ULTRON panel and press Run. Each bot’s work and the finished result land here.')); body.append(e); return; }
    const list = el('div', 'sp-runs');
    for (const r of [...sp.runs].reverse()) {
      const open = openRun === r.id || (openRun == null && r === sp.runs[sp.runs.length - 1]);
      const card = el('div', 'sp-run ' + r.status + (open ? ' open' : ''));
      const head = el('button', 'sp-run-head');
      head.append(el('span', 'pill ' + ({ done: 'pass', failed: 'fail', stopped: '', running: 'medium', waiting: 'medium' }[r.status] || ''), r.status.toUpperCase()), el('b', '', r.title || r.brief), el('span', 'dim', `${new Date(r.at).toLocaleString([], { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${K.usd(r.cost || 0)}`));
      head.onclick = () => { openRun = open ? '' : r.id; renderAll(); };
      card.append(head);
      if (open) {
        const inner = el('div', 'sp-run-body');
        inner.append(el('div', 'tiny dim', 'Brief: ' + r.brief));
        if (r.error && r.status === 'failed') inner.append(el('div', 'issue', r.error));
        if (r.final) {
          const fin = el('div', 'sp-final'); fin.append(el('div', 'lbl', 'RESULT'), md(r.final));
          const acts = el('div', 'row wrap');
          acts.append(btn('COPY', () => { navigator.clipboard.writeText(r.final); K.toast('Copied'); }, 'mini'), btn('SAVE .MD', () => exportRun(sp, r), 'mini'), btn('RUN AGAIN', () => runSpace(sp.id, r.brief), 'mini'));
          fin.append(acts); inner.append(fin);
        }
        if (r.outbox?.length) {
          const ob = el('div', 'sp-outbox'); ob.append(el('div', 'lbl', `OUTBOX · ${r.outbox.filter((e) => e.status === 'sent').length}/${r.outbox.length} SENT`));
          r.outbox.forEach((e, i) => {
            const row = el('div', 'ob-row ' + e.status);
            const to = el('input'); to.value = e.to; to.placeholder = 'add an email address'; to.onchange = () => { e.to = to.value.trim(); save(); };
            const b = el('details'); const sm = el('summary'); sm.append(el('b', '', e.subject || '(no subject)')); b.append(sm, el('pre', 'ob-body', e.body));
            row.append(to, b, el('span', 'pill ' + (e.status === 'sent' ? 'pass' : e.status === 'failed' ? 'fail' : ''), e.status === 'sent' ? (e.preview ? 'PREVIEWED' : 'SENT') : e.status.toUpperCase()));
            if (e.status !== 'sent') row.append(btn('SEND', () => sendEmail(sp, r, i), 'mini go'));
            if (e.error) row.append(el('div', 'tiny err', e.error));
            ob.append(row);
          });
          const left = r.outbox.filter((e) => e.status !== 'sent');
          if (left.length) ob.append(window.EX?.mailOn ? btn(`SEND ALL ${left.filter((e) => e.to).length}`, () => sendAll(sp, r), 'go') : btn('SET UP EMAIL IN SETTINGS', () => window.EX?.openSettings('mail'), ''));
          inner.append(ob);
        }
        for (const s of r.steps) {
          const d = el('details', 'sp-step ' + s.status); if (s.status === 'waiting') d.open = true;
          const sm = el('summary'); sm.append(el('span', 'led ' + (s.status === 'done' ? 'on' : s.status === 'failed' ? 'err' : 'busy')), el('b', '', s.name), el('span', 'dim', s.task.slice(0, 120)));
          d.append(sm);
          if (s.out) d.append(md(s.out));
          if (s.status === 'waiting') {
            const note = el('textarea'); note.rows = 2; note.placeholder = 'What should change? (only needed for Redo)';
            const row = el('div', 'row wrap');
            row.append(btn('APPROVE', () => answer(r.id, s.agent, 'approve'), 'go'), btn('REDO WITH NOTE', () => answer(r.id, s.agent, 'redo', note.value.trim() || 'Make it better.')), btn('STOP RUN', () => answer(r.id, s.agent, 'stop'), 'danger'));
            d.append(el('div', 'lbl', 'YOUR CALL'), note, row);
          }
          inner.append(d);
        }
        card.append(inner);
      }
      list.append(card);
    }
    body.append(list);
  }
  function viewTeam(body, sp) {
    const bar = el('div', 'mk-bar');
    bar.append(btn('+ HIRE A BOT', () => openHire(sp.id), 'go'), btn('EDIT SPACE', () => openBuilder(sp.id)), btn('EXPORT SPACE', () => exportSpace(sp)), el('span', 'tiny dim', `${sp.agents.length}/${capOf(sp.id)} desks · bots run top to bottom`));
    body.append(bar);
    const grid = el('div', 'sp-team');
    sp.agents.forEach((a, i) => {
      const c = el('div', 'sp-bot');
      const h = el('div', 'sp-bot-h'); h.append(el('span', 'led ' + (K.agentState[a.id]?.status === 'WORKING' ? 'busy' : 'on')), el('b', '', `${i + 1}. ${a.name}`), el('span', 'pill', a.team.toUpperCase()));
      c.append(h, el('div', 'sp-job', a.job));
      const pills = el('div', 'pill-row'); pills.append(el('span', 'pill', MODEL_SHORT[a.model] || a.model)); for (const [k, v] of Object.entries(a.tools)) if (v) pills.append(el('span', 'pill pass', TOOL_NAMES[k])); if (a.approve) pills.append(el('span', 'pill medium', 'YOU APPROVE'));
      pills.append(el('span', 'dim tiny', `${K.usd(K.costOf(a.id))} today · ${K.usd(K.costOf(a.id, 'all'))} all time`));
      c.append(pills);
      const row = el('div', 'row');
      row.append(btn('↑', () => move(sp, i, -1), 'mini'), btn('↓', () => move(sp, i, 1), 'mini'), btn('EDIT', () => openHire(sp.id, a.id), 'mini'), btn('WATCH', () => K.selectAgent(a.id), 'mini'));
      c.append(row);
      grid.append(c);
    });
    body.append(grid);
  }
  function move(sp, i, dir) { const j = i + dir; if (j < 0 || j >= sp.agents.length) return; [sp.agents[i], sp.agents[j]] = [sp.agents[j], sp.agents[i]]; save(); syncFloors(); renderAll(); K.renderRoster(); }

  // ---------- roster + feed ----------
  function renderRoster(ul) {
    const sp = get(current); if (!sp) return;
    const row = (id, name, role, teamCost) => {
      const s = K.agentState[id] || { status: K.keys.anthropic ? 'IDLE' : 'OFFLINE' };
      const li = el('li', (s.status === 'WORKING' ? 'busy ' : '') + (K.feedAgent === id ? 'sel' : ''));
      li.append(el('span', 'led ' + (s.err ? 'err' : s.status === 'WORKING' ? 'busy' : 'on')), el('span', 'nm', name.toUpperCase()), el('span', 'st', s.err ? 'FAULT' : s.status || 'IDLE'));
      li.append(el('span', 'rl', s.status === 'WORKING' && s.text ? s.text : role));
      if (teamCost != null) li.append(el('span', 'cost', teamCost));
      li.onclick = () => K.selectAgent(id); ul.append(li);
    };
    ul.append(el('li', 'zone-h', 'CHIEF OF STAFF'));
    row('ultron', 'ULTRON', 'Plans each job and hands out the work');
    let team = '';
    for (const a of sp.agents) {
      if (a.team !== team) { team = a.team; ul.append(el('li', 'zone-h', team.toUpperCase())); }
      row(a.id, a.name, a.job.slice(0, 80), `${MODEL_SHORT[a.model] || ''} · ${K.usd(K.costOf(a.id))} today`);
    }
    const add = el('li', 'add-hire'); add.append(el('span', 'nm', '+ HIRE A BOT')); add.onclick = () => openHire(sp.id); ul.append(add);
  }
  function rosterHires(ul, d) {
    const hs = S().hires[d] || [];
    ul.append(el('li', 'zone-h', `NEW HIRES · ${hs.length}/${CAP[d]}`));
    for (const a of hs) {
      const s = K.agentState[a.id] || { status: K.keys.anthropic ? 'IDLE' : 'OFFLINE' };
      const li = el('li', (s.status === 'WORKING' ? 'busy ' : '') + (K.feedAgent === a.id ? 'sel' : ''));
      li.append(el('span', 'led ' + (s.err ? 'err' : s.status === 'WORKING' ? 'busy' : 'on')), el('span', 'nm', a.name.toUpperCase()), el('span', 'st', s.err ? 'FAULT' : s.status || 'IDLE'));
      li.append(el('span', 'rl', s.status === 'WORKING' && s.text ? s.text : a.job.slice(0, 80)), el('span', 'cost', `${MODEL_SHORT[a.model] || ''} · ${K.usd(K.costOf(a.id))} today`));
      li.onclick = () => K.selectAgent(a.id); ul.append(li);
    }
    if (hs.length < CAP[d]) { const add = el('li', 'add-hire'); add.append(el('span', 'nm', '+ HIRE A BOT')); add.onclick = () => openHire(d); ul.append(add); }
  }
  function renderFeed(box, id, live, full) {
    if (id === 'ultron') return chiefFeed(box, full);
    const f = findAgent(id); if (!f) { box.hidden = true; return; }
    const a = f.a, stt = K.agentState[id] || {};
    const hue = f.sp ? f.sp.hue : f.kind === 'marketing' ? 262 : 150;
    if (full || box.dataset.agent !== id) {
      box.dataset.agent = id; box.hidden = false; box.textContent = ''; box.style.setProperty('--agent', `hsl(${hue} 100% 70%)`);
      const head = el('div', 'feed-head'); head.append(el('span', 'led'), el('b', '', a.name.toUpperCase()), el('span', 'feed-role', a.team));
      const sel = el('select', 'feed-model'); for (const [mid, n, d] of K.MODEL_CHOICES) { const o = el('option', '', `${n} · ${d}`); o.value = mid; sel.append(o); }
      sel.value = a.model; sel.onchange = () => { a.model = sel.value; save(); K.log(a.id, `Now running on ${K.modelName(a.model)}.`, 'ok'); K.renderRoster(); };
      head.append(sel);
      const x = el('button', 'wc close', '✕'); x.onclick = () => K.selectAgent(null); head.append(x);
      box.append(head, el('div', 'feed-cost'), el('div', 'feed-now'), el('div', 'sp-feed-job'));
      const acts = el('div', 'row wrap sp-feed-acts');
      if (f.kind !== 'custom') {
        const ask = el('input'); ask.placeholder = 'Ask this bot something (optional)…'; ask.className = 'sp-ask';
        acts.append(ask, btn('RUN NOW', () => runHire(a, f.d, '', ask.value.trim()), 'go mini'));
      }
      acts.append(btn('EDIT BOT', () => openHire(f.d, a.id), 'mini'));
      box.append(acts, el('div', 'lbl', 'LIVE OUTPUT'), el('pre', 'feed-term'), el('div', 'lbl', 'LAST RESULT'), el('div', 'sp-feed-last'), el('div', 'lbl', 'RECENT'), el('div', 'feed-recent'));
    }
    const working = stt.status === 'WORKING';
    box.querySelector('.feed-head .led').className = 'led ' + (stt.err ? 'err' : working ? 'busy' : 'on');
    const t = K.D.cost?.today?.[id], al = K.D.cost?.all?.[id];
    box.querySelector('.feed-cost').textContent = `COST TODAY ${K.usd(t?.usd || 0)} · ${t?.calls || 0} calls   ·   ALL TIME ${K.usd(al?.usd || 0)}`;
    box.querySelector('.feed-now').textContent = working ? '▶ ' + (stt.text || 'Working') + (live?.search ? ` · searching “${live.search}”` : '') : 'Idle. ' + (f.kind === 'custom' ? 'Works when the space runs.' : a.when === 'manual' ? 'Works when you press Run now.' : `Works after every ${f.d === 'store' ? 'mission' : 'campaign'}${a.feed ? ' and its notes feed into the next one' : ''}.`);
    const job = box.querySelector('.sp-feed-job'); job.textContent = '';
    job.append(el('span', 'dim', 'JOB '), a.job);
    const tools = Object.entries(a.tools).filter(([, v]) => v).map(([k]) => TOOL_NAMES[k]);
    if (tools.length) job.append(el('span', 'dim', '  ·  TOOLS '), tools.join(', '));
    const term = box.querySelector('.feed-term'); const txt = live?.busy ? live.text || '' : '';
    term.textContent = txt ? (txt.length > 2200 ? '…' + txt.slice(-2200) : txt) + '▌' : working ? (live?.search ? `Searching the web: “${live.search}”…` : 'Thinking…') : 'Output streams here live while this bot works.';
    term.classList.toggle('busy', !!live?.busy); term.scrollTop = term.scrollHeight;
    const lastBox = box.querySelector('.sp-feed-last');
    if (lastBox.dataset.at !== String(a.outAt)) { lastBox.dataset.at = String(a.outAt); lastBox.textContent = ''; lastBox.append(a.out ? md(a.out) : el('div', 'tiny dim', 'Nothing yet.')); }
    const rec = box.querySelector('.feed-recent'); rec.textContent = '';
    for (const l of K.D.log.filter((x) => x.agent === id).slice(-5).reverse()) { const r = el('div', 'ln ' + l.kind); r.append(el('span', 't', K.stamp(l.ts) + ' '), el('span', 'm', l.msg)); rec.append(r); }
    if (!rec.childNodes.length) rec.append(el('div', 'tiny dim', 'No activity yet.'));
  }
  function chiefFeed(box, full) {
    const sp = get(current); if (!sp) return;
    if (full || box.dataset.agent !== 'ultron') {
      box.dataset.agent = 'ultron'; box.hidden = false; box.textContent = ''; box.style.setProperty('--agent', `hsl(${sp.hue} 100% 70%)`);
      const head = el('div', 'feed-head'); head.append(el('span', 'led on'), el('b', '', 'ULTRON'), el('span', 'feed-role', 'Chief of Staff · ' + sp.name));
      const x = el('button', 'wc close', '✕'); x.onclick = () => K.selectAgent(null); head.append(x);
      box.append(head, el('div', 'feed-now'), el('div', 'feed-widget'));
    }
    const r = runs.get(sp.id)?.run || sp.runs[sp.runs.length - 1];
    box.querySelector('.feed-now').textContent = runs.get(sp.id) ? '▶ Running: ' + (r.title || r.brief) : 'Idle. Give the team a brief and press Run.';
    const w = box.querySelector('.feed-widget'); w.textContent = '';
    if (r) { const pl = el('div', 'plan'); pl.append(el('b', '', String(r.title || 'LAST JOB').toUpperCase()), el('div', '', r.brief)); w.append(pl); }
    const grid = el('div', 'crewgrid');
    for (const a of sp.agents) {
      const st = K.agentState[a.id] || {}, step = r?.steps.find((s) => s.agent === a.id);
      const c = el('button', 'crew ' + (st.status === 'WORKING' ? 'busy' : ''));
      c.append(el('span', 'led ' + (st.status === 'WORKING' ? 'busy' : step?.status === 'done' ? 'on' : '')), el('b', '', a.name), el('span', '', st.status === 'WORKING' ? st.text : step ? step.status : 'idle'));
      c.onclick = () => K.selectAgent(a.id); grid.append(c);
    }
    w.append(grid);
  }

  // ---------- hire dialog ----------
  let hireCtx = null;
  function openHire(d, agentId) {
    const kind = kindOf(d); if (!kind) return;
    const list = agentsIn(d), editing = agentId ? list.find((a) => a.id === agentId) : null;
    if (!editing && list.length >= capOf(d)) { K.toast(kind === 'custom' ? `Every desk in this room is taken (${capOf(d)}). Add another room for more bots.` : `The ${d} floor has ${CAP[kind]} desks for new hires and they’re all taken.`, true); return; }
    hireCtx = { d, kind, id: agentId || null };
    const a = editing || { name: '', team: kind === 'custom' ? (list[list.length - 1]?.team || 'Team') : 'Hires', job: '', model: DEF_MODEL, icon: 'doc', tools: {}, approve: false, when: 'after', feed: true };
    $('#hire-title').textContent = editing ? `EDIT ${a.name.toUpperCase()}` : `HIRE INTO ${(kind === 'custom' ? get(d).name : d).toUpperCase()}`;
    $('#hire-name').value = a.name; $('#hire-team').value = a.team; $('#hire-job').value = a.job;
    fillModels($('#hire-model'), a.model);
    const ic = $('#hire-icon'); ic.textContent = ''; for (const i of ICONS) { const o = el('option', '', i); o.value = i; ic.append(o); } ic.value = a.icon;
    for (const k of Object.keys(TOOL_NAMES)) $('#hire-t-' + k).checked = !!a.tools?.[k];
    $('#hire-approve').checked = !!a.approve; $('#hire-when').value = a.when || 'after'; $('#hire-feed').checked = a.feed !== false;
    $('#hire-team-f').hidden = kind !== 'custom'; $('#hire-approve-l').hidden = kind !== 'custom'; $('#hire-when-f').hidden = kind === 'custom'; $('#hire-feed-l').hidden = kind === 'custom';
    $('#hire-del').hidden = !editing;
    $('#hire-desc').value = ''; $('#hire-msg').textContent = '';
    const q = $('#hire-quick'); q.textContent = '';
    if (!editing) for (const p of QUICK[kind]) { const b = el('button', 'chip', p.name); b.onclick = () => fillHire(p); q.append(b); }
    $('#hire-quick-l').hidden = !!editing;
    $('#sp-hire').hidden = false; setTimeout(() => (editing ? $('#hire-job') : $('#hire-desc')).focus(), 50);
  }
  function fillHire(p) {
    $('#hire-name').value = p.name || ''; if (p.team) $('#hire-team').value = p.team; $('#hire-job').value = p.job || '';
    if (ICONS.includes(p.icon)) $('#hire-icon').value = p.icon;
    for (const k of Object.keys(TOOL_NAMES)) $('#hire-t-' + k).checked = !!p.tools?.[k];
    if (p.approve != null) $('#hire-approve').checked = !!p.approve;
  }
  function fillModels(sel, v) { sel.textContent = ''; for (const [mid, n, d] of K.MODEL_CHOICES) { const o = el('option', '', `${n} · ${d}`); o.value = mid; sel.append(o); } sel.value = v || DEF_MODEL; }
  async function designOne() {
    const desc = $('#hire-desc').value.trim(); if (!desc) { $('#hire-desc').focus(); return; }
    $('#hire-msg').textContent = 'ULTRON is writing the job…'; $('#hire-ai').disabled = true;
    try {
      const where = hireCtx.kind === 'custom' ? `the "${get(hireCtx.d).name}" space (purpose: ${get(hireCtx.d).mission || 'general'})` : `the ${hireCtx.d} department of an Etsy print-on-demand shirt shop app`;
      const r = await designBots(desc, 1, where, hireCtx.kind);
      if (r[0]) fillHire(r[0]);
      $('#hire-msg').textContent = 'Check it over, then press Hire.';
    } catch (e) { $('#hire-msg').textContent = e.message; }
    $('#hire-ai').disabled = false;
  }
  async function designBots(desc, n, where, kind) {
    const tools = kind === 'custom' ? 'web (web search), memory (sees this space’s past outputs), store (the shop’s data), marketing (social posts data)' : 'web (web search), store (the shop’s products, orders and sales), marketing (the social posts and their stats)';
    const r = await K.askJSON(`You design AI bots for Kivo Ultron, an app where teams of Claude-powered bots do work. Design ${n} bot(s) for ${where}.
What the owner wants: ${desc}
${kind === 'custom' ? 'Bots in a space run in order, each seeing the work before it, so order them sensibly (research first, writing next, checking last).' : 'These bots review each run of the department and leave notes for the owner and crew.'}
Each bot needs: a short name (max 3 words), a team (one word like Research, Writing, Quality), a job (2-3 sentences: exactly what it produces, in the second person isn't needed — just describe the job), an icon from [${ICONS.join(', ')}], and which tools it needs from: ${tools}. Bots can only think, write and use those tools: never promise actions like sending emails or placing orders.
Reply with JSON only: {"bots": [{"name": "...", "team": "...", "job": "...", "icon": "...", "tools": {"web": false, "memory": false, "store": false, "marketing": false}}]}`, { agent: 'ultron', task: 'Designing bots', maxTokens: 2500 });
    return (r.bots || r.agents || []).slice(0, n);
  }
  function saveHire() {
    const { d, kind, id } = hireCtx; const list = agentsIn(d);
    const raw = {
      id: id || undefined, name: $('#hire-name').value.trim(), team: $('#hire-team').value.trim(), job: $('#hire-job').value.trim(), model: $('#hire-model').value, icon: $('#hire-icon').value,
      tools: Object.fromEntries(Object.keys(TOOL_NAMES).map((k) => [k, $('#hire-t-' + k).checked])), approve: $('#hire-approve').checked, when: $('#hire-when').value, feed: $('#hire-feed').checked,
    };
    if (!raw.name) { $('#hire-msg').textContent = 'Give the bot a name.'; return; }
    if (!raw.job) { $('#hire-msg').textContent = 'Describe the job, or type what you need above and press Write it for me.'; return; }
    const old = id && list.find((a) => a.id === id);
    const a = cleanAgent({ ...(old || {}), ...raw }, kind);
    if (old) Object.assign(old, a); else list.push(a);
    K.agentState[a.id] = K.agentState[a.id] || { status: K.keys.anthropic ? 'IDLE' : 'OFFLINE' };
    save(); closeHire(); syncFloors(); renderAll(); K.renderRoster();
    if (!old) { K.log(a.id, `Hired into ${kind === 'custom' ? get(d).name : d}: ${a.job.slice(0, 120)}`, 'ok'); K.toast(`${a.name} hired`); }
  }
  function deleteHire() {
    const { d, id } = hireCtx; const list = agentsIn(d); const i = list.findIndex((a) => a.id === id);
    if (i < 0) return;
    if (!confirm(`Let ${list[i].name} go?`)) return;
    const [gone] = list.splice(i, 1);
    if (K.feedAgent === gone.id) K.selectAgent(null);
    save(); closeHire(); syncFloors(); renderAll(); K.renderRoster(); K.toast(`${gone.name} removed`);
  }
  function closeHire() { $('#sp-hire').hidden = true; hireCtx = null; }

  // ---------- space builder ----------
  let bctx = null;
  function addRoom(rid, name, mission) {
    const rm = Rooms.get(rid) || Rooms.get('research');
    let nm = String(name || rm.name).slice(0, 24); while (S().list.some((x) => x.name === nm)) nm = (nm + ' 2').slice(0, 24);
    const agents = Rooms.crew(rm.id).map((b) => cleanAgent(b, 'custom'));
    const sp = { id: 's_' + uid(), name: nm, room: rm.id, hue: rm.hue, mission: String(mission || rm.mission), brief: rm.brief, agents, runs: [], auto: { on: false, hours: 24, last: 0 }, createdAt: Date.now(), template: rm.id };
    S().list.push(sp); save();
    for (const x of agents) K.agentState[x.id] = { status: K.keys.anthropic ? 'IDLE' : 'OFFLINE' };
    K.log('ultron', `New room: ${sp.name} with ${agents.length} bots.`, 'ok');
    return sp;
  }
  const previews = new Map();
  function roomPreview(rm) {
    if (previews.has(rm.id)) return previews.get(rm.id);
    const f = OfficeKit.create({ chiefIdle: 'Ready' });
    f.configure({ room: rm, agents: rm.crew.map((b, i) => ({ id: 'pv' + i, name: b.name, team: b.team, icon: b.icon })), headers: [rm.name, ''] });
    const url = f.snapshot(480, 280); previews.set(rm.id, url); return url;
  }
  function openBuilder(id) {
    if (!id && window.EX && !EX.allow('room')) return;
    const sp = id ? get(id) : null, roomMode = !sp || !!sp.room;
    bctx = { id: sp?.id || null, hue: sp?.hue ?? 188, style: sp?.style || 'office', room: sp?.room || null, template: null, agents: sp ? sp.agents.map((a) => ({ ...a, tools: { ...a.tools } })) : [] };
    $('#sb-title').textContent = sp ? `EDIT ${sp.name.toUpperCase()}` : 'ADD A ROOM';
    $('#sb-name').value = sp?.name || ''; $('#sb-mission').value = sp?.mission || ''; $('#sb-brief').value = sp?.brief || '';
    $('#sb-del').hidden = !sp; $('#sb-export').hidden = !sp; $('#sb-tpl-l').hidden = !!sp; $('#sb-tpls').hidden = !!sp; $('#sb-msg').textContent = '';
    for (const sel of ['#sb-style-f', '#sb-hues-f', '#sb-n', '#sb-ai', '#sb-addbot']) $(sel).hidden = roomMode;
    $('#sb-team-l').textContent = roomMode ? 'THE CREW · RUNS TOP TO BOTTOM · HIRE MORE FROM THE ROOM' : 'THE TEAM · RUNS TOP TO BOTTOM';
    $('#sb-save').textContent = sp ? 'SAVE' : 'ADD ROOM';
    const g = $('#sb-tpls'); g.textContent = ''; g.className = 'room-grid';
    if (!sp) {
      for (const rm of Rooms.list()) {
        const b = el('button', 'room-card'); b.dataset.room = rm.id; b.style.setProperty('--sp', `hsl(${rm.hue} 100% 70%)`);
        const im = el('img'); im.alt = rm.name; im.src = roomPreview(rm);
        b.append(im, el('b', '', rm.name), el('span', '', rm.tagline), el('i', '', `${rm.crew.length} bots · ${rm.capacity} desks`));
        b.onclick = () => { $$('#sb-tpls .room-card').forEach((x) => x.classList.toggle('on', x === b)); chooseRoom(rm); };
        g.append(b);
      }
      g.querySelector('.room-card').click();
    }
    const ss = $('#sb-style'); ss.textContent = ''; for (const [v, n] of Object.entries(OfficeKit.STYLES)) { const o = el('option', '', n); o.value = v; ss.append(o); } ss.value = bctx.style; ss.onchange = () => (bctx.style = ss.value);
    renderHues(); renderBuilderBots();
    // when a job finishes
    bctx.next = { ...(sp?.next || {}) }; bctx.hook = !!sp?.hook; bctx.saveDir = sp?.saveDir || ''; bctx.budget = sp?.budget || 0;
    const nx = $('#sb-next'); nx.textContent = '';
    for (const [v, n] of [['', 'Nobody'], ['store', 'Store (as a design brief)'], ...S().list.filter((x) => x.id !== sp?.id).map((x) => [x.id, x.name])]) { const o = el('option', '', n); o.value = v; nx.append(o); }
    nx.value = bctx.next.to || ''; $('#sb-next-mode').value = bctx.next.mode || 'brief';
    $('#sb-budget').value = bctx.budget; $('#sb-hook').checked = bctx.hook; $('#sb-dir').textContent = bctx.saveDir || 'not saving';
    $('#sb-hook').disabled = !K.D.settings.webhook; $('#sb-hook').parentElement.title = K.D.settings.webhook ? '' : 'Add a Slack or Discord webhook in Settings first';
    $('#sp-builder').hidden = false; setTimeout(() => $('#sb-name').focus(), 50);
  }
  function chooseRoom(rm) {
    bctx.room = rm.id; bctx.hue = rm.hue; bctx.template = rm.id;
    $('#sb-name').value = rm.name; $('#sb-mission').value = rm.mission; $('#sb-brief').value = rm.brief;
    bctx.agents = Rooms.crew(rm.id).map((a) => cleanAgent(a, 'custom'));
    renderBuilderBots();
  }
  function pickTemplate(t) {
    bctx.template = t.id; bctx.hue = t.hue; bctx.style = t.style || 'office'; $('#sb-style').value = bctx.style;
    if (t.id !== 'blank') { $('#sb-name').value = t.name; $('#sb-mission').value = t.mission; $('#sb-brief').value = t.brief; }
    bctx.agents = t.agents.map((a) => cleanAgent({ ...a, model: a.tools?.web ? DEF_MODEL : a.model }, 'custom'));
    renderHues(); renderBuilderBots();
  }
  function renderHues() {
    const box = $('#sb-hues'); box.textContent = '';
    for (const [n, h] of HUES) { const b = el('button', 'hue' + (bctx.hue === h ? ' on' : '')); b.title = n; b.style.setProperty('--h', `hsl(${h} 100% 66%)`); b.onclick = () => { bctx.hue = h; renderHues(); }; box.append(b); }
  }
  function renderBuilderBots() {
    const box = $('#sb-bots'); box.textContent = '';
    const cap = bctx.room ? Rooms.get(bctx.room).capacity : CAP.custom;
    $('#sb-count').textContent = `${bctx.agents.length}/${cap}`;
    if (!bctx.agents.length) box.append(el('div', 'tiny dim', 'No bots yet. Pick a template, press Design the team, or add bots after you create the space.'));
    bctx.agents.forEach((a, i) => {
      const r = el('div', 'sb-bot');
      const name = el('input'); name.value = a.name; name.oninput = () => (a.name = name.value);
      const team = el('input'); team.value = a.team; team.oninput = () => (a.team = team.value);
      const job = el('textarea'); job.rows = 2; job.value = a.job; job.oninput = () => (a.job = job.value);
      const model = el('select'); fillModels(model, a.model); model.onchange = () => (a.model = model.value);
      const tools = el('div', 'sb-tools');
      for (const k of Object.keys(TOOL_NAMES)) { const l = el('label', 'chk'); const c = el('input'); c.type = 'checkbox'; c.checked = !!a.tools[k]; c.onchange = () => (a.tools[k] = c.checked); l.append(c, ' ' + TOOL_NAMES[k]); tools.append(l); }
      const ap = el('label', 'chk'); const apc = el('input'); apc.type = 'checkbox'; apc.checked = !!a.approve; apc.onchange = () => (a.approve = apc.checked); ap.append(apc, ' I approve its work'); tools.append(ap);
      const ctl = el('div', 'sb-ctl');
      ctl.append(btn('↑', () => { if (i) { [bctx.agents[i - 1], bctx.agents[i]] = [bctx.agents[i], bctx.agents[i - 1]]; renderBuilderBots(); } }, 'mini'), btn('↓', () => { if (i < bctx.agents.length - 1) { [bctx.agents[i + 1], bctx.agents[i]] = [bctx.agents[i], bctx.agents[i + 1]]; renderBuilderBots(); } }, 'mini'), btn('✕', () => { bctx.agents.splice(i, 1); renderBuilderBots(); }, 'mini danger'));
      const top = el('div', 'sb-top'); top.append(el('span', 'sb-n', String(i + 1)), name, team, model, ctl);
      r.append(top, job, tools); box.append(r);
    });
  }
  async function designTeam() {
    const mission = $('#sb-mission').value.trim() || $('#sb-name').value.trim();
    if (!mission) { $('#sb-msg').textContent = 'Write what this space is for first.'; $('#sb-mission').focus(); return; }
    const n = Math.max(2, Math.min(8, +$('#sb-n').value || 4));
    $('#sb-msg').textContent = `ULTRON is designing ${n} bots…`; $('#sb-ai').disabled = true;
    try {
      const bots = await designBots(mission, n, `a space called "${$('#sb-name').value.trim() || 'New space'}"`, 'custom');
      bctx.agents = bots.map((b) => cleanAgent(b, 'custom'));
      $('#sb-msg').textContent = `${bctx.agents.length} bots designed. Edit anything, then save.`; renderBuilderBots();
    } catch (e) { $('#sb-msg').textContent = e.message; }
    $('#sb-ai').disabled = false;
  }
  function saveBuilder() {
    const name = $('#sb-name').value.trim();
    if (!name) { $('#sb-msg').textContent = 'Give the space a name.'; $('#sb-name').focus(); return; }
    if (['STORE', 'MARKETING'].includes(name.toUpperCase())) { $('#sb-msg').textContent = 'That name is taken by a built-in department.'; return; }
    const cap = bctx.room ? Rooms.get(bctx.room).capacity : CAP.custom;
    const agents = bctx.agents.filter((a) => a.name.trim() && a.job.trim()).slice(0, cap).map((a) => cleanAgent(a, 'custom'));
    let sp = bctx.id && get(bctx.id);
    const after = { next: { to: $('#sb-next').value, mode: $('#sb-next-mode').value }, hook: $('#sb-hook').checked, saveDir: bctx.saveDir || '', budget: Math.max(0, +$('#sb-budget').value || 0) };
    if (sp) Object.assign(sp, after, { name: name.slice(0, 24), hue: bctx.hue, style: bctx.style, mission: $('#sb-mission').value.trim(), brief: $('#sb-brief').value.trim(), agents });
    else { sp = { id: 's_' + uid(), name: name.slice(0, 24), room: bctx.room || undefined, hue: bctx.hue, style: bctx.style, mission: $('#sb-mission').value.trim(), brief: $('#sb-brief').value.trim(), agents, runs: [], auto: { on: false, hours: 24, last: 0 }, createdAt: Date.now(), template: bctx.template }; S().list.push(sp); K.log('ultron', `New space: ${sp.name} with ${agents.length} bots.`, 'ok'); }
    Object.assign(sp, after);
    for (const a of agents) K.agentState[a.id] = K.agentState[a.id] || { status: K.keys.anthropic ? 'IDLE' : 'OFFLINE' };
    save(); $('#sp-builder').hidden = true;
    K.setDept(sp.id);
  }
  function deleteSpace() {
    const sp = get(bctx.id); if (!sp) return;
    if (isRunning(sp.id)) { $('#sb-msg').textContent = 'Stop it running first.'; return; }
    if (!confirm(`Delete the ${sp.name} space and its ${sp.runs.length} outputs? This can’t be undone. (Export it first if you might want it back.)`)) return;
    S().list.splice(S().list.indexOf(sp), 1); save(); $('#sp-builder').hidden = true; K.setDept('store'); K.toast(`${sp.name} deleted`);
  }

  // ---------- import / export ----------
  const portable = (a) => ({ name: a.name, team: a.team, job: a.job, model: a.model, icon: a.icon, tools: a.tools, approve: a.approve || undefined, when: a.when, feed: a.feed });
  function exportSpace(sp) {
    const data = { kivo: 'space', v: 1, name: sp.name, room: sp.room, hue: sp.hue, style: sp.style, mission: sp.mission, brief: sp.brief, agents: sp.agents.map(portable) };
    kivo.saveFile({ name: sp.name.replace(/[^\w -]/g, '') + '.kivo-space.json', data: JSON.stringify(data, null, 2), filters: [{ name: 'Kivo space', extensions: ['json'] }] }).then((f) => f && K.toast('Saved ' + f));
  }
  function exportHires(d) {
    const data = { kivo: 'hires', v: 1, target: d, agents: S().hires[d].map(portable) };
    kivo.saveFile({ name: `${d}-hires.kivo-space.json`, data: JSON.stringify(data, null, 2), filters: [{ name: 'Kivo space', extensions: ['json'] }] }).then((f) => f && K.toast('Saved ' + f));
  }
  function exportRun(sp, r) {
    const text = `# ${r.title || r.brief}\n\n_${sp.name} · ${new Date(r.at).toLocaleString()}_\n\n**Brief:** ${r.brief}\n\n${r.final}\n\n---\n\n` + r.steps.filter((s) => s.out).map((s) => `## ${s.name}\n\n${s.out}`).join('\n\n');
    kivo.saveFile({ name: (r.title || 'output').replace(/[^\w -]/g, '').slice(0, 60) + '.md', data: text, filters: [{ name: 'Markdown', extensions: ['md'] }] }).then((f) => f && K.toast('Saved ' + f));
  }
  async function importFile() {
    let f;
    try { f = await kivo.openFile(); } catch (e) { K.toast(K.cleanErr(e), true); return; }
    if (!f) return;
    let j; try { j = JSON.parse(f.text); } catch { K.toast('That file isn’t a Kivo space.', true); return; }
    const agents = Array.isArray(j.agents) ? j.agents : [];
    if (j.kivo === 'hires' && (j.target === 'store' || j.target === 'marketing')) {
      const list = S().hires[j.target], room = CAP[j.target] - list.length;
      const add = agents.slice(0, Math.max(0, room)).map((a) => cleanAgent(a, j.target)); list.push(...add);
      save(); syncFloors(); K.renderRoster(); K.toast(`${add.length} bots hired into ${j.target}` + (agents.length > add.length ? ` · ${agents.length - add.length} didn’t fit` : ''));
      $('#sp-builder').hidden = true; K.setDept(j.target); return;
    }
    if (j.kivo !== 'space' || !j.name) { K.toast('That file isn’t a Kivo space.', true); return; }
    let name = String(j.name).slice(0, 24); while (S().list.some((s) => s.name === name)) name = (name + ' 2').slice(0, 24);
    const sp = { id: 's_' + uid(), name, room: Rooms.get(j.room) ? j.room : undefined, hue: Number(j.hue) || 188, style: OfficeKit.STYLES[j.style] ? j.style : 'office', mission: String(j.mission || ''), brief: String(j.brief || ''), agents: agents.slice(0, Rooms.get(j.room)?.capacity || CAP.custom).map((a) => cleanAgent(a, 'custom')), runs: [], auto: { on: false, hours: 24, last: 0 }, createdAt: Date.now(), template: 'import' };
    S().list.push(sp); save(); $('#sp-builder').hidden = true; K.toast(`Imported ${sp.name} · ${sp.agents.length} bots`); K.setDept(sp.id);
  }

  // ---------- ULTRON chat ----------
  function summary() {
    const s = S();
    const sp = s.list.map((x) => `"${x.name}" (${x.agents.length} bots: ${x.agents.map((a) => a.name).join(', ') || 'none'}; ${isRunning(x.id) ? 'running now' : 'idle'}; purpose: ${(x.mission || '').slice(0, 120)})`).join('; ');
    return `Custom spaces: ${sp || 'none yet'}. Rooms you can add: ${Rooms.list().map((r) => r.id + ' (' + r.name + ')').join(', ')}. Hired bots: store ${s.hires.store.length}/${CAP.store} (${s.hires.store.map((a) => a.name).join(', ') || 'none'}), marketing ${s.hires.marketing.length}/${CAP.marketing} (${s.hires.marketing.map((a) => a.name).join(', ') || 'none'}). The owner is looking at: ${get(K.dept())?.name || K.dept()}.`;
  }
  function resolveSpace(v) {
    const x = String(v || '').toLowerCase().trim();
    if (!x || x === 'current' || x === 'here' || x === 'this') return K.dept();
    if (/^store|shop|etsy/.test(x)) return 'store';
    if (/^market|social/.test(x)) return 'marketing';
    const sp = S().list.find((s) => s.name.toLowerCase() === x) || S().list.find((s) => s.name.toLowerCase().includes(x) || x.includes(s.name.toLowerCase()));
    return sp?.id || null;
  }
  async function chatAction(a, note) {
    if (a.type === 'hire') {
      const d = resolveSpace(a.space || a.department || a.where) || K.dept(), kind = kindOf(d);
      if (!kind) return note('▶ Couldn’t find that space: ' + (a.space || ''));
      const list = agentsIn(d), room = capOf(d) - list.length;
      if (room <= 0) return note(`▶ ${kind === 'custom' ? get(d).name : d} is full (${capOf(d)} desks).`);
      let bots = Array.isArray(a.agents || a.bots) ? (a.agents || a.bots) : [];
      const n = Math.max(1, Math.min(room, Number(a.count) || bots.length || 1));
      if (!bots.length || bots.some((b) => !b.job)) {
        note(`▶ Designing ${n} bot${n > 1 ? 's' : ''} for ${kind === 'custom' ? get(d).name : d}…`);
        const where = kind === 'custom' ? `the "${get(d).name}" space (purpose: ${get(d).mission || 'general'})` : `the ${d} department of an Etsy print-on-demand shirt shop app`;
        bots = await designBots(String(a.brief || a.role || a.description || bots.map((b) => b.name).join(', ') || 'useful helpers'), n, where, kind);
      }
      const add = bots.slice(0, n).map((b) => cleanAgent(b, kind)); list.push(...add);
      for (const b of add) K.agentState[b.id] = { status: K.keys.anthropic ? 'IDLE' : 'OFFLINE' };
      save(); syncFloors(); renderAll(); K.renderRoster();
      note(`▶ Hired ${add.map((b) => b.name).join(', ')} into ${kind === 'custom' ? get(d).name : d}`);
      if (K.dept() !== d) K.setDept(d);
      return 'hire';
    }
    if (a.type === 'newspace') {
      if (window.EX && !EX.allow('room')) return note('▶ Adding more rooms needs Kivo Ultron Pro.');
      const rid = Rooms.get(String(a.room || a.template || '').toLowerCase())?.id || pickRoom(a.room || '', a.template || '', a.name || '', a.mission || '', a.brief || '');
      const sp = addRoom(rid, a.name, a.mission || a.brief);
      note(`▶ Added the ${sp.name} room with ${sp.agents.length} bots`);
      K.setDept(sp.id);
      return 'newspace';
    }
    if (a.type === 'runspace') {
      const d = resolveSpace(a.space || a.name); const sp = get(d);
      if (!sp) return note('▶ Couldn’t find that space: ' + (a.space || a.name || ''));
      note(`▶ ${sp.name} started`); K.setDept(sp.id);
      runSpace(sp.id, String(a.brief || sp.brief || sp.mission));
      return 'runspace';
    }
  }

  // ---------- wiring ----------
  function init() {
    S();
    $('#dept-add').onclick = () => openBuilder(null);
    $('#sp-run').onclick = () => { const sp = get(current); if (!sp) return; if (isRunning(sp.id)) stopSpace(sp.id); else { sp.brief = $('#sp-brief').value.trim(); save(); runSpace(sp.id, sp.brief); } };
    $('#sp-brief').onchange = () => { const sp = get(current); if (sp) { sp.brief = $('#sp-brief').value.trim(); save(); } };
    $('#sp-hire-btn').onclick = () => openHire(current);
    $('#sp-edit-btn').onclick = () => openBuilder(current);
    $('#sp-auto').onchange = () => { const sp = get(current); if (!sp) return; sp.auto.on = $('#sp-auto').checked; if (sp.auto.on && !sp.auto.last) sp.auto.last = Date.now(); save(); renderAll(); };
    $('#sp-hours').onchange = () => { const sp = get(current); if (!sp) return; sp.auto.hours = Math.max(1, +$('#sp-hours').value || 24); save(); renderAll(); };
    $$('#sp-tabs .tab').forEach((t) => (t.onclick = () => { tab = t.dataset.sp; renderAll(); }));
    $('#hire-close').onclick = closeHire; $('#hire-save').onclick = saveHire; $('#hire-del').onclick = deleteHire; $('#hire-ai').onclick = designOne;
    $('#hire-desc').onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); designOne(); } };
    $('#sb-close').onclick = () => ($('#sp-builder').hidden = true);
    $('#sb-dir-btn').onclick = async () => { const d = await kivo.folderPick({ title: 'Save this room’s results to…' }); if (d) { bctx.saveDir = d; $('#sb-dir').textContent = d; } };
    $('#sb-save').onclick = saveBuilder; $('#sb-del').onclick = deleteSpace; $('#sb-ai').onclick = designTeam; $('#sb-import').onclick = importFile;
    $('#sb-export').onclick = () => { const sp = get(bctx.id); if (sp) exportSpace(sp); };
    $('#sb-addbot').onclick = () => { if (bctx.agents.length >= CAP.custom) return; bctx.agents.push(cleanAgent({ name: 'New bot', team: bctx.agents[bctx.agents.length - 1]?.team || 'Team', job: '' }, 'custom')); renderBuilderBots(); };
    for (const o of ['#sp-hire', '#sp-builder']) $(o).addEventListener('mousedown', (e) => { if (e.target === $(o)) $(o).hidden = true; });
    for (const sp of S().list) for (const a of sp.agents) K.agentState[a.id] = { status: K.keys.anthropic ? 'IDLE' : 'OFFLINE' };
    for (const d of ['store', 'marketing']) for (const a of S().hires[d]) K.agentState[a.id] = { status: K.keys.anthropic ? 'IDLE' : 'OFFLINE' };
    // runs that were mid-flight when the app closed
    for (const sp of S().list) for (const r of sp.runs) if (r.status === 'running' || r.status === 'waiting') { r.status = 'stopped'; r.error = 'App closed mid-run'; for (const s of r.steps) if (s.status !== 'done') s.status = s.out ? 'done' : 'failed'; }
    syncFloors(); renderTabs();
    setInterval(autoTick, 60e3);
  }

  window.SP = {
    init, renderCmd, answer, sendAll, roomCostToday, get, kindOf, findAgent, nameOf, show, hideCustom, focus, setBusy, renderAll, renderTabs, renderRoster, rosterHires, renderFeed,
    openHire, openBuilder, exportHires, importFile, runSpace, stopSpace, afterRun, crewNotes, summary, chatAction, syncFloors, md,
    isRunning, get anyRunning() { return runs.size > 0; }, get list() { return S().list; }, TEMPLATES, CAP, addRoom, capOf,
  };
})();
