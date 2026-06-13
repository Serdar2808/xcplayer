// ================================================================
//  XC PLAYER PRO  —  Kompletter Build
// ================================================================

// ── ZENTRALE UI-REAKTIONEN AUF STATE-ÄNDERUNGEN ─────────────────
StateEvents.on('screenChanged', function(data) {
  var screenMap = {
    'profile': 'profile-screen',
    'wizard': 'wizard-screen',
    'main': 'main-screen',
    'continue': 'continue-screen',
    'settings': 'settings-screen',
    'live': 'player-screen'
  };
  
  // Alle bekannten Screens verstecken, neuen einblenden (robust)
  Object.keys(screenMap).forEach(function(key) {
    var el = document.getElementById(screenMap[key]);
    if (el) {
      if (key === data.new) {
        el.classList.remove('hidden');
      } else {
        el.classList.add('hidden');
      }
    }
  });
  
  // Globale Navbar-Sichtbarkeit automatisch anpassen
  if (typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
});

StateEvents.on('playerVisibleChanged', function(isVisible) {
  var ps = document.getElementById('player-screen');
  if (!ps) return;
  if (isVisible) {
    ps.classList.remove('hidden');
    var ms = document.getElementById('main-screen'); if (ms) ms.classList.add('hidden');
    var cs = document.getElementById('continue-screen'); if (cs) cs.classList.add('hidden');
  } else {
    ps.classList.add('hidden');
    if (typeof $ !== 'undefined') {
      if($('live-osd')) $('live-osd').classList.add('hidden');
      if($('ctrl-vod')) $('ctrl-vod').classList.add('hidden');
      if($('player-topbar')) $('player-topbar').classList.add('fade');
      S.subPanelOpen = false;
      S.audioPanelOpen = false;
      if($('epg-grid-overlay')) $('epg-grid-overlay').classList.add('hidden');
    }
    
    // Wiederherstellen der Bildschirme im Hintergrund, wenn der Player beendet wird
    if (S.screen === 'main' && !S.seriesDetailOpen) {
      var ms2 = document.getElementById('main-screen'); if (ms2) ms2.classList.remove('hidden');
    } else if (S.screen === 'continue') {
      var cs2 = document.getElementById('continue-screen'); if (cs2) cs2.classList.remove('hidden');
    }
  }
  if (typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
});

StateEvents.on('epgOpenChanged', function(isOpen) {
  var panel = document.getElementById('epg-panel');
  if (panel) panel.classList.toggle('open', isOpen);
});

StateEvents.on('chListOpenChanged', function(isOpen) {
  var overlay = document.getElementById('ch-list-overlay');
  if (!overlay) return;
  if (isOpen) {
    overlay.classList.remove('hidden');
    var osd = document.getElementById('live-osd');
    if (osd) osd.classList.add('fade');
    var topbar = document.getElementById('player-topbar');
    if (topbar) topbar.classList.add('fade');
    S.variantBarOpen = false;
  } else {
    overlay.classList.add('hidden');
  }
});

StateEvents.on('variantBarOpenChanged', function(isOpen) {
  var vbar = document.getElementById('variant-bar');
  if (vbar) vbar.classList.toggle('hide', !isOpen);
});

StateEvents.on('epgGridOpenChanged', function(isOpen) {
  var overlay = document.getElementById('epg-grid-overlay');
  if (!overlay) return;
  if (isOpen) {
    overlay.classList.remove('hidden');
    var osd = document.getElementById('live-osd');
    if (osd) osd.classList.add('fade');
    var topbar = document.getElementById('player-topbar');
    if (topbar) topbar.classList.add('fade');
    if (typeof Player !== 'undefined') Player.showControls();
  } else {
    overlay.classList.add('hidden');
    if (typeof Player !== 'undefined') Player.showControls();
  }
});

StateEvents.on('seriesDetailOpenChanged', function(isOpen) {
  var sd = document.getElementById('series-detail');
  var ms = document.getElementById('main-screen');
  if (isOpen) {
    if (sd) sd.classList.remove('hidden');
    if (ms) ms.classList.add('hidden');
  } else {
    if (sd) sd.classList.add('hidden');
    if (ms) ms.classList.remove('hidden');
  }
});

StateEvents.on('subPanelOpenChanged', function(isOpen) {
  var panel = document.getElementById('sub-panel');
  if (panel) panel.classList.toggle('hidden', !isOpen);
});

StateEvents.on('audioPanelOpenChanged', function(isOpen) {
  var panel = document.getElementById('audio-panel');
  if (panel) panel.classList.toggle('hidden', !isOpen);
});

StateEvents.on('settingsCatChanged', function(cat) {
  var mainView = document.getElementById('set-view-main');
  var detailView = document.getElementById('set-view-detail');
  var titleEl = document.getElementById('set-title');

  if (cat) {
    if (mainView) mainView.classList.add('hidden');
    if (detailView) detailView.classList.remove('hidden');

    document.querySelectorAll('.set-cat-group').forEach(function(el) { el.classList.add('hidden'); });
    var catEl = document.getElementById('set-cat-' + cat);
    if (catEl) catEl.classList.remove('hidden');

    var titles = { 'ansicht': '🎨 Ansicht & Darstellung', 'player': '⚙️ Wiedergabe & Player', 'playlist': '📋 Playlist & Sender', 'system': '👤 Konto & System' };
    if (titleEl) titleEl.textContent = titles[cat] || 'Einstellungen';
  } else {
    if (detailView) detailView.classList.add('hidden');
    if (mainView) mainView.classList.remove('hidden');
    if (titleEl) titleEl.textContent = 'Einstellungen';
  }
});

// ── AUTO-CLOSE TIMEOUTS ─────────────────────────────────────────
var _autoCloseTimer = null;
function _resetAutoClose(){
  clearTimeout(_autoCloseTimer);
  if(S.chListOpen){
    _autoCloseTimer = setTimeout(function(){ if(S.chListOpen) Player.toggleChList(); }, CONFIG.PANEL_AUTO_CLOSE_MS);
  } else if(S.epgOpen){
    _autoCloseTimer = setTimeout(function(){ if(S.epgOpen) Player.toggleEpg(); }, CONFIG.PANEL_AUTO_CLOSE_MS);
  }
}
// Auto-Close bei jedem Tastendruck zurücksetzen
document.addEventListener('keydown', function(){ if(S.chListOpen || S.epgOpen) _resetAutoClose(); }, true);

// ── BACKGROUND PLAYLIST REFRESH ──────────────────────────────────
var PlaylistRefresh = {
  _timer: null,
  
  start: function(){
    this.stop();
    var self = this;
    this._timer = setInterval(function(){ self._refresh(); }, CONFIG.PLAYLIST_REFRESH_MS);
    Logger.info('[PlaylistRefresh] Started, interval:', CONFIG.PLAYLIST_REFRESH_MS/1000, 's');
  },
  
  stop: function(){
    if(this._timer){ clearInterval(this._timer); this._timer = null; }
  },
  
  _refresh: async function(){
    // Während aktiver Wiedergabe oder ohne Profil nicht aktualisieren
    if(S.playerVisible || !Profiles.getActive()) return;
    if(S.isM3U) return; // M3U-Aktualisierung würde die komplette Datei neu laden
    
    Logger.info('[PlaylistRefresh] Running background update...');
    var oldCounts = {
      live: S.fullStreams.live ? S.fullStreams.live.length : -1,
      vod: S.fullStreams.vod ? S.fullStreams.vod.length : -1,
      series: S.fullStreams.series ? S.fullStreams.series.length : -1
    };
    
    // Cache leeren, um Neu-Abruf zu erzwingen
    S.rawCategories = { live: null, vod: null, series: null };
    S.rawStreams = { live: null, vod: null, series: null };
    S.fullStreams = { live: null, vod: null, series: null };
    S.seriesInfoCache = {};
    PlaylistDB.clear();
    
    // Wenn auf Hauptbildschirm, aktuellen Tab aktualisieren
    if(S.screen === 'main' && S.tab){
      try {
        var arr = await getAllStreamsForTab();
        var newCount = arr.length;
        var oldCount = oldCounts[S.tab];
        
        if(oldCount >= 0 && newCount !== oldCount){
          showToast('Playlist aktualisiert (' + newCount + ' Einträge)', 2500);
          // Aktuelle Ansicht neu laden
          await loadStreams(S.selectedCat);
        }
      } catch(e){ Logger.warn('[PlaylistRefresh] error:', e.message); }
    }
    
  }
};

// ── SUSPEND / RESUME (webOS Home button) ─────────────────────────
document.addEventListener('visibilitychange',function(){
  if(document.hidden) Player.suspend(); else Player.resume();
});
window.addEventListener('blur',function(){ /* Ignoriert: Erlaubt TV Einstellungen Overlay ohne Stopp */ });
window.addEventListener('focus',function(){ /* Ignoriert */ });

// ── LUNA SERVICE FOREGROUND DETECTION ────────────────────────────
// visibilitychange/blur feuern auf webOS unzuverlässig — Luna Service ist der
// einzige garantierte Weg, um das Drücken der Home-Taste zu erkennen
function subscribeToForegroundState(){
  var wOS=window.webOS;
  if(!wOS||!wOS.service||!wOS.service.request) return;
  wOS.service.request('luna://com.webos.applicationManager',{
    method:'getForegroundAppInfo',
    parameters:{subscribe:true},
    onSuccess:function(res){
      var appId=res&&res.appId;
        if(appId==='com.xcplayer.app') Player.resume();
    },
    onFailure:function(){}
  });
}

async function init(){
  await EPGStore.init(); // WICHTIG: Startet die Datenbank
  await PlaylistDB.init(); // WICHTIG: Startet die Playlist-Datenbank
  subscribeToForegroundState();

  Player.init();
  Profiles.load();
  Settings.load();
 
  if(Profiles.list.length>0&&Profiles.activeId){
    var active=Profiles.getActive();
    if(active){
      await activateProfile(active.id);
      return;
    }
  }
  
  if(Profiles.list.length === 0){
      Wizard.start();
      return;
  }
  
  S.screen='profile'; 
  S.focusArea='profile_grid';
  renderProfileScreen();
}

init();