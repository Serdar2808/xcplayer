// ── PLAYLIST EDITOR & VISIBILITY ENGINE ───────────────────────────
var peDraftRules = [];
var peDraftVisCats = { live:[], vod:[], series:[] };
var peDraftVisStreams = { live:[], vod:[], series:[] };
var peDraftOrders = { cats:{live:[],vod:[],series:[]}, streams:{} };
var peDraftNames = { cats:{}, streams:{}, epgs:{} };

var PlaylistEditor = {
  apply: function(items, itemType) {
    var rules = Settings.playlistRules;
    if (!rules || rules.length === 0 || !items) return items;
    var result = [];
    for (var i = 0; i < items.length; i++) {
      var item = Object.assign({}, items[i]);
      var hidden = false;
      for (var j = 0; j < rules.length; j++) {
        var rule = rules[j];
        var pat = rule.pattern;
        if (!pat) continue;

        var applies = false, fieldStr = '';
        if (rule.target === 'cat' && itemType === 'cat') { applies = true; fieldStr = 'category_name'; }
        else if (rule.target === 'stream' && itemType === 'stream') { applies = true; fieldStr = item.name !== undefined ? 'name' : 'title'; }
        else if (rule.target === 'both') {
          applies = true;
          fieldStr = itemType === 'cat' ? 'category_name' : (item.name !== undefined ? 'name' : 'title');
        }
        if (!applies) continue;

        // Kategorien-Filter: Überspringen, falls Regel auf bestimmte Kategorien beschränkt ist und Element nicht enthalten ist
        if (rule.categoryFilter && rule.categoryFilter.length > 0) {
          var catId = String(item.category_id || '');
          if (catId && rule.categoryFilter.indexOf(catId) === -1) continue;
        }

        var text = String(item[fieldStr] || '');

        if (rule.type === 'hide') {
          if (text.indexOf(pat) !== -1) { hidden = true; break; }
        } else if (rule.type === 'prefix') {
          if (text.startsWith(pat)) text = text.substring(pat.length).trim();
        } else if (rule.type === 'suffix') {
          if (text.endsWith(pat)) text = text.substring(0, text.length - pat.length).trim();
        } else if (rule.type === 'replace') {
          text = text.split(pat).join(rule.replacement || '');
        } else if (rule.type === 'regex') {
          try {
             var re = new RegExp(pat, 'gi');
             text = text.replace(re, rule.replacement || '').trim();
          } catch(e){}
        }
        // Sicherheit: Niemals zulassen, dass eine Regel einen Namen leert (Original behalten, falls Ergebnis zu kurz ist)
        if (text.length < 2) text = String(item[fieldStr] || '');
        if (fieldStr) item[fieldStr] = text;
      }
      if (!hidden) {
        result.push(item);
      }
    }
    return result;
  }
};

function openPEModal(tabMode) {
  if(S.settingsOpen) closeSettings();
  peDraftRules = JSON.parse(JSON.stringify(Settings.playlistRules || []));
  peDraftVisCats = JSON.parse(JSON.stringify(Settings.hiddenCats || {live:[],vod:[],series:[]}));
  peDraftVisStreams = JSON.parse(JSON.stringify(Settings.hiddenStreams || {live:[],vod:[],series:[]}));
  peDraftOrders = JSON.parse(JSON.stringify(Settings.customOrders || { cats:{ live:[], vod:[], series:[] }, streams:{} }));
  peDraftNames = JSON.parse(JSON.stringify(Settings.customNames || { cats:{}, streams:{}, epgs:{} }));
  
  $('pe-modal').classList.remove('hidden');
  FocusTrap.trap('pe-modal');
  peSwitchMain(tabMode || 'rules');
  setTimeout(function(){ SpatialNav.focusBySelector('#pe-tab-btn-' + (tabMode || 'rules')); }, 50);
}

function openPEManualModal(){
  $('pe-pattern').value = '';
  $('pe-replace').value = '';
  $('pe-preview-bar').classList.remove('show');
  $('pe-manual-modal').classList.remove('hidden');
  FocusTrap.trap('pe-manual-modal');
  setTimeout(function(){ SpatialNav.focusBySelector('#pe-sel-target'); }, 50);
}

function closePEManualModal(){
  $('pe-manual-modal').classList.add('hidden');
  FocusTrap.release('pe-manual-modal');
  setTimeout(function(){ SpatialNav.focusBySelector('#pe-btn-manual'); }, 50);
}

async function closePEModal(apply) {
  $('pe-modal').classList.add('hidden');
  FocusTrap.release('pe-modal');
  if (!apply && S.settingsOpen) {
      setTimeout(function(){ SpatialNav.focusBySelector('#settings-screen [data-focusable]'); }, 50);
  }

  if (apply) {
    Settings.playlistRules = peDraftRules;
    Settings.hiddenCats = peDraftVisCats;
    Settings.hiddenStreams = peDraftVisStreams;
    Settings.customOrders = peDraftOrders;
    Settings.customNames = peDraftNames;
    Settings.save();
    showFullLoader('Speichere & wende an...', 'Senderlisten werden neu aufgebaut');
    
    // Alle Caches ungültig machen
    S.fullStreams = { live: null, vod: null, series: null };
    
    await _prefetchAfterPE();
    hideFullLoader();
    
    if (S.screen === 'main') {
      // Auf Hauptbildschirm: Kompletter Tab-Reload (lädt Kategorien + Streams)
      S.categories = []; S.streams = []; S.filteredStreams = [];
      switchTab(S.tab);
    } else if (S.fromWizard) {
      S.fromWizard = false;
      launchLiveTv();
    } else {
      // Auf Startbildschirm oder Player: Daten im Hintergrund vorladen, damit nächste Navigation sofort passiert
      S.categories = []; S.streams = []; S.filteredStreams = [];
      launchLiveTv();
      if (S.settingsOpen) setTimeout(function(){ SpatialNav.focusBySelector('#settings-screen [data-focusable]'); }, 50);
    }
  } else if (S.fromWizard) {
      // Falls im Wizard mit BACK abgebrochen wurde, trotzdem in die App wechseln
      S.fromWizard = false;
      launchLiveTv();
  }
}

// Alle Stream-Daten nach Änderungen im Playlist-Editor vorladen
async function _prefetchAfterPE(){
  await Promise.all([
    (async function() {
      try {
        var [liveCats, liveStreams] = await Promise.all([getOrFetchData('cats', 'live'), getOrFetchData('streams', 'live')]);
        var filteredLiveCats = processCatsFilter(liveCats, 'live');
        S.fullStreams.live = processStreamsFilter(Array.isArray(liveStreams) ? liveStreams : [], 'live', filteredLiveCats);
      } catch(e){ Logger.warn('[PE] Prefetch live failed:', e.message); }
    })(),
    (async function() {
      try {
        var [vodCats, vodStreams] = await Promise.all([getOrFetchData('cats', 'vod'), getOrFetchData('streams', 'vod')]);
        var filteredVodCats = processCatsFilter(vodCats, 'vod');
        S.fullStreams.vod = processStreamsFilter(Array.isArray(vodStreams) ? vodStreams : [], 'vod', filteredVodCats);
      } catch(e){ Logger.warn('[PE] Prefetch vod failed:', e.message); }
    })(),
    (async function() {
      try {
        var [serCats, serStreams] = await Promise.all([getOrFetchData('cats', 'series'), getOrFetchData('streams', 'series')]);
        var filteredSerCats = processCatsFilter(serCats, 'series');
        S.fullStreams.series = processStreamsFilter(Array.isArray(serStreams) ? serStreams : [], 'series', filteredSerCats);
      } catch(e){ Logger.warn('[PE] Prefetch series failed:', e.message); }
    })()
  ]);
}

// Prüft, ob der Playlist-Editor ungespeicherte Änderungen hat.
// Vergleicht die peDraft*-Variablen mit dem zuletzt gespeicherten Settings-Stand.
function _peHasChanges(){
  return JSON.stringify(peDraftRules)       !== JSON.stringify(Settings.playlistRules || [])
      || JSON.stringify(peDraftVisCats)     !== JSON.stringify(Settings.hiddenCats    || {live:[],vod:[],series:[]})
      || JSON.stringify(peDraftVisStreams)  !== JSON.stringify(Settings.hiddenStreams || {live:[],vod:[],series:[]})
      || JSON.stringify(peDraftOrders)      !== JSON.stringify(Settings.customOrders  || { cats:{ live:[], vod:[], series:[] }, streams:{} })
      || JSON.stringify(peDraftNames)       !== JSON.stringify(Settings.customNames   || { cats:{}, streams:{}, epgs:{} });
}

function peSwitchMain(mode) {
  $('pe-tab-btn-rules').classList.toggle('active', mode === 'rules');
  $('pe-tab-btn-manage').classList.toggle('active', mode === 'manage');
  $('pe-view-rules').classList.toggle('hidden', mode !== 'rules');
  $('pe-view-manage').classList.toggle('hidden', mode !== 'manage');
  if (mode === 'rules') renderPERules();
  if (mode === 'manage') manSetTab('live');
}

function peUpdateFormFields() {
  var typ = $('pe-sel-type').value;
  if(typ === 'replace') $('pe-repl-wrap').classList.remove('hidden');
  else $('pe-repl-wrap').classList.add('hidden');
  
  var lblPat = $('pe-lbl-pattern');
  var lblRep = $('pe-lbl-replace');
  if(typ === 'prefix') lblPat.textContent = 'Prefix entfernen (Text)';
  else if(typ === 'suffix') lblPat.textContent = 'Suffix entfernen (Text)';
  else if(typ === 'replace') { lblPat.textContent = 'Zu suchender Text'; lblRep.textContent = 'Ersetzen durch'; }
  else if(typ === 'regex') { lblPat.textContent = 'Regulärer Ausdruck'; lblRep.textContent = 'Ersetzen durch'; }
  else if(typ === 'hide') lblPat.textContent = 'Verstecken wenn Name enthält...';
}

// LIVE RULE PREVIEW (counter while typing)
function peUpdatePreview(){
  var pat = ($('pe-pattern') && $('pe-pattern').value) || '';
  var typ = ($('pe-sel-type') && $('pe-sel-type').value) || 'prefix';
  var bar = $('pe-preview-bar');
  if(!bar) return;

  if(!pat){ bar.classList.remove('show'); return; }

  // Betroffene aus allen verfügbaren Streams zählen
  var count = 0;
  var examples = [];
  var totalLen = 0;
  
  var checkStream = function(s){
    var n = s.name || s.title || '';
    var matches = false;
    if(typ==='prefix') matches = n.startsWith(pat);
    else if(typ==='suffix') matches = n.endsWith(pat);
    else if(typ==='replace' || typ==='hide') matches = n.indexOf(pat) !== -1;
    else if(typ==='regex') { try { matches = new RegExp(pat, 'i').test(n); } catch(e){} }
    if(matches){ count++; if(examples.length < 2) examples.push(n); }
  };

  if(S.fullStreams.live) { totalLen += S.fullStreams.live.length; S.fullStreams.live.forEach(checkStream); }
  if(S.fullStreams.vod) { totalLen += S.fullStreams.vod.length; S.fullStreams.vod.forEach(checkStream); }
  if(S.fullStreams.series) { totalLen += S.fullStreams.series.length; S.fullStreams.series.forEach(checkStream); }

  if(count === 0){
    bar.innerHTML = '<span style="color:var(--lo)">Keine Treffer in '+totalLen+' Einträgen</span>';
  } else {
    bar.innerHTML = '<span style="color:var(--accent);font-weight:600">'+count+' Treffer</span>'
      +(examples.length?' — z.B. "'+esc(examples[0])+'"':'');
  }
  bar.classList.add('show');
}

function peAddRule() {
  var target = $('pe-sel-target').value;
  var type = $('pe-sel-type').value;
  var pat = $('pe-pattern').value;
  var rep = $('pe-replace').value;
  if (!pat) { showToast('Muster darf nicht leer sein', 2000); return; }
  peDraftRules.push({
    id: Date.now(), target: target, type: type, pattern: pat, replacement: rep
  });
  $('pe-pattern').value = ''; $('pe-replace').value = '';
  renderPERules();
  closePEManualModal();
  showToast('Regel gespeichert', 1500);
}
function peMoveRule(idx, dir) {
  var rules = peDraftRules;
  if(idx + dir < 0 || idx + dir >= rules.length) return;
  var temp = rules[idx]; rules[idx] = rules[idx+dir]; rules[idx+dir] = temp;
  renderPERules();
  var newIdx = idx + dir;
  setTimeout(function(){
    var btn = dir < 0 ? '#pe-up-' + newIdx : '#pe-dn-' + newIdx;
    SpatialNav.focusBySelector(btn) || SpatialNav.focusBySelector('#pe-del-' + newIdx);
  }, 50);
}
function peDelRule(idx) {
  peDraftRules.splice(idx, 1);
  renderPERules();
  setTimeout(function(){
    var nextIdx = Math.min(idx, peDraftRules.length - 1);
    if(nextIdx >= 0) SpatialNav.focusBySelector('#pe-del-' + nextIdx);
    else SpatialNav.focusBySelector('#pe-pattern');
  }, 50);
}
function renderPERules() {
  var list = $('pe-rules-list'), html = '';
  if (peDraftRules.length === 0) html = '<div style="color:var(--mid); font-size:var(--fs-sm); padding:10px;">Keine Regeln definiert.</div>';
  for(var i=0; i<peDraftRules.length; i++) {
    var r = peDraftRules[i];
    var tText = r.target === 'cat' ? 'Kategorien' : (r.target === 'stream' ? 'Sender' : 'Beides');
    var tyText = '';
    if(r.type === 'prefix') tyText = '"' + esc(r.pattern) + '" am Anfang entfernen';
    else if(r.type === 'suffix') tyText = '"' + esc(r.pattern) + '" am Ende entfernen';
    else if(r.type === 'replace') tyText = '"' + esc(r.pattern) + '" durch "' + esc(r.replacement) + '" ersetzen';
    else if(r.type === 'regex') tyText = 'RegEx "' + esc(r.pattern) + '" durch "' + esc(r.replacement) + '" ersetzen';
    else if(r.type === 'hide') tyText = 'Verstecken wenn Name "' + esc(r.pattern) + '" enthält';
    
    html += '<div class="pe-rule-item">' +
            '<div class="pe-rule-desc"><b>[' + tText + ']</b> ' + tyText + '</div>' +
            '<div class="pe-rule-actions">' +
            '<button class="pe-btn" id="pe-up-'+i+'" data-focusable onclick="peMoveRule('+i+', -1)" '+(i===0?'style="opacity:0.3;pointer-events:none"':'')+'>&#x25B2;</button>' +
            '<button class="pe-btn" id="pe-dn-'+i+'" data-focusable onclick="peMoveRule('+i+', 1)" '+(i===peDraftRules.length-1?'style="opacity:0.3;pointer-events:none"':'')+'>&#x25BC;</button>' +
            '<button class="pe-btn" id="pe-del-'+i+'" data-focusable style="background:rgba(239,68,68,.2);color:#fca5a5" onclick="peDelRule('+i+')">&#x2715;</button>' +
            '</div></div>';
  }
  list.innerHTML = html;
}

function processCatsFilter(cats, tab) {
  cats = PlaylistEditor.apply(cats, 'cat');

  // Manuelle Umbenennungen anwenden
  for(var i=0; i<cats.length; i++) {
    var cid = String(cats[i].category_id);
    if (Settings.customNames.cats[cid]) cats[i].category_name = Settings.customNames.cats[cid];
  }

  var hc = Settings.hiddenCats[tab] || [];
  if (hc.length > 0) {
     var hcmap = {};
     for(var k=0; k<hc.length; k++) hcmap[String(hc[k])] = true;
     cats = cats.filter(function(c) { return !hcmap[String(c.category_id)]; });
  }

  // Sortierung anwenden
  var orderArr = Settings.customOrders.cats[tab] || [];
  if(orderArr.length > 0) {
     var orderMap = {};
     for(var j=0; j<orderArr.length; j++) orderMap[orderArr[j]] = j;
     cats.sort(function(a,b) {
        var aIdx = orderMap[String(a.category_id)];
        var bIdx = orderMap[String(b.category_id)];
        if(aIdx !== undefined && bIdx !== undefined) return aIdx - bIdx;
        if(aIdx !== undefined) return -1;
        if(bIdx !== undefined) return 1;
        return 0;
     });
  }
  return cats;
}

function processStreamsFilter(arr, overrideTab, overrideCats) {
  var tab = overrideTab || S.tab;
  var cats = overrideCats || S.categories;

  arr = PlaylistEditor.apply(arr, 'stream');
  
  // Manuelle Umbenennungen anwenden
  for(var i=0; i<arr.length; i++) {
     var sid = String(tab === 'series' ? arr[i].series_id : arr[i].stream_id);
     if (Settings.customNames.streams[sid]) {
         if (arr[i].name !== undefined) arr[i].name = Settings.customNames.streams[sid];
         else arr[i].title = Settings.customNames.streams[sid];
     }
     if (Settings.customNames.epgs[sid] !== undefined) {
         arr[i].epg_channel_id = Settings.customNames.epgs[sid];
     }
  }
  
  var hs = Settings.hiddenStreams[tab] || [];
  if (hs.length > 0) {
     var hmap = {};
     for(var k=0; k<hs.length; k++) hmap[String(hs[k])] = true;
     arr = arr.filter(function(s) { 
       var sid = tab === 'series' ? s.series_id : s.stream_id;
       return !hmap[String(sid)]; 
     });
  }
  if (cats && cats.length > 0) {
    var validCats = {};
    for(var i=0; i<cats.length; i++) validCats[String(cats[i].category_id)] = true;
    arr = arr.filter(function(s) { return !s.category_id || validCats[String(s.category_id)]; });
  }

  // Sortierung anwenden (Nach Kategorie-Benutzerreihenfolge, dann Stream-Benutzerreihenfolge)
  var catOrderMap = {};
  var cArr = Settings.customOrders.cats[tab] || [];
  for(var c=0; c<cArr.length; c++) catOrderMap[cArr[c]] = c;

  var catDefaultOrder = {};
  if (cats) {
      for(var i=0; i<cats.length; i++) {
          catDefaultOrder[String(cats[i].category_id)] = i;
      }
  }

  for(var i=0; i<arr.length; i++) { arr[i]._origIdx = i; }

  arr.sort(function(a,b){
      var cIdA = String(a.category_id), cIdB = String(b.category_id);
      
      if (cIdA !== cIdB) {
          var cIdxA = catOrderMap[cIdA], cIdxB = catOrderMap[cIdB];
          if(cIdxA !== undefined && cIdxB !== undefined) return cIdxA - cIdxB;
          if(cIdxA !== undefined) return -1;
          if(cIdxB !== undefined) return 1;

          var defA = catDefaultOrder[cIdA] !== undefined ? catDefaultOrder[cIdA] : 999999;
          var defB = catDefaultOrder[cIdB] !== undefined ? catDefaultOrder[cIdB] : 999999;
          if (defA !== defB) return defA - defB;
          return a._origIdx - b._origIdx;
      }
      
      // Gleiche Kategorie, benutzerdefinierte Stream-Reihenfolge prüfen
      var sArr = Settings.customOrders.streams[cIdA];
      if (sArr && sArr.length > 0) {
          var sIdA = String(tab === 'series' ? a.series_id : a.stream_id);
          var sIdB = String(tab === 'series' ? b.series_id : b.stream_id);
          var sIdxA = sArr.indexOf(sIdA), sIdxB = sArr.indexOf(sIdB);
          if(sIdxA !== -1 && sIdxB !== -1) return sIdxA - sIdxB;
          if(sIdxA !== -1) return -1;
          if(sIdxB !== -1) return 1;
      }
      return a._origIdx - b._origIdx;
  });

  return arr;
}

// Gruppiert Duplikate: Nur der erste Sender eines Basisnamens bleibt sichtbar
function applyVariantGrouping(arr) {
  if (S.tab !== 'live' || !Settings.groupVariants) return arr;
  var seen = {};
  var res = [];
  for (var i=0; i<arr.length; i++) {
    var base = _baseName(arr[i].name);
    if (!seen[base]) {
      seen[base] = true;
      res.push(arr[i]);
    }
  }
  return res;
}

// ── VERWALTUNGS-EDITOR (Sortieren & Umbenennen) ───────────────────
var manState = { tab: 'live', catId: null, streamId: null, editType: null, editId: null, rawCats: [], rawStreams: [] };

async function manSetTab(tab) {
  manState.tab = tab; manState.catId = null; manState.streamId = null;
  manDisableEdit();
  $('man-tab-live').classList.toggle('active', tab==='live');
  $('man-tab-vod').classList.toggle('active', tab==='vod');
  $('man-tab-series').classList.toggle('active', tab==='series');
  $('man-cat-list').innerHTML = '<div class="loading-c" style="height:100px"><div class="spinner"></div></div>';
  $('man-stream-list').innerHTML = ''; $('man-stream-title').textContent = 'Sender / Streams';

  try {
      var cats = await getOrFetchData('cats', tab);
      manState.rawCats = PlaylistEditor.apply(cats, 'cat');
      renderManCats();
  } catch(e) { Logger.warn('[ManSetTab] error:', e.message); $('man-cat-list').innerHTML = '<div class="empty-s">Fehler</div>'; }
}

function renderManCats() {
  var orderArr = peDraftOrders.cats[manState.tab] || [];
  var hc = peDraftVisCats[manState.tab] || [];
  var catMap = {};

  // 1. Kategorien abgleichen: Neue hinzufügen, tote aussortieren
  var validIds = {};
  for(var i=0; i<manState.rawCats.length; i++) {
      var cid = String(manState.rawCats[i].category_id);
      catMap[cid] = manState.rawCats[i];
      validIds[cid] = true;
      if(orderArr.indexOf(cid) === -1) orderArr.push(cid);
  }
  orderArr = orderArr.filter(function(id) { return validIds[id]; });
  peDraftOrders.cats[manState.tab] = orderArr;

  var html = '';
  for(var i=0; i<orderArr.length; i++) {
      var cid = orderArr[i];
      var c = catMap[cid];
      if(!c) continue;
      var isActive = manState.catId === cid;
      var isHidden = hc.indexOf(cid) !== -1;
      var cname = peDraftNames.cats[cid] || c.category_name;
      html += '<div class="vis-row">' +
              '<button class="vis-name-btn '+(isActive?'active ':'')+(isHidden?'strike':'')+'" data-focusable id="mc-name-'+i+'" onclick="manSelectCat(\''+cid+'\')">' + esc(cname) + '</button>' +
              '<button class="vis-toggle-btn" data-focusable id="mc-tog-'+i+'" onclick="manToggleCat(\''+cid+'\','+i+')"><div class="vis-toggle '+(isHidden?'off':'')+'"></div></button>' +
              '<button class="man-btn-sm" data-focusable id="mc-up-'+i+'" onclick="manMoveCat('+i+', -1)">&#x25B2;</button>' +
              '<button class="man-btn-sm" data-focusable id="mc-dn-'+i+'" onclick="manMoveCat('+i+', 1)">&#x25BC;</button>' +
              '<button class="man-btn-sm" data-focusable id="mc-ed-'+i+'" onclick="manEditCat(\''+cid+'\')">&#x270E;</button>' +
              '</div>';
  }
  $('man-cat-list').innerHTML = html || '<div class="empty-s">Keine Einträge</div>';
}

function manMoveCat(idx, dir) {
  var arr = peDraftOrders.cats[manState.tab];
  if(idx + dir < 0 || idx + dir >= arr.length) return;
  var tmp = arr[idx]; arr[idx] = arr[idx+dir]; arr[idx+dir] = tmp;
  renderManCats();
  var newIdx = idx + dir;
  setTimeout(function(){ SpatialNav.focusBySelector('#mc-up-'+newIdx) || SpatialNav.focusBySelector('#mc-dn-'+newIdx); }, 30);
}

function manToggleCat(cid, idx) { 
  var hc = peDraftVisCats[manState.tab] || []; 
  var pos = hc.indexOf(cid); 
  if (pos === -1) hc.push(cid); else hc.splice(pos, 1); 
  peDraftVisCats[manState.tab] = hc; 
  renderManCats();
  setTimeout(function(){ SpatialNav.focusBySelector('#mc-tog-'+idx); }, 30);
}

async function manSelectCat(cid) {
  manState.catId = cid; renderManCats();
  manDisableEdit();
  $('man-stream-list').innerHTML = '<div class="loading-c" style="height:100px"><div class="spinner"></div></div>';
  var cname = peDraftNames.cats[cid] || '';
  if(!cname) {
      var c = manState.rawCats.find(function(x){ return String(x.category_id)===cid; });
      if(c) cname = c.category_name;
  }
  $('man-stream-title').textContent = cname;

  try {
      var data = await getOrFetchData('streams', manState.tab);
      var arr = Array.isArray(data) ? data : [];
      if (cid && cid !== 'fav') {
          arr = arr.filter(function(s) { return String(s.category_id) === String(cid); });
      }
      manState.rawStreams = PlaylistEditor.apply(arr, 'stream');
      renderManStreams();
      setTimeout(function() {
          if (manState.rawStreams.length > 0) SpatialNav.focusBySelector('#man-str-0');
      }, 50);
  } catch(e) { Logger.warn('[ManSelectCat] error:', e.message); $('man-stream-list').innerHTML = '<div class="empty-s">Fehler</div>'; }
}

function renderManStreams() {
  var cid = manState.catId;
  if(!cid) return;
  var orderArr = peDraftOrders.streams[cid] || [];
  var hs = peDraftVisStreams[manState.tab] || [];
  var sMap = {};
  var validIds = {};
  for(var i=0; i<manState.rawStreams.length; i++) {
      var sid = String(manState.tab === 'series' ? manState.rawStreams[i].series_id : manState.rawStreams[i].stream_id);
      sMap[sid] = manState.rawStreams[i];
      validIds[sid] = true;
      if(orderArr.indexOf(sid) === -1) orderArr.push(sid);
  }
  orderArr = orderArr.filter(function(id) { return validIds[id]; });
  peDraftOrders.streams[cid] = orderArr;

  var html = '';
  for(var i=0; i<orderArr.length; i++) {
      var sid = orderArr[i];
      var s = sMap[sid];
      if(!s) continue;
      var isHidden = hs.indexOf(sid) !== -1;
      var sname = peDraftNames.streams[sid] || s.name || s.title || '';
      html += '<div class="vis-row">' +
              '<button id="man-str-'+i+'" class="vis-name-btn '+(isHidden?'strike':'')+'" data-focusable>' + esc(sname) + '</button>' +
              '<button class="vis-toggle-btn" data-focusable id="ms-tog-'+i+'" onclick="manToggleStream(\''+sid+'\','+i+')"><div class="vis-toggle '+(isHidden?'off':'')+'"></div></button>' +
              '<button class="man-btn-sm" data-focusable id="ms-up-'+i+'" onclick="manMoveStream('+i+', -1)">&#x25B2;</button>' +
              '<button class="man-btn-sm" data-focusable id="ms-dn-'+i+'" onclick="manMoveStream('+i+', 1)">&#x25BC;</button>' +
              '<button class="man-btn-sm" data-focusable id="ms-ed-'+i+'" onclick="manEditStream(\''+sid+'\')">&#x270E;</button>' +
              '</div>';
  }
  $('man-stream-list').innerHTML = html || '<div class="empty-s">Keine Einträge</div>';
}

function manMoveStream(idx, dir) {
  var cid = manState.catId;
  var arr = peDraftOrders.streams[cid];
  if(idx + dir < 0 || idx + dir >= arr.length) return;
  var tmp = arr[idx]; arr[idx] = arr[idx+dir]; arr[idx+dir] = tmp;
  renderManStreams();
  var newIdx = idx + dir;
  setTimeout(function(){ SpatialNav.focusBySelector('#ms-up-'+newIdx) || SpatialNav.focusBySelector('#ms-dn-'+newIdx); }, 30);
}

function manToggleStream(sid, idx) { 
  var hs = peDraftVisStreams[manState.tab] || []; 
  var pos = hs.indexOf(sid); 
  if (pos === -1) hs.push(sid); else hs.splice(pos, 1); 
  peDraftVisStreams[manState.tab] = hs; 
  renderManStreams();
  setTimeout(function(){ SpatialNav.focusBySelector('#ms-tog-'+idx); }, 30);
}

function manDisableEdit() {
  manState.editType = null; manState.editId = null;
  $('man-edit-wrap').style.opacity = '0.3'; $('man-edit-wrap').style.pointerEvents = 'none';
  $('man-inp-name').value = ''; $('man-inp-epg').value = '';
  $('man-edit-msg').textContent = '';
}

function manEditCat(cid) {
  manState.editType = 'cat'; manState.editId = cid;
  $('man-edit-wrap').style.opacity = '1'; $('man-edit-wrap').style.pointerEvents = 'auto';
  $('man-epg-wrap').classList.add('hidden'); $('man-edit-msg').textContent = '';
  var c = manState.rawCats.find(function(x){ return String(x.category_id)===cid; });
  $('man-inp-name').value = peDraftNames.cats[cid] || (c ? c.category_name : '');
  SpatialNav.focusBySelector('#man-inp-name');
  setTimeout(function(){ $('man-inp-name').focus(); }, 100);
}

function manEditStream(sid) {
  manState.editType = 'stream'; manState.editId = sid;
  $('man-edit-wrap').style.opacity = '1'; $('man-edit-wrap').style.pointerEvents = 'auto';
  $('man-epg-wrap').classList.remove('hidden'); $('man-edit-msg').textContent = '';
  var s = manState.rawStreams.find(function(x){ 
      var sid2 = String(manState.tab === 'series' ? x.series_id : x.stream_id); return sid2 === sid; 
  });
  $('man-inp-name').value = peDraftNames.streams[sid] || (s ? (s.name || s.title) : '');
  $('man-inp-epg').value = peDraftNames.epgs[sid] || (s ? (s.epg_channel_id || '') : '');
  SpatialNav.focusBySelector('#man-inp-name');
  setTimeout(function(){ $('man-inp-name').focus(); }, 100);
}

function manSaveEdit() {
  if(!manState.editType) return;
  var name = $('man-inp-name').value.trim();
  var id = manState.editId;
  if(manState.editType === 'cat') {
      peDraftNames.cats[id] = name;
      renderManCats();
      if(manState.catId === id) $('man-stream-title').textContent = name;
  } else if (manState.editType === 'stream') {
      peDraftNames.streams[id] = name;
      var epg = $('man-inp-epg').value.trim();
      peDraftNames.epgs[id] = epg;
      renderManStreams();
  }
  $('man-edit-msg').textContent = 'Gespeichert!';
  setTimeout(function(){ $('man-edit-msg').textContent=''; }, 2000);
}