// ── EINSTELLUNGEN ────────────────────────────────────────────────
var Settings = {
  splitList: false,
  compactList: false,
  compactListEpg: false,
  compactOsd: false,
  useNetflixStyle: true,
  compactOsdHints: true,
  groupVariants: true,
  showChNumbers: true,
  showChLogos: true,
  startFirstChannel: false,
  nativePlayer: true,
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
        this.extendedEpg    = !!d.extendedEpg;
        this.useSidebar     = !!d.useSidebar;
        this.lightTheme     = !!d.lightTheme;
        this.showVod        = d.showVod !== false;
        this.showSeries     = d.showSeries !== false;
        this.epgShift       = d.epgShift !== undefined ? parseInt(d.epgShift) : 0;
      }
    }catch(e){ Logger.warn('[Settings] load error:', e); }
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
  },
  save: function(){
    try{ localStorage.setItem('xcp_settings',JSON.stringify({
      splitList:this.splitList,
      compactList:this.compactList, compactListEpg:this.compactListEpg,
      compactOsd:this.compactOsd, compactOsdHints:this.compactOsdHints,
      useNetflixStyle:this.useNetflixStyle,
      groupVariants:this.groupVariants,
      showChNumbers:this.showChNumbers, showChLogos:this.showChLogos,
      startFirstChannel:this.startFirstChannel,
      nativePlayer:this.nativePlayer,
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
  }
};

function toggleSetting(key){
  Settings[key]=!Settings[key];
  Settings.save(); Settings._apply();
  
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
  add:function(p){ p.id='p'+Date.now(); this.list.push(p); this.save(); return p; },
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
  saveXmltvData: function(data) {
    if (!this.db) return;
    var db = this.db;
    var p = Profiles.getActive();
    var pId = p ? p.id : 'default';
    var prefix = 'p_' + pId + '_';
    
    try {
      var delTx = db.transaction(['xmltv'], 'readwrite');
      var delStore = delTx.objectStore('xmltv');
      var curReq = delStore.openCursor(IDBKeyRange.bound(prefix, prefix + '\uffff'));
      curReq.onsuccess = function(e) {
        var cursor = e.target.result;
        if (cursor) { cursor.delete(); cursor.continue(); }
      };
      
      delTx.oncomplete = function() {
        var progKeys = Object.keys(data.programmes);
        var chunkSize = 50;
        var chunkIndex = 0;
        var i = 0;
        var totalChunks = Math.ceil(progKeys.length / chunkSize);
        
        function writeNextBatch() {
          if (i >= progKeys.length) {
            try {
              var metaTx = db.transaction(['xmltv'], 'readwrite');
              metaTx.objectStore('xmltv').put({
                key: 'meta_' + pId,
                channels: JSON.stringify(data.channels),
                ts: Date.now(),
                chunkCount: totalChunks
              });
              metaTx.oncomplete = function() { Logger.info('[EPGStore] Saved ' + totalChunks + ' chunks + meta for ' + pId); };
            } catch(e) { Logger.warn('[EPGStore] meta write error:', e); }
            return;
          }
          try {
            var tx = db.transaction(['xmltv'], 'readwrite');
            var store = tx.objectStore('xmltv');
            var end = Math.min(i + chunkSize, progKeys.length);
            var chunk = {};
            for (; i < end; i++) {
              chunk[progKeys[i]] = data.programmes[progKeys[i]];
            }
            store.put({key: prefix + chunkIndex, progs: JSON.stringify(chunk)});
            chunkIndex++;
            tx.oncomplete = function() { setTimeout(writeNextBatch, 10); };
            tx.onerror = function() { Logger.warn('[EPGStore] chunk write error'); setTimeout(writeNextBatch, 10); };
          } catch(e) { Logger.warn('[EPGStore] batch error:', e); }
        }
        writeNextBatch();
      };
      delTx.onerror = function() { Logger.warn('[EPGStore] delete failed, writing anyway'); };
    } catch(e) { Logger.warn('[EPGStore] save error', e); }
  },
  getXmltvData: function() {
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
          if (m && Date.now() - m.ts < CONFIG.EPG_CACHE_TTL) {
            var out = { channels: {}, programmes: {} };
            if (typeof m.channels === 'string') {
               try { out.channels = JSON.parse(m.channels); } catch(e) {}
            } else { out.channels = m.channels || {}; }

            var prefix = 'p_'+pId+'_';
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
                } catch(ex) {}
                cursor.continue();
              } else {
                if (chunksFound > 0 || m.chunkCount === 0) {
                   resolve(out);
                } else {
                   Logger.warn('[EPGStore] Cache invalid (no chunks)');
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