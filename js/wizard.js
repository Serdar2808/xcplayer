// ── WIZARD ───────────────────────────────────────────────────────
// Ersteinrichtung:
//   1. Playlist verbinden - QR-Code/Webseite (die App erkennt die Playlist
//      selbst), auf Smartphones alternativ direkt eingeben
//   2. Bedienung
//   3. Fragen (WizQ): Inhalte, Länder, Kategorien, Namen bereinigen
var Wizard = {
  _pollTimer: null,
  _failedSig: null,     // Cloud-Daten, die schon geprüft und abgelehnt wurden
  _busy: false,
  _directMode: 'xc',

  start: function() {
    // Reste eines vorherigen Durchlaufs ausblenden, sonst zeigt der DOM beim
    // nächsten Aufruf (Profil gelöscht ...) noch den zuletzt aktiven Schritt.
    document.querySelectorAll('.wiz-step').forEach(function(e){ e.classList.remove('active'); });
    $('wiz-step-1').classList.add('active');
    S.wizardMode = false;
    S.screen = 'wizard';
    if(typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
    var mac = Device.getMac();
    $('wiz-mac').textContent = mac;
    var setupUrl = CONFIG.API.SETUP_URL + '?mac=' + encodeURIComponent(mac);
    $('wiz-qr').src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=0&data=' + encodeURIComponent(setupUrl);
    var phone = document.documentElement.classList.contains('xc-phone');
    $('wiz-sub-1').innerHTML = phone
      ? 'Scanne den QR-Code mit einem anderen Gerät und gib dort deine Playlist ein –<br>oder gib sie hier direkt ein.'
      : 'Scanne den QR-Code mit deinem Smartphone und gib dort deine Playlist ein.<br>Die App erkennt sie danach automatisch.';
    $('wiz-conn-info').classList.add('hidden');
    this._failedSig = null;
    this._setStatus('wait', 'Warte auf deine Playlist …');
    this._startPolling();
    // Am TV gibt es auf Schritt 1 nichts zu bedienen (der Handy-Button ist ausgeblendet)
    if(phone) setTimeout(function(){ SpatialNav.focusBySelector('#wiz-btn-direct'); }, 100);
    else if(SpatialNav.focus) SpatialNav.focus(null);
  },

  _setStatus: function(kind, text) {
    var el = $('wiz-status');
    if(!el) return;
    el.className = 'wiz-status ' + kind;
    $('wiz-status-txt').textContent = text;
  },

  // Die Webseite speichert die Playlist zur Geräte-ID; alle paar Sekunden
  // nachsehen, ob sie da ist - kein "Weiter"-Drücken nötig
  _startPolling: function() {
    this._stopPolling();
    var self = this;
    this._pollTimer = setInterval(function(){ self._poll(); }, 5000);
    setTimeout(function(){ self._poll(); }, 1500);
  },
  _stopPolling: function() { clearInterval(this._pollTimer); this._pollTimer = null; },

  _poll: async function() {
    if(S.screen !== 'wizard') { this._stopPolling(); return; }
    if(this._busy || !$('wiz-step-1').classList.contains('active')) return;
    var data = null;
    try {
      var r = await fetch(CONFIG.API.PROFILE_URL + '?mac=' + encodeURIComponent(Device.getMac()), { cache: 'no-store' });
      if(r.status !== 404) {                      // 404 = noch nichts eingegeben
        if(!r.ok) throw new Error('HTTP ' + r.status);
        data = await r.json();
      }
    } catch(e) {
      if(!this._failedSig) this._setStatus('warn', 'Keine Verbindung zum Einrichtungs-Server – neuer Versuch läuft …');
      return;
    }
    if(this._busy || !$('wiz-step-1').classList.contains('active')) return;
    var profs = this._parseCloud(data);
    if(!profs.length) { if(!this._failedSig) this._setStatus('wait', 'Warte auf deine Playlist …'); return; }
    var sig = JSON.stringify(profs);
    // Unverändert fehlerhaft: Meldung bleibt stehen. Abgelaufene/gesperrte Konten
    // werden einmal pro Minute erneut geprüft (Verlängerung ändert die Daten nicht)
    if(sig === this._failedSig && Date.now() < this._retryAt) return;
    await this._connect(profs, sig, 'cloud');
  },

  _parseCloud: function(data) {
    var list = Array.isArray(data) ? data : (data ? [data] : []), out = [];
    list.forEach(function(item){
      if(item && item.host && item.user && item.pass) out.push({ name: item.name || 'Cloud XC', type: 'xc', host: item.host, user: item.user, pass: item.pass });
      else if(item && item.m3uUrl) out.push({ name: item.name || 'Cloud M3U', type: 'm3u', m3uUrl: item.m3uUrl });
    });
    return out;
  },

  // Zugang beim Anbieter prüfen, erst dann Profil anlegen und weiter
  _connect: async function(profs, sig, source) {
    if(this._busy) return { ok: false, msg: '' };
    this._busy = true;
    showFullLoader('Verbinde mit deinem Anbieter …', 'Zugangsdaten werden geprüft');
    var res;
    try { res = await PlaylistCheck.run(profs[0]); }
    catch(e) { res = { ok: false, msg: 'Die Verbindung ist fehlgeschlagen. Bitte erneut versuchen.' }; }
    if(!res.ok) {
      hideFullLoader();
      this._busy = false;
      if(source === 'cloud') {
        this._failedSig = sig;
        this._retryAt = res.account ? Date.now() + 60000 : Infinity;
        this._setStatus('err', res.msg + (res.account ? ' Die App prüft automatisch erneut.'
          : ' Bitte auf der Webseite korrigieren – die App prüft danach automatisch erneut.'));
      }
      return res;
    }
    this._stopPolling();
    var firstId = null, self = this;
    this._lastSource = source; this._lastSig = sig; this._addedIds = [];
    profs.forEach(function(prof){
      var ex = Profiles.list.find(function(p){
        return (p.type === 'xc' && prof.type === 'xc' && p.host === prof.host && p.user === prof.user) ||
               (p.type === 'm3u' && prof.type === 'm3u' && p.m3uUrl === prof.m3uUrl);
      });
      var id;
      if(ex) { prof.id = ex.id; Profiles.update(ex.id, prof); id = ex.id; }
      else { id = Profiles.add(prof).id; self._addedIds.push(id); }
      if(!firstId) firstId = id;
    });
    // Zugang ist gerade geprüft (kein zweiter Login), M3U schon geladen (kein zweiter Download)
    try { localStorage.setItem('xcp_last_auth_' + firstId, String(Date.now())); } catch(e) {}
    if(res.m3u) PlaylistDB.set('m3u_' + firstId, res.m3u);
    hideFullLoader();
    S.wizardMode = true;                          // Daten laden ohne Bildwechsel
    await activateProfile(firstId);
    this._busy = false;
    var info = $('wiz-conn-info');
    info.innerHTML = '&#x2713; Verbunden' + (res.info ? ' · ' + esc(res.info) : '') +
                     (res.warn ? '<div class="wiz-conn-warn">' + esc(res.warn) + '</div>' : '');
    info.classList.remove('hidden');
    document.querySelectorAll('.wiz-step').forEach(function(e){ e.classList.remove('active'); });
    $('wiz-step-2').classList.add('active');
    setTimeout(function(){ SpatialNav.focusBySelector('#wiz-btn-next'); }, 100);
    return res;
  },

  // ── Direkteingabe (Smartphones) ──────────────────────────────────
  openDirect: function() {
    $('wiz-step-1').classList.remove('active');
    $('wiz-step-direct').classList.add('active');
    $('wd-err').classList.add('hidden');
    this.directTab(this._directMode);
  },
  closeDirect: function() {
    if(document.activeElement && document.activeElement.blur) document.activeElement.blur();
    $('wiz-step-direct').classList.remove('active');
    $('wiz-step-1').classList.add('active');
    setTimeout(function(){ SpatialNav.focusBySelector('#wiz-btn-direct'); }, 50);
  },
  directTab: function(mode) {
    this._directMode = mode;
    $('wd-tab-xc').classList.toggle('active', mode === 'xc');
    $('wd-tab-m3u').classList.toggle('active', mode === 'm3u');
    $('wd-xc').classList.toggle('hidden', mode !== 'xc');
    $('wd-m3u').classList.toggle('hidden', mode !== 'm3u');
  },
  _directErr: function(msg) {
    var e = $('wd-err');
    e.textContent = msg;
    e.classList.remove('hidden');
  },
  connectDirect: async function() {
    var prof;
    if(this._directMode === 'm3u') {
      var u = $('wd-m3u-url').value.trim();
      if(!u) return this._directErr('Bitte den M3U-Link eingeben.');
      prof = this._profileFromM3uUrl(u);
    } else {
      var host = $('wd-host').value.trim(), user = $('wd-user').value.trim(), pass = $('wd-pass').value.trim();
      if(!host || !user || !pass) return this._directErr('Bitte Server-Adresse, Benutzername und Passwort eingeben.');
      host = this._normHost(host);
      prof = { type: 'xc', host: host, user: user, pass: pass, name: this._hostName(host) };
    }
    $('wd-err').classList.add('hidden');
    if(document.activeElement && document.activeElement.blur) document.activeElement.blur();   // Tastatur schließen
    var res = await this._connect([prof], null, 'direct');
    if(!res.ok && res.msg) this._directErr(res.msg);
  },
  // "server.de:8080", "http://server.de:8080/" oder ein eingefügter
  // player_api-/get.php-Link -> "http://server.de:8080"
  _normHost: function(h) {
    h = h.trim();
    if(!/^https?:\/\//i.test(h)) h = 'http://' + h;
    h = h.replace(/\/(player_api\.php|get\.php|xmltv\.php)(\?.*)?$/i, '');
    return h.replace(/\/+$/, '');
  },
  // Ein Xtream-Link (get.php?username=...&password=...) wird als Xtream-Zugang
  // angelegt: so gibt es auch Filme, Serien und EPG
  _profileFromM3uUrl: function(u) {
    if(!/^https?:\/\//i.test(u)) u = 'http://' + u;
    var m = u.match(/^(https?:\/\/[^?#]+?)\/get\.php\?(.*)$/i);
    if(m) {
      var user = (m[2].match(/(?:^|&)username=([^&]*)/) || [])[1];
      var pass = (m[2].match(/(?:^|&)password=([^&]*)/) || [])[1];
      if(user && pass) {
        try { user = decodeURIComponent(user); pass = decodeURIComponent(pass); } catch(e) {}
        var host = m[1].replace(/\/+$/, '');
        return { type: 'xc', host: host, user: user, pass: pass, name: this._hostName(host) };
      }
    }
    return { type: 'm3u', m3uUrl: u, name: this._hostName(u) };
  },
  _hostName: function(u) {
    var m = String(u).match(/^https?:\/\/([^/:?#]+)/i);
    return m ? m[1] : 'Meine Playlist';
  },

  // ── Schritt 2 ────────────────────────────────────────────────────
  next: function() { WizQ.start(true); },
  // Zurück zur Playlist-Eingabe: die gerade verbundene Playlist wird verworfen
  backToStart: function() {
    var src = this._lastSource, sig = this._lastSig;
    (this._addedIds || []).forEach(function(id){ Profiles.remove(id); });
    this._addedIds = [];
    this.start();
    if(src === 'cloud') {
      // Dieselben Daten nicht sofort wieder übernehmen - erst eine geänderte Playlist
      this._failedSig = sig;
      this._retryAt = Infinity;
      this._setStatus('wait', 'Ändere die Playlist auf der Webseite – die App erkennt die neue automatisch.');
    } else if(src === 'direct') {
      this.openDirect();                          // Eingaben stehen noch in den Feldern
    }
  },
  // Einstellungen > Playlist-Editor > "Einrichtung wiederholen"
  startOptimization: function() {
    if(S.settingsOpen) closeSettings();
    if(S.playerVisible) Player.close();
    $('pe-modal').classList.add('hidden');
    S.screen = 'wizard';
    WizQ.start(false);
  }
};

// ════════════════════════════════════════════════════════════
// ZUGANG PRÜFEN - verständliche Meldungen statt "Verbindungsfehler"
// ════════════════════════════════════════════════════════════
var PlaylistCheck = {
  run: function(p) { return p.type === 'm3u' ? this._m3u(p) : this._xc(p); },

  _fetch: async function(url, timeout) {
    var controller = window.AbortController ? new AbortController() : null;
    var timer = setTimeout(function(){ if(controller) controller.abort(); }, timeout);
    try { return await fetch(url, { cache: 'no-store', signal: controller ? controller.signal : undefined }); }
    finally { clearTimeout(timer); }
  },
  _date: function(ms) {
    var d = new Date(ms), p = function(n){ return (n < 10 ? '0' : '') + n; };
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
  },
  NO_SERVER: 'Unter dieser Adresse wurde kein IPTV-Server gefunden. Bitte die Server-Adresse prüfen (z. B. http://server.de:8080).',

  _xc: async function(p) {
    var url = clean(p.host) + '/player_api.php?username=' + encodeURIComponent(p.user) + '&password=' + encodeURIComponent(p.pass);
    var r;
    try { r = await this._fetch(url, 15000); }
    catch(e) { return { ok: false, msg: 'Der Server ist nicht erreichbar. Bitte die Server-Adresse und die Internetverbindung prüfen.' }; }
    if(r.status === 401 || r.status === 403) return { ok: false, msg: 'Benutzername oder Passwort ist falsch.' };
    if(!r.ok) return { ok: false, msg: 'Der Server meldet einen Fehler (' + r.status + '). Bitte später erneut versuchen.' };
    var d;
    try { d = await r.json(); } catch(e) { return { ok: false, msg: this.NO_SERVER }; }
    var u = d && d.user_info;
    if(!u) return { ok: false, msg: this.NO_SERVER };
    if(u.auth === 0 || u.auth === '0') return { ok: false, msg: 'Benutzername oder Passwort ist falsch.' };
    var status = String(u.status || '').toLowerCase();
    var exp = parseInt(u.exp_date, 10), expMs = exp > 0 ? exp * 1000 : 0;
    if(status === 'expired' || (expMs && expMs < Date.now()))
      return { ok: false, msg: 'Dein Konto ist abgelaufen' + (expMs ? ' (seit ' + this._date(expMs) + ')' : '') + '. Bitte bei deinem Anbieter verlängern.', account: true };
    if(status === 'banned' || status === 'disabled')
      return { ok: false, msg: 'Dein Konto ist gesperrt. Bitte wende dich an deinen Anbieter.', account: true };
    var info = [expMs ? 'Konto gültig bis ' + this._date(expMs) : 'Konto unbegrenzt gültig'];
    var max = parseInt(u.max_connections, 10), act = parseInt(u.active_cons, 10);
    if(max > 0) info.push(max + (max === 1 ? ' Verbindung' : ' Verbindungen'));
    var warn = (max > 0 && act >= max)
      ? 'Hinweis: Alle ' + max + ' Verbindungen sind gerade belegt – Sender starten erst, wenn eine frei wird.' : '';
    return { ok: true, info: info.join(' · '), warn: warn };
  },

  _m3u: async function(p) {
    var r;
    try { r = await this._fetch(p.m3uUrl, 30000); }
    catch(e) { return { ok: false, msg: 'Die Playlist ist nicht erreichbar. Bitte den Link und die Internetverbindung prüfen.' }; }
    if(r.status === 401 || r.status === 403) return { ok: false, msg: 'Zugriff verweigert – der Link ist falsch oder das Konto ist abgelaufen.' };
    if(r.status === 404) return { ok: false, msg: 'Unter diesem Link gibt es keine Playlist (Fehler 404).' };
    if(!r.ok) return { ok: false, msg: 'Der Server meldet einen Fehler (' + r.status + '). Bitte später erneut versuchen.' };
    var text = await r.text();
    var parsed = text.indexOf('#EXTINF') !== -1 ? parseM3U(text) : null;
    if(!parsed || !parsed.streams.length) return { ok: false, msg: 'Unter diesem Link wurde keine gültige M3U-Playlist gefunden.' };
    return { ok: true, info: parsed.streams.length + ' Sender gefunden', m3u: { streams: parsed.streams, categories: parsed.categories } };
  }
};

// Qualitätsangabe am Namensende: HD/FHD/4K/RAW ..., "(4K)" und hochgestellte
// Buchstaben wie "RTL ᴴᴰ" / "Sky ᴿᴬᵂ" (eigene Unicode-Zeichen, keine Formatierung)
var WIZ_QUALITY_RULE = '\\s*\\(4K\\)\\s*$|\\s+(FHD|UHD|4K|2K|HD|SD|RAW|1080p?|720p?|480p?|HEVC)[*+]?\\s*\\d*\\s*$|' +
                       '\\s*[\\u02B0-\\u02FF\\u1D2C-\\u1D6A\\u1D9B-\\u1DBF\\u2070-\\u209F]{2,}\\s*$';
// Gleiche Regel = gleiches Muster oder eine frühere Fassung davon (wird ersetzt statt verdoppelt)
function _wizSameRule(it, r) {
  if(r.type !== it.rule.type) return false;
  if(r.pattern === it.rule.pattern) return true;
  var L = it.legacyPattern;
  return !!L && (Array.isArray(L) ? L.indexOf(r.pattern) !== -1 : r.pattern === L);
}

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
      /^(?:4[Kk]-BLURAY|4[Kk]|BLURAY)-([A-Z]{2,3})\s*[-–]\s*/, // BLURAY-DE - , 4K-DE - , 4K-BLURAY-DV -
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
    // PPV-Sendernamen tragen diese Wörter oft als Namensbestandteil (Event-Status),
    // keine Ländercodes — sonst würde z.B. "NEXT: Fight Night" fälschlich als
    // Präfix-Regel "NEXT" vorgeschlagen und Teile echter Sendernamen abgeschnitten.
    var PREFIX_BLACKLIST = { NEXT:1, ENDED:1, LIVE:1 };
    Object.keys(prefixCounts).forEach(function(countryCode){
      if (PREFIX_BLACKLIST[countryCode.toUpperCase()]) return;
      var cnt = prefixCounts[countryCode];
      if(cnt > 0){
        // Letzte Variante mit optionalem Release-Vorsatz: "DE - ", "BLURAY-DE - ",
        // "4K-DE - ", "4K-BLURAY-DE - " (Groß-/Kleinschreibung egal, Regel läuft mit /gi)
        var regexPattern = "^(?:\\|\\s*" + countryCode + "\\s*\\||" + countryCode + "\\s*[:\\|]|\\[\\s*" + countryCode + "\\s*\\]|(?:(?:4K-BLURAY|4K|BLURAY)-)?" + countryCode + "\\s*[-–])\\s*";
        // Frühere Fassung der Regel (vor 0.1.1) - wird beim erneuten Optimieren ersetzt
        var legacyPattern = "^(?:\\|\\s*" + countryCode + "\\s*\\||" + countryCode + "\\s*[:\\|]|\\[\\s*" + countryCode + "\\s*\\]|" + countryCode + "\\s*[-–])\\s*";
        var examples = names.filter(function(n){ return new RegExp(regexPattern, "i").test(n); }).slice(0,2);
        if(examples.length > 0){
          results.push({
            id: 'prefix_'+countryCode,
            type: 'rule',
            rule: {target:'both', type:'regex', pattern: regexPattern, replacement:''},
            legacyPattern: legacyPattern,
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
    // Zusätzlich "(4K)" am Ende, egal ob groß/klein ("Avatar (4k)")
    var qRe = new RegExp(WIZ_QUALITY_RULE, 'i');
    names.forEach(function(n){ if(qRe.test(n)) qCount++; });
    if(qCount > 0){
        results.push({
          id: 'suffix_quality',
          type: 'rule',
          rule: {target:'stream', type:'regex', pattern: WIZ_QUALITY_RULE, replacement:''},
          legacyPattern: ['\\s*\\(4K\\)\\s*$|\\s+(FHD|UHD|4K|2K|HD|SD|1080p?|720p?|480p?|HEVC)[*+]?\\s*\\d*\\s*$',
                          '\\s+(FHD|UHD|4K|2K|HD|SD|1080p?|720p?|480p?|HEVC)[*+]?\\s*\\d*\\s*$'],
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
// EINRICHTUNG ALS FRAGEN - eine Frage pro Bildschirm, mit Beispielen aus
// der eigenen Playlist. Reihenfolge: Inhalte -> Länder -> Erwachsenen-
// Inhalte -> Kategorien anpassen -> Namen bereinigen -> Übersicht.
// Die Länder kommen zuerst: danach beziehen sich Beispiele und Zahlen nur
// noch auf die Sender, die man behält.
// ════════════════════════════════════════════════════════════

// Länder: Kürzel/Namen, wie Anbieter sie vor Kategorien schreiben
var WIZ_COUNTRIES = {
  DE: ['Deutschland', 'GER DEU GERMANY GERMAN DEUTSCH DEUTSCHLAND'],
  AT: ['Österreich', 'AUT AUSTRIA ÖSTERREICH OSTERREICH OESTERREICH'],
  CH: ['Schweiz', 'SUI CHE SWISS SWITZERLAND SCHWEIZ'],
  UK: ['Großbritannien', 'GB UNITED-KINGDOM ENGLAND BRITISH BRITAIN'],
  EN: ['Englisch', 'ENG ENGLISH'],
  US: ['USA', 'USA AMERICA AMERICAN'],
  TR: ['Türkei', 'TUR TURKEY TÜRKIYE TURKIYE TÜRKEI TURKISH TÜRK'],
  FR: ['Frankreich', 'FRA FRANCE FRANKREICH FRENCH'],
  IT: ['Italien', 'ITA ITALY ITALIA ITALIEN ITALIAN'],
  ES: ['Spanien', 'ESP SPAIN ESPANA ESPAÑA SPANIEN SPANISH'],
  PT: ['Portugal', 'POR PRT PORTUGAL PORTUGUESE'],
  NL: ['Niederlande', 'NED NLD NETHERLANDS HOLLAND NIEDERLANDE DUTCH'],
  BE: ['Belgien', 'BEL BELGIUM BELGIEN'],
  PL: ['Polen', 'POL POLAND POLSKA POLEN POLISH'],
  GR: ['Griechenland', 'GRE GRC GREECE GRIECHENLAND GREEK'],
  RO: ['Rumänien', 'ROU ROM ROMANIA RUMÄNIEN'],
  BG: ['Bulgarien', 'BUL BGR BULGARIA BULGARIEN'],
  HU: ['Ungarn', 'HUN HUNGARY UNGARN'],
  CZ: ['Tschechien', 'CZE CZECH TSCHECHIEN'],
  SK: ['Slowakei', 'SVK SLOVAKIA SLOWAKEI'],
  HR: ['Kroatien', 'CRO HRV CROATIA KROATIEN'],
  RS: ['Serbien', 'SRB SERBIA SERBIEN'],
  BA: ['Bosnien', 'BIH BOSNIA BOSNIEN'],
  SI: ['Slowenien', 'SLO SVN SLOVENIA SLOWENIEN'],
  MK: ['Nordmazedonien', 'MKD MACEDONIA MAZEDONIEN'],
  AL: ['Albanien', 'ALB ALBANIA ALBANIEN'],
  EXYU: ['Ex-Jugoslawien', 'EXYU EX-YU YU BALKAN'],
  RU: ['Russland', 'RUS RUSSIA RUSSLAND RUSSIAN'],
  UA: ['Ukraine', 'UKR UKRAINE'],
  SE: ['Schweden', 'SWE SWEDEN SCHWEDEN'],
  NO: ['Norwegen', 'NOR NORWAY NORWEGEN'],
  DK: ['Dänemark', 'DEN DNK DENMARK DÄNEMARK'],
  FI: ['Finnland', 'FIN FINLAND FINNLAND'],
  AR: ['Arabisch', 'ARA ARAB ARABIC ARABIA'],
  KU: ['Kurdisch', 'KURD KURDISH KURDISTAN'],
  IR: ['Iran', 'IRN IRAN PERSIAN FARSI'],
  IN: ['Indien', 'IND INDIA INDIAN HINDI'],
  PK: ['Pakistan', 'PAK PAKISTAN'],
  CA: ['Kanada', 'CAN CANADA KANADA'],
  AU: ['Australien', 'AUS AUSTRALIA AUSTRALIEN'],
  BR: ['Brasilien', 'BRA BRAZIL BRASIL BRASILIEN'],
  MX: ['Mexiko', 'MEX MEXICO MEXIKO'],
  LATAM: ['Lateinamerika', 'LATAM LATINO LATIN'],
  AFR: ['Afrika', 'AFR AFRICA AFRIKA AFRICAN'],
  IL: ['Israel', 'ISR ISRAEL'],
  CN: ['China', 'CHN CHINA CHINESE'],
  JP: ['Japan', 'JPN JAPAN JAPANESE'],
  KR: ['Korea', 'KOR KOREA KOREAN']
};
// Kein Land, auch wenn es wie ein Kürzel aussieht ("VOD | DE | Action", "4K | ...")
var WIZ_NOT_COUNTRY = ' HD FHD UHD SD 4K 8K 2K VIP PPV VOD XXX NEW TOP LIVE NEXT ENDED TV ALL MIX KIDS HEVC RAW PRO MAX ' +
                      'PLUS BOX EPG RADIO DOC ADULT FOR THE BLURAY BLU WEB DL HDR SDR DV REMUX MULTI 24/7 247 ';
var _wizAlias = null, _wizNameRe = null;
function _wizBuildAlias() {
  _wizAlias = {};
  var names = [];
  Object.keys(WIZ_COUNTRIES).forEach(function(code){
    _wizAlias[code] = code;
    WIZ_COUNTRIES[code][1].split(' ').forEach(function(a){
      _wizAlias[a] = code;
      if(a.length > 3) names.push(a.replace(/-/g, '[- ]'));
    });
  });
  _wizNameRe = new RegExp('(^|[^A-ZÄÖÜ])(' + names.join('|') + ')([^A-ZÄÖÜ]|$)', 'i');
}
// Land einer Kategorie aus ihrem Namen, '' = unbekannt
function _wizCountryOf(name) {
  if(!_wizAlias) _wizBuildAlias();
  var s = String(name || '').trim();
  var code = function(tok) {
    tok = tok.trim();
    var up = tok.toUpperCase();
    if(_wizAlias[up]) return _wizAlias[up];
    if(/^[A-Z]{2,3}$/.test(tok) && WIZ_NOT_COUNTRY.indexOf(' ' + up + ' ') === -1) return up;   // unbekanntes Kürzel
    return '';
  };
  // Vorne stehende Teile prüfen: "DE | Sport", "VOD | DE | Action", "[DE] Sport", "4K-BLURAY-DE - Action"
  var parts = s.split(/\s*[|:\[\]►▶»•]\s*|\s+[-–]\s+/).filter(function(p){ return p.trim(); });
  for(var i = 0; i < parts.length && i < 3; i++) {
    var tok = parts[i].trim(), hit = code(tok);
    if(hit) return hit;
    var sub = tok.split('-');
    for(var j = 0; sub.length > 1 && j < sub.length; j++) { hit = code(sub[j]); if(hit) return hit; }
    // "DE Sport" / "Germany Sport": erstes Wort
    var first = tok.split(/\s+/)[0], up = first.toUpperCase();
    if(_wizAlias[up] && (first.length > 3 || first === up)) return _wizAlias[up];
    if(WIZ_NOT_COUNTRY.indexOf(' ' + tok.toUpperCase() + ' ') === -1 && sub.length < 2) break;   // echter Name ohne Land
  }
  var m = s.match(_wizNameRe);                    // ausgeschriebener Ländername irgendwo
  return m ? _wizAlias[m[2].toUpperCase().replace(' ', '-')] || '' : '';
}
var WIZ_ADULT_RE = /(^|[^a-z0-9])(xxx|adults?|18\s?\+|\+\s?18|porn\w*|erotik\w*|erotic\w*|sexy?|for adults)([^a-z0-9]|$)/i;

function _wizNum(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '.'); }

var WizQ = {
  STEPS: ['mods', 'countries', 'adult', 'custom', 'catlist', 'prefix', 'quality', 'dups', 'premium', 'placeholders', 'empty', 'list', 'split', 'netflix', 'summary'],
  TYPE_LABEL: { live: 'Live TV', vod: 'Filme', series: 'Serien' },

  start: function(firstRun) {
    this.firstRun = firstRun;
    this.mods = { live: true, vod: Settings.showVod !== false, series: Settings.showSeries !== false };
    if(S.isM3U) this.mods = { live: true, vod: false, series: false };
    this.data = {};                 // typ -> {cats, streams}
    this.cats = {};                 // 'typ:id' -> {key,type,id,name,count,country,adult}
    this.visible = {};              // 'typ:id' -> bool
    this.sel = null;                // Land -> gewählt
    this.answers = {};
    this._history = [];
    this._toSummary = false;
    this._detCache = null;
    // Entwürfe wie im Playlist-Editor (dort weiter bearbeitbar)
    peDraftVisCats = JSON.parse(JSON.stringify(Settings.hiddenCats || { live: [], vod: [], series: [] }));
    peDraftRules = JSON.parse(JSON.stringify(Settings.playlistRules || []));
    document.querySelectorAll('.wiz-step').forEach(function(e){ e.classList.remove('active'); });
    $('wiz-step-q').classList.add('active');
    var cont = $('wiz-q');
    cont.onmouseover = function(e){
      var el = e.target.closest && e.target.closest('[data-focusable]');
      if(el && el !== SpatialNav.focused) setFocus(el);
    };
    if(this._applies('mods')) this._go('mods');
    else this._loadThen(function(){ WizQ._go(WizQ._nextAfter('mods')); });
  },

  // ── Daten ─────────────────────────────────────────────────────
  _loadThen: async function(cb) {
    var types = ['live', 'vod', 'series'].filter(function(t){ return WizQ.mods[t] && !WizQ.data[t]; });
    for(var i = 0; i < types.length; i++) {
      var t = types[i];
      var label = { live: 'Sender werden', vod: 'Filme werden', series: 'Serien werden' }[t];
      showFullLoader(label + ' geladen …', 'Bei großen Playlists kann das etwas dauern');
      var cats = [], streams = [];
      try { cats = await getOrFetchData('cats', t) || []; } catch(e) {}
      // Laufende Menge anzeigen - die Gesamtgröße schicken die meisten Anbieter nicht mit
      var shown = 0;
      API.onProgress = function(bytes){
        if(bytes - shown < 262144) return;        // alle 0,25 MB aktualisieren
        shown = bytes;
        var sub = $('fl-sub');
        if(sub) { sub.style.display = 'block'; sub.textContent = (bytes / 1048576).toFixed(1).replace('.', ',') + ' MB geladen'; }
      };
      try { streams = await getOrFetchData('streams', t) || []; } catch(e) {}
      API.onProgress = null;
      S.rawStreams[t] = streams;
      this.data[t] = { cats: cats, streams: streams };
      this._index(t);
    }
    hideFullLoader();
    this._detCache = null;
    cb();
  },

  _index: function(t) {
    var self = this, counts = {}, hidden = (Settings.hiddenCats && Settings.hiddenCats[t]) || [], added = [];
    this.data[t].streams.forEach(function(s){ var c = String(s.category_id); counts[c] = (counts[c] || 0) + 1; });
    this.data[t].cats.forEach(function(c){
      var id = String(c.category_id), key = t + ':' + id;
      self.cats[key] = { key: key, type: t, id: id, name: c.category_name || '', count: counts[id] || 0,
                         country: _wizCountryOf(c.category_name), adult: WIZ_ADULT_RE.test(c.category_name || '') };
      added.push(key);
    });
    // Unbekannte Kürzel, die nur einmal vorkommen, sind eher Namensteile -> "Sonstige"
    var freq = {};
    Object.keys(this.cats).forEach(function(k){ var c = self.cats[k].country; if(c) freq[c] = (freq[c] || 0) + 1; });
    Object.keys(this.cats).forEach(function(k){
      var c = self.cats[k].country;
      if(c && !WIZ_COUNTRIES[c] && freq[c] < 2) self.cats[k].country = '';
    });
    this._initSelection();
    // Sichtbarkeit nur für die neu geladenen Kategorien setzen - bereits
    // getroffene Einzelentscheidungen anderer Inhalte bleiben unberührt
    added.forEach(function(k){
      var c = self.cats[k];
      self.visible[k] = self.firstRun ? (!!self.sel[c.country] && !(c.adult && self.answers.adult))
                                      : hidden.indexOf(c.id) === -1;
    });
  },

  _countries: function() {
    var self = this, map = {}, list = [];
    Object.keys(this.cats).forEach(function(k){
      var c = self.cats[k], code = c.country;
      if(!map[code]) { map[code] = { code: code, label: code ? (WIZ_COUNTRIES[code] ? WIZ_COUNTRIES[code][0] : code) : 'Sonstige', cats: 0, items: 0 }; list.push(map[code]); }
      map[code].cats++;
      map[code].items += c.count;
    });
    // Größte zuerst, "Sonstige" ans Ende
    list.sort(function(a, b){ return (a.code === '') - (b.code === '') || b.items - a.items; });
    return list;
  },

  _initSelection: function() {
    var self = this, countries = this._countries();
    var prev = this.sel;
    this.sel = {};
    if(this.firstRun) {
      var lang = String(navigator.language || 'de').toLowerCase();
      var pref = lang.indexOf('de') === 0 ? ['DE', 'AT', 'CH'] : lang.indexOf('tr') === 0 ? ['TR'] :
                 lang.indexOf('en') === 0 ? ['UK', 'US'] : [(lang.split('-')[1] || '').toUpperCase()];
      var any = countries.some(function(c){ return pref.indexOf(c.code) !== -1; });
      countries.forEach(function(c){
        self.sel[c.code] = prev && c.code in prev ? prev[c.code] : (!any || c.code === '' || pref.indexOf(c.code) !== -1);
      });
    } else {
      // Erneuter Durchlauf: Land gilt als gewählt, wenn etwas davon sichtbar ist
      // (Sichtbarkeit kommt hier noch direkt aus den gespeicherten Einstellungen)
      var hiddenOf = function(c){ return ((Settings.hiddenCats && Settings.hiddenCats[c.type]) || []).indexOf(c.id) !== -1; };
      countries.forEach(function(c){ self.sel[c.code] = prev && c.code in prev ? prev[c.code] : false; });
      Object.keys(this.cats).forEach(function(k){ var c = self.cats[k]; if(!hiddenOf(c) && !(prev && c.country in prev)) self.sel[c.country] = true; });
    }
    var adultCats = this._adultKeys();
    if(!('adult' in this.answers)) {
      this.answers.adult = this.firstRun || !adultCats.length ||
        adultCats.every(function(k){ var c = self.cats[k]; return ((Settings.hiddenCats && Settings.hiddenCats[c.type]) || []).indexOf(c.id) !== -1; });
    }
  },

  _adultKeys: function() {
    var self = this;
    return Object.keys(this.cats).filter(function(k){ return self.cats[k].adult; });
  },
  // Sichtbarkeit aus Länderauswahl + Erwachsenen-Antwort (überschreibt Einzeländerungen)
  _applyCountries: function() {
    var self = this;
    Object.keys(this.cats).forEach(function(k){
      var c = self.cats[k];
      self.visible[k] = !!self.sel[c.country] && !(c.adult && self.answers.adult);
    });
    this._detCache = null;
  },

  _kept: function(t) {
    if(!this.data[t]) return [];
    var vis = this.visible;
    return this.data[t].streams.filter(function(s){ return vis[t + ':' + String(s.category_id)] !== false; });
  },

  // Erkennung auf den behaltenen Sendern/Titeln (vor allen Regeln)
  _det: function() {
    if(this._detCache) return this._detCache;
    var live = this._kept('live'), vod = this._kept('vod'), ser = this._kept('series');
    var items = AutoDetect.run(live.concat(vod));
    if(ser.length) AutoDetect.run(ser).forEach(function(it){
      if(it.type !== 'rule' || !/^(prefix_|suffix_)/.test(it.id)) return;
      if(items.some(function(x){ return x.id === it.id; })) return;
      items.push(it);
    });
    var byId = function(id){ return items.filter(function(x){ return x.id === id; })[0] || null; };
    var names = function(arr){ return arr.map(function(s){ return s.name || s.title || ''; }).filter(Boolean); };
    var allNames = names(live).concat(names(vod), names(ser));
    var d = { prefix: items.filter(function(x){ return /^prefix_/.test(x.id); }),
              quality: byId('suffix_quality'), premium: byId('suffix_premium'), placeholders: byId('placeholders') };

    // Länderkürzel: alle Kürzel zusammen, plus gleichlautende Namen danach
    var res = d.prefix.map(function(it){ return { code: it.id.replace('prefix_', ''), re: new RegExp(it.rule.pattern, 'i') }; });
    var stripP = function(n){ for(var i = 0; i < res.length; i++) if(res[i].re.test(n)) return { name: n.replace(res[i].re, ''), code: res[i].code }; return null; };
    d.prefixMatches = allNames.filter(function(n){ return stripP(n); });
    var seen = {}, clash = 0, clashEx = null;
    names(live).forEach(function(n){
      var r = stripP(n); if(!r) return;
      var k = r.name.toLowerCase().trim();
      if(!seen[k]) seen[k] = { code: r.code, orig: n };
      else if(seen[k].code !== r.code && !seen[k].clash) { seen[k].clash = true; clash++; if(!clashEx) clashEx = [seen[k].orig, n]; }
    });
    d.prefixClash = clash; d.prefixClashEx = clashEx;
    d.stripPrefix = function(n){ var r = stripP(n); return r ? r.name : n; };

    var matches = function(it){ if(!it) return []; var re = new RegExp(it.rule.pattern, 'i'); return allNames.filter(function(n){ return re.test(n); }); };
    d.qualityMatches = matches(d.quality);
    d.premiumMatches = matches(d.premium);
    var phRe = /^[#=\-*_]{3,}/;
    d.placeholderMatches = d.placeholders ? names(live).filter(function(n){ return phRe.test(n.trim()); }) : [];

    // Duplikate unter den Live-Sendern (so wie sie nach dem Bereinigen heißen)
    var groups = {}, order = [];
    names(live).forEach(function(n){
      var shown = WizQ.answers.prefix !== false ? d.stripPrefix(n) : n;
      var b = _baseName(shown);
      if(!b) return;
      if(!groups[b]) { groups[b] = []; order.push(b); }
      groups[b].push(shown);
    });
    d.dupGroups = order.filter(function(b){ return groups[b].length > 1; }).map(function(b){ return groups[b]; });

    // Leere Kategorien (unter den sichtbaren)
    var self = this;
    d.empty = Object.keys(this.cats).filter(function(k){ return self.visible[k] && self.cats[k].count === 0; });
    this._detCache = d;
    return d;
  },

  // ── Ablauf ────────────────────────────────────────────────────
  _applies: function(step) {
    switch(step) {
      case 'mods': return !S.isM3U;
      case 'countries': return this._countries().length >= 2;
      case 'adult': return this._adultKeys().length > 0;
      case 'custom': return Object.keys(this.cats).length > 0;
      case 'catlist': return this.answers.custom === true;
      case 'prefix': return this._det().prefixMatches.length > 0;
      case 'quality': return this._det().qualityMatches.length > 0;
      case 'dups': return this._det().dupGroups.length > 0;
      case 'premium': return this._det().premiumMatches.length > 0;
      case 'placeholders': return this._det().placeholderMatches.length > 0;
      case 'empty': return this._det().empty.length > 0;
      case 'split': return this.answers.list !== 'tiles';                 // gibt es nur bei normaler/kompakter Liste
      case 'netflix': return !!(this.mods.vod || this.mods.series);
      default: return true;
    }
  },
  _nextAfter: function(step) {
    for(var i = this.STEPS.indexOf(step) + 1; i < this.STEPS.length; i++) {
      if(this._applies(this.STEPS[i])) return this.STEPS[i];
    }
    return 'summary';
  },
  // Nur für die Anzeige "Frage x von y"
  _questions: function() {
    var self = this;
    return this.STEPS.filter(function(s){ return s !== 'catlist' && s !== 'summary' && self._applies(s); });
  },

  _go: function(step, isBack) {
    if(!isBack && this._step && this._step !== step) this._history.push(this._step);
    this._step = step;
    if(step === 'summary') this._toSummary = false;
    this._defaultAnswer(step);
    this._render();
  },
  // Antwort gegeben bzw. "Weiter": nächste Frage - oder zurück zur Übersicht,
  // wenn die Frage von dort aus geändert wurde
  _advance: function() {
    var cur = this._step;
    if(cur === 'custom' && this.answers.custom) return this._go('catlist');
    if(this._toSummary) return this._go('summary');
    this._go(this._nextAfter(cur));
  },
  back: function() {
    if(document.activeElement && document.activeElement.blur && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    var prev = this._history.pop();
    if(prev) { this._go(prev, true); return; }
    // Vor der ersten Frage
    if(this.firstRun) {
      $('wiz-step-q').classList.remove('active');
      $('wiz-step-2').classList.add('active');
      setTimeout(function(){ SpatialNav.focusBySelector('#wiz-btn-next'); }, 50);
    } else {
      this._exitToEditor();
    }
  },
  edit: function(step) {
    this._toSummary = true;
    if(step === 'catlist') this.answers.custom = true;
    this._go(step);
  },

  _defaultAnswer: function(step) {
    if(step in this.answers || ['mods', 'countries', 'catlist', 'summary'].indexOf(step) !== -1) return;
    if(step === 'custom') { this.answers.custom = false; return; }
    // Aussehen: immer der aktuelle Stand (auf Handys sind die Kacheln schon voreingestellt)
    if(step === 'list') { this.answers.list = Settings.tileList ? 'tiles' : Settings.compactList ? 'compact' : 'normal'; return; }
    if(step === 'split') { this.answers.split = !!Settings.splitList; return; }
    if(step === 'netflix') { this.answers.netflix = Settings.useNetflixStyle !== false; return; }
    if(this.firstRun) { this.answers[step] = true; return; }
    // Erneuter Durchlauf: aktueller Zustand
    var d = this._det();
    var has = function(it){ return !!it && peDraftRules.some(function(r){ return _wizSameRule(it, r); }); };
    if(step === 'prefix') this.answers.prefix = d.prefix.some(has);
    else if(step === 'quality') this.answers.quality = has(d.quality);
    else if(step === 'premium') this.answers.premium = has(d.premium);
    else if(step === 'placeholders') this.answers.placeholders = has(d.placeholders);
    else if(step === 'dups') this.answers.dups = Settings.groupVariants !== false;
    else if(step === 'empty') this.answers.empty = true;
  },

  // ── Antworten ─────────────────────────────────────────────────
  answer: function(val) {
    var step = this._step;
    this.answers[step] = val;
    if(step === 'adult') {
      var self = this;
      this._adultKeys().forEach(function(k){ self.visible[k] = !val && !!self.sel[self.cats[k].country]; });
      this._detCache = null;
    }
    if(step === 'prefix') this._detCache = null;   // Duplikat-Beispiele hängen davon ab
    this._advance();
  },
  toggleMod: function(t) {
    if(t === 'live') return;                      // Live TV wird immer benötigt
    this.mods[t] = !this.mods[t];
    var el = $('wq-mod-' + t);
    if(el) el.classList.toggle('selected', this.mods[t]);
  },
  modsDone: function() {
    var self = this;
    // Abgewählte Inhalte fallen ganz aus der Auswertung (ihre gespeicherten
    // Einstellungen bleiben beim Abschluss unverändert)
    ['vod', 'series'].forEach(function(t){ if(!self.mods[t]) delete self.data[t]; });
    Object.keys(this.cats).forEach(function(k){
      if(!self.mods[self.cats[k].type]) { delete self.cats[k]; delete self.visible[k]; }
    });
    this._detCache = null;
    this._loadThen(function(){ WizQ._advance(); });
  },
  toggleCountry: function(i) {
    var c = this._countries()[i]; if(!c) return;
    this.sel[c.code] = !this.sel[c.code];
    var el = $('wq-c-' + i);
    if(el) el.classList.toggle('selected', this.sel[c.code]);
  },
  countriesDone: function() {
    var self = this;
    if(!this._countries().some(function(c){ return self.sel[c.code]; })) { showToast('Bitte mindestens ein Land auswählen', 2500); return; }
    // Nur bei geänderter Auswahl neu berechnen - sonst blieben Einzeländerungen
    // aus einem früheren Durchlauf nicht erhalten
    if(JSON.stringify(this.sel) !== this._selAtEntry) this._applyCountries();
    this._advance();
  },
  toggleCat: function(key) {
    this.visible[key] = !this.visible[key];
    this._detCache = null;
    var el = document.querySelector('#wq-list [data-key="' + key + '"]');
    if(el) el.classList.toggle('selected', this.visible[key]);
  },
  groupAll: function(g, on) {
    var self = this;
    document.querySelectorAll('#wq-list .wiz-cat-item[data-g="' + g + '"]').forEach(function(el){
      if(el.style.display === 'none') return;     // bei Suche nur die gefundenen
      var k = el.getAttribute('data-key');
      self.visible[k] = on;
      el.classList.toggle('selected', on);
    });
    this._detCache = null;
  },
  filterList: function(q) {
    q = String(q || '').toLowerCase().trim();
    var groups = {};
    document.querySelectorAll('#wq-list .wiz-cat-item').forEach(function(el){
      var show = !q || el.getAttribute('data-name').indexOf(q) !== -1;
      el.style.display = show ? '' : 'none';
      if(show) groups[el.getAttribute('data-g')] = true;
    });
    document.querySelectorAll('#wq-list .wq-group').forEach(function(el){
      el.style.display = groups[el.getAttribute('data-g')] ? '' : 'none';
    });
  },

  // ── Darstellung ───────────────────────────────────────────────
  _btnBack: '<button class="wiz-btn wiz-btn-ghost" data-focusable onclick="WizQ.back()">Zurück</button>',

  _render: function() {
    var step = this._step, html = '', focusSel = null, cont = $('wiz-q');
    var qs = this._questions(), qi = qs.indexOf(step === 'catlist' ? 'custom' : step);
    var prog = step === 'summary' ? 'Übersicht' : 'Frage ' + (qi + 1) + ' von ' + qs.length;
    var pct = step === 'summary' ? 100 : Math.round((qi + 1) / (qs.length + 1) * 100);
    html += '<div class="wq-head"><div class="wq-prog">' + prog + '</div><div class="wq-bar"><i style="width:' + pct + '%"></i></div></div>';
    var r = this['_r_' + step]();
    html += '<div class="wiz-title">' + r.title + '</div>';
    if(r.sub) html += '<div class="wiz-sub wq-sub">' + r.sub + '</div>';
    html += '<div class="wq-body">' + (r.body || '') + '</div>';
    if(r.yesNo) {
      var yes = this.answers[step] !== false;
      html += '<div class="wiz-btn-row">' + this._btnBack +
              '<button class="wiz-btn wiz-btn-ghost wq-no" data-focusable onclick="WizQ.answer(false)">Nein</button>' +
              '<button class="wiz-btn wiz-btn-ghost wq-yes" data-focusable onclick="WizQ.answer(true)">Ja</button></div>';
      focusSel = yes ? '.wq-yes' : '.wq-no';
    } else {
      html += '<div class="wiz-btn-row">' + this._btnBack + r.buttons + '</div>';
      focusSel = r.focus;
    }
    cont.innerHTML = html;
    var box = document.querySelector('#wizard-screen .wiz-box');
    if(box) box.scrollTop = 0;
    if(step === 'countries') this._selAtEntry = JSON.stringify(this.sel);
    setTimeout(function(){
      var el = cont.querySelector(focusSel) || cont.querySelector('[data-focusable]');
      if(el) SpatialNav.focus(el);
    }, 60);
  },

  _examples: function(rows, count, note) {
    var html = '<div class="wq-ex">';
    rows.forEach(function(r){
      html += '<div class="wq-ex-row"><span class="wq-before">' + esc(r[0]) + '</span><span class="wq-arrow">&#x2192;</span>' +
              '<span class="wq-after">' + esc(r[1]) + '</span></div>';
    });
    if(count) html += '<div class="wq-count">' + count + '</div>';
    if(note) html += '<div class="wq-note">' + note + '</div>';
    return html + '</div>';
  },
  // Bis zu 3 Beispiele, über die Liste verteilt (nicht nur die ersten)
  _pick: function(arr, n) {
    n = n || 3;
    if(arr.length <= n) return arr.slice();
    var out = [];
    for(var i = 0; i < n; i++) out.push(arr[Math.floor(i * (arr.length - 1) / (n - 1))]);
    return out;
  },

  _r_mods: function() {
    var self = this, tile = function(t, ico) {
      return '<button class="wq-tile wq-mod' + (self.mods[t] ? ' selected' : '') + '" id="wq-mod-' + t + '" data-focusable onclick="WizQ.toggleMod(\'' + t + '\')">' +
             '<span class="wq-mod-ico">' + ico + '</span><span class="wq-tile-name">' + self.TYPE_LABEL[t] + '</span>' +
             (t === 'live' ? '<span class="wq-tile-sub">immer dabei</span>' : '') + '</button>';
    };
    return { title: 'Was möchtest du sehen?', sub: 'Filme und Serien laden beim ersten Mal etwas länger.',
             body: '<div class="wq-tiles wq-mods">' + tile('live', '&#x1F4FA;') + tile('vod', '&#x1F3AC;') + tile('series', '&#x1F37F;') + '</div>',
             buttons: '<button class="wiz-btn" id="wq-next" data-focusable onclick="WizQ.modsDone()">Weiter</button>', focus: '#wq-next' };
  },

  _r_countries: function() {
    var self = this, html = '<div class="wq-tiles">';
    this._countries().forEach(function(c, i){
      html += '<button class="wq-tile' + (self.sel[c.code] ? ' selected' : '') + '" id="wq-c-' + i + '" data-focusable onclick="WizQ.toggleCountry(' + i + ')">' +
              '<span class="wq-badge">' + (c.code ? esc(c.code) : '&#x2026;') + '</span>' +
              '<span class="wq-tile-name">' + esc(c.label) + '</span>' +
              '<span class="wq-tile-sub">' + _wizNum(c.cats) + (c.cats === 1 ? ' Kategorie' : ' Kategorien') + ' · ' + _wizNum(c.items) + (c.items === 1 ? ' Eintrag' : ' Einträge') + '</span></button>';
    });
    return { title: 'Welche Länder möchtest du sehen?',
             sub: 'Kategorien der anderen Länder werden ausgeblendet. Unter „Sonstige“ stehen Kategorien ohne Länderkennung.',
             body: html + '</div>', buttons: '<button class="wiz-btn" id="wq-next" data-focusable onclick="WizQ.countriesDone()">Weiter</button>', focus: '#wq-next' };
  },

  _r_adult: function() {
    var n = this._adultKeys().length;
    return { title: 'Erwachsenen-Inhalte ausblenden?', yesNo: true,
             sub: 'In deiner Playlist gibt es ' + _wizNum(n) + (n === 1 ? ' Kategorie' : ' Kategorien') + ' mit Erwachsenen-Inhalten (z. B. „XXX“, „Adult“, „18+“).' };
  },

  _r_custom: function() {
    var self = this, keys = Object.keys(this.cats), vis = keys.filter(function(k){ return self.visible[k]; }).length;
    return { title: 'Möchtest du einzelne Kategorien anpassen?', yesNo: true,
             sub: 'Aktuell werden ' + _wizNum(vis) + ' von ' + _wizNum(keys.length) + ' Kategorien angezeigt. Bei „Nein“ geht es direkt weiter.' };
  },

  _r_catlist: function() {
    var self = this, countries = this._countries(), groups = {}, order = [];
    Object.keys(this.cats).forEach(function(k){
      var c = self.cats[k];
      if(!self.sel[c.country] || (c.adult && self.answers.adult)) return;
      var g = c.type + ':' + c.country;
      if(!groups[g]) { groups[g] = []; order.push(g); }
      groups[g].push(c);
    });
    var rank = function(g){
      var p = g.split(':'), t = ['live', 'vod', 'series'].indexOf(p[0]);
      var ci = 0; countries.forEach(function(c, i){ if(c.code === p[1]) ci = i; });
      return t * 1000 + ci;
    };
    order.sort(function(a, b){ return rank(a) - rank(b); });
    var html = '<input id="wq-search" class="wiz-input" type="text" data-focusable placeholder="Kategorie suchen …" ' +
               'autocomplete="off" spellcheck="false" oninput="WizQ.filterList(this.value)"><div class="wq-list" id="wq-list">';
    order.forEach(function(g){
      var p = g.split(':'), label = WizQ.TYPE_LABEL[p[0]] + ' · ' + (p[1] ? (WIZ_COUNTRIES[p[1]] ? WIZ_COUNTRIES[p[1]][0] : p[1]) : 'Sonstige');
      html += '<div class="wq-group" data-g="' + g + '"><div class="wq-group-title">' + esc(label) + '</div>' +
              '<button class="wiz-btn-mini" data-focusable onclick="WizQ.groupAll(\'' + g + '\',true)">Alle an</button>' +
              '<button class="wiz-btn-mini" data-focusable onclick="WizQ.groupAll(\'' + g + '\',false)">Alle aus</button></div>';
      groups[g].forEach(function(c){
        html += '<div class="wiz-cat-item' + (self.visible[c.key] ? ' selected' : '') + '" data-focusable data-key="' + c.key + '" data-g="' + g + '" ' +
                'data-name="' + esc(c.name.toLowerCase()) + '" onclick="WizQ.toggleCat(\'' + c.key + '\')">' +
                '<div class="wiz-cat-cb">&#x2713;</div><div class="wq-cat-name">' + esc(c.name) + '</div>' +
                '<div class="wq-cat-count">' + _wizNum(c.count) + '</div></div>';
      });
    });
    return { title: 'Kategorien anpassen', sub: 'Markierte Kategorien werden angezeigt.',
             body: html + '</div>', buttons: '<button class="wiz-btn" data-focusable onclick="WizQ._advanceFromList()">Fertig</button>', focus: '#wq-list .wiz-cat-item' };
  },
  _advanceFromList: function() {
    if(this._toSummary) return this._go('summary');
    this._go(this._nextAfter('catlist'));
  },

  _r_prefix: function() {
    var d = this._det(), codes = d.prefix.map(function(it){ return it.id.replace('prefix_', ''); });
    var rows = this._pick(d.prefixMatches).map(function(n){ return [n, d.stripPrefix(n)]; });
    var note = d.prefixClash
      ? 'Achtung: ' + _wizNum(d.prefixClash) + (d.prefixClash === 1 ? ' Name kommt' : ' Namen kommen') + ' danach mehrfach vor, z. B. „' +
        esc(d.prefixClashEx[0]) + '“ und „' + esc(d.prefixClashEx[1]) + '“. Sie werden dann wie Duplikate zusammengefasst.' : '';
    return { title: 'Länderkürzel entfernen?', yesNo: true,
             sub: 'Die Namen werden kürzer und übersichtlicher' + (codes.length ? ' (' + esc(codes.slice(0, 6).join(', ')) + (codes.length > 6 ? ' …' : '') + ')' : '') + '.',
             body: this._examples(rows, 'betrifft ' + _wizNum(d.prefixMatches.length) + ' Einträge', note) };
  },
  _ruleRows: function(it, list) {
    var re = new RegExp(it.rule.pattern, 'i');
    return this._pick(list).map(function(n){ return [n, n.replace(re, '').trim()]; });
  },
  _r_quality: function() {
    var d = this._det();
    return { title: 'Qualitätsangaben entfernen?', yesNo: true,
             sub: 'Angaben wie HD, FHD oder 4K am Namensende fallen weg.',
             body: this._examples(this._ruleRows(d.quality, d.qualityMatches), 'betrifft ' + _wizNum(d.qualityMatches.length) + ' Einträge') };
  },
  _r_dups: function() {
    // Beispiele mit unterschiedlich geschriebenen Varianten zuerst ("RTL HD · RTL FHD")
    var uniq = function(g){ return g.filter(function(n, i){ return g.indexOf(n) === i; }); };
    var d = this._det(), groups = d.dupGroups.map(uniq).sort(function(a, b){ return b.length - a.length; });
    var qRe = new RegExp(WIZ_QUALITY_RULE, 'i');
    var rows = this._pick(groups.slice(0, 30)).map(function(g){
      var v = g.slice(0, 3).join(' · ') + (g.length > 3 ? ' …' : '');
      return [v, g[0].replace(qRe, '').trim()];
    });
    return { title: 'Duplikate zusammenfassen?', yesNo: true,
             sub: 'Gleiche Sender in verschiedenen Qualitäten erscheinen nur einmal. Die Varianten wählst du im Player über die Duplikate-Liste.',
             body: this._examples(rows, _wizNum(d.dupGroups.length) + ' Sender haben mehrere Varianten') };
  },
  _r_premium: function() {
    var d = this._det();
    return { title: 'Zusätze entfernen?', yesNo: true,
             sub: 'Wörter wie PREMIUM, BACKUP oder PLUS am Namensende fallen weg.',
             body: this._examples(this._ruleRows(d.premium, d.premiumMatches), 'betrifft ' + _wizNum(d.premiumMatches.length) + ' Einträge') };
  },
  _r_placeholders: function() {
    var d = this._det();
    var rows = this._pick(d.placeholderMatches).map(function(n){ return [n.trim(), 'ausgeblendet']; });
    return { title: 'Platzhalter ausblenden?', yesNo: true,
             sub: 'Trennzeilen wie „##### SPORT #####“ sind keine echten Sender.',
             body: this._examples(rows, _wizNum(d.placeholderMatches.length) + ' Platzhalter gefunden') };
  },
  _r_empty: function() {
    var n = this._det().empty.length;
    return { title: 'Leere Kategorien ausblenden?', yesNo: true,
             sub: _wizNum(n) + (n === 1 ? ' Kategorie enthält' : ' Kategorien enthalten') + ' keine Sender oder Titel.' };
  },

  // Auswahl mit Vorschaubildern: Antippen bzw. OK wählt und geht weiter
  _choice: function(opts, cols) {
    var cur = this.answers[this._step], html = '<div class="wq-tiles wq-choice' + (cols === 2 ? ' wq-choice2' : '') + '">';
    this._opts = opts;
    opts.forEach(function(o, i){
      html += '<button class="wq-tile wq-pick' + (o.val === cur ? ' selected' : '') + '" id="wq-o-' + i + '" data-focusable onclick="WizQ.choose(' + i + ')">' +
              '<span class="wq-pick-img" style="background-image:url(' + o.img + ')"></span>' +
              '<span class="wq-tile-name">' + o.label + '</span><span class="wq-tile-sub">' + o.sub + '</span></button>';
    });
    var idx = 0; opts.forEach(function(o, i){ if(o.val === cur) idx = i; });
    return { html: html + '</div>', focus: '#wq-o-' + idx };
  },
  choose: function(i) {
    var o = this._opts && this._opts[i]; if(!o) return;
    this.answers[this._step] = o.val;
    this._advance();
  },
  _r_list: function() {
    var c = this._choice([
      { val: 'tiles', label: 'Kacheln', sub: 'Sender als Kacheln unten im Bild', img: 'images/preview_kacheln.jpg' },
      { val: 'compact', label: 'Kompakt', sub: 'Schmale Liste am linken Rand', img: 'images/preview_kompakt_liste_on.jpg' },
      { val: 'normal', label: 'Normal', sub: 'Große Liste mit Programminfos', img: 'images/preview_kompakt_liste_off.jpg' }
    ], 3);
    return { title: 'Wie soll die Senderliste aussehen?', sub: 'Sie erscheint im Live TV mit OK bzw. durch Tippen ins Bild.',
             body: c.html, buttons: '', focus: c.focus };
  },
  _r_split: function() {
    var c = this._choice([
      { val: true, label: 'Zweispaltig', sub: 'Kategorien links neben den Sendern', img: 'images/preview_split_on.jpg' },
      { val: false, label: 'Einspaltig', sub: 'Kategorie oben wechseln', img: 'images/preview_split_off.jpg' }
    ], 2);
    return { title: 'Kategorien neben den Sendern anzeigen?', sub: 'Praktisch bei vielen Kategorien.', body: c.html, buttons: '', focus: c.focus };
  },
  _r_netflix: function() {
    var c = this._choice([
      { val: true, label: 'Netflix-Ansicht', sub: 'Große Bilder in Reihen', img: 'images/preview_netflix_on.jpg' },
      { val: false, label: 'Klassisch', sub: 'Raster mit Kategorien links', img: 'images/preview_netflix_off.jpg' }
    ], 2);
    return { title: 'Wie sollen Filme und Serien aussehen?', sub: '', body: c.html, buttons: '', focus: c.focus };
  },

  _r_summary: function() {
    var self = this, rows = [], yn = function(v, yes, no){ return v === false ? no : yes; };
    var add = function(step, label, val){ if(self._applies(step)) rows.push([step, label, val]); };
    add('mods', 'Inhalte', ['live', 'vod', 'series'].filter(function(t){ return self.mods[t]; }).map(function(t){ return self.TYPE_LABEL[t]; }).join(', '));
    add('countries', 'Länder', this._countries().filter(function(c){ return self.sel[c.code]; }).map(function(c){ return c.label; }).join(', '));
    add('adult', 'Erwachsenen-Inhalte', yn(this.answers.adult, 'ausblenden', 'anzeigen'));
    var keys = Object.keys(this.cats);
    if(keys.length) rows.push(['catlist', 'Kategorien', _wizNum(keys.filter(function(k){ return self.visible[k]; }).length) + ' von ' + _wizNum(keys.length) + ' sichtbar']);
    add('prefix', 'Länderkürzel entfernen', yn(this.answers.prefix, 'Ja', 'Nein'));
    add('quality', 'Qualitätsangaben entfernen', yn(this.answers.quality, 'Ja', 'Nein'));
    add('dups', 'Duplikate zusammenfassen', yn(this.answers.dups, 'Ja', 'Nein'));
    add('premium', 'Zusätze entfernen', yn(this.answers.premium, 'Ja', 'Nein'));
    add('placeholders', 'Platzhalter ausblenden', yn(this.answers.placeholders, 'Ja', 'Nein'));
    add('empty', 'Leere Kategorien ausblenden', yn(this.answers.empty, 'Ja', 'Nein'));
    add('list', 'Senderliste', { tiles: 'Kacheln', compact: 'Kompakt', normal: 'Normal' }[this.answers.list] || '');
    add('split', 'Kategorien neben den Sendern', yn(this.answers.split, 'Ja', 'Nein'));
    add('netflix', 'Filme & Serien', yn(this.answers.netflix, 'Netflix-Ansicht', 'Klassisch'));
    var html = '<div class="wq-sum">';
    rows.forEach(function(r){
      html += '<div class="wq-sum-row" data-focusable onclick="WizQ.edit(\'' + r[0] + '\')"><span class="wq-sum-label">' + esc(r[1]) + '</span>' +
              '<span class="wq-sum-val">' + esc(r[2]) + '</span><span class="wq-sum-edit">ändern</span></div>';
    });
    return { title: 'Fast fertig!', sub: 'Prüfe deine Auswahl. Alles lässt sich später im Playlist-Editor ändern.',
             body: html + '</div>', buttons: '<button class="wiz-btn" id="wq-finish" data-focusable onclick="WizQ.finish()">' +
             (this.firstRun ? 'Einrichtung abschließen' : 'Übernehmen') + '</button>', focus: '#wq-finish' };
  },

  // ── Abschluss ────────────────────────────────────────────────
  finish: function() {
    var self = this, d = this._det(), a = this.answers;
    var sameRule = function(it){ return function(r){ return _wizSameRule(it, r); }; };
    var setRule = function(it, on){
      if(!it) return;
      peDraftRules = peDraftRules.filter(function(r){ return !sameRule(it)(r); });
      if(on) peDraftRules.push(Object.assign({ id: Date.now() + Math.random() }, it.rule));
    };
    if(this._applies('prefix')) d.prefix.forEach(function(it){ setRule(it, a.prefix !== false); });
    if(this._applies('quality')) setRule(d.quality, a.quality !== false);
    if(this._applies('premium')) setRule(d.premium, a.premium !== false);
    if(this._applies('placeholders')) setRule(d.placeholders, a.placeholders !== false);
    if(this._applies('dups')) Settings.groupVariants = a.dups !== false;

    // Ausgeblendete Kategorien je Typ (nicht geladene Typen bleiben unverändert)
    var hideEmpty = this._applies('empty') && a.empty !== false ? d.empty : [];
    ['live', 'vod', 'series'].forEach(function(t){
      if(!self.data[t]) return;
      peDraftVisCats[t] = Object.keys(self.cats).filter(function(k){
        return self.cats[k].type === t && (!self.visible[k] || hideEmpty.indexOf(k) !== -1);
      }).map(function(k){ return self.cats[k].id; });
    });
    Settings.showVod = this.mods.vod;
    Settings.showSeries = this.mods.series;
    Settings.playlistRules = peDraftRules;
    Settings.hiddenCats = peDraftVisCats;
    // Aussehen
    if(this.answers.list) {
      Settings.tileList = this.answers.list === 'tiles';
      Settings.compactList = this.answers.list === 'compact';
    }
    if(this._applies('split') && 'split' in this.answers) Settings.splitList = !!this.answers.split;
    if(this._applies('netflix') && 'netflix' in this.answers) Settings.useNetflixStyle = !!this.answers.netflix;
    Settings.save();
    Settings._apply();

    if(this.firstRun) {
      S.wizardMode = false;
      S.fromWizard = true;
      S.fullStreams = { live: null, vod: null, series: null };
      launchLiveTv();
      setTimeout(function(){ showToast('Einrichtung abgeschlossen! Änderungen jederzeit unter Einstellungen → Playlist-Editor.', 5000); }, 1000);
    } else {
      this._exitToEditor();
    }
  },
  _exitToEditor: function() {
    // Aus den Einstellungen gestartet - dorthin zurück, nie auf den Hauptbildschirm
    S.screen = 'settings';
    renderPERules();
    $('pe-modal').classList.remove('hidden');
    setTimeout(function(){ SpatialNav.focusBySelector('#pe-btn-wizard'); }, 50);
  }
};

// Direkteingabe: Enter bzw. "Los" auf der Handy-Tastatur = Verbinden
document.addEventListener('keydown', function(e){
  if(e.keyCode !== 13 || !e.target || e.target.tagName !== 'INPUT' || !e.target.closest('#wiz-step-direct')) return;
  e.preventDefault();
  Wizard.connectDirect();
});
