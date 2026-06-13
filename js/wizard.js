// ── WIZARD ───────────────────────────────────────────────────────
var Wizard = {
  start: function() {
    S.screen = 'wizard';
    if(typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
    var mac = Device.getMac();
    $('wiz-mac').textContent = mac;
    
    var setupUrl = CONFIG.API.SETUP_URL + '?mac=' + encodeURIComponent(mac);
    $('wiz-qr').src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=' + encodeURIComponent(setupUrl);
    
    setTimeout(function(){ SpatialNav.focusBySelector('#wiz-btn-sync'); }, 100);
  },
  sync: async function() {
    showFullLoader('Prüfe Cloud...', 'Synchronisiere mit deinem Fernseher');
    try {
      var mac = Device.getMac();
      var url = CONFIG.API.PROFILE_URL + '?mac=' + encodeURIComponent(mac);
      var r = await fetch(url, {cache: 'no-store'});
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var data = await r.json();
      
      var profilesData = Array.isArray(data) ? data : [data];
      var firstProfileId = null;
      var addedCount = 0;

      for (var i = 0; i < profilesData.length; i++) {
          var item = profilesData[i];
          var prof = null;
          if(item && item.host && item.user && item.pass) { prof = { name: item.name || 'Cloud XC', type: 'xc', host: item.host, user: item.user, pass: item.pass }; } 
          else if(item && item.m3uUrl) { prof = { name: item.name || 'Cloud M3U', type: 'm3u', m3uUrl: item.m3uUrl }; }
          
          if (prof) {
              var p = Profiles.add(prof);
              if (!firstProfileId) firstProfileId = p.id;
              addedCount++;
          }
      }
      
      if (addedCount > 0) {
          hideFullLoader();
          showToast(addedCount + ' Playlist(s) erfolgreich synchronisiert!', 3000);
          S.wizardMode = true; // Stillladen ohne Bildwechsel
          await activateProfile(firstProfileId);
          $('wiz-step-1').classList.remove('active');
          $('wiz-step-2').classList.add('active');
          setTimeout(function(){ SpatialNav.focusBySelector('#wiz-btn-next'); }, 100);
      } else { hideFullLoader(); showToast('Noch keine Daten gefunden. Bitte erst auf der Webseite eingeben.', 4000); }
    } catch(e) { hideFullLoader(); showToast('Fehler bei der Verbindung zur Cloud.', 3000); }
  },
  next: async function() {
    $('wiz-step-2').classList.remove('active');
    showFullLoader('Lade Daten...', 'Bereite Setup vor');
    await WizFlow.initData();
    hideFullLoader();
  },
  startOptimization: async function() {
    if(S.settingsOpen) closeSettings();
    if(S.playerVisible) Player.close();
    $('pe-modal').classList.add('hidden');
    S.screen = 'wizard';
    $('wiz-step-1').classList.remove('active');
    $('wiz-step-2').classList.remove('active');
    document.querySelectorAll('.wiz-step').forEach(function(e){ e.classList.remove('active'); });

    showFullLoader('Lade Daten...', 'Bereite Setup vor');
    await WizFlow.initData();
    hideFullLoader();

  },
  finishDetect: function() {
    // Speichere die gewählten Regeln ab, entferne aktiv abgewählte
    _wizDetectItems.forEach(function(item){
      if(item.type === 'rule'){
        if(item.selected) {
          var exists = peDraftRules.some(function(r) { return r.type === item.rule.type && r.pattern === item.rule.pattern; });
          if(!exists) {
             peDraftRules.push(Object.assign({id: Date.now()+Math.random()}, item.rule));
          }
        } else {
          // Wenn aktiv abgewählt, aus der Regelliste löschen falls schon vorhanden
          peDraftRules = peDraftRules.filter(function(r) {
             return !(r.type === item.rule.type && r.pattern === item.rule.pattern);
          });
        }
      } else if(item.type === 'setting' && item.setting === 'groupVariants'){
        Settings.groupVariants = item.selected;
      } else if(item.type === 'empty_cats'){
         if(item.selected) {
           item.cats.forEach(function(c){
              var hc = peDraftVisCats.live || [];
              if(hc.indexOf(String(c.category_id)) === -1) hc.push(String(c.category_id));
              peDraftVisCats.live = hc;
           });
         } else {
           item.cats.forEach(function(c){
              var hc = peDraftVisCats.live || [];
              var idx = hc.indexOf(String(c.category_id));
              if(idx !== -1) hc.splice(idx, 1);
              peDraftVisCats.live = hc;
           });
         }
      }
    });

    Settings.playlistRules = peDraftRules;
    Settings.hiddenCats = peDraftVisCats;
    Settings.save();
    
    if(S.wizardMode) {
      S.wizardMode = false;
      S.fromWizard = true;
      S.fullStreams = { live: null, vod: null, series: null };
      launchLiveTv();
      setTimeout(function(){ showToast('Setup abgeschlossen! Weitere Regeln unter Einstellungen → Playlist Editor.', 5000); }, 1000);
    } else {
      S.screen = 'main';
      renderPERules();
      $('pe-modal').classList.remove('hidden');
      setTimeout(function(){ SpatialNav.focusBySelector('#pe-btn-wizard'); }, 50);
    }
  }
};
// ════════════════════════════════════════════════════════════
// AUTO-DETECT ENGINE
// ════════════════════════════════════════════════════════════
var AutoDetect = {
  // Auf unbereinigten Stream-Namen ausführen (vor Regeln), gibt Array mit Vorschlägen zurück
  run: function(rawStreams){
    var results = [];
    var names = rawStreams.map(function(s){ return s.name || ''; }).filter(Boolean);
    var total = names.length;
    if(total === 0) return results;

    // ── 1. Präfix-Erkennung (DE: , TR| , IT - , [DE], 001. etc.) ──────
    var prefixCounts = {};
    var prefixPatterns = [
      /^\|\s*([A-Z]{2,5})\s*\|\s*/,          // |DE| , | DE |
      /^([A-Z]{2,5})\s*[:\|]\s*/,            // DE: , DE : , DE| , DE |
      /^\[\s*([A-Z]{2,5})\s*\]\s*/,          // [DE] , [ DE ]
      /^([A-Z]{2,3})\s*[-–]\s*/,             // DE- , DE - (max 3 Buchstaben um Wörter wie DAHA- zu ignorieren)
    ];
    names.forEach(function(n){
      for(var pi=0; pi<prefixPatterns.length; pi++){
        var m = n.match(prefixPatterns[pi]);
        if(m){ 
           var p = m[1]; 
           prefixCounts[p] = (prefixCounts[p]||0)+1; 
           break; 
        }
      }
    });
    Object.keys(prefixCounts).forEach(function(countryCode){
      var cnt = prefixCounts[countryCode];
      if(cnt > 0){
        var regexPattern = "^(?:\\|\\s*" + countryCode + "\\s*\\||" + countryCode + "\\s*[:\\|]|\\[\\s*" + countryCode + "\\s*\\]|" + countryCode + "\\s*[-–])\\s*";
        var examples = names.filter(function(n){ return new RegExp(regexPattern, "i").test(n); }).slice(0,2);
        if(examples.length > 0){
          results.push({
            id: 'prefix_'+countryCode,
            type: 'rule',
            rule: {target:'both', type:'regex', pattern: regexPattern, replacement:''},
            title: 'Länder-Prefix entfernen: "'+countryCode+'"',
            desc: cnt+' Einträge betroffen',
            preview: 'z.B. '+examples.slice(0,1).map(function(e){ return '"'+e+'" → "'+e.replace(new RegExp(regexPattern, "i"), '')+'"'; }).join(''),
            selected: false
          });
        }
      }
    });

    // ── 1.1 Premium-Suffix-Erkennung ─────────────────────────────
    var pCount = 0;
    var pRe = /\s+(ultra|ppv|plus|premium|platinum|gold|feed|backup|bk|alt)\s*$/i;
    names.forEach(function(n){ if(pRe.test(n)) pCount++; });
    if(pCount > 0){
        results.push({
          id: 'suffix_premium',
          type: 'rule',
          rule: {target:'stream', type:'regex', pattern: '\\s+(ULTRA|PPV|PLUS|PREMIUM|PLATINUM|GOLD|FEED|BACKUP|BK|ALT)\\s*$', replacement:''},
          title: 'Premium/Backup-Suffix entfernen',
          desc: pCount+' Sender betroffen',
          preview: 'z.B. "Sky Sport 1 Backup" → "Sky Sport"',
          selected: false
        });
    }

    // ── 1.2 Qualitäts-Suffix-Erkennung ─────────────────────────────
    var qCount = 0;
    var qRe = /\s+(fhd|uhd|4k|2k|hd|sd|1080p?|720p?|480p?|hevc)[*+]?\s*\d*\s*$/i;
    names.forEach(function(n){ if(qRe.test(n)) qCount++; });
    if(qCount > 0){
        results.push({
          id: 'suffix_quality',
          type: 'rule',
          rule: {target:'stream', type:'regex', pattern: '\\s+(FHD|UHD|4K|2K|HD|SD|1080p?|720p?|480p?|HEVC)[*+]?\\s*\\d*\\s*$', replacement:''},
          title: 'Qualitäts-Suffix entfernen',
          desc: qCount+' Sender betroffen',
          preview: 'z.B. "RTL HD" → "RTL"',
          selected: false
        });
    }

    // ── 2. Platzhalter-Stream-Erkennung (##### KINDERSENDER #####) ──
    var phRe = /^[#=\-*_]{3,}/;
    var phCount = 0;
    var phExamples = [];
    names.forEach(function(n){ if(phRe.test(n.trim())){ phCount++; if(phExamples.length<2) phExamples.push(n); } });
    if(phCount > 0){
      results.push({
        id: 'placeholders',
        type: 'rule',
        rule: {target:'stream', type:'hide', pattern: '###'},
        title: 'Platzhalter verstecken',
        desc: phCount+' unechte Sender',
        preview: 'z.B. '+phExamples.slice(0,1).map(function(e){ return '"'+e.trim()+'"'; }).join(''),
        selected: false
      });
    }

    // ── 3. Duplikat-Erkennung ─────────────────────────────
    var baseMap = {};
    names.forEach(function(n){ var b = _baseName(n); baseMap[b] = (baseMap[b]||0)+1; });
    var dupCount = Object.keys(baseMap).filter(function(b){ return baseMap[b]>1; }).length;
    if(dupCount > 0 && !Settings.groupVariants){
      results.push({
        id: 'group_variants',
        type: 'setting',
        setting: 'groupVariants',
        title: 'Duplikate gruppieren',
        desc: dupCount+' Basisnamen betroffen',
        preview: 'Fasst HD/FHD/SD Versionen zusammen',
        selected: false
      });
    }

    // ── 3. Leere Kategorien ────────────────────────────────
    if(S.categories && S.categories.length && S.fullStreams && S.fullStreams.live){
      var streamCatIds = {};
      S.fullStreams.live.forEach(function(s){ streamCatIds[String(s.category_id)] = true; });
      var emptyCats = S.categories.filter(function(c){
        return !streamCatIds[String(c.category_id)];
      });
      if(emptyCats.length > 0){
        results.push({
          id: 'empty_cats',
          type: 'empty_cats',
          cats: emptyCats,
          title: 'Leere Kategorien verstecken',
          desc: emptyCats.length+' Kategorien ohne Sender',
          preview: 'Werden in den Listen ausgeblendet',
          selected: false
        });
      }
    }
    return results;
  },

  // Zählen, wie viele Streams eine Regel beeinflussen würde
  countAffected: function(rule, streams){
    var count = 0;
    for(var i=0;i<streams.length;i++){
      var name = streams[i].name||streams[i].title||'';
      if(rule.type==='prefix' && name.startsWith(rule.pattern)) count++;
      else if(rule.type==='suffix' && name.endsWith(rule.pattern)) count++;
      else if(rule.type==='replace' && name.indexOf(rule.pattern)!==-1) count++;
      else if(rule.type==='hide' && name.indexOf(rule.pattern)!==-1) count++;
    }
    return count;
  }
};

// ════════════════════════════════════════════════════════════
// WIZARD FLOW LOGIC
// ════════════════════════════════════════════════════════════
var _wizDetectItems = [];
var WizFlow = {
  _cats: [],
  _selectedCatIds: [],
  _mods: { live: true, vod: true, series: true },

  initData: async function() {
    peDraftVisCats = JSON.parse(JSON.stringify(Settings.hiddenCats || {live:[],vod:[],series:[]}));
    peDraftRules = JSON.parse(JSON.stringify(Settings.playlistRules || []));

    try {
      var liveCats = await getOrFetchData('cats', 'live');
      // Original unberührt laden, um Kategorien-Namen sauber zu haben
      this._cats = liveCats || [];
    } catch(e) { Logger.warn('[Wizard] Live-Kategorien konnten nicht geladen werden:', e.message); }

    var hiddenLive = Settings.hiddenCats.live || [];
    this._selectedCatIds = this._cats.map(function(c){ return String(c.category_id); }).filter(function(id){ return hiddenLive.indexOf(id) === -1; });

    this._mods = {
      live: true,
      vod: Settings.showVod !== false,
      series: Settings.showSeries !== false
    };

    $('wiz-step-modules').classList.add('active');
    this.renderMods();
    setTimeout(function(){ SpatialNav.focusBySelector('#wiz-step-modules [data-focusable]'); }, 100);
  },

  detectRules: function() {
    var self = this;
    var absoluteRawLive = (S.rawStreams.live || []).filter(function(s){
      return self._selectedCatIds.indexOf(String(s.category_id)) !== -1;
    });
    var absoluteRawVod = this._mods.vod ? (S.rawStreams.vod || []) : [];
    // Vor dem Scan mit AutoDetect keine Regeln anwenden, das wollen wir ja analysieren!
    _wizDetectItems = AutoDetect.run(absoluteRawLive.concat(absoluteRawVod));
  },

  renderRules: function() {
    var cont = $('wiz-detect-results');
    if(_wizDetectItems.length === 0){
      cont.innerHTML = '<div style="color:var(--green);font-size:var(--fs-md);padding:40px;text-align:center;grid-column:span 2;">Perfekt! Keine Störfaktoren gefunden. Klicke auf "Setup abschließen".</div>';
    } else {
      cont.innerHTML = '';
      _wizDetectItems.forEach(function(item, idx){
        var card = document.createElement('div');
        card.className = 'wiz-detect-card' + (item.selected ? ' selected' : '');
        card.setAttribute('data-focusable','');
        card.innerHTML =
          '<div class="wiz-det-check">'+(item.selected?'&#x2713;':'')+'</div>'
          +'<div class="wiz-det-info" style="overflow:hidden">'
            +'<div class="wiz-det-title" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(item.title)+'</div>'
            +'<div class="wiz-det-preview" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(item.preview)+'</div>'
          +'</div>';
        card.onclick = function(){
          item.selected = !item.selected;
          card.classList.toggle('selected', item.selected);
          card.querySelector('.wiz-det-check').innerHTML = item.selected ? '&#x2713;' : '';
        };
        cont.appendChild(card);
      });
    }
  },

  renderMods: function() {
    $('wiz-mod-live').classList.toggle('selected', this._mods.live);
    $('wiz-mod-vod').classList.toggle('selected', this._mods.vod);
    $('wiz-mod-series').classList.toggle('selected', this._mods.series);
  },

  toggleMod: function(mod) {
    if(mod === 'live') return; // Live TV wird immer benötigt
    this._mods[mod] = !this._mods[mod];
    this.renderMods();
  },

  nextToCats: function() {
    $('wiz-step-modules').classList.remove('active');
    $('wiz-step-cats').classList.add('active');
    this.renderCats();
    setTimeout(function(){ SpatialNav.focusBySelector('#wiz-step-cats [data-focusable]'); }, 100);
  },

  renderCats: function() {
    var cont = $('wiz-cat-grid');
    cont.innerHTML = '';
    var self = this;
    this._cats.forEach(function(c){
      var id = String(c.category_id);
      var sel = self._selectedCatIds.indexOf(id) !== -1;
      var div = document.createElement('div');
      div.className = 'wiz-cat-item' + (sel ? ' selected' : '');
      div.setAttribute('data-focusable', '');
      div.innerHTML = '<div class="wiz-cat-cb">&#x2713;</div><div style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(c.category_name)+'</div>';
      div.onclick = function(){
        var idx = self._selectedCatIds.indexOf(id);
        if(idx !== -1) self._selectedCatIds.splice(idx, 1);
        else self._selectedCatIds.push(id);
        var isSel = self._selectedCatIds.indexOf(id) !== -1;
        div.classList.toggle('selected', isSel);
      };
      cont.appendChild(div);
    });
  },

  selectAllCats: function(all) {
    this._selectedCatIds = all ? this._cats.map(function(c){ return String(c.category_id); }) : [];
    this.renderCats();
  },

  doScan: async function() {
    showFullLoader('Analysiere Playlist...', 'Die Magie passiert...');
    
    Settings.showVod = this._mods.vod;
    Settings.showSeries = this._mods.series;
    
    var hiddenLive = peDraftVisCats.live || [];
    var self = this;
    this._cats.forEach(function(c){
      var cid = String(c.category_id);
      if(self._selectedCatIds.indexOf(cid) === -1 && hiddenLive.indexOf(cid) === -1) hiddenLive.push(cid);
    });
    peDraftVisCats.live = hiddenLive;

    // Streams laden
    var rawLive = [], rawVod = [];
    try {
      var liveStreams = await getOrFetchData('streams', 'live');
      rawLive = Array.isArray(liveStreams) ? liveStreams : [];
      S.rawStreams.live = rawLive;
    } catch(e) { Logger.warn('[Wizard] Live-Streams konnten nicht geladen werden:', e.message); }

    if (this._mods.vod) {
       try {
          var vodStreams = await getOrFetchData('streams', 'vod');
          rawVod = Array.isArray(vodStreams) ? vodStreams : [];
          S.rawStreams.vod = rawVod;
       } catch(e) { Logger.warn('[Wizard] VOD-Streams konnten nicht geladen werden:', e.message); }
    }

    this.detectRules();
    hideFullLoader();

      $('wiz-step-cats').classList.remove('active');
      $('wiz-step-rules').classList.add('active');
      this.renderRules();
      setTimeout(function(){ SpatialNav.focusBySelector('#wiz-step-rules [data-focusable]'); }, 100);
  }
};