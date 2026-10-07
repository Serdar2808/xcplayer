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
  peSetTarget('both');
  peSetType('prefix');
  $('pe-manual-modal').classList.remove('hidden');
  FocusTrap.trap('pe-manual-modal');
  setTimeout(function(){ SpatialNav.focusBySelector('#pe-pill-target .pe-pill[data-val="both"]'); }, 50);
}

// Pillen-Auswahl statt <select> — auf TV-Fernbedienungen lässt sich ein
// natives Dropdown oft nicht öffnen/schließen. Der gewählte Wert liegt im
// data-value-Attribut der jeweiligen Reihe.
function peSetTarget(val) {
  var row = $('pe-pill-target');
  row.setAttribute('data-value', val);
  row.querySelectorAll('.pe-pill').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-val') === val); });
}
function peSetType(val) {
  var row = $('pe-pill-type');
  row.setAttribute('data-value', val);
  row.querySelectorAll('.pe-pill').forEach(function(b){ b.classList.toggle('active', b.getAttribute('data-val') === val); });
  peUpdateFormFields();
  peUpdatePreview();
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
  var typ = $('pe-pill-type').getAttribute('data-value');
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
  var typ = ($('pe-pill-type') && $('pe-pill-type').getAttribute('data-value')) || 'prefix';
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
  var target = $('pe-pill-target').getAttribute('data-value');
  var type = $('pe-pill-type').getAttribute('data-value');
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
// Qualitäts-Muster für "Bevorzugte Qualität bei Duplikaten"
var DUP_PREF_RE = {
  uhd: /(^|[\s(])(uhd|4k)([\s)*+]|$)|ᵁᴴᴰ/i,
  fhd: /(^|[\s(])(fhd|1080p?)([\s)*+]|$)|ᶠᴴᴰ/i,
  hd: /(^|[\s(])(hd|720p?)([\s)*+]|$)|(^|[^ᶠᵁ])ᴴᴰ/i,
  hevc: /hevc|h\.?265/i
};
function applyVariantGrouping(arr) {
  if (S.tab !== 'live' || !Settings.groupVariants) return arr;
  var seen = {};
  var res = [];
  var re = DUP_PREF_RE[Settings.dupPref];
  for (var i=0; i<arr.length; i++) {
    var base = _baseName(arr[i].name);
    if (seen[base] === undefined) {
      seen[base] = res.length;
      res.push(arr[i]);
    } else if (re && !re.test(res[seen[base]].name) && re.test(arr[i].name)) {
      res[seen[base]] = arr[i];          // bevorzugte Variante steht an der Stelle der ersten
    }
  }
  return res;
}

// ── VERWALTUNGS-EDITOR (Fokus folgt Vorschau, OK greift & legt ab) ────
// Bedienkonzept:
//   - Hoch/Runter durch die Kategorien zeigt rechts sofort deren Sender an
//     (Fokus = Vorschau, kein extra Auswahlschritt nötig).
//   - OK auf einer Zeile "greift" sie (visuell hervorgehoben); solange
//     gegriffen, verschieben Hoch/Runter genau diese eine Zeile direkt an
//     ihre neue Position. OK legt wieder ab.
//   - GELB blendet die fokussierte Zeile aus/ein, GRÜN springt in ihr
//     Umbenennen-Feld. Das Umbenennen-Feld zeigt aber IMMER schon den Namen
//     der gerade fokussierten Zeile (auch ohne GRÜN) — GRÜN ist nur die
//     Abkürzung, um direkt ins Textfeld zu springen.
var manState = {
  tab: 'live', catId: null, streamId: null, editType: null, editId: null,
  rawCats: [], rawStreams: [],
  grabbed: null,   // null | { kind:'cats'|'streams', id:string }
  previewId: null  // zuletzt ins Umbenennen-Feld übernommene Zeilen-ID
};

async function manSetTab(tab) {
  manState.tab = tab; manState.catId = null; manState.grabbed = null; manState.previewId = null;
  manDisableEdit();
  $('man-tab-live').classList.toggle('active', tab==='live');
  $('man-tab-vod').classList.toggle('active', tab==='vod');
  $('man-tab-series').classList.toggle('active', tab==='series');
  $('man-cat-list').innerHTML = '<div class="loading-c" style="height:100px"><div class="spinner"></div></div>';
  $('man-stream-list').innerHTML = '<div class="empty-s">Wähle eine Kategorie aus.</div>';
  $('man-stream-title').textContent = 'Sender / Streams';

  try {
      var cats = await getOrFetchData('cats', tab);
      manState.rawCats = PlaylistEditor.apply(cats, 'cat');
      renderManCats();
      var orderArr = peDraftOrders.cats[tab] || [];
      if (orderArr.length) await manSelectCat(orderArr[0]);
      setTimeout(function(){
        SpatialNav.focusBySelector('#man-cat-list [data-man-id]');
        _manAutoPreview(); // Umbenennen-Feld sofort mit der ersten Kategorie befüllen
      }, 50);
  } catch(e) { Logger.warn('[ManSetTab] error:', e.message); $('man-cat-list').innerHTML = '<div class="empty-s">Fehler</div>'; }
}

// Delegierte mouseover-Bindung (einmalig, Listen werden neu gerendert, aber
// die Container-Elemente selbst bleiben bestehen), damit SpatialNav.focused
// auch bei Maus-Interaktion zuverlässig der hervorgehobenen Zeile folgt.
(function(){
  var cl = document.getElementById('man-cat-list');
  var sl = document.getElementById('man-stream-list');
  if (cl) cl.addEventListener('mouseover', function(e){ var row = e.target.closest('.man-row'); if(row){ setFocus(row); _manAutoPreview(); } });
  if (sl) sl.addEventListener('mouseover', function(e){ var row = e.target.closest('.man-row'); if(row){ setFocus(row); _manAutoPreview(); } });
})();

// Greift/legt eine Zeile ab. Wird sowohl vom Zeilen-Klick (Maus) als auch
// vom OK-Tastendruck (über den normalen Click-Dispatch von SpatialNav.select)
// ausgelöst — und beim Ablegen per Taste direkt aus dem Keyhandler.
function manRowActivate(kind, id) {
  // Handy: Antippen wählt nur aus (Vorschau/Umbenennen-Feld) - verschoben
  // wird über die Schaltflächen in der Zeile
  if (_manTouch()) {
    var row = document.querySelector((kind === 'cats' ? '#man-cat-list' : '#man-stream-list') + ' [data-man-id="'+id+'"]');
    if (row) { setFocus(row); _manAutoPreview(); }
    return;
  }
  if (manState.grabbed) {
    if (manState.grabbed.kind === kind && manState.grabbed.id === id) {
      manState.grabbed = null;
      if (kind === 'cats') renderManCats(); else renderManStreams();
      SpatialNav.focusBySelector('[data-man-id="'+id+'"]');
      showToast('Position übernommen', 1200);
    }
    return; // ein anderes Item ist gerade gegriffen — erst dort ablegen
  }
  manState.grabbed = { kind: kind, id: id };
  if (kind === 'cats') renderManCats(); else renderManStreams();
  showToast('Verschieben: ↑/↓ bewegen · OK zum Ablegen', 2500);
  SpatialNav.focusBySelector('[data-man-id="'+id+'"]');
}

function manCancelGrab() {
  if (!manState.grabbed) return false;
  var kind = manState.grabbed.kind;
  manState.grabbed = null;
  if (kind === 'cats') renderManCats(); else renderManStreams();
  return true;
}

function _manTouch() { return document.documentElement.classList.contains('xc-phone'); }

// Schaltflächen am Zeilenende (nur auf Handys sichtbar, ersetzen OK/GELB/GRÜN)
function _manActs(kind, id) {
  var a = esc(id);
  function b(act, ico, title) {
    return '<button class="man-act" title="'+title+'" onclick="manAct(event,\''+kind+'\',\''+a+'\',\''+act+'\')">'+ico+'</button>';
  }
  return '<span class="man-acts">' + b('up', '&#x25B2;', 'Nach oben') + b('down', '&#x25BC;', 'Nach unten')
       + b('vis', '&#x1F441;', 'Aus-/Einblenden') + b('ren', '&#x270E;', 'Umbenennen') + '</span>';
}

function manAct(e, kind, id, act) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  if (act === 'up' || act === 'down') { manMoveItem(kind, id, act === 'up' ? -1 : 1); return; }
  if (act === 'vis') { if (kind === 'cats') manToggleSingleCatVisibility(id); else manToggleSingleStreamVisibility(id); return; }
  if (act === 'ren') { if (kind === 'cats') manEditCat(id); else manEditStream(id); }
}

function manMoveGrabbed(dir) {
  if (!manState.grabbed) return;
  manMoveItem(manState.grabbed.kind, manState.grabbed.id, dir);
}

function manMoveItem(kind, id, dir) {
  var arr = kind === 'cats' ? peDraftOrders.cats[manState.tab] : (manState.catId ? peDraftOrders.streams[manState.catId] : null);
  if (!arr) return;
  var idx = arr.indexOf(id);
  var newIdx = idx + dir;
  if (idx === -1 || newIdx < 0 || newIdx >= arr.length) return;
  var tmp = arr[idx]; arr[idx] = arr[newIdx]; arr[newIdx] = tmp;
  if (kind === 'cats') renderManCats(); else renderManStreams();
  SpatialNav.focusBySelector((kind === 'cats' ? '#man-cat-list' : '#man-stream-list') + ' [data-man-id="'+id+'"]');
}

function manToggleSingleCatVisibility(cid) {
  var hc = peDraftVisCats[manState.tab] || [];
  var idx = hc.indexOf(cid);
  if (idx === -1) hc.push(cid); else hc.splice(idx, 1);
  peDraftVisCats[manState.tab] = hc;
  renderManCats();
  SpatialNav.focusBySelector('#man-cat-list [data-man-id="'+cid+'"]');
}

function manToggleSingleStreamVisibility(sid) {
  var hs = peDraftVisStreams[manState.tab] || [];
  var idx = hs.indexOf(sid);
  if (idx === -1) hs.push(sid); else hs.splice(idx, 1);
  peDraftVisStreams[manState.tab] = hs;
  renderManStreams();
  SpatialNav.focusBySelector('#man-stream-list [data-man-id="'+sid+'"]');
}

// Aktualisiert nur die "geöffnet"-Markierung, ohne die DOM-Knoten der Liste
// zu ersetzen — sonst zeigt SpatialNav.focused auf einen entfernten Knoten
// (Rect 0/0) und die nächste Bewegung springt an den oberen Bildschirmrand.
function _manUpdateCatOpenHighlight() {
  var rows = document.querySelectorAll('#man-cat-list .man-row');
  for (var i = 0; i < rows.length; i++) {
    rows[i].classList.toggle('man-open', rows[i].getAttribute('data-man-id') === manState.catId);
  }
}

// Nach Fokusbewegung (Hoch/Runter/Links/Rechts/Maus) im Verwalten-Tab:
//   - Kategorien-Liste: Sender-Vorschau rechts nachziehen.
//   - In beiden Listen: Name der fokussierten Zeile sofort ins
//     Umbenennen-Feld übernehmen (ohne GRÜN drücken zu müssen).
function _manAutoPreview() {
  if (!SpatialNav.focused) return;
  if (SpatialNav.focused.closest('#man-cat-list')) {
    var cid = SpatialNav.focused.getAttribute('data-man-id');
    if (cid) {
      if (cid !== manState.catId) manSelectCat(cid);
      _manSyncEditPanel('cats', cid);
    }
  } else if (SpatialNav.focused.closest('#man-stream-list')) {
    var sid = SpatialNav.focused.getAttribute('data-man-id');
    if (sid) _manSyncEditPanel('streams', sid);
  }
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

  var grabbedId = (manState.grabbed && manState.grabbed.kind === 'cats') ? manState.grabbed.id : null;
  var html = '';
  for(var i=0; i<orderArr.length; i++) {
      var cid = orderArr[i];
      var c = catMap[cid];
      if(!c) continue;
      var isOpen = manState.catId === cid;
      var isHidden = hc.indexOf(cid) !== -1;
      var isGrabbed = grabbedId === cid;
      var cname = peDraftNames.cats[cid] || c.category_name;
      html += '<div class="man-row'+(isOpen?' man-open':'')+(isHidden?' strike':'')+(isGrabbed?' man-grabbed':'')+'" '
            + 'data-focusable data-man-id="'+esc(cid)+'" onclick="manRowActivate(\'cats\',\''+cid+'\')">'
            + '<span class="man-handle">&#x2261;</span>'
            + '<span class="man-row-name">'+esc(cname)+'</span>'
            + _manActs('cats', cid)
            + '</div>';
  }
  $('man-cat-list').innerHTML = html || '<div class="empty-s">Keine Einträge</div>';
}

async function manSelectCat(cid) {
  manState.catId = cid; _manUpdateCatOpenHighlight();
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
          arr = arr.filter(function(s) { return String(s.category_id) === cid; });
      }
      manState.rawStreams = PlaylistEditor.apply(arr, 'stream');
      renderManStreams();
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

  var grabbedId = (manState.grabbed && manState.grabbed.kind === 'streams') ? manState.grabbed.id : null;
  var html = '';
  for(var i=0; i<orderArr.length; i++) {
      var sid = orderArr[i];
      var s = sMap[sid];
      if(!s) continue;
      var isHidden = hs.indexOf(sid) !== -1;
      var isGrabbed = grabbedId === sid;
      var sname = peDraftNames.streams[sid] || s.name || s.title || '';
      html += '<div class="man-row'+(isHidden?' strike':'')+(isGrabbed?' man-grabbed':'')+'" '
            + 'data-focusable data-man-id="'+esc(sid)+'" onclick="manRowActivate(\'streams\',\''+sid+'\')">'
            + '<span class="man-handle">&#x2261;</span>'
            + '<span class="man-row-name">'+esc(sname)+'</span>'
            + _manActs('streams', sid)
            + '</div>';
  }
  $('man-stream-list').innerHTML = html || '<div class="empty-s">Keine Einträge</div>';
}

function manDisableEdit() {
  manState.editType = null; manState.editId = null; manState.previewId = null;
  $('man-edit-wrap').style.opacity = '0.3'; $('man-edit-wrap').style.pointerEvents = 'none';
  $('man-inp-name').value = ''; $('man-inp-epg').value = '';
  $('man-edit-msg').textContent = '';
}

// Schreibt Name (und ggf. EPG-ID) der gegebenen Zeile ins Umbenennen-Feld,
// ohne dass GRÜN gedrückt werden musste. Überschreibt eine laufende Eingabe
// nicht erneut, solange dieselbe Zeile weiterhin die Vorschau stellt.
function _manSyncEditPanel(kind, id) {
  if (!id) { manDisableEdit(); return; }
  if (manState.previewId === id && manState.editType === (kind === 'cats' ? 'cat' : 'stream')) return;
  manState.previewId = id;
  $('man-edit-wrap').style.opacity = '1'; $('man-edit-wrap').style.pointerEvents = 'auto';
  $('man-edit-msg').textContent = '';
  if (kind === 'cats') {
    manState.editType = 'cat'; manState.editId = id;
    $('man-epg-wrap').classList.add('hidden');
    var c = manState.rawCats.find(function(x){ return String(x.category_id) === id; });
    $('man-inp-name').value = peDraftNames.cats[id] || (c ? c.category_name : '');
  } else {
    manState.editType = 'stream'; manState.editId = id;
    $('man-epg-wrap').classList.remove('hidden');
    var s = manState.rawStreams.find(function(x){
      var sid2 = String(manState.tab === 'series' ? x.series_id : x.stream_id); return sid2 === id;
    });
    $('man-inp-name').value = peDraftNames.streams[id] || (s ? (s.name || s.title) : '');
    $('man-inp-epg').value = peDraftNames.epgs[id] || (s ? (s.epg_channel_id || '') : '');
  }
}

// GRÜN-Taste: Vorschau ist schon aktiv (siehe _manAutoPreview) — springt nur
// noch direkt ins Textfeld, damit man sofort tippen kann.
function manEditCat(cid) {
  _manSyncEditPanel('cats', cid);
  SpatialNav.focusBySelector('#man-inp-name');
  setTimeout(function(){ $('man-inp-name').focus(); }, 100);
}
function manEditStream(sid) {
  _manSyncEditPanel('streams', sid);
  SpatialNav.focusBySelector('#man-inp-name');
  setTimeout(function(){ $('man-inp-name').focus(); }, 100);
}

function manSaveEdit() {
  if(!manState.editType) return;
  var name = $('man-inp-name').value.trim();
  var id = manState.editId;
  if(manState.editType === 'cat') {
      peDraftNames.cats[id] = name;
      var _keepFocus = SpatialNav.focused;
      renderManCats();
      if(_keepFocus && !document.body.contains(_keepFocus)) SpatialNav.focusBySelector('#man-inp-name');
      if(manState.catId === id) $('man-stream-title').textContent = name;
  } else if (manState.editType === 'stream') {
      peDraftNames.streams[id] = name;
      var epg = $('man-inp-epg').value.trim();
      peDraftNames.epgs[id] = epg;
      var _keepFocus2 = SpatialNav.focused;
      renderManStreams();
      if(_keepFocus2 && !document.body.contains(_keepFocus2)) SpatialNav.focusBySelector('#man-inp-name');
  }
  $('man-edit-msg').textContent = 'Gespeichert!';
  setTimeout(function(){ $('man-edit-msg').textContent=''; }, 2000);
}
