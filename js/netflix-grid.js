// ═══════════════════════════════════════════════════════════════
// NETFLIX VOD GRID — Flex+Spacer-Virtualisierung
// ═══════════════════════════════════════════════════════════════
// Kernidee: Karten sind Flex-Items (NICHT absolute), aber wir rendern
// nur ~8 Karten gleichzeitig. Links/rechts vom sichtbaren Window stehen
// Spacer-Divs mit der korrekten Breite, sodass das Track-Layout stimmt.
// Vorteil gegenüber absoluter Positionierung: Flex verschiebt automatisch
// alle Karten rechts der fokussierten Karte um deren Extra-Breite (482px).
var NF = {
  data:[], fullData:[], rowIdx:0, colIdx:0,
  CARD_W:300, CARD_H:440, CARD_W_FOCUSED:782, GAP:16,
  PADDING_LEFT:50,
  PEEK_OFFSET:115,
  WINDOW_SIZE:8,
  MAX_PER_ROW:50,
  sbOpen:false, sbCursor:0,
  _rowObs:null, _imgObs:null, _hydrated:{}, _rowPos:{},
  _rowState:{},
  
  _trailerTimer: null,
  _trailerReqId: 0,
  _tmdbApiKey: (typeof CONFIG !== 'undefined' && CONFIG.TMDB_API_KEY) ? CONFIG.TMDB_API_KEY : 'dca81f50afe01b235bb830c877611ee4',

  _ytPlayer: null,
  _ytPlayerReady: false,
  _ytPlayerInit: false,

  _initYtPlayer: function() {
    if (this._ytPlayerInit) return;
    this._ytPlayerInit = true;
    
    // Ein einziger, globaler Container für den Trailer (verhindert Decoder-Crashes)
    var container = document.createElement('div');
    container.id = 'nf-yt-container';
    container.style.cssText = 'position:fixed; z-index:50; pointer-events:none; opacity:0; border-radius:14px; overflow:hidden; transition: opacity 0.4s ease; background:#000;';
    document.body.appendChild(container);

    var playerDiv = document.createElement('div');
    playerDiv.id = 'nf-yt-player';
    container.appendChild(playerDiv);

    if (typeof YT === 'undefined' || typeof YT.Player === 'undefined') {
        var tag = document.createElement('script');
        tag.src = "https://www.youtube.com/iframe_api";
        var firstScriptTag = document.getElementsByTagName('script')[0];
        if(firstScriptTag && firstScriptTag.parentNode) firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);
        else document.head.appendChild(tag);

        window.onYouTubeIframeAPIReady = function() {
            NF._createYtInstance();
        };
    } else {
        NF._createYtInstance();
    }

    // Hook für das Hauptmenü, um den Trailer beim Öffnen der Leiste zu stoppen
    if (window.openSysSidebar && !window._nfSidebarHooked) {
      window._nfSidebarHooked = true;
      var origOpenSysSidebar = window.openSysSidebar;
      window.openSysSidebar = function() {
        if(typeof NF !== 'undefined' && NF.stopTrailer) NF.stopTrailer();
        return origOpenSysSidebar.apply(this, arguments);
      };
    }
  },

  _createYtInstance: function() {
    var origin = (window.location && window.location.protocol && window.location.protocol.indexOf('http') === 0) ? window.location.origin : 'http://localhost';
    NF._ytPlayer = new YT.Player('nf-yt-player', {
        height: '100%',
        width: '100%',
        playerVars: {
            'autoplay': 1,
            'mute': 1,
            'controls': 0,
            'disablekb': 1,
            'modestbranding': 1,
            'playsinline': 1,
            'origin': origin,
            'rel': 0,
            'showinfo': 0,
            'iv_load_policy': 3
        },
        events: {
            'onReady': function(event) {
                NF._ytPlayerReady = true;
                event.target.mute();
                var iframe = document.getElementById('nf-yt-player');
                // TV-Erlaubnis für lokales Autoplay setzen
                if(iframe) iframe.setAttribute('allow', 'autoplay; encrypted-media');
            },
            'onStateChange': function(event) {
                var cont = document.getElementById('nf-yt-container');
                if (event.data === YT.PlayerState.PLAYING) {
                    if(cont) cont.style.opacity = '1';
                } else if (event.data === YT.PlayerState.ENDED) {
                    if(cont) cont.style.opacity = '0';
                    event.target.playVideo(); // Loop
                }
            },
            'onError': function(e) {
                Logger.warn('[Trailer] YT Player Error:', e.data);
            }
        }
    });
  },

  stopTrailer: function() {
    clearTimeout(NF._trailerTimer);
    NF._trailerReqId++;
    var ytContainer = document.getElementById('nf-yt-container');
    if(ytContainer) ytContainer.style.opacity = '0';
    if(NF._ytPlayerReady && NF._ytPlayer.stopVideo) {
        try { NF._ytPlayer.stopVideo(); } catch(e){}
    }
  },

  load: async function() {
    NF.data=[]; NF.fullData=[]; NF.rowIdx=0; NF.colIdx=0;
    NF._hydrated={}; NF._rowPos={}; NF._rowState={};
    var all = await getAllStreamsForTab();
    var cats = S.categories, bycat = {};
    for(var i=0;i<all.length;i++){
      var s=all[i], cid=String(s.category_id||'');
      if(!bycat[cid]) bycat[cid]=[];
      bycat[cid].push(s);
    }
    var favs=all.filter(isFav);
    if(favs.length) NF.fullData.push({cat:{category_id:'fav',category_name:'⭐ Favoriten'},streams:favs});
    for(var j=0;j<cats.length;j++){
      var streams=bycat[String(cats[j].category_id)]||[];
      if(streams.length) NF.fullData.push({cat:cats[j],streams:streams});
    }
    NF.data = NF.fullData;
  },

  render: function() {
    var grid=$('netflix-grid'); if(!grid) return;
    NF._destroyObservers(); NF._hydrated={}; NF._rowState={};
    if(!NF.data.length){ grid.innerHTML='<div class="empty-s" style="padding:60px"><p>Keine Einträge</p></div>'; return; }
    var html='';
    for(var r=0;r<NF.data.length;r++)
      html+='<div class="nf-row nf-skeleton" id="nf-row-'+r+'" data-row="'+r+'"><div class="nf-left-indicator">⋮</div></div>';
    grid.innerHTML=html;
    grid.onclick=function(e){
      var c=e.target.closest('.nf-card'); if(!c) return;
      var r=parseInt(c.dataset.row),col=parseInt(c.dataset.col);
      if(r===NF.rowIdx&&col===NF.colIdx) NF.select(); else NF.focusCard(r,col);
    };
    NF._setupObservers();
    NF._hydrateRow(0);
    if(NF.data.length>1) NF._hydrateRow(1);
    NF._renderInfo(0,0);
    setTimeout(function(){ NF._scrollRowInView(0); },0);
  },

  _hydrateRow: function(r) {
    if(NF._hydrated[r]) return;
    NF._hydrated[r]=true;
    var rowEl=$('nf-row-'+r); if(!rowEl) return;
    var row=NF.data[r]; if(!row) return;
    var html='<div class="nf-left-indicator">⋮</div><div class="nf-row-header">'+esc(row.cat.category_name)+'</div>';
    html+='<div class="nf-row-track" id="nf-track-'+r+'"><div class="nf-track-inner" id="nf-inner-'+r+'">'
      +'<div class="nf-spacer" id="nf-sp-l-'+r+'" style="width:0"></div>'
      +'<div class="nf-spacer" id="nf-sp-r-'+r+'" style="width:0"></div>'
      +'</div></div>';
    html+='<div class="nf-row-info" id="nf-info-'+r+'"></div>';
    rowEl.classList.remove('nf-skeleton');
    rowEl.innerHTML=html;
    NF._rowState[r] = { startIdx:0, endIdx:-1, cardEls:{} };
    var focusCol = (r === NF.rowIdx) ? NF.colIdx : 0;
    NF._updateRowWindow(r, focusCol, false);
  },

  // ── Karten-Window aktualisieren ─────────────────────────────
  _updateRowWindow: function(r, focusCol, animate) {
    var state = NF._rowState[r]; if(!state) return;
    var inner = $('nf-inner-'+r); if(!inner) return;
    var spL = $('nf-sp-l-'+r), spR = $('nf-sp-r-'+r);
    var row = NF.data[r]; if(!row) return;
    var total = Math.min(row.streams.length, NF.MAX_PER_ROW);

    var windowStart = Math.max(0, focusCol - 2);
    var windowEnd = Math.min(total - 1, windowStart + NF.WINDOW_SIZE - 1);
    if(windowEnd - windowStart < NF.WINDOW_SIZE - 1){
      windowStart = Math.max(0, windowEnd - NF.WINDOW_SIZE + 1);
    }

    // Karten außerhalb des Windows entfernen
    var keepKeys = {};
    for(var c2 = windowStart; c2 <= windowEnd; c2++) keepKeys[c2] = true;
    Object.keys(state.cardEls).forEach(function(c){
      var ci = parseInt(c);
      if(!keepKeys[ci]){
        var el = state.cardEls[ci];
        if(NF._imgObs){
          var img = el.querySelector('img.nf-card-img[data-src]');
          if(img) NF._imgObs.unobserve(img);
        }
        el.parentNode && el.parentNode.removeChild(el);
        delete state.cardEls[ci];
      }
    });

    // Neue Karten erzeugen und in der korrekten Reihenfolge einfügen
    // Wir fügen sie zwischen spL und spR ein, sortiert nach Index
    var rightAnchor = spR; // immer als reference: vor spR einfügen
    // Sammle alle aktuell vorhandenen Karten + sortiere
    for(var c3 = windowStart; c3 <= windowEnd; c3++){
      if(state.cardEls[c3]) continue;
      var s = row.streams[c3];
      var el = NF._buildCard(r, c3, s);
      state.cardEls[c3] = el;
    }
    // Re-Order: alle Karten in korrekter Reihenfolge zwischen spL und spR
    // Erst alle Karten aus dem Inner entfernen (außer Spacer)
    Object.keys(state.cardEls).forEach(function(c){
      var el = state.cardEls[c];
      if(el.parentNode) el.parentNode.removeChild(el);
    });
    // Dann sortiert wieder einfügen
    var sortedKeys = Object.keys(state.cardEls).map(function(k){ return parseInt(k); }).sort(function(a,b){ return a-b; });
    var frag = document.createDocumentFragment();
    sortedKeys.forEach(function(c){ frag.appendChild(state.cardEls[c]); });
    inner.insertBefore(frag, spR);

    // Spacer-Breiten setzen
    var unit = NF.CARD_W + NF.GAP; // 316
    spL.style.width = (windowStart * unit) + 'px';
    var rightCount = total - 1 - windowEnd;
    spR.style.width = (rightCount * unit) + 'px';

    state.startIdx = windowStart;
    state.endIdx = windowEnd;

    NF._applyTransform(r, focusCol, animate);
    if(r === NF.rowIdx) NF._updateFocusDOMForRow(r);
    if(NF._imgObs){
      Object.keys(state.cardEls).forEach(function(c4){
        var img = state.cardEls[c4].querySelector('img.nf-card-img[data-src]');
        if(img) NF._imgObs.observe(img);
      });
    }
  },

  _buildCard: function(r, c, s) {
    var el = document.createElement('div');
    el.className = 'nf-card';
    el.dataset.row = r;
    el.dataset.col = c;
    var cover = s.stream_icon || s.cover || '';
    var title = esc(s.name || s.title || '');
    var titleHtml = '<div class="nf-card-title" aria-hidden="true">'+title+'</div>';
    if(cover){
      el.innerHTML = '<img class="nf-card-img" data-src="'+esc(cover)+'" decoding="async" alt="">'
        +'<div class="nf-card-img-ph nf-fb" style="display:none">🎬</div>'
        + titleHtml;
    } else {
      el.innerHTML = '<div class="nf-card-img-ph">🎬</div>' + titleHtml;
    }
    return el;
  },

  _updateFocusDOMForRow: function(r) {
    var state = NF._rowState[r]; if(!state) return;
    Object.keys(state.cardEls).forEach(function(c){
      var ci = parseInt(c);
      var el = state.cardEls[ci];
      if(r === NF.rowIdx && ci === NF.colIdx) el.classList.add('nf-focused');
      else el.classList.remove('nf-focused');
    });
    var rowEl = $('nf-row-'+r);
    if(rowEl){
      if(r === NF.rowIdx && NF.colIdx === 0 && S.focusArea === 'netflix') rowEl.classList.add('nf-at-left');
      else rowEl.classList.remove('nf-at-left');
    }
  },

  _updateFocusDOM: function() {
    document.querySelectorAll('.nf-card.nf-focused').forEach(function(el){ el.classList.remove('nf-focused'); });
    document.querySelectorAll('.nf-row.nf-at-left').forEach(function(el){ el.classList.remove('nf-at-left'); });
    if(S.focusArea === 'netflix') {
      NF._updateFocusDOMForRow(NF.rowIdx);
      NF._scrollRowInView(NF.rowIdx, true);
    }
    NF._renderInfo(NF.rowIdx, NF.colIdx);
  },

  _renderInfo: function(r,c) {
    // Statt querySelectorAll: Nur den vorherigen Info-Container leeren
    if(NF._lastInfoRow !== undefined && NF._lastInfoRow !== r){
      var prev = $('nf-info-' + NF._lastInfoRow);
      if(prev) prev.innerHTML = '';
    }
    NF._lastInfoRow = r;
    var box=$('nf-info-'+r); if(!box) return;
    var s=NF.data[r]&&NF.data[r].streams[c]; if(!s){ box.innerHTML=''; return; }
    var bits=[];
    bits.push('<span class="nf-info-meta-tag">'+(S.tab==='series'?'Serie':'Film')+'</span>');
    if(s.genre) bits.push(esc(s.genre));
    if(s.year||s.releaseDate) bits.push(esc(s.year||s.releaseDate));
    if(s.duration) bits.push(esc(s.duration));
    if(s.rating) bits.push('⭐ '+esc(s.rating));
    var meta='<div class="nf-info-meta">'+bits.join(' &nbsp;·&nbsp; ')+'</div>';
    var plot = s.plot
      ? '<div class="nf-info-plot-wrap"><div class="nf-info-plot">'+esc(s.plot)+'</div></div>'
      : '';
    box.innerHTML = meta + plot;

    // Auto-Scroll: wenn Plot-Inhalt überläuft, animiere ihn nach oben.
    if(s.plot){
      // requestAnimationFrame: warten bis Layout fertig ist
      requestAnimationFrame(function(){
        var wrap = box.querySelector('.nf-info-plot-wrap');
        var plotEl = box.querySelector('.nf-info-plot');
        if(!wrap || !plotEl) return;
        var overflow = plotEl.scrollHeight - wrap.clientHeight;
        if(overflow > 4){
          // Ein bisschen Puffer am Ende, damit letzte Zeile gut sichtbar ist
          plotEl.style.setProperty('--plot-shift', (-overflow - 4) + 'px');
          plotEl.classList.add('is-overflow');
        } else {
          plotEl.classList.remove('is-overflow');
          plotEl.style.removeProperty('--plot-shift');
        }
      });
    }
    NF._triggerTrailer(r, c);
  },
  
  _triggerTrailer: function(r, c) {
    NF.stopTrailer();
    var currentReqId = NF._trailerReqId;

    // Altlasten (iFrame-Löschung aus vorheriger Version) für sauberen Übergang behalten
    var oldTrailer = document.getElementById('nf-active-trailer');
    if(oldTrailer) {
         oldTrailer.pause();
         oldTrailer.removeAttribute('src');
         oldTrailer.load(); // WICHTIG FÜR WEBOS: Hardware-Decoder zwingend freigeben!
      if(oldTrailer.parentNode) oldTrailer.parentNode.removeChild(oldTrailer);
    }

    var s = NF.data[r] && NF.data[r].streams[c];
    if(!s || S.tab === 'live') return;

    // Timer: Trailer startet erst, wenn der Nutzer 2.5s auf der Karte verweilt
    NF._trailerTimer = setTimeout(async function() {
      if(currentReqId !== NF._trailerReqId) return; // User hat in der Zwischenzeit weitergescrollt

      var state = NF._rowState[r];
      if(!state || !state.cardEls[c]) return;
      var cardEl = state.cardEls[c];
      if(!cardEl.classList.contains('nf-focused')) return;

      var ytId = s.youtube_trailer;

      // TMDB API Suche, falls noch keine YouTube-ID gecacht wurde
      if(!ytId && NF._tmdbApiKey && NF._tmdbApiKey !== 'DEIN_TMDB_API_KEY_HIER') {
        try {
          var title = (s.name || s.title || '').replace(/\s*\(\d{4}\)\s*/g, '').trim();
          var type = (S.tab === 'series') ? 'tv' : 'movie';
          
          var searchUrl = 'https://api.themoviedb.org/3/search/' + type + '?api_key=' + NF._tmdbApiKey + '&query=' + encodeURIComponent(title) + '&language=de-DE';
          var res = await fetch(searchUrl);
          var data = await res.json();
          
          if(data && data.results && data.results.length > 0) {
            var tmdbId = data.results[0].id;
            var vidUrl = 'https://api.themoviedb.org/3/' + type + '/' + tmdbId + '/videos?api_key=' + NF._tmdbApiKey + '&language=de-DE';
            var vidRes = await fetch(vidUrl);
            var vidData = await vidRes.json();
            
            var findTrailer = function(vids) {
              for(var i=0; i<vids.length; i++) if(vids[i].type === 'Trailer' && vids[i].site === 'YouTube') return vids[i];
              for(var j=0; j<vids.length; j++) if(vids[j].site === 'YouTube') return vids[j];
              return null;
            };
            
            var trailer = (vidData && vidData.results) ? findTrailer(vidData.results) : null;

            // Fallback auf Englisch, falls es keinen deutschen Trailer gibt
            if(!trailer) {
              var vidResEn = await fetch('https://api.themoviedb.org/3/' + type + '/' + tmdbId + '/videos?api_key=' + NF._tmdbApiKey);
              var vidDataEn = await vidResEn.json();
              if(vidDataEn && vidDataEn.results) trailer = findTrailer(vidDataEn.results);
            }

            if(trailer) {
              ytId = trailer.key;
              s.youtube_trailer = ytId; // YouTube-ID für spätere Scroll-Bewegungen speichern
            }
          }
        } catch(e) { Logger.warn("[Trailer] TMDB API Fehler:", e); }
      }

      // Zweiter Sicherheits-Check: Ist die Karte nach dem Warten auf die API immer noch fokussiert?
      if(currentReqId !== NF._trailerReqId || !cardEl.classList.contains('nf-focused')) return;

      if(ytId && NF._ytPlayerReady) {
        var ytContainer = document.getElementById('nf-yt-container');
        if(ytContainer) {
          var rect = cardEl.getBoundingClientRect();
          var scale = Math.min(window.innerWidth / 1920, window.innerHeight / 1080) || 1;
          ytContainer.style.left = (rect.left / scale) + 'px';
          ytContainer.style.top = (rect.top / scale) + 'px';
          ytContainer.style.width = (rect.width / scale) + 'px';
          ytContainer.style.height = (rect.height / scale) + 'px';
        }
        try {
          NF._ytPlayer.loadVideoById({videoId: ytId});
        } catch(e) { Logger.warn('[Trailer] YT Load Error:', e); }
      }
    }, 2500);
  },

  // Track-Position: alle Karten links der fokussierten sind 300px breit + 16gap
  // → Position der fokussierten Karte = PADDING_LEFT + focusCol * 316
  // → translateX = PEEK_OFFSET - PADDING_LEFT - focusCol * 316
  _applyTransform: function(r, c, animate) {
    var inner = $('nf-inner-'+r); if(!inner) return;
    var tx = NF.PEEK_OFFSET - NF.PADDING_LEFT - c * (NF.CARD_W + NF.GAP);
    inner.style.transition = animate ? 'transform .35s cubic-bezier(0.25,0.46,0.45,0.94)' : 'none';
    inner.style.transform = 'translate3d(' + tx + 'px, 0, 0)';
  },

  _setupObservers: function() {
    var grid=$('netflix-grid'); if(!grid||!window.IntersectionObserver) return;
    NF._rowObs = new IntersectionObserver(function(entries){
      if(NF._isJumping) return;
      entries.forEach(function(e){ if(e.isIntersecting) NF._hydrateRow(parseInt(e.target.dataset.row)); });
    },{root:grid,rootMargin:'400px 0px',threshold:0});
    grid.querySelectorAll('.nf-row').forEach(function(el){ NF._rowObs.observe(el); });
    NF._imgObs = new IntersectionObserver(function(entries){
      entries.forEach(function(entry){
        if(!entry.isIntersecting) return;
        var img = entry.target, src = img.dataset.src;
        if(src){
          img.onerror = function(){ this.style.display='none'; var fb=this.nextElementSibling; if(fb) fb.style.display='flex'; };
          // Bild vor-decodieren bevor es ins DOM kommt — verhindert Ruckler
          // beim Fokus-Wechsel auf älteren webOS-TVs.
          if(typeof Image !== 'undefined' && img.decode){
            var pre = new Image();
            pre.decoding = 'async';
            pre.onload = function(){
              if(pre.decode){
                pre.decode().then(function(){
                  img.src = src;
                  img.removeAttribute('data-src');
                }).catch(function(){
                  img.src = src;
                  img.removeAttribute('data-src');
                });
              } else {
                img.src = src;
                img.removeAttribute('data-src');
              }
            };
            pre.onerror = function(){
              // Fallback ohne Pre-Decode
              img.src = src;
              img.removeAttribute('data-src');
            };
            pre.src = src;
          } else {
            img.src = src;
            img.removeAttribute('data-src');
          }
          NF._imgObs.unobserve(img);
        }
      });
    // Größerer rootMargin: Bilder werden bereits geladen bevor der User sie sieht
    },{root:grid,rootMargin:'200px 600px',threshold:0});
  },

  _destroyObservers: function() {
    if(NF._rowObs){ NF._rowObs.disconnect(); NF._rowObs=null; }
    if(NF._imgObs){ NF._imgObs.disconnect(); NF._imgObs=null; }
  },

  _goRow: function(nr, jump) {
    NF._rowPos[NF.rowIdx]=NF.colIdx;
    var nc=(NF._rowPos[nr]!==undefined)?NF._rowPos[nr]:0;
    var maxC = Math.min(NF.data[nr].streams.length, NF.MAX_PER_ROW)-1;
    nc = Math.min(nc, maxC);
    var oldRow = NF.rowIdx;
    NF.rowIdx = nr; NF.colIdx = nc;
    
    if(jump) NF._isJumping = true;

    NF._hydrateRow(nr);
    if(jump) {
       if(nr > 0) NF._hydrateRow(nr - 1);
       if(nr < NF.data.length - 1) NF._hydrateRow(nr + 1);
    }

    if(NF._rowState[oldRow]) NF._updateFocusDOMForRow(oldRow);
    NF._updateRowWindow(nr, nc, true);
    NF._renderInfo(nr, nc);
    NF._scrollRowInView(nr, jump);

    if(jump) {
       setTimeout(function(){ NF._isJumping = false; }, 150);
    }
  },

  focusCard: function(r, c) {
    if(r !== NF.rowIdx){
      NF._rowPos[NF.rowIdx] = NF.colIdx;
      var oldRow = NF.rowIdx;
      NF.rowIdx = r; NF.colIdx = c;
      NF._hydrateRow(r);
      if(NF._rowState[oldRow]) NF._updateFocusDOMForRow(oldRow);
      NF._updateRowWindow(r, c, true);
      NF._renderInfo(r, c);
      NF._scrollRowInView(r);
    } else {
      NF.colIdx = c;
      NF._updateRowWindow(r, c, true);
      NF._renderInfo(r, c);
    }
  },

  _scrollRowInView: function(r, jump) {
    var el=$('nf-row-'+r),g=$('netflix-grid'); if(!el||!g) return;
    g.scrollTo({ top: el.offsetTop, behavior: jump ? 'auto' : 'smooth' });
  },

  moveUp:   function(){ if(NF.rowIdx>0) NF._goRow(NF.rowIdx-1); },
  moveDown: function(){ if(NF.rowIdx<NF.data.length-1) NF._goRow(NF.rowIdx+1); },
  moveLeft: function(){
    if(NF.colIdx>0){
      NF.colIdx--;
      NF._updateRowWindow(NF.rowIdx, NF.colIdx, true);
      NF._renderInfo(NF.rowIdx, NF.colIdx);
    } else {
      NF.openSidebar();
    }
  },
  moveRight: function(){
    var maxC = Math.min(NF.data[NF.rowIdx].streams.length, NF.MAX_PER_ROW)-1;
    if(NF.colIdx<maxC){
      NF.colIdx++;
      NF._updateRowWindow(NF.rowIdx, NF.colIdx, true);
      NF._renderInfo(NF.rowIdx, NF.colIdx);
    }
  },

  openSidebar: function() {
    if (this.sbOpen) return;
    NF.stopTrailer();
    this.sbOpen = true;
    this.sbCursor = this.rowIdx;
    $('nf-sidebar').classList.add('open');
    S.focusArea = 'nf-sidebar';
    this.renderSidebar();
    document.querySelectorAll('.nf-card.nf-focused').forEach(function(el){ el.classList.remove('nf-focused'); });
  },

  closeSidebar: function() {
    if (!this.sbOpen) return;
    this.sbOpen = false;
    $('nf-sidebar').classList.remove('open');
    S.focusArea = 'netflix';
    this._updateFocusDOM();
  },

  renderSidebar: function() {
    var html = '';
    for(var i=0; i<this.data.length; i++){
      var isCur = (i === this.rowIdx);
      var isFoc = (i === this.sbCursor);
      var cls = 'nf-sb-item' + (isCur ? ' active' : '') + (isFoc ? ' focused' : '');
      html += '<div class="' + cls + '" id="nfsb-' + i + '">' + esc(this.data[i].cat.category_name) + '</div>';
    }
    $('nf-sb-list').innerHTML = html;
    var container = $('nf-sb-list');
    var el = $('nfsb-' + this.sbCursor);
    if(container && el) {
      var elRect = el.getBoundingClientRect(), cRect = container.getBoundingClientRect();
      var relTop = elRect.top - cRect.top + container.scrollTop, relBot = relTop + el.offsetHeight + 14;
      var cTop = container.scrollTop, cBot = container.scrollTop + container.clientHeight;
      if(relTop < cTop) container.scrollTop = relTop - 14;
      else if(relBot > cBot) container.scrollTop = relBot - container.clientHeight + 14;
    }
    $('nf-sb-list').querySelectorAll('.nf-sb-item').forEach(function(el) {
       el.addEventListener('click', function() { NF.sbCursor = parseInt(el.id.replace('nfsb-', '')); NF.sbSelect(); });
       el.addEventListener('mouseover', function() { NF.sbCursor = parseInt(el.id.replace('nfsb-', '')); NF.renderSidebar(); });
    });
  },

  sbMove: function(dir) {
    var next = this.sbCursor + dir;
    if (next < 0) next = this.data.length - 1;
    if (next >= this.data.length) next = 0;
    this.sbCursor = next;
    this.renderSidebar();
  },

  sbSelect: function() {
    this.closeSidebar();
    this._goRow(this.sbCursor, true);
  },

  select: function(){
    var row=NF.data[NF.rowIdx]; if(!row) return;
    var s=row.streams[NF.colIdx]; if(!s) return;
    NF.stopTrailer();
    if(S.tab==='series') openSeries(s);
    else { S.currentStreamIdx=NF.colIdx; Player.play(API.streamUrl(s),s,S.tab); }
  },

  enter: async function(){
    var ca=$('content-area'),ng=$('netflix-grid');
    if(!ca||!ng){ Logger.error('NF: Elemente fehlen!'); return; }
    ca.classList.add('nf-mode');
    document.body.classList.add('nf-active');
    ng.classList.remove('hidden');
    if($('nf-sidebar')) $('nf-sidebar').classList.remove('hidden');
    ng.innerHTML='<div class="loading-c"><div class="spinner"></div><span>Laden…</span></div>';
    if(!S._navTabHold) S.focusArea='netflix';
    NF._initYtPlayer();
    await NF.load();
    NF.render();
  },

  leave: function(){
    NF._destroyObservers();
    NF.stopTrailer();
    var oldTrailer = document.getElementById('nf-active-trailer');
    if(oldTrailer) {
      if(oldTrailer.parentNode) oldTrailer.parentNode.removeChild(oldTrailer);
    }
    NF._hydrated={}; NF._rowPos={}; NF._rowState={}; NF.sbOpen=false;
    NF.data=[]; NF.fullData=[];
    var ca=$('content-area'),ng=$('netflix-grid');
    if(ca) ca.classList.remove('nf-mode');
    document.body.classList.remove('nf-active');
    if(ng){ ng.classList.add('hidden'); ng.innerHTML=''; }
    if($('nf-sidebar')) { $('nf-sidebar').classList.add('hidden'); $('nf-sidebar').classList.remove('open'); }
  }
};