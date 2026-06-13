// ── PROGRESSIVES SPULEN ──────────────────────────────────────────
var _seek = { active: false, target: 0, holdStart: 0, timer: null };

function progressiveSeek(dir){
  if(typeof BingeMode !== 'undefined' && BingeMode._active) return;
  var now = Date.now();
  var isCatchup = S.playerType === 'catchup' && S.currentStream;
  var curTime = isCatchup ? (S.currentStream.cu_offsetSec + (Player.vid.currentTime||0)) : (Player.vid.currentTime||0);
  var dur = isCatchup ? (S.currentStream.cu_durationMin * 60) : (Player.vid.duration||0);

  if(!dur) return;

  if(!_seek.active) {
    _seek.active = true;
    _seek.target = curTime;
    _seek.holdStart = now;
    Player.showControls();
  }

  // YouTube-Logik: Erste 2 Sekunden -> 10s Schritte. Danach -> 60s Schritte
  var holdTime = now - _seek.holdStart;
  var step = (holdTime > CONFIG.SEEK_HOLD_THRESHOLD) ? CONFIG.SEEK_FAST_STEP : CONFIG.SEEK_NORMAL_STEP;

  _seek.target += dir * step;
  _seek.target = Math.max(0, Math.min(dur, _seek.target));

  var diff = _seek.target - curTime;
  var sign = diff > 0 ? '+' : '';
  showToast('Suchen: ' + sign + Math.round(diff) + 's (OK drücken)', 3000);

  Player._updateProgressUI(_seek.target, dur);

  clearTimeout(_seek.timer);
  _seek.timer = setTimeout(commitSeek, CONFIG.SEEK_AUTO_COMMIT_MS); // Automatisches Anwenden
}

function commitSeek(){
  if(!_seek.active) return;
  _seek.active = false;
  clearTimeout(_seek.timer);
  $('toast').classList.remove('show');
  
  var isCatchup = S.playerType === 'catchup' && S.currentStream;
  if (isCatchup) {
     S.currentStream.cu_offsetSec = _seek.target;
     showToast('Lade Stream...', 1000);
     Player.play(null, S.currentStream, 'catchup');
  } else {
     if(Player.vid.duration) Player.vid.currentTime = _seek.target;
  }
  Player.showControls();
}

// ── PLAYER ────────────────────────────────────────────────────────
var Player = {
  hls:null, vid:null, _osdTimer:null, _brTimer:null, _clockTimer:null, _bitrate:0,
  _lastPlayedId: null, _retriedLive: false, _suspended: false, _resumeStream: null, _resumeType: null,
  get _subPanelOpen() { return S.subPanelOpen; }, set _subPanelOpen(v) { S.subPanelOpen = v; },
  get _audioPanelOpen() { return S.audioPanelOpen; }, set _audioPanelOpen(v) { S.audioPanelOpen = v; },

  init:function(){
    this.vid=$('video-el');
    this._bindVideoEvents();
    var self=this;
    var updateClocks = function(){
      var t = fmtClock();
      var dt = fmtDateClock();
      if($('osd-clock')) $('osd-clock').textContent = t;
      if($('nav-clock')) $('nav-clock').textContent = dt;
    };
    updateClocks();
    this._clockTimer=setInterval(updateClocks, CONFIG.CLOCK_INTERVAL);
    // Bitraten-Überwachung
    this._brTimer=setInterval(function(){ self._checkBitrate(); }, CONFIG.BITRATE_INTERVAL);
  },

  _bindVideoEvents:function(){
    var self=this;
    // Puffer-Indikator
    this.vid.addEventListener('waiting',function(){
      $('buf-overlay').classList.remove('hidden');
      $('buf-info').textContent='Buffering…';
    });
    this.vid.addEventListener('playing',function(){
      $('buf-overlay').classList.add('hidden');
      $('btn-pp-vod').innerHTML='&#10074;&#10074;';
    });
    this.vid.addEventListener('pause',function(){
      $('btn-pp-vod').innerHTML='&#9654;';
    });
    this.vid.addEventListener('loadedmetadata',function(){
      var w=Player.vid.videoWidth,h=Player.vid.videoHeight;
      if(w&&h) Player._updateBadges();
    });
    this.vid.addEventListener('timeupdate',function(){
      if(_seek.active) return; // WICHTIG: Überschreibe die Leiste nicht, wenn gespult wird
      if(S.playerType === 'catchup' && S.currentStream && S.currentStream.cu_durationMin) {
         var realSec = S.currentStream.cu_offsetSec + Math.floor(Player.vid.currentTime || 0);
         var totalSec = S.currentStream.cu_durationMin * 60;
         Player._updateProgressUI(realSec, totalSec);
         return;
      }
      if(!Player.vid.duration) return;
      Player._updateProgressUI(Player.vid.currentTime, Player.vid.duration);
      
      // Binge-Modus 90 Sekunden vor Ende starten
      if(S.playerType === 'series' && !S._bingeTriggered && !BingeMode._active && Player.vid.duration > 75) {
        if(Player.vid.duration - Player.vid.currentTime <= 75) {
          S._bingeTriggered = true;
          var nextIdx = S.currentEpIdx + 1;
          if(nextIdx < S.currentEpsArray.length) BingeMode.start();
        }
      }

      if(S.playerType!=='live'&&S.currentStream){
        var id=S.playerType==='series'?(S.currentStream.episode_id||S.currentStream.series_id):S.currentStream.stream_id;
        var ct=Math.floor(Player.vid.currentTime);
        if(ct>10&&ct%CONFIG.RESUME_SAVE_INTERVAL===0){
          S.resume[id]=ct; saveResume();
          // Für Serien zusätzlich pro series_id einen Eintrag mit Metadaten ablegen,
          // damit der Weiterschauen-Tab ohne erneuten Serien-Info-Fetch rendern kann.
          if(S.playerType==='series'){
            var cs = S.currentSeriesStream || {};
            var sid = String(cs.series_id || S.currentStream.series_id || '');
            if(sid){
              S.resumeSeries = S.resumeSeries || {};
              S.resumeSeries[sid] = {
                series_id: sid,
                episode_id: S.currentStream.episode_id || '',
                episode_num: (S.currentEpsArray && S.currentEpsArray[S.currentEpIdx] && S.currentEpsArray[S.currentEpIdx].episode_num) || (S.currentEpIdx+1),
                season_num: S.seriesSeasonsArr ? S.seriesSeasonsArr[S.cursors.season] : '',
                ep_idx: S.currentEpIdx,
                season_idx: S.cursors.season,
                name: cs.name || S.currentStream.name || '',
                cover: cs.cover || cs.stream_icon || '',
                pos: ct,
                ts: Date.now()
              };
              if(typeof saveResumeSeries === 'function') saveResumeSeries();
            }
          }
        }
      }
    });
    this.vid.addEventListener('ended',function(){ 
      // Fortsetzen-Speicher für beendete Inhalte leeren
      if(S.playerType!=='live' && S.currentStream){
        var rid = S.playerType==='series' ? (S.currentStream.episode_id||S.currentStream.series_id) : S.currentStream.stream_id;
        if(S.resume[rid]){ delete S.resume[rid]; saveResume(); }
        // Bei Serien zusätzlich den Series-Eintrag entfernen, wenn es die letzte Episode war.
        if(S.playerType==='series'){
          var cs2 = S.currentSeriesStream || {};
          var sid2 = String(cs2.series_id || S.currentStream.series_id || '');
          var isLast = !(S.currentEpsArray && (S.currentEpIdx + 1) < S.currentEpsArray.length);
          if(sid2 && isLast && S.resumeSeries && S.resumeSeries[sid2]){
            delete S.resumeSeries[sid2];
            if(typeof saveResumeSeries === 'function') saveResumeSeries();
          }
        }
      }
      if(S.playerType==='series'){
        if(S._bingeCancelled) {
            Player.close(); // Zurück zur Episodenübersicht
        } else {
            var nextIdx = S.currentEpIdx + 1;
            if(nextIdx < S.currentEpsArray.length) Player.nextEp();
            else showToast('Letzte Episode', 1500);
        }
      } else if(S.playerType==='vod'){
        Player.close(); // Film fertig → zurück
      } else if (S.playerType==='catchup' && S.currentStream) {
         var realSec = S.currentStream.cu_offsetSec + Math.floor(Player.vid.currentTime || 0);
         var totalSec = S.currentStream.cu_durationMin * 60;
         if (realSec < totalSec - 30) {
             S.currentStream.cu_offsetSec = realSec;
             Player.play(null, S.currentStream, 'catchup'); // Auto-Resume nach 3 Min LG-Bug
         } else {
             Player.close(); // Wirklich beendet -> Zurück
         }
      }
    });
    this.vid.addEventListener('error',function(e){ 
      // Verbesserte Fehlermeldungen
      var elapsed = Date.now() - (_streamLoadStart||Date.now());
      
      // Automatischer Neuversuch für Live-TV bei schnellem Abbruch (z.B. Decoder-Absturz nach Profilwechsel)
      if(S.playerType === 'live' && elapsed < 8000 && !Player._retriedLive) {
          Logger.info("[Player] Auto-retrying live stream once...");
          Player._retriedLive = true;
          setTimeout(function(){
              if(S.currentStream && S.playerVisible && S.playerType === 'live') {
                  Player.play(API.liveUrl(S.currentStream), S.currentStream, 'live');
              }
          }, 1500);
          return; // Fehler-Toast für den ersten Versuch stummschalten
      }

      var ve = Player.vid.error;
      var errCode = ve ? ve.code : 0;
      var errMsg = 'Stream lädt nicht';
      var errDetail = '';
      if(elapsed > 8000) errDetail = 'Timeout nach ' + Math.round(elapsed/1000) + 's';
      if(errCode === 2) { errMsg = 'Netzwerkfehler'; errDetail = 'Verbindung unterbrochen'; }
      else if(errCode === 3) { errMsg = 'Dekodierfehler'; errDetail = 'Format nicht unterstützt'; }
      else if(errCode === 4) { errMsg = 'Stream nicht verfügbar'; errDetail = errDetail || 'URL ungültig oder nicht autorisiert'; }
      if(Player.hls && Player.hls.networkError) {
        var ne = Player.hls.networkError;
        if(ne && ne.response) {
          var status = ne.response.code;
          if(status === 404) errDetail = '404 Not Found';
          else if(status === 403 || status === 401) errDetail = 'Nicht autorisiert ('+status+')';
          else if(status === 0) errDetail = 'Timeout nach ' + Math.round(elapsed/1000) + 's';
          else errDetail = 'HTTP ' + status;
        }
      }
      showStreamError(errMsg, errDetail);
      
      if (S.playerType==='catchup' && S.currentStream) {
         var realSec = S.currentStream.cu_offsetSec + Math.floor(Player.vid.currentTime || 0);
         var totalSec = S.currentStream.cu_durationMin * 60;
         if (realSec < totalSec - 30) {
             S.currentStream.cu_offsetSec = realSec;
             setTimeout(function(){ Player.play(null, S.currentStream, 'catchup'); }, 1500);
         }
      }
    });
  },

  restart:function(){
    var isCatchup = S.playerType === 'catchup' && S.currentStream;
    if (isCatchup) {
       S.currentStream.cu_offsetSec = 0;
       showToast('Lade Stream...', 1000);
       this.play(null, S.currentStream, 'catchup');
    } else {
       if (this.vid.duration) this.vid.currentTime = 0;
    }
    this.showControls();
  },

  startLiveTimeshift: function() {
    if (S.playerType !== 'live') return;
    var s = S.currentStream;
    if (!s) return;

    var archiveDays = parseInt(s.tv_archive_duration || 0);
    var targetStream = s;
    if (!archiveDays && s.tv_archive != 1) {
      var base = _baseName(s.name);
      for(var k=0; k<S.streams.length; k++){
        if(S.streams[k].tv_archive == 1 && _baseName(S.streams[k].name) === base){
          archiveDays = parseInt(S.streams[k].tv_archive_duration||0);
          targetStream = S.streams[k];
          break;
        }
      }
    }
    if (archiveDays <= 0 && targetStream.tv_archive != 1) {
      showToast('Dieser Sender unterstützt kein Catchup/Timeshift', 2000);
      return;
    }

    var nowSec = Date.now() / 1000;
    var curProg = null;
    if (EpgData.loaded) {
      var epgId = EpgData.findId(targetStream);
      if (epgId && EpgData.programmes[epgId]) {
        var progs = EpgData.programmes[epgId];
        for (var i=0; i<progs.length; i++) {
          var st = progs[i].start.getTime()/1000;
          var sp = progs[i].stop.getTime()/1000;
          if (st <= nowSec && sp > nowSec) { curProg = progs[i]; break; }
        }
      }
    }
    if (!curProg) {
      var cce = findCurrentEpg(targetStream.stream_id, nowSec);
      if (cce) {
        curProg = {
          start: new Date(getTs(cce, 'start') * 1000),
          stop: new Date(getTs(cce, 'stop') * 1000),
          title: b64dec(cce.title||'')
        };
      }
    }

    if (!curProg) {
      showToast('Keine EPG-Daten für aktuelles Programm gefunden', 2000);
      return;
    }

    var startMs = curProg.start.getTime();
    var stopMs = curProg.stop.getTime();
    var durationMin = Math.ceil((stopMs - startMs) / 60000);
    var elapsedSec = Math.floor(nowSec - (startMs / 1000));

    var cuStream = Object.assign({}, targetStream);
    cuStream.name = (s.name || 'Live') + ' - ' + (curProg.title || 'Timeshift');
    cuStream.stream_id = targetStream.stream_id + '_cu_' + Math.floor(startMs/1000);
    cuStream.cu_original_id = targetStream.stream_id;
    cuStream.cu_startMs = startMs;
    cuStream.cu_durationMin = durationMin;
    cuStream.cu_offsetSec = Math.max(0, elapsedSec - 5);

    _catchupJustStarted = Date.now();
    if(S.epgOpen) this.toggleEpg();
    if(S.chListOpen) this.toggleChList();
    showToast('Starte Timeshift...', 1500);
    this.play(null, cuStream, 'catchup');
  },

  _updateProgressUI: function(cur, tot) {
    if(!tot) return;
    var pct = Math.max(0, Math.min(100, (cur / tot * 100))).toFixed(2);
    // DOM-Referenzen nur einmalig abfragen und cachen (Performance-Boost)
    if(!this._uiCached) {
       this._ui = { fill: $('seek-fill'), thumb: $('seek-thumb'), cur: $('pc-cur-t'), tot: $('pc-tot-t') };
       this._uiCached = true;
    }
    if(this._ui.fill) this._ui.fill.style.width = pct + '%';
    if(this._ui.thumb) this._ui.thumb.style.left = 'calc(' + pct + '% - 12px)';
    if(this._ui.cur) this._ui.cur.textContent = fmtDur(cur);
    if(this._ui.tot) this._ui.tot.textContent = fmtDur(tot);
  },

  _checkBitrate:function(){
    if(!this.hls||!S.playerVisible) return;
    this._updateBadges();
  },

  play:function(url,stream,type){
    _streamLoadStart = Date.now();
    if (this._lastPlayedId !== (stream.stream_id || stream.series_id)) {
       this._retriedLive = false; 
       this._lastPlayedId = stream.stream_id || stream.series_id;
    }
    S._bingeCancelled = false;
    
    // Zapping Historie: Verlassenen Sender speichern, wenn zu neuem Live-Sender gewechselt wird
    if(type==='live' && !ZapHistory._goBackInProgress){
      var prevStream = S.currentStream;
      if(prevStream && prevStream.stream_id && (!stream || prevStream.stream_id !== stream.stream_id)){
        ZapHistory.add(prevStream);
      }
    }
    if (type === 'catchup' && !url) {
       var newStartMs = stream.cu_startMs + (stream.cu_offsetSec * 1000);
       var newDurMin = Math.max(1, stream.cu_durationMin - Math.floor(stream.cu_offsetSec / 60));
       var d = new Date(newStartMs);
       var startStr = d.getFullYear() + '-' + pad(d.getMonth()+1) + '-' + pad(d.getDate()) + ':' + pad(d.getHours()) + '-' + pad(d.getMinutes());
       url = API.catchupUrl({stream_id: stream.cu_original_id}, startStr, newDurMin);
    }
    this.destroy();
    S._bingeTriggered = false;
    S.currentStream=stream; S.playerType=type||S.tab;
    if(type==='live') buildVariants(stream);
    closeVariantBar();
    this._bitrate = 0; // Bitrate für neuen Stream zurücksetzen
    S.playerVisible=true;
    S._mediaErrorRetries = 0; // Fehler-Counter zurücksetzen
    S.epgOpen=false; S.chListOpen=false;
    if(typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
    this._closeSubPanel(); this._activeSubIdx=-1; $('sub-indicator').classList.add('hidden');
    this._closeAudioPanel();
    _seek.count=0; _seek.lastT=0;
    
    clearFocus(); // Fokus vom VOD/Catchup-Menü entfernen, damit im Live-TV "OK" wieder richtig funktioniert
    S.focusArea = 'player';

    var name=stream.name||stream.title||'', isLive=type==='live';
    $('p-vod-topname').textContent=isLive?'':name;
    $('btn-restart-vod').classList.toggle('hidden', isLive);
    $('btn-next-ep').classList.toggle('hidden', type !== 'series' || S.currentEpIdx + 1 >= S.currentEpsArray.length);
    if($('p-back-btn')) $('p-back-btn').classList.toggle('hidden', isLive);

    $('live-osd').classList.toggle('hidden',!isLive);
    $('live-osd').classList.toggle('compact-osd', Settings.compactOsd);
    $('live-osd').classList.toggle('hide-hints', !Settings.compactOsdHints);
    $('ctrl-vod').classList.toggle('hidden',isLive);
    $('vod-info-bar').innerHTML='';

    if(isLive){
      var icon=getStreamLogoWithEpgFallback(stream);
      $('osd-logo').src=icon||''; $('osd-logo').style.display=icon?'block':'none';
      $('osd-logo-ph').style.display=icon?'none':'flex';
      $('osd-ch-name').textContent=name;
      $('osd-show-title').innerHTML=''; $('osd-epg-time').textContent='';
      $('osd-prog-fill').style.width='0%'; $('osd-elapsed').textContent='';
      $('osd-remaining').textContent=''; $('osd-duration').textContent='';
      $('osd-next-row').innerHTML=''; $('osd-ends').textContent='';
      $('osd-badges').innerHTML='<span class="badge badge-buf">Buffering</span>';
      this.loadEpg(stream);
      this._startOsdClock();
    } else {
      $('seek-fill').style.width='0%'; $('seek-thumb').style.left='-12px';
      $('pc-cur-t').textContent='0:00'; $('pc-tot-t').textContent='0:00';
      setTimeout(function(){ SpatialNav.focusBySelector('#btn-pp-vod'); }, 50);
    }

    var startAt=0;
    if(!isLive){
      var rid=type==='series'?(stream.episode_id||stream.series_id):stream.stream_id;
      if(S.resume[rid]) startAt=S.resume[rid];
    }

    var self=this;
    // Zuerst natives HLS versuchen (webOS WebKit unterstützt es)
    var isHlsUrl=url.indexOf('.m3u8')!==-1||url.indexOf('/live/')!==-1;

    if(isHlsUrl&&window.Hls&&Hls.isSupported()&&!Settings.nativePlayer){
      this.hls=new Hls({
        maxBufferLength:isLive?10:30,
        maxMaxBufferLength:isLive?20:60,
        liveSyncDurationCount:2,
        liveMaxLatencyDurationCount:5,
        // Worker entlastet den Main-Thread auf älteren webOS-TVs deutlich.
        // Bei Problemen mit alten Geräten kann dies in Settings deaktiviert werden.
        enableWorker:true,
        // Demuxer im Worker läuft, weniger Stalls beim VOD-Scrollen
        lowLatencyMode:false,
        fragLoadingMaxRetry: 3, // Maximal 3 Chunk-Ladeversuche pro Fragment
        backBufferLength:isLive?15:30,
        startLevel:-1,
        abrEwmaDefaultEstimate:500000
      });
      this.hls.loadSource(url); this.hls.attachMedia(this.vid);
      this.hls.on(Hls.Events.MANIFEST_PARSED,function(){
        if(startAt>0) self.vid.currentTime=startAt;
        self.vid.play().catch(function(){});
        if(isLive){ self._updateBadges(); }
      });
      this.hls.on(Hls.Events.FRAG_BUFFERED,function(){
        $('buf-overlay').classList.add('hidden');
        if(isLive) self._updateBadges();
      });
      this.hls.on(Hls.Events.ERROR,function(_,d){
        if(d.fatal){
          if(d.type===Hls.ErrorTypes.NETWORK_ERROR){
            // Netzwerkfehler: Ladevorgang neu starten, aber nicht unendlich oft
            if (typeof self._hlsRetries === 'undefined') self._hlsRetries = 0;
            self._hlsRetries++;
            if(self._hlsRetries <= 3) {
               self.hls.startLoad();
            } else {
               showToast('Netzwerkfehler: Stream nicht erreichbar.', 3000);
            }
        } else if(d.type === Hls.ErrorTypes.MEDIA_ERROR) {
          // IPTV-Streams haben oft defekte Chunks. Hier versuchen wir eine stille Rettung!
          if(typeof S._mediaErrorRetries === 'undefined') S._mediaErrorRetries = 0;
          S._mediaErrorRetries++;
          
          if(S._mediaErrorRetries <= 5) {
             Logger.info('[Player] Media Error: Versuche automatische Recovery (' + S._mediaErrorRetries + '/5)...');
             self.hls.recoverMediaError();
             return;
          } else {
             showToast('Stream fehlerhaft. Kann nicht automatisch repariert werden.', 3000);
          }
          } else {
            // Anderer schwerwiegender Fehler: Toast zeigen, aber Player offen lassen
            // Schließen des Players verursacht hier den "OK funktioniert nach Scrollrad nicht"-Bug
            showToast('Stream-Fehler — UP/DOWN für anderen Sender',3000);
          }
        }
      });
      // Retry-Zähler bei erfolgreichem Laden zurücksetzen
      this.hls.on(Hls.Events.FRAG_LOADED, function() {
        self._hlsRetries = 0;
        S._mediaErrorRetries = 0;
      });
    } else {
      // Nativer Player (webOS, Safari) oder Nicht-HLS
      this.vid.src=url;
      if(startAt>0) this.vid.currentTime=startAt;
      this.vid.play().catch(function(){});
    }
    this.showControls();
  },

  _startOsdClock:function(){
    clearInterval(this._osdTimer);
    this._osdTimer=setInterval(function(){
      var s=S.currentStream; if(!s||S.playerType!=='live') return;
      // Zuerst XMLTV EPG versuchen
      if(EpgData.loaded){
        var epgId = EpgData.findId(s);
        if(epgId){
          Player._renderOsdFromEpgData(s); return;
        }
      }
      // Fallback: XC API Per-Stream-Cache
      var now=Date.now()/1000;
      var cur=findCurrentEpg(s.stream_id,now);
      if(cur){
        var st=getTs(cur,'start'),sp=getTs(cur,'stop');
        if(st&&sp){
          var titleStr = b64dec(cur.title||'');
          var remMs = (sp - now) * 1000;
          var remStr = remMs > 0 ? ' <span class="osd-rem-time">+' + Math.ceil(remMs/60000) + 'm</span>' : '';
          $('osd-show-title').innerHTML = esc(titleStr) + remStr;
          var total=sp-st, elapsed=now-st;
          $('osd-prog-fill').style.width=Math.min(100,elapsed/total*100).toFixed(1)+'%';
          $('osd-elapsed').textContent=fmtDur(elapsed)+' verstr.';
          $('osd-remaining').textContent=fmtDur(Math.max(0,sp-now))+' verbl.';
          $('osd-duration').textContent=fmtDur(total);
          $('osd-ends').textContent=fmtTime(st)+' \u2013 '+fmtTime(sp);
        }
      }
    },CONFIG.OSD_INTERVAL);
  },

  loadEpg: async function(stream){
    if(!stream) return;
    var self=this;
    var streamId=stream.stream_id; if(!streamId) return;

    // Zuerst XMLTV EPG versuchen
    if(EpgData.loaded){
      var epgId = EpgData.findId(stream);
      if(epgId && EpgData.programmes[epgId] && EpgData.programmes[epgId].length > 0){
        this._renderOsdFromEpgData(stream);
        if(S.epgOpen) this.renderEpgPanel(streamId);
        return;
      }
    }

    // 1. Aus der TV-Datenbank (IndexedDB) laden
    var cached = await EPGStore.get(streamId);
    if(cached && cached.length > 0){
      epgCachePut(streamId, cached);
      self._renderOsdFromCache(streamId);
      if(S.epgOpen) self.renderEpgPanel(streamId);
    }
  },

  _renderOsdFromEpgData: function(stream){
    var cur=EpgData.getNow(stream), nxt=EpgData.getNext(stream);
    if(cur){
      var remMs = cur.stop.getTime() - Date.now();
      var remStr = remMs > 0 ? ' <span class="osd-rem-time">+' + Math.ceil(remMs/60000) + 'm</span>' : '';
      $('osd-show-title').innerHTML = esc(cur.title) + remStr;
      $('osd-epg-time').textContent=fmtTimeMs(cur.start)+' – '+fmtTimeMs(cur.stop);
      var total=cur.stop.getTime()-cur.start.getTime();
      var elapsed=Date.now()-cur.start.getTime();
      $('osd-prog-fill').style.width=Math.min(100,elapsed/total*100).toFixed(1)+'%';
      $('osd-elapsed').textContent=fmtDur(elapsed/1000)+' verstr.';
      $('osd-remaining').textContent=fmtDur(Math.max(0,(cur.stop.getTime()-Date.now())/1000))+' verbl.';
      $('osd-duration').textContent=fmtDur(total/1000);
      $('osd-ends').textContent=fmtTimeMs(cur.start)+' \u2013 '+fmtTimeMs(cur.stop);
    }
    if(nxt){
      $('osd-next-row').innerHTML='&#9654; Danach: <strong>'+esc(nxt.title)+'</strong> '+fmtTimeMs(nxt.start)+'–'+fmtTimeMs(nxt.stop);
    }
  },

  _renderOsdFromCache: function(streamId){
    var now=Date.now()/1000, items=S.epgCache[streamId]||[], cur=null, nxt=null;
    for(var i=0;i<items.length;i++){
      var st=getTs(items[i],'start'), sp=getTs(items[i],'stop');
      if(!cur&&st&&sp&&st<=now&&sp>now) cur=items[i];
      if(!nxt&&st&&st>now) nxt=items[i];
    }
    if(cur){
      var cst=getTs(cur,'start'),csp=getTs(cur,'stop');
      var remMs = (csp - now) * 1000;
      var remStr = remMs > 0 ? ' <span class="osd-rem-time">+' + Math.ceil(remMs/60000) + 'm</span>' : '';
      $('osd-show-title').innerHTML = esc(b64dec(cur.title||'')) + remStr;
      $('osd-epg-time').textContent=fmtTime(cst)+' – '+fmtTime(csp);
      if(cst&&csp){
        var total=csp-cst, elapsed=now-cst;
        $('osd-prog-fill').style.width=Math.min(100,elapsed/total*100).toFixed(1)+'%';
        $('osd-elapsed').textContent=fmtDur(elapsed)+' verstr.';
        $('osd-remaining').textContent=fmtDur(Math.max(0,csp-now))+' verbl.';
        $('osd-duration').textContent=fmtDur(total);
        $('osd-ends').textContent=fmtTime(cst)+' \u2013 '+fmtTime(csp);
      }
    }
    if(nxt){
      $('osd-next-row').innerHTML='&#9654; Danach: <strong>'+esc(b64dec(nxt.title||''))+'</strong> '+fmtTime(getTs(nxt,'start'))+'–'+fmtTime(getTs(nxt,'stop'));
    }
  },

  renderEpgPanel:function(streamId){
    var body=$('epg-body'), html='';
    $('epg-ch-name').textContent=(S.currentStream&&S.currentStream.name)||'';
    
    var archiveDays = 0;
    var cuStream = S.currentStream;
    if(S.currentStream){
      if(S.currentStream.tv_archive == 1){
        archiveDays = parseInt(S.currentStream.tv_archive_duration||0);
      } else {
        var base = _baseName(S.currentStream.name);
        for(var k=0; k<S.streams.length; k++){
          if(S.streams[k].tv_archive == 1 && _baseName(S.streams[k].name) === base){
            archiveDays = parseInt(S.streams[k].tv_archive_duration||0);
            cuStream = S.streams[k];
            break;
          }
        }
      }
    }
    var shiftMs = (Settings.epgShift || 0) * 3600000;
    var nowSec=Date.now()/1000;

    // 1. Priorität: Eigene XMLTV EPG-Daten nutzen (inkl. Replay)
    if(EpgData.loaded && S.currentStream){
      var epgId = EpgData.findId(S.currentStream);
      var progs = epgId ? EpgData.programmes[epgId] : null;
      if(progs && progs.length > 0){
        for(var i=0; i<progs.length; i++){
          var p = progs[i];
          var st = p.start.getTime()/1000;
          var sp = p.stop.getTime()/1000;
          var isNow = st <= nowSec && sp > nowSec;
          var isPast = sp && sp <= nowSec;
          var canCatchup = archiveDays > 0 && isPast && (nowSec - sp <= archiveDays * 86400);
          var cls = 'epg-item' + (isNow?' now':'') + (canCatchup?' catchup-item':'');
          var badge = isNow ? '<span class="now-badge">JETZT</span>' : (canCatchup ? '<span class="now-badge" style="background:#8b5cf6">REPLAY</span>' : '');
          var attrs = canCatchup ? ' data-cu-start="'+(st*1000)+'" data-cu-stop="'+(sp*1000)+'" data-cu-id="'+cuStream.stream_id+'"' : '';
          html+='<div class="'+cls+'" data-focusable'+attrs+'><div class="epg-time">'+fmtTime(st)+'\u2013'+fmtTime(sp)+badge+'</div>'
            +'<div class="epg-title">'+esc(p.title)+'</div>'
            +(p.description?'<div class="epg-desc">'+esc(p.description)+'</div>':'')+'</div>';
        }
        body.innerHTML=html;
        var nowEl = body.querySelector('.now'); if(nowEl) nowEl.scrollIntoView({block:'center'});
        return;
      }
    }

    // Fallback: XC API Cache
    var items=S.epgCache[streamId]||[];
    if(!items.length){ body.innerHTML='<div style="padding:22px;color:var(--lo)">Keine EPG-Daten</div>'; return; }
    var nowSec=Date.now()/1000;
    var shiftSec = (Settings.epgShift || 0) * 3600;
    for(var j=0;j<items.length;j++){
      var e=items[j];
      var st=getTs(e,'start'),sp=getTs(e,'stop');
      var isNow2=st&&sp&&st<=nowSec&&sp>nowSec;
      var isPast2 = sp && sp <= nowSec;
      var canCatchup2 = archiveDays > 0 && isPast2 && (nowSec - sp <= archiveDays * 86400);
      var cls2 = 'epg-item' + (isNow2?' now':'') + (canCatchup2?' catchup-item':'');
      var badge2 = isNow2 ? '<span class="now-badge">JETZT</span>' : (canCatchup2 ? '<span class="now-badge" style="background:#8b5cf6">REPLAY</span>' : '');
      var attrs2 = canCatchup2 ? ' data-cu-start="'+(st*1000)+'" data-cu-stop="'+(sp*1000)+'" data-cu-id="'+cuStream.stream_id+'"' : '';
      var title=b64dec(e.title||''), desc=b64dec(e.description||'');
      html+='<div class="'+cls2+'" data-focusable'+attrs2+'><div class="epg-time">'+fmtTime(st)+'\u2013'+fmtTime(sp)+badge2+'</div>'
        +'<div class="epg-title">'+esc(title)+'</div>'
        +(desc?'<div class="epg-desc">'+esc(desc)+'</div>':'')+'</div>';
    }
    body.innerHTML=html;
    var nowEl2=body.querySelector('.now'); if(nowEl2) nowEl2.scrollIntoView({block:'center'});
  },

  toggleEpg:function(){
    // Bei Aktivierung zum erweiterten EPG-Grid weiterleiten
    if(Settings.extendedEpg && EpgData.loaded){
      if(EpgGrid.open){ EpgGrid.close(); }
      else { EpgGrid.toggle(); }
      return;
    }
    // Standard Seiten-Panel
    S.epgOpen=!S.epgOpen;
    if(S.epgOpen&&S.currentStream) {
      S.focusArea = 'epg';
      if(typeof FocusTrap !== 'undefined') FocusTrap.trap('epg-panel');
      this.renderEpgPanel(S.currentStream.stream_id);
      if(typeof _resetAutoClose === 'function') _resetAutoClose();
      setTimeout(function(){ SpatialNav.focusBySelector('.epg-item.now') || SpatialNav.focusBySelector('.epg-item'); }, 150);
    } else {
      if(typeof FocusTrap !== 'undefined') FocusTrap.release('epg-panel');
      clearFocus();
    }
    this.showControls();
  },

  toggleChList:function(){
    if(S.playerType!=='live') return;
    S.chListOpen=!S.chListOpen;
    S.chListFocusArea = 'streams';
    S.chListCatView = false; // Kategorie-Ansicht beim Umschalten immer zurücksetzen
    $('ch-list-overlay').classList.remove('cat-view');
        $('ch-list-overlay').classList.remove('focus-cats');
    $('ch-list-overlay').classList.toggle('compact', Settings.compactList);
    $('ch-list-overlay').classList.toggle('split-mode', Settings.splitList);
    if(S.chListOpen){
      
      var opts = buildCatOpts();
      var targetCatId = S.currentStream ? S.currentStream.category_id : null;
      var foundIdx = 0;
      if(targetCatId) {
         for(var i=0; i<opts.length; i++) {
                if(String(opts[i].id) === String(targetCatId)) { foundIdx = i; break; }
         }
      }
      
      if(S.chListCatIdx !== foundIdx) {
         S.chListCatIdx = foundIdx;
         initChListOverlay();
         chListCatChange(0);
      } else {
         S.chListCursor = 0;
         if(S.currentStream){
          var baseCur = _baseName(S.currentStream.name);
          for(var j=0; j<S.filteredStreams.length; j++){
            if(S.filteredStreams[j].stream_id === S.currentStream.stream_id){ S.chListCursor = j; break; }
            if(Settings.groupVariants && _baseName(S.filteredStreams[j].name)===baseCur) { S.chListCursor=j; break; }
           }
         }
         S_CLO_OFFSET = Math.max(0, S.chListCursor - Math.floor(VLIST_ROWS/2));
         initChListOverlay();
         renderChListOverlay();
      }
      S.chListSplitCatCursor = S.chListCatIdx;
      if (Settings.splitList) renderChListSplitCats();
    } else {
      // Ohne Auswahl geschlossen — filteredStreams auf Kontext des aktuellen Streams zurücksetzen
      if(S.currentStream && S.streams && S.streams.length > 0) {
        var targetCatId = S.currentStream.category_id;
        var opts = buildCatOpts();
        var foundIdx = 0;
        if(targetCatId) {
          for(var r=0; r<opts.length; r++) {
            if(String(opts[r].id) === String(targetCatId)) { foundIdx = r; break; }
          }
        }
        S.chListCatIdx = foundIdx;
        var restoreArr = S.streams;
        var opt = opts[foundIdx];
        if(opt && opt.id === 'fav') {
          restoreArr = restoreArr.filter(function(s){ return S.favs.live.indexOf(s.stream_id)!==-1; });
        } else if(opt && opt.id !== null) {
          restoreArr = restoreArr.filter(function(s){ return String(s.category_id) === String(opt.id); });
        }
        S.filteredStreams = applyVariantGrouping(restoreArr);
        // currentStreamIdx neu berechnen
        S.currentStreamIdx = 0;
        var baseCur = _baseName(S.currentStream.name);
        for(var ri=0; ri<S.filteredStreams.length; ri++){
          if(S.filteredStreams[ri].stream_id === S.currentStream.stream_id){ S.currentStreamIdx=ri; break; }
          if(Settings.groupVariants && _baseName(S.filteredStreams[ri].name)===baseCur){ S.currentStreamIdx=ri; break; }
        }
      }
      this.showControls();
    }
  },

  nextCh:function(){
    if(S.playerType!=='live') return;
    if(S.currentStreamIdx<S.filteredStreams.length-1){
      S.currentStreamIdx++;
      var s=S.filteredStreams[S.currentStreamIdx];
      saveLastStream(s); this.play(API.liveUrl(s),s,'live');
    } else showToast('Letzter Sender');
  },
  prevCh:function(){
    if(S.playerType!=='live') return;
    if(S.currentStreamIdx>0){
      S.currentStreamIdx--;
      var s=S.filteredStreams[S.currentStreamIdx];
      saveLastStream(s); this.play(API.liveUrl(s),s,'live');
    } else showToast('Erster Sender');
  },
  nextEp:function(){
    if(S.currentEpIdx+1<S.currentEpsArray.length) playEpisode(S.currentEpIdx+1);
    else showToast('Letzte Episode',1500);
  },

  _updateBadges:function(){
    var v=this.vid, w=v.videoWidth, h=v.videoHeight, badges='';
    if(S.playerType==='live'&&$('buf-overlay').classList.contains('hidden')){
      // Streaming-Infos anzeigen
    }
    if(w&&h){
      var res=h>=2160?'4K':h>=1080?'1080p':h>=720?'720p':h>=576?'576p':'SD';
      badges+='<span class="badge badge-res">'+res+'</span>';
    } else {
      badges+='<span class="badge badge-buf">Buffering</span>';
    }
    if(w&&h){
      var gf=function(a,b){ return b?gf(b,a%b):a; }, g=gf(w,h), rw=w/g, rh=h/g;
      var ar=Math.abs(rw/rh-16/9)<0.05?'16:9':Math.abs(rw/rh-4/3)<0.05?'4:3':Math.abs(rw/rh-21/9)<0.05?'21:9':rw+':'+rh;
      badges+='<span class="badge badge-ar">'+ar+'</span>';
    }
    if(this.hls&&this.hls.levels&&this.hls.levels.length){
      var lvl=this.hls.levels[Math.max(0,this.hls.currentLevel)];
      var vc=(lvl&&lvl.videoCodec)||'';
      var codec=vc.indexOf('hvc1')!==-1||vc.indexOf('hev1')!==-1?'H.265':vc.indexOf('avc')!==-1?'H.264':vc.indexOf('av01')!==-1?'AV1':'';
      if(codec) badges+='<span class="badge badge-codec">'+codec+'</span>';

      var ac=(lvl&&lvl.audioCodec)||'';
      var audio=ac.indexOf('ec-3')!==-1?'EAC3':ac.indexOf('ac-3')!==-1?'AC3':ac.indexOf('mp4a')!==-1?'AAC':ac.indexOf('opus')!==-1?'Opus':'';
      if(audio) badges+='<span class="badge badge-audio">'+audio+'</span>';

      if(lvl.frameRate) badges+='<span class="badge badge-ar">'+Math.round(lvl.frameRate)+' FPS</span>';
    }

    var br = (this.hls && this.hls.levels && this.hls.levels[Math.max(0, this.hls.currentLevel||0)] && this.hls.levels[Math.max(0, this.hls.currentLevel||0)].bitrate) || this._bitrate;
    if(br) {
      var kbps=Math.round(br/1000);
      var mbps=kbps>=1000?(kbps/1000).toFixed(1)+' Mbps':kbps+' Kbps';
      badges+='<span class="badge badge-br">'+mbps+'</span>';
    }

    // Bei VOD: Auch in der Info-Leiste anzeigen
    if(S.playerType!=='live'){
      $('vod-info-bar').innerHTML=badges;
    } else {
      $('osd-badges').innerHTML=badges;
    }
  },

  // Wird aufgerufen, wenn die App in den Hintergrund geht (Home-Taste)
  suspend:function(){
    if(!S.playerVisible||this._suspended) return;
    this._suspended=true;
    this._resumeStream=S.currentStream;
    this._resumeType=S.playerType;
    if(this.hls){ this.hls.destroy(); this.hls=null; }
    // Video-Element komplett zerstören und neu erstellen — webOS Media Pipeline
    // läuft in einem separaten Prozess; removeAttribute('src') allein reicht nicht aus
    var old=this.vid;
    old.pause(); old.removeAttribute('src'); old.innerHTML=''; old.load();
    var fresh=document.createElement('video');
    fresh.id=old.id; fresh.autoplay=true; fresh.setAttribute('playsinline','');
    old.parentNode.replaceChild(fresh,old);
    this.vid=fresh;
    // Events über gemeinsame Methode neu binden
    this._bindVideoEvents();
    $('buf-overlay').classList.add('hidden');
  },
  resume:function(){
    if(!this._suspended) return;
    this._suspended=false;
    if(this._resumeStream&&S.playerVisible){
      var url;
      if(this._resumeType==='live') url=API.liveUrl(this._resumeStream);
      else if(this._resumeType==='series') url=API.epUrl(this._resumeStream);
      else url=API.vodUrl(this._resumeStream);
      this.play(url,this._resumeStream,this._resumeType);
    }
  },
  destroy:function(){
    clearInterval(this._osdTimer);
    if(this.hls){ this.hls.destroy(); this.hls=null; }
    this.vid.pause(); this.vid.removeAttribute('src'); this.vid.load();
    $('buf-overlay').classList.add('hidden');
  },
  close:function(){
    BingeMode.stop();
    if(typeof FocusTrap !== 'undefined') FocusTrap.clearAll();
    if(S.playerType === 'catchup') {
      _catchupJustStarted = 0; // Zurücksetzen, damit OK im Live-Modus die Senderliste öffnet
      var last = loadLastStream();
      if(last) {
        this.play(API.liveUrl(last), last, 'live');
        return;
      }
    }
    this.destroy();
    S.playerVisible=false; S.epgOpen=false; S.chListOpen=false;
    if(typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
    
    if(S.seriesDetailOpen) {
      $('series-detail').classList.remove('hidden');
      S.focusArea='series_ep';
      updateFocus();
    } else if(S.screen==='main') {
      var ca=$('content-area');
      if(ca && ca.classList.contains('nf-mode')){
        S.focusArea='netflix';
        if(typeof NF !== 'undefined' && NF._updateFocusDOM) NF._updateFocusDOM();
      } else {
        S.focusArea='grid';
        updateFocus();
      }
    } else if(S.screen==='continue') {
      S.focusArea='continue';
      updateFocus();
    } else {
      // Fallback für Live/Unbekannt — Systemmenü öffnen
      openSysSidebar();
    }
  },
  togglePP:function(){ this.vid.paused?this.vid.play().catch(function(){}):this.vid.pause(); },

  // ── SUBTITLES ──────────────────────────────────────────────
  _activeSubIdx: -1,   // -1 = off

  toggleSubtitles: function(){
    if(S.subPanelOpen){ this._closeSubPanel(true); return; }
    if(S.audioPanelOpen) this._closeAudioPanel();
    var tracks = this._getSubTracks();
    if(tracks.length === 0){
      showToast('Keine Untertitel verfügbar', 2000);
      return;
    }
    S.subPanelOpen = true;
    this._renderSubPanel(tracks);
    if(typeof FocusTrap !== 'undefined') FocusTrap.trap('sub-panel');
    this.showControls();
  },

  _closeSubPanel: function(restoreFocus){
    S.subPanelOpen = false;
    if(typeof FocusTrap !== 'undefined') FocusTrap.release('sub-panel');
    if(restoreFocus){
      setTimeout(function(){ SpatialNav.focusBySelector('#btn-pp-vod'); }, 50);
      Player.showControls();
    }
  },

  _getSubTracks: function(){
    var tracks = [];
    // 1. HLS.js Untertitel-Spuren
    if(this.hls && this.hls.subtitleTracks && this.hls.subtitleTracks.length > 0){
      for(var i = 0; i < this.hls.subtitleTracks.length; i++){
        var t = this.hls.subtitleTracks[i];
        tracks.push({
          idx: i,
          label: t.name || t.lang || ('Spur ' + (i+1)),
          lang: t.lang || '',
          source: 'hls'
        });
      }
    }
    // 2. Native Video-Textspuren
    var vt = this.vid.textTracks;
    if(vt && vt.length > 0){
      for(var j = 0; j < vt.length; j++){
        if(vt[j].kind === 'subtitles' || vt[j].kind === 'captions'){
          tracks.push({
            idx: j,
            label: vt[j].label || vt[j].language || ('Spur ' + (j+1)),
            lang: vt[j].language || '',
            source: 'native'
          });
        }
      }
    }
    return tracks;
  },

  _renderSubPanel: function(tracks){
    var html = '<div class="sub-item' + (this._activeSubIdx === -1 ? ' sub-active' : '') + '" data-focusable data-sub-idx="-1">'
      + '<div class="sub-dot"></div>Aus</div>';
    for(var i = 0; i < tracks.length; i++){
      var t = tracks[i];
      var isActive = (t.source === 'hls' && this.hls && this.hls.subtitleTrack === t.idx)
        || (t.source === 'native' && this._activeSubIdx === t.idx);
      html += '<div class="sub-item' + (isActive ? ' sub-active' : '') + '" data-focusable data-sub-idx="' + t.idx + '" data-sub-src="' + t.source + '">'
        + '<div class="sub-dot"></div>' + esc(t.label)
        + (t.lang ? ' <span style="color:var(--lo)">(' + esc(t.lang) + ')</span>' : '')
        + '</div>';
    }
    $('sub-list').innerHTML = html;

    // Klick-Handler
    $('sub-list').querySelectorAll('.sub-item').forEach(function(item){
      item.addEventListener('click', function(){
        var idx = parseInt(item.getAttribute('data-sub-idx'));
        var src = item.getAttribute('data-sub-src') || '';
        Player._selectSubTrack(idx, src);
      });
    });
    setTimeout(function(){ SpatialNav.focusBySelector('#sub-list .sub-active') || SpatialNav.focusBySelector('#sub-list .sub-item'); }, 50);
  },

  _selectSubTrack: function(idx, source){
    // Zuerst alle deaktivieren
    var vt = this.vid.textTracks;
    for(var i = 0; i < vt.length; i++){
      vt[i].mode = 'disabled';
    }
    if(this.hls && this.hls.subtitleTracks && this.hls.subtitleTracks.length > 0){
      this.hls.subtitleTrack = -1;
      this.hls.subtitleDisplay = false;
    }

    if(idx === -1){
      // Aus
      this._activeSubIdx = -1;
      $('sub-indicator').classList.add('hidden');
      showToast('Untertitel aus', 1500);
    } else if(source === 'hls' && this.hls){
      this.hls.subtitleTrack = idx;
      this.hls.subtitleDisplay = true;
      this._activeSubIdx = idx;
      $('sub-indicator').classList.remove('hidden');
      var label = this.hls.subtitleTracks[idx] ? (this.hls.subtitleTracks[idx].name || 'CC') : 'CC';
      showToast('Untertitel: ' + label, 1500);
    } else {
      // Nativ
      if(vt[idx]){
        vt[idx].mode = 'showing';
        this._activeSubIdx = idx;
        $('sub-indicator').classList.remove('hidden');
        showToast('Untertitel: ' + (vt[idx].label || vt[idx].language || 'CC'), 1500);
      }
    }
    this._closeSubPanel(true);
  },

  toggleAudio: function(){
    if(S.audioPanelOpen){ this._closeAudioPanel(true); return; }
    if(S.subPanelOpen) this._closeSubPanel();
    var tracks = this._getAudioTracks();
    if(tracks.length === 0){
      showToast('Keine weiteren Audiospuren verfügbar', 2000);
      return;
    }
    S.audioPanelOpen = true;
    this._renderAudioPanel(tracks);
    if(typeof FocusTrap !== 'undefined') FocusTrap.trap('audio-panel');
    this.showControls();
  },

  _closeAudioPanel: function(restoreFocus){
    S.audioPanelOpen = false;
    if(typeof FocusTrap !== 'undefined') FocusTrap.release('audio-panel');
    if(restoreFocus){
      setTimeout(function(){ SpatialNav.focusBySelector('#btn-pp-vod'); }, 50);
      Player.showControls();
    }
  },

  _getAudioTracks: function(){
    var tracks = [];
    if(this.hls && this.hls.audioTracks && this.hls.audioTracks.length > 0){
      for(var i = 0; i < this.hls.audioTracks.length; i++){
        var t = this.hls.audioTracks[i];
        tracks.push({ idx: i, label: t.name || t.lang || ('Spur ' + (i+1)), source: 'hls' });
      }
    } else if(this.vid.audioTracks && this.vid.audioTracks.length > 0){
      for(var j = 0; j < this.vid.audioTracks.length; j++){
        var at = this.vid.audioTracks[j];
        tracks.push({ idx: j, label: at.label || at.language || ('Spur ' + (j+1)), source: 'native' });
      }
    }
    return tracks;
  },

  _renderAudioPanel: function(tracks){
    var html = '';
    var activeIdx = -1;
    if(this.hls) activeIdx = this.hls.audioTrack;
    else if(this.vid.audioTracks){
      for(var k=0; k<this.vid.audioTracks.length; k++) if(this.vid.audioTracks[k].enabled) activeIdx=k;
    }
    for(var i = 0; i < tracks.length; i++){
      var t = tracks[i];
      var isActive = (t.idx === activeIdx);
      html += '<div class="sub-item' + (isActive ? ' sub-active' : '') + '" data-focusable data-audio-idx="' + t.idx + '" data-audio-src="' + t.source + '">'
        + '<div class="sub-dot"></div>' + esc(t.label)
        + '</div>';
    }
    $('audio-list').innerHTML = html;

    $('audio-list').querySelectorAll('.sub-item').forEach(function(item){
      item.addEventListener('click', function(){
        Player._selectAudioTrack(parseInt(item.getAttribute('data-audio-idx')), item.getAttribute('data-audio-src'));
      });
    });
    setTimeout(function(){ SpatialNav.focusBySelector('#audio-list .sub-active') || SpatialNav.focusBySelector('#audio-list .sub-item'); }, 50);
  },

  _selectAudioTrack: function(idx, source){
    if(source === 'hls' && this.hls){
      this.hls.audioTrack = idx;
      showToast('Audiospur gewechselt', 1500);
    } else if(source === 'native' && this.vid.audioTracks){
      for(var i=0; i<this.vid.audioTracks.length; i++){
        this.vid.audioTracks[i].enabled = (i === idx);
      }
      showToast('Audiospur gewechselt', 1500);
    }
    this._closeAudioPanel(true);
  },

  showControls:function(){
    $('player-topbar').classList.remove('fade');
    clearTimeout(S.controlsTimer);
    
    if(S.chListOpen || S.epgOpen){
      $('live-osd').classList.add('fade');
      $('ctrl-vod').classList.add('fade');
    } else {
      $('live-osd').classList.remove('fade');
      $('ctrl-vod').classList.remove('fade');
      if(!S.subPanelOpen && !S.audioPanelOpen){
        S.controlsTimer=setTimeout(function(){
          Player._closeSubPanel();
          Player._closeAudioPanel();
          $('player-topbar').classList.add('fade');
          $('live-osd').classList.add('fade');
          $('ctrl-vod').classList.add('fade');
        }, CONFIG.CONTROLS_FADE_MS);
      }
    }
  }
};

function seekClick(e){
  var t=$('seek-track'),rect=t.getBoundingClientRect();
  var pct=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width));
  if (S.playerType === 'catchup' && S.currentStream) {
     S.currentStream.cu_offsetSec = Math.floor(pct * S.currentStream.cu_durationMin * 60);
     showToast('Lade Stream...', 1000);
     Player.play(null, S.currentStream, 'catchup');
     Player.showControls();
     return;
  }
  var v=Player.vid; if(v&&v.duration){ v.currentTime=pct*v.duration; Player.showControls(); }
}