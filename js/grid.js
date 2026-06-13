// ── VIRTUELLES GRID ──────────────────────────────────────────────
function getGridMetrics(){
  if(S._gmCache) return S._gmCache;
  var sg = $('stream-grid');
  var cw = sg.clientWidth - 48;
  var gap = 14;
  var w, h;
  if(sg.classList.contains('layout-list')){
    w = cw; h = 78; gap = 4;
    return S._gmCache={w:w,h:h,gap:gap,cols:1,tw:w+gap,th:h+gap};
  } else if(sg.classList.contains('layout-hero')){
    w = 354; h = 212; gap = 14;
  } else if(sg.classList.contains('layout-mini')){
    w = 134; h = 216; gap = 10;
  } else {
    w = S.tab==='live' ? 360 : 184;
    h = S.tab==='live' ? 82  : 285;
    gap = 14;
  }
  var cols = Math.max(1, Math.floor((cw+gap)/(w+gap)));
  return S._gmCache={w:w,h:h,gap:gap,cols:cols,tw:w+gap,th:h+gap};
}
function getGridCols(){ return getGridMetrics().cols; }
var _gridSi=-1, _gridEi=-1, _gridFocused=-1;
var _gridPool = [];       // Pool of reusable DOM elements
var _gridPoolMap = {};    // idx → poolSlot mapping
var _failedImgs = {};     // Track failed image URLs

function resetVirtualGrid(){ S._gmCache=null; S.cursors.grid=0; $('stream-grid').scrollTop=0; _gridSi=-1; _gridEi=-1; _gridPool=[]; _gridPoolMap={}; $('grid-content').innerHTML=''; renderVirtualGrid(); }

function _getPoolEl(idx){
  // Existierendes Element für diesen Index wiederverwenden, aus Pool nehmen oder neu erstellen
  if(_gridPoolMap[idx]) return _gridPoolMap[idx];
  
  var el;
  // Unbenutztes Pool-Element finden
  for(var p=0; p<_gridPool.length; p++){
    if(!_gridPool[p]._used){
      el = _gridPool[p];
      el._used = true;
      _gridPoolMap[idx] = el;
      return el;
    }
  }
  // Neues Element erstellen
  el = document.createElement('div');
  el.className = 'grid-item-wrap';
  el.setAttribute('data-focusable', '');
  el._used = true;
  el._lastIdx = -1;
  el._lastSrc = '';
  _gridPool.push(el);
  _gridPoolMap[idx] = el;
  $('grid-content').appendChild(el);
  return el;
}

function _releasePoolRange(oldSi, oldEi, newSi, newEi){
  for(var i=oldSi; i<=oldEi; i++){
    if(i < newSi || i > newEi){
      var el = _gridPoolMap[i];
      if(el){ el._used = false; el.style.display = 'none'; el.id=''; el._lastIdx=-1; delete _gridPoolMap[i]; }
    }
  }
}

function renderVirtualGrid(){
  var cont=$('grid-content'),scroll=$('stream-grid').scrollTop,viewH=$('stream-grid').clientHeight;
  var total=S.filteredStreams.length;
  if(!total){ cont.style.height='100%'; cont.innerHTML='<div class=\"empty-s\"><p>Keine Einträge</p></div>'; _gridSi=-1;_gridEi=-1; _gridPool=[]; _gridPoolMap={}; return; }
  var m=getGridMetrics(),rows=Math.ceil(total/m.cols);
  cont.style.height=(rows*m.th)+'px';
  var startRow=Math.max(0,Math.floor(scroll/m.th)-CONFIG.GRID_BUFFER_ROWS);
  var endRow=Math.min(rows-1,startRow+Math.ceil(viewH/m.th)+CONFIG.GRID_BUFFER_ROWS*2);
  var si=startRow*m.cols, ei=Math.min(total-1,((endRow+1)*m.cols)-1);

  // Schneller Pfad: gleicher Bereich, nur Fokus aktualisieren
  if(si===_gridSi && ei===_gridEi){
    var prev=_gridPoolMap[_gridFocused];
    if(prev) prev.classList.remove('card-focused');
    var next=_gridPoolMap[S.cursors.grid];
    if(next && S.focusArea === 'grid') next.classList.add('card-focused');
    _gridFocused=S.cursors.grid;
    return;
  }

  // Elemente außerhalb des Bereichs an Pool zurückgeben
  if(_gridSi >= 0) _releasePoolRange(_gridSi, _gridEi, si, ei);
  
  var prevSi=_gridSi, prevEi=_gridEi;
  _gridSi=si; _gridEi=ei; _gridFocused=S.cursors.grid;
  var nowTs = Date.now()/1000;

  for(var i=si; i<=ei; i++){
    var s=S.filteredStreams[i];
    var el=_getPoolEl(i);
    var row=Math.floor(i/m.cols), col=i%m.cols;
    
    // Position per GPU-Beschleunigung setzen (beseitigt Layout-Thrashing beim Scrollen)
    el.style.cssText='position:absolute;cursor:pointer;width:'+m.w+'px;height:'+m.h+'px;transform:translate3d('+(col*m.tw)+'px,'+(row*m.th)+'px,0);display:block';
    el.id='gwrap-'+i;
    el.setAttribute('data-idx', i);
    el.className='grid-item-wrap'+(i===S.cursors.grid && S.focusArea === 'grid'?' card-focused':'');

    // Inhalts-Aktualisierung überspringen, wenn es derselbe Stream wie vorher ist
    var streamKey = s.stream_id || s.series_id || i;
    if(el._lastIdx === streamKey && el._lastTab === S.tab){
      continue; // Content unchanged, skip DOM update
    }
    el._lastIdx = streamKey;
    el._lastTab = S.tab;

    // DOM-Struktur nur einmalig pro Tab-Typ aufbauen
    if (el._domTab !== S.tab) {
      if (S.tab === 'live') {
        el.innerHTML = '<div class="card-live">'
          + '<img class="ch-logo" src="" loading="lazy" style="display:none" onerror="_logoErr(this)">'
          + '<div class="ch-logo-ph" style="display:flex">&#x1F4E1;</div>'
          + '<div class="ch-info"><div class="ch-name"></div><div class="ch-epg-text"></div></div>'
          + '<div class="fav-star" style="display:none">&#x2B50;</div>'
          + '</div>';
        el._ui = { logo: el.querySelector('.ch-logo'), ph: el.querySelector('.ch-logo-ph'), name: el.querySelector('.ch-name'), epg: el.querySelector('.ch-epg-text'), fav: el.querySelector('.fav-star') };
      } else {
        el.innerHTML = '<div class="card-poster">'
          + '<div class="poster-wrap">'
          + '<img class="poster-img" src="" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:none" onerror="this.style.display=\'none\'; this.nextElementSibling.style.display=\'flex\'; if(this.src) _failedImgs[this.src]=true;">'
          + '<div class="poster-ph" style="display:flex"><span class="phi">&#x1F3AC;</span></div>'
          + '<div class="fav-star" style="display:none">&#x2B50;</div>'
          + '</div>'
          + '<div class="pinfo"><div class="ptitle"></div><div class="pmeta"></div></div>'
          + '</div>';
        el._ui = { img: el.querySelector('.poster-img'), ph: el.querySelector('.poster-ph'), title: el.querySelector('.ptitle'), meta: el.querySelector('.pmeta'), fav: el.querySelector('.fav-star') };
      }
      el._domTab = S.tab;
      el._lastSrc = '';
    }

    // Nur noch Properties & Sichtbarkeiten aktualisieren
    el._ui.fav.style.display = isFav(s) ? 'block' : 'none';

    if (S.tab === 'live') {
      var logoSrc = getStreamLogoWithEpgFallback(s) || '';
      if (logoSrc && !_failedImgs[logoSrc]) {
        if (el._lastSrc !== logoSrc) { el._ui.logo.src = logoSrc; el._lastSrc = logoSrc; }
        el._ui.logo.style.display = 'block';
        el._ui.ph.style.display = 'none';
      } else {
        el._ui.logo.style.display = 'none';
        el._ui.ph.style.display = 'flex';
      }
      var sName = s.name || '';
      if (el._ui.name.textContent !== sName) el._ui.name.textContent = sName;
      
      var epgTxt = '';
      var cur = null;
      if (EpgData.loaded) cur = EpgData.getNow(s);
      if (cur) epgTxt = cur.title;
      else { var cce = findCurrentEpg(s.stream_id, nowTs); if (cce) epgTxt = b64dec(cce.title || ''); }
      
      if (el._ui.epg.textContent !== epgTxt) el._ui.epg.textContent = epgTxt;
      el._ui.epg.id = 'cepg' + s.stream_id;
    } else {
      var cover = s.stream_icon || s.cover || '';
      if (cover && !_failedImgs[cover]) {
        if (el._lastSrc !== cover) { el._ui.img.src = cover; el._lastSrc = cover; }
        el._ui.img.style.display = 'block';
        el._ui.ph.style.display = 'none';
      } else {
        el._ui.img.style.display = 'none';
        el._ui.ph.style.display = 'flex';
      }
      var title = s.name || s.title || '';
      if (el._ui.title.textContent !== title) el._ui.title.textContent = title;
      var meta = (s.rating ? '⭐' + s.rating + ' ' : '') + (s.releaseDate || s.year || '');
      if (el._ui.meta.textContent !== meta) el._ui.meta.textContent = meta;
    }
  }
}
function ensureCursorInView(){
  var m=getGridMetrics(),row=Math.floor(S.cursors.grid/m.cols);
  var y=row*m.th,viewH=$('stream-grid').clientHeight-36,viewY=$('stream-grid').scrollTop;
  if(y<viewY) $('stream-grid').scrollTop=y;
  if(y+m.th>viewY+viewH) $('stream-grid').scrollTop=y+m.th-viewH;
}
var _scrollRaf=null;
$('stream-grid').addEventListener('scroll',function(){
  if(_scrollRaf) cancelAnimationFrame(_scrollRaf);
  _scrollRaf=requestAnimationFrame(function(){ _gridSi=-1; renderVirtualGrid(); });
});
$('grid-content').addEventListener('mouseover',function(e){
  var w=e.target.closest('.grid-item-wrap'); if(!w) return;
  var idx=parseInt(w.getAttribute('data-idx'));
  if(!isNaN(idx)&&idx!==S.cursors.grid){
    S.cursors.grid=idx; S.focusArea='grid'; renderVirtualGrid();
  }

});

$('grid-content').addEventListener('click',function(e){
  var w=e.target.closest('.grid-item-wrap'); if(!w) return;
  var idx=parseInt(w.getAttribute('data-idx')); if(isNaN(idx)) return;
  var s=S.filteredStreams[idx]; if(!s) return;
  S.cursors.grid=idx;
  if(S.tab==='series') openSeries(s);
  else { S.currentStreamIdx=idx; Player.play(API.streamUrl(s),s,S.tab); }
});
$('nav-logo-btn').addEventListener('click',openSysSidebar);

document.addEventListener('click', function(e){
  if(e.target && e.target.closest('#nav-logo-btn')) openSysSidebar();
});

// ── MAGIC REMOTE OK KLICK ─────────────────────────────────────────
// Wenn Magic Remote Cursor sichtbar ist, feuert OK einen Klick() auf das Element darunter.
// Ein Catch-All auf dem Player-Screen fängt alles ab, sodass OK immer funktioniert,
// egal wohin der Cursor zeigt.
$('player-screen').addEventListener('click', function(e){
  // Klicks auf interaktive Elemente ignorieren — sie verwalten sich selbst
  var target = e.target;
  if(target.closest('button,.pbtn,.vchip,#ch-list-overlay,#epg-panel,#variant-bar,#ctrl-vod')) return;
  if(!S.playerVisible) return;
  if(S.variantBarOpen){ switchVariant(S.variantIdx); return; }
  if(S.playerType === 'live') Player.toggleChList();
  else Player.togglePP(); // vod, series, catchup all pause/play on click
});
$('category-list').addEventListener('click',function(e){
  var item=e.target.closest('.cat-item'); if(item) selectCat(item.getAttribute('data-id'),item);
});
$('category-list').addEventListener('mouseover',function(e){
  var item=e.target.closest('.cat-item'); if(!item) return;
  var all=document.querySelectorAll('.cat-item');
  for(var i=0;i<all.length;i++) if(all[i]===item){ S.cursors.cat=i; S.focusArea='sidebar'; updateFocus(); break; }
});
$('season-tabs').addEventListener('click',function(e){
  var b=e.target.closest('.sbtn'); if(!b) return;
  var idx=parseInt(b.getAttribute('data-idx')); if(!isNaN(idx)){ S.cursors.season=idx; selectSeason(idx); }
});
$('season-tabs').addEventListener('mouseover',function(e){
  var b=e.target.closest('.sbtn'); if(!b) return;
  var idx=parseInt(b.getAttribute('data-idx'));
  if(!isNaN(idx)){ S.cursors.season=idx; S.focusArea='series_season'; updateFocus(); }
});
$('episode-list').addEventListener('click',function(e){
  var ep=e.target.closest('.ep-item'); if(!ep) return;
  var idx=parseInt(ep.getAttribute('data-idx')); if(!isNaN(idx)) playEpisode(idx);
});
$('episode-list').addEventListener('mouseover',function(e){
  var ep=e.target.closest('.ep-item'); if(!ep) return;
  var idx=parseInt(ep.getAttribute('data-idx'));
  if(!isNaN(idx)){ S.cursors.ep=idx; S.focusArea='series_ep'; updateFocus(); }
});
function selectCat(id,el){
  document.querySelectorAll('.cat-item').forEach(function(x){ x.classList.remove('active'); });
  if(el) el.classList.add('active');
  S.selectedCat=id; S._gmCache=null;
  S.cursors.grid=0; // Reset grid cursor to first item
  loadStreams(id).then(function(){
    // After loading, focus first grid item
    S.focusArea='grid';
    ensureCursorInView(); renderVirtualGrid();
    setTimeout(function(){ SpatialNav.focusBySelector('#gwrap-0') || SpatialNav.focusBySelector('.grid-item-wrap'); }, 50);
  });
}
var _searchTimer = null;
var _gridSearchId = 0;
$('search-input').addEventListener('input',function(){
  var input = this;
  clearTimeout(_searchTimer);
  _searchTimer = setTimeout(async function(){
    var q=input.value.toLowerCase().trim();
    _gridSearchId++;
    var currentSearchId = _gridSearchId;
    
    var filtered = [];
    if (!q) {
      filtered = S.streams;
    } else {
      var streamsProcessed = 0;
      for (var i = 0; i < S.streams.length; i++) {
        var s = S.streams[i];
        if (((s.name||s.title||'')+'').toLowerCase().indexOf(q) !== -1) filtered.push(s);
        if (++streamsProcessed % 1000 === 0) {
          await new Promise(function(resolve) { setTimeout(resolve, 0); });
          if (_gridSearchId !== currentSearchId) return; // Neue Suche gestartet, abbrechen
        }
      }
    }

    S.filteredStreams=applyVariantGrouping(filtered);
    var ccEl = $('cc'); if (ccEl) ccEl.textContent='('+S.filteredStreams.length+')';
    S._gmCache=null; resetVirtualGrid();
  }, CONFIG.SEARCH_DEBOUNCE_MS);
});

// ── FAVORITEN ─────────────────────────────────────────────────────
function isFav(s){ var id=S.tab==='series'?s.series_id:s.stream_id; return S.favs[S.tab].indexOf(id)!==-1; }
function toggleFav(s){
  var id=S.tab==='series'?s.series_id:s.stream_id,list=S.favs[S.tab],idx=list.indexOf(id);
  if(idx===-1){ list.push(id); showToast('Zu Favoriten hinzugefügt',1500); }
  else{ list.splice(idx,1); showToast('Aus Favoriten entfernt',1500); }
  saveFavs();
}

// ── KATEGORIEN & STREAMS ──────────────────────────────────────────
async function loadCats(){
  $('category-list').innerHTML='<div class="loading-c"><div class="spinner"></div></div>';
  var cats=[];
  try{
    cats = await getOrFetchData('cats', S.tab) || [];
  }catch(e){ Logger.warn('[loadCats] error:', e.message); }
  cats = processCatsFilter(cats, S.tab);
  S.categories=cats;
  var html='<div class="cat-item" data-focusable data-id="" id="cat-1"><span class="cat-name">Alle</span></div>';
  for(var i=0;i<cats.length;i++)
    html+='<div class="cat-item" data-focusable data-id="'+cats[i].category_id+'" id="cat-'+(i+2)+'"><span class="cat-name">'+esc(cats[i].category_name)+'</span></div>';
  html+='<div class="cat-item" data-focusable data-id="fav" id="cat-fav"><span class="cat-name">&#x2B50; Favoriten</span></div>';
  $('category-list').innerHTML=html;
  S.cursors.cat=1; $('cat-1').classList.add('active'); S.selectedCat=null;
}

async function getAllStreamsForTab() {
  if (S.fullStreams[S.tab] && S.fullStreams[S.tab].length) return S.fullStreams[S.tab];
  var data = await getOrFetchData('streams', S.tab) || [];
  var arr = Array.isArray(data) ? data : [];
  arr = processStreamsFilter(arr);
  if (arr.length) S.fullStreams[S.tab] = arr;
  return arr;
}

async function loadStreams(catId){
  $('grid-content').innerHTML='<div class="loading-c"><div class="spinner"></div><span>Laden…</span></div>';
  S._gmCache=null;
  try{
    var arr = await getAllStreamsForTab();
    if(catId==='fav') {
      arr = arr.filter(isFav);
    } else if (catId) {
      arr = arr.filter(function(s) { return String(s.category_id) === String(catId); });
    }

    // Sortiermethode für VOD/Serien anwenden
    arr = applySortMethod(arr);

    S.streams=arr; 
    S.filteredStreams=applyVariantGrouping(arr);
    $('cc').textContent='('+S.filteredStreams.length+')';
    resetVirtualGrid();
  }catch(e){
    Logger.warn('[loadStreams] error:', e.message);
    $('grid-content').innerHTML='<div class="empty-s"><p>Fehler beim Laden</p></div>';
  }
}

// ── SORTIERMETHODE ───────────────────────────────────────────────
function applySortMethod(arr){
  if(S.tab !== 'vod' && S.tab !== 'series') return arr;
  var method = (Settings.sortMethod && Settings.sortMethod[S.tab]) || 'default';
  if(method === 'default') return arr;
  arr = arr.slice(); // Don't mutate original
  if(method === 'az'){
    arr.sort(function(a,b){
      return (a.name||a.title||'').toLowerCase().localeCompare((b.name||b.title||'').toLowerCase());
    });
  } else if(method === 'za'){
    arr.sort(function(a,b){
      return (b.name||b.title||'').toLowerCase().localeCompare((a.name||a.title||'').toLowerCase());
    });
  } else if(method === 'rating'){
    arr.sort(function(a,b){
      return (parseFloat(b.rating)||0) - (parseFloat(a.rating)||0);
    });
  }
  return arr;
}

var _sortMenuOpen = false;
function toggleSortMenu(){
  _sortMenuOpen = !_sortMenuOpen;
  $('sort-menu').classList.toggle('open', _sortMenuOpen);
  if(_sortMenuOpen){
    FocusTrap.trap('sort-menu');
    // Aktuelle Sortierung hervorheben
    var method = (Settings.sortMethod && Settings.sortMethod[S.tab]) || 'default';
    document.querySelectorAll('.sort-opt').forEach(function(el){
      el.classList.toggle('active', el.getAttribute('data-sort') === method);
    });
    setTimeout(function(){ SpatialNav.focusBySelector('.sort-opt.active') || SpatialNav.focusBySelector('.sort-opt'); }, 30);
  } else {
    FocusTrap.release('sort-menu');
  }
}
function setSort(method){
  if(!Settings.sortMethod) Settings.sortMethod = { vod:'default', series:'default' };
  Settings.sortMethod[S.tab] = method;
  Settings.save();
  _sortMenuOpen = false;
  $('sort-menu').classList.remove('open');
  FocusTrap.release('sort-menu');
  // Button-Text aktualisieren
  var labels = {default:'Standard', az:'A → Z', za:'Z → A', rating:'Bewertung'};
  $('sort-btn').innerHTML = '&#x21C5; ' + (labels[method]||'Sortierung');
  // Grid neu laden
  loadStreams(S.selectedCat);
  setTimeout(function(){ SpatialNav.focusBySelector('#sort-btn'); }, 50);
}

async function switchTab(tab){
  S.tab=tab; S.selectedCat=null; S.streams=[]; S.filteredStreams=[]; S._gmCache=null;
  if(!S._navTabHold) S.focusArea='grid';
  $('search-input').value='';
  $('nav-tab-label').textContent={live:'Live TV',vod:'Filme',series:'Serien'}[tab];
  $('ct').textContent={live:'Live TV',vod:'Filme',series:'Serien'}[tab];
  // Top-Tabs: aktiven Tab markieren
  if(typeof updateNavTabsActive === 'function') updateNavTabsActive(tab);
  // Sortier-Button: für VOD/Serien anzeigen, für Live verstecken
  var sw=$('sort-wrap');
  if(sw) sw.classList.toggle('hidden', tab==='live');
  if(tab!=='live'){
    var method = (Settings.sortMethod && Settings.sortMethod[tab]) || 'default';
    var labels = {default:'Standard', az:'A → Z', za:'Z → A', rating:'Bewertung'};
    $('sort-btn').innerHTML = '&#x21C5; ' + (labels[method]||'Sortierung');
  }
  // Layout-Button: nur für VOD/Serien
  var lb = $('layout-btn');
  if(lb){
    lb.style.display = (tab !== 'live' && !Settings.useNetflixStyle) ? 'flex' : 'none';
    // Layout beim Tab-Wechsel zurücksetzen
    _gridLayoutIdx = 0;
    var sg = $('stream-grid');
    sg.classList.remove('layout-list','layout-hero','layout-mini');
    var icon = {'default':'▦ Karten','list':'☰ Liste','hero':'▣ Groß','mini':'⠿ Mini'};
    lb.textContent = icon[GRID_LAYOUTS[0]]; // Standardmäßig 'Karten'
  }
  _sortMenuOpen = false;
  if($('sort-menu')) $('sort-menu').classList.remove('open');
  // Wasserzeichen-Icon
  var wm=$('grid-watermark');
  if(wm) wm.innerHTML = {live:'&#x1F4E1;', vod:'&#x1F3AC;', series:'&#x1F4FA;'}[tab] || '';

  if(tab === 'vod' || tab === 'series'){
    NF.leave();
    await loadCats();
    await NF.enter();
    if (Settings.useNetflixStyle) {
      NF.leave();
      await loadCats();
      await NF.enter();
    } else {
      NF.leave();
      await loadCats();
      await loadStreams(null);
      updateFocus();
    }
  } else {
    NF.leave();
    await loadCats();
    await loadStreams(null);
    updateFocus();
  }
}

function handleEpgClick(e) {
  var item = e.target.closest('.catchup-item');
  if(!item) return; // Klick auf normale Sendung ignorieren
  var startMs = parseInt(item.getAttribute('data-cu-start'));
  var stopMs = parseInt(item.getAttribute('data-cu-stop'));
  var cuId = item.getAttribute('data-cu-id');
  if(isNaN(startMs) || isNaN(stopMs) || !cuId) return;
  
  var title = item.querySelector('.epg-title').textContent;
  
  var targetStream = S.currentStream;
  if(String(targetStream.stream_id) !== String(cuId)){
     for(var i=0; i<S.streams.length; i++){
        if(String(S.streams[i].stream_id) === String(cuId)) { targetStream = S.streams[i]; break; }
     }
  }
  
  var s = Object.assign({}, targetStream);
  s.name = (S.currentStream.name || 'Replay') + ' - ' + title;

  
  var d = new Date(startMs);
  var startStr = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + ':' + pad(d.getHours()) + '-' + pad(d.getMinutes());
  var durationMin = Math.ceil((stopMs - startMs) / 60000);
  s.stream_id = s.stream_id + '_cu_' + Math.floor(startMs/1000); // Eigener Resume-Speicher für Replays
  s.cu_original_id = targetStream.stream_id;
  s.cu_startMs = startMs;
  s.cu_durationMin = durationMin;
  s.cu_offsetSec = 0;
  
  _catchupJustStarted = Date.now();
  Player.toggleEpg();
  Player.play(null, s, 'catchup'); // Startet Catchup mit dynamischer URL
}