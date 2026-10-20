// Kivo Ultron — social posting: Instagram (Instagram Login), TikTok (Content Posting API), Pinterest (API v5)
// Endpoints follow the platforms' published docs (checked Oct 2026). Every call goes through the main process.
(() => {
  const K = window.KU;
  const el = (t, c, x) => { const e = document.createElement(t); if (c) e.className = c; if (x != null) e.textContent = x; return e; };
  const btn = (l, f, c) => { const b = el('button', 'hw-btn ' + (c || ''), l); b.onclick = f; return b; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const PORT = 53682;
  const REDIRECT = {
    instagram: 'https://tomosmira823-wq.github.io/ULTRON-/oauth/', // HTTPS page that hands the code back to the app on 127.0.0.1
    tiktok: `http://127.0.0.1:${PORT}/callback/tiktok/`,
    pinterest: `http://localhost:${PORT}/callback/pinterest/`,
  };
  let cfg = {};
  const load = async () => { cfg = (await kivo.socialGet()) || {}; };
  const put = async (pl, patch) => { cfg[pl] = { ...(cfg[pl] || {}), ...patch }; await kivo.socialSet({ [pl]: cfg[pl] }); };
  const drop = async (pl) => { const keep = { appId: cfg[pl]?.appId, appSecret: cfg[pl]?.appSecret, cloud: cfg[pl]?.cloud, preset: cfg[pl]?.preset, link: cfg[pl]?.link, privacy: cfg[pl]?.privacy }; cfg[pl] = keep; await kivo.socialSet({ [pl]: keep }); };

  async function req(o) {
    const r = await kivo.socialReq(o).catch((e) => { throw new Error(K.cleanErr(e)); });
    if (!r.ok) {
      const d = r.data, msg = d?.error?.message || d?.error_description || d?.message || d?.error?.code || (typeof d === 'string' ? d.slice(0, 200) : JSON.stringify(d).slice(0, 200));
      const e = new Error(`${r.status}: ${msg}`); e.data = d; throw e;
    }
    return r.data;
  }
  const qs = (o) => new URLSearchParams(Object.entries(o).filter(([, v]) => v !== undefined && v !== null)).toString();
  const fullCaption = (p) => [p.caption, (p.hashtags || []).join(' ')].filter(Boolean).join('\n\n');

  function connected(pl) {
    const c = cfg[pl]; if (!c?.token) return false;
    if (pl === 'instagram' && !(c.cloud && c.preset)) return false;
    if (pl === 'pinterest' && !c.boardId) return false;
    return true;
  }

  // ================= OAuth =================
  async function connect(pl) {
    const c = cfg[pl] || {};
    if (!c.appId || !c.appSecret) throw new Error('Fill in the app ID and secret first.');
    const pk = await kivo.oauthPkce();
    let url;
    if (pl === 'instagram') url = 'https://www.instagram.com/oauth/authorize?' + qs({ client_id: c.appId, redirect_uri: REDIRECT.instagram, response_type: 'code', scope: 'instagram_business_basic,instagram_business_content_publish,instagram_business_manage_insights,instagram_business_manage_comments', state: pk.state });
    if (pl === 'tiktok') url = 'https://www.tiktok.com/v2/auth/authorize/?' + qs({ client_key: c.appId, scope: 'user.info.basic,video.publish,video.list', response_type: 'code', redirect_uri: REDIRECT.tiktok, state: pk.state, code_challenge: pk.hex, code_challenge_method: 'S256' });
    if (pl === 'pinterest') url = 'https://www.pinterest.com/oauth/?' + qs({ client_id: c.appId, redirect_uri: REDIRECT.pinterest, response_type: 'code', scope: 'boards:read,boards:write,pins:read,pins:write,user_accounts:read', state: pk.state });
    K.toast(`Opening ${pl} in your browser — approve access there.`);
    const q = await kivo.oauthStart({ authUrl: url, state: pk.state });
    const code = String(q.code || '').replace(/#_$/, '');
    if (pl === 'instagram') {
      const short = await req({ url: 'https://api.instagram.com/oauth/access_token', method: 'POST', form: { client_id: c.appId, client_secret: c.appSecret, grant_type: 'authorization_code', redirect_uri: REDIRECT.instagram, code } });
      const st = short.data?.[0] || short;
      const long = await req({ url: 'https://graph.instagram.com/access_token?' + qs({ grant_type: 'ig_exchange_token', client_secret: c.appSecret, access_token: st.access_token }) });
      const me = await req({ url: 'https://graph.instagram.com/me?' + qs({ fields: 'user_id,username', access_token: long.access_token }) });
      await put(pl, { token: long.access_token, expiresAt: Date.now() + (long.expires_in || 5184000) * 1000, issuedAt: Date.now(), userId: me.user_id || st.user_id, username: me.username });
    }
    if (pl === 'tiktok') {
      const t = await req({ url: 'https://open.tiktokapis.com/v2/oauth/token/', method: 'POST', form: { client_key: c.appId, client_secret: c.appSecret, code, grant_type: 'authorization_code', redirect_uri: REDIRECT.tiktok, code_verifier: pk.verifier } });
      const tok = t.data || t;
      if (!tok.access_token) throw new Error(tok.error_description || 'TikTok didn’t return a token');
      let username = '';
      try { const u = await req({ url: 'https://open.tiktokapis.com/v2/user/info/?fields=open_id,display_name', headers: { Authorization: 'Bearer ' + tok.access_token } }); username = u.data?.user?.display_name || ''; } catch {}
      await put(pl, { token: tok.access_token, refresh: tok.refresh_token, expiresAt: Date.now() + (tok.expires_in || 86400) * 1000, refreshExpiresAt: Date.now() + (tok.refresh_expires_in || 31536000) * 1000, openId: tok.open_id, username });
    }
    if (pl === 'pinterest') {
      const t = await req({ url: 'https://api.pinterest.com/v5/oauth/token', method: 'POST', headers: { Authorization: 'Basic ' + btoa(c.appId + ':' + c.appSecret) }, form: { grant_type: 'authorization_code', code, redirect_uri: REDIRECT.pinterest, continuous_refresh: 'true' } });
      await put(pl, { token: t.access_token, refresh: t.refresh_token, expiresAt: Date.now() + (t.expires_in || 2592000) * 1000 });
      try { const me = await req({ url: 'https://api.pinterest.com/v5/user_account', headers: auth('pinterest') }); await put(pl, { username: me.username }); } catch {}
      await loadBoards();
    }
    K.log('mk.publish', `${pl[0].toUpperCase() + pl.slice(1)} connected${cfg[pl].username ? ' as ' + cfg[pl].username : ''}.`, 'ok');
  }
  const auth = (pl) => ({ Authorization: 'Bearer ' + cfg[pl].token });
  async function fresh(pl) {
    const c = cfg[pl]; if (!c?.token) throw new Error(`${pl} isn’t connected`);
    const soon = c.expiresAt - Date.now() < (pl === 'tiktok' ? 30 * 60e3 : 7 * 864e5);
    if (!soon) return;
    if (pl === 'instagram' && Date.now() - (c.issuedAt || 0) > 864e5) {
      const r = await req({ url: 'https://graph.instagram.com/refresh_access_token?' + qs({ grant_type: 'ig_refresh_token', access_token: c.token }) });
      await put(pl, { token: r.access_token, expiresAt: Date.now() + (r.expires_in || 5184000) * 1000, issuedAt: Date.now() });
    }
    if (pl === 'tiktok' && c.refresh) {
      const r = await req({ url: 'https://open.tiktokapis.com/v2/oauth/token/', method: 'POST', form: { client_key: c.appId, client_secret: c.appSecret, grant_type: 'refresh_token', refresh_token: c.refresh } });
      const t = r.data || r; await put(pl, { token: t.access_token, refresh: t.refresh_token || c.refresh, expiresAt: Date.now() + (t.expires_in || 86400) * 1000 });
    }
    if (pl === 'pinterest' && c.refresh) {
      const r = await req({ url: 'https://api.pinterest.com/v5/oauth/token', method: 'POST', headers: { Authorization: 'Basic ' + btoa(c.appId + ':' + c.appSecret) }, form: { grant_type: 'refresh_token', refresh_token: c.refresh, continuous_refresh: 'true' } });
      await put(pl, { token: r.access_token, refresh: r.refresh_token || c.refresh, expiresAt: Date.now() + (r.expires_in || 2592000) * 1000 });
    }
  }
  async function loadBoards() {
    const r = await req({ url: 'https://api.pinterest.com/v5/boards?page_size=100', headers: auth('pinterest') });
    const boards = (r.items || []).map((b) => ({ id: b.id, name: b.name }));
    await put('pinterest', { boards, boardId: cfg.pinterest.boardId || boards[0]?.id || '' });
  }

  // ================= publishing =================
  async function publish(pl, p, step = () => {}) {
    await fresh(pl);
    if (pl === 'instagram') return publishIG(p, step);
    if (pl === 'tiktok') return publishTT(p, step);
    if (pl === 'pinterest') return publishPin(p, step);
    throw new Error('Unknown platform');
  }
  async function publishIG(p, step) {
    const c = cfg.instagram, file = p.files?.video || p.files?.feed;
    if (!file) throw new Error('Nothing rendered to post');
    step('Uploading to media host');
    const isVid = p.format === 'video';
    const host = await kivo.socialHost({ cloud: c.cloud, preset: c.preset, filePath: file, resource: isVid ? 'video' : 'image' });
    const mediaUrl = isVid ? host.url : host.url.replace(/\.(png|webp)$/i, '.jpg'); // Instagram images must be JPEG
    step('Creating Instagram container');
    const body = isVid ? { media_type: 'REELS', video_url: mediaUrl, caption: fullCaption(p), share_to_feed: 'true' } : { image_url: mediaUrl, caption: fullCaption(p) };
    const cont = await req({ url: `https://graph.instagram.com/${c.userId}/media`, method: 'POST', form: { ...body, access_token: c.token } });
    // wait for processing (docs: poll status_code until FINISHED)
    for (let i = 0; i < (isVid ? 20 : 8); i++) {
      const s = await req({ url: `https://graph.instagram.com/${cont.id}?` + qs({ fields: 'status_code', access_token: c.token }) });
      if (s.status_code === 'FINISHED') break;
      if (s.status_code === 'ERROR' || s.status_code === 'EXPIRED') throw new Error('Instagram couldn’t process the media (' + s.status_code + ')');
      step(`Instagram processing… (${i + 1})`); await sleep(isVid ? 15000 : 4000);
    }
    step('Publishing');
    const pub = await req({ url: `https://graph.instagram.com/${c.userId}/media_publish`, method: 'POST', form: { creation_id: cont.id, access_token: c.token } });
    let url = '';
    try { url = (await req({ url: `https://graph.instagram.com/${pub.id}?` + qs({ fields: 'permalink', access_token: c.token }) })).permalink; } catch {}
    return { id: pub.id, url };
  }
  async function publishTT(p, step) {
    const c = cfg.tiktok, file = p.files?.video;
    if (!file) throw new Error('TikTok posts need a video');
    step('Checking TikTok account');
    const ci = await req({ url: 'https://open.tiktokapis.com/v2/post/publish/creator_info/query/', method: 'POST', headers: auth('tiktok'), json: {} });
    const opts = ci.data?.privacy_level_options || [];
    let privacy = opts.includes(c.privacy) ? c.privacy : opts.includes('PUBLIC_TO_EVERYONE') ? 'PUBLIC_TO_EVERYONE' : opts[0] || 'SELF_ONLY';
    const size = await kivo.mediaSize(file);
    const chunk = size <= 64 * 1024 * 1024 ? size : 10 * 1024 * 1024, total = size <= chunk ? 1 : Math.floor(size / chunk);
    let note = '';
    const init = async (priv) => req({ url: 'https://open.tiktokapis.com/v2/post/publish/video/init/', method: 'POST', headers: auth('tiktok'), json: {
      post_info: { title: fullCaption(p).slice(0, 2200), privacy_level: priv, disable_duet: false, disable_stitch: false, disable_comment: false, video_cover_timestamp_ms: 500, is_aigc: true },
      source_info: { source: 'FILE_UPLOAD', video_size: size, chunk_size: chunk, total_chunk_count: total } } });
    let r;
    try { r = await init(privacy); }
    catch (e) { if (/unaudited_client_can_only_post_to_private/.test(JSON.stringify(e.data || e.message))) { privacy = 'SELF_ONLY'; note = 'posted as private — TikTok keeps posts private until your app passes their audit'; r = await init(privacy); } else throw e; }
    const { publish_id, upload_url } = r.data || {};
    for (let i = 0; i < total; i++) {
      const start = i * chunk, end = i === total - 1 ? size - 1 : start + chunk - 1;
      step(`Uploading video ${total > 1 ? `part ${i + 1}/${total}` : ''}`);
      const up = await kivo.socialReq({ url: upload_url, method: 'PUT', headers: { 'Content-Type': 'video/mp4', 'Content-Range': `bytes ${start}-${end}/${size}` }, filePath: file, range: [start, end] });
      if (![200, 201, 206].includes(up.status)) throw new Error('TikTok upload failed (' + up.status + ')');
    }
    for (let i = 0; i < 36; i++) {
      const s = await req({ url: 'https://open.tiktokapis.com/v2/post/publish/status/fetch/', method: 'POST', headers: auth('tiktok'), json: { publish_id } });
      const d = s.data || {};
      if (d.status === 'PUBLISH_COMPLETE') { const vid = (d.publicaly_available_post_id || [])[0]; return { id: vid ? String(vid) : publish_id, url: vid && c.username ? `https://www.tiktok.com/@${c.username}/video/${vid}` : '', note }; }
      if (d.status === 'FAILED') throw new Error('TikTok: ' + (d.fail_reason || 'publish failed'));
      step('TikTok processing…'); await sleep(5000);
    }
    return { id: publish_id, url: '', note: (note ? note + '; ' : '') + 'still processing on TikTok' };
  }
  async function publishPin(p, step) {
    const c = cfg.pinterest, file = p.files?.pin || p.files?.feed;
    if (!file) throw new Error('Pinterest pins need an image');
    step('Uploading pin');
    const data = (await kivo.mediaRead(file)).data;
    const pin = await req({ url: 'https://api.pinterest.com/v5/pins', method: 'POST', headers: auth('pinterest'), json: {
      board_id: c.boardId, title: (p.pinTitle || p.hook || '').slice(0, 100), description: (p.caption || '').slice(0, 800), link: c.link || undefined, alt_text: (p.art?.headline || p.hook || '').slice(0, 500),
      media_source: { source_type: 'image_base64', content_type: 'image/png', data } } });
    return { id: pin.id, url: `https://www.pinterest.com/pin/${pin.id}/` };
  }

  // ================= stats + comments =================
  async function metrics(pl, p) {
    await fresh(pl);
    if (pl === 'instagram') {
      const r = await req({ url: `https://graph.instagram.com/${p.remoteId}/insights?` + qs({ metric: 'views,reach,likes,comments,shares,saved', access_token: cfg.instagram.token }) });
      const v = {}; for (const m of r.data || []) v[m.name] = m.total_value?.value ?? m.values?.[0]?.value ?? 0;
      return { views: v.views ?? v.reach ?? 0, likes: v.likes || 0, comments: v.comments || 0, shares: v.shares || 0, saves: v.saved || 0 };
    }
    if (pl === 'tiktok') {
      const r = await req({ url: 'https://open.tiktokapis.com/v2/video/query/?fields=id,view_count,like_count,comment_count,share_count', method: 'POST', headers: auth('tiktok'), json: { filters: { video_ids: [p.remoteId] } } });
      const v = r.data?.videos?.[0]; if (!v) return null;
      return { views: v.view_count || 0, likes: v.like_count || 0, comments: v.comment_count || 0, shares: v.share_count || 0 };
    }
    if (pl === 'pinterest') {
      const d = (x) => new Date(x).toISOString().slice(0, 10);
      const r = await req({ url: `https://api.pinterest.com/v5/pins/${p.remoteId}/analytics?` + qs({ start_date: d(Math.max(p.postedAt, Date.now() - 89 * 864e5)), end_date: d(Date.now()), metric_types: 'IMPRESSION,SAVE,PIN_CLICK,OUTBOUND_CLICK' }), headers: auth('pinterest') });
      const life = r.all?.lifetime_metrics || r.lifetime_metrics || {};
      let sum = { IMPRESSION: 0, SAVE: 0, PIN_CLICK: 0, OUTBOUND_CLICK: 0 };
      if (Object.keys(life).length) sum = { ...sum, ...life };
      else for (const day of r.all?.daily_metrics || []) for (const k of Object.keys(sum)) sum[k] += day.metrics?.[k] || 0;
      return { views: sum.IMPRESSION, saves: sum.SAVE, clicks: sum.PIN_CLICK, outbound: sum.OUTBOUND_CLICK };
    }
  }
  async function comments(pl, p) {
    if (pl !== 'instagram') return [];
    await fresh(pl);
    const r = await req({ url: `https://graph.instagram.com/${p.remoteId}/comments?` + qs({ fields: 'id,text,username,timestamp', access_token: cfg.instagram.token }) });
    return (r.data || []).map((c) => ({ id: c.id, text: c.text, username: c.username, at: c.timestamp }));
  }
  async function reply(pl, c, text) {
    if (!text.trim()) throw new Error('Write a reply first');
    await fresh(pl);
    await req({ url: `https://graph.instagram.com/${c.id}/replies`, method: 'POST', form: { message: text, access_token: cfg.instagram.token } });
  }

  // ================= account cards =================
  const GUIDE = {
    instagram: {
      title: 'Instagram', color: '#ff4fa3',
      steps: [
        ['Switch your Instagram to a Professional account (Settings → Account type).', null],
        ['Create an app at Meta for Developers, add the “Instagram API with Instagram Login” product.', 'https://developers.facebook.com/apps/'],
        ['Under Business login settings add this redirect URL:', null, REDIRECT.instagram],
        ['Add your Instagram account as a tester in the app’s Roles, then copy the Instagram app ID and secret below.', null],
        ['Instagram only takes media from a public link, so add a free Cloudinary account: copy your cloud name and create an unsigned upload preset (Settings → Upload).', 'https://cloudinary.com/users/register_free'],
      ],
      note: 'Works for your own account straight away. Other people’s accounts need Meta App Review.',
      fields: [['appId', 'Instagram app ID'], ['appSecret', 'Instagram app secret', true], ['cloud', 'Cloudinary cloud name'], ['preset', 'Cloudinary unsigned preset']],
    },
    tiktok: {
      title: 'TikTok', color: '#25f4ee',
      steps: [
        ['Create an app at TikTok for Developers. Add Login Kit and the Content Posting API with Direct Post on.', 'https://developers.tiktok.com/apps/'],
        ['Add this redirect URL (Login Kit → Desktop):', null, REDIRECT.tiktok],
        ['Request the user.info.basic, video.publish and video.list scopes, then copy the client key and secret below.', null],
      ],
      note: 'Until TikTok audits your app, posts go up as private (only you can see them). Videos only — TikTok’s API doesn’t take photo posts from a desktop app.',
      fields: [['appId', 'Client key'], ['appSecret', 'Client secret', true]],
    },
    pinterest: {
      title: 'Pinterest', color: '#e60023',
      steps: [
        ['Use a Pinterest business account. Create an app at Pinterest Developers and request Trial access.', 'https://developers.pinterest.com/apps/'],
        ['Add this redirect URI to the app:', null, REDIRECT.pinterest],
        ['Copy the app ID and secret below. Add your Etsy shop link so pins send people there.', null],
      ],
      note: 'On Trial access, pins are only visible to you (sandbox). Ask Pinterest for Standard access to go public.',
      fields: [['appId', 'App ID'], ['appSecret', 'App secret', true], ['link', 'Etsy shop link (pins link here)']],
    },
  };
  function accountCard(pl) {
    const g = GUIDE[pl], c = cfg[pl] || {}, card = el('div', 'acc');
    card.style.setProperty('--pc', g.color);
    const head = el('div', 'acc-head'); head.append(el('b', '', g.title), el('span', 'pill ' + (connected(pl) ? 'pass' : c.token ? 'medium' : ''), connected(pl) ? 'CONNECTED' : c.token ? 'NEEDS SETUP' : 'NOT CONNECTED'));
    card.append(head);
    if (c.token) {
      card.append(el('div', 'tiny', `Signed in${c.username ? ' as ' + c.username : ''} · token renews automatically (expires ${new Date(c.expiresAt).toLocaleDateString()})`));
      if (pl === 'pinterest') {
        const sel = el('select'); for (const b of c.boards || []) { const o = el('option', '', b.name); o.value = b.id; sel.append(o); }
        sel.value = c.boardId || ''; sel.onchange = async () => { await put(pl, { boardId: sel.value }); MK.renderAll(); };
        card.append(el('label', 'lbl', 'BOARD TO PIN TO'), sel, btn('REFRESH BOARDS', async () => { try { await loadBoards(); MK.renderAll(); } catch (e) { K.toast(K.cleanErr(e), true); } }, 'mini'));
      }
      if (pl === 'tiktok') {
        const sel = el('select'); for (const [v, n] of [['PUBLIC_TO_EVERYONE', 'Public'], ['FOLLOWER_OF_CREATOR', 'Followers'], ['MUTUAL_FOLLOW_FRIENDS', 'Friends'], ['SELF_ONLY', 'Only me']]) { const o = el('option', '', n); o.value = v; sel.append(o); }
        sel.value = c.privacy || 'PUBLIC_TO_EVERYONE'; sel.onchange = async () => { await put(pl, { privacy: sel.value }); };
        card.append(el('label', 'lbl', 'WHO CAN SEE POSTS'), sel);
      }
    } else {
      const ol = el('ol', 'wz-how');
      for (const [t, link, copy] of g.steps) {
        const li = el('li', '', t + ' ');
        if (link) { const a = el('button', 'link', 'open ↗'); a.onclick = () => kivo.openUrl(link); li.append(a); }
        if (copy) { const cp = el('code', 'copy', copy); cp.title = 'Click to copy'; cp.onclick = async () => { try { await navigator.clipboard.writeText(copy); K.toast('Copied'); } catch {} }; li.append(el('br'), cp); }
        ol.append(li);
      }
      card.append(ol);
    }
    const inputs = {};
    for (const [k, label, secret] of g.fields) {
      if (c.token && ['appId', 'appSecret'].includes(k)) continue;
      const i = el('input'); i.type = secret ? 'password' : 'text'; i.placeholder = label; i.value = secret ? '' : c[k] || '';
      if (secret && c[k]) i.placeholder = label + ' (saved)';
      inputs[k] = i; card.append(el('label', 'lbl', label.toUpperCase()), i);
    }
    const save = async () => { const patch = {}; for (const [k, i] of Object.entries(inputs)) if (i.value.trim()) patch[k] = i.value.trim(); if (Object.keys(patch).length) await put(pl, patch); };
    const row = el('div', 'row wrap');
    if (!c.token) row.append(btn('CONNECT', async (e) => { e.target.disabled = true; try { await save(); await connect(pl); K.toast(`${g.title} connected`); } catch (err) { K.toast(K.cleanErr(err), true); K.log('mk.publish', `${g.title} connect failed: ${K.cleanErr(err)}`, 'err'); } e.target.disabled = false; MK.renderAll(); }, 'go'));
    else row.append(btn('SAVE', async () => { await save(); K.toast('Saved'); MK.renderAll(); }), btn('DISCONNECT', async () => { await drop(pl); MK.renderAll(); }, 'danger'));
    card.append(row, el('div', 'tiny dim', g.note));
    return card;
  }

  window.SOCIAL = { load, connected, connect, publish, metrics, comments, reply, accountCard, REDIRECT, get cfg() { return cfg; } };
})();
