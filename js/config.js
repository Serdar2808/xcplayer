// ── UMGEBUNGS-STEUERUNG (Dev vs Prod) ─────────────────────────
var APP_ENV = 'prod'; // 'dev' für lokale Entwicklung, 'prod' für den TV-Build

var ENV_CONFIG = {
  dev: {
    API_BASE: 'http://localhost:8080/gewicht', // Dein lokaler Test-Server
    LOG_LEVEL: 4, // 4=debug (Ausführliche Logs für die Fehlersuche)
    FETCH_TIMEOUT: 15000 // Längeres Timeout beim Debuggen am PC
  },
  prod: {
    API_BASE: 'https://leppe-lager.duckdns.org/gewicht', // Live-TV-Server
    LOG_LEVEL: 2, // 2=warn (Spart signifikant CPU-Ressourcen auf Smart-TVs)
    FETCH_TIMEOUT: 8000
  }
};

var currentEnv = ENV_CONFIG[APP_ENV];

// ── KONFIGURATION & GLOBALE STATUS-VARIABLEN ──────────────────────
var CONFIG = {
  FETCH_TIMEOUT:        currentEnv.FETCH_TIMEOUT,
  FETCH_RETRIES:        0,          // Keine aggressiven Retries, die DDoS-Schutz auslösen
  EPG_FETCH_TIMEOUT:    120000,
  EPG_CACHE_TTL:        86400000,   // 24h in ms (Millisekunden)
  EPG_CACHE_MAX:        200,        // Maximale Einträge im S.epgCache
  EPG_PARSE_CHUNK:      500,        // Programme pro Chunk
  EPG_RANGE_DAYS:       1.5,        // Auf ±1.5 Tage reduziert (Massive RAM-Einsparung)
  CONTROLS_FADE_MS:     6000,
  VARIANT_TIMEOUT_MS:   4500,
  SEEK_AUTO_COMMIT_MS:  3000,
  SEEK_FAST_STEP:       60,
  SEEK_NORMAL_STEP:     10,
  SEEK_HOLD_THRESHOLD:  2000,
  CH_NUM_TIMEOUT:       1600,
  TOAST_DEFAULT_MS:     2600,
  VLIST_ROWS:           10,
  CLOCK_INTERVAL:       1000,
  OSD_INTERVAL:         15000,
  BITRATE_INTERVAL:     3000,
  RESUME_SAVE_INTERVAL: 5,         // Alle N Sekunden speichern
  SEARCH_DEBOUNCE_MS:   250,
  WHEEL_IDLE_MS:        5000,
  EXIT_CONFIRM_MS:      2200,
  GRID_BUFFER_ROWS:     2,
  EPG_GRID_PX_PER_MIN: 7,
  EPG_GRID_ROW_H:      70,
  EPG_GRID_VISIBLE:    13,
  EPG_GRID_CH_W:       220,
  EPG_GRID_PAST_H:     2,       // Stunden in die Vergangenheit
  EPG_GRID_FUTURE_H:   12,      // Stunden in die Zukunft
  PLAYLIST_REFRESH_MS:  43200000, // 12 Stunden (schont den Provider-Server enorm)
  PANEL_AUTO_CLOSE_MS:  20000   // 20 Sekunden Inaktivität
};

// Zentrale URLs (verhindert hardcodierte Domains im Code)
CONFIG.API = {
  SETUP_URL: currentEnv.API_BASE + '/setup',
  PROFILE_URL: currentEnv.API_BASE + '/api/get_profile',
  EPG_XML_URL: currentEnv.API_BASE + '/epg-filtered.xml'
};

// ── LOGGER ────────────────────────────────────────────────────────
// Levels: 0=silent, 1=error, 2=warn, 3=info, 4=debug
// In Produktion (TV-Build) auf 2 stellen, in Entwicklung 4.
// Laufzeit-Override über localStorage('xcp_log_level') ist möglich.
var Logger = {
  LEVELS: { silent:0, error:1, warn:2, info:3, debug:4 },
  level: currentEnv.LOG_LEVEL, // Default automatisch aus der Umgebung
  init: function() {
    try {
      var stored = localStorage.getItem('xcp_log_level');
      if (stored !== null) {
        var n = parseInt(stored);
        if (!isNaN(n) && n >= 0 && n <= 4) this.level = n;
      }
    } catch(e) { /* localStorage unavailable */ }
  },
  setLevel: function(level) {
    if (typeof level === 'string') level = this.LEVELS[level];
    if (typeof level === 'number' && level >= 0 && level <= 4) {
      this.level = level;
      try { localStorage.setItem('xcp_log_level', String(level)); } catch(e){}
    }
  },
  error: function() { if (this.level >= 1) console.error.apply(console, arguments); },
  warn:  function() { if (this.level >= 2) console.warn.apply(console, arguments); },
  info:  function() { if (this.level >= 3) console.log.apply(console, arguments); },
  debug: function() { if (this.level >= 4) console.log.apply(console, arguments); }
};
Logger.init();

// ── STATE EVENTS (Pub/Sub) ────────────────────────────────────────
var StateEvents = {
  _listeners: {},
  on: function(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(callback);
  },
  emit: function(event, data) {
    if (this._listeners[event]) {
      this._listeners[event].forEach(function(cb) { cb(data); });
    }
  }
};

// ── NEUER STRUKTURIERTER STATE (Namespacing) ──────────────────────
var AppState = {
  nav: { screen: 'profile' },
  player: { visible: false },
  panels: {
    epgOpen: false,
    chListOpen: false,
    variantBarOpen: false,
    epgGridOpen: false,
    seriesDetailOpen: false,
    subPanelOpen: false,
    audioPanelOpen: false
  },
  settings: {
    categoryOpen: null
  }
};

var S = {
  tab:'live',
  rawCategories: { live: null, vod: null, series: null },
  rawStreams: { live: null, vod: null, series: null },
  categories:[], selectedCat:null,
  fullStreams: { live: null, vod: null, series: null },
  streams:[], filteredStreams:[],
  favs:{live:[],vod:[],series:[]}, resume:{}, resumeSeries:{},
  focusArea:'profile_grid',
  cursors:{profile:0,home:0,nav:0,cat:0,grid:0,season:0,ep:0},
  playerType:'live',
  epgCache:{}, seriesEpisodes:{}, seriesSeasonsArr:[],
  seriesInfoCache:{}, currentStream:null, currentStreamIdx:0,
  currentEpsArray:[], currentEpIdx:0, currentSeriesStream:null,
  controlsTimer:null, chNumBuf:'', chNumTimer:null,
  chListCursor:0, chListCatIdx:0, chListFocusArea:'streams', chListSplitCatCursor:0,
  chListRestoreIdx:-1, chListCatView:false, chListCatViewCursor:0,
  _gmCache:null, variants:[], variantIdx:0, variantTimer:null,
  settingsOpen:false, prevScreenForSettings:null,
  exitConfirm:false, exitTimer:null,
  m3uStreams:[], m3uCategories:[], isM3U:false,
  _bingeTriggered:false, _bingeCancelled:false,
  // ── Implizit gesetzte Flags (vorher undefined beim ersten Lesen) ──
  sysMenuOpen:false,
  wizardMode:false, fromWizard:false,
  liveDirect:false,
  prevFocusForSearch:null,
  _backConsumed:false,
  _navTabHold:null
};

// ── GETTER / SETTER FÜR ABWÄRTSKOMPATIBILITÄT ─────────────────────
Object.defineProperty(S, 'screen', {
  get: function() { return AppState.nav.screen; },
  set: function(val) {
    if (AppState.nav.screen !== val) {
      var oldVal = AppState.nav.screen;
      AppState.nav.screen = val;
      StateEvents.emit('screenChanged', { old: oldVal, new: val });
    }
  }
});

Object.defineProperty(S, 'epgOpen', {
  get: function() { return AppState.panels.epgOpen; },
  set: function(val) {
    if (AppState.panels.epgOpen !== val) {
      AppState.panels.epgOpen = val;
      StateEvents.emit('epgOpenChanged', val);
    }
  }
});

Object.defineProperty(S, 'chListOpen', {
  get: function() { return AppState.panels.chListOpen; },
  set: function(val) {
    if (AppState.panels.chListOpen !== val) {
      AppState.panels.chListOpen = val;
      StateEvents.emit('chListOpenChanged', val);
    }
  }
});

Object.defineProperty(S, 'variantBarOpen', {
  get: function() { return AppState.panels.variantBarOpen; },
  set: function(val) {
    if (AppState.panels.variantBarOpen !== val) {
      AppState.panels.variantBarOpen = val;
      StateEvents.emit('variantBarOpenChanged', val);
    }
  }
});

Object.defineProperty(S, 'epgGridOpen', {
  get: function() { return AppState.panels.epgGridOpen; },
  set: function(val) {
    if (AppState.panels.epgGridOpen !== val) {
      AppState.panels.epgGridOpen = val;
      StateEvents.emit('epgGridOpenChanged', val);
    }
  }
});

Object.defineProperty(S, 'playerVisible', {
  get: function() { return AppState.player.visible; },
  set: function(val) {
    if (AppState.player.visible !== val) {
      AppState.player.visible = val;
      StateEvents.emit('playerVisibleChanged', val);
    }
  }
});

Object.defineProperty(S, 'seriesDetailOpen', {
  get: function() { return AppState.panels.seriesDetailOpen; },
  set: function(val) {
    if (AppState.panels.seriesDetailOpen !== val) {
      AppState.panels.seriesDetailOpen = val;
      StateEvents.emit('seriesDetailOpenChanged', val);
    }
  }
});

Object.defineProperty(S, 'subPanelOpen', {
  get: function() { return AppState.panels.subPanelOpen; },
  set: function(val) {
    if (AppState.panels.subPanelOpen !== val) {
      AppState.panels.subPanelOpen = val;
      StateEvents.emit('subPanelOpenChanged', val);
    }
  }
});

Object.defineProperty(S, 'audioPanelOpen', {
  get: function() { return AppState.panels.audioPanelOpen; },
  set: function(val) {
    if (AppState.panels.audioPanelOpen !== val) {
      AppState.panels.audioPanelOpen = val;
      StateEvents.emit('audioPanelOpenChanged', val);
    }
  }
});

Object.defineProperty(S, 'settingsCatOpen', {
  get: function() { return AppState.settings.categoryOpen; },
  set: function(val) {
    if (AppState.settings.categoryOpen !== val) {
      AppState.settings.categoryOpen = val;
      StateEvents.emit('settingsCatChanged', val);
    }
  }
});

var KEYS = { UP:38, DOWN:40, LEFT:37, RIGHT:39, ENTER:13, BACK:461, BACK2:10009, ESC:27, BKSP:8, RED:403, GREEN:404, YELLOW:405, BLUE:406, PLAY:415, PAUSE:19, CH_UP:427, CH_DOWN:428, NUM0:48, NUM9:57, NPAD0:96, NPAD9:105 };
var GRID_LAYOUTS = ['default','list','hero','mini'];
var GRID_LAYOUT_ICONS = {'default':'▦','list':'☰','hero':'▣','mini':'⠿'};
var _gridLayoutIdx = 0;
var VLIST_ROWS = CONFIG.VLIST_ROWS;
var S_CLO_OFFSET = 0; // first visible stream index
var _catchupJustStarted = 0; // Für Keyhandler Timeshift-Check
