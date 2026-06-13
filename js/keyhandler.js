// ── KEY ROUTER (State Pattern) ────────────────────────────────────
var KeyRouter = {
  handlers: {},
  register: function(area, handlerFunc) {
    this.handlers[area] = handlerFunc;
  },
  dispatch: function(e, k, tag) {
    var handler = this.handlers[S.focusArea];
    if (handler && handler(e, k, tag)) {
      return true; // Event wurde konsumiert
    }
    return false; // Fallback auf Standard
  }
};

// ── MODUL-REGISTRIERUNG ───────────────────────────────────────────
KeyRouter.register('nf-search', function(e, k) {
  if(typeof NFSearch === 'undefined') return false;
  if(k===27 || k===KEYS.BACK || k===KEYS.BACK2){ e.preventDefault(); NFSearch.close(); S._backConsumed = true; return true; }
  if(NFSearch.mode === 'results'){ e.preventDefault(); if(k===38){ if(NFSearch.focusedIdx < NFSearch.cols){ NFSearch.toInput(); } else { NFSearch.move(-NFSearch.cols); } return true; } if(k===40){ NFSearch.move(NFSearch.cols); return true; } if(k===37){ NFSearch.move(-1); return true; } if(k===39){ NFSearch.move(1); return true; } if(k===13){ NFSearch.select(); return true; } return true; }
  if(k===40 || k===13){ if(NFSearch.results.length){ e.preventDefault(); NFSearch.toResults(); } return true; }
  return true;
});

KeyRouter.register('live-search', function(e, k) {
  if(typeof LiveSearch === 'undefined') return false;
  if(k===27 || k===KEYS.BACK || k===KEYS.BACK2){ e.preventDefault(); LiveSearch.close(); S._backConsumed = true; return true; }
  if(LiveSearch.mode === 'results'){ e.preventDefault(); if(k===38){ if(LiveSearch.focusedIdx < LiveSearch.cols) LiveSearch.toInput(); else LiveSearch.move(-LiveSearch.cols); return true; } if(k===40){ LiveSearch.move(LiveSearch.cols); return true; } if(k===37){ LiveSearch.move(-1); return true; } if(k===39){ LiveSearch.move(1); return true; } if(k===13){ LiveSearch.select(); return true; } return true; }
  if(k===40 || k===13){ if(LiveSearch.results.length){ e.preventDefault(); LiveSearch.toResults(); } return true; }
  return true;
});

KeyRouter.register('netflix', function(e, k) {
  if(typeof NF === 'undefined') return false;
  e.preventDefault();
  if(k===KEYS.BLUE || k===66){ if (typeof NFSearch !== 'undefined') NFSearch.open(); return true; }
  if(k===38){ if(NF.rowIdx===0){ if(!Settings.useSidebar) navTabsEnter(); return true; } NF.moveUp(); return true; }
  if(k===40){ NF.moveDown(); return true; }
  if(k===37){ NF.moveLeft(); return true; }
  if(k===39){ NF.moveRight(); return true; }
  if(k===13){ NF.select(); return true; }
  if(k===KEYS.YELLOW||k===89){ var nfs=NF.data[NF.rowIdx]&&NF.data[NF.rowIdx].streams[NF.colIdx]; if(nfs) toggleFav(nfs); return true; }
  return true;
});

KeyRouter.register('nf-sidebar', function(e, k) {
  if(typeof NF === 'undefined') return false;
  e.preventDefault();
  if(k===38){ NF.sbMove(-1); return true; }
  if(k===40){ NF.sbMove(1); return true; }
  if(k===39){ NF.closeSidebar(); return true; }
  if(k===13){ NF.sbSelect(); return true; }
  if(k===27 || k===KEYS.BACK || k===KEYS.BACK2){ NF.closeSidebar(); S._backConsumed=true; return true; }
  return true;
});

KeyRouter.register('nav-tabs', function(e, k) {
  var isPE = !$('pe-modal').classList.contains('hidden');
  if(S.sysMenuOpen || isPE || !$('pe-manual-modal').classList.contains('hidden') || !$('profile-modal').classList.contains('hidden') || !$('confirm-modal').classList.contains('hidden') || !$('wizard-screen').classList.contains('hidden')) {
    return false;
  }
  e.preventDefault();
  if(k===KEYS.BLUE || k===66){ if(typeof openContextSearch === 'function') openContextSearch(); else if (typeof NFSearch !== 'undefined') NFSearch.open(); return true; }
  if(k===37){ navTabsMove(-1); return true; }
  if(k===39){ navTabsMove(1); return true; }
  if(k===40){ navTabsLeave(); return true; }
  if(k===13){ navTabsSelect(); return true; }
  return true;
});

KeyRouter.register('sidebar', function(e, k) {
  if (k === 37) { e.preventDefault(); if (!Settings.useSidebar) navTabsEnter(); return true; }
  if (k === 38 && !Settings.useSidebar) { var firstCat = document.getElementById('cat-1'); if (SpatialNav.focused === firstCat) { e.preventDefault(); navTabsEnter(); return true; } }
  if (k === 39) { e.preventDefault(); if(!S.filteredStreams || S.filteredStreams.length === 0){ return true; } S.focusArea='grid'; ensureCursorInView(); renderVirtualGrid(); SpatialNav.focusBySelector('#gwrap-'+S.cursors.grid) || SpatialNav.focusBySelector('.grid-item-wrap'); return true; }
  return false;
});

// ── TASTEN- & EINGABE-STEUERUNG ───────────────────────────────────
function handleBack(){
  if($('confirm-modal')&&!$('confirm-modal').classList.contains('hidden')){ closeConfirm(false); return; }
  if($('pe-manual-modal')&&!$('pe-manual-modal').classList.contains('hidden')){ closePEManualModal(); return; }
  if(!$('wizard-screen').classList.contains('hidden')) {
    if(S.wizardMode) {
      if($('wiz-step-1').classList.contains('active') && Profiles.list.length > 0){
          S.screen = 'profile';
          S.focusArea = 'profile_grid';
          updateFocus();
      }
    } else { Wizard.finishDetect(); }
    return;
  }
  if($('pe-modal')&&!$('pe-modal').classList.contains('hidden')){
    if(typeof _peHasChanges === 'function' && _peHasChanges()){
      showConfirm('Nicht gespeichert', 'Du hast Änderungen die nicht angewendet wurden. Trotzdem schließen?', 'Ja, schließen', function(yes){
        if(yes) closePEModal(false);
        else setTimeout(function(){ SpatialNav.focusBySelector('#pe-btn-apply'); }, 50);
      });
    } else { closePEModal(false); }
    return;
  }
  if($('profile-modal')&&!$('profile-modal').classList.contains('hidden')){ closeProfileModal(); return; }
  if(S.playerVisible){
    if(Player._subPanelOpen){ Player._closeSubPanel(true); return; }
    if(Player._audioPanelOpen){ Player._closeAudioPanel(true); return; }
    if(S.variantBarOpen){ closeVariantBar(); return; }
    if(S.chListCatView){ chListCatViewClose(); return; }
    if(S.chListOpen){ Player.toggleChList(); return; }
    if(S.epgOpen){ Player.toggleEpg(); return; }
  }
  if(S.focusArea==='nf-search'){ NFSearch.close(); return; }
  if(S.focusArea==='live-search'){ LiveSearch.close(); return; }
  if(S.focusArea==='nf-sidebar'){ NF.closeSidebar(); return; }
  if(S.screen === 'settings'){ closeSettings(); return; }
  if(S.focusArea==='nav-tabs' || S.sysMenuOpen){
    if(S.playerVisible && S.playerType === 'live') {
       closeSysSidebar();
       if(typeof NF !== 'undefined' && NF.leave) NF.leave();
       S.screen = 'live'; S.tab = 'live';
       return;
    }
    closeSysSidebar(); return;
  }
  if(S.playerVisible){
    if(S.playerType === 'live') { openSysSidebar(); return; } 
    else { 
      var topbar = document.getElementById('player-topbar');
      var ctrlVod = document.getElementById('ctrl-vod');
      if ((topbar && !topbar.classList.contains('fade')) || (ctrlVod && !ctrlVod.classList.contains('fade'))) {
        if (topbar) topbar.classList.add('fade');
        if (ctrlVod) ctrlVod.classList.add('fade');
        if (typeof clearFocus === 'function') clearFocus();
        clearTimeout(S.controlsTimer);
        return;
      }
      Player.close(); return; 
    }
  }
  if(S.seriesDetailOpen){ closeSeries(); return; }
  if(S.focusArea==='netflix' || S.focusArea==='nf-sidebar' || S.focusArea==='grid' || S.focusArea==='sidebar' || S.focusArea==='continue' || S.focusArea==='series_ep' || S.focusArea==='series_season' || S.screen === 'main' || S.screen === 'continue'){
    openSysSidebar(); return;
  }
  if(S.screen==='live'||S.screen==='profile'){
    if(S.exitConfirm){
      clearTimeout(S.exitTimer);
      if(window.webOS&&webOS.platformBack) webOS.platformBack();
      else window.close();
    } else {
      S.exitConfirm=true;
      showToast('Nochmal BACK zum Beenden', CONFIG.EXIT_CONFIRM_MS);
      clearTimeout(S.exitTimer);
      S.exitTimer=setTimeout(function(){ S.exitConfirm=false; }, CONFIG.EXIT_CONFIRM_MS);
    }
    return;
  }
}

document.addEventListener('keyup', function(e) {
  var k = e.keyCode;
  if(k === 37 || k === 39) { if(typeof _seek !== 'undefined') _seek.holdStart = Date.now(); }
  if(k === KEYS.BACK || k === KEYS.BACK2) {
    if(S._backConsumed){ S._backConsumed = false; e.preventDefault(); return; }
    var tag = document.activeElement ? document.activeElement.tagName : '';
    if(tag === 'INPUT' || tag === 'SELECT') {
      document.activeElement.blur(); document.body.focus();
      if(S.focusArea === 'nf-search' && typeof NFSearch !== 'undefined') { NFSearch.close(); return; }
      if(S.focusArea === 'live-search' && typeof LiveSearch !== 'undefined') { LiveSearch.close(); return; }
      return;
    }
    e.preventDefault();
    handleBack();
  }
});

window.addEventListener('keydown', function(e) {
  var tag = e.target && e.target.tagName;
  var k = e.keyCode;

  if(tag === 'SELECT' && k === 13) return;
  if(tag === 'INPUT'){
    if(k === 39 && e.target.id === 'search-input'){
      var inp = e.target;
      if(inp.selectionStart === inp.value.length){
        var sw=$('sort-wrap'), lb=$('layout-btn');
        if(sw && !sw.classList.contains('hidden')){ e.preventDefault(); inp.blur(); SpatialNav.focusBySelector('#sort-btn'); return; } 
        else if(lb && lb.style.display !== 'none'){ e.preventDefault(); inp.blur(); SpatialNav.focus(lb); return; }
      }
    }
    if(k === 37 || k === 39 || k === 13) return;
  }

  if(k === KEYS.ESC || k === KEYS.BKSP){
    if(tag === 'INPUT') {
      if(k === KEYS.BKSP) return;
      e.target.blur(); document.body.focus(); 
      if(S.focusArea === 'nf-search' && typeof NFSearch !== 'undefined') { NFSearch.close(); return; }
      if(S.focusArea === 'live-search' && typeof LiveSearch !== 'undefined') { LiveSearch.close(); return; }
      return;
    }
    if(tag === 'SELECT') { e.target.blur(); document.body.focus(); return; }
    e.preventDefault(); handleBack(); return;
  }

  var isPE = !$('pe-modal').classList.contains('hidden');
  if(S.sysMenuOpen || isPE || !$('pe-manual-modal').classList.contains('hidden') || !$('profile-modal').classList.contains('hidden') || !$('confirm-modal').classList.contains('hidden') || !$('wizard-screen').classList.contains('hidden')) {
    var hasOverlay = !$('confirm-modal').classList.contains('hidden') || !$('profile-modal').classList.contains('hidden');
    if(S.focusArea==='nav-tabs' && !hasOverlay){ } 
    else if (S.focusArea==='sys-sidebar' && !hasOverlay) {
       e.preventDefault();
       if(k===38){ SpatialNav.move('up'); return; }
       if(k===40){ SpatialNav.move('down'); return; }
       if(k===39){ closeSysSidebar(); return; }
       if(k===27 || k===KEYS.BACK || k===KEYS.BACK2){ S._backConsumed = true; closeSysSidebar(); return; }
       if(k===13){ SpatialNav.select(); return; }
       return;
    } else {
      e.preventDefault();
      if(k===38){ SpatialNav.move('up'); return; }
      if(k===40){ SpatialNav.move('down'); return; }
      if(k===37){ SpatialNav.move('left'); return; }
      if(k===39){
         var oldFocusedR = SpatialNav.focused; SpatialNav.move('right');
         if(oldFocusedR === SpatialNav.focused && S.sysMenuOpen) { closeSysSidebar(); }
         return;
      }
      if(k===13){ SpatialNav.select(); return; }
      return;
    }
  }

  if(S.playerVisible && Player._subPanelOpen){ e.preventDefault(); if(k===38){ SpatialNav.move('up'); return; } if(k===40){ SpatialNav.move('down'); return; } if(k===13){ SpatialNav.select(); return; } return; }
  if(S.playerVisible && Player._audioPanelOpen){ e.preventDefault(); if(k===38){ SpatialNav.move('up'); return; } if(k===40){ SpatialNav.move('down'); return; } if(k===13){ SpatialNav.select(); return; } return; }
  if(S.playerVisible && typeof EpgGrid !== 'undefined' && EpgGrid.open){ e.preventDefault(); if(k===38){ EpgGrid.moveUp(); return; } if(k===40){ EpgGrid.moveDown(); return; } if(k===37){ EpgGrid.moveLeft(); return; } if(k===39){ EpgGrid.moveRight(); return; } if(k===13){ EpgGrid.select(); return; } if(k===KEYS.YELLOW||k===89||k===KEYS.BACK||k===KEYS.BACK2||k===KEYS.ESC){ EpgGrid.close(); return; } return; }
  if(S.playerVisible && S.epgOpen){ e.preventDefault(); if(k===38){ SpatialNav.move('up'); return; } if(k===40){ SpatialNav.move('down'); return; } if(k===13){ SpatialNav.select(); return; } if(k===KEYS.YELLOW||k===89||k===KEYS.BACK||k===KEYS.BACK2||k===27){ Player.toggleEpg(); return; } return; }
  if(S.playerVisible && S.chListOpen){
    if((k>=48&&k<=57)||(k>=96&&k<=105)){ e.preventDefault(); handleChSearchInList(k>=96?k-96:k-48); return; }
    if(S.chListCatView){ e.preventDefault(); if(k===KEYS.CH_UP){ chListCatViewMove(-5); return; } if(k===KEYS.CH_DOWN){ chListCatViewMove(5); return; } if(k===38){ chListCatViewMove(-1); return; } if(k===40){ chListCatViewMove(1); return; } if(k===13){ chListCatViewSelect(); return; } if(k===KEYS.GREEN||k===71){ chListCatViewClose(); return; } return; }
    if(Settings.splitList) {
        if(S.chListFocusArea === 'cats') { e.preventDefault(); if(k===KEYS.CH_UP){ chListCatSplitMove(-5); return; } if(k===KEYS.CH_DOWN){ chListCatSplitMove(5); return; } if(k===38){ chListCatSplitMove(-1); return; } if(k===40){ chListCatSplitMove(1); return; } if(k===39){ S.chListFocusArea = 'streams'; _updateSplitCatFocus(); return; } if(k===13){ chListCatSplitSelect(); return; } return; } 
        else { e.preventDefault(); if(k===KEYS.CH_UP){ chListMove(-VLIST_ROWS); return; } if(k===KEYS.CH_DOWN){ chListMove(VLIST_ROWS); return; } if(k===38){ chListMove(-1); return; } if(k===40){ chListMove(1); return; } if(k===37){ S.chListFocusArea = 'cats'; S.chListSplitCatCursor = S.chListCatIdx; _updateSplitCatFocus(); return; } if(k===13){ chListSelect(); return; } if(k===KEYS.YELLOW||k===89){ var sf=S.filteredStreams[S.chListCursor]; if(sf){ toggleFav(sf); renderChListOverlay(); } } return; }
    }
    e.preventDefault();
    if(k===KEYS.CH_UP){ chListMove(-VLIST_ROWS); return; } if(k===KEYS.CH_DOWN){ chListMove(VLIST_ROWS); return; } if(k===38){ chListMove(-1); return; } if(k===40){ chListMove(1); return; } if(k===37){ chListCatChange(-1); return; } if(k===39){ chListCatChange(1); return; } if(k===13){ chListSelect(); return; } if(k===KEYS.GREEN||k===71){ chListCatViewOpen(); return; } if(k===KEYS.YELLOW||k===89){ var sf2=S.filteredStreams[S.chListCursor]; if(sf2){ toggleFav(sf2); renderChListOverlay(); } return; }
    return;
  }

  if(S.playerVisible){
      if(S.focusArea==='nav-tabs' || S.focusArea==='nf-search' || S.focusArea==='live-search' || S.screen === 'settings'){ } 
      else {
      if(!S.sysMenuOpen && k!==KEYS.BACK && k!==KEYS.BACK2 && k!==KEYS.ESC && k!==KEYS.BKSP) Player.showControls();
      if(typeof ZapHistory !== 'undefined' && ZapHistory._osdOpen){ if(k===38){ e.preventDefault(); ZapHistory.moveUp(); return; } if(k===40){ e.preventDefault(); ZapHistory.moveDown(); return; } if(k===13){ e.preventDefault(); ZapHistory.select(); return; } if(k===KEYS.BACK||k===KEYS.BACK2||k===KEYS.ESC){ e.preventDefault(); ZapHistory.hideOsd(); return; } }
      if(typeof BingeMode !== 'undefined' && BingeMode._active){ if(k===37||k===39){ e.preventDefault(); var focused = SpatialNav.focused; if(!focused || focused.id==='binge-skip') SpatialNav.focusBySelector('#binge-stop'); else SpatialNav.focusBySelector('#binge-skip'); return; } if(k===13){ e.preventDefault(); var bf = SpatialNav.focused; if(bf && bf.id==='binge-stop') bingeStop(); else bingeSkipNow(); return; } if(k===KEYS.BACK||k===KEYS.BACK2){ e.preventDefault(); bingeStop(); return; } if(!SpatialNav.focused || (!SpatialNav.focused.closest('#binge-bar'))){ SpatialNav.focusBySelector('#binge-skip'); } }
      if(k===KEYS.PLAY||k===KEYS.PAUSE){ e.preventDefault(); Player.togglePP(); return; }
      if(k===412){ e.preventDefault(); if(S.playerType!=='live') progressiveSeek(-1); return; }
      if(k===417){ e.preventDefault(); if(S.playerType!=='live') progressiveSeek(1); return; }
      if(k===KEYS.RED||k===82){ e.preventDefault(); if(S.playerType==='live') Player.startLiveTimeshift(); else Player.close(); return; }
      if(k===KEYS.CH_UP){ e.preventDefault(); Player.nextCh(); return; }
      if(k===KEYS.CH_DOWN){ e.preventDefault(); Player.prevCh(); return; }
      if(k===13){ e.preventDefault(); if(typeof _seek !== 'undefined' && _seek.active) { commitSeek(); return; } if(S.playerType==='catchup'){ if(SpatialNav.focused && SpatialNav.focused.closest('#player-topbar')){ SpatialNav.select(); return; } Player.togglePP(); Player.showControls(); return; } if(SpatialNav.focused && SpatialNav.focused.closest('#player-topbar, #ctrl-vod')){ SpatialNav.select(); return; } if(S.epgOpen){ SpatialNav.select(); return; } if(S.variantBarOpen){ switchVariant(S.variantIdx); return; } if(S.playerType==='live' && (Date.now() - (typeof _catchupJustStarted !== 'undefined' ? _catchupJustStarted : 0)) > 400) Player.toggleChList(); else Player.togglePP(); return; }
      if(k===38){ e.preventDefault(); if(S.playerType!=='live'){ var foc = SpatialNav.focused; if(foc && (foc.id === 'btn-audio' || foc.id === 'btn-sub')) { SpatialNav.focusBySelector('#btn-pp-vod'); return; } if(foc && foc.id === 'btn-pp-vod') { var nextEp = document.getElementById('btn-next-ep'); var restart = document.getElementById('btn-restart-vod'); if(nextEp && !nextEp.classList.contains('hidden') && nextEp.offsetWidth > 0){ SpatialNav.focus(nextEp); return; } if(restart && !restart.classList.contains('hidden') && restart.offsetWidth > 0){ SpatialNav.focus(restart); return; } SpatialNav.focusBySelector('.p-back'); return; } SpatialNav.move('up'); return; } Player.nextCh(); return; }
      if(k===40){ e.preventDefault(); if(S.playerType!=='live'){ var foc2 = SpatialNav.focused; if(foc2 && foc2.closest('#player-topbar')) { SpatialNav.focusBySelector('#btn-pp-vod'); return; } if(foc2 && foc2.id === 'btn-pp-vod') { var btnAudio = document.getElementById('btn-audio'); var btnSub = document.getElementById('btn-sub'); if(btnAudio && !btnAudio.classList.contains('hidden') && btnAudio.offsetWidth > 0) { SpatialNav.focus(btnAudio); return; } if(btnSub && !btnSub.classList.contains('hidden') && btnSub.offsetWidth > 0) { SpatialNav.focus(btnSub); return; } } SpatialNav.move('down'); return; } Player.prevCh(); return; }
      if(k===37){ e.preventDefault(); if(S.playerType!=='live'){ var foc3 = SpatialNav.focused; if(foc3 && (foc3.closest('#player-topbar') || (foc3.closest('#ctrl-vod') && foc3.id !== 'btn-pp-vod'))){ SpatialNav.move('left'); return; } if(foc3 && foc3.id === 'btn-audio') { SpatialNav.focusBySelector('#btn-sub'); return; } if(foc3 && foc3.id === 'btn-sub') { return; } progressiveSeek(-1); return; } if(S.variantBarOpen){ S.variantIdx=Math.max(0,S.variantIdx-1); renderVariantChips(); resetVariantTimer(); } else openVariantBar(); return; }
      if(k===39){ e.preventDefault(); if(S.playerType!=='live'){ var foc4 = SpatialNav.focused; if(foc4 && (foc4.closest('#player-topbar') || (foc4.closest('#ctrl-vod') && foc4.id !== 'btn-pp-vod'))){ SpatialNav.move('right'); return; } if(foc4 && foc4.id === 'btn-sub') { var btnAudio2 = document.getElementById('btn-audio'); if(btnAudio2 && !btnAudio2.classList.contains('hidden') && btnAudio2.offsetWidth > 0) { SpatialNav.focus(btnAudio2); return; } return; } if(foc4 && foc4.id === 'btn-audio') { return; } progressiveSeek(1); return; } if(S.variantBarOpen){ S.variantIdx=Math.min(S.variants.length-1,S.variantIdx+1); renderVariantChips(); resetVariantTimer(); } else openVariantBar(); return; }
      if(k===KEYS.YELLOW||k===89){ e.preventDefault(); if(S.playerType==='live') Player.toggleEpg(); return; }
      if(k===KEYS.GREEN||k===71){ e.preventDefault(); Player.toggleSubtitles(); return; }
      if(k===KEYS.BLUE||k===66){ e.preventDefault(); if(typeof openContextSearch === 'function') openContextSearch(); else if (typeof NFSearch !== 'undefined') NFSearch.open(); return; }
      if(k===48||k===96){ e.preventDefault(); if(typeof ZapHistory !== 'undefined') ZapHistory.goBack(); return; }
      if((k>=49&&k<=57)||(k>=97&&k<=105)){ e.preventDefault(); handleChNum(k>=96?k-96:k-48); return; }
      return;
      }
  }

  // Delegierung an KeyRouter für modulare Komponenten
  if (KeyRouter.dispatch(e, k, tag)) return;

  if(S.focusArea==='grid' && !S.seriesDetailOpen){
    e.preventDefault();
    var total = S.filteredStreams.length; var cols = typeof getGridCols !== 'undefined' ? getGridCols() : 5; var cur = S.cursors.grid; var row = Math.floor(cur / cols); var col = cur % cols; var maxRow = Math.floor((total - 1) / cols);
    if(k===39){ if(cur + 1 < total){ S.cursors.grid = cur + 1; } ensureCursorInView(); renderVirtualGrid(); SpatialNav.focusBySelector('#gwrap-'+S.cursors.grid); return; }
    if(k===37){ if(col > 0 && cur > 0){ S.cursors.grid = cur - 1; ensureCursorInView(); renderVirtualGrid(); SpatialNav.focusBySelector('#gwrap-'+S.cursors.grid); } else { S.focusArea='sidebar'; setTimeout(function(){ SpatialNav.focusBySelector('.cat-item.active') || SpatialNav.focusBySelector('.cat-item'); }, 50); } return; }
    if(k===40){ var next = cur + cols; if(next < total){ S.cursors.grid = next; } else if(row < maxRow){ S.cursors.grid = total - 1; } ensureCursorInView(); renderVirtualGrid(); SpatialNav.focusBySelector('#gwrap-'+S.cursors.grid); return; }
    if(k===38){ var prev = cur - cols; if(prev >= 0){ S.cursors.grid = prev; ensureCursorInView(); renderVirtualGrid(); SpatialNav.focusBySelector('#gwrap-'+S.cursors.grid); } else { var lb2=$('layout-btn'); var sw2=$('sort-wrap'); var hasLayout = lb2 && lb2.style.display !== 'none'; var sortVisible2 = sw2 && !sw2.classList.contains('hidden'); var halfCols = Math.floor(cols/2); if(hasLayout && col >= cols-1){ SpatialNav.focus(lb2); } else if(sortVisible2 && col >= halfCols){ SpatialNav.focusBySelector('#sort-btn'); } else { SpatialNav.focusBySelector('#search-input'); } } return; }
    if(k===13){ SpatialNav.select(); return; }
  }

  if(SpatialNav.focused && SpatialNav.focused.id === 'search-input'){
    if(k===40){ e.preventDefault(); S.focusArea='grid'; ensureCursorInView(); renderVirtualGrid(); SpatialNav.focusBySelector('#gwrap-'+S.cursors.grid) || SpatialNav.focusBySelector('.grid-item-wrap'); return; }
    if(k===37){ e.preventDefault(); S.focusArea='sidebar'; setTimeout(function(){ SpatialNav.focusBySelector('.cat-item.active') || SpatialNav.focusBySelector('.cat-item'); },0); return; }
    if(k===39){ e.preventDefault(); var sw=$('sort-wrap'); var lb3=$('layout-btn'); if(sw && !sw.classList.contains('hidden')){ SpatialNav.focusBySelector('#sort-btn'); } else if(lb3 && lb3.style.display!=='none'){ SpatialNav.focus(lb3); } return; }
    if(k===38){ if(!Settings.useSidebar) navTabsEnter(); e.preventDefault(); return; }
    if(k===13) return;
  }

  if(SpatialNav.focused && SpatialNav.focused.id === 'sort-btn'){
    e.preventDefault();
    if(k===37){ SpatialNav.focusBySelector('#search-input'); return; }
    if(k===39){ var lb=$('layout-btn'); if(lb && lb.style.display !== 'none'){ SpatialNav.focus(lb); return; } return; }
    if(k===40){ if(typeof _sortMenuOpen !== 'undefined' && _sortMenuOpen){ toggleSortMenu(); } S.focusArea='grid'; ensureCursorInView(); renderVirtualGrid(); SpatialNav.focusBySelector('#gwrap-'+S.cursors.grid) || SpatialNav.focusBySelector('.grid-item-wrap'); return; }
    if(k===38){ if(!Settings.useSidebar) navTabsEnter(); return; }
    if(k===13){ SpatialNav.select(); return; }
    return;
  }
  if(SpatialNav.focused && SpatialNav.focused.id === 'layout-btn'){
    e.preventDefault();
    if(k===37){ var sw3=$('sort-wrap'); if(sw3 && !sw3.classList.contains('hidden')){ SpatialNav.focusBySelector('#sort-btn'); return; } SpatialNav.focusBySelector('#search-input'); return; }
    if(k===39){ return; }
    if(k===40){ S.focusArea='grid'; ensureCursorInView(); renderVirtualGrid(); SpatialNav.focusBySelector('#gwrap-'+S.cursors.grid) || SpatialNav.focusBySelector('.grid-item-wrap'); return; }
    if(k===38){ if(!Settings.useSidebar) navTabsEnter(); return; }
    if(k===13){ SpatialNav.select(); return; }
    return;
  }
  if(SpatialNav.focused && SpatialNav.focused.classList.contains('sort-opt')){ e.preventDefault(); if(k===38){ SpatialNav.move('up'); return; } if(k===40){ SpatialNav.move('down'); return; } if(k===13){ SpatialNav.select(); return; } return; }

  if(S.seriesDetailOpen){
    e.preventDefault();
    if(S.focusArea==='series_season'){
      if(k===38){ if(S.cursors.season > 0){ S.cursors.season--; selectSeason(S.cursors.season); SpatialNav.focusBySelector('#ss-'+S.cursors.season); } else { if(!Settings.useSidebar) navTabsEnter(); } return; }
      if(k===40){ if(S.cursors.season < S.seriesSeasonsArr.length - 1){ S.cursors.season++; selectSeason(S.cursors.season); SpatialNav.focusBySelector('#ss-'+S.cursors.season); } return; }
      if(k===39 || k===13){ S.focusArea='series_ep'; SpatialNav.focusBySelector('#ep-0'); return; }
      if(k===37){ SpatialNav.focusBySelector('.s-back'); return; }
    }
    if(S.focusArea==='series_ep'){
      if(k===40){ if(S.cursors.ep < S.currentEpsArray.length - 1){ S.cursors.ep++; SpatialNav.focusBySelector('#ep-'+S.cursors.ep); } return; }
      if(k===38){ if(S.cursors.ep > 0){ S.cursors.ep--; SpatialNav.focusBySelector('#ep-'+S.cursors.ep); } else { if(!Settings.useSidebar) navTabsEnter(); } return; }
      if(k===37){ S.focusArea='series_season'; SpatialNav.focusBySelector('#ss-'+S.cursors.season) || SpatialNav.focusBySelector('.sbtn.active'); return; }
      if(k===13){ playEpisode(S.cursors.ep); return; }
      return;
    }
    if(SpatialNav.focused && SpatialNav.focused.classList.contains('s-back')){
        if(k===39){ S.focusArea='series_season'; var fSea = document.getElementById('ss-0'); if(fSea) SpatialNav.focus(fSea); else SpatialNav.focusBySelector('.sbtn.active') || SpatialNav.focusBySelector('.sbtn'); return; }
        if(k===40){ S.focusArea='series_season'; SpatialNav.focusBySelector('.sbtn.active') || SpatialNav.focusBySelector('.sbtn'); return; }
        if(k===38){ if(!Settings.useSidebar) navTabsEnter(); return; }
    }
    return;
  }

  e.preventDefault();
  if(k===38) { var prevFoc = SpatialNav.focused; SpatialNav.move('up'); if(prevFoc === SpatialNav.focused && (!S.playerVisible || S.screen === 'settings') && !Settings.useSidebar && !document.getElementById('navbar').classList.contains('hidden')){ navTabsEnter(); } }
  else if(k===40) SpatialNav.move('down');
  else if(k===37) SpatialNav.move('left');
  else if(k===39) SpatialNav.move('right');
  else if(k===13) SpatialNav.select();

}, true);

var _wheelWarmed=true, _wheelIdleT=null;
document.addEventListener('wheel', function(e){
  var t=e.target;
  if(t.closest&&t.closest('#ch-list-overlay,#epg-panel,#settings-screen,#pe-modal,#pe-manual-modal,#profile-modal,#navbar,#confirm-modal,#sub-panel,#audio-panel,#continue-screen,#wizard-screen,#episode-list')) return;
  if(!S.playerVisible) return;
  e.preventDefault();
  if(S.settingsOpen || S.sysMenuOpen || Player._subPanelOpen || Player._audioPanelOpen || !$('pe-modal').classList.contains('hidden') || !$('profile-modal').classList.contains('hidden') || !$('confirm-modal').classList.contains('hidden')) { return; }
  if(S.epgOpen){ var body=$('epg-body'); if(body){ body.scrollTop+=e.deltaY>0?120:-120; } return; }
  if(S.chListOpen){ if(e.deltaY<0) chListMove(-1); else if(e.deltaY>0) chListMove(1); return; }
  clearTimeout(_wheelIdleT);
  _wheelIdleT=setTimeout(function(){ _wheelWarmed=false; }, CONFIG.WHEEL_IDLE_MS);
  if(!_wheelWarmed){ _wheelWarmed=true; return; }
  if(e.deltaY<0) Player.nextCh();
  else if(e.deltaY>0) Player.prevCh();
},{passive:false});