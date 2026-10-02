// ── ZENTRALER ABBAU DER EINSTELLUNGEN ─────────────────────────────
function _teardownSettings() {
  if (S.settingsOpen) {
      S.settingsOpen = false;
      S.settingsCatOpen = null;
  }
}

// ── SETTINGS ─────────────────────────────────────────────────────
// Aufbau: links die Bereichsleiste (.st-nav), rechts der Inhalt des gewählten
// Bereichs (#set-cat-*). Am TV wechselt der Inhalt schon beim Fokussieren eines
// Bereichs; OK bzw. Rechts geht in den Inhalt, Links/BACK zurück in die Leiste.
function openSettings(){
  if(S.screen === 'settings') return; // Sicherstellen, dass es nicht doppelt öffnet

  S.prevScreenForSettings = S.screen;
  if(typeof NF !== 'undefined' && NF.stopTrailer) NF.stopTrailer(); // Trailer stoppen, statt das Grid komplett abzubauen

  S.settingsOpen=true;
  S.screen = 'settings';
  S.settingsCatOpen = S.settingsCatOpen || 'ansicht';
  _showSettingsCat(S.settingsCatOpen);

  if(typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
  if(typeof updateNavTabsActive === 'function') updateNavTabsActive('settings');
  // Fokus nur aus der Topbar nehmen, wenn wir NICHT oben in den Tabs navigieren
  if(!S._navTabHold){
    S.focusArea = 'settings';
    if(typeof _navTabClearFocus === 'function') _navTabClearFocus();
  }

  renderSettingsProfiles();
  renderSettingsExtras();
  if(!S._navTabHold){
    setTimeout(function(){ SpatialNav.focusBySelector('#st-nav-' + S.settingsCatOpen) || SpatialNav.focusFirst(); }, 150);
  }
}
// BACK: aus dem Inhalt zurück in die Bereichsleiste, aus der Leiste raus
function closeSettings(){
  var foc = SpatialNav.focused;
  if (foc && foc.closest && foc.closest('#st-content')) {
      S.focusArea = 'settings';
      SpatialNav.focusBySelector('#st-nav-' + (S.settingsCatOpen || 'ansicht'));
      return;
  }
  if (S.playerVisible && S.playerType === 'live') {
      _teardownSettings();
      S.screen = 'live';

      // Sicherstellen, dass der Player wieder im Vordergrund ist
      var ps = document.getElementById('player-screen');
      if (ps) ps.classList.remove('hidden');
      var ms = document.getElementById('main-screen');
      if (ms) ms.classList.add('hidden');
      var cs = document.getElementById('continue-screen');
      if (cs) cs.classList.add('hidden');

      S.focusArea = 'player';
      if(typeof Player !== 'undefined') Player.showControls();
      if(typeof clearFocus === 'function') clearFocus();
  } else {
      // Normal zurück zum Menü, ohne Settings zu schließen
      if (Settings.useSidebar) { if(typeof openSysSidebar === 'function') openSysSidebar(); }
      else { if(typeof navTabsEnter === 'function') navTabsEnter(); }
  }
}
// Bereich anzeigen (ohne den Fokus zu verschieben)
function _showSettingsCat(cat) {
  if(S.settingsCatOpen !== cat) S.settingsCatOpen = cat;
  document.querySelectorAll('#settings-screen .set-cat-group').forEach(function(el){ el.classList.toggle('hidden', el.id !== 'set-cat-' + cat); });
  document.querySelectorAll('#st-rail .st-nav').forEach(function(el){ el.classList.toggle('active', el.getAttribute('data-cat') === cat); });
  var content = $('st-content');
  if(content) content.scrollTop = 0;
  if(cat === 'system' || cat === 'about') renderSettingsExtras();
}
// Bereich öffnen und in den Inhalt springen (OK/Rechts am TV, Antippen)
function openSettingsCategory(cat) {
  _showSettingsCat(cat);
  setTimeout(function(){ SpatialNav.focusBySelector('#set-cat-' + cat + ' [data-focusable]'); }, 50);
}
function settingsNavClick(cat) {
  // Am Handy bleibt man in der Leiste (Inhalt steht ja daneben), am TV geht OK in den Inhalt
  if(document.documentElement.classList.contains('xc-phone')) { _showSettingsCat(cat); SpatialNav.focus($('st-nav-' + cat)); return; }
  openSettingsCategory(cat);
}
// Fokus auf einem Bereich der Leiste zeigt dessen Inhalt
document.addEventListener('xcfocus', function(e){
  var nav = e.target && e.target.closest && e.target.closest('.st-nav');
  if(nav) _showSettingsCat(nav.getAttribute('data-cat'));
}, true);

// ── Auswahl-Karten statt sich ausschließender Schalter ───────────
function _settingsChoiceValue(group) {
  if(group === 'theme') return Settings.lightTheme ? 'light' : 'dark';
  if(group === 'nav') return Settings.useSidebar ? 'sidebar' : 'tabs';
  if(group === 'list') return Settings.tileList ? 'tiles' : (Settings.compactList ? 'compact' : 'normal');
  if(group === 'osd') return Settings.compactOsd ? 'compact' : 'normal';
  if(group === 'media') return Settings.useNetflixStyle !== false ? 'netflix' : 'classic';
  return null;
}
function setChoice(group, val) {
  // Über toggleSetting, damit alle Nebenwirkungen (Listen, Navigation ...) greifen
  if(group === 'list') {
    if(val === 'tiles' && !Settings.tileList) toggleSetting('tileList');
    else if(val === 'compact' && !Settings.compactList) toggleSetting('compactList');
    else if(val === 'normal') { if(Settings.tileList) toggleSetting('tileList'); if(Settings.compactList) toggleSetting('compactList'); }
  } else if(group === 'theme') { if(Settings.lightTheme !== (val === 'light')) toggleSetting('lightTheme'); }
  else if(group === 'nav') { if(Settings.useSidebar !== (val === 'sidebar')) toggleSetting('useSidebar'); }
  else if(group === 'osd') { if(!!Settings.compactOsd !== (val === 'compact')) toggleSetting('compactOsd'); }
  else if(group === 'media') { if((Settings.useNetflixStyle !== false) !== (val === 'netflix')) toggleSetting('useNetflixStyle'); }
  renderSettingsChoices();
}
// Markierung der Karten, passende Unteroptionen, Vorschaubilder der Zeilen
function renderSettingsChoices() {
  var scr = $('settings-screen');
  if(!scr) return;
  scr.querySelectorAll('.st-choice').forEach(function(el){
    el.classList.toggle('selected', _settingsChoiceValue(el.getAttribute('data-group')) === el.getAttribute('data-val'));
  });
  var list = _settingsChoiceValue('list');
  scr.classList.toggle('st-list-tiles', list === 'tiles');
  scr.classList.toggle('st-list-compact', list === 'compact');
  scr.classList.toggle('st-list-normal', list === 'normal');
  scr.classList.toggle('st-osd-compact', !!Settings.compactOsd);
  scr.querySelectorAll('img.st-thumb').forEach(function(img){
    var src = settingsPreviewImage(img.getAttribute('data-thumb'));
    if(src && img.getAttribute('src') !== src) img.setAttribute('src', src);
    img.style.display = src ? '' : 'none';
  });
}
// Vorschaubild passend zum aktuellen Zustand einer Einstellung
function settingsPreviewImage(key) {
  var on = { kompakt_epg: Settings.compactListEpg, split: Settings.splitList, ch_numbers: Settings.showChNumbers,
             ch_logos: Settings.showChLogos, osd_hints: Settings.compactOsdHints }[key];
  if(key === 'varianten') return 'images/preview_varianten.jpg';
  if(on === undefined) return '';
  return 'images/preview_' + key + (on ? '_on' : '_off') + '.jpg';
}

// ── Konto, Gerät, Über ───────────────────────────────────────────
// Kontodaten vom Anbieter (gemerkt beim letzten Login, siehe saveAccountInfo)
function _accountInfo(pid) {
  try { return JSON.parse(localStorage.getItem('xcp_acct_' + pid) || 'null'); } catch(e) { return null; }
}
function saveAccountInfo(pid, u) {
  if(!pid || !u) return;
  try {
    localStorage.setItem('xcp_acct_' + pid, JSON.stringify({ exp: parseInt(u.exp_date, 10) || 0, max: parseInt(u.max_connections, 10) || 0,
      act: parseInt(u.active_cons, 10) || 0, status: u.status || '', trial: u.is_trial === '1' || u.is_trial === 1, ts: Date.now() }));
  } catch(e) {}
}
function _fmtDate(ms) {
  var d = new Date(ms), p = function(n){ return (n < 10 ? '0' : '') + n; };
  return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
}
function renderSettingsExtras() {
  var p = Profiles.getActive(), a = p ? _accountInfo(p.id) : null;
  var host = p ? (p.type === 'm3u' ? 'M3U-Playlist' : (p.host || '').replace(/^https?:\/\//, '').split(':')[0]) : '';
  var lines = [];
  if(p && p.type === 'm3u') lines.push('M3U-Playlist – keine Kontodaten verfügbar');
  else if(a) {
    var expMs = a.exp * 1000, days = a.exp ? Math.ceil((expMs - Date.now()) / 86400000) : null;
    lines.push(a.exp ? 'Gültig bis ' + _fmtDate(expMs) + (days !== null && days >= 0 && days <= 30 ? ' (noch ' + days + (days === 1 ? ' Tag)' : ' Tage)') : '') : 'Unbegrenzt gültig');
    if(a.max) lines.push(a.max + (a.max === 1 ? ' Verbindung' : ' Verbindungen'));
    if(a.trial) lines.push('Testzugang');
  } else if(p) lines.push('Kontodaten werden beim nächsten Start geladen');
  var initials = p ? Profiles.initials(p.name) : '?';
  var card = $('st-acct-card');
  if(card) card.innerHTML = p
    ? '<div class="st-acct"><div class="st-avatar">' + esc(initials) + '</div><div class="st-acct-txt"><div class="st-acct-name">' + esc(p.name) + '</div>' +
      '<div class="st-acct-host">' + esc(host) + '</div><div class="st-acct-meta">' + esc(lines.join(' · ')) + '</div></div></div>'
    : '<div class="st-acct-meta">Kein Profil aktiv</div>';
  var rail = $('st-rail-acct');
  if(rail) rail.innerHTML = p ? '<div class="st-avatar st-avatar-sm">' + esc(initials) + '</div><div class="st-rail-acct-txt"><div>' + esc(p.name) + '</div>' +
    '<div class="st-rail-acct-meta">' + esc(lines[0] || host) + '</div></div>' : '';
  var macEl = $('sp-mac-address');
  if(macEl) macEl.textContent = Device.getMac();
  var v = $('st-version');
  if(v) v.textContent = (typeof APP_VERSION !== 'undefined' ? APP_VERSION : '') + ' Beta';
  var pl = $('st-platform');
  if(pl) pl.textContent = window.PalmSystem || (window.webOS && webOS.platform) ? 'LG webOS' : window.tizen ? 'Samsung Tizen' :
    (window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.xcp) ? 'iPhone / iPad' :
    typeof AndroidBridge !== 'undefined' ? (document.documentElement.classList.contains('xc-phone') ? 'Android Smartphone' : 'Android / Android TV') : 'Browser';
  // Bedienung: dieselbe Übersicht wie in der Einrichtung (am Handy die Touch-Fassung)
  var help = $('st-help'), tut = document.querySelector('#wiz-step-2 .wiz-tut-grid');
  if(help && tut && !help.firstChild) help.innerHTML = tut.outerHTML;
}

// Alte rechte Vorschau-Spalte (entfallen) - bleibt als No-Op für den Fokus-Aufruf
function setPreview(key) {
  var box = document.getElementById('set-preview-box');
  if(!box) return;

  var isDynamic = false;
  var isActive = false;
  var baseKey = key;

  // Prüft den echten Einstellungs-Zustand für dynamische Previews
  if(key === 'kompakt_liste') { isDynamic = true; isActive = Settings.compactList; baseKey = isActive ? 'kompakt_liste_on' : 'kompakt_liste_off';
  } else if(key === 'split') { isDynamic = true; isActive = Settings.splitList; baseKey = isActive ? 'split_on' : 'split_off';
  } else if(key === 'kompakt_osd') { isDynamic = true; isActive = Settings.compactOsd; baseKey = isActive ? 'kompakt_osd_on' : 'kompakt_osd_off';
  } else if(key === 'ch_numbers') { isDynamic = true; isActive = Settings.showChNumbers; baseKey = isActive ? 'ch_numbers_on' : 'ch_numbers_off';
  } else if(key === 'ch_logos') { isDynamic = true; isActive = Settings.showChLogos; baseKey = isActive ? 'ch_logos_on' : 'ch_logos_off';
  } else if(key === 'kompakt_epg') { isDynamic = true; isActive = Settings.compactListEpg; baseKey = isActive ? 'kompakt_epg_on' : 'kompakt_epg_off';
  } else if(key === 'osd_hints') { isDynamic = true; isActive = Settings.compactOsdHints; baseKey = isActive ? 'osd_hints_on' : 'osd_hints_off';
  } else if(key === 'epg_grid') { isDynamic = true; isActive = Settings.extendedEpg; baseKey = isActive ? 'epg_grid_on' : 'epg_grid_off';
  } else if(key === 'netflix') { isDynamic = true; isActive = Settings.useNetflixStyle; baseKey = isActive ? 'netflix_on' : 'netflix_off';
  } else if(key === 'sidebar') { isDynamic = true; isActive = Settings.useSidebar; baseKey = isActive ? 'sidebar_on' : 'sidebar_off'; }

  var base64Images = {
    'hell': '',
    'netflix_on': 'images/preview_netflix_on.jpg',        // Netflix-Ansicht
    'netflix_off': 'images/preview_netflix_off.jpg',       // Netflix-Ansicht (AUS)
    'sidebar_on': 'images/preview_sidebar_on.jpg',        // Seitenleiste
    'sidebar_off': 'images/preview_sidebar_off.jpg',       // Seitenleiste (AUS)
    'kompakt_liste_on': 'images/preview_kompakt_liste_on.jpg',  // Kompakte Liste (AN)
    'kompakt_liste_off': 'images/preview_kompakt_liste_off.jpg', // Normale Liste (AUS)
    'split_on': 'images/preview_split_on.jpg',          // Zweispaltig (AN)
    'split_off': 'images/preview_split_off.jpg',         // Einspaltig (AUS)
    'kompakt_epg_on': 'images/preview_kompakt_epg_on.jpg',    // EPG in Liste
    'kompakt_epg_off': 'images/preview_kompakt_epg_off.jpg',  // Kompakte Liste (AN)
    'kompakt_osd_on': 'images/preview_kompakt_osd_on.jpg',    // Schmales OSD (AN)
    'kompakt_osd_off': 'images/preview_kompakt_osd_off.jpg',
    'osd_hints_on': 'images/preview_osd_hints_on.jpg',
    'osd_hints_off': 'images/preview_osd_hints_off.jpg',
    'epg_grid_on': '',       // TV-Zeitung (AN)
    'epg_grid_off': '',      // TV-Zeitung (AUS)
    'varianten': 'images/preview_varianten.jpg',      // Varianten bündeln
    'ch_numbers_on': 'images/preview_ch_numbers_on.jpg',  // Kanalnummern zeigen
    'ch_numbers_off': 'images/preview_ch_numbers_off.jpg', // Keine Kanalnummern
    'ch_logos_on': 'images/preview_ch_logos_on.jpg',    // Logos zeigen
    'ch_logos_off': 'images/preview_ch_logos_off.jpg'    // Keine Logos
  };


  var src = (baseKey && base64Images[baseKey]) ? base64Images[baseKey] : '';
  var overlayHtml = '';
  if (isDynamic) {
    var statusColor = isActive ? 'var(--green)' : 'var(--mid)';
    var statusText = isActive ? 'Aktiv' : 'Deaktiviert';
    overlayHtml = '<div style="position:absolute;top:16px;right:16px;background:rgba(0,0,0,0.75);backdrop-filter:blur(10px);padding:8px 16px;border-radius:20px;font-size:16px;font-weight:600;color:white;display:flex;align-items:center;gap:10px;border:1px solid rgba(255,255,255,0.1);z-index:10;"><div style="width:10px;height:10px;border-radius:50%;background:'+statusColor+';box-shadow:0 0 10px '+statusColor+';"></div>' + statusText + '</div>';
  }
  if (src) { box.innerHTML = '<img src="' + src + '" style="max-width:100%;max-height:100%;object-fit:contain;border-radius:20px;display:block;">' + overlayHtml;
  } else {
    var labels = { 'hell':'Helles Design', 'netflix_on':'Netflix-Ansicht', 'netflix_off':'Ohne Netflix-Ansicht', 'sidebar_on':'Seitenleiste', 'sidebar_off':'Ohne Seitenleiste', 'kompakt_liste_on':'Kompakte Liste', 'kompakt_liste_off':'Normale Liste', 'split_on':'Zweispaltige Liste', 'split_off':'Einspaltige Liste', 'kompakt_epg_on':'Mit EPG in Liste', 'kompakt_epg_off':'Ohne EPG in Liste', 'kompakt_osd_on':'Kompaktes OSD', 'kompakt_osd_off':'Großes OSD', 'osd_hints_on':'Mit Tasten-Hilfen', 'osd_hints_off':'Ohne Tasten-Hilfen', 'epg_grid_on':'Mit TV-Zeitung', 'epg_grid_off':'Ohne TV-Zeitung', 'varianten':'Duplikate bündeln', 'ch_numbers_on':'Mit Kanalnummern', 'ch_numbers_off':'Ohne Kanalnummern', 'ch_logos_on':'Mit Senderlogos', 'ch_logos_off':'Ohne Senderlogos' };
    var text = (baseKey && labels[baseKey]) ? labels[baseKey] + '<br><span style="font-size:16px;opacity:0.5">(Screenshot fehlt)</span>' : 'Vorschau';
    box.innerHTML = '<div style="width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;background:var(--bg);color:var(--lo);font-size:24px;font-weight:600;border-radius:20px;text-align:center;position:relative;">' + text + overlayHtml + '</div>';
  }
}

function renderSettingsProfiles(){
  var list=$('sp-profile-list'),html='';
  for(var i=0;i<Profiles.list.length;i++){ var p=Profiles.list[i], isAct=p.id===Profiles.activeId; var init=Profiles.initials(p.name); var host=p.type==='m3u'?'M3U':(p.host||'').replace(/^https?:\/\//,'').split(':')[0]; var rowAction = isAct ? '' : 'onclick="switchToProfile(\''+p.id+'\')"'; html+='<div class="ios-row" data-focusable onmouseover="setFocus(this)" '+rowAction+'><div class="ios-icon" style="background:linear-gradient(135deg,var(--accent),var(--accent2));color:white;border-radius:50%;font-size:16px;width:36px;height:36px;">'+esc(init)+'</div><div class="ios-label" style="display:flex;flex-direction:column;justify-content:center;"><span style="font-weight:600;'+(isAct?'color:var(--accent)':'')+'">'+esc(p.name)+(isAct?' (Aktiv)':'')+'</span><span style="font-size:var(--fs-xs);color:var(--mid);font-weight:400;margin-top:2px;">'+esc(host)+'</span></div><div style="display:flex;gap:8px;"><button class="sp-btn sp-btn-edit" data-focusable onclick="event.stopPropagation();openProfileModal(\''+p.id+'\')">&#x270E;</button><button class="sp-btn sp-btn-del" data-focusable onclick="event.stopPropagation();confirmDeleteProfile(\''+p.id+'\')">&#x2715;</button></div></div>'; }
  list.innerHTML=html;
}
async function switchToProfile(id){ closeSettings(); await activateProfile(id); }