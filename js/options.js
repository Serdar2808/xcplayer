// ── WEITERE EINSTELLUNGEN ────────────────────────────────────────
// Standardwerte, Darstellung in den Einstellungen und Anwenden der Optionen
// an einer Stelle. Die Zeilen werden per JS in die Bereiche der Einstellungen
// eingefügt (index.html unterscheidet sich je Plattform).
//   Wert lesen:  Settings.<key>   (storage.js lädt/speichert alle OPTION_DEFS)

var OPTION_DEFS = {
  // Aussehen
  accent: '', fontScale: 'normal', focusStyle: 'lines', reduceMotion: false, clock: 'datetime', bgStyle: 'flat',
  // Live TV
  startChannel: 'last', osdTime: 6, chListStay: false, tileSize: 'm', zapCount: 5, favFirst: false, epgBar: true, dupPref: 'auto',
  // Filme & Serien
  showContinue: true, newRow: true, watchedPct: 95,
  // Wiedergabe
  bingeSecs: 8, introSkip: 0, seekStep: 10, resumeMode: 'auto', audioLang: '', subLang: '',
  subSize: 'm', subColor: 'white', subBg: 'shadow', aspectDefault: 'last', buffer: 'normal',
  // Playlist & Daten
  plRefresh: 'manual', epgRefresh: 24,
  // Handy
  gestBright: true, gestVol: true, tapSeek: 10, pip: false,
  // Bedienung (TV)
  keyRed: 'timeshift', keyGreen: 'subs', keyYellow: 'epg', keyBlue: 'search', okAction: 'list', exitMode: 'twice'
};

var LANG_OPTS = [['', 'Automatisch'], ['de', 'Deutsch'], ['en', 'Englisch'], ['tr', 'Türkisch'], ['fr', 'Französisch'],
                 ['es', 'Spanisch'], ['it', 'Italienisch']];
var COLOR_KEY_OPTS = [['timeshift', 'Timeshift'], ['epg', 'EPG'], ['guide', 'TV-Zeitung'], ['subs', 'Untertitel'],
                      ['audio', 'Audiospur'], ['search', 'Suche'], ['fav', 'Favorit'], ['list', 'Senderliste'],
                      ['recent', 'Letzte Sender'], ['none', 'Nichts']];
var ACCENTS = {
  blue: ['#3b82f6', '59,130,246'], cyan: ['#06b6d4', '6,182,212'], purple: ['#a855f7', '168,85,247'],
  pink: ['#ec4899', '236,72,153'], red: ['#ef4444', '239,68,68'], orange: ['#f97316', '249,115,22'],
  gold: ['#e0a030', '224,160,48'], green: ['#10b981', '16,185,129']
};

// Bereiche: cat = Einstellungs-Bereich, rows: toggle | cycle | action
// only: 'tv' | 'phone' | 'android' blendet Zeilen je Gerät aus
var OPTION_UI = [
  { cat: 'ansicht', title: 'Darstellung', rows: [
    { key: 'accent', type: 'cycle', label: 'Akzentfarbe', sub: 'Überschreibt die Farbe des Designs', opts: [['', 'Wie Design'], ['blue', 'Blau'], ['cyan', 'Cyan'], ['purple', 'Violett'], ['pink', 'Pink'], ['red', 'Rot'], ['orange', 'Orange'], ['gold', 'Gold'], ['green', 'Grün']] },
    { key: 'fontScale', type: 'cycle', label: 'Schriftgröße', opts: [['small', 'Klein'], ['normal', 'Normal'], ['large', 'Groß'], ['xlarge', 'Sehr groß']] },
    { key: 'focusStyle', type: 'cycle', label: 'Fokus-Markierung', sub: 'Wie die Auswahl hervorgehoben wird', opts: [['lines', 'Linien'], ['frame', 'Rahmen'], ['zoom', 'Nur Vergrößern']] },
    { key: 'clock', type: 'cycle', label: 'Uhr', opts: [['datetime', 'Datum und Uhrzeit'], ['time', 'Nur Uhrzeit'], ['off', 'Aus']] },
    { key: 'bgStyle', type: 'cycle', label: 'Hintergrund', opts: [['flat', 'Einfarbig'], ['gradient', 'Leichter Verlauf']] },
    { key: 'reduceMotion', type: 'toggle', label: 'Animationen reduzieren', sub: 'Weniger Übergänge und Lauftexte - schneller auf schwachen Geräten' }
  ]},
  { cat: 'live', title: 'Verhalten', rows: [
    { key: 'startChannel', type: 'cycle', label: 'Beim App-Start', opts: [['last', 'Letzter Sender'], ['first', 'Erster Sender der Liste'], ['fav', 'Erster Favorit']] },
    { key: 'osdTime', type: 'cycle', label: 'Senderinfo anzeigen für', opts: [[3, '3 Sekunden'], [6, '6 Sekunden'], [10, '10 Sekunden'], [20, '20 Sekunden']] },
    { key: 'chListStay', type: 'toggle', label: 'Senderliste nach der Wahl offen lassen' },
    { key: 'tileSize', type: 'cycle', label: 'Kachelgröße', opts: [['s', 'Klein'], ['m', 'Mittel'], ['l', 'Groß']] },
    { key: 'zapCount', type: 'cycle', label: 'Letzte Sender (Taste 0)', opts: [[3, '3 Sender'], [5, '5 Sender'], [10, '10 Sender']] },
    { key: 'favFirst', type: 'toggle', label: 'Favoriten als erste Kategorie' },
    { key: 'epgBar', type: 'toggle', label: 'Fortschrittsbalken in der Senderliste' },
    { key: 'dupPref', type: 'cycle', label: 'Bevorzugte Qualität bei Duplikaten', sub: 'Welche Variante bei zusammengefassten Sendern spielt', opts: [['auto', 'Erste in der Liste'], ['uhd', 'UHD / 4K'], ['fhd', 'FHD'], ['hd', 'HD'], ['hevc', 'HEVC']] }
  ]},
  { cat: 'media', title: 'Verhalten', rows: [
    { key: 'sortVod', type: 'cycle', label: 'Sortierung Filme', opts: [['default', 'Wie beim Anbieter'], ['new', 'Neueste zuerst'], ['az', 'A - Z'], ['za', 'Z - A'], ['rating', 'Bewertung']] },
    { key: 'sortSeries', type: 'cycle', label: 'Sortierung Serien', opts: [['default', 'Wie beim Anbieter'], ['new', 'Neueste zuerst'], ['az', 'A - Z'], ['za', 'Z - A'], ['rating', 'Bewertung']] },
    { key: 'newRow', type: 'toggle', label: 'Reihe "Neu hinzugekommen"', sub: 'Oben in der Netflix-Ansicht' },
    { key: 'showContinue', type: 'toggle', label: 'Weiterschauen im Menü anzeigen' },
    { key: 'watchedPct', type: 'cycle', label: 'Als gesehen markieren ab', sub: 'Danach verschwindet der Eintrag aus Weiterschauen', opts: [[90, '90 %'], [95, '95 %'], [100, 'Erst am Ende']] }
  ]},
  { cat: 'player', title: 'Filme & Serien', rows: [
    { key: 'resumeMode', type: 'cycle', label: 'Angefangene Titel', opts: [['auto', 'Automatisch fortsetzen'], ['ask', 'Jedes Mal fragen'], ['never', 'Immer von vorn']] },
    { key: 'bingeSecs', type: 'cycle', label: 'Nächste Folge automatisch', opts: [[0, 'Aus'], [5, 'Nach 5 Sekunden'], [8, 'Nach 8 Sekunden'], [10, 'Nach 10 Sekunden'], [15, 'Nach 15 Sekunden']] },
    { key: 'introSkip', type: 'cycle', label: 'Button "Intro überspringen"', sub: 'In den ersten Minuten einer Folge', opts: [[0, 'Aus'], [60, '+60 Sekunden'], [90, '+90 Sekunden'], [120, '+120 Sekunden']] },
    { key: 'seekStep', type: 'cycle', label: 'Spulen pro Tastendruck', opts: [[10, '10 Sekunden'], [15, '15 Sekunden'], [30, '30 Sekunden']] },
    { key: 'aspectDefault', type: 'cycle', label: 'Bildformat beim Start', opts: [['last', 'Zuletzt gewählt'], ['orig', 'Original'], ['16:9', '16:9'], ['4:3', '4:3'], ['16:10', '16:10'], ['21:9', '21:9'], ['fill', 'Füllen'], ['stretch', 'Strecken']] },
    { key: 'buffer', type: 'cycle', label: 'Puffer', sub: 'Länger = weniger Ruckeln bei schwachem Internet, späterer Start', opts: [['short', 'Kurz'], ['normal', 'Normal'], ['long', 'Lang']] }
  ]},
  { cat: 'player', title: 'Ton & Untertitel', rows: [
    { key: 'audioLang', type: 'cycle', label: 'Bevorzugte Tonsprache', opts: LANG_OPTS },
    { key: 'subLang', type: 'cycle', label: 'Untertitel automatisch', sub: 'Schaltet Untertitel in dieser Sprache ein, wenn vorhanden', opts: [['', 'Aus']].concat(LANG_OPTS.slice(1)) },
    { key: 'subSize', type: 'cycle', label: 'Untertitel-Größe', opts: [['s', 'Klein'], ['m', 'Normal'], ['l', 'Groß'], ['xl', 'Sehr groß']] },
    { key: 'subColor', type: 'cycle', label: 'Untertitel-Farbe', opts: [['white', 'Weiß'], ['yellow', 'Gelb']] },
    { key: 'subBg', type: 'cycle', label: 'Untertitel-Hintergrund', sub: 'Auf iOS nicht verfügbar', opts: [['shadow', 'Nur Schatten'], ['box', 'Halbtransparent'], ['black', 'Schwarz']] }
  ]},
  { cat: 'player', title: 'Sleep-Timer', rows: [
    { key: '_sleep', type: 'action', label: 'Wiedergabe beenden nach', sub: 'Gilt bis zum nächsten App-Start', action: 'sleepCycle' }
  ]},
  { cat: 'playlist', title: 'Aktualisierung', rows: [
    { key: 'plRefresh', type: 'cycle', label: 'Playlist automatisch aktualisieren', opts: [['manual', 'Nur manuell'], ['daily', 'Täglich'], ['weekly', 'Wöchentlich']] },
    { key: 'epgRefresh', type: 'cycle', label: 'EPG aktualisieren alle', opts: [[6, '6 Stunden'], [12, '12 Stunden'], [24, '24 Stunden']] },
    { key: '_epgNow', type: 'action', label: 'EPG jetzt aktualisieren', action: 'epgNow' }
  ]},
  { cat: 'playlist', title: 'Daten', rows: [
    { key: '_export', type: 'action', label: 'Einstellungen auf ein anderes Gerät übertragen', sub: 'Zeigt einen Code, gültig 30 Minuten', action: 'exportSettings' },
    { key: '_import', type: 'action', label: 'Einstellungen von einem anderen Gerät holen', sub: 'Code eingeben', action: 'importSettings' },
    { key: '_cache', type: 'action', label: 'Zwischenspeicher leeren', sub: 'Senderdaten, EPG und Bilder neu laden - Einstellungen bleiben', action: 'clearCache' },
    { key: '_resetSettings', type: 'action', label: 'Einstellungen zurücksetzen', sub: 'Aussehen und Verhalten auf Standard - Profile bleiben', action: 'resetSettings' },
    { key: '_resetAll', type: 'action', label: 'App komplett zurücksetzen', sub: 'Löscht alles inklusive Profile', action: 'resetAll', danger: true }
  ]},
  { cat: 'control', title: 'Fernbedienung', only: 'tv', rows: [
    { key: 'okAction', type: 'cycle', label: 'OK im Live-Bild', opts: [['list', 'Senderliste'], ['osd', 'Erst Senderinfo, dann Liste']] },
    { key: 'keyRed', type: 'cycle', label: 'Rote Taste', opts: COLOR_KEY_OPTS },
    { key: 'keyGreen', type: 'cycle', label: 'Grüne Taste', opts: COLOR_KEY_OPTS },
    { key: 'keyYellow', type: 'cycle', label: 'Gelbe Taste', opts: COLOR_KEY_OPTS },
    { key: 'keyBlue', type: 'cycle', label: 'Blaue Taste', opts: COLOR_KEY_OPTS },
    { key: 'exitMode', type: 'cycle', label: 'App beenden', opts: [['twice', 'Zweimal Zurück'], ['dialog', 'Mit Rückfrage'], ['off', 'Sofort']] }
  ]},
  { cat: 'control', title: 'Touch', only: 'phone', rows: [
    { key: 'gestBright', type: 'toggle', label: 'Helligkeit per Wischen (links)' },
    { key: 'gestVol', type: 'toggle', label: 'Lautstärke per Wischen (rechts)' },
    { key: 'tapSeek', type: 'cycle', label: 'Doppeltipp spult', opts: [[10, '10 Sekunden'], [15, '15 Sekunden'], [30, '30 Sekunden']] },
    { key: 'pip', type: 'toggle', label: 'Bild-im-Bild beim Verlassen', sub: 'Video läuft in einem kleinen Fenster weiter', only: 'android' }
  ]}
];

var Options = {
  _rendered: false,

  _onlyOk: function(only){
    if (!only) return true;
    var phone = document.documentElement.classList.contains('xc-phone');
    if (only === 'tv') return !phone;
    if (only === 'phone') return phone;
    if (only === 'android') return phone && !!(window.AndroidBridge && AndroidBridge.setPip);
    return true;
  },

  // Sortierung liegt pro Profil in Settings.sortMethod
  _get: function(key){
    if (key === 'sortVod') return (Settings.sortMethod && Settings.sortMethod.vod) || 'default';
    if (key === 'sortSeries') return (Settings.sortMethod && Settings.sortMethod.series) || 'default';
    return Settings[key];
  },
  _set: function(key, val){
    if (key === 'sortVod' || key === 'sortSeries') {
      Settings.sortMethod = Settings.sortMethod || { vod: 'default', series: 'default' };
      Settings.sortMethod[key === 'sortVod' ? 'vod' : 'series'] = val;
      return;
    }
    Settings[key] = val;
  },
  _def: function(key){
    for (var i = 0; i < OPTION_UI.length; i++)
      for (var j = 0; j < OPTION_UI[i].rows.length; j++) if (OPTION_UI[i].rows[j].key === key) return OPTION_UI[i].rows[j];
    return null;
  },
  _label: function(row){
    var v = this._get(row.key);
    for (var i = 0; i < row.opts.length; i++) if (String(row.opts[i][0]) === String(v)) return row.opts[i][1];
    return row.opts[0][1];
  },

  // ── Einstellungen-Oberfläche ───────────────────────────────────
  render: function(){
    if (this._rendered) { this.updateUi(); return; }
    this._ensureControlCat();
    var self = this;
    OPTION_UI.forEach(function(card){
      if (!self._onlyOk(card.only)) return;
      var sec = $('set-cat-' + card.cat); if (!sec) return;
      var html = '<div class="st-card st-gen"><div class="st-card-title">' + esc(card.title) + '</div><div class="ios-group st-rows">';
      card.rows.forEach(function(r){
        if (!self._onlyOk(r.only)) return;
        var click = r.type === 'toggle' ? "Options.toggle('" + r.key + "')"
                  : r.type === 'cycle' ? "Options.cycle('" + r.key + "')" : "Options." + r.action + "()";
        html += '<div class="ios-row' + (r.danger ? ' st-danger' : '') + '" data-focusable onmouseover="setFocus(this)" onclick="' + click + '">'
          + '<div style="flex:1"><div class="ios-label">' + esc(r.label) + '</div>' + (r.sub ? '<div class="st-sub">' + esc(r.sub) + '</div>' : '') + '</div>'
          + (r.type === 'toggle' ? '<div class="ios-toggle sp-toggle" id="opt-' + r.key + '"><div class="sp-toggle-knob"></div></div>'
            : r.type === 'cycle' ? '<div class="st-val" id="opt-' + r.key + '"></div>'
            : '<div class="st-val" id="opt-' + r.key + '"></div><div class="ios-arrow">&#x203A;</div>')
          + '</div>';
      });
      html += '</div></div>';
      sec.insertAdjacentHTML('beforeend', html);
    });
    // Alter Schalter "mit Kanal 1 starten" wird durch "Beim App-Start" ersetzt
    var oldStart = $('toggle-start-first');
    if (oldStart && oldStart.closest('.ios-row')) oldStart.closest('.ios-row').style.display = 'none';
    this._rendered = true;
    this.updateUi();
  },

  // Eigener Bereich "Bedienung" in der Leiste der Einstellungen
  _ensureControlCat: function(){
    if ($('set-cat-control')) return;
    var about = $('st-nav-about'), content = $('st-content');
    if (!about || !content) return;
    about.insertAdjacentHTML('beforebegin',
      '<div class="st-nav" id="st-nav-control" data-cat="control" data-focusable data-onfocus onclick="settingsNavClick(\'control\')">' +
      '<span class="st-ico">&#x1F3AE;</span><span class="st-nav-label">Bedienung</span></div>');
    content.insertAdjacentHTML('beforeend', '<section id="set-cat-control" class="set-cat-group hidden"><h2 class="st-h">Bedienung</h2></section>');
  },

  updateUi: function(){
    var self = this;
    OPTION_UI.forEach(function(card){ card.rows.forEach(function(r){
      var el = $('opt-' + r.key); if (!el) return;
      if (r.type === 'toggle') el.classList.toggle('on', !!self._get(r.key));
      else if (r.type === 'cycle') el.textContent = self._label(r);
    }); });
    var sl = $('opt-_sleep'); if (sl) sl.textContent = SleepTimer.label();
  },

  toggle: function(key){
    this._set(key, !this._get(key));
    this._changed(key);
  },
  cycle: function(key){
    var row = this._def(key); if (!row) return;
    var cur = this._get(key), idx = 0;
    for (var i = 0; i < row.opts.length; i++) if (String(row.opts[i][0]) === String(cur)) idx = i;
    this._set(key, row.opts[(idx + 1) % row.opts.length][0]);
    this._changed(key);
  },
  _changed: function(key){
    Settings.save(); Settings._apply();
    this.updateUi();
    // Ansichten, die die Option sofort zeigen sollen, neu aufbauen
    if ((key === 'sortVod' || key === 'sortSeries' || key === 'newRow') && typeof NF !== 'undefined') NF._dirty = true;
    if (key === 'favFirst' && S.tab && S.screen === 'main' && typeof loadCats === 'function') loadCats();
  },

  // ── Anwenden (aus Settings._apply) ─────────────────────────────
  apply: function(){
    var root = document.documentElement, st = root.style;
    // Akzentfarbe
    var a = ACCENTS[Settings.accent];
    if (a) { st.setProperty('--accent', a[0]); st.setProperty('--accent-rgb', a[1]); st.setProperty('--glow', 'rgba(' + a[1] + ',.38)'); }
    else { st.removeProperty('--accent'); st.removeProperty('--accent-rgb'); st.removeProperty('--glow'); }
    // Schriftgröße: Grundwerte (auch die der Handy-Ansicht) skalieren
    var f = { small: 0.9, normal: 1, large: 1.12, xlarge: 1.25 }[Settings.fontScale] || 1;
    ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl'].forEach(function(n){
      st.removeProperty('--fs-' + n);
      if (f === 1) return;
      var base = parseFloat(getComputedStyle(root).getPropertyValue('--fs-' + n));
      if (base) st.setProperty('--fs-' + n, Math.round(base * f) + 'px');
    });
    root.classList.toggle('focus-frame', Settings.focusStyle === 'frame');
    root.classList.toggle('focus-zoom', Settings.focusStyle === 'zoom');
    root.classList.toggle('reduce-motion', !!Settings.reduceMotion);
    root.classList.toggle('clock-off', Settings.clock === 'off');
    root.classList.toggle('bg-gradient', Settings.bgStyle === 'gradient');
    root.classList.toggle('no-epg-bar', !Settings.epgBar);
    root.classList.remove('tiles-s', 'tiles-l');
    if (Settings.tileSize === 's' || Settings.tileSize === 'l') root.classList.add('tiles-' + Settings.tileSize);
    // Zeiten und Schritte
    CONFIG.SEEK_NORMAL_STEP = +Settings.seekStep || 10;
    CONFIG.SEEK_FAST_STEP = CONFIG.SEEK_NORMAL_STEP * 6;
    CONFIG.EPG_CACHE_TTL = (+Settings.epgRefresh || 24) * 3600000;
    if (typeof ZapHistory !== 'undefined') {
      ZapHistory._maxLen = +Settings.zapCount || 5;
      if (ZapHistory._list.length > ZapHistory._maxLen) ZapHistory._list.length = ZapHistory._maxLen;
    }
    // Weiterschauen im Menü
    var showC = Settings.showContinue !== false;
    ['nav-tab-continue', 'sys-continue'].forEach(function(id){ var el = $(id); if (el) el.style.display = showC ? '' : 'none'; });
    this.applySubStyle();
    this.updateKeyHints();
    if (this._rendered) this.updateUi();
  },

  // Untertitel-Aussehen (Browser-Player über ::cue, iOS/VLC über die App)
  applySubStyle: function(){
    var size = { s: 0.8, m: 1, l: 1.3, xl: 1.6 }[Settings.subSize] || 1;
    var color = Settings.subColor === 'yellow' ? '#ffe14d' : '#fff';
    var bg = Settings.subBg === 'box' ? 'rgba(0,0,0,.55)' : Settings.subBg === 'black' ? '#000' : 'transparent';
    var css = 'video::cue{font-size:' + Math.round(42 * size) + 'px;color:' + color + ';background-color:' + bg +
              ';text-shadow:0 0 6px #000,0 2px 4px #000}';
    var el = $('xc-cue-style');
    if (!el) { el = document.createElement('style'); el.id = 'xc-cue-style'; document.head.appendChild(el); }
    el.textContent = css;
    try {
      if (window.webkit && webkit.messageHandlers && webkit.messageHandlers.xcp)
        webkit.messageHandlers.xcp.postMessage({ cmd: 'player', op: 'substyle', size: size, color: Settings.subColor === 'yellow' ? 0xFFE14D : 0xFFFFFF });
    } catch (e) {}
  },

  // ── Farbtasten im Live-Bild ─────────────────────────────────────
  colorAction: function(color){
    var act = Settings['key' + color] || 'none';
    switch (act) {
      case 'timeshift': if (Player.startLiveTimeshift) Player.startLiveTimeshift(); break;
      case 'epg': Player.toggleEpg(); break;
      case 'guide': if (typeof EpgGrid !== 'undefined' && EpgData.loaded) EpgGrid.toggle(); else Player.toggleEpg(); break;
      case 'subs': Player.toggleSubtitles(); break;
      case 'audio': Player.toggleAudio(); break;
      case 'search': if (typeof openContextSearch === 'function') openContextSearch(); break;
      case 'fav':
        if (S.currentStream) { toggleFav(S.currentStream); }
        break;
      case 'list': Player.toggleChList(); break;
      case 'recent': if (typeof ZapHistory !== 'undefined') ZapHistory.open(); break;
    }
  },
  updateKeyHints: function(){
    ['Red', 'Green', 'Yellow', 'Blue'].forEach(function(c){
      var el = $('kh-' + c.toLowerCase()); if (!el) return;
      var act = Settings['key' + c] || 'none', name = '';
      COLOR_KEY_OPTS.forEach(function(o){ if (o[0] === act) name = o[1]; });
      el.style.display = act === 'none' ? 'none' : '';
      var t = el.querySelector('.kh-act'); if (t) t.textContent = name;
    });
  },

  // ── Aktionen ────────────────────────────────────────────────────
  sleepCycle: function(){ SleepTimer.cycle(); this.updateUi(); },

  epgNow: function(){
    if (typeof EpgData !== 'undefined' && !EpgData._loading) EpgData.refresh();   // holt immer frisch vom Server
  },

  clearCache: function(){
    showConfirm('Zwischenspeicher leeren', 'Senderdaten, EPG und Bilder werden neu vom Anbieter geladen. Die App startet dafür neu.', 'Leeren', function(yes){
      if (!yes) return;
      Options._wipeDbs(function(){ location.reload(); });
    });
  },
  _wipeDbs: function(done){
    var left = 2, step = function(){ if (--left === 0) done(); };
    try { PlaylistDB.clear(); } catch (e) {}
    try {
      if (typeof EPGStore !== 'undefined' && EPGStore.db) {
        var names = [].slice.call(EPGStore.db.objectStoreNames);
        if (names.length) { var tx = EPGStore.db.transaction(names, 'readwrite'); names.forEach(function(n){ tx.objectStore(n).clear(); }); tx.oncomplete = step; tx.onerror = step; }
        else step();
      } else step();
    } catch (e) { step(); }
    setTimeout(step, 400);        // PlaylistDB.clear meldet sich nicht zurück
  },
  resetSettings: function(){
    showConfirm('Einstellungen zurücksetzen', 'Aussehen und Verhalten werden auf den Standard gesetzt. Profile, Favoriten und Playlist-Anpassungen bleiben.', 'Zurücksetzen', function(yes){
      if (!yes) return;
      try { localStorage.removeItem('xcp_settings'); localStorage.removeItem('xcp_vod_aspect'); } catch (e) {}
      location.reload();
    });
  },
  resetAll: function(){
    showConfirm('App komplett zurücksetzen', 'Alle Profile, Favoriten, Einstellungen und gespeicherten Daten werden gelöscht. Danach startet die Einrichtung neu.', 'Alles löschen', function(yes){
      if (!yes) return;
      Options._wipeDbs(function(){ try { localStorage.clear(); } catch (e) {} location.reload(); });
    });
  },

  // ── Einstellungen übertragen (über den eigenen Server, Code 6 Ziffern) ──
  _transferData: function(){
    var p = Profiles.getActive(), d = { v: 1, settings: null, profile: null, favs: null };
    try { d.settings = JSON.parse(localStorage.getItem('xcp_settings') || 'null'); } catch (e) {}
    try { d.aspect = localStorage.getItem('xcp_vod_aspect'); } catch (e) {}
    if (p) {
      try { d.profile = JSON.parse(localStorage.getItem('xcp_profile_settings_' + p.id) || 'null'); } catch (e) {}
      try { d.favs = JSON.parse(localStorage.getItem('xcp_favs_' + p.id) || 'null'); } catch (e) {}
    }
    return d;
  },
  exportSettings: async function(){
    showFullLoader('Code wird erstellt ...', '');
    try {
      var r = await fetch(CONFIG.API.TRANSFER_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(this._transferData()) });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var res = await r.json();
      hideFullLoader();
      showConfirm('Code: ' + res.code, 'Am anderen Gerät unter Einstellungen > Playlist > "Einstellungen von einem anderen Gerät holen" eingeben. Der Code gilt 30 Minuten. Übertragen werden Aussehen, Verhalten, Playlist-Anpassungen und Favoriten des aktiven Profils - keine Zugangsdaten.', 'OK', function(){});
    } catch (e) {
      hideFullLoader();
      showToast('Übertragung nicht möglich: ' + e.message, 3500);
    }
  },
  // Eigenes Eingabefeld statt prompt() - das gibt es in TV-Browsern nicht zuverlässig
  importSettings: function(){
    var m = $('xc-code-modal');
    if (!m) {
      m = document.createElement('div'); m.id = 'xc-code-modal'; m.className = 'hidden';
      m.innerHTML = '<div class="xc-code-box"><div class="xc-code-title">Code vom anderen Gerät</div>' +
        '<input id="xc-code-inp" type="tel" inputmode="numeric" maxlength="6" autocomplete="off" data-focusable placeholder="123456">' +
        '<div class="xc-code-btns"><button class="btn btn-secondary" id="xc-code-no" data-focusable>Abbrechen</button>' +
        '<button class="btn btn-primary" id="xc-code-ok" data-focusable>Übernehmen</button></div></div>';
      document.body.appendChild(m);
      $('xc-code-no').onclick = function(){ Options._closeCode(); };
      $('xc-code-ok').onclick = function(){ Options._submitCode(); };
      $('xc-code-inp').addEventListener('keydown', function(e){ if (e.keyCode === 13) { e.preventDefault(); Options._submitCode(); } });
      // Zurück schließt das Fenster (vor allen anderen Tasten-Handlern)
      window.addEventListener('keydown', function(e){
        if (m.classList.contains('hidden')) return;
        var k = e.keyCode;
        if (k === KEYS.BACK || k === KEYS.BACK2 || k === KEYS.ESC) { e.preventDefault(); e.stopImmediatePropagation(); S._backConsumed = true; Options._closeCode(); }
      }, true);
    }
    $('xc-code-inp').value = '';
    m.classList.remove('hidden');
    if (typeof FocusTrap !== 'undefined') FocusTrap.trap('xc-code-modal');
    setTimeout(function(){ SpatialNav.focusBySelector('#xc-code-inp'); $('xc-code-inp').focus(); }, 80);
  },
  _closeCode: function(){
    var m = $('xc-code-modal'); if (!m) return;
    $('xc-code-inp').blur();
    m.classList.add('hidden');
    if (typeof FocusTrap !== 'undefined') FocusTrap.release('xc-code-modal');
    setTimeout(function(){ SpatialNav.focusBySelector('.ios-row[onclick*="importSettings"]'); }, 50);
  },
  _submitCode: function(){
    var code = String($('xc-code-inp').value || '').replace(/\D/g, '');
    if (code.length !== 6) { showToast('Der Code hat 6 Ziffern', 2500); return; }
    this._closeCode();
    this._importCode(code);
  },
  _importCode: async function(code){
    showFullLoader('Einstellungen werden geholt ...', '');
    try {
      var r = await fetch(CONFIG.API.TRANSFER_URL + '/' + code, { cache: 'no-store' });
      if (r.status === 404) throw new Error('Code unbekannt oder abgelaufen');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var d = await r.json(), p = Profiles.getActive();
      if (d.settings) localStorage.setItem('xcp_settings', JSON.stringify(d.settings));
      if (d.aspect) localStorage.setItem('xcp_vod_aspect', d.aspect);
      if (p && d.profile) localStorage.setItem('xcp_profile_settings_' + p.id, JSON.stringify(d.profile));
      if (p && d.favs) localStorage.setItem('xcp_favs_' + p.id, JSON.stringify(d.favs));
      hideFullLoader();
      showToast('Einstellungen übernommen - App startet neu', 2500);
      setTimeout(function(){ location.reload(); }, 1500);
    } catch (e) {
      hideFullLoader();
      showToast(e.message, 3500);
    }
  }
};

// ── SLEEP-TIMER ──────────────────────────────────────────────────
var SleepTimer = {
  _steps: [0, 30, 60, 90, 120],
  _min: 0, _end: 0, _timer: null,
  cycle: function(){
    var i = this._steps.indexOf(this._min);
    this.set(this._steps[(i + 1) % this._steps.length]);
  },
  set: function(min){
    clearTimeout(this._timer);
    this._min = min; this._end = min ? Date.now() + min * 60000 : 0;
    if (min) {
      var self = this;
      this._timer = setTimeout(function(){ self._fire(); }, min * 60000);
      showToast('Sleep-Timer: ' + min + ' Minuten', 2000);
    } else showToast('Sleep-Timer aus', 1500);
  },
  label: function(){
    if (!this._end) return 'Aus';
    return 'noch ' + Math.max(1, Math.round((this._end - Date.now()) / 60000)) + ' Min';
  },
  _fire: function(){
    this._min = 0; this._end = 0;
    if (S.playerVisible) {
      if (S.playerType === 'live') { Player.destroy(); S.playerVisible = false; if (typeof openSysSidebar === 'function') openSysSidebar(); }
      else Player.close();
    }
    showToast('Sleep-Timer: Wiedergabe beendet', 5000);
    Options.updateUi();
  }
};
