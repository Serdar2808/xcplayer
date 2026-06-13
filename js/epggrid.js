// ── EPG GRID (TV-Zeitung) ─────────────────────────────────────────
var EpgGrid = {
  get open() { return S.epgGridOpen; },
  set open(val) { S.epgGridOpen = val; },
  channels: [],     // [{stream, epgId, progs:[]}]
  cursor: {ch:0, prog:0},
  scrollOffset: 0,  // first visible channel index
  timeOffset: 0,    // px scroll offset for time axis
  originMin: 0,     // minutes since epoch for left edge
  totalWidth: 0,
  _lastFocusMin: 0,

  _poolCh: [], _poolChMap: {},
  _poolGrid: [], _poolGridMap: {},

  toggle: function(){
    if(this.open) { this.close(); return; }
    if(!EpgData.loaded || !S.filteredStreams || S.filteredStreams.length === 0){
      showToast('EPG-Daten nicht verfügbar', 2000); return;
    }
    this._buildData();
    
    $('eg-channels').style.position = 'relative';
    $('eg-channels').style.paddingTop = '0';
    
    this._renderTimeHeader();
    this._renderVirtualVertical();
    this._applyTimeScroll();
    this._ensureProgInView();

    this.open = true; // Triggert Event im Hintergrund
  },

  close: function(){
    this.open = false;
  },

  _buildData: function(){
    var streams = S.filteredStreams;
    this.channels = [];
    var now = new Date();
    // Ursprung auf (jetzt - VERGANGENE Stunden) setzen, auf 30 Min runden
    var originDate = new Date(now.getTime() - CONFIG.EPG_GRID_PAST_H * 3600000);
    originDate.setMinutes(Math.floor(originDate.getMinutes() / 30) * 30, 0, 0);
    this.originMin = Math.floor(originDate.getTime() / 60000);
    var totalMin = (CONFIG.EPG_GRID_PAST_H + CONFIG.EPG_GRID_FUTURE_H) * 60;
    this.totalWidth = totalMin * CONFIG.EPG_GRID_PX_PER_MIN;

    for(var i = 0; i < streams.length; i++){
      var s = streams[i];
      var epgId = EpgData.findId(s);
      var progs = [];
      if(epgId && EpgData.programmes[epgId]){
        var all = EpgData.programmes[epgId];
        var endMin = this.originMin + totalMin;
        for(var j = 0; j < all.length; j++){
          var startMin = Math.floor(all[j].start.getTime() / 60000);
          var stopMin = Math.floor(all[j].stop.getTime() / 60000);
          if(stopMin <= this.originMin || startMin >= endMin) continue;
          progs.push({
            title: all[j].title,
            desc: all[j].description || '',
            startMin: Math.max(startMin, this.originMin),
            stopMin: Math.min(stopMin, endMin),
            realStartMin: startMin,
            realStopMin: stopMin,
            isNow: startMin <= Math.floor(now.getTime()/60000) && stopMin > Math.floor(now.getTime()/60000),
            isPast: stopMin <= Math.floor(now.getTime()/60000)
          });
        }
      }
      this.channels.push({stream: s, epgId: epgId, progs: progs});
    }

    // Cursor auf aktuellen Sender setzen
    this.cursor.ch = 0;
    this.cursor.prog = 0;
    if(S.currentStream){
      for(var k = 0; k < this.channels.length; k++){
        if(this.channels[k].stream.stream_id === S.currentStream.stream_id){
          this.cursor.ch = k; break;
        }
      }
    }
    // "Jetzt"-Programm im fokussierten Sender finden
    this._focusNowProg();
    this._lastFocusMin = Math.floor(Date.now() / 60000);

    // Zeitachse auf Jetzt zentrieren
    var nowMin = Math.floor(now.getTime() / 60000);
    var gridW = 1920 - CONFIG.EPG_GRID_CH_W;
    this.timeOffset = Math.max(0, (nowMin - this.originMin) * CONFIG.EPG_GRID_PX_PER_MIN - gridW / 3);

    // Scrollen auf Cursor-Sender zentrieren
    this.scrollOffset = Math.max(0, this.cursor.ch - Math.floor(CONFIG.EPG_GRID_VISIBLE / 2));
    var maxScroll = Math.max(0, this.channels.length - CONFIG.EPG_GRID_VISIBLE);
    this.scrollOffset = Math.min(this.scrollOffset, maxScroll);

    $('eg-date').textContent = now.toLocaleDateString('de-DE', {weekday:'long', day:'numeric', month:'long'});
  },

  _focusNowProg: function(){
    var ch = this.channels[this.cursor.ch];
    if(!ch || !ch.progs.length){ this.cursor.prog = 0; return; }
    var nowMin = Math.floor(Date.now() / 60000);
    for(var i = 0; i < ch.progs.length; i++){
      if(ch.progs[i].isNow){ this.cursor.prog = i; return; }
    }
    // Nächstgelegene zukünftige Sendung finden
    for(var j = 0; j < ch.progs.length; j++){
      if(ch.progs[j].realStartMin >= nowMin){ this.cursor.prog = j; return; }
    }
    this.cursor.prog = 0;
  },

  _renderTimeHeader: function(){
    var hdr = $('eg-time-hdr');
    hdr.style.width = this.totalWidth + 'px';
    hdr.style.transform = 'translateX(-' + this.timeOffset + 'px)';
    var html = '';
    var totalMin = (CONFIG.EPG_GRID_PAST_H + CONFIG.EPG_GRID_FUTURE_H) * 60;
    for(var m = 0; m < totalMin; m += 30){
      var d = new Date((this.originMin + m) * 60000);
      var isHour = d.getMinutes() === 0;
      var x = m * CONFIG.EPG_GRID_PX_PER_MIN;
      var label = d.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'});
      html += '<div class="eg-time-mark' + (isHour ? ' eg-hour' : '') + '" style="left:' + x + 'px">' + label + '</div>';
    }
    hdr.innerHTML = html;
  },

  _getChEl: function(idx){
    if(this._poolChMap[idx]) return this._poolChMap[idx];
    var el;
    for(var p=0; p<this._poolCh.length; p++){
      if(!this._poolCh[p]._used){ el = this._poolCh[p]; break; }
    }
    if(!el){
      el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.left = '0';
      el.style.width = '100%';
      this._poolCh.push(el);
      $('eg-channels').appendChild(el);
    }
    el._used = true;
    this._poolChMap[idx] = el;
    return el;
  },

  _getGridEl: function(idx){
    if(this._poolGridMap[idx]) return this._poolGridMap[idx];
    var el;
    for(var p=0; p<this._poolGrid.length; p++){
      if(!this._poolGrid[p]._used){ el = this._poolGrid[p]; break; }
    }
    if(!el){
      el = document.createElement('div');
      el.className = 'eg-row';
      el.style.position = 'absolute';
      el.style.left = '0';
      this._poolGrid.push(el);
      $('eg-grid-inner').appendChild(el);
    }
    el._used = true;
    this._poolGridMap[idx] = el;
    return el;
  },

  _renderVirtualVertical: function(){
    var si = this.scrollOffset;
    var ei = Math.min(this.channels.length - 1, si + CONFIG.EPG_GRID_VISIBLE);
    var rowH = CONFIG.EPG_GRID_ROW_H;
    var ppm = CONFIG.EPG_GRID_PX_PER_MIN;

    // Nicht mehr sichtbare Elemente in den Pool zurückgeben
    for(var k in this._poolChMap){
      var idx = parseInt(k);
      if(idx < si || idx > ei){
         this._poolChMap[idx]._used = false;
         this._poolChMap[idx].style.display = 'none';
         this._poolChMap[idx]._lastIdx = -1;
         delete this._poolChMap[idx];
      }
    }
    for(var k in this._poolGridMap){
      var idx = parseInt(k);
      if(idx < si || idx > ei){
         this._poolGridMap[idx]._used = false;
         this._poolGridMap[idx].style.display = 'none';
         this._poolGridMap[idx]._lastIdx = -1;
         delete this._poolGridMap[idx];
      }
    }

    $('eg-grid-inner').style.width = this.totalWidth + 'px';

    for(var i = si; i <= ei; i++){
       var ch = this.channels[i];
       var screenY = (i - this.scrollOffset) * rowH;

       // -- Sender-Spalte --
       var chEl = this._getChEl(i);
       chEl.style.display = 'flex';
       chEl.style.top = (screenY + 40) + 'px'; // +40px wg. Zeit-Header
       
       var s = ch.stream;
       var isActive = S.currentStream && s.stream_id === S.currentStream.stream_id;
       chEl.className = 'eg-ch-row' + (isActive ? ' eg-ch-active' : '');
       
       if(chEl._lastIdx !== i){
          chEl._lastIdx = i;
          var logoSrc = typeof getStreamLogoWithEpgFallback === 'function' ? getStreamLogoWithEpgFallback(s) : (s.stream_icon||'');
          var logo = logoSrc && (typeof _failedImgs === 'undefined' || !_failedImgs[logoSrc]) ? '<img class="eg-ch-logo" src="'+esc(logoSrc)+'" onerror="if(typeof _logoErr === \'function\') _logoErr(this); else this.style.display=\'none\';"><div class="eg-ch-logo-ph" style="display:none">&#x1F4E1;</div>' : '<div class="eg-ch-logo-ph">&#x1F4E1;</div>';
          chEl.innerHTML = logo + '<div class="eg-ch-name">' + esc(s.name) + '</div>';
       }

       // -- EPG Grid Zeile --
       var gEl = this._getGridEl(i);
       gEl.style.display = 'flex';
       gEl.style.top = screenY + 'px';
       gEl.style.width = this.totalWidth + 'px';
       
       if(gEl._lastIdx !== i){
          gEl._lastIdx = i;
          var html = '';
          if(ch.progs.length === 0){
            html = '<div class="eg-prog eg-past" style="left:0;width:' + this.totalWidth + 'px"><span class="eg-prog-title" style="color:var(--lo)">Keine EPG-Daten</span></div>';
          } else {
            for(var j = 0; j < ch.progs.length; j++){
              var p = ch.progs[j];
              var px = (p.startMin - this.originMin) * ppm;
              var pw = Math.max(20, (p.stopMin - p.startMin) * ppm - 2);
              var isFoc = (i === this.cursor.ch && j === this.cursor.prog);
              var cls = 'eg-prog' + (p.isNow ? ' eg-now' : '') + (p.isPast ? ' eg-past' : '') + (isFoc ? ' eg-focused' : '');
              var timeStr = new Date(p.realStartMin*60000).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
              html += '<div class="' + cls + '" style="left:' + px + 'px;width:' + pw + 'px" data-chi="' + i + '" data-pi="' + j + '">'
                    + '<span class="eg-prog-title">' + esc(p.title) + '</span>'
                    + (pw > 120 ? '<span class="eg-prog-time">' + timeStr + '</span>' : '')
                    + '</div>';
            }
          }
          gEl.innerHTML = html;
       } else {
          // Nur CSS-Klassen für den Fokus updaten (kein teures .innerHTML)
          var progs = gEl.querySelectorAll('.eg-prog');
          for(var j = 0; j < progs.length; j++){
             var pi = parseInt(progs[j].getAttribute('data-pi'));
             if(!isNaN(pi)){
                 if(i === this.cursor.ch && pi === this.cursor.prog) progs[j].classList.add('eg-focused');
                 else progs[j].classList.remove('eg-focused');
             }
          }
       }
    }
    this._renderNowLine();
  },

  _renderNowLine: function(){
    var nowMin = Math.floor(Date.now() / 60000);
    var x = (nowMin - this.originMin) * CONFIG.EPG_GRID_PX_PER_MIN;
    var line = $('eg-now-line');
    if(!line) {
      line = document.createElement('div');
      line.className = 'eg-now-line';
      line.id = 'eg-now-line';
      line.innerHTML = '<div class="eg-now-dot"></div>';
      $('eg-grid-inner').appendChild(line);
    }
    if(line) line.style.left = x + 'px';
  },

  _ensureProgInView: function(){
    var ch = this.channels[this.cursor.ch];
    if(!ch || !ch.progs.length) return;
    var p = ch.progs[this.cursor.prog];
    if(!p) return;
    var ppm = CONFIG.EPG_GRID_PX_PER_MIN;
    var gridW = 1920 - CONFIG.EPG_GRID_CH_W;
    var px = (p.startMin - this.originMin) * ppm;
    var pw = (p.stopMin - p.startMin) * ppm;
    // Scrollen, damit das fokussierte Programm sichtbar ist
    if(px < this.timeOffset + 40){
      this.timeOffset = Math.max(0, px - 40);
      this._applyTimeScroll();
    } else if(px + pw > this.timeOffset + gridW - 40){
      this.timeOffset = px + pw - gridW + 40;
      this._applyTimeScroll();
    }
  },

  _applyTimeScroll: function(){
    $('eg-time-hdr').style.transform = 'translateX(-' + this.timeOffset + 'px)';
    $('eg-grid-inner').style.transform = 'translateX(-' + this.timeOffset + 'px)';
  },

  _updateFocus: function(){
    this._renderVirtualVertical();
    this._ensureProgInView();
  },

  // Navigation
  moveUp: function(){
    if(this.cursor.ch <= 0) return;
    this._saveFocusTime();
    this.cursor.ch--;
    if(this.cursor.ch < this.scrollOffset){
      this.scrollOffset = this.cursor.ch;
    }
      this._snapProgToTime();
      this._updateFocus();
  },

  moveDown: function(){
    if(this.cursor.ch >= this.channels.length - 1) return;
    this._saveFocusTime();
    this.cursor.ch++;
    if(this.cursor.ch >= this.scrollOffset + CONFIG.EPG_GRID_VISIBLE){
      this.scrollOffset = this.cursor.ch - CONFIG.EPG_GRID_VISIBLE + 1;
    }
      this._snapProgToTime();
      this._updateFocus();
  },

  moveLeft: function(){
    if(this.cursor.prog > 0){
      this.cursor.prog--;
        this._updateFocus();
    } else {
      // Zeitachse nach links scrollen
      this.timeOffset = Math.max(0, this.timeOffset - 300);
      this._applyTimeScroll();
    }
  },

  moveRight: function(){
    var ch = this.channels[this.cursor.ch];
    if(!ch) return;
    if(this.cursor.prog < ch.progs.length - 1){
      this.cursor.prog++;
        this._updateFocus();
    } else {
      // Zeitachse nach rechts scrollen
      var maxScroll = Math.max(0, this.totalWidth - (1920 - CONFIG.EPG_GRID_CH_W));
      this.timeOffset = Math.min(maxScroll, this.timeOffset + 300);
      this._applyTimeScroll();
    }
  },

  // Beim Senderwechsel das Programm an der gleichen Zeitposition finden
  _snapProgToTime: function(){
    var ch = this.channels[this.cursor.ch];
    if(!ch || !ch.progs.length){ this.cursor.prog = 0; return; }
    // Gespeicherte Zielzeit vom letzten fokussierten Programm nutzen, sonst "Jetzt"
    var targetMin = this._lastFocusMin || Math.floor(Date.now() / 60000);
    var best = 0, bestDist = Infinity;
    for(var i = 0; i < ch.progs.length; i++){
      var mid = (ch.progs[i].startMin + ch.progs[i].stopMin) / 2;
      var dist = Math.abs(mid - targetMin);
      if(dist < bestDist){ bestDist = dist; best = i; }
    }
    this.cursor.prog = best;
  },

  _saveFocusTime: function(){
    var ch = this.channels[this.cursor.ch];
    if(ch && ch.progs[this.cursor.prog]){
      var p = ch.progs[this.cursor.prog];
      this._lastFocusMin = (p.startMin + p.stopMin) / 2;
    }
  },

  select: function(){
    var ch = this.channels[this.cursor.ch];
    if(!ch) return;
    var s = ch.stream;
    // Zu diesem Sender wechseln
    var foundIdx = -1;
    for(var i = 0; i < S.filteredStreams.length; i++){
      if(S.filteredStreams[i].stream_id === s.stream_id){ foundIdx = i; break; }
    }
    if(foundIdx !== -1) S.currentStreamIdx = foundIdx;
    this.close();
    saveLastStream(s);
    Player.play(API.liveUrl(s), s, 'live');
  }
};

// EPG Grid Klick-Handler
$('epg-grid-overlay').addEventListener('click', function(e){
  var prog = e.target.closest('.eg-prog');
  if(prog){
    var chi = parseInt(prog.getAttribute('data-chi'));
    var pi = parseInt(prog.getAttribute('data-pi'));
    if(!isNaN(chi) && !isNaN(pi)){
      EpgGrid.cursor.ch = chi;
      EpgGrid.cursor.prog = pi;
      EpgGrid.select();
    }
  }
});

// Magic Remote Scrollrad Unterstützung
$('epg-grid-overlay').addEventListener('wheel', function(e){
  if(!EpgGrid.open) return;
  e.preventDefault();
  e.stopPropagation(); // Verhindert, dass das Event den Sender im Hintergrund umschaltet
  if(e.deltaY > 0) EpgGrid.moveDown();
  else if(e.deltaY < 0) EpgGrid.moveUp();
}, {passive: false});