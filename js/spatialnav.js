// ── SPATIAL NAVIGATION ────────────────────────────────────────────
// Navigiert anhand von Bildschirmkoordinaten (getBoundingClientRect), wie die Referenz-App.
var SpatialNav = {
  focused: null,

  getFocusables: function() {
    var all = document.querySelectorAll('[data-focusable]');
    var res = [];
    var isSettings = (S.screen === 'settings');
    var isPE = !$('pe-modal').classList.contains('hidden');
    var isProf = !$('profile-modal').classList.contains('hidden');
    var isConfirm = !$('confirm-modal').classList.contains('hidden');
    var isWizard = S.screen === 'wizard';
    var isPEManual = !$('pe-manual-modal').classList.contains('hidden');
    var isSysMenu = S.sysMenuOpen;
    
    for(var i=0; i<all.length; i++){
      var el = all[i];
      
      if (isConfirm) { if(!el.closest('#confirm-modal')) continue; }
      else if (isProf) { if(!el.closest('#profile-modal')) continue; }
      else if (isWizard) { if(!el.closest('#wizard-screen')) continue; }
      else if (isPEManual) { if(!el.closest('#pe-manual-modal')) continue; }
      else if (isPE) { if(!el.closest('#pe-modal')) continue; }
      else if (isSysMenu) { if(!el.closest('#sys-sidebar')) continue; }
      else if (isSettings) { if(!el.closest('#settings-screen')) continue; }
      else {
        if(el.closest('#settings-screen, #profile-modal, #pe-modal, #confirm-modal')) continue;
        if(S.playerVisible) {
          if(Player._subPanelOpen) { if(!el.closest('#sub-panel')) continue; }
          else if(Player._audioPanelOpen) { if(!el.closest('#audio-panel')) continue; }
          else if(S.chListOpen) { if(!el.closest('#ch-list-overlay')) continue; }
          else if(S.epgOpen) { if(!el.closest('#epg-panel')) continue; }
          else if(S.variantBarOpen) { if(!el.closest('#variant-bar')) continue; }
          else { if(!el.closest('#player-screen, #binge-bar, #player-topbar, #ctrl-vod, #live-osd')) continue; }
        } else {
          if(el.closest('#player-screen, #player-topbar, #ctrl-vod, #live-osd, #ch-list-overlay, #epg-panel, #epg-grid-overlay, #variant-bar, #sub-panel, #audio-panel')) continue;
          if(S.seriesDetailOpen) { if(!el.closest('#series-detail')) continue; }
          else if(S.screen === 'main') { if(!el.closest('#main-screen')) continue; }
          else if(S.screen === 'continue') { if(!el.closest('#continue-screen')) continue; }
        }
      }
            
      var r = el.getBoundingClientRect();
      if(r.width > 0 && r.height > 0) {
        var subGroup = el.closest('.ios-sub-group');
        if(subGroup && !subGroup.classList.contains('expanded')) continue;
        res.push(el);
      }   
    }
    return res;
  },

  focus: function(el) {
    if(this.focused){
      var pc = this.focused.getAttribute('data-focus-class')||'focused';
      this.focused.classList.remove(pc, 'focused', 'card-focused', 'htile-focused');
    }
    this.focused = el;
    if(!el) return;
    
    var pv = el.getAttribute('data-preview');
    if(typeof setPreview === 'function') setPreview(pv);

    if(el.tagName === 'SELECT') {
      el.focus();
    } else if(el.tagName === 'INPUT') {
      if(document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) { document.activeElement.blur(); }
    } else if(document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'SELECT')) {
      document.activeElement.blur();
    }
    var fc = el.getAttribute('data-focus-class')||'focused';
    el.classList.add(fc);
    var scrollContainerSel = '#episode-list, #epg-body, #sub-list, #audio-list, #clo-list';
    var container = el.closest(scrollContainerSel);
    if(container){
      var elRect = el.getBoundingClientRect();
      var cRect  = container.getBoundingClientRect();
      var relTop = elRect.top - cRect.top + container.scrollTop;
      var relBot = relTop + el.offsetHeight + 12;
      var pt = parseInt(window.getComputedStyle(container).paddingTop) || 0;
      var pb = parseInt(window.getComputedStyle(container).paddingBottom) || 0;
      var cTop   = container.scrollTop + pt;
      var cBot   = container.scrollTop + container.clientHeight - pb;
      if(relTop < cTop) container.scrollTop = relTop - pt - 12;
      else if(relBot > cBot) container.scrollTop = relBot - container.clientHeight + pb + 12;
    } else { el.scrollIntoView({block:'nearest', inline:'nearest'}); }
    if(el.classList.contains('profile-card')||el.classList.contains('add-profile-btn')){ S.focusArea='profile_grid'; } 
    else if(el.classList.contains('sys-item')){ S.focusArea='sys-sidebar'; if(!S.sysMenuOpen && Settings.useSidebar) openSysSidebar(); } 
    else if(el.classList.contains('cat-item')){ S.focusArea='sidebar'; } 
    else if(el.classList.contains('grid-item-wrap')){ S.focusArea='grid'; S.cursors.grid=parseInt(el.getAttribute('data-idx')||0); } 
    else if(el.classList.contains('sbtn')){ S.focusArea='series_season'; S.cursors.season=parseInt(el.getAttribute('data-idx')||0); } 
    else if(el.classList.contains('ep-item')){ S.focusArea='series_ep'; S.cursors.ep=parseInt(el.getAttribute('data-idx')||0); } 
    else if(el.closest('#search-bar')){ S.focusArea='topbar'; } 
    else if(el.classList.contains('continue-tile') || el.id === 'cs-empty-back'){ S.focusArea='continue'; } 
    else if(el.closest('#settings-screen')){ S.focusArea='settings'; }
  },
  focusFirst: function() { var items = this.getFocusables(); if(items.length) this.focus(items[0]); },
  focusBySelector: function(sel) { var el = document.querySelector(sel); if(el) { this.focus(el); return true; } return false; },
  select: function() { if(this.focused) { if(this.focused.tagName === 'INPUT') { this.focused.focus(); } else if(this.focused.tagName !== 'SELECT') { var ev = document.createEvent('MouseEvents'); ev.initEvent('click', true, true); this.focused.dispatchEvent(ev); } } },
  move: function(dir) {
    var now = Date.now();
    if (this._lastMove && now - this._lastMove < 100) return; // Throttling: Max 10 Moves/Sekunde gegen D-Pad-Spam
    this._lastMove = now;
    var items = this.getFocusables(); if(!items.length) return;
    if(!this.focused){ this.focus(items[0]); return; }
    var inList = false; for(var ii=0; ii<items.length; ii++) if(items[ii]===this.focused){ inList=true; break; }
    if(!inList){ this.focus(items[0]); return; }
    var rect = this.focused.getBoundingClientRect(); var cx = rect.left + rect.width/2; var cy = rect.top + rect.height/2; var best=null, bestScore=Infinity;
    for(var i=0; i<items.length; i++){
      var item=items[i]; if(item===this.focused) continue;
      var r=item.getBoundingClientRect(); var ix=r.left+r.width/2, iy=r.top+r.height/2; var dx=ix-cx, dy=iy-cy; var valid=false, primary=0, secondary=0;
      if(dir==='up')   { valid = dy < 0 && Math.abs(dy) > Math.abs(dx)*0.5; primary=Math.abs(dy); secondary=Math.abs(dx); }
      if(dir==='down') { valid = dy > 0 && Math.abs(dy) > Math.abs(dx)*0.5; primary=Math.abs(dy); secondary=Math.abs(dx); }
      if(dir==='left') { valid = dx < 0 && Math.abs(dx) > Math.abs(dy)*0.5; primary=Math.abs(dx); secondary=Math.abs(dy); }
      if(dir==='right'){ valid = dx > 0 && Math.abs(dx) > Math.abs(dy)*0.5; primary=Math.abs(dx); secondary=Math.abs(dy); }
      if(!valid) continue; var score = primary + secondary*5; if(score<bestScore){ bestScore=score; best=item; }
    }
    if(best) { this.focus(best); }
  }
};
function clearFocus(){ if(SpatialNav.focused){ var pc=SpatialNav.focused.getAttribute('data-focus-class')||'focused'; SpatialNav.focused.classList.remove(pc,'focused','card-focused','htile-focused'); SpatialNav.focused=null; } }
function setFocus(el, cls){ SpatialNav.focus(el); }
function updateFocus(){ if(S.focusArea==='profile_grid'){ SpatialNav.focusFirst(); } else if(S.focusArea==='sidebar'){ setTimeout(function(){ SpatialNav.focusBySelector('.cat-item.active') || SpatialNav.focusBySelector('#cat-1') || SpatialNav.focusBySelector('.cat-item'); }, 50); } else if(S.focusArea==='continue'){ setTimeout(function(){ SpatialNav.focusBySelector('.continue-tile') || SpatialNav.focusFirst(); }, 50); } else if(S.focusArea==='grid'){ ensureCursorInView(); renderVirtualGrid(); setTimeout(function(){ SpatialNav.focusBySelector('#gwrap-'+S.cursors.grid) || SpatialNav.focusBySelector('.grid-item-wrap'); }, 50); } else if(S.focusArea==='series_season'){ setTimeout(function(){ SpatialNav.focusBySelector('.sbtn.active') || SpatialNav.focusBySelector('.sbtn'); }, 50); } else if(S.focusArea==='series_ep'){ setTimeout(function(){ SpatialNav.focusBySelector('#ep-'+S.cursors.ep) || SpatialNav.focusBySelector('.ep-item'); }, 50); } }