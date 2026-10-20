// Kivo Ultron — the Store as an isometric print shop that matches the rest of the suite.
// Wraps the classic pixel station so the rest of the app keeps calling Station.* and both floors stay in sync.
(() => {
  const classic = window.Station;
  const CREW = [
    { id: 'scout', name: 'Scout', team: 'Trends', icon: 'radar' },
    { id: 'analyst', name: 'Analyst', team: 'Sales', icon: 'chart' },
    { id: 'ledger', name: 'Ledger', team: 'Pricing', icon: 'money' },
    { id: 'scribe', name: 'Scribe', team: 'Listings', icon: 'doc' },
    { id: 'forge', name: 'Forge', team: 'Design', icon: 'palette' },
    { id: 'auditor', name: 'Auditor', team: 'Quality', icon: 'check' },
    { id: 'courier', name: 'Courier', team: 'Shipping', icon: 'send' },
  ];
  const iso = OfficeKit.create({ hue: 148, style: 'workshop', chiefTitle: 'ULTRON · COMMANDER', chiefIdle: 'Awaiting orders', headL: 'YOUR SHOP', headR: 'DESIGN WALL' });
  iso.configure({ agents: CREW });
  let floor = 'workshop', on = false;
  const $ = (s) => document.querySelector(s);
  function apply() {
    const cls = floor === 'classic';
    $('#station').hidden = !on || !cls; $('#room-labels').hidden = !on || !cls;
    $('#storefloor').hidden = !on || cls; iso.show(on && !cls);
    if (on) requestAnimationFrame(() => (cls ? classic.relayout() : iso.relayout()));
  }
  window.StoreFloor = iso;
  window.Station = {
    init(cv, lbl, cb) { classic.init(cv, lbl, cb); iso.init($('#storefloor'), cb); },
    setBusy(...a) { classic.setBusy(...a); iso.setBusy(...a); },
    packet(from, to, c) { classic.packet(from, to, c); iso.packet(from, to); },
    highlight: (id) => classic.highlight(id),
    launchShuttle: () => classic.launchShuttle(),
    focus(id) { classic.focus(id); iso.focus(id); },
    relayout() { classic.relayout(); iso.relayout(); },
    setHires(list) { classic.setHires(list); iso.setExtras(list); },
    ROOMS: classic.ROOMS,
    show(v) { on = !!v; apply(); },
    setFloor(f) { floor = f === 'classic' ? 'classic' : OfficeKit.STYLES[f] ? f : 'workshop'; if (floor !== 'classic') iso.configure({ style: floor }); apply(); },
    get floor() { return floor; },
    setWalls(media, headL, headR) { iso.setMedia(media); iso.setHeaders(headL, headR); },
  };
})();
