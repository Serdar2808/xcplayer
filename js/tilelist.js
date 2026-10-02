// ── LIVE-BEDIENUNG: Kachel-Senderliste, Duplikate, Touch-Buttons ─────
// Alle Geräte. Einstellung "Kachel-Senderliste" (Settings.tileList, schließt die
// kompakte Liste aus):
//   TV/Fernbedienung  OK = Kacheln unten, Fokus auf dem laufenden Sender
//                     (hoch = Kategorien, links/rechts = blättern, OK = starten);
//                     links/rechts im Bild = Duplikate als senkrechte Liste rechts.
//                     Live-OSD steht oben, Buttons gibt es auf der Fernbedienung.
//   Smartphone        Tippen ins Bild: Zurück · Voriger/Play-Pause/Nächster ·
//                     Duplikate rechts · unten die Kacheln - bzw. bei kompakter
//                     Senderliste die Liste links, sonst ein Button "Senderliste".
var LiveUi = (function () {
  var UI_MS = 8000;
  var ICON_PREV = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 6h2.2v12H6zM9.6 12 18 18V6z"/></svg>';
  var ICON_NEXT = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M15.8 6H18v12h-2.2zM6 18l8.4-6L6 6z"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M8 5v14l11-7z"/></svg>';
  var ICON_PAUSE = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
  var ICON_BACK = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/></svg>';
  var ICON_LIST = '<svg viewBox="0 0 24 24"><path fill="currentColor" d="M3 5h18v2.2H3zm0 5.9h18v2.2H3zm0 5.9h18V19H3z"/></svg>';

  var ui = null, timer = null, watch = null, armedAt = 0;
  // kind: 'phone' | 'tiles' (TV) | 'dups' (TV); list (Smartphone): 'tiles' | 'compact' | 'button'
  var st = { open: false, kind: null, list: null, area: 'tiles', tileFoc: 0, dupFoc: 0, catIdx: 0, streams: [] };

  function isPhone() { return document.documentElement.classList.contains('xc-phone'); }
  function tilesOn() { return !!Settings.tileList; }
  function isLive() { return S.playerVisible && S.playerType === 'live'; }
  function compactOpen() { return st.open && st.list === 'compact'; }

  // Andere Ebenen (EPG, Menü, Untertitel ...) haben Vorrang
  function blocked() {
    return !isLive() || (S.chListOpen && !compactOpen()) || S.epgOpen || S.sysMenuOpen ||
           S.subPanelOpen || S.audioPanelOpen || Player._subPanelOpen || Player._audioPanelOpen ||
           S.focusArea === 'nav-tabs' || S.screen === 'settings' ||
           (typeof EpgGrid !== 'undefined' && EpgGrid.open);
  }

  // Stile gleich beim Start einfügen, nicht erst beim ersten Öffnen der Bedienung:
  // sonst stand das Live-OSD mit eingeschalteten Kacheln unten, bis man einmal die
  // Senderliste/Kacheln geöffnet hatte (auch nach Senderwechseln)
  var cssDone = false;
  function injectCss() {
    if (cssDone) return;
    cssDone = true;
    var css = document.createElement('style');
    css.textContent =
      // Ebene über dem Bild: selbst durchlässig, nur die Bedienelemente fangen Berührungen
      '#xc-live-ui{position:absolute;top:0;left:0;right:0;bottom:0;z-index:1019;opacity:0;pointer-events:none;transition:opacity .2s}' +
      '#xc-live-ui.show{opacity:1}' +
      '#xc-live-ui.show .xc-hit{pointer-events:auto}' +
      '#xc-live-ui.compact{z-index:1031}' +                       // über der kompakten Liste (Zurück-Button)
      '#xc-live-ui.tv .xc-back,#xc-live-ui.tv .xc-center,#xc-live-ui.tv .xc-listbtn{display:none !important}' +
      '.xc-lb{border-radius:50%;border:none;background:rgba(0,0,0,.5);color:#fff;display:flex;align-items:center;' +
        'justify-content:center;cursor:pointer;outline:none;box-shadow:0 8px 30px rgba(0,0,0,.5);padding:0}' +
      '.xc-lb:active{transform:scale(.93)}' +
      '.xc-back{position:absolute;top:40px;left:40px;width:130px;height:130px}.xc-back svg{width:70px;height:70px}' +
      '#xc-live-ui.compact .xc-back{top:62px;left:62px;width:96px;height:96px}#xc-live-ui.compact .xc-back svg{width:54px;height:54px}' +
      '.xc-center{position:absolute;left:0;right:0;top:50%;display:flex;justify-content:center;align-items:center;transform:translateY(-50%)}' +
      '.xc-center .xc-lb{margin:0 75px}' +
      '#xc-live-ui.compact .xc-center .xc-lb{margin:0 40px}' +
      '.xc-center .xc-lb{width:180px;height:180px}.xc-center svg{width:92px;height:92px}' +
      '.xc-center .xc-pp{width:220px;height:220px;background:rgba(59,130,246,.8)}.xc-center .xc-pp svg{width:110px;height:110px}' +
      // Cyan Fokus-Linien oben/unten wie in Senderliste und Filme/Serien.
      // Touch: markiert den laufenden Sender; Fernbedienung: den Fokus.
      '.xc-line{position:relative}' +
      '.xc-line.foc::before,.xc-line.foc::after,#xc-live-ui:not(.tv) .xc-line.cur::before,#xc-live-ui:not(.tv) .xc-line.cur::after{' +
        'content:"";position:absolute;left:0;right:0;height:3px;pointer-events:none;' +
        'background:linear-gradient(90deg,transparent,var(--accent),var(--accent2),transparent)}' +
      '.xc-line::before{top:0}.xc-line::after{bottom:0}' +
      // Duplikate rechts, senkrecht - zwischen OSD oben und Kachelleiste unten (top/bottom setzt layout())
      '.xc-variants{position:absolute;right:40px;top:200px;bottom:380px;width:440px;display:flex;flex-direction:column;' +
        'background:linear-gradient(rgba(4,6,14,.65),rgba(4,6,14,.99));border-radius:24px;padding:20px 0 14px;' +
        'box-shadow:0 30px 80px rgba(0,0,0,.8);overflow:hidden}' +
      '.xc-variants::before{content:"";position:absolute;top:0;bottom:0;left:0;width:2px;pointer-events:none;' +
        'background:linear-gradient(180deg,transparent,var(--accent),var(--accent2),transparent)}' +
      '.xc-var-title{font-size:36px;font-weight:700;color:#fff;padding:0 30px 12px;flex-shrink:0;border:none;background:none;' +
        'text-align:left;font-family:inherit;white-space:nowrap}' +
      '.xc-var-list{overflow-y:auto;display:flex;flex-direction:column;flex:1;min-height:0;scrollbar-width:none}' +
      '.xc-var-list::-webkit-scrollbar{display:none}' +
      '.xc-var{border:none;border-radius:0;background:transparent;color:rgba(255,255,255,.75);text-align:left;font-family:inherit;' +
        'font-size:36px;padding:0 30px;min-height:92px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;cursor:pointer;flex-shrink:0}' +
      '.xc-var.cur{color:#fff;font-weight:600}' +
      '#xc-live-ui:not(.tv) .xc-var.cur,.xc-var.foc{background:rgba(59,130,246,.14);color:#fff}' +
      // Smartphone mit Kacheln: Duplikate zugeklappt als Griff am rechten Rand, Antippen klappt auf
      '.xc-var-handle{display:none;position:absolute;right:0;top:50%;transform:translateY(-50%);width:64px;height:340px;border:none;' +
        'border-radius:26px 0 0 26px;background:var(--accent);color:#fff;padding:0;cursor:pointer;flex-direction:column;' +
        'align-items:center;justify-content:center;box-shadow:0 0 30px var(--glow);font-family:inherit}' +
      '.xc-var-handle b{font-size:48px;line-height:1;margin-bottom:14px}' +
      '.xc-var-handle span{writing-mode:vertical-rl;transform:rotate(180deg);font-size:30px;font-weight:600;letter-spacing:2px}' +
      '#xc-live-ui.mode-tiles.has-vars:not(.vars-open) .xc-var-handle{display:flex}' +
      '#xc-live-ui.mode-tiles:not(.vars-open) .xc-variants{display:none !important}' +
      '#xc-live-ui.mode-tiles .xc-var-title{cursor:pointer}' +
      '#xc-live-ui.mode-tiles .xc-var-title::after{content:" \\203A";color:var(--accent2)}' +
      // Normale Senderliste: Duplikate waagerecht oben, rechts neben Zurück
      '#xc-live-ui.mode-button .xc-variants{top:40px !important;bottom:auto !important;left:200px;right:40px;width:auto;' +
        'flex-direction:row;align-items:center;padding:0 10px 0 0}' +
      '#xc-live-ui.mode-button .xc-variants::before{top:auto;bottom:0;left:0;right:0;width:auto;height:2px;' +
        'background:linear-gradient(90deg,transparent,var(--accent),var(--accent2),transparent)}' +
      '#xc-live-ui.mode-button .xc-var-title{padding:0 26px 0 30px}' +
      '#xc-live-ui.mode-button .xc-var-list{flex-direction:row;overflow-x:auto;overflow-y:hidden;flex:1;min-width:0}' +
      '#xc-live-ui.mode-button .xc-var{min-height:110px;max-width:520px}' +
      // Kachel-Senderliste unten
      '.xc-strip{position:absolute;left:0;right:0;bottom:0;padding:24px 0 30px;' +
        // Unten so deckend wie das Live-OSD, nach oben transparenter, oben weicher Schatten
        'background:linear-gradient(rgba(4,6,14,0),rgba(4,6,14,.8) 16%,rgba(4,6,14,.93) 45%,rgba(4,6,14,.99))}' +
      '.xc-cats,.xc-tiles{display:flex;overflow-x:auto;overflow-y:hidden;padding:0 40px;scrollbar-width:none}' +
      '.xc-cats::-webkit-scrollbar,.xc-tiles::-webkit-scrollbar{display:none}' +
      '.xc-cats{margin-bottom:10px}.xc-cat{margin-right:6px}' +
      '.xc-cat{flex-shrink:0;border:none;background:transparent;color:rgba(255,255,255,.6);font-family:inherit;' +
        'font-size:34px;padding:14px 26px;white-space:nowrap;cursor:pointer}' +
      '.xc-cat.cur{color:#fff;font-weight:700}' +
      '.xc-cat::before{display:none}' +
      '.xc-cat.foc{background:rgba(59,130,246,.14);border-radius:10px}' +
      '.xc-tiles{padding-top:12px;padding-bottom:12px}.xc-tile{margin-right:20px}' +
      '.xc-tile{flex-shrink:0;width:300px;height:170px;border-radius:16px;border:none;transition:transform .12s;' +
        'background:rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;padding:14px;cursor:pointer;overflow:hidden}' +
      '.xc-tile img{max-width:100%;max-height:100%;object-fit:contain;pointer-events:none}' +
      // Name klein unter dem Logo (Einstellung "Sendername unter dem Logo")
      '.xc-tile.has-cap{flex-direction:column;padding:12px 14px 10px}' +
      // Feste Breiten (Kachel 300 - 2x14 Rand): ältere TV-Browser (webOS 5, Chrome 68)
      // rechnen "100%" in einem <button> mit Flex-Layout falsch - Logo und Name wurden
      // so breit wie der längste Name, das Logo saß schief und der Lauftext lief nie
      '.xc-tile.has-cap img{flex:1 1 0;min-height:0;width:272px;max-width:272px;max-height:none}' +   // Name steht immer unten
      '.xc-tile.has-cap .xc-tile-cap{display:block;flex-shrink:0;width:272px;max-width:272px;margin-top:8px;font-size:24px;font-weight:500;' +
        'line-height:1.2;color:rgba(255,255,255,.85);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;text-align:center}' +
      'html.xc-phone .xc-tile.has-cap .xc-tile-cap{font-size:28px}' +
      '.xc-tile .xc-cap-in{display:inline-block;font:inherit;color:inherit;line-height:inherit;overflow:visible;-webkit-line-clamp:none}' +
      '.xc-tile.has-cap .xc-tile-cap.run{text-overflow:clip;text-align:left}' +
      '.xc-tile span{color:#fff;font-size:34px;font-weight:600;line-height:1.2;text-align:center;overflow:hidden;' +
        'display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;pointer-events:none}' +
      '#xc-live-ui:not(.tv) .xc-tile.cur{background:rgba(59,130,246,.2);box-shadow:0 0 30px var(--glow)}' +
      '#xc-live-ui.tv .xc-tile.cur{background:rgba(255,255,255,.18)}' +
      '.xc-tile.foc{background:rgba(59,130,246,.22);box-shadow:0 0 30px var(--glow);transform:scale(1.06)}' +
      '.xc-listbtn{position:absolute;left:50%;bottom:60px;transform:translateX(-50%);border:none;border-radius:60px;' +
        'background:rgba(0,0,0,.55);color:#fff;font-size:40px;padding:26px 50px;display:flex;align-items:center}' +
      '.xc-listbtn svg{width:52px;height:52px;margin-right:20px}' +
      // Live-OSD oben, solange Kacheln aktiv sind (unten liegt die Kachelleiste)
      'html.xc-tiles-on #live-osd{top:40px;bottom:auto}' +
      // Kompakte Liste mit Buttons (Smartphone): Zurück sitzt oben in der Liste, OSD rechts daneben
      'html.xc-liveui-compact #ch-list-overlay.compact #clo-topbar{padding-left:140px;min-height:128px;align-items:center}' +
      'html.xc-liveui-compact #live-osd:not(.compact-osd),html.xc-phone.xc-liveui-compact #live-osd:not(.compact-osd){left:550px}';
    document.head.appendChild(css);
  }
  injectCss();

  function ensure() {
    if (ui) return ui;
    injectCss();
    ui = document.createElement('div');
    ui.id = 'xc-live-ui';
    ui.innerHTML =
      '<button class="xc-lb xc-back xc-hit" data-act="back" aria-label="Zurück">' + ICON_BACK + '</button>' +
      '<div class="xc-center">' +
        '<button class="xc-lb xc-hit" data-act="prev" aria-label="Voriger Sender">' + ICON_PREV + '</button>' +
        '<button class="xc-lb xc-pp xc-hit" data-act="pp" aria-label="Play/Pause">' + ICON_PAUSE + '</button>' +
        '<button class="xc-lb xc-hit" data-act="next" aria-label="Nächster Sender">' + ICON_NEXT + '</button>' +
      '</div>' +
      '<div class="xc-variants xc-hit xc-panel" style="display:none"><button class="xc-var-title" data-act="vars-close">Duplikate</button><div class="xc-var-list"></div></div>' +
      '<button class="xc-var-handle xc-hit" data-act="vars" aria-label="Duplikate"><b>&#x2039;</b><span>Duplikate</span></button>' +
      '<div class="xc-strip xc-hit xc-panel" style="display:none"><div class="xc-cats"></div><div class="xc-tiles"></div></div>' +
      '<button class="xc-listbtn xc-hit" data-act="list" style="display:none">' + ICON_LIST + ' Senderliste</button>';

    ui.addEventListener('click', function (e) {
      var el = e.target.closest && e.target.closest('[data-act],[data-var],[data-cat],[data-tile]');
      if (!el) return;
      e.preventDefault(); e.stopPropagation();
      // Erst kurz nach dem Einblenden scharf: sonst trifft der zweite Tipp eines
      // schnellen Doppeltipps schon einen Button
      if (Date.now() < armedAt) return;
      if (el.hasAttribute('data-cat')) { st.area = 'tiles'; renderTiles(parseInt(el.getAttribute('data-cat'), 10), false); restartTimer(); return; }
      if (el.hasAttribute('data-tile')) { playTile(parseInt(el.getAttribute('data-tile'), 10)); return; }
      if (el.hasAttribute('data-var')) { playVariant(parseInt(el.getAttribute('data-var'), 10)); return; }
      var act = el.getAttribute('data-act');
      if (act === 'pp') { Player.togglePP(); setTimeout(updatePlayPause, 250); restartTimer(); return; }
      // Duplikate bei Kacheln: Griff klappt auf, Überschrift klappt wieder zu
      if (act === 'vars' || act === 'vars-close') {
        if (ui.classList.contains('mode-tiles')) { ui.classList.toggle('vars-open', act === 'vars'); layout(); }
        restartTimer();
        return;
      }
      hide();
      if (act === 'back') { handleBack(); return; }            // Live: öffnet das Menü
      if (act === 'list') { Player.toggleChList(); return; }
      if (act === 'prev') Player.prevCh(); else if (act === 'next') Player.nextCh();   // OSD zeigt den neuen Sender
    });
    // Jede Berührung der Bedienelemente (z.B. Wischen in der Kachelreihe) hält sie offen
    ui.addEventListener('touchstart', restartTimer, { passive: true });
    ui.addEventListener('scroll', restartTimer, true);

    ($('player-screen') || document.body).appendChild(ui);
    return ui;
  }

  function updatePlayPause() {
    var b = ui && ui.querySelector('.xc-pp');
    if (b) b.innerHTML = (Player.vid && Player.vid.paused) ? ICON_PLAY : ICON_PAUSE;
  }

  function curVariantIdx() {
    var vars = S.variants || [], id = S.currentStream ? S.currentStream.stream_id : null;
    for (var i = 0; i < vars.length; i++) if (vars[i].stream.stream_id === id) return i;
    return 0;
  }
  function renderVariants(show) {
    var box = ui.querySelector('.xc-variants'), vars = S.variants || [];
    ui.classList.toggle('has-vars', !!show && vars.length >= 2);
    if (!show || vars.length < 2) { box.style.display = 'none'; return; }
    var cur = curVariantIdx(), tv = st.kind === 'dups', html = '';
    for (var i = 0; i < vars.length; i++) {
      html += '<button class="xc-var xc-line' + (i === cur ? ' cur' : '') + (tv && i === st.dupFoc ? ' foc' : '') +
              '" data-var="' + i + '">' + esc(vars[i].stream.name) + '</button>';
    }
    var list = box.querySelector('.xc-var-list');
    list.innerHTML = html;
    box.style.display = '';
    if (tv) scrollIntoList(list, list.children[st.dupFoc], false);
  }
  function playVariant(i) {
    hide();
    S.variantIdx = i;
    switchVariant(i);
  }

  // Sender einer Kategorie - wie chListCatChange, aber ohne den Zapp-Kontext
  // (S.filteredStreams) zu verändern, solange nur geblättert wird
  function streamsForCat(idx) {
    var opts = buildCatOpts(), opt = opts[idx], arr = S.streams || [];
    if (opt && opt.id === 'fav') arr = arr.filter(function (s) { return S.favs.live.indexOf(s.stream_id) !== -1; });
    else if (opt && opt.id !== null) arr = arr.filter(function (s) { return String(s.category_id) === String(opt.id); });
    return applyVariantGrouping(arr);
  }
  function currentCatIdx() {
    var opts = buildCatOpts(), cid = S.currentStream ? String(S.currentStream.category_id) : null;
    for (var i = 0; i < opts.length; i++) if (opts[i].id !== null && String(opts[i].id) === cid) return i;
    return Math.max(0, Math.min(opts.length - 1, S.chListCatIdx || 0));
  }
  function scrollIntoList(box, el, horizontal) {
    if (!box || !el) return;
    if (horizontal) box.scrollLeft = Math.max(0, el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2);
    else box.scrollTop = Math.max(0, el.offsetTop - box.clientHeight / 2 + el.offsetHeight / 2);
  }
  function renderCats() {
    var opts = buildCatOpts(), html = '';
    for (var i = 0; i < opts.length; i++) {
      html += '<button class="xc-cat xc-line" data-cat="' + i + '">' + esc(opts[i].name) + '</button>';
    }
    ui.querySelector('.xc-cats').innerHTML = html;
  }
  function markCats() {
    var box = ui.querySelector('.xc-cats'), cats = box.children;
    for (var k = 0; k < cats.length; k++) {
      cats[k].classList.toggle('cur', k === st.catIdx);
      cats[k].classList.toggle('foc', st.kind === 'tiles' && st.area === 'cats' && k === st.catIdx);
    }
    var c = cats[st.catIdx];
    if (c) box.scrollLeft = Math.max(0, c.offsetLeft - 60);
  }
  function renderTiles(catIdx, jumpToCurrent) {
    st.catIdx = catIdx;
    st.streams = streamsForCat(catIdx);
    var curId = S.currentStream ? S.currentStream.stream_id : null, html = '', curPos = -1;
    for (var i = 0; i < st.streams.length; i++) {
      var s = st.streams[i];
      if (s.stream_id === curId) curPos = i;
      // Mit Logo optional der Name klein darunter (Einstellung). Lädt das Logo
      // nicht, bleibt nur der Name - dann groß wie bei Sendern ohne Logo.
      var cap = !!(s.stream_icon && Settings.tileNames);
      var onerr = cap ? 'this.parentNode.classList.remove(\'has-cap\');this.parentNode.removeChild(this)'
                      : 'this.outerHTML=\'<span>' + esc(s.name).replace(/'/g, '&#39;') + '</span>\'';
      var inner = s.stream_icon
        ? '<img src="' + esc(s.stream_icon) + '" loading="lazy" alt="" onerror="' + onerr + '">' +
          (cap ? '<span class="xc-tile-cap"><span class="xc-cap-in">' + esc(s.name) + '</span></span>' : '')
        : '<span>' + esc(s.name) + '</span>';
      html += '<button class="xc-tile xc-line' + (cap ? ' has-cap' : '') + (s.stream_id === curId ? ' cur' : '') + '" data-tile="' + i + '" aria-label="' + esc(s.name) + '">' + inner + '</button>';
    }
    var tiles = ui.querySelector('.xc-tiles');
    tiles.innerHTML = html;
    tiles.scrollLeft = 0;
    st.tileFoc = (jumpToCurrent && curPos >= 0) ? curPos : 0;
    if (jumpToCurrent && curPos >= 0) scrollIntoList(tiles, tiles.children[curPos], true);
    markTiles();
    markCats();
    // Lange Namen unter den Logos als Lauftext (Weite erst nach dem Layout messbar).
    // Web Animations statt CSS-Variablen in @keyframes - die kennen ältere TV-Browser nicht.
    requestAnimationFrame(function(){
      var caps = tiles.querySelectorAll('.has-cap .xc-tile-cap');
      for(var ci = 0; ci < caps.length; ci++){
        var capEl = caps[ci], inEl = capEl.firstChild;
        var over = inEl ? inEl.offsetWidth - capEl.clientWidth : 0;
        if(over <= 2 || !inEl.animate) continue;
        capEl.classList.add('run');
        var to = 'translateX(' + -(over + 6) + 'px)';
        inEl.animate([
          { transform: 'translateX(0)', offset: 0 }, { transform: 'translateX(0)', offset: 0.15 },
          { transform: to, offset: 0.85 }, { transform: to, offset: 1 }
        ], { duration: Math.max(4000, over * 18), iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' });
      }
    });
  }
  function markTiles() {
    if (st.kind !== 'tiles') return;
    var tiles = ui.querySelector('.xc-tiles'), ch = tiles.children;
    for (var i = 0; i < ch.length; i++) ch[i].classList.toggle('foc', st.area === 'tiles' && i === st.tileFoc);
    if (st.area === 'tiles') scrollIntoList(tiles, ch[st.tileFoc], true);
  }
  function playTile(i) {
    var s = st.streams[i]; if (!s) return;
    hide();
    S.filteredStreams = st.streams;            // Zappen läuft danach in dieser Kategorie
    S.chListCatIdx = st.catIdx;
    S.currentStreamIdx = i;
    saveLastStream(s);
    Player.play(API.liveUrl(s), s, 'live');     // zeigt die OSD-Leiste mit dem neuen Sender
  }

  function restartTimer() {
    clearTimeout(timer);
    clearTimeout(S.controlsTimer);              // OSD bleibt so lange stehen wie die Bedienung
    if (compactOpen()) {                        // Kompakte Liste: deren eigene Auto-Schließzeit gilt
      if (typeof _resetAutoClose === 'function') _resetAutoClose();
      return;
    }
    timer = setTimeout(function () { hide(); }, UI_MS);
  }

  // Freien Raum zwischen den Leisten berechnen. Das Live-OSD steht bei Kacheln
  // oben (unten liegt die Kachelleiste), sonst wie gewohnt unten.
  //   Kacheln   OSD oben · Kacheln unten · Duplikate zugeklappt rechts (Griff)
  //   kompakt   Liste links · OSD unten · Duplikate rechts senkrecht
  //   normal    Zurück + Duplikate waagerecht oben · Button "Senderliste" über dem OSD
  function layout() {
    var uiH = ui.offsetHeight, gap = 24;
    var r = ui.getBoundingClientRect(), scale = (uiH && r.height) ? r.height / uiH : 1;
    var top = 40, bottom = uiH - 40, osd = $('live-osd');
    if (osd && osd.offsetHeight) {
      var o = osd.getBoundingClientRect(), oTop = (o.top - r.top) / scale, oBottom = (o.bottom - r.top) / scale;
      if (oTop < uiH / 2) top = Math.max(top, oBottom); else bottom = Math.min(bottom, oTop);
    }
    var strip = ui.querySelector('.xc-strip'), lb = ui.querySelector('.xc-listbtn');
    if (strip.style.display !== 'none') bottom = Math.min(bottom, strip.offsetTop + 20);   // oberer Verlauf darf überlappen
    if (lb.style.display !== 'none') {                                                    // Button direkt über dem OSD
      lb.style.bottom = (uiH - bottom + gap) + 'px';
      bottom = bottom - gap - lb.offsetHeight;
    }
    var box = ui.querySelector('.xc-variants'), boxShown = box.style.display !== 'none';
    var cTop = top;
    if (st.list === 'button') {
      // Duplikate waagerecht oben (Position aus der CSS) - Mitte darunter
      box.style.top = ''; box.style.bottom = '';
      cTop = Math.max(cTop, boxShown ? 40 + box.offsetHeight : 40 + 130);
    } else {
      box.style.top = (top + gap) + 'px';
      box.style.bottom = (uiH - bottom + gap) + 'px';
      if (st.kind === 'phone' && st.list !== 'compact') cTop = Math.max(cTop, 40 + 130);   // unter dem Zurück-Button
    }
    var h = ui.querySelector('.xc-var-handle');
    h.style.top = ((top + bottom) / 2) + 'px';
    var c = ui.querySelector('.xc-center');
    c.style.top = ((cTop + bottom) / 2) + 'px';
    // Waagerecht: möglichst mittig auf dem Bildschirm - nur wenn die Buttons dort
    // die kompakte Liste bzw. die Duplikate berühren würden, in den freien Raum dazwischen
    c.style.left = '0px'; c.style.right = '0px';
    var uiW = ui.offsetWidth, kids = c.children, first = kids[0], last = kids[kids.length - 1];
    var w = first && last ? (last.offsetLeft + last.offsetWidth) - first.offsetLeft : 0;
    var minX = st.list === 'compact' ? 550 : 0;
    var maxX = uiW - (st.list === 'compact' && boxShown ? 40 + box.offsetWidth + gap : 0);
    if(uiW && ((uiW - w) / 2 < minX || (uiW + w) / 2 > maxX)) {
      c.style.left = minX + 'px';
      c.style.right = (uiW - maxX) + 'px';
    }
  }

  function showOsd() {
    clearTimeout(S.controlsTimer);
    var osd = $('live-osd');
    if (osd) osd.classList.remove('fade');
    if (S.variantBarOpen) closeVariantBar();
  }

  function open(kind) {
    ensure();
    if (!ui.classList.contains('show')) armedAt = Date.now() + 450;
    st.open = true; st.kind = kind;
    ui.classList.toggle('tv', kind !== 'phone');
    ui.classList.toggle('compact', st.list === 'compact');
    ['tiles', 'compact', 'button'].forEach(function (m) {
      ui.classList.toggle('mode-' + m, kind === 'phone' && st.list === m);
    });
    ui.classList.remove('vars-open');           // Duplikate bei Kacheln jedes Mal zugeklappt
    document.documentElement.classList.toggle('xc-liveui-compact', st.list === 'compact');
    var strip = kind === 'tiles' || (kind === 'phone' && st.list === 'tiles');
    ui.querySelector('.xc-strip').style.display = strip ? '' : 'none';
    ui.querySelector('.xc-listbtn').style.display = (kind === 'phone' && st.list === 'button') ? '' : 'none';
    showOsd();
    ui.classList.add('show');
    renderVariants(kind === 'phone' || kind === 'dups');
    if (strip) { renderCats(); renderTiles(currentCatIdx(), true); }
    layout();
    updatePlayPause();
    restartTimer();
    // Wird eine andere Ebene geöffnet (EPG, Menü ...) bzw. die kompakte Liste
    // geschlossen (Sender gewählt), die Bedienung ausblenden
    clearInterval(watch);
    watch = setInterval(function () {
      if (st.list === 'compact' && !S.chListOpen) { hide(true); return; }
      if (blocked()) hide(true);
    }, 300);
  }

  function showPhone() {
    if (blocked()) return;
    st.list = tilesOn() ? 'tiles' : (Settings.compactList ? 'compact' : 'button');
    if (st.list === 'compact' && !S.chListOpen) {
      Player.toggleChList();
      if (typeof _resetAutoClose === 'function') _resetAutoClose();
    }
    open('phone');
  }
  function showTiles() {
    if (blocked()) return;
    st.list = null; st.area = 'tiles';
    open('tiles');
  }
  function showDups() {
    if (blocked()) return;
    if (!S.variants || S.variants.length < 2) { showToast('Keine Duplikate verfügbar', 2000); return; }
    st.list = null;
    st.dupFoc = curVariantIdx();
    open('dups');
  }

  // keepOsd: Sender wurde gerade gewechselt - dessen OSD nicht gleich wieder ausblenden
  function hide(keepOsd) {
    clearTimeout(timer); clearInterval(watch);
    if (!st.open) return;
    var wasCompact = st.list === 'compact';
    st.open = false;
    if (ui) ui.classList.remove('show');
    if (wasCompact && S.chListOpen) Player.toggleChList();
    document.documentElement.classList.remove('xc-liveui-compact');
    st.list = null;
    if (keepOsd) return;
    clearTimeout(S.controlsTimer);
    var osd = $('live-osd');
    if (osd) osd.classList.add('fade');         // bei Senderwechsel blendet Player.play sie gleich wieder ein
  }

  // ── Fernbedienung ────────────────────────────────────────────────
  function isBackKey(k) { return k === KEYS.BACK || k === KEYS.BACK2 || k === KEYS.ESC || k === KEYS.BKSP; }
  function onKey(e) {
    if (typeof S === 'undefined' || isPhone()) return;
    var tag = e.target && e.target.tagName;
    if (tag === 'INPUT' || tag === 'SELECT') return;
    var k = e.keyCode;
    if (st.open) {
      if (blocked()) { hide(true); return; }
      if (isBackKey(k)) {
        // BACK kommt am TV beim Loslassen (handleBack) - hier nur verschlucken
        e.preventDefault(); e.stopImmediatePropagation();
        if (k === KEYS.ESC || k === KEYS.BKSP) hide();
        return;
      }
      var handled = st.kind === 'tiles' ? tilesKey(k) : st.kind === 'dups' ? dupsKey(k) : false;
      if (handled) { e.preventDefault(); e.stopImmediatePropagation(); restartTimer(); return; }
      hide(true);                               // andere Tasten (Zappen, Farben ...) normal weiter
      return;
    }
    if (!tilesOn() || blocked() || S.chListOpen || S.variantBarOpen) return;
    if (typeof ZapHistory !== 'undefined' && ZapHistory._osdOpen) return;
    if (typeof BingeMode !== 'undefined' && BingeMode._active) return;
    if (k === 13) {
      if (Date.now() - (typeof _catchupJustStarted !== 'undefined' ? _catchupJustStarted : 0) <= 400) return;
      e.preventDefault(); e.stopImmediatePropagation();
      showTiles();
    } else if (k === 37 || k === 39) {
      e.preventDefault(); e.stopImmediatePropagation();
      showDups();
    }
  }
  function tilesKey(k) {
    var n = st.streams.length, cats = buildCatOpts().length;
    if (st.area === 'cats') {
      if (k === 37 || k === 39) {
        var ci = Math.max(0, Math.min(cats - 1, st.catIdx + (k === 39 ? 1 : -1)));
        if (ci !== st.catIdx) renderTiles(ci, true);
        return true;
      }
      if (k === 40 || k === 13) { st.area = 'tiles'; markTiles(); markCats(); return true; }
      if (k === 38) return true;
      return false;
    }
    if (k === 37) { if (st.tileFoc > 0) { st.tileFoc--; markTiles(); } return true; }
    if (k === 39) { if (st.tileFoc < n - 1) { st.tileFoc++; markTiles(); } return true; }
    if (k === 38) { st.area = 'cats'; markTiles(); markCats(); return true; }
    if (k === 40) return true;
    if (k === 13) { playTile(st.tileFoc); return true; }
    return false;
  }
  // Vorerst links/rechts wie bei der alten waagerechten Leiste: links = oberer, rechts = unterer Eintrag
  function dupsKey(k) {
    var n = (S.variants || []).length;
    if (k === 37 || k === 39) {
      st.dupFoc = Math.max(0, Math.min(n - 1, st.dupFoc + (k === 39 ? 1 : -1)));
      renderVariants(true);
      return true;
    }
    if (k === 13) { playVariant(st.dupFoc); return true; }
    return false;
  }
  // Muss vor dem Tasten-Handler aus keyhandler.js (ebenfalls Capture) liegen -
  // deshalb wird diese Datei vor keyhandler.js geladen
  window.addEventListener('keydown', onKey, true);

  // BACK (auch Android-Zurück, Wisch-Geste) schließt zuerst die Bedienung.
  // handleBack stammt aus keyhandler.js, das erst nach dieser Datei geladen wird.
  function wrapBack() {
    if (typeof handleBack !== 'function' || handleBack._liveUi) return;
    var origBack = handleBack;
    window.handleBack = function () {
      if (st.open) {
        // Kompakte Liste mit Buttons (Handy): schließen und wie Zurück im Live-Bild
        // gleich das Top-Menü öffnen; sonst nur die Bedienung ausblenden
        var compact = st.list === 'compact';
        hide();
        if (!compact) return;
      }
      return origBack.apply(this, arguments);
    };
    window.handleBack._liveUi = true;
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wrapBack);
  else setTimeout(wrapBack, 0);

  // ── Tippen/Klicken ins Live-Bild ─────────────────────────────────
  // Smartphone: Bedienung ein/aus statt Senderliste. Andere Geräte (Maus,
  // Magic Remote, Tablet) mit Kachel-Einstellung: Kacheln ein/aus.
  // Läuft vor dem Standard-Handler und stoppt ihn für jede freie Fläche - der
  // würde sonst die Senderliste öffnen bzw. den Sender neu starten.
  // Gibt true zurück, wenn der Tipp hier verarbeitet wurde (dann nicht weiterreichen)
  function handleTap(target) {
    if (typeof S === 'undefined' || !isLive()) return false;
    var phone = isPhone();
    if (!phone && !tilesOn()) return false;
    if (!target || !target.closest || !target.closest('#player-screen')) return false;
    // Top-Menü offen: Tippen ins Bild schließt nur das Menü
    if (S.focusArea === 'nav-tabs' || S.sysMenuOpen) { handleBack(); return true; }
    if (target.closest('button,.vchip')) return false;          // echte Buttons/Kacheln/Chips selbst
    if (compactOpen() && target.closest('#ch-list-overlay')) return false;
    if (blocked()) return false;
    if (target.closest('.xc-panel')) return true;                // Hintergrund der Leisten: nichts tun
    if (st.open) hide();
    else if (phone) showPhone();
    else showTiles();
    return true;
  }
  document.addEventListener('click', function (e) {
    if (handleTap(e.target)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('touchstart', function () { if (st.open) restartTimer(); }, { capture: true, passive: true });

  return { tap: handleTap, isOpen: function () { return st.open; }, hide: hide, showPhone: showPhone, showTiles: showTiles, showDups: showDups };
})();
