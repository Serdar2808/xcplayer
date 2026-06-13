// ═══════════════════════════════════════════════════════════════
// NF SUCH-OVERLAY mit Pfeiltasten-Navigation
// ═══════════════════════════════════════════════════════════════
var NFSearch = {
  results: [],
  focusedIdx: 0,
  mode: 'input',  // 'input' | 'results'
  cols: 5,        // wird dynamisch berechnet
  _timer: null,
  _searchId: 0,

  open: function(){
    var ov=$('nf-search-overlay'), inp=$('search-input-nf');
    if(!ov||!inp) return;
    if(typeof NF !== 'undefined' && NF.stopTrailer) NF.stopTrailer();
    if(!S.prevFocusForSearch) S.prevFocusForSearch = S.focusArea;
    ov.classList.remove('hidden');
    inp.value='';
    inp.classList.add('nfs-active');
    NFSearch.results=[];
    NFSearch.focusedIdx=0;
    NFSearch.mode='input';
    NFSearch._renderResults('');
    S.focusArea='nf-search';
    setTimeout(function(){ inp.focus(); }, 50);
  },

  close: function(){
    var ov=$('nf-search-overlay'), inp=$('search-input-nf');
    if(ov) ov.classList.add('hidden');
    if(inp){ inp.blur(); inp.classList.remove('nfs-active'); }
    NFSearch.mode='input';
    // Zurück in den richtigen Zustand abhängig vom aktuellen Bildschirm
    if(S.prevFocusForSearch === 'nav-tabs' || S.prevFocusForSearch === 'sys-sidebar' || S.prevFocusForSearch === 'topbar'){
      if (typeof Settings !== 'undefined' && Settings.useSidebar) {
         if(typeof openSysSidebar === 'function') openSysSidebar();
         setTimeout(function(){ if(typeof SpatialNav !== 'undefined') SpatialNav.focusBySelector('#sys-search'); }, 50);
      } else {
         if(typeof navTabsEnter === 'function') navTabsEnter();
         setTimeout(function(){ if(typeof SpatialNav !== 'undefined') SpatialNav.focusBySelector('#nav-tab-search'); }, 50);
      }
    } else if(S.prevFocusForSearch === 'grid'){
      S.focusArea = 'grid';
      if(typeof updateFocus === 'function') updateFocus();
    } else if(document.body.classList.contains('nf-active')){
      S.focusArea='netflix';
    } else if(S.screen === 'settings'){
      S.focusArea='settings';
      if(typeof SpatialNav !== 'undefined') SpatialNav.focusFirst();
    } else if(S.screen === 'continue'){
      S.focusArea='continue';
    } else if(S.playerVisible){
      S.focusArea='player';
    } else {
      // Fallback: zurück zur Topbar damit der User nicht festsitzt
      navTabsEnter();
    }
    S.prevFocusForSearch = null;
  },

  _renderResults: async function(q){
    var box=$('nf-search-results'); if(!box) return;
    NFSearch._searchId++;
    var currentSearchId = NFSearch._searchId;
    if(!q || q.length<2){
      box.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--mid);padding:40px;">Mindestens 2 Zeichen eingeben</div>';
      NFSearch.results=[];
      return;
    }
    var hits=[];
    var streamsProcessed = 0;
    for(var i=0;i<NF.fullData.length && hits.length<60;i++){
      var row=NF.fullData[i];
      for(var k=0;k<row.streams.length && hits.length<60;k++){
        var s=row.streams[k];
        if(((s.name||s.title||'')+'').toLowerCase().indexOf(q)!==-1) hits.push(s);
        
        if (++streamsProcessed % 1000 === 0) {
          await new Promise(function(resolve) { setTimeout(resolve, 0); });
          if (NFSearch._searchId !== currentSearchId) return; // Neue Suche gestartet, diese abbrechen
        }
      }
    }
    
    if (NFSearch._searchId !== currentSearchId) return;

    NFSearch.results=hits;
    if(!hits.length){
      box.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--mid);padding:40px;">Keine Treffer</div>';
      return;
    }
    var html='';
    for(var j=0;j<hits.length;j++){
      var s=hits[j], cover=s.stream_icon||s.cover||'';
      html+='<div class="nfs-card" data-idx="'+j+'">'
        +(cover?'<img loading="lazy" decoding="async" src="'+esc(cover)+'" onerror="this.style.display=\'none\'">':'<div style="height:270px;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:50px">🎬</div>')
        +'<div class="nfs-card-name">'+esc(s.name||s.title||'')+'</div></div>';
    }
    box.innerHTML=html;
    box.onclick=function(e){
      var c=e.target.closest('.nfs-card'); if(!c) return;
      var idx=parseInt(c.dataset.idx);
      NFSearch.focusedIdx=idx;
      NFSearch.select();
    };
  },

  // Spalten-Anzahl aus dem aktuellen Layout berechnen
  _calcCols: function(){
    var box=$('nf-search-results'); if(!box) return 5;
    var firstCard=box.querySelector('.nfs-card'); if(!firstCard) return 5;
    var boxW = box.clientWidth;
    var cardW = firstCard.offsetWidth + 14; // gap
    var c = Math.max(1, Math.floor(boxW / cardW));
    return c;
  },

  toResults: function(){
    if(!NFSearch.results.length) return;
    var inp=$('search-input-nf');
    if(inp){ inp.blur(); inp.classList.remove('nfs-active'); }
    NFSearch.mode='results';
    NFSearch.focusedIdx=0;
    NFSearch.cols = NFSearch._calcCols();
    NFSearch._updateFocus();
  },

  toInput: function(){
    var inp=$('search-input-nf');
    NFSearch.mode='input';
    document.querySelectorAll('.nfs-card.nfs-focused').forEach(function(el){ el.classList.remove('nfs-focused'); });
    if(inp){ inp.focus(); inp.classList.add('nfs-active'); }
  },

  move: function(delta){
    var newIdx = NFSearch.focusedIdx + delta;
    if(newIdx < 0 || newIdx >= NFSearch.results.length) return;
    NFSearch.focusedIdx = newIdx;
    NFSearch._updateFocus();
  },

  _updateFocus: function(){
    document.querySelectorAll('.nfs-card.nfs-focused').forEach(function(el){ el.classList.remove('nfs-focused'); });
    var box=$('nf-search-results'); if(!box) return;
    var card=box.querySelector('.nfs-card[data-idx="'+NFSearch.focusedIdx+'"]');
    if(card){
      card.classList.add('nfs-focused');
      // In View scrollen
      var cb = card.getBoundingClientRect(), bb = box.getBoundingClientRect();
      if(cb.top < bb.top) box.scrollTop += (cb.top - bb.top) - 10;
      else if(cb.bottom > bb.bottom) box.scrollTop += (cb.bottom - bb.bottom) + 10;
    }
  },

  select: function(){
    var s = NFSearch.results[NFSearch.focusedIdx]; if(!s) return;
    NFSearch.close();
    if(S.tab==='series') openSeries(s);
    else { S.currentStreamIdx = NFSearch.focusedIdx; Player.play(API.streamUrl(s), s, S.tab); }
  },

  init: function(){
    var inp=$('search-input-nf'); if(!inp) return;
    inp.addEventListener('input', function(){
      clearTimeout(NFSearch._timer);
      var q=inp.value.toLowerCase().trim();
      NFSearch._timer=setTimeout(function(){
        NFSearch._renderResults(q);
      }, 250);
    });
  }
};
if(document.readyState!=='loading') NFSearch.init();
else document.addEventListener('DOMContentLoaded', NFSearch.init);

// ═══════════════════════════════════════════════════════════════
// LIVE-SENDER-SUCHE (Overlay über Live-TV-Player)
// ═══════════════════════════════════════════════════════════════
var LiveSearch = {
  results: [],
  focusedIdx: 0,
  mode: 'input',
  cols: 5,
  _timer: null,
  _searchId: 0,

  open: function(){
    var ov=$('live-search-overlay'), inp=$('search-input-live');
    if(!ov||!inp) return;
    if(typeof NF !== 'undefined' && NF.stopTrailer) NF.stopTrailer();
    if(!S.prevFocusForSearch) S.prevFocusForSearch = S.focusArea;
    ov.classList.remove('hidden');
    inp.value='';
    inp.classList.add('nfs-active');
    LiveSearch.results=[];
    LiveSearch.focusedIdx=0;
    LiveSearch.mode='input';
    LiveSearch._renderResults('');
    S.focusArea='live-search';
    setTimeout(function(){ inp.focus(); }, 50);
  },

  close: function(){
    var ov=$('live-search-overlay'), inp=$('search-input-live');
    if(ov) ov.classList.add('hidden');
    if(inp){ inp.blur(); inp.classList.remove('nfs-active'); }
    LiveSearch.mode='input';
    // Zurück in den vorigen Modus
    if(S.prevFocusForSearch === 'nav-tabs' || S.prevFocusForSearch === 'sys-sidebar' || S.prevFocusForSearch === 'topbar'){
      if (typeof Settings !== 'undefined' && Settings.useSidebar) {
         if(typeof openSysSidebar === 'function') openSysSidebar();
         setTimeout(function(){ if(typeof SpatialNav !== 'undefined') SpatialNav.focusBySelector('#sys-search'); }, 50);
      } else {
         if(typeof navTabsEnter === 'function') navTabsEnter();
         setTimeout(function(){ if(typeof SpatialNav !== 'undefined') SpatialNav.focusBySelector('#nav-tab-search'); }, 50);
      }
    } else if(S.prevFocusForSearch === 'grid'){
      S.focusArea = 'grid';
      if(typeof updateFocus === 'function') updateFocus();
    } else if(S.playerVisible){
      S.focusArea='player';
      if(typeof Player !== 'undefined') Player.showControls();
    } else if(document.body.classList.contains('nf-active')){
      S.focusArea='netflix';
    } else {
      S.focusArea='grid';
      if(typeof updateFocus === 'function') updateFocus();
    }
    S.prevFocusForSearch = null;
  },

  _getAllLiveStreams: function(){
    // Bevorzugt fullStreams.live; Fallback S.streams (aktuelle Auswahl)
    if(S.fullStreams && S.fullStreams.live && S.fullStreams.live.length) return S.fullStreams.live;
    return S.streams || [];
  },

  _renderResults: async function(q){
    var box=$('live-search-results'); if(!box) return;
    LiveSearch._searchId++;
    var currentSearchId = LiveSearch._searchId;

    if(!q || q.length<2){
      box.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--mid);padding:40px;">Mindestens 2 Zeichen eingeben</div>';
      LiveSearch.results=[];
      return;
    }
    var hits=[];
    var all = LiveSearch._getAllLiveStreams();
    for(var i=0;i<all.length && hits.length<80;i++){
      var s=all[i];
      if(((s.name||s.title||'')+'').toLowerCase().indexOf(q)!==-1) hits.push(s);
      
      if (i > 0 && i % 1000 === 0) {
        await new Promise(function(resolve) { setTimeout(resolve, 0); });
        if (LiveSearch._searchId !== currentSearchId) return; // Neue Suche gestartet, diese abbrechen
      }
    }
    
    if (LiveSearch._searchId !== currentSearchId) return;

    LiveSearch.results=hits;
    if(!hits.length){
      box.innerHTML='<div style="grid-column:1/-1;text-align:center;color:var(--mid);padding:40px;">Keine Sender gefunden</div>';
      return;
    }
    var html='';
    for(var j=0;j<hits.length;j++){
      var s=hits[j], icon=s.stream_icon||'';
      html+='<div class="nfs-card lvs-card" data-idx="'+j+'">'
        + (icon
            ? '<img loading="lazy" decoding="async" src="'+esc(icon)+'" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'" style="height:140px;object-fit:contain;background:rgba(255,255,255,.04);padding:18px"><div class="lvs-ph" style="display:none;height:140px;background:var(--bg2);align-items:center;justify-content:center;font-size:50px">📡</div>'
            : '<div style="height:140px;background:var(--bg2);display:flex;align-items:center;justify-content:center;font-size:50px">📡</div>')
        + '<div class="nfs-card-name">'+esc(s.name||s.title||'')+'</div></div>';
    }
    box.innerHTML=html;
    box.onclick=function(e){
      var c=e.target.closest('.nfs-card'); if(!c) return;
      var idx=parseInt(c.dataset.idx);
      LiveSearch.focusedIdx=idx;
      LiveSearch.select();
    };
  },

  _calcCols: function(){
    var box=$('live-search-results'); if(!box) return 5;
    var first=box.querySelector('.nfs-card'); if(!first) return 5;
    var w = box.clientWidth, cw = first.offsetWidth + 14;
    return Math.max(1, Math.floor(w / cw));
  },

  toResults: function(){
    if(!LiveSearch.results.length) return;
    var inp=$('search-input-live');
    if(inp){ inp.blur(); inp.classList.remove('nfs-active'); }
    LiveSearch.mode='results';
    LiveSearch.focusedIdx=0;
    LiveSearch.cols = LiveSearch._calcCols();
    LiveSearch._updateFocus();
  },

  toInput: function(){
    var inp=$('search-input-live');
    LiveSearch.mode='input';
    document.querySelectorAll('#live-search-results .nfs-card.nfs-focused').forEach(function(el){ el.classList.remove('nfs-focused'); });
    if(inp){ inp.focus(); inp.classList.add('nfs-active'); }
  },

  move: function(delta){
    var n = LiveSearch.focusedIdx + delta;
    if(n < 0 || n >= LiveSearch.results.length) return;
    LiveSearch.focusedIdx = n;
    LiveSearch._updateFocus();
  },

  _updateFocus: function(){
    document.querySelectorAll('#live-search-results .nfs-card.nfs-focused').forEach(function(el){ el.classList.remove('nfs-focused'); });
    var box=$('live-search-results'); if(!box) return;
    var card=box.querySelector('.nfs-card[data-idx="'+LiveSearch.focusedIdx+'"]');
    if(card){
      card.classList.add('nfs-focused');
      var cb = card.getBoundingClientRect(), bb = box.getBoundingClientRect();
      if(cb.top < bb.top) box.scrollTop += (cb.top - bb.top) - 10;
      else if(cb.bottom > bb.bottom) box.scrollTop += (cb.bottom - bb.bottom) + 10;
    }
  },

  select: function(){
    var s = LiveSearch.results[LiveSearch.focusedIdx]; if(!s) return;
    LiveSearch.close();
    // Sender umschalten
    if(typeof Player !== 'undefined' && typeof API !== 'undefined'){
      // Index in S.streams finden, falls vorhanden
      if(S.streams && S.streams.length){
        for(var i=0;i<S.streams.length;i++){
          if(S.streams[i].stream_id === s.stream_id){ S.currentStreamIdx = i; break; }
        }
      }
      Player.play(API.liveUrl(s), s, 'live');
    }
  },

  init: function(){
    var inp=$('search-input-live'); if(!inp) return;
    inp.addEventListener('input', function(){
      clearTimeout(LiveSearch._timer);
      var q=inp.value.toLowerCase().trim();
      LiveSearch._timer=setTimeout(function(){
        LiveSearch._renderResults(q);
      }, 250);
    });
  }
};
if(document.readyState!=='loading') LiveSearch.init();
else document.addEventListener('DOMContentLoaded', LiveSearch.init);