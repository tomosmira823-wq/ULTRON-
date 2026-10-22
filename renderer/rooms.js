// Kivo Ultron — hand-made rooms. Every room is a fixed layout we know works: its own furniture, props, walls and crew.
(() => {
  const bot = (name, team, icon, job, tools = {}, extra = {}) => ({ name, team, icon, job, tools, ...extra });
  const SLOTS = [0, 1, 2, 3, 4, 5, 6, 7, 8];
  const sNote = (x, c, X, Y, w = 14, h = 9) => { x.fillStyle = c; x.fillRect(X, Y, w, h); x.fillStyle = 'rgba(0,0,0,.35)'; x.fillRect(X + 2, Y + 3, w - 5, 1); x.fillRect(X + 2, Y + 5.5, w - 7, 1); };

  // ======================= PODCAST STUDIO =======================
  const podcast = {
    guide: {"what": "Preps every episode for you. Give it a guest or a topic and the crew researches them, plans the running order, writes your questions, then turns it into show notes, clip ideas and promo posts.", "examples": ["Prep a 45-minute episode with Sarah Jones, owner of Bloom Florist in Knutsford, about starting a business in a cost-of-living crisis", "Plan a solo episode: 5 ways small businesses can use AI this year", "I recorded an episode about mental health in the trades. Write show notes, timestamps outline and 5 clip ideas"], "get": "A research pack on the guest with links, a timed run sheet, 10-12 questions, title options, show notes, clip ideas with hooks, and posts for Instagram, TikTok and LinkedIn.", "tips": "Name the guest and their business so the researcher can find real info. Hand results to the Video Studio to turn clip ideas into scripts."},
    id: 'podcast', name: 'Podcast Studio', hue: 14, tagline: 'Round table, mics, cameras and a control room.',
    mission: 'Plan, prep and promote podcast episodes: research guests, write the run sheet and questions, then turn each episode into show notes, clips and posts.',
    brief: 'Prep next week’s episode: a 45-minute chat with a local small-business owner about using AI.',
    floor: 'studio', floorColor: 'hsl(22 32% 11%)', chairColor: '#3b2622', deskTop: 'hsl(20 25% 16%)', deskL: 'hsl(20 25% 9%)', deskR: 'hsl(20 25% 12%)',
    zones: [
      { id: 'table', label: 'ON AIR', u: [7.4, 16.6], v: [7.4, 16.6] },
      { id: 'control', label: 'CONTROL ROOM', u: [17.6, 23.2], v: [16.6, 23.2] },
      { id: 'green', label: 'GREEN ROOM', u: [0.8, 5.6], v: [9.5, 21.5] },
    ],
    desks: [
      { zone: 'table', u: 12, v: 8.7, kind: 'seat' }, { zone: 'table', u: 15.3, v: 12, kind: 'seat' },
      { zone: 'table', u: 8.7, v: 12, kind: 'seat' }, { zone: 'table', u: 12, v: 15.3, kind: 'seat' },
      { zone: 'control', u: 19.4, v: 19.2, kind: 'console' }, { zone: 'control', u: 21.9, v: 19.2, kind: 'console' },
    ],
    spare: [
      { zone: 'green', u: 2.1, v: 11.8, kind: 'sofa' }, { zone: 'green', u: 2.1, v: 14.1, kind: 'sofa' }, { zone: 'green', u: 2.1, v: 16.4, kind: 'sofa' },
      { zone: 'green', u: 2.1, v: 18.7, kind: 'sofa' }, { zone: 'control', u: 19.4, v: 21.9, kind: 'console' }, { zone: 'control', u: 21.9, v: 21.9, kind: 'console' },
    ],
    crew: [
      bot('Showrunner', 'On air', 'flow', 'Plan the episode: the angle, the segments with timings, and a run sheet the host can follow.'),
      bot('Guest Researcher', 'On air', 'search', 'Research the guest or topic properly: background, recent news, things they have said, and what listeners will want to know. Link sources.', { web: true }),
      bot('Question Writer', 'On air', 'chat', 'Write the questions: a warm opener, 10-12 strong questions in order, follow-ups, and one surprising question to finish.'),
      bot('Show Notes', 'On air', 'doc', 'Write the episode title options, a description, timestamps outline and show notes with links.'),
      bot('Clip Picker', 'Control', 'film', 'Pick 4-6 moments that would make great short clips, with a hook line and caption for each.'),
      bot('Promo Writer', 'Control', 'send', 'Write the promo pack: posts for Instagram, TikTok and LinkedIn, plus a short email to the list.'),
    ],
    cards: { left: [], right: SLOTS },
    floorProps(A) {
      A.disc(12, 12, 4.4, 0.01, 'hsl(8 38% 19%)', 'hsl(8 45% 30%)');
      A.disc(12, 12, 3.9, 0.012, null, 'hsl(8 45% 26%)');
      A.rug(1.0, 4.8, 10.2, 20.5, 'hsl(200 15% 15%)', 'hsl(200 15% 22%)');
    },
    props: [
      { u: 12, v: 12, d: 24, draw(A) {
        A.cyl(12, 12, 0.45, 0, 0.55, '#2a1a12', '#1d120c');
        A.cyl(12, 12, 2.25, 0.55, 0.66, 'hsl(22 40% 26%)', 'hsl(22 40% 16%)', 'hsl(22 40% 34%)');
        const live = A.anyBusy();
        for (const [su, sv] of [[12, 8.7], [15.3, 12], [8.7, 12], [12, 15.3]]) A.micArm(12 + (su - 12) * 0.55, 12 + (sv - 12) * 0.55, 0.66, su, sv, live);
        for (const [u, v] of [[13.2, 10.6], [10.6, 13.3]]) A.cyl(u, v, 0.14, 0.66, 0.85, '#ddd', '#bbb');
        A.screenAt(11.5, 12.5, 12.2, 0.67, 1.05, A.screenArt('wave', live));
      } },
      { u: 19.6, v: 7.4, draw(A) { A.tripod(19.6, 7.4, 1.6, 12, 12); } },
      { u: 7.2, v: 19.8, draw(A) { A.tripod(7.2, 19.8, 1.6, 12, 12); } },
      { u: 21.2, v: 10.6, draw(A) { A.softbox(21.2, 10.6, 2.3, true); } },
      { u: 10.6, v: 21.2, draw(A) { A.softbox(10.6, 21.2, 2.3, true); } },
      { u: 17.3, v: 16.3, d: 33.4, draw(A) { A.glassWall(17.3, 16.3, 23.7, 16.3, 2.2); A.glassWall(17.3, 16.3, 17.3, 23.7, 2.2); } },
      { u: 1.7, v: 10.5, d: 12, draw(A) { A.sofa(1.0, 2.6, 10.6, 19.8, '#3d2f2b', 'u'); } },
      { u: 3.6, v: 15, draw(A) { A.box(3.2, 4.2, 13.6, 16.6, 0, 0.35, '#2b2320', '#1b1614', '#221c19', null); A.cyl(3.7, 14.4, 0.12, 0.35, 0.52, '#eee', '#ccc'); } },
      { u: 22.8, v: 1.6, draw(A) { A.plant(22.8, 1.6, 1.2); } },
      { u: 1.4, v: 22.6, draw(A) { A.plant(1.4, 22.6, 1.1); } },
      { u: 16.4, v: 3.2, draw(A) { A.plant(16.4, 3.2, 0.9); } },
    ],
    walls(A) {
      for (let i = 0; i < 22; i++) for (let j = 0; j < 6; j++) { const s0 = 0.4 + i * 1.06, z0 = 0.5 + j * 0.78; A.wallQuad('left', s0, s0 + 0.98, z0, z0 + 0.72, (i + j) % 2 ? 'hsl(10 20% 11%)' : 'hsl(10 25% 8%)', 'rgba(0,0,0,.55)', 0.8); }
      const live = A.anyBusy() && Math.sin(A.t * 2.4) > -0.7;
      A.wallQuad('left', 9.6, 14.4, 5.15, 6.05, live ? 'hsl(0 90% 42%)' : 'hsl(0 40% 15%)', live ? '#ff8b8b' : '#552222', 1.4);
      A.wallText('ON AIR', 'left', 10.3, 5.6, '#fff', 14);
      for (let i = 0; i < 24; i++) A.wallQuad('right', i, i + 1, 0, 1.2, i % 2 ? 'hsl(15 30% 13%)' : 'hsl(15 30% 10%)', null);
      A.wallText('EPISODES', 'right', 18.6, 5.35, 'hsl(14 100% 75%)', 11);
    },
  };

  // ======================= VIDEO STUDIO =======================
  const video = {
    guide: {"what": "Plans YouTube videos and Shorts from idea to edit notes. Tell it your channel's niche or a topic and it comes back with ideas, full scripts, titles, thumbnail ideas, descriptions and a shot list.", "examples": ["Plan 3 Shorts about weird science facts for my explainer channel", "Write a 6-minute YouTube video: why electricians are using AI now", "Turn this idea into a Short with a strong hook: the secret government project nobody talks about"], "get": "Ideas with why they'll work, scripts with on-screen text, 3 titles and 2 thumbnail concepts each, description and tags, and a shot-by-shot edit list.", "tips": "Say how long, what style (animated, talking head) and who it's for. The Idea Scout searches what's trending right now."},
    id: 'video', name: 'Video Studio', hue: 356, tagline: 'Green screen set, writers’ room and an edit bay.',
    mission: 'Plan and write YouTube videos and Shorts that people actually watch to the end, and package them to get clicked.',
    brief: 'Plan 3 Shorts about weird science facts.',
    floor: 'carpet', floorColor: 'hsl(230 10% 10%)',
    zones: [
      { id: 'set', label: 'SET', u: [7.5, 17.5], v: [0.6, 7.6] },
      { id: 'writers', label: 'WRITERS’ ROOM', u: [15.6, 23.2], v: [9.6, 16.2] },
      { id: 'edit', label: 'EDIT BAY', u: [5.6, 15.6], v: [16.2, 23.2] },
    ],
    desks: [
      { zone: 'set', u: 12.5, v: 3.4, kind: 'stand' },
      { zone: 'writers', u: 17.8, v: 11.6, kind: 'desk' },
      { zone: 'edit', u: 7.8, v: 18.6, kind: 'edit' }, { zone: 'edit', u: 10.8, v: 18.6, kind: 'edit' }, { zone: 'edit', u: 13.8, v: 18.6, kind: 'edit' },
    ],
    spare: [
      { zone: 'writers', u: 20.8, v: 11.6, kind: 'desk' }, { zone: 'writers', u: 17.8, v: 14.5, kind: 'desk' }, { zone: 'writers', u: 20.8, v: 14.5, kind: 'desk' },
      { zone: 'edit', u: 7.8, v: 21.6, kind: 'edit' }, { zone: 'edit', u: 10.8, v: 21.6, kind: 'edit' }, { zone: 'edit', u: 13.8, v: 21.6, kind: 'edit' },
    ],
    crew: [
      bot('Idea Scout', 'Set', 'radar', 'Find video ideas getting attention right now in this niche. For each: the idea, why it will work and a working title.', { web: true }),
      bot('Scriptwriter', 'Writers', 'lines', 'Write the full script for each video: a hook in the first 2 seconds, tight beats and a payoff. Mark on-screen text in [brackets].'),
      bot('Title & Thumbnail', 'Edit', 'image', 'Write 3 title options and describe 2 thumbnail concepts (text on it, image, colours) for each video.'),
      bot('SEO Writer', 'Edit', 'doc', 'Write the description, 10 tags and 3 hashtags for each video.'),
      bot('Shot List', 'Edit', 'film', 'Turn each script into a shot list and edit notes: shot, visual, on-screen text, sound, duration.'),
    ],
    cards: { left: SLOTS, right: [0, 1, 2, 7, 8] },
    floorProps(A) {
      A.rug(7.6, 17.4, 0.02, 5.4, 'hsl(128 65% 30%)', 'hsl(128 65% 38%)');
      A.rug(16.2, 22.6, 10.4, 15.6, 'hsl(350 25% 14%)', 'hsl(350 30% 22%)');
    },
    props: [
      { u: 12.5, v: 10, draw(A) { A.tripod(12.5, 10, 1.7, 12.5, 3.4); } },
      { u: 8.2, v: 7.2, draw(A) { A.softbox(8.2, 7.2, 2.5, false); } },
      { u: 16.8, v: 7.2, draw(A) { A.softbox(16.8, 7.2, 2.5, false); } },
      { u: 15, v: 4.6, draw(A) { A.micArm(15.6, 5.2, 0, 12.6, 3.6, A.anyBusy()); } },
      { u: 21.4, v: 19.6, draw(A) { A.chair(21.4, 19.6, '#4a1f22'); const [x, y] = A.iso(21.4, 19.1, 1.15); A.ctx.fillStyle = '#ddd'; A.ctx.font = '600 6px Inter'; A.ctx.fillText('DIRECTOR', x - 13, y - 2); } },
      { u: 22.8, v: 22.6, draw(A) { A.plant(22.8, 22.6, 1.1); } },
      { u: 1.6, v: 22.8, draw(A) { A.plant(1.6, 22.8, 1); } },
      { u: 3, v: 12, draw(A) { A.crate(2.6, 11, 1.1, '#2b2d33'); A.crate(2.8, 12.4, 0.9, '#2b2d33'); A.crate(2.2, 14.2, 0.8, '#3a1f22'); } },
    ],
    walls(A) {
      A.wallQuad('right', 7.6, 17.4, 0, 5.3, 'hsl(128 65% 34%)', 'hsl(128 65% 45%)', 1);
      const rec = A.anyBusy() && Math.sin(A.t * 3) > 0;
      A.wallQuad('right', 18.4, 21.6, 5.2, 6.0, rec ? 'hsl(0 85% 40%)' : 'hsl(0 30% 14%)', '#ff6b6b', 1);
      A.wallText('● REC', 'right', 18.9, 5.6, '#fff', 12);
      A.wallText('THUMBNAIL WALL', 'left', 9, 5.35, 'hsl(356 100% 78%)', 10);
    },
  };

  // ======================= TRADING FLOOR =======================
  const trading = {
    guide: {"what": "A research desk for markets. Give it a watchlist and it pulls latest prices and news, writes a balanced view on each, flags the risks and keeps a pretend-money trading journal. It never places real trades and isn't financial advice.", "examples": ["Morning brief on my watchlist: AAPL, NVDA, MSFT and the FTSE 100", "What moved gold and the pound this week and why?", "Paper trade idea: should I buy NVDA after earnings? Log it in the journal with a stop and target"], "get": "Prices and moves with dates and sources, the news behind them, bull and bear cases, risk notes and position limits, and a paper-trade journal table it remembers between runs.", "tips": "Turn on autopilot every 24 hours for a daily morning brief. Treat it as research to check, not advice."},
    id: 'trading', name: 'Trading Floor', hue: 140, tagline: 'Multi-screen desks, a video wall and a risk office. Research and paper trades only.',
    mission: 'Research markets and keep a paper-trading journal to test ideas. This room never places real trades and is not financial advice.',
    brief: 'Give me a morning brief on my watchlist: AAPL, NVDA, MSFT, and the FTSE 100.',
    floor: 'trading', floorColor: 'hsl(150 25% 6%)',
    zones: [
      { id: 'desk', label: 'THE DESK', u: [7, 22.4], v: [6.8, 11.2] },
      { id: 'research', label: 'RESEARCH ROW', u: [7, 22.4], v: [12, 16.4] },
      { id: 'risk', label: 'RISK OFFICE', u: [0.8, 6.4], v: [16.6, 23.2] },
    ],
    desks: [
      { zone: 'desk', u: 9.2, v: 8.4, kind: 'trader' }, { zone: 'desk', u: 12.9, v: 8.4, kind: 'trader' },
      { zone: 'research', u: 9.2, v: 13.6, kind: 'trader' }, { zone: 'risk', u: 3.6, v: 19.4, kind: 'desk' },
      { zone: 'desk', u: 16.6, v: 8.4, kind: 'trader' },
    ],
    spare: [
      { zone: 'desk', u: 20.3, v: 8.4, kind: 'trader' }, { zone: 'research', u: 12.9, v: 13.6, kind: 'trader' },
      { zone: 'research', u: 16.6, v: 13.6, kind: 'trader' }, { zone: 'research', u: 20.3, v: 13.6, kind: 'trader' },
    ],
    hub: { u: 15.2, v: 20.2, kind: 'globe' },
    crew: [
      bot('Market Scanner', 'Desk', 'chart', 'Search for the latest prices, moves and key levels for the watchlist. Give numbers with dates and sources.', { web: true }),
      bot('News Reader', 'Desk', 'search', 'Find the news, earnings and events moving each item on the watchlist this week, with links.', { web: true }),
      bot('Analyst', 'Research', 'flow', 'Write a balanced view on each item: bull case, bear case and what to watch. No hype.'),
      bot('Risk Officer', 'Risk', 'check', 'Point out the risks, what could go wrong and position-size limits for any idea. Remind that this is research, not advice.'),
      bot('Paper Trader', 'Desk', 'cal', 'Record any paper trades as a journal table (date, instrument, side, entry, stop, target, reason). Pretend money only, never real orders.', { memory: true }),
    ],
    cards: { left: SLOTS, right: [] },
    floorProps(A) { A.rug(1.0, 6.2, 16.8, 23, 'hsl(150 20% 9%)', 'hsl(150 30% 16%)'); },
    props: [
      { u: 0.6, v: 16.2, d: 22.9, draw(A) { A.glassWall(0.6, 16.2, 6.6, 16.2, 2.3); } },
      { u: 6.6, v: 16.2, d: 30, draw(A) { A.glassWall(6.6, 16.2, 6.6, 23.7, 2.3); } },
      { u: 21.4, v: 21, draw(A) { A.box(20.9, 21.9, 20.5, 21.5, 0, 1.1, '#1d2a22', '#111914', '#162019', 'rgba(70,255,154,.3)'); A.cyl(21.4, 21, 0.32, 1.1, 1.5, '#e8c24a', '#b8922a'); const [x, y] = A.iso(21.4, 21.8, 0.6); A.ctx.fillStyle = '#9fe'; A.ctx.font = '600 5px Inter'; A.ctx.fillText('BELL', x - 6, y); } },
      { u: 22.8, v: 1.6, draw(A) { A.plant(22.8, 1.6, 1.2); } },
      { u: 7.6, v: 22.8, draw(A) { A.plant(7.6, 22.8, 1); } },
      { u: 1.4, v: 22.6, draw(A) { A.plant(1.4, 22.6, 0.9); } },
    ],
    walls(A) {
      A.wallQuad('right', 0.6, 23.4, 1.0, 5.0, '#020403', 'hsl(140 100% 50% / .45)', 1.2);
      A.wallPaint('right', 0.6, 12, 1.0, 5.0, (x) => { x.lineWidth = 1.2; for (let i = 0; i < 26; i++) { const up = Math.sin(i * 2.1 + Math.floor(A.t / 2)) > -0.2, h = 6 + Math.abs(Math.sin(i * 1.3 + A.t * 0.2)) * 22, y = 12 + Math.abs(Math.cos(i * 0.7 + A.t * 0.1)) * 22; x.fillStyle = up ? '#46ff9a' : '#ff5a4f'; x.fillRect(4 + i * 3.7, y, 2.4, h); } });
      A.wallPaint('right', 12, 23.4, 1.0, 5.0, (x) => { x.strokeStyle = '#46ff9a'; x.lineWidth = 1.4; x.beginPath(); for (let i = 0; i <= 40; i++) { const yy = 44 - i * 0.6 - Math.sin(i * 0.6 + A.t) * 6 - Math.sin(i * 0.17) * 8; i ? x.lineTo(4 + i * 2.3, yy) : x.moveTo(4, yy); } x.stroke(); x.fillStyle = '#ffc247'; x.font = '700 7px Michroma, sans-serif'; x.fillText('MARKETS', 6, 10); });
      A.wallQuad('right', 0.6, 23.4, 5.15, 5.95, '#010201', 'hsl(140 100% 50% / .5)');
      const txt = 'FTSE 100   ·   NVDA   ·   AAPL   ·   MSFT   ·   GBP/USD   ·   BTC   ·   GOLD   ·   ';
      const off = (A.t * 1.6) % 22;
      A.wallClip('right', 0.6, 23.4, 5.15, 5.95, () => { for (let k = -1; k < 2; k++) A.wallText(txt, 'right', 0.8 + k * 22 - off, 5.55, '#46ff9a', 9); });
      const cities = [['LDN', 0], ['NYC', -5], ['TYO', 9], ['HKG', 8]];
      cities.forEach(([c, off2], i) => { const s0 = 1.2 + i * 5.6; A.wallQuad('left', s0, s0 + 4.6, 5.1, 6.15, '#020403', 'hsl(140 100% 50% / .35)'); const d = new Date(Date.now() + off2 * 36e5); A.wallClip('left', s0, s0 + 4.6, 5.1, 6.15, () => A.wallText(`${c} ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`, 'left', s0 + 0.5, 5.62, '#ffc247', 9)); });
    },
  };

  // ======================= SALES OFFICE =======================
  const sales = {
    guide: {"what": "Finds you clients for Kivo. Tell it what kind of business and where, and it finds real businesses, checks their websites, writes an offer for each and drafts a personal cold email. You approve every email before it sends.", "examples": ["Find 5 businesses in Cheshire that need a better website and write an outreach email for each", "Find 10 trades businesses near Warrington with no website and pitch them a one-page site", "Find cafés in Manchester with no online booking and pitch them an AI booking assistant"], "get": "A lead list with links and why each is a good fit, 3 honest problems with each website, a tailored offer with a price range, and ready-to-send emails in the outbox.", "tips": "Set up email in Settings and the Checker's emails land in the outbox: tap Send in the app or on your phone. Add a missing address by hand if the finder couldn't get one."},
    id: 'sales', name: 'Sales Office', hue: 188, tagline: 'Call pods with headsets, a pipeline board and a deal gong.',
    mission: 'Find local small businesses that would benefit from a better website, AI automation or custom software, research each one, and write personal outreach that gets replies.',
    brief: 'Find 5 businesses in Cheshire that need a better website and write an outreach email for each.',
    floor: 'carpet', floorColor: 'hsl(200 22% 10%)',
    zones: [
      { id: 'floor', label: 'SALES FLOOR', u: [7.6, 22.6], v: [7.6, 16.2] },
      { id: 'quality', label: 'QUALITY', u: [0.8, 5.8], v: [9, 15.6] },
      { id: 'lounge', label: 'DEAL LOUNGE', u: [15.4, 23.2], v: [18, 23.2] },
    ],
    desks: [
      { zone: 'floor', u: 9.6, v: 9.4, kind: 'headset' }, { zone: 'floor', u: 13.1, v: 9.4, kind: 'headset' },
      { zone: 'floor', u: 9.6, v: 13.2, kind: 'headset' }, { zone: 'floor', u: 13.1, v: 13.2, kind: 'headset' },
      { zone: 'quality', u: 3.3, v: 12.2, kind: 'stand' },
    ],
    spare: [
      { zone: 'floor', u: 17.1, v: 9.4, kind: 'headset' }, { zone: 'floor', u: 20.6, v: 9.4, kind: 'headset' },
      { zone: 'floor', u: 17.1, v: 13.2, kind: 'headset' }, { zone: 'floor', u: 20.6, v: 13.2, kind: 'headset' },
    ],
    crew: [
      bot('Lead Finder', 'Calls', 'search', 'Search the web for real businesses that match the brief. For each give the name, town, website (or "none found"), what they do and why they are a good lead. Only list businesses you actually found.', { web: true }),
      bot('Site Auditor', 'Calls', 'check', 'For each lead, look at their website and online presence and list 3 specific, honest problems (speed, mobile, booking, out of date, no site) and the opportunity for each.', { web: true }),
      bot('Offer Writer', 'Calls', 'money', 'Turn each audit into a short, specific offer: what we would build, the benefit to them in plain English and a starting price range.'),
      bot('Email Writer', 'Calls', 'mail', 'Write a short personal cold email for each lead (subject + under 120 words). Mention one real detail about their business. Friendly, no hype, one clear call to action.'),
      bot('Checker', 'Quality', 'check', 'Check every email for made-up facts, spelling, tone and spammy wording. Output the final, ready-to-send list as a table: business, email address if known, subject, email.', { email: true }, { approve: true }),
    ],
    cards: { left: [0, 1, 2, 7, 8], right: [0, 1, 2, 3, 4] },
    floorProps(A) { A.rug(15.8, 22.8, 18.4, 22.8, 'hsl(195 25% 15%)', 'hsl(195 35% 24%)'); },
    props: [
      { u: 8.6, v: 11.5, d: 21.6, draw(A) { A.box(8.6, 14.2, 11.45, 11.65, 0, 1.0, 'hsl(188 60% 40% / .35)', 'hsl(188 60% 30% / .35)', 'hsl(188 60% 35% / .35)', 'hsl(188 100% 70% / .5)'); } },
      { u: 16.1, v: 11.5, d: 29.1, draw(A) { A.box(16.1, 21.7, 11.45, 11.65, 0, 1.0, 'hsl(188 60% 40% / .35)', 'hsl(188 60% 30% / .35)', 'hsl(188 60% 35% / .35)', 'hsl(188 100% 70% / .5)'); } },
      { u: 16.2, v: 21.4, draw(A) { A.sofa(16.2, 21.2, 21.6, 22.8, '#2f4650'); A.box(17.2, 20.2, 19.6, 20.6, 0, 0.35, '#1d2b30', '#121b1f', '#172327', null); } },
      { u: 22.3, v: 19.2, draw(A) {
        const ctx = A.ctx; const a = A.iso(22.3, 18.4, 0), b = A.iso(22.3, 20, 0), a2 = A.iso(22.3, 18.4, 2.2), b2 = A.iso(22.3, 20, 2.2);
        ctx.strokeStyle = '#5a4630'; ctx.lineWidth = 2.5; A.line(a, a2); A.line(b, b2); A.line(a2, b2);
        const [x, y] = A.iso(22.3, 19.2, 1.25); const sw = A.anyBusy() ? Math.sin(A.t * 6) * 1.5 : 0;
        const g = ctx.createRadialGradient(x - 3, y - 3, 1, x, y, 14); g.addColorStop(0, '#ffe39a'); g.addColorStop(1, '#a8761c');
        ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x + sw, y, 8, 13, 0.45, 0, 7); ctx.fill(); ctx.strokeStyle = '#6b4a10'; ctx.lineWidth = 1; ctx.stroke();
      } },
      { u: 22.8, v: 1.6, draw(A) { A.plant(22.8, 1.6, 1.2); } },
      { u: 6.8, v: 22.6, draw(A) { A.plant(6.8, 22.6, 1.1); } },
    ],
    walls(A) {
      A.wallQuad('left', 8.2, 17.9, 1.3, 4.95, '#e9eef0', '#9aa', 1);
      A.wallPaint('left', 8.2, 17.9, 1.3, 4.95, (x) => {
        x.fillStyle = '#123'; x.font = '700 5px Inter, sans-serif';
        ['LEADS', 'CONTACTED', 'WON'].forEach((h, i) => { x.fillText(h, 6 + i * 33, 7); x.fillStyle = '#9aa'; x.fillRect(4 + i * 33, 9, 28, 0.6); x.fillStyle = '#123'; });
        const cols = ['#ffd36b', '#7ee8ff', '#ff9ab3', '#b6ff5a'];
        for (let i = 0; i < 7; i++) sNote(x, cols[i % 4], 5 + (i % 2) * 14, 12 + Math.floor(i / 2) * 11, 12, 9);
        for (let i = 0; i < 4; i++) sNote(x, cols[(i + 1) % 4], 38 + (i % 2) * 14, 12 + Math.floor(i / 2) * 11, 12, 9);
        for (let i = 0; i < 2; i++) sNote(x, '#46ff9a', 71 + i * 14, 12, 12, 9);
      });
      A.wallQuad('right', 13.3, 22.8, 1.3, 4.95, '#03080a', 'hsl(188 100% 60% / .5)', 1.2);
      A.wallPaint('right', 13.3, 22.8, 1.3, 4.95, (x) => {
        x.fillStyle = '#7ee8ff'; x.font = '700 7px Michroma, sans-serif'; x.fillText('TARGET BOARD', 6, 10);
        const busy = A.anyBusy(); x.font = '700 12px Michroma, sans-serif'; x.fillStyle = busy ? '#46ff9a' : '#2b5560'; x.fillText(busy ? 'DIALLING' : 'READY', 6, 32);
        x.fillStyle = '#123'; x.fillRect(6, 44, 88, 5); x.fillStyle = '#46ff9a'; x.fillRect(6, 44, busy ? 88 * ((A.t * 0.2) % 1) : 0, 5);
      });
    },
  };

  // ======================= RESEARCH LAB =======================
  const research = {
    guide: {"what": "Answers any question properly. It searches the web, double-checks the key facts against a second source, compares the options and writes it up as a clear report with links.", "examples": ["What are the best mini PCs for a small office backup server?", "Compare Printify vs Printful for UK Etsy sellers in 2026", "What do I need to know about UK tax as a sole trader selling on Etsy?"], "get": "A 3-line answer up top, then sections, a comparison table where useful, each claim marked confirmed or unverified, and a source list with links.", "tips": "Ask one clear question per run. Hand the report to the Sales Office or Dev Studio to act on it."},
    id: 'research', name: 'Research Lab', hue: 215, tagline: 'Lab benches, a library wall and a holo-helix.',
    mission: 'Research any question properly using the web and write it up as a clear, sourced report.',
    brief: 'What are the best mini PCs for a small office backup server in 2026?',
    floor: 'lab', floorColor: 'hsl(215 18% 15%)',
    zones: [
      { id: 'bench', label: 'LAB BENCHES', u: [7.4, 23], v: [6.6, 11.4] },
      { id: 'library', label: 'LIBRARY', u: [0.8, 6.2], v: [8.4, 23.2] },
      { id: 'write', label: 'WRITE-UP', u: [9.4, 21.4], v: [16.6, 23.2] },
    ],
    desks: [
      { zone: 'bench', u: 9.8, v: 8.6, kind: 'bench' }, { zone: 'bench', u: 13.8, v: 8.6, kind: 'bench' },
      { zone: 'bench', u: 17.8, v: 8.6, kind: 'bench' }, { zone: 'write', u: 13, v: 19.2, kind: 'desk' },
    ],
    spare: [
      { zone: 'bench', u: 21.6, v: 8.6, kind: 'bench' }, { zone: 'write', u: 17, v: 19.2, kind: 'desk' },
      { zone: 'library', u: 3.6, v: 11.6, kind: 'desk' }, { zone: 'library', u: 3.6, v: 15, kind: 'desk' },
    ],
    hub: { u: 13.6, v: 13.8, kind: 'helix' },
    crew: [
      bot('Searcher', 'Benches', 'search', 'Search the web widely for the question. Collect the key facts, numbers and options, each with its source link.', { web: true }),
      bot('Fact Checker', 'Benches', 'check', 'Check the most important claims against a second source. Mark each as confirmed, disputed or unverified, with links.', { web: true }),
      bot('Analyst', 'Benches', 'chart', 'Compare the options and findings. Pull out what actually matters, the trade-offs and a recommendation with reasons.'),
      bot('Report Writer', 'Write-up', 'doc', 'Write the final report: a 3-line answer first, then sections, a comparison table if useful, and a sources list with links.'),
    ],
    cards: { left: [0, 1, 2], right: SLOTS },
    floorProps(A) { A.rug(1.2, 5.8, 17.6, 22.6, 'hsl(30 25% 16%)', 'hsl(30 30% 24%)'); },
    props: [
      { u: 3.4, v: 20.2, draw(A) { A.chair(3.4, 20.2, '#5a3d2a'); } },
      { u: 5.2, v: 18, draw(A) { const ctx = A.ctx; ctx.strokeStyle = '#555'; ctx.lineWidth = 1.4; A.line(A.iso(5.2, 18, 0), A.iso(5.2, 18, 2.4)); const [x, y] = A.iso(5.2, 18, 2.5); ctx.fillStyle = '#e9d8a6'; ctx.beginPath(); ctx.moveTo(x - 6, y + 4); ctx.lineTo(x + 6, y + 4); ctx.lineTo(x + 3, y - 4); ctx.lineTo(x - 3, y - 4); ctx.closePath(); ctx.fill(); const g = ctx.createRadialGradient(x, y + 20, 2, x, y + 20, 40); g.addColorStop(0, 'rgba(255,230,170,.18)'); g.addColorStop(1, 'rgba(255,230,170,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, y + 40, 40, 20, 0, 0, 7); ctx.fill(); } },
      { u: 22.8, v: 1.6, draw(A) { A.plant(22.8, 1.6, 1.2); } },
      { u: 22.6, v: 22.6, draw(A) { A.plant(22.6, 22.6, 1.2); } },
      { u: 21.4, v: 14.4, draw(A) { A.box(20.4, 22.6, 13.6, 15.2, 0, 1.0, '#1a2433', '#0f1622', '#141c29', 'hsl(215 100% 70% / .5)'); A.screenAt(20.6, 22.4, 14.4, 1.0, 1.7, A.screenArt('chart', A.anyBusy())); } },
    ],
    walls(A) {
      const cols = ['#8b3a3a', '#3a5f8b', '#c49a3a', '#2f6b4a', '#6b3f8b', '#b5651d', '#444'];
      for (let r = 0; r < 5; r++) {
        A.wallQuad('left', 8.4, 23.6, 0.3 + r * 1.08, 0.38 + r * 1.08, '#5a4030', null);
        for (let s0 = 8.5, i = 0; s0 < 23.4; i++) { const w = 0.22 + ((i * 7 + r * 3) % 5) * 0.05, h = 0.6 + ((i * 3 + r) % 4) * 0.08; A.wallQuad('left', s0, s0 + w, 0.38 + r * 1.08, 0.38 + r * 1.08 + h, cols[(i + r * 2) % cols.length], 'rgba(0,0,0,.4)', 0.5); s0 += w + 0.03; }
      }
      A.wallQuad('right', 0.6, 23.4, 5.1, 6.25, 'hsl(215 50% 10%)', 'hsl(215 100% 70% / .4)');
      const eq = ['E = mc²', 'p < 0.05', 'Σx/n', 'n = 1,240', 'r = 0.82', 'H₀ rejected', 'σ = 2.4', 'CI 95%'];
      A.wallClip('right', 0.6, 23.4, 5.1, 6.25, () => eq.forEach((e, i) => A.wallText(e, 'right', 1.0 + i * 2.85, i % 2 ? 5.4 : 5.9, 'hsl(215 100% 85%)', 9)));
    },
  };

  // ======================= DEV STUDIO =======================
  const dev = {
    guide: {"what": "Turns an app or website idea into a spec, a build plan and working code with tests. Good for Kivo client sites, small tools and prototypes.", "examples": ["A one-page booking site for a barber shop", "A simple timesheet app where staff clock in and the boss exports a weekly CSV", "A landing page for my beat packs with a buy button"], "get": "A spec with user stories, the stack and file structure, full code file by file, tests and a manual checklist, and a review listing fixes in priority order.", "tips": "Say who it's for and what 'done' looks like. Save results to a folder in EDIT ROOM so the code lands straight on your PC."},
    id: 'dev', name: 'Dev Studio', hue: 200, tagline: 'Dual-screen desks, server racks and a kanban wall.',
    mission: 'Turn an app or website idea into a clear spec, a build plan and working code with tests.',
    brief: 'A one-page booking site for a barber shop.',
    floor: 'station', floorColor: 'hsl(205 18% 8%)',
    zones: [
      { id: 'plan', label: 'PLANNING', u: [7.8, 15.4], v: [0.8, 6.2] },
      { id: 'build', label: 'BUILD', u: [7.4, 23], v: [8.2, 16.4] },
      { id: 'servers', label: 'SERVER ROOM', u: [0.6, 5.6], v: [9, 23.2] },
      { id: 'chill', label: 'BREAK AREA', u: [15, 23.2], v: [18, 23.2] },
    ],
    desks: [
      { zone: 'plan', u: 9.8, v: 3.2, kind: 'desk' }, { zone: 'plan', u: 13, v: 3.2, kind: 'desk' },
      { zone: 'build', u: 9.6, v: 10.4, kind: 'dual' }, { zone: 'build', u: 13.3, v: 10.4, kind: 'dual' }, { zone: 'build', u: 17, v: 10.4, kind: 'dual' },
    ],
    spare: [
      { zone: 'build', u: 20.7, v: 10.4, kind: 'dual' }, { zone: 'build', u: 9.6, v: 13.8, kind: 'dual' },
      { zone: 'build', u: 13.3, v: 13.8, kind: 'dual' }, { zone: 'build', u: 17, v: 13.8, kind: 'dual' },
    ],
    crew: [
      bot('Product Manager', 'Plan', 'flow', 'Write the spec: who it is for, user stories, must-haves vs nice-to-haves, and what done looks like.'),
      bot('Architect', 'Plan', 'grid', 'Choose the stack and structure: files, data, APIs and hosting, with reasons. Keep it simple.'),
      bot('Developer', 'Build', 'code', 'Write the code for the plan, file by file, in full. Use fenced code blocks with the filename above each.'),
      bot('Tester', 'Build', 'check', 'Write tests and a manual test checklist for the code. Point out bugs you can see.'),
      bot('Reviewer', 'Build', 'doc', 'Review everything for security, bugs and simplicity. List fixes in priority order.'),
    ],
    cards: { left: [0, 1, 2], right: [0, 1, 2, 3, 4] },
    floorProps(A) { A.rug(15.4, 22.8, 18.4, 22.8, 'hsl(200 25% 13%)', 'hsl(200 35% 22%)'); },
    props: [
      ...[[9.6, 11.6], [12.2, 14.2], [14.8, 16.8], [17.4, 19.4], [20, 22]].map(([v0, v1]) => ({ u: 1.5, v: (v0 + v1) / 2, draw(A) { A.rack(0.9, 2.2, v0, v1, 2.7, A.anyBusy()); } })),
      { u: 17.4, v: 20.6, draw(A) { A.disc(17.4, 20.6, 0.8, 0.02, '#c0392b'); A.cyl(17.4, 20.6, 0.8, 0, 0.45, '#d9534f', '#a8322e'); } },
      { u: 19.6, v: 21.8, draw(A) { A.cyl(19.6, 21.8, 0.8, 0, 0.45, '#3a7bd5', '#2a5ba5'); } },
      { u: 22, v: 19, draw(A) { A.box(21.2, 23, 18.4, 19.8, 0, 1.0, '#2a2d33', '#1a1c20', '#222429', null); A.box(21.6, 22.3, 18.7, 19.3, 1.0, 1.6, '#111', '#0a0a0a', '#0e0e0e', null); A.cyl(22.6, 19.5, 0.12, 1.0, 1.2, '#eee', '#ccc'); } },
      { u: 22.8, v: 1.6, draw(A) { A.plant(22.8, 1.6, 1.2); } },
      { u: 7, v: 22.8, draw(A) { A.plant(7, 22.8, 1); } },
    ],
    walls(A) {
      A.wallQuad('right', 13.3, 22.8, 1.3, 4.95, '#e8edf0', '#9ab', 1);
      A.wallPaint('right', 13.3, 22.8, 1.3, 4.95, (x) => {
        x.fillStyle = '#123'; x.font = '700 5px Inter, sans-serif';
        ['TO DO', 'DOING', 'DONE'].forEach((h, i) => { x.fillText(h, 6 + i * 33, 7); });
        const cols = ['#ffd36b', '#7ee8ff', '#ff9ab3', '#b6ff5a'], busy = A.anyBusy();
        for (let i = 0; i < 6; i++) sNote(x, cols[i % 4], 5 + (i % 2) * 14, 12 + Math.floor(i / 2) * 11, 12, 9);
        for (let i = 0; i < (busy ? 3 : 1); i++) sNote(x, '#7ee8ff', 38 + (i % 2) * 14, 12 + Math.floor(i / 2) * 11, 12, 9);
        for (let i = 0; i < 4; i++) sNote(x, '#46ff9a', 71 + (i % 2) * 14, 12 + Math.floor(i / 2) * 11, 12, 9);
      });
      A.wallQuad('left', 8.4, 23.6, 3.2, 3.5, '#111', null);
      for (let s0 = 8.6; s0 < 23.4; s0 += 0.6) A.wallQuad('left', s0, s0 + 0.08, 3.2, 3.5, Math.sin(A.t * 4 + s0) > 0.3 ? '#46ff9a' : '#0c3', null);
      A.wallText('git push origin main ✓', 'left', 9, 5.4, 'hsl(200 100% 75%)', 9);
    },
  };

  // ======================= STORE · PRINT SHOP (the Store department's floor) =======================
  const store = {
    id: 'store', name: 'Print Shop', hue: 148, tagline: 'The Store’s own floor.', internal: true,
    floor: 'workshop', floorColor: 'hsl(150 6% 10%)',
    zones: [
      { id: 'trends', label: 'TRENDS', u: [7.6, 13.8], v: [0.8, 5.4] },
      { id: 'design', label: 'DESIGN STUDIO', u: [15.2, 23], v: [0.8, 6.2] },
      { id: 'listings', label: 'LISTINGS & QA', u: [15.4, 23], v: [8, 13.6] },
      { id: 'press', label: 'PRINT ROOM', u: [7, 13.8], v: [7.8, 14.6] },
      { id: 'money', label: 'ACCOUNTS', u: [0.8, 5.6], v: [7.8, 14] },
      { id: 'dispatch', label: 'DISPATCH', u: [13.6, 23.2], v: [16.2, 23.2] },
      { id: 'hires', label: 'NEW HIRES', u: [0.8, 11.2], v: [16.2, 23.2] },
    ],
    desks: [
      { for: 'scout', zone: 'trends', u: 9.4, v: 2.8, kind: 'desk' }, { for: 'analyst', zone: 'trends', u: 12.2, v: 2.8, kind: 'desk' },
      { for: 'forge', zone: 'design', u: 17.6, v: 3.2, kind: 'dual' }, { for: 'scribe', zone: 'listings', u: 17.4, v: 10.4, kind: 'desk' },
      { for: 'auditor', zone: 'listings', u: 20.8, v: 10.4, kind: 'desk' }, { for: 'ledger', zone: 'money', u: 3.2, v: 10.4, kind: 'desk' },
      { for: 'courier', zone: 'dispatch', u: 16.4, v: 18.8, kind: 'desk' },
    ],
    spare: [
      { zone: 'hires', u: 2.8, v: 18.2, kind: 'desk' }, { zone: 'hires', u: 5.8, v: 18.2, kind: 'desk' }, { zone: 'hires', u: 8.8, v: 18.2, kind: 'desk' },
      { zone: 'hires', u: 2.8, v: 21.2, kind: 'desk' }, { zone: 'hires', u: 5.8, v: 21.2, kind: 'desk' }, { zone: 'hires', u: 8.8, v: 21.2, kind: 'desk' },
    ],
    cards: { left: SLOTS, right: SLOTS },
    floorProps(A) {
      const ctx = A.ctx; ctx.strokeStyle = '#ffc247'; ctx.globalAlpha = 0.55; ctx.setLineDash([5, 5]); ctx.lineWidth = 1;
      A.poly(A.rectUV(7.2, 13.6, 8, 14.4, 0.02), null, '#ffc247', 1); ctx.setLineDash([]); ctx.globalAlpha = 1;
    },
    props: [
      ...[[8.2, 10.6], [10.9, 13.3]].map(([u0, u1], i) => ({ u: (u0 + u1) / 2, v: 10.2, draw(A) {
        const busy = A.busy('forge') || A.busy('courier') || A.busy('scribe');
        A.box(u0, u1, 9.4, 11.0, 0, 1.0, '#d9dcd6', '#9ea29a', '#b8bcb4', 'rgba(0,0,0,.4)');
        A.box(u0 + 0.15, u1 - 0.15, 9.6, 10.8, 1.0, 1.08, '#222', '#111', '#181818', null);
        const p = busy ? (Math.sin(A.t * 3 + i) + 1) / 2 : 0.5; A.box(u0 + 0.2 + p * (u1 - u0 - 0.7), u0 + 0.5 + p * (u1 - u0 - 0.7), 9.5, 10.9, 1.08, 1.35, '#3a3d42', '#24262a', '#2e3035', null);
        A.screenAt(u0 + 0.2, u0 + 0.8, 11.0, 0.55, 0.85, A.screenArt('lines', busy));
        const [x, y] = A.iso((u0 + u1) / 2, 10.2, 1.08); A.ctx.fillStyle = '#f2efe8'; A.ctx.fillRect(x - 6, y - 2, 12, 4);
      } })),
      { u: 10.5, v: 13.4, draw(A) {
        const ctx = A.ctx; const a = A.iso(7.8, 13.4, 1.9), b = A.iso(13.2, 13.4, 1.9);
        ctx.strokeStyle = '#888'; ctx.lineWidth = 1.5; A.line(A.iso(7.8, 13.4, 0), a); A.line(A.iso(13.2, 13.4, 0), b); A.line(a, b);
        const tees = ['#f2efe8', '#f7c6d0', '#cfe8d6', '#2a2e33', '#ffe6a8', '#d9d2ff', '#f2efe8', '#c9e4f2'];
        for (let i = 0; i < 8; i++) { const u = 8.3 + i * 0.65, [x, y] = A.iso(u, 13.4, 1.85); ctx.fillStyle = tees[i]; ctx.fillRect(x - 5, y, 10, 4); ctx.fillRect(x - 3.5, y + 4, 7, 9); ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x - 3.5, y + 12, 7, 1); }
      } },
      { u: 20, v: 19, draw(A) { A.box(18.6, 22.4, 18.4, 19.6, 0, 0.8, '#8a6a44', '#5e4630', '#735538', null); A.crate(19.4, 19, 0.6); A.crate(21.4, 19, 0.5, '#c9a06a'); } },
      { u: 21.6, v: 21.8, draw(A) { A.crate(21.4, 21.6, 1.0); A.crate(22.5, 21.2, 0.8, '#c9a06a'); A.crate(20.2, 22.4, 0.9); } },
      { u: 19.6, v: 4.2, draw(A) { A.box(20.4, 22.6, 2.6, 4.4, 0, 0.9, '#2a2d30', '#1a1c1e', '#222426', null); const [x, y] = A.iso(21.5, 3.5, 0.9); A.ctx.fillStyle = '#f2efe8'; A.ctx.fillRect(x - 9, y - 3, 18, 5); } },
      { u: 22.8, v: 14.8, draw(A) { A.plant(22.8, 14.8, 1.1); } },
      { u: 1.6, v: 15, draw(A) { A.plant(1.6, 15.2, 1); } },
    ],
    walls(A) {
      A.wallQuad('right', 0.3, 23.7, 5.05, 6.3, 'hsl(150 8% 12%)', 'hsl(148 100% 60% / .3)');
      A.ctx.fillStyle = 'rgba(0,0,0,.55)'; for (let i = 0.6; i < 23.4; i += 0.5) for (let z = 5.25; z < 6.2; z += 0.3) { const [x, y] = A.wallBasis('right', i, z); A.ctx.fillRect(x - 0.9, y - 0.9, 1.8, 1.8); }
      for (let i = 0.3; i < 23.4; i += 0.9) { A.wallQuad('left', i, i + 0.45, 0, 0.35, '#ffc247', null); A.wallQuad('left', i + 0.45, i + 0.9, 0, 0.35, '#111', null); A.wallQuad('right', i, i + 0.45, 0, 0.35, '#ffc247', null); A.wallQuad('right', i + 0.45, i + 0.9, 0, 0.35, '#111', null); }
      A.wallText('PRINT SHOP', 'right', 14.2, 5.7, 'hsl(148 100% 72%)', 13);
    },
  };


  // ======================= CALL CENTRE =======================
  const support = {
    guide: {"what": "Handles customer messages for your shop. Paste in customer messages and it sorts them by urgency, checks their order in your store data and drafts a warm reply that fixes the problem.", "examples": ["Paste: 'Hi, my order hasn't arrived and it's been 2 weeks - Jane Smith'", "Paste a batch of 5 Etsy messages and draft replies for all of them", "A customer says the print is faded after one wash. Draft a reply offering a reprint"], "get": "Each message labelled with urgency, the matching order and tracking, a reply in your shop's voice, and a final tone check ready to copy into Etsy.", "tips": "Paste the full message including the customer's name so it can find their order. It never invents tracking numbers."},
    id: 'support', name: 'Call Centre', hue: 24, tagline: 'Headset pods, a live ticket queue and a break room.',
    mission: 'Handle customer messages for the shop: work out what each one needs, check the order, and draft a warm reply that fixes it.',
    brief: 'Paste customer messages here and the team drafts the replies.',
    floor: 'carpet', floorColor: 'hsl(20 18% 10%)',
    zones: [
      { id: 'floor', label: 'SUPPORT FLOOR', u: [7.4, 22.6], v: [7.6, 16.4] },
      { id: 'lead', label: 'TEAM LEAD', u: [0.8, 6], v: [9, 15.5] },
      { id: 'break', label: 'BREAK ROOM', u: [15.4, 23.2], v: [18.2, 23.2] },
    ],
    desks: [
      { zone: 'floor', u: 9.6, v: 9.4, kind: 'headset' }, { zone: 'floor', u: 13.1, v: 9.4, kind: 'headset' },
      { zone: 'floor', u: 9.6, v: 13.2, kind: 'headset' }, { zone: 'floor', u: 13.1, v: 13.2, kind: 'headset' },
    ],
    spare: [
      { zone: 'floor', u: 17.1, v: 9.4, kind: 'headset' }, { zone: 'floor', u: 20.6, v: 9.4, kind: 'headset' },
      { zone: 'floor', u: 17.1, v: 13.2, kind: 'headset' }, { zone: 'floor', u: 20.6, v: 13.2, kind: 'headset' },
      { zone: 'lead', u: 3.3, v: 12.2, kind: 'stand' },
    ],
    crew: [
      bot('Triage', 'Phones', 'chat', 'Read each customer message in the brief and label it (where is my order, damaged, wrong item, question, review) with how urgent it is.'),
      bot('Order Checker', 'Phones', 'search', 'Match each message to the orders in the store data and pull out the status and tracking.', { store: true }),
      bot('Reply Writer', 'Phones', 'mail', 'Write a short, warm reply for each message with a clear fix. Never invent tracking numbers or dates.'),
      bot('Tone Check', 'Phones', 'check', 'Check every reply for tone, accuracy and Etsy rules. Output the final replies ready to copy.'),
    ],
    cards: { left: [0, 1, 2, 7, 8], right: [0, 1, 2, 3, 4] },
    floorProps(A) { A.rug(15.8, 22.8, 18.6, 22.8, 'hsl(20 25% 15%)', 'hsl(20 35% 24%)'); },
    props: [
      { u: 8.6, v: 11.5, d: 21.6, draw(A) { A.box(8.6, 14.2, 11.45, 11.65, 0, 1.0, 'hsl(24 60% 40% / .35)', 'hsl(24 60% 30% / .35)', 'hsl(24 60% 35% / .35)', 'hsl(24 100% 70% / .5)'); } },
      { u: 16.1, v: 11.5, d: 29.1, draw(A) { A.box(16.1, 21.7, 11.45, 11.65, 0, 1.0, 'hsl(24 60% 40% / .35)', 'hsl(24 60% 30% / .35)', 'hsl(24 60% 35% / .35)', 'hsl(24 100% 70% / .5)'); } },
      { u: 17.4, v: 22, draw(A) { A.sofa(16.2, 20.8, 21.7, 22.9, '#4a3328'); } },
      { u: 22.2, v: 19.2, draw(A) { A.box(21.6, 22.8, 18.6, 19.8, 0, 2.2, '#2a2d33', '#1a1c20', '#222429', 'rgba(255,160,90,.4)'); A.screenAt(21.7, 22.7, 19.8, 1.0, 2.0, (x) => { const c = ['#ff5a4f', '#ffc247', '#46ff9a', '#5ac8ff']; for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) { x.fillStyle = c[(r + k) % 4]; x.fillRect(10 + k * 22, 6 + r * 13, 16, 9); } }); } },
      { u: 19.6, v: 19, draw(A) { A.cyl(19.6, 19.1, 0.3, 0, 1.1, '#cfe8ff', '#9ab'); A.cyl(19.6, 19.1, 0.24, 1.1, 1.6, 'rgba(120,190,255,.6)', 'rgba(120,190,255,.4)'); } },
      { u: 22.8, v: 1.6, draw(A) { A.plant(22.8, 1.6, 1.2); } },
      { u: 6.8, v: 22.6, draw(A) { A.plant(6.8, 22.6, 1.1); } },
    ],
    walls(A) {
      A.wallQuad('right', 13.3, 22.8, 1.3, 4.95, '#0a0503', 'hsl(24 100% 60% / .5)', 1.2);
      A.wallPaint('right', 13.3, 22.8, 1.3, 4.95, (x) => {
        x.fillStyle = '#ffb07a'; x.font = '700 7px Michroma, sans-serif'; x.fillText('TICKET QUEUE', 6, 10);
        const busy = A.anyBusy(); x.font = '700 13px Michroma, sans-serif'; x.fillStyle = busy ? '#ffc247' : '#6b4a33'; x.fillText(busy ? 'ON CALLS' : 'ALL CLEAR', 8, 32);
        for (let i = 0; i < 12; i++) { x.fillStyle = busy && (i + Math.floor(A.t * 3)) % 4 === 0 ? '#ffc247' : '#2a1a10'; x.fillRect(8 + i * 7.2, 44, 5, 6); }
      });
      A.wallQuad('left', 8.2, 17.9, 1.6, 4.6, '#120a06', 'hsl(24 100% 60% / .35)', 1);
      A.wallClip('left', 8.2, 17.9, 1.6, 4.6, () => { A.wallText('★ ★ ★ ★ ★', 'left', 9.4, 3.6, '#ffc247', 16); A.wallText('MAKE THEIR DAY', 'left', 9.4, 2.4, 'hsl(24 100% 75%)', 10); });
    },
  };

  // ======================= FINANCE OFFICE =======================
  const finance = {
    guide: {"what": "Shows how the business is really doing. It reads your store data and works out profit after every cost, where money is leaking and roughly what to put aside for tax. It's not an accountant, so use it to check, not to file.", "examples": ["Give me this month's profit picture and what to put aside for tax", "Which of my designs actually make money after fees and AI costs?", "How much have I spent on Claude this month and is it paying for itself?"], "get": "Sales, costs, Etsy fees, AI spend and profit with the working shown, your best and worst products, places to cut costs, and a tax-pot estimate with its assumptions written out.", "tips": "Sync your orders in the Store first so the numbers are fresh. Run it monthly on autopilot (every 720 hours)."},
    id: 'finance', name: 'Finance Office', hue: 44, tagline: 'Ledger desks, filing cabinets and a vault door.',
    mission: 'Keep track of how the business is really doing: profit after every cost, where money is leaking, and how much to put aside for tax. Not an accountant: flag anything that needs one.',
    brief: 'Give me this month’s profit picture and what to put aside for tax.',
    floor: 'carpet', floorColor: 'hsl(40 22% 9%)', deskTop: 'hsl(28 35% 20%)', deskL: 'hsl(28 35% 11%)', deskR: 'hsl(28 35% 15%)',
    zones: [
      { id: 'books', label: 'THE BOOKS', u: [7.4, 16.4], v: [7.4, 15.4] },
      { id: 'tax', label: 'TAX DESK', u: [17, 23.2], v: [10, 16] },
      { id: 'vault', label: 'VAULT', u: [16.8, 23.2], v: [0.8, 7.6] },
      { id: 'files', label: 'FILES', u: [0.8, 5.6], v: [8.6, 16] },
    ],
    desks: [
      { zone: 'books', u: 9.6, v: 9.6, kind: 'desk' }, { zone: 'books', u: 13.4, v: 9.6, kind: 'trader' },
      { zone: 'tax', u: 19.4, v: 12.4, kind: 'desk' },
    ],
    spare: [
      { zone: 'books', u: 9.6, v: 13, kind: 'desk' }, { zone: 'books', u: 13.4, v: 13, kind: 'desk' }, { zone: 'tax', u: 21.9, v: 12.4, kind: 'desk' },
    ],
    crew: [
      bot('Bookkeeper', 'Books', 'money', 'From the store data, lay out sales, production costs, Etsy fees, AI spend and profit. Show the working.', { store: true }),
      bot('Profit Analyst', 'Books', 'chart', 'Find which products make and lose money and where costs can be cut. Be specific.', { store: true }),
      bot('Tax Pot', 'Tax', 'cal', 'Estimate how much to put aside for UK income tax and National Insurance on this profit, with the assumptions written out. Say clearly that it is an estimate, not tax advice.', { web: true }),
    ],
    cards: { left: [], right: [0, 1, 2, 3, 4] },
    floorProps(A) { A.rug(8, 15.8, 8, 14.8, 'hsl(10 40% 16%)', 'hsl(40 60% 35%)'); A.rug(17, 23, 1, 7.4, 'hsl(40 10% 13%)', 'hsl(44 80% 50% / .5)'); },
    props: [
      { u: 16.8, v: 0.6, d: 17.6, draw(A) { A.glassWall(16.8, 0.6, 16.8, 7.8, 2.4); } },
      { u: 16.8, v: 7.8, d: 26, draw(A) { A.glassWall(16.8, 7.8, 23.6, 7.8, 2.4); } },
      ...[[18.4, 2.4], [19.6, 2.4], [18.4, 3.6], [21.4, 2.2]].map(([u, v], i) => ({ u, v, draw(A) { for (let k = 0; k < 3; k++) A.box(u - 0.4, u + 0.4, v - 0.2, v + 0.2, k * 0.2, k * 0.2 + 0.2, '#f1c24a', '#b88a1c', '#d4a32e', 'rgba(0,0,0,.2)'); } })),
      ...[9.4, 11, 12.6, 14.2].map((v) => ({ u: 1.3, v, draw(A) { A.box(0.9, 1.9, v - 0.7, v + 0.7, 0, 1.6, '#4a4f57', '#2e3238', '#3a3f46', null); for (let k = 0; k < 3; k++) { const [x, y] = A.iso(1.9, v, 0.3 + k * 0.5); A.ctx.fillStyle = '#c9ccd1'; A.ctx.fillRect(x - 3, y - 1, 6, 2); } } })),
      { u: 4, v: 20, draw(A) { A.chair(3.6, 19.6, '#5a3020'); A.chair(5.2, 19.6, '#5a3020'); A.cyl(4.4, 21, 0.5, 0, 0.45, '#3a2418', '#2a1810'); } },
      { u: 22.8, v: 22.6, draw(A) { A.plant(22.8, 22.6, 1.2); } },
      { u: 9, v: 22.6, draw(A) { A.plant(9, 22.6, 1); } },
    ],
    walls(A) {
      A.wallQuad('right', 16.9, 23.4, 0.2, 5.0, 'hsl(40 8% 14%)', 'hsl(44 80% 50% / .4)');
      const ctx = A.ctx, [cx, cy] = A.wallBasis('right', 20.1, 2.6);
      ctx.save(); ctx.translate(cx, cy); ctx.transform(1, 0.5, 0, 1, 0, 0);
      ctx.fillStyle = '#6b6e75'; ctx.beginPath(); ctx.arc(0, 0, 44, 0, 7); ctx.fill(); ctx.strokeStyle = '#2c2e33'; ctx.lineWidth = 4; ctx.stroke();
      ctx.fillStyle = '#8a8d95'; ctx.beginPath(); ctx.arc(0, 0, 34, 0, 7); ctx.fill();
      const rot = A.t * (A.anyBusy() ? 0.6 : 0.08); ctx.strokeStyle = '#d4a32e'; ctx.lineWidth = 3;
      for (let i = 0; i < 6; i++) { const a = rot + i * Math.PI / 3; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8); ctx.lineTo(Math.cos(a) * 26, Math.sin(a) * 26); ctx.stroke(); }
      ctx.fillStyle = '#d4a32e'; ctx.beginPath(); ctx.arc(0, 0, 8, 0, 7); ctx.fill(); ctx.restore();
      A.wallQuad('left', 0.6, 23.4, 3.6, 5.6, '#1a120a', 'hsl(44 80% 50% / .3)');
      A.wallPaint('left', 0.6, 23.4, 3.6, 5.6, (x) => { x.strokeStyle = '#46ff9a'; x.lineWidth = 1.2; x.beginPath(); for (let i = 0; i <= 40; i++) { const yy = 46 - i * 0.7 - Math.sin(i * 0.5 + A.t * 0.5) * 5; i ? x.lineTo(4 + i * 2.3, yy) : x.moveTo(4, yy); } x.stroke(); x.fillStyle = '#f1c24a'; x.font = '700 9px monospace'; x.fillText('P&L  ▲', 6, 14); });
    },
  };

  // ======================= MUSIC STUDIO =======================
  const music = {
    guide: {"what": "Gets your music heard. Tell it about your beats or release and it finds real artists who suit your sound, playlists that take submissions, plans the release and writes your posts and pitches.", "examples": ["Plan the release of my next beat pack and find 10 artists and 10 playlists to pitch it to", "Find UK drill artists with under 10k followers who'd suit dark melodic beats", "Write a release plan and a week of posts for my new single dropping on the 1st"], "get": "Artist and playlist lists with links and how to submit, a week-by-week release plan, posts and short-video ideas, and personal pitch messages ready to send.", "tips": "Describe your sound (genre, BPM, vibe) and link your profile in the brief. Pitch emails go to the outbox for you to approve."},
    id: 'music', name: 'Music Studio', hue: 300, tagline: 'Mixing console, vocal booth, plaques on the wall and an A&R desk.',
    mission: 'Get the music heard: find artists to pitch beats to, plan releases, pitch playlists and write the posts and pitch emails.',
    brief: 'Plan the release of my next beat pack and find 10 artists and 10 playlists to pitch it to.',
    floor: 'studio', floorColor: 'hsl(280 18% 10%)', chairColor: '#3a2340',
    zones: [
      { id: 'control', label: 'CONTROL ROOM', u: [7.4, 16.4], v: [7, 13.6] },
      { id: 'booth', label: 'VOCAL BOOTH', u: [17.4, 23.2], v: [1, 8] },
      { id: 'anr', label: 'A&R', u: [14, 22.8], v: [15.6, 22.8] },
      { id: 'lounge', label: 'LOUNGE', u: [0.8, 6], v: [11.5, 22.5] },
    ],
    desks: [
      { zone: 'anr', u: 15.8, v: 17.4, kind: 'desk' }, { zone: 'anr', u: 19.2, v: 17.4, kind: 'desk' },
      { zone: 'control', u: 12, v: 9.4, kind: 'console' }, { zone: 'booth', u: 20.3, v: 4.2, kind: 'stand' },
      { zone: 'anr', u: 15.8, v: 20.6, kind: 'desk' },
    ],
    spare: [
      { zone: 'anr', u: 19.2, v: 20.6, kind: 'desk' }, { zone: 'lounge', u: 2.1, v: 14, kind: 'sofa' },
      { zone: 'lounge', u: 2.1, v: 16.3, kind: 'sofa' }, { zone: 'lounge', u: 2.1, v: 18.6, kind: 'sofa' },
    ],
    crew: [
      bot('A&R Scout', 'A&R', 'search', 'Find real up-and-coming artists who would suit the beats in the brief: name, where they post, their sound and why they fit. Link sources.', { web: true }),
      bot('Playlist Pitcher', 'A&R', 'radar', 'Find playlists and curators that accept submissions in this genre, with links and how to submit.', { web: true }),
      bot('Release Planner', 'Control', 'cal', 'Plan the release week by week: dates, assets needed, where it goes live and what to post when.'),
      bot('Content Writer', 'Booth', 'wave', 'Write the posts, captions and short video ideas for the release, in the artist’s voice.'),
      bot('Pitch Writer', 'A&R', 'mail', 'Write short, personal pitch messages for the best artists and curators. Mention something real about each one.', { email: true }, { approve: true }),
    ],
    cards: { left: [0, 1, 2], right: [0, 1, 2, 3, 4, 5] },
    floorProps(A) { A.rug(1, 5.6, 12.2, 21.8, 'hsl(300 25% 16%)', 'hsl(300 40% 26%)'); A.rug(8, 16, 7.6, 13, 'hsl(280 20% 13%)', null); },
    props: [
      { u: 12, v: 11.4, d: 23, draw(A) {
        A.box(8.8, 15.2, 10.8, 11.9, 0, 0.8, '#1d1a22', '#121016', '#18151c', 'hsl(300 100% 70% / .4)');
        const busy = A.anyBusy();
        for (let i = 0; i < 24; i++) { const [x, y] = A.iso(9.1 + i * 0.25, 11.35, 0.82); A.ctx.fillStyle = i % 4 === 0 ? '#ff6bd5' : '#bbb'; A.ctx.fillRect(x - 0.7, y - 2 - (busy ? Math.abs(Math.sin(A.t * 5 + i)) * 3 : 1), 1.4, 2.5); }
        A.screenAt(10.6, 13.4, 10.85, 0.8, 1.5, A.screenArt('wave', busy));
      } },
      ...[[8.6, 9.2], [15.4, 9.2]].map(([u, v]) => ({ u, v, draw(A) { A.cyl(u, v, 0.08, 0, 1.1, '#333', '#222'); A.box(u - 0.35, u + 0.35, v - 0.3, v + 0.3, 1.1, 2.0, '#18161c', '#0e0d11', '#141217', null); const [x, y] = A.iso(u, v + 0.3, 1.55); const p = A.anyBusy() ? 1 + Math.sin(A.t * 14) * 0.15 : 1; A.ctx.fillStyle = '#333'; A.ctx.beginPath(); A.ctx.ellipse(x, y, 5 * p, 6 * p, 0, 0, 7); A.ctx.fill(); A.ctx.fillStyle = '#ff6bd5'; A.ctx.beginPath(); A.ctx.arc(x, y, 1.6, 0, 7); A.ctx.fill(); } })),
      { u: 17.2, v: 0.6, d: 17.8, draw(A) { A.glassWall(17.2, 0.6, 17.2, 8.4, 2.6); } },
      { u: 17.2, v: 8.4, d: 27, draw(A) { A.glassWall(17.2, 8.4, 23.6, 8.4, 2.6); } },
      { u: 20.3, v: 5, draw(A) { A.micArm(20.6, 5.4, 0, 20.3, 4.2, A.anyBusy()); } },
      { u: 1.7, v: 13, d: 14, draw(A) { A.sofa(1.0, 2.6, 13, 20, '#3d2a45', 'u'); } },
      { u: 22.8, v: 22.6, draw(A) { A.plant(22.8, 22.6, 1.2); } },
      { u: 8, v: 22.6, draw(A) { A.plant(8, 22.6, 1); } },
    ],
    walls(A) {
      for (let i = 0; i < 6; i++) { const s0 = 8.6 + i * 2.5; A.wallQuad('left', s0, s0 + 2, 1.8, 4.4, '#0d0a10', 'hsl(44 80% 60% / .5)', 1); const [x, y] = A.wallBasis('left', s0 + 1, 3.2); const ctx = A.ctx; ctx.fillStyle = i % 3 === 2 ? '#d9dde3' : '#e8c24a'; ctx.beginPath(); ctx.ellipse(x, y, 13, 16, -0.45, 0, 7); ctx.fill(); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.ellipse(x, y, 3, 4, -0.45, 0, 7); ctx.fill(); }
      A.wallText('GOLD · PLATINUM', 'left', 9, 5.0, 'hsl(44 90% 65%)', 9);
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) { const s0 = 17.4 + i * 1.03, z0 = 0.5 + j * 0.78; A.wallQuad('right', s0, s0 + 0.95, z0, z0 + 0.72, (i + j) % 2 ? 'hsl(300 25% 14%)' : 'hsl(300 30% 10%)', 'rgba(0,0,0,.5)', 0.8); }
      const rec = A.anyBusy() && Math.sin(A.t * 2.6) > -0.6;
      A.wallQuad('right', 18.2, 22.6, 5.15, 6.0, rec ? 'hsl(330 90% 45%)' : 'hsl(330 40% 15%)', '#ff8bd8', 1.2);
      A.wallText('RECORDING', 'right', 18.5, 5.58, '#fff', 11);
    },
  };

  const ALL = { podcast, video, trading, sales, research, dev, support, finance, music, store };
  for (const r of Object.values(ALL)) { r.capacity = r.desks.length + (r.spare || []).length; r.chief = r.chief || { u: 4, v: 4 }; }
  window.Rooms = {
    get: (id) => ALL[id] || null,
    list: () => Object.values(ALL).filter((r) => !r.internal),
    crew: (id) => (ALL[id]?.crew || []).map((b) => ({ ...b, tools: { ...b.tools } })),
    ALL,
  };
})();
