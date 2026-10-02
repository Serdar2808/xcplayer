// ── EINSTELLUNGEN ────────────────────────────────────────────────
var Settings = {
  splitList: false,
  compactList: false,
  compactListEpg: false,
  tileList: null,          // null = noch nie gewählt -> Standard in load()
  tileNames: false,        // Kacheln: Sendername klein unter dem Logo
  compactOsd: false,
  useNetflixStyle: true,
  compactOsdHints: true,
  groupVariants: true,
  showChNumbers: true,
  showChLogos: true,
  startFirstChannel: false,
  nativePlayer: true,
  liveHls: false,
  extendedEpg: false,
  lightTheme: false,
  useSidebar: false,
  showVod: true,
  showSeries: true,
  epgShift: 0,
  sortMethod: { vod:'default', series:'default' },
  playlistRules: [],
  hiddenCats: { live:[], vod:[], series:[] },
  hiddenStreams: { live:[], vod:[], series:[] },
  customOrders: { cats:{ live:[], vod:[], series:[] }, streams:{} },
  customNames: { cats:{}, streams:{}, epgs:{} },
  load: function(){
    try{
      var raw=localStorage.getItem('xcp_settings');
      if(raw){
        var d=JSON.parse(raw);
        this.splitList      = !!d.splitList;
        this.compactList    = d.compactList !== undefined ? !!d.compactList : !!d.epgList;
        this.compactListEpg = !!d.compactListEpg;
        this.compactOsd     = !!d.compactOsd;
        this.useNetflixStyle = d.useNetflixStyle !== false;
        this.compactOsdHints = d.compactOsdHints !== undefined ? !!d.compactOsdHints : true;
        this.playlistRules  = d.playlistRules || [];
        this.groupVariants  = d.groupVariants !== undefined ? !!d.groupVariants : (d.groupDuplicates !== undefined ? !!d.groupDuplicates : true);
        this.showChNumbers  = d.showChNumbers !== undefined ? !!d.showChNumbers : true;
        this.showChLogos    = d.showChLogos !== undefined ? !!d.showChLogos : true;
        this.startFirstChannel = !!d.startFirstChannel;
        this.nativePlayer   = d.nativePlayer !== undefined ? !!d.nativePlayer : true;
        this.liveHls        = !!d.liveHls;
        this.extendedEpg    = !!d.extendedEpg;
        this.useSidebar     = !!d.useSidebar;
        this.lightTheme     = !!d.lightTheme;
        this.showVod        = d.showVod !== false;
        this.showSeries     = d.showSeries !== false;
        this.epgShift       = d.epgShift !== undefined ? parseInt(d.epgShift) : 0;
        if (d.tileList !== undefined && d.tileList !== null) this.tileList = !!d.tileList;
        this.tileNames      = !!d.tileNames;
      }
    }catch(e){ Logger.warn('[Settings] load error:', e); }
    // Kachel-Senderliste: Standard auf Smartphones an (außer die kompakte Liste
    // ist gewählt), sonst aus. Früherer Handy-Schalter (xcp_phone_tiles) zählt mit.
    if (this.tileList === null) {
      var oldPhone = null;
      try { oldPhone = localStorage.getItem('xcp_phone_tiles'); } catch(e){}
      this.tileList = document.documentElement.classList.contains('xc-phone') && !this.compactList && oldPhone !== '0';
    }
    if (this.tileList && this.compactList) this.compactList = false;
    this._apply();
  },
  loadProfile: function(pid){
    try{
      var raw=localStorage.getItem('xcp_profile_settings_' + pid);
      if(raw){
        var d=JSON.parse(raw);
        this.sortMethod     = d.sortMethod || { vod:'default', series:'default' };
        this.playlistRules  = d.playlistRules || [];
        this.hiddenCats     = d.hiddenCats || { live:[], vod:[], series:[] };
        this.hiddenStreams  = d.hiddenStreams || { live:[], vod:[], series:[] };
        this.customOrders   = d.customOrders || { cats:{ live:[], vod:[], series:[] }, streams:{} };
        this.customNames    = d.customNames || { cats:{}, streams:{}, epgs:{} };
      } else {
        // Fallback zur globalen Config (Migration von alten Versionen)
        var oldRaw=localStorage.getItem('xcp_settings');
        if(oldRaw){
          var od=JSON.parse(oldRaw);
          this.sortMethod     = od.sortMethod || { vod:'default', series:'default' };
          if(od.sortVodAlpha && this.sortMethod.vod === 'default') this.sortMethod.vod = 'az';
          this.playlistRules  = od.playlistRules || [];
          this.hiddenCats     = od.hiddenCats || { live:[], vod:[], series:[] };
          this.hiddenStreams  = od.hiddenStreams || { live:[], vod:[], series:[] };
          this.customOrders   = od.customOrders || { cats:{ live:[], vod:[], series:[] }, streams:{} };
          this.customNames    = od.customNames || { cats:{}, streams:{}, epgs:{} };
          this.saveProfile(pid);
        } else {
          this.sortMethod={ vod:'default', series:'default' }; this.playlistRules=[];
          this.hiddenCats={ live:[], vod:[], series:[] }; this.hiddenStreams={ live:[], vod:[], series:[] };
          this.customOrders={ cats:{ live:[], vod:[], series:[] }, streams:{} }; this.customNames={ cats:{}, streams:{}, epgs:{} };
        }
      }
    }catch(e){ Logger.warn('[Settings] loadProfile error:', e); }
    // Frühere Fassungen der Qualitäts-Regel auf die aktuelle heben (erkennt jetzt
    // auch RAW und hochgestellte Angaben wie "RTL ᴴᴰ") - ohne neue Einrichtung
    if(typeof WIZ_QUALITY_RULE !== 'undefined') {
      var oldQ = ['\\s*\\(4K\\)\\s*$|\\s+(FHD|UHD|4K|2K|HD|SD|1080p?|720p?|480p?|HEVC)[*+]?\\s*\\d*\\s*$',
                  '\\s+(FHD|UHD|4K|2K|HD|SD|1080p?|720p?|480p?|HEVC)[*+]?\\s*\\d*\\s*$'];
      var changed = false;
      (this.playlistRules || []).forEach(function(r){
        if(r && r.type === 'regex' && oldQ.indexOf(r.pattern) !== -1) { r.pattern = WIZ_QUALITY_RULE; changed = true; }
      });
      if(changed) this.saveProfile(pid);
    }
  },
  save: function(){
    try{ localStorage.setItem('xcp_settings',JSON.stringify({
      splitList:this.splitList,
      compactList:this.compactList, compactListEpg:this.compactListEpg,
      tileList:this.tileList, tileNames:this.tileNames,
      compactOsd:this.compactOsd, compactOsdHints:this.compactOsdHints,
      useNetflixStyle:this.useNetflixStyle,
      groupVariants:this.groupVariants,
      showChNumbers:this.showChNumbers, showChLogos:this.showChLogos,
      startFirstChannel:this.startFirstChannel,
      nativePlayer:this.nativePlayer,
      liveHls:this.liveHls,
      extendedEpg:this.extendedEpg, lightTheme:this.lightTheme,
      useSidebar:this.useSidebar,
      showVod: this.showVod,
      showSeries: this.showSeries,
      epgShift:this.epgShift
    })); }catch(e){ Logger.warn('[Settings] save error:', e); }
    
    var p = Profiles.getActive();
    if(p) this.saveProfile(p.id);
  },
  saveProfile: function(pid){
    try{
      localStorage.setItem('xcp_profile_settings_' + pid, JSON.stringify({
        sortMethod:this.sortMethod, playlistRules:this.playlistRules,
        hiddenCats:this.hiddenCats, hiddenStreams:this.hiddenStreams,
        customOrders:this.customOrders, customNames:this.customNames
      }));
    }catch(e){ Logger.warn('[Settings] saveProfile error:', e); }
  },
  _apply: function(){
    var tsp=$('toggle-split-list');
    if(tsp) tsp.classList.toggle('on',this.splitList);
    var t=$('toggle-epg-list');
    if(t) t.classList.toggle('on',this.compactList);
    var tcle=$('toggle-compact-list-epg');
    if(tcle) tcle.classList.toggle('on',this.compactListEpg);
    var ttl=$('toggle-tile-list');
    if(ttl) ttl.classList.toggle('on',!!this.tileList);
    document.documentElement.classList.toggle('xc-tiles-on', !!this.tileList);
    var ttn=$('toggle-tile-names');
    if(ttn) ttn.classList.toggle('on',!!this.tileNames);
    var subTl=$('sub-tileList');
    if(subTl) subTl.classList.toggle('expanded', !!this.tileList);
    var tco=$('toggle-compact-osd');
    if(tco) tco.classList.toggle('on',this.compactOsd);
    var tcoh=$('toggle-compact-osd-hints');
    if(tcoh) tcoh.classList.toggle('on',this.compactOsdHints);
    var tns=$('toggle-netflix-style');
    if(tns) tns.classList.toggle('on',this.useNetflixStyle);
    var tgv=$('toggle-group-variants');
    if(tgv) tgv.classList.toggle('on',this.groupVariants);
    var tcn=$('toggle-ch-numbers');
    if(tcn) tcn.classList.toggle('on',this.showChNumbers);
    var tcl=$('toggle-ch-logos');
    if(tcl) tcl.classList.toggle('on',this.showChLogos);
    var tsf=$('toggle-start-first');
    if(tsf) tsf.classList.toggle('on',this.startFirstChannel);
    var tnp=$('toggle-native-player');
    if(tnp) tnp.classList.toggle('on',this.nativePlayer);
    var npSub=$('native-player-sub');
    if(npSub){
      npSub.textContent = this.nativePlayer
        ? 'TV-Decoder mit MPEG-TS · geringste CPU, beste Kompatibilität'
        : 'HLS.js mit m3u8 · Adaptive Bitrate, mehr Track-Optionen, höhere CPU';
    }
    var tlh=$('toggle-live-hls');
    if(tlh) tlh.classList.toggle('on',this.liveHls); 
	var tee=$('toggle-extended-epg');
    if(tee) tee.classList.toggle('on',this.extendedEpg);
    var tlt=$('toggle-light-theme');
    if(tlt) tlt.classList.toggle('on',this.lightTheme);
    document.documentElement.classList.toggle('theme-light', this.lightTheme);
    document.body.classList.toggle('use-sidebar', this.useSidebar);
    var tus=$('toggle-use-sidebar');
    if(tus) tus.classList.toggle('on',this.useSidebar);
    var esSub=$('epg-shift-sub');
    if(typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
    if(esSub){
      esSub.textContent='Zeitversatz: '+(this.epgShift>0?'+':'')+this.epgShift+' Stunden';
    }
    // Bedingte Untergruppen
    var subCl=$('sub-compactList');
    if(subCl) { subCl.style.display = ''; subCl.classList.toggle('expanded', this.compactList); }
    var subCo=$('sub-compactOsd');
    if(subCo) { subCo.style.display = ''; subCo.classList.toggle('expanded', this.compactOsd); }
    // Listen-Sichtbarkeitsklassen anwenden
    var clo=$('ch-list-overlay');
    if(clo){
      clo.classList.toggle('hide-nums',!this.showChNumbers);
      clo.classList.toggle('hide-logos',!this.showChLogos);
      clo.classList.toggle('show-epg', this.compactListEpg);
    }
    var sg=$('stream-grid');
    if(sg){ sg.classList.toggle('hide-logos',!this.showChLogos); }
    // Live OSD Klassen
    var osd=$('live-osd');
    if(osd){
      osd.classList.toggle('compact-osd', this.compactOsd);
      osd.classList.toggle('hide-hints', this.compactOsd && !this.compactOsdHints);
    }
    // Einstellungen: Filme/Serien im Menü, Auswahl-Karten und Vorschaubilder
    var tsv=$('toggle-show-vod');
    if(tsv) tsv.classList.toggle('on', this.showVod !== false);
    var tss=$('toggle-show-series');
    if(tss) tss.classList.toggle('on', this.showSeries !== false);
    if(typeof renderSettingsChoices === 'function') renderSettingsChoices();
  }
};

function toggleSetting(key){
  Settings[key]=!Settings[key];
  // Kachel-Senderliste und kompakte Liste schließen sich gegenseitig aus
  if(key === 'tileList' && Settings.tileList) Settings.compactList = false;
  if(key === 'compactList' && Settings.compactList) Settings.tileList = false;
  Settings.save(); Settings._apply();
  // Filme/Serien im Menü sofort ein- bzw. ausblenden
  if(key === 'showVod' || key === 'showSeries'){
    ['nav-tab-vod','sys-vod'].forEach(function(id){ var el=$(id); if(el) el.style.display = Settings.showVod !== false ? '' : 'none'; });
    ['nav-tab-series','sys-series'].forEach(function(id){ var el=$(id); if(el) el.style.display = Settings.showSeries !== false ? '' : 'none'; });
  }

  if (S.streams && S.streams.length > 0) {
    if (key === 'groupVariants') S.filteredStreams = applyVariantGrouping(S.streams);
    if ((key === 'groupVariants' || key === 'compactList') && S.tab === 'live') {
      resetVirtualGrid();
      if ($('cc')) $('cc').textContent = '(' + S.filteredStreams.length + ')';
    }
  if (key === 'useNetflixStyle' && (S.tab === 'vod' || S.tab === 'series') && S.screen === 'main') {
    switchTab(S.tab);
  }
  }
  // Live-Aktualisierung für Senderlisten-Einstellungen, während die Liste offen ist
  if(S.chListOpen && (key === 'compactList' || key === 'splitList' || key === 'compactListEpg' || key === 'showChNumbers' || key === 'showChLogos')){
    $('ch-list-overlay').classList.toggle('compact', Settings.compactList);
    $('ch-list-overlay').classList.toggle('split-mode', Settings.splitList);
    if (Settings.splitList) {
       S.chListFocusArea = 'streams';
       S.chListSplitCatCursor = S.chListCatIdx;
       renderChListSplitCats();
    } else {
       S.chListFocusArea = 'streams';
    }
    if(typeof _updateVlistRows === 'function') _updateVlistRows();
  }
  if(typeof _resetAutoClose === 'function') _resetAutoClose();
  
  if(typeof SpatialNav !== 'undefined' && SpatialNav.focused) {
     var pv = SpatialNav.focused.getAttribute('data-preview');
     if(pv && typeof setPreview === 'function') setPreview(pv);
  }
}

function changeEpgShift(){
  var current = Settings.epgShift || 0;
  var next = current >= 12 ? -12 : current + 1;
  Settings.epgShift = next;
  Settings.save(); Settings._apply();
  showToast('EPG Timeshift: ' + (next>0?'+':'') + next + 'h — Lade EPG neu…', 3000);
  // Automatisches Neuladen des EPG mit neuem Zeitversatz
  setTimeout(function(){
    EpgData.loaded = false;
    EPGStore.clear(); // Festplatte leeren, damit XML mit neuen Zeiten geladen wird
    EpgData.load();
  }, 500);
}

// ── PROFILE ──────────────────────────────────────────────────────
var Profiles = {
  list:[],
  activeId:null,
  load:function(){
    try{
      var r=localStorage.getItem('xcp_profiles');
      if(r) this.list=JSON.parse(r);
      this.activeId=localStorage.getItem('xcp_active')||null;
    }catch(e){ Logger.warn('[Profiles] load error:', e); this.list=[]; }
  },
  save:function(){
    try{
      localStorage.setItem('xcp_profiles',JSON.stringify(this.list));
    }catch(e){ Logger.warn('[Profiles] save error:', e); }
  },
  add:function(p){
    // Eindeutig, auch wenn mehrere Profile in derselben Millisekunde angelegt werden (Cloud-Sync)
    var id='p'+Date.now(), n=0;
    while(this.get(id)) id='p'+Date.now()+'_'+(++n);
    p.id=id; this.list.push(p); this.save(); return p;
  },
  update:function(id,data){
    for(var i=0;i<this.list.length;i++) if(this.list[i].id===id){ this.list[i]=data; break; }
    this.save();
  },
  remove:function(id){
    this.list=this.list.filter(function(p){ return p.id!==id; });
    if(this.activeId===id) this.activeId=null;
    this.save();
  },
  get:function(id){ for(var i=0;i<this.list.length;i++) if(this.list[i].id===id) return this.list[i]; return null; },
  getActive:function(){ return this.activeId?this.get(this.activeId):null; },
  setActive:function(id){ this.activeId=id; try{ localStorage.setItem('xcp_active',id); }catch(e){ Logger.warn('[Profiles] setActive error:', e); } },
  initials:function(n){ if(!n) return '?'; var p=n.trim().split(' '); return p.length>=2?(p[0][0]+p[1][0]).toUpperCase():n.slice(0,2).toUpperCase(); }
};

var Device = {
  getMac: function() {
    var mac = localStorage.getItem('xcp_mac');
    if (!mac) {
      var chars = '0123456789ABCDEF';
      mac = '';
      for (var i = 0; i < 6; i++) {
        mac += chars[Math.floor(Math.random() * 16)] + chars[Math.floor(Math.random() * 16)];
        if (i < 5) mac += ':';
      }
      localStorage.setItem('xcp_mac', mac);
    }
    return mac;
  }
};

// ── INDEXED DB ───────────────────────────────────────────────────
var EPGStore = {
  dbName:'XCPlayer_EPG', dbVersion:2, db:null,
  init: function() {
    return new Promise(function(resolve) {
      var req = indexedDB.open('XCPlayer_EPG', 2);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('xmltv')) db.createObjectStore('xmltv', {keyPath:'key'});
        if (!db.objectStoreNames.contains('epg'))   db.createObjectStore('epg',   {keyPath:'stream_id'});
      };
      req.onsuccess = function(e) { EPGStore.db = e.target.result; resolve(); };
      req.onerror   = function()  { resolve(); };
    });
  },
  // Speichert die EPG in Bl\u00f6cken - "erst schreiben, dann umschalten":
  // Die neuen Bl\u00f6cke bekommen eine eigene Generations-Kennung. Erst wenn alle
  // geschrieben sind, zeigt der Meta-Eintrag darauf; danach werden die alten
  // gel\u00f6scht. Bricht das Speichern ab (App geschlossen, Speicher voll ...),
  // bleibt die bisherige, vollst\u00e4ndige EPG g\u00fcltig. Fr\u00fcher wurden die alten
  // Bl\u00f6cke zuerst gel\u00f6scht - ein Abbruch hinterlie\u00df dann eine halbe EPG, die
  // beim n\u00e4chsten Start als g\u00fcltig galt.
  saveXmltvData: function(data) {
    if (!this.db) return;
    var db = this.db;
    var p = Profiles.getActive();
    var pId = p ? p.id : 'default';
    var base = 'p_' + pId + '_';
    var gen = Date.now().toString(36);
    var prefix = base + gen + '_';
    var progKeys = Object.keys(data.programmes);
    var chunkSize = 50, chunkIndex = 0, i = 0, failed = false;

    // Bl\u00f6cke dieses Profils l\u00f6schen, deren Schl\u00fcssel match() erf\u00fcllt
    function deleteBlocks(match) {
      try {
        var tx = db.transaction(['xmltv'], 'readwrite');
        var req = tx.objectStore('xmltv').openCursor(IDBKeyRange.bound(base, base + '\uffff'));
        req.onsuccess = function(e) {
          var cursor = e.target.result;
          if (!cursor) return;
          if (match(String(cursor.key))) cursor.delete();
          cursor.continue();
        };
      } catch(e) { Logger.warn('[EPGStore] Aufr\u00e4umen fehlgeschlagen:', e.message); }
    }
    function fail(msg) {
      if (failed) return;
      failed = true;
      Logger.warn('[EPGStore] Speichern abgebrochen, bisherige EPG bleibt g\u00fcltig:', msg);
      deleteBlocks(function(k) { return k.indexOf(prefix) === 0; });   // halbe neue Generation entfernen
    }
    function writeMeta() {
      try {
        var tx = db.transaction(['xmltv'], 'readwrite');
        tx.objectStore('xmltv').put({
          key: 'meta_' + pId, channels: JSON.stringify(data.channels),
          ts: Date.now(), chunkCount: chunkIndex, gen: gen
        });
        tx.oncomplete = function() {
          Logger.info('[EPGStore] ' + chunkIndex + ' Bl\u00f6cke + Meta gespeichert f\u00fcr ' + pId);
          deleteBlocks(function(k) { return k.indexOf(prefix) !== 0; });  // alte Generationen weg
        };
        tx.onerror = tx.onabort = function() { fail('Meta: ' + (tx.error && tx.error.name)); };
      } catch(e) { fail('Meta: ' + e.message); }
    }
    function writeNextBatch() {
      if (failed) return;
      if (i >= progKeys.length) return writeMeta();
      try {
        var tx = db.transaction(['xmltv'], 'readwrite');
        var end = Math.min(i + chunkSize, progKeys.length);
        var chunk = {};
        for (; i < end; i++) chunk[progKeys[i]] = data.programmes[progKeys[i]];
        tx.objectStore('xmltv').put({key: prefix + chunkIndex, progs: JSON.stringify(chunk)});
        chunkIndex++;
        tx.oncomplete = function() { setTimeout(writeNextBatch, 10); };
        tx.onerror = tx.onabort = function() { fail('Block ' + chunkIndex + ': ' + (tx.error && tx.error.name)); };
      } catch(e) { fail('Block ' + chunkIndex + ': ' + e.message); }
    }
    writeNextBatch();
  },
  // maxAgeMs: Standard = normale Gültigkeit (EPG_CACHE_TTL). Mit größerem Wert
  // (EPG_STALE_MAX_MS) liefert er ältere Daten als Notlösung, wenn der Server
  // nicht erreichbar ist.
  getXmltvData: function(maxAgeMs) {
    var maxAge = maxAgeMs || CONFIG.EPG_CACHE_TTL;
    return new Promise(function(resolve) {
      if (!EPGStore.db) return resolve(null);
      var p = Profiles.getActive();
      var pId = p ? p.id : 'default';
      try {
        var tx  = EPGStore.db.transaction(['xmltv'], 'readonly');
        var store = tx.objectStore('xmltv');
        var metaReq = store.get('meta_'+pId);
        metaReq.onsuccess = function() {
          var m = metaReq.result;
          if (m && Date.now() - m.ts < maxAge) {
            var out = { channels: {}, programmes: {} };
            if (typeof m.channels === 'string') {
               try { out.channels = JSON.parse(m.channels); } catch(e) { Logger.warn('[EPGStore] channels-Meta beschädigt:', e.message); }
            } else { out.channels = m.channels || {}; }

            // Nur die Bl\u00f6cke der Generation, auf die der Meta-Eintrag zeigt
            // (Altbestand ohne Generation: alle Bl\u00f6cke des Profils)
            var prefix = 'p_'+pId+'_' + (m.gen ? m.gen + '_' : '');
            var curReq = store.openCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'));
            var chunksFound = 0;            
            curReq.onsuccess = function(e) {
              var cursor = e.target.result;
              if (cursor) {
                try {
                  var parsed = JSON.parse(cursor.value.progs);
                  var keys = Object.keys(parsed);
                  for(var k=0; k<keys.length; k++) {
                     out.programmes[keys[k]] = parsed[keys[k]];
                  }
                  chunksFound++;
                } catch(ex) { Logger.warn('[EPGStore] EPG-Chunk beschädigt, übersprungen:', ex.message); }
                cursor.continue();
              } else {
                // Nur vollständige Daten verwenden - eine halbe EPG würde sonst
                // bis zu 24 h als gültig gelten und kein Neuladen auslösen.
                if (chunksFound === m.chunkCount) {
                   resolve(out);
                } else {
                   Logger.warn('[EPGStore] Cache unvollständig (' + chunksFound + ' von ' + m.chunkCount + ' Blöcken) - wird neu geladen');
                   resolve(null);
                }
              }
            };
            curReq.onerror = function() { resolve(null); };
          } else {
            resolve(null);
          }
        };
        metaReq.onerror = function() { resolve(null); };
      } catch(e) { Logger.warn('[EPGStore] get error', e); resolve(null); }
    });
  },
  get: function(sid) {
    return new Promise(function(resolve) {
      if (!EPGStore.db) return resolve(null);
      var p = Profiles.getActive();
      var pId = p ? p.id : 'default';
      var tx  = EPGStore.db.transaction(['epg'], 'readonly');
      var req = tx.objectStore('epg').get(pId + '_' + sid);
      req.onsuccess = function() {
        var d = req.result;
        if (d && Date.now()-d.timestamp < CONFIG.EPG_CACHE_TTL) resolve(d.listings);
        else resolve(null);
      };
      req.onerror = function() { resolve(null); };
    });
  },
  set: function(sid, listings) {
    if (!this.db) return;
    var p = Profiles.getActive();
    var pId = p ? p.id : 'default';
    var tx = this.db.transaction(['epg'], 'readwrite');
    tx.objectStore('epg').put({stream_id: pId + '_' + sid, listings:listings, timestamp:Date.now()});
  },
  clear: function() {
    if (!this.db) return;
    try{ this.db.transaction(['xmltv'], 'readwrite').objectStore('xmltv').clear(); }catch(e){ Logger.warn('[EPGStore] clear xmltv error:', e.message); }
    try{ this.db.transaction(['epg'], 'readwrite').objectStore('epg').clear(); }catch(e){ Logger.warn('[EPGStore] clear epg error:', e.message); }
  }
};

var PlaylistDB = {
  dbName: 'XCPlayer_Playlist', dbVersion: 1, db: null,
  init: function() {
    return new Promise(function(resolve) {
      var req = indexedDB.open('XCPlayer_Playlist', 1);
      req.onupgradeneeded = function(e) {
        var db = e.target.result;
        if (!db.objectStoreNames.contains('data')) db.createObjectStore('data', {keyPath:'id'});
      };
      req.onsuccess = function(e) { PlaylistDB.db = e.target.result; resolve(); };
      req.onerror = function() { resolve(); };
    });
  },
  get: function(id) {
    return new Promise(function(resolve) {
      if (!PlaylistDB.db) return resolve(null);
      var tx = PlaylistDB.db.transaction(['data'], 'readonly');
      var req = tx.objectStore('data').get(id);
      req.onsuccess = function() { resolve(req.result ? req.result.payload : null); };
      req.onerror = function() { resolve(null); };
    });
  },
  set: function(id, payload) { if (PlaylistDB.db) PlaylistDB.db.transaction(['data'], 'readwrite').objectStore('data').put({id: id, payload: payload, ts: Date.now()}); },
  clear: function() { if (PlaylistDB.db) PlaylistDB.db.transaction(['data'], 'readwrite').objectStore('data').clear(); }
};