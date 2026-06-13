// ── NAVBAR-Sichtbarkeit zentral steuern ────────────────────────────
// Die globale navbar zeigen/verstecken je nach Bildschirm:
// - Browser (main, continue):  sichtbar, normaler Stil
// - Player:                    versteckt (kommt erst per Menü mit OSD-Stil)
// - Profile / Wizard / Settings: versteckt
function _updateNavbarVisibility(){
  var nb = document.getElementById('navbar');
  var sb = document.getElementById('sys-sidebar');
  if(!nb) return;
  if (Settings.useSidebar) {
    nb.classList.add('hidden');
    nb.classList.remove('player-osd');
    if(sb) {
      if(S.screen === 'profile' || S.screen === 'wizard' || S.playerVisible || S.seriesDetailOpen) {
        sb.classList.add('sys-hidden');
      } else {
        sb.classList.remove('sys-hidden');
      }
    }
    return;
  }
  if(sb) sb.classList.add('sys-hidden');
  if(S.screen === 'profile' || S.screen === 'wizard'){
    nb.classList.add('hidden');
    nb.classList.remove('player-osd');
    return;
  }
  if(S.screen === 'settings'){
    nb.classList.remove('hidden');
    nb.classList.remove('player-osd');
    return;
  }
  if(S.sysMenuOpen){
    nb.classList.remove('hidden');
    if(S.playerVisible) nb.classList.add('player-osd');
    else nb.classList.remove('player-osd');
    return;
  }
  if(S.playerVisible){
    nb.classList.add('hidden');
    nb.classList.remove('player-osd');
    return;
  }
  if(S.screen === 'main' || S.screen === 'continue'){
    nb.classList.remove('hidden');
    nb.classList.remove('player-osd');
    return;
  }
  nb.classList.remove('hidden');
  nb.classList.remove('player-osd');
}

// ── FOCUS TRAP FÜR MODALS (Verhindert das Rausspringen der Navigation) ──
var FocusTrap = {
  _stack: [],
  trap: function(containerId) {
    var disabled = [];
    document.querySelectorAll('[data-focusable]').forEach(function(el) {
      if (!el.closest('#' + containerId)) {
        el.removeAttribute('data-focusable');
        el.setAttribute('data-trapped-focus', 'true');
        disabled.push(el);
      }
    });
    this._stack.push(containerId);
    this['_disabled_' + containerId] = disabled;
  },
  release: function(containerId) {
    var idx = this._stack.indexOf(containerId);
    if (idx > -1) {
      this._stack.splice(idx, 1);
      var disabled = this['_disabled_' + containerId];
      if (disabled) {
        disabled.forEach(function(el) {
          el.removeAttribute('data-trapped-focus');
          el.setAttribute('data-focusable', '');
        });
        delete this['_disabled_' + containerId];
      }
    }
  },
  clearAll: function() {
    while(this._stack.length > 0) {
      this.release(this._stack[this._stack.length - 1]);
    }
  }
};


// ── BESSERE STREAM FEHLERMELDUNGEN ─────────────────────────────
var _streamLoadStart = 0;
var _catchupJustStarted = 0; // Zeitstempel: Senderliste nach Catchup-Start kurz unterdrücken

function showStreamError(msg, detail){
  $('set-msg').textContent = msg;
  $('set-detail').textContent = detail || '';
  var el=$('stream-error-toast');
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function(){ el.classList.remove('show'); }, 5000);
}

// ── SENDER SCHNELLSUCHE in Senderliste ─────────────────────────
var _chSearchBuf = '';
var _chSearchTimer = null;

function handleChSearchInList(digit){
  _chSearchBuf += digit;
  $('ch-search-num').textContent = _chSearchBuf;
  $('ch-search-osd').classList.add('show');
  clearTimeout(_chSearchTimer);
  _chSearchTimer = setTimeout(function(){
    var num = parseInt(_chSearchBuf);
    _chSearchBuf = '';
    $('ch-search-osd').classList.remove('show');
    // In filteredStreams springen
    var idx = num - 1;
    if(idx >= 0 && idx < S.filteredStreams.length){
      S.chListCursor = idx;
      S_CLO_OFFSET = Math.max(0, idx - Math.floor(VLIST_ROWS/2));
      renderChListOverlay();
      showToast('Kanal ' + num + ': ' + (S.filteredStreams[idx].name||''), 1500);
    } else {
      showToast('Kanal '+num+' nicht gefunden', 1500);
    }
  }, CONFIG.CH_NUM_TIMEOUT);
}

// ── EPG TIMESHIFT AUTO-REFRESH ───────────────────────────────────
// Patching changeEpgShift to also auto-reload EPG

function saveLastStream(s){
  var p = Profiles.getActive(); var pid = p ? p.id : 'default';
  try{ localStorage.setItem('xcp_last_live_' + pid,JSON.stringify({stream_id:s.stream_id,name:s.name,stream_icon:s.stream_icon||'',category_id:s.category_id||''})); }catch(e){ Logger.warn('[LastStream] save error:', e); }
}
function loadLastStream(){
  var p = Profiles.getActive(); var pid = p ? p.id : 'default';
  try{ 
    var r=localStorage.getItem('xcp_last_live_' + pid); 
    if(r) return JSON.parse(r);
    return null;
  }catch(e){ Logger.warn('[LastStream] load error:', e); return null; }
}

// ── LIVE TV DIREKTSTART ───────────────────────────────────────────
async function launchLiveTv(){
  S.screen='live'; S.tab='live'; S.liveDirect=true;
  S.focusArea = 'player';
  PlaylistRefresh.start();
  if (S.seriesDetailOpen) { S.seriesDetailOpen = false; }
  if(typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
  if(typeof updateNavTabsActive === 'function') updateNavTabsActive('live');
  showFullLoader('Live TV laden...', 'Bitte warten');
  
  try {
    // Sofort alles aus dem RAM/DB laden, damit Streams direkt verifiziert werden können
    var [liveCats, liveStreams] = await Promise.all([
      getOrFetchData('cats', 'live'),
      getOrFetchData('streams', 'live')
    ]);
    
    S.categories = processCatsFilter(liveCats, 'live');
    var arr = Array.isArray(liveStreams) ? liveStreams : [];
    S.streams = processStreamsFilter(arr);
    S.fullStreams.live = S.streams;
    
    var last = loadLastStream();
    if (Settings.startFirstChannel) {
      try { 
        var p = Profiles.getActive(); var pid = p ? p.id : 'default';
        var firstStream = localStorage.getItem('xcp_first_live_' + pid);
        if (firstStream) last = JSON.parse(firstStream);
      } catch(e) { /* parse error */ }
    }
    
    // Kategorie des letzten Senders auswählen
    var opts = buildCatOpts();
    var targetCatId = last ? last.category_id : null;
    var foundIdx = 0;
    if (targetCatId) {
       for (var i=0; i<opts.length; i++) {
          if (String(opts[i].id) === String(targetCatId)) { foundIdx = i; break; }
       }
    }
    S.chListCatIdx = foundIdx;
    var opt = opts[foundIdx];

    // Filtern nach gewählter Kategorie
    var catArr = S.streams;
    if (opt && opt.id === 'fav') catArr = catArr.filter(function(s){ return S.favs.live.indexOf(s.stream_id)!==-1; });
    else if (opt && opt.id !== null) catArr = catArr.filter(function(s){ return String(s.category_id) === String(opt.id); });
    S.filteredStreams = applyVariantGrouping(catArr);

    // Überprüfen ob der "Letzte Sender" (last) überhaupt noch in der Liste existiert
    var streamToPlay = null;
    S.currentStreamIdx = 0;
    if (last) {
       var baseCur = _baseName(last.name);
       for (var i=0; i<S.filteredStreams.length; i++) {
         if (S.filteredStreams[i].stream_id === last.stream_id) { S.currentStreamIdx=i; streamToPlay = S.filteredStreams[i]; break; }
         if (Settings.groupVariants && _baseName(S.filteredStreams[i].name)===baseCur) { S.currentStreamIdx=i; streamToPlay = S.filteredStreams[i]; break; }
       }
    }
    
    // Fallback: Erster Sender in der Liste, falls "last" vom Provider gelöscht wurde
    if (!streamToPlay && S.filteredStreams.length > 0) {
       streamToPlay = S.filteredStreams[0];
       S.currentStreamIdx = 0;
    }

    // Speichere den 1. Sender für die "Start-Kanal 1" Option
    if (foundIdx === 0 && S.filteredStreams.length > 0) {
       try { var p2 = Profiles.getActive(); var pid2 = p2 ? p2.id : 'default'; localStorage.setItem('xcp_first_live_' + pid2, JSON.stringify(S.filteredStreams[0])); } catch(e) { /* localStorage full */ }
    }

    hideFullLoader();
    
    if (streamToPlay) {
      Player.play(API.liveUrl(streamToPlay), streamToPlay, 'live');
      saveLastStream(streamToPlay);
      if (!EpgData.loaded && !EpgData._loading) setTimeout(function(){ EpgData.load(); }, 800);
    } else {
      showToast('Keine Sender gefunden', 3000);
    }
  } catch(e) {
    hideFullLoader();
    showToast('Fehler: ' + e.message, 3000);
  }
}

// ── VIRTUAL CHANNEL LIST ──────────────────────────────────────────
var CLO_ROW_H = 74;       // Reihenhöhe laut CSS (.clo-row height:74px)

// Berechnet die maximal sichtbare Reihen-Anzahl basierend auf der
// tatsächlichen Container-Höhe. Wichtig für den kompakten Modus,
// in dem die Liste den verfügbaren Bildschirm füllt.
function _calcVlistRows(){
  var list = $('clo-list');
  if(!list) return CONFIG.VLIST_ROWS;
  // clientHeight liefert den nutzbaren Innenraum (ohne padding-bottom)
  var h = list.clientHeight;
  if(!h){
    // Fallback: aus Overlay-Höhe minus topbar/hints schätzen
    var ov = $('ch-list-overlay');
    if(ov){
      var oh = ov.clientHeight;
      var compact = ov.classList.contains('compact');
      var nonList = compact ? 70 : 112; // topbar+hints
      h = Math.max(0, oh - nonList);
    }
  }
  if(!h) return CONFIG.VLIST_ROWS;
  var n = Math.floor(h / CLO_ROW_H);
  // Mindestens config-Wert, höchstens 20 (Sicherheit gegen riesige Displays)
  return Math.max(CONFIG.VLIST_ROWS, Math.min(20, n));
}

function _buildChRow(i){
  var row = document.createElement('div');
  row.className = 'clo-row';
  row.id = 'vrow-' + i;
  row.innerHTML =
    '<div class="clo-num" id="vrn-'+i+'"></div>'
    +'<div class="clo-logo-wrap"><img class="clo-logo" id="vrli-'+i+'" src="" alt="" onerror="this.style.display=\'none\'"><span class="clo-logo-ph" id="vrlp-'+i+'" style="display:none">&#x1F4E1;</span></div>'
    +'<div class="clo-info"><span class="clo-name" id="vrna-'+i+'"></span><span class="clo-epg" id="vrep-'+i+'"></span></div>'
    +'<div class="clo-right"><span class="clo-time" id="vrtm-'+i+'"></span>'
    +'<div class="clo-bar-wrap"><div class="clo-bar-fill" id="vrba-'+i+'" style="width:0%"></div></div></div>';
  row.setAttribute('data-vi', i);
  row.addEventListener('click', function(){ chListSelect(); });
  row.addEventListener('mouseover', function(){
    if(Settings.splitList) S.chListFocusArea = 'streams';
    var vi=parseInt(this.getAttribute('data-vi'));
    var newIdx=S_CLO_OFFSET+vi;
    if(newIdx < S.filteredStreams.length && newIdx !== S.chListCursor){
      S.chListCursor=newIdx;
      if(Settings.splitList) _updateSplitCatFocus();
      _updateVlistFocus();
    }
  });
    row._ui = {
      num: row.querySelector('.clo-num'),
      img: row.querySelector('.clo-logo'),
      ph: row.querySelector('.clo-logo-ph'),
      name: row.querySelector('.clo-name'),
      epg: row.querySelector('.clo-epg'),
      time: row.querySelector('.clo-time'),
      bar: row.querySelector('.clo-bar-fill')
    };
  return row;
}

function buildChListDOM(){
  var list = $('clo-list');
  list.innerHTML = '';
  // VLIST_ROWS wird gleich in initChListOverlay neu berechnet,
  // hier bauen wir mit dem aktuellen Wert.
  for(var i=0; i<VLIST_ROWS; i++){
    list.appendChild(_buildChRow(i));
  }
}

// Stellt sicher, dass die DOM-Reihen-Anzahl der gewünschten Anzahl entspricht.
// Fügt fehlende Reihen hinzu oder entfernt überzählige.
function _ensureVlistRowCount(target){
  var list = $('clo-list');
  if(!list) return;
  // Hinzufügen
  while(list.children.length < target){
    list.appendChild(_buildChRow(list.children.length));
  }
  // Entfernen (überschüssige am Ende)
  while(list.children.length > target){
    list.removeChild(list.lastChild);
  }
  VLIST_ROWS = target;
}

function _updateVlistFocus(){
  for(var i=0; i<VLIST_ROWS; i++){
    var row = document.getElementById('vrow-'+i);
    if(!row) continue;
    var idx = S_CLO_OFFSET + i;
    var s = S.filteredStreams[idx];
    var isFocused = (idx === S.chListCursor) && (!Settings.splitList || S.chListFocusArea === 'streams');
    var isActive  = S.currentStream && s && s.stream_id === S.currentStream.stream_id;
    row.className = 'clo-row' + (isActive?' clo-active':'') + (isFocused?' clo-focused':'');
  }
}

function _updateVlistRows(){
  var now = Date.now();
  var streams = S.filteredStreams;
  var total = streams.length;
  var list = $('clo-list');

  for(var i=0; i<VLIST_ROWS; i++){
    var row = list.children[i];
    if(!row) continue;
    var idx = S_CLO_OFFSET + i;

    if(idx >= total){
      row.style.display = 'none';
      continue;
    }
    row.style.display = 'flex';

    var s = streams[idx];
    var isFocused = (idx === S.chListCursor) && (!Settings.splitList || S.chListFocusArea === 'streams');
    var isActive  = S.currentStream && s && s.stream_id === S.currentStream.stream_id;
    row.className = 'clo-row' + (isActive?' clo-active':'') + (isFocused?' clo-focused':'');
    row.setAttribute('data-vi', i);

      row._ui.num.textContent = idx+1;

    // Logo — src wiederverwenden um Neuladen zu vermeiden
    var img = row._ui.img;
    var ph  = row._ui.ph;
    if(s.stream_icon){
      if(img.src !== s.stream_icon){ img.src=s.stream_icon; img.style.display=''; ph.style.display='none'; }
    } else {
      img.removeAttribute('src'); img.style.display='none'; ph.style.display='';
    }

    var nameEl = row._ui.name;
    nameEl.textContent = s.name||'';
    nameEl.classList.toggle('is-long', (s.name||'').length > 20);


    // EPG
    var epgTxt='', timeStr='', barPct=0;
    var cur = null;
    if(EpgData.loaded) cur = EpgData.getNow(s);
    if(cur){
      epgTxt = cur.title;
      var remMs = cur.stop.getTime()-now;
      if(remMs>0) timeStr = '+'+Math.ceil(remMs/60000)+'m';
      var total2 = cur.stop.getTime()-cur.start.getTime();
      if(total2>0) barPct = Math.min(100,Math.max(0,(now-cur.start.getTime())/total2*100));
    } else {
      var cce = findCurrentEpg(s.stream_id, now/1000);
      if(cce){
        epgTxt = b64dec(cce.title||'');
        var st = getTs(cce, 'start'), sp = getTs(cce, 'stop');
        if(st && sp){
          var rem = sp - now/1000;
          if(rem>0) timeStr = '+'+Math.ceil(rem/60)+'m';
          var tot = sp - st;
          if(tot>0) barPct = Math.min(100, Math.max(0, (now/1000 - st)/tot * 100));
        }
      }
    }
    row._ui.epg.textContent = epgTxt;
    row._ui.time.textContent = timeStr;
    row._ui.bar.style.width = barPct.toFixed(1)+'%';
  }
}

function renderChListOverlay(){
  // Kategorie-Titel aktualisieren
  var opts = buildCatOpts();
  var curOpt = opts[Math.min(S.chListCatIdx, opts.length-1)];
  $('clo-group-name').textContent = (curOpt ? curOpt.name : 'Alle Sender');

  // Offset berechnen, damit Cursor sichtbar ist
  if(S.chListCursor < S_CLO_OFFSET) S_CLO_OFFSET = S.chListCursor;
  if(S.chListCursor >= S_CLO_OFFSET + VLIST_ROWS) S_CLO_OFFSET = S.chListCursor - VLIST_ROWS + 1;

  _updateVlistRows();
}

function initChListOverlay(){
  if(!document.getElementById('vrow-0')) buildChListDOM();

  // Reihen-Anzahl an aktuelle Container-Höhe anpassen
  // (z.B. nach Wechsel in/aus Compact-Mode oder bei Bildschirm-Resize)
  // Wichtig: Erst nach dem Anzeigen aufrufen, da clientHeight sonst 0 ist.
  // Wir nutzen requestAnimationFrame um zu warten bis das Layout fertig ist.
  requestAnimationFrame(function(){
    var want = _calcVlistRows();
    if(want !== VLIST_ROWS){
      _ensureVlistRowCount(want);
      _updateVlistRows();
    }
  });

  // Maus-Events für geteilte Kategorien
  if(!$('clo-left-pane')._bound) {
    $('clo-left-pane')._bound = true;
    $('clo-left-pane').addEventListener('click', function(e) {
      if(!Settings.splitList) return;
      var cat = e.target.closest('.clo-split-cat');
      if(cat) {
        var idx = parseInt(cat.id.replace('clsc-', ''));
        if(!isNaN(idx)) { S.chListSplitCatCursor = idx; chListCatSplitSelect(); }
      }
    });
    $('clo-left-pane').addEventListener('mouseover', function(e) {
      if(!Settings.splitList) return;
      var cat = e.target.closest('.clo-split-cat');
      if(cat) {
        var idx = parseInt(cat.id.replace('clsc-', ''));
        if(!isNaN(idx) && S.chListSplitCatCursor !== idx) { 
            S.chListSplitCatCursor = idx; 
            S.chListCatIdx = idx;
            chListCatChange(0);
            S.chListFocusArea = 'cats'; 
            renderChListSplitCats();
            _updateSplitCatFocus(); 
        }
      }
    });
  }
}



// ── EPG GRID AKTUALISIERUNG ───────────────────────────────────────
// Wird nach dem Laden von EpgData aufgerufen — aktualisiert sichtbare Grid-Karten
function updateGridEpg(){
  if(S.tab!=='live') return;
  var items=document.querySelectorAll('.ch-epg-text');
  for(var i=0;i<items.length;i++){
    var el=items[i];
      var wrap = el.closest('.grid-item-wrap');
      if(!wrap) continue;
      var idx = parseInt(wrap.getAttribute('data-idx'));
      var s = S.filteredStreams[idx];
      if(s) {
        var cur=null;
        if(EpgData.loaded) cur=EpgData.getNow(s);
        if(cur) el.textContent=cur.title;
        else {
          var cce=findCurrentEpg(s.stream_id, Date.now()/1000);
          if(cce) el.textContent=b64dec(cce.title||'');
        }
    }
  }
}


function loadFavs(){ 
  var p = Profiles.getActive(); var pid = p ? p.id : 'default';
  try{ 
    var f=localStorage.getItem('xcp_favs_' + pid); 
    if(f) { S.favs=Object.assign({live:[],vod:[],series:[]}, JSON.parse(f)); } 
    else { 
      var old = localStorage.getItem('xcp_favs');
      if(old) { S.favs = Object.assign({live:[],vod:[],series:[]}, JSON.parse(old)); saveFavs(); }
      else { S.favs = {live:[],vod:[],series:[]}; }
    }
  }catch(e){ S.favs = {live:[],vod:[],series:[]}; } 
}
function saveFavs(){ 
  var p = Profiles.getActive(); var pid = p ? p.id : 'default';
  try{ localStorage.setItem('xcp_favs_' + pid,JSON.stringify(S.favs)); }catch(e){ Logger.warn('[Favs] save error:', e); } 
}
function loadResume(){ 
  var p = Profiles.getActive(); var pid = p ? p.id : 'default';
  try{ 
    var r=localStorage.getItem('xcp_resume_' + pid); 
    if(r) { S.resume=JSON.parse(r); } 
    else { 
      var old = localStorage.getItem('xcp_resume');
      if(old) { S.resume = JSON.parse(old); saveResume(); }
      else { S.resume = {}; }
    }
  }catch(e){ S.resume = {}; } 
}
function saveResume(){ 
  var p = Profiles.getActive(); var pid = p ? p.id : 'default';
  try{ localStorage.setItem('xcp_resume_' + pid,JSON.stringify(S.resume)); }catch(e){ 
    if(e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      _runStorageGarbageCollector();
      try { localStorage.setItem('xcp_resume_' + pid,JSON.stringify(S.resume)); } catch(e2){}
    } else { Logger.warn('[Resume] save error:', e); }
  } 
}
// Serien-Resume: pro series_id ein Eintrag mit Metadaten (Netflix-Stil),
// damit die Continue-Watching-Kachel ohne Re-Fetch der Serien-Info gerendert werden kann.
function loadResumeSeries(){
  var p = Profiles.getActive(); var pid = p ? p.id : 'default';
  try{
    var r = localStorage.getItem('xcp_resume_series_' + pid);
    S.resumeSeries = r ? JSON.parse(r) : {};
  }catch(e){ S.resumeSeries = {}; }
}

// ── NOTFALL-GARBAGE-COLLECTOR FÜR LOCALSTORAGE ──────────────────
function _runStorageGarbageCollector() {
  Logger.warn('[Storage] Quota exceeded! Running emergency garbage collector...');
  // VOD-Resume kürzen (Behalte nur die letzten 20 Einträge)
  var vKeys = Object.keys(S.resume);
  if(vKeys.length > 20) {
    var vDrop = vKeys.slice(0, vKeys.length - 20);
    vDrop.forEach(function(k){ delete S.resume[k]; });
  }
  // Serien-Resume kürzen (Nach Timestamp sortieren und die letzten 20 behalten)
  var sKeys = Object.keys(S.resumeSeries || {});
  if(sKeys.length > 20) {
    var sArr = sKeys.map(function(k){ return S.resumeSeries[k]; });
    sArr.sort(function(a,b){ return (b.ts||0) - (a.ts||0); });
    var keep = sArr.slice(0, 20);
    S.resumeSeries = {};
    keep.forEach(function(it){ S.resumeSeries[it.series_id] = it; });
  }
}

function saveResumeSeries(){
  var p = Profiles.getActive(); var pid = p ? p.id : 'default';
  try{ localStorage.setItem('xcp_resume_series_' + pid, JSON.stringify(S.resumeSeries||{})); }catch(e){ 
    if(e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED') {
      _runStorageGarbageCollector();
      try { localStorage.setItem('xcp_resume_series_' + pid,JSON.stringify(S.resumeSeries||{})); } catch(e2){}
    } else { Logger.warn('[ResumeSeries] save error:', e); }
  }
}

async function manualPlaylistRefresh(){
  if(!Profiles.getActive()){ showToast('Kein aktives Profil', 2000); return; }
  
  closeSettings();
  showFullLoader('Playlist wird aktualisiert...', 'Suche nach neuen Sendern und Filmen beim Anbieter');
  
  // 1. Clear all caches
  S.rawCategories = { live: null, vod: null, series: null };
  S.rawStreams = { live: null, vod: null, series: null };
  S.fullStreams = { live: null, vod: null, series: null };
  S.seriesInfoCache = {};
  S.epgCache = {};
  EpgData.loaded = false;
  
  try {
    var p = Profiles.getActive();
    var pid = p ? p.id : '';
    
    // Nur Daten DIESES Profils aus der IndexedDB löschen (andere Profile bleiben unberührt)
    if(typeof PlaylistDB !== 'undefined' && PlaylistDB.db && pid) {
      var tx = PlaylistDB.db.transaction(['data'], 'readwrite');
      var req = tx.objectStore('data').openCursor();
      req.onsuccess = function(e) {
        var cursor = e.target.result;
        if(cursor) { if(String(cursor.key).indexOf(pid) !== -1) cursor.delete(); cursor.continue(); }
      };
    }
    
    if(typeof EPGStore !== 'undefined' && EPGStore.db && pid) {
      ['xmltv', 'epg'].forEach(function(storeName) {
        if(EPGStore.db.objectStoreNames.contains(storeName)) {
          var txEpg = EPGStore.db.transaction([storeName], 'readwrite');
          var reqEpg = txEpg.objectStore(storeName).openCursor();
          reqEpg.onsuccess = function(e) {
            var cursor = e.target.result;
            if(cursor) { if(String(cursor.key).indexOf(pid) !== -1) cursor.delete(); cursor.continue(); }
          };
        }
      });
    }

    if(S.isM3U && p) {
        var r=await fetchWithRetry(p.m3uUrl,30000,1);
        var text=await r.text();
        var parsed=parseM3U(text);
        S.m3uStreams=parsed.streams;
        S.m3uCategories=parsed.categories;
        PlaylistDB.set('m3u_' + p.id, {streams: parsed.streams, categories: parsed.categories});
        S.rawCategories = { live: S.m3uCategories, vod: [], series: [] };
        S.rawStreams = { live: S.m3uStreams, vod: [], series: [] };
    }
    // 2. Wenn wir auf dem Hauptbildschirm sind, müssen wir die aktuelle Ansicht sofort neu laden
    if(S.screen === 'main' && S.tab){
      await loadCats();
      await loadStreams(S.selectedCat);
    }
    
    // 4. EPG-Neuladen erzwingen
    EpgData.load();

    hideFullLoader();
    showToast('Playlist erfolgreich aktualisiert!', 3000);
  } catch(e) {
    hideFullLoader();
    showToast('Fehler beim Aktualisieren: ' + e.message, 4000);
  }
}

async function launchTab(tab){
  S.screen='main';
  if (S.seriesDetailOpen) { S.seriesDetailOpen = false; }
  S.playerVisible=false;
  if(typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
  await switchTab(tab);
}