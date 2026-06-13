// ── ZENTRALER ABBAU DER EINSTELLUNGEN ─────────────────────────────
function _teardownSettings() {
  if (S.settingsOpen) {
      S.settingsOpen = false;
      S.settingsCatOpen = null;
  }
}

// ── SETTINGS ─────────────────────────────────────────────────────
function openSettings(){
  if(S.screen === 'settings') return; // Sicherstellen, dass es nicht doppelt öffnet
  
  S.prevScreenForSettings = S.screen;
  if(typeof NF !== 'undefined' && NF.stopTrailer) NF.stopTrailer(); // Trailer stoppen, statt das Grid komplett abzubauen
  
  S.settingsOpen=true;
  S.settingsCatOpen=null;
  S.screen = 'settings';

  if(typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
  if(typeof updateNavTabsActive === 'function') updateNavTabsActive('settings');
  // Fokus nur aus der Topbar nehmen, wenn wir NICHT oben in den Tabs navigieren
  if(!S._navTabHold){
    S.focusArea = 'settings';
    if(typeof _navTabClearFocus === 'function') _navTabClearFocus();
  }

  renderSettingsProfiles();
  var macEl = $('sp-mac-address');
  if(macEl) macEl.textContent = Device.getMac();
  if(!S._navTabHold){
    setTimeout(function(){ SpatialNav.focusBySelector('.ios-row') || SpatialNav.focusFirst(); }, 150);
  }
}
function closeSettings(){
  if (S.settingsCatOpen) {
      S.settingsCatOpen = null;
      S.focusArea = 'settings';
      setTimeout(function(){ SpatialNav.focusBySelector('.ios-row') || SpatialNav.focusFirst(); }, 50);
  } else {
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
}
function openSettingsCategory(cat) {
  S.settingsCatOpen = cat;
  setPreview(); // Reset beim Kategorie-Wechsel
  setTimeout(function(){ SpatialNav.focusBySelector('#set-cat-'+cat+' [data-focusable]'); }, 50);
}

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