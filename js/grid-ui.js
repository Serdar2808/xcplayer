// ── TOP-TAB-LEISTE (zentriert: Suche, Live TV, Filme, Serien, Weiterschauen, Einstellungen, Beenden) ──
// Wird global genutzt; ersetzt die alte sys-sidebar als Hauptmenü.
function updateNavTabsActive(tab){
  var ids = ['nav-tab-live','nav-tab-vod','nav-tab-series','nav-tab-continue','nav-tab-settings','nav-tab-exit','nav-tab-search'];
  var sysIds = ['sys-live','sys-vod','sys-series','sys-continue','sys-settings','sys-exit','sys-search'];
  for(var i=0;i<ids.length;i++){
    var el1 = document.getElementById(ids[i]); if(el1) el1.classList.remove('active');
    var el2 = document.getElementById(sysIds[i]); if(el2) el2.classList.remove('active');
  }
  var map = {
    live:'nav-tab-live',
    vod:'nav-tab-vod',
    series:'nav-tab-series',
    continue:'nav-tab-continue',
    settings:'nav-tab-settings',
    exit:'nav-tab-exit',
    search:'nav-tab-search'
  };
  var sysMap = {
    live:'sys-live', vod:'sys-vod', series:'sys-series', continue:'sys-continue', settings:'sys-settings', exit:'sys-exit', search:'sys-search'
  };
  var aid = map[tab];
  if(aid && document.getElementById(aid)) document.getElementById(aid).classList.add('active');
  var asid = sysMap[tab];
  if(asid && document.getElementById(asid)) document.getElementById(asid).classList.add('active');
}

var _lastTabClick = 0;

function navTabClick(action){
  // WebOS-Fix: Verhindert, dass der TV beim Drücken von OK "keydown" UND "click" 
  // gleichzeitig feuert und dadurch das Live TV doppelt gestartet wird (was das Zappen bricht).
  if(Date.now() - _lastTabClick < 400) return;
  _lastTabClick = Date.now();

  // SCHLIEßE MENÜ IMMER BEI AUSWAHL (wenn es via OK/Klick in der Seitenleiste bestätigt wird)
  if(S.sysMenuOpen) closeSysSidebar();

  if(action === 'search'){
    if(typeof openContextSearch === 'function') openContextSearch();
    else if(typeof NFSearch !== 'undefined') NFSearch.open();
    return;
  }
  if(action === 'settings'){
    if(S.screen === 'settings') {
        S.focusArea = 'settings';
        if(S.settingsCatOpen) {
            setTimeout(function(){ if(typeof SpatialNav !== 'undefined') SpatialNav.focusBySelector('#set-cat-' + S.settingsCatOpen + ' [data-focusable]') || SpatialNav.focusFirst(); }, 50);
        } else {
            setTimeout(function(){ if(typeof SpatialNav !== 'undefined') SpatialNav.focusBySelector('.ios-row') || SpatialNav.focusFirst(); }, 50);
        }
        return;
    }
    if(typeof openSettings === 'function') openSettings();
    return;
  }
  if(action === 'continue'){
    if(S.screen === 'continue' && !S.playerVisible) {
        S.focusArea = 'continue';
        setTimeout(function(){ typeof SpatialNav !== 'undefined' && SpatialNav.focusFirst(); }, 50);
        return;
    }
    
    if (S.playerVisible) { Player.destroy(); S.playerVisible=false; S.epgOpen=false; S.chListOpen=false; }
    if (typeof NF !== 'undefined' && NF.leave) NF.leave();
    if (S.seriesDetailOpen) { S.seriesDetailOpen = false; }
    if(typeof _teardownSettings === 'function') _teardownSettings();
    S.screen = 'continue';
    if(typeof renderContinueScreen === 'function') renderContinueScreen();
    return;
  }
  if(action === 'exit'){
    if(typeof showConfirm === 'function'){
      showConfirm('App beenden', 'Möchtest du die App wirklich beenden?', 'BEENDEN', function(yes){
        if(yes){
          if(window.webOS && webOS.platformBack) webOS.platformBack();
          else window.close();
        } else {
            if(Settings.useSidebar) openSysSidebar();
            else if(typeof navTabsEnter === 'function') navTabsEnter();
        }
      });
    } else {
      if(window.webOS && webOS.platformBack) webOS.platformBack();
      else window.close();
    }
    return;
  }
  if(action === 'live' || action === 'vod' || action === 'series'){
    if(typeof _teardownSettings === 'function') _teardownSettings();
    if(S.screen === 'main' && S.tab === action && (action === 'vod' || action === 'series') && !S.playerVisible && !S.seriesDetailOpen) {
        var ca = document.getElementById('content-area');
        if(Settings.useNetflixStyle && ca && ca.classList.contains('nf-mode')){
            S.focusArea = 'netflix';
            if(typeof NF !== 'undefined' && NF._updateFocusDOM) NF._updateFocusDOM();
        } else {
            S.focusArea = 'grid';
            if(typeof updateFocus === 'function') updateFocus();
        }
        return;
    }
    
    if (action === 'live') {
      if (S.playerVisible && S.playerType === 'live') {
        S.screen = 'live'; 
        S.focusArea = 'player';
        if(typeof Player !== 'undefined') Player.showControls();
        if(typeof clearFocus === 'function') clearFocus();
        return;
      }
      if(typeof launchLiveTv === 'function') launchLiveTv();
    } else {
      if (S.playerVisible) { Player.destroy(); S.playerVisible=false; S.epgOpen=false; S.chListOpen=false; }
      if(typeof launchTab === 'function') launchTab(action);
    }
  }
}

function openContextSearch(){
  S.prevFocusForSearch = S.focusArea;
  if(S.sysMenuOpen) closeSysSidebar();
  var isLiveMode = (S.playerVisible && S.playerType === 'live')
                || (S.screen === 'main' && S.tab === 'live')
                || (S.screen === 'live');
  if(isLiveMode){
    if(typeof LiveSearch !== 'undefined') LiveSearch.open();
    return;
  }
  if(typeof NFSearch !== 'undefined') NFSearch.open();
}

var NAV_TAB_ORDER = ['nav-tab-search','nav-tab-live','nav-tab-vod','nav-tab-series','nav-tab-continue','nav-tab-settings','nav-tab-exit'];

function _navTabFocusIdx(){
  for(var i=0;i<NAV_TAB_ORDER.length;i++){
    var el = document.getElementById(NAV_TAB_ORDER[i]);
    if(el && el.classList.contains('is-focused')) return i;
  }
  return -1;
}

function _navTabSetFocus(idx){
  for(var i=0;i<NAV_TAB_ORDER.length;i++){
    var el = document.getElementById(NAV_TAB_ORDER[i]);
    if(!el) continue;
    if(i === idx) el.classList.add('is-focused');
    else el.classList.remove('is-focused');
  }
  document.body.classList.add('focus-in-topbar');
}

function _navTabClearFocus(){
  for(var i=0;i<NAV_TAB_ORDER.length;i++){
    var el = document.getElementById(NAV_TAB_ORDER[i]);
    if(el) el.classList.remove('is-focused');
  }
  document.body.classList.remove('focus-in-topbar');
}

function _navTabIsVisible(id){
  var el = document.getElementById(id);
  if(!el) return false;
  return el.style.display !== 'none';
}

function navTabsEnter(){
  if(typeof clearFocus === 'function') clearFocus(); 
  S.focusArea = 'nav-tabs';
  var targetId;
  if(S.screen === 'settings'){
    targetId = 'nav-tab-settings';
  } else if(S.screen === 'continue'){
    targetId = 'nav-tab-continue';
  } else if(S.playerVisible && S.playerType === 'live'){
    targetId = 'nav-tab-live';
  } else if(S.screen === 'live'){
    targetId = 'nav-tab-live';
  } else {
    var idMap = {live:'nav-tab-live', vod:'nav-tab-vod', series:'nav-tab-series'};
    targetId = idMap[S.tab] || 'nav-tab-live';
  }
  var idx = NAV_TAB_ORDER.indexOf(targetId);
  if(idx < 0) idx = NAV_TAB_ORDER.indexOf('nav-tab-live'); 
  if(idx < 0) idx = 0;
  _navTabSetFocus(idx);
}

function navTabsLeave(){
  closeSysSidebar();
}

function navTabsMove(dir){
  var idx = _navTabFocusIdx();
  if(idx < 0) idx = 0;
  var step = dir > 0 ? 1 : -1;
  var next = idx;
  for(var i=0;i<NAV_TAB_ORDER.length;i++){
    next += step;
    if(next < 0 || next >= NAV_TAB_ORDER.length) return; 
    if(_navTabIsVisible(NAV_TAB_ORDER[next])){
      _navTabSetFocus(next);
      return;
    }
  }
}

function navTabsSelect(){
  var idx = _navTabFocusIdx();
  if(idx < 0) return;
  var id = NAV_TAB_ORDER[idx];
  var actionMap = {
    'nav-tab-search':'search',
    'nav-tab-live':'live',
    'nav-tab-vod':'vod',
    'nav-tab-series':'series',
    'nav-tab-continue':'continue',
    'nav-tab-settings':'settings',
    'nav-tab-exit':'exit'
  };
  var action = actionMap[id];
  _navTabClearFocus();
  S._navTabHold = false;
  S.sysMenuOpen = false; 
  if(typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
  if (typeof clearFocus === 'function') clearFocus();
  updateNavTabsActive(action);
  navTabClick(action);
}

function openSysSidebar() {
  var vodEl = document.getElementById('nav-tab-vod'); if(vodEl) vodEl.style.display = (Settings.showVod !== false) ? '' : 'none';
  var serEl = document.getElementById('nav-tab-series'); if(serEl) serEl.style.display = (Settings.showSeries !== false) ? '' : 'none';
  var vodElSys = document.getElementById('sys-vod'); if(vodElSys) vodElSys.style.display = (Settings.showVod !== false) ? '' : 'none';
  var serElSys = document.getElementById('sys-series'); if(serElSys) serElSys.style.display = (Settings.showSeries !== false) ? '' : 'none';
  S._navTabHold = true;
  var activeTab = (S.screen === 'settings') ? 'settings' : ((S.screen === 'continue') ? 'continue' : (S.playerVisible && S.playerType === 'live' ? 'live' : (S.screen === 'live' ? 'live' : S.tab)));
  if(typeof updateNavTabsActive === 'function') updateNavTabsActive(activeTab);

  if (Settings.useSidebar) {
    S.sysMenuOpen = true;
    S._navTabHold = false;
    var ov = document.getElementById('sys-overlay'), sb = document.getElementById('sys-sidebar');
    if(ov) ov.classList.add('show');
    if(sb) { sb.classList.remove('sys-hidden'); sb.classList.add('open'); }
    S.focusArea = 'sys-sidebar';
    if(!SpatialNav.focused || !SpatialNav.focused.classList.contains('sys-item')) {
      setTimeout(function(){
        SpatialNav.focusBySelector('.sys-item.active') || SpatialNav.focusBySelector('.sys-item');
      }, 50);
    }
  } else {
    S.sysMenuOpen = false; 
    var nb = document.getElementById('navbar');
    if(nb){
      nb.classList.remove('hidden');
      if(S.playerVisible) nb.classList.add('player-osd');
      else nb.classList.remove('player-osd');
      void nb.offsetWidth;
    }
    navTabsEnter();
  }
}

function closeSysSidebar() {
  S.sysMenuOpen = false;
  S._navTabHold = false;
  _navTabClearFocus();
  
  var ov = document.getElementById('sys-overlay'), sb = document.getElementById('sys-sidebar');
  if(ov) ov.classList.remove('show');
  if(sb) sb.classList.remove('open');
  if(typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
  
  if (S.screen === 'settings') {
     S.focusArea = 'settings';
     setTimeout(function(){ 
       if(typeof SpatialNav !== 'undefined') { 
         if(S.settingsCatOpen) SpatialNav.focusBySelector('#set-cat-' + S.settingsCatOpen + ' [data-focusable]') || SpatialNav.focusFirst();
         else SpatialNav.focusBySelector('.ios-row') || SpatialNav.focusFirst(); 
       } 
     }, 50);
  } else if (S.screen === 'continue') {
     S.focusArea = 'continue';
     setTimeout(function(){ if(typeof SpatialNav !== 'undefined') { SpatialNav.focusBySelector('.continue-tile') || SpatialNav.focusBySelector('#cs-empty-back'); } }, 50);
  } else if (S.seriesDetailOpen) {
     S.focusArea = 'series_ep';
     setTimeout(function(){ if(typeof SpatialNav !== 'undefined') { SpatialNav.focusBySelector('#ep-' + S.cursors.ep) || SpatialNav.focusBySelector('.ep-item') || SpatialNav.focusBySelector('.sbtn.active'); } }, 50);
  } else if (S.playerVisible || (S.screen === 'live' && S.tab === 'live')) {
     S.focusArea = 'player';
     if(typeof Player !== 'undefined' && Player.showControls) Player.showControls();
     if(typeof clearFocus === 'function') clearFocus();
  } else if (document.body.classList.contains('nf-active')) {
     S.focusArea = 'netflix';
     if(typeof NF !== 'undefined' && NF._updateFocusDOM) NF._updateFocusDOM();
  } else {
     if (Settings.useSidebar) {
       S.focusArea = 'sidebar';
       setTimeout(function(){ SpatialNav.focusBySelector('.cat-item.active') || SpatialNav.focusBySelector('.cat-item'); }, 50);
     } else {
       S.focusArea = 'grid';
       if(typeof updateFocus === 'function') updateFocus();
     }
  }
}

document.addEventListener('click', function(e){
  var tab = e.target.closest('.nav-tab-item');
  if(tab && tab.id) {
    var idx = NAV_TAB_ORDER.indexOf(tab.id);
    if(idx >= 0) {
       _navTabSetFocus(idx);
       navTabsSelect();
    }
  }
});

// ── GRID LAYOUT ──────────────────────────────────────────────────
function cycleGridLayout() {
  if (typeof GRID_LAYOUTS === 'undefined') return;
  _gridLayoutIdx = (_gridLayoutIdx + 1) % GRID_LAYOUTS.length;
  var mode = GRID_LAYOUTS[_gridLayoutIdx];
  var sg = document.getElementById('stream-grid');
  if(sg) {
      sg.classList.remove('layout-list','layout-hero','layout-mini');
      if(mode !== 'default') sg.classList.add('layout-'+mode);
  }
  var btn = document.getElementById('layout-btn');
  var icon = {'default':'▦ Karten','list':'☰ Liste','hero':'▣ Groß','mini':'⠿ Mini'};
  if(btn) btn.textContent = icon[mode]||'▦ Ansicht';
  
  // Neuberechnung der Grid-Metriken mit neuen Kartendimensionen erzwingen
  S._gmCache = null;
  if (typeof _gridSi !== 'undefined') _gridSi = -1; 
  if (typeof _gridEi !== 'undefined') _gridEi = -1; 
  if (typeof _gridPool !== 'undefined') _gridPool = []; 
  if (typeof _gridPoolMap !== 'undefined') _gridPoolMap = {};
  
  var gc = document.getElementById('grid-content');
  if(gc) gc.innerHTML = '';
  var sge = document.getElementById('stream-grid');
  if(sge) sge.scrollTop = 0;
  S.cursors.grid = 0;
  
  if (typeof renderVirtualGrid === 'function') renderVirtualGrid();
  if (typeof showToast === 'function') showToast('Ansicht: '+(icon[mode]||mode), 1200);
}