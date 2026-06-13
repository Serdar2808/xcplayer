// ── PROFIL INITIALISIERUNG & CLOUD-SYNC ─────────────────────────

function renderProfileScreen(){
  if(typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
  var grid=$('profile-grid'), html='';
  for(var i=0;i<Profiles.list.length;i++){
    var p=Profiles.list[i], init=Profiles.initials(p.name);
    var host=p.type==='m3u'?'M3U':(p.host||'').replace(/^https?:\/\//,'').split(':')[0];
    html+='<div class="profile-card" data-focusable data-pid="'+p.id+'" data-pidx="'+i+'">'
      +'<span class="profile-del" data-delid="'+p.id+'">&#x2715;</span>'
      +'<div class="profile-avatar">'+esc(init)+'</div>'
      +'<div class="profile-name">'+esc(p.name)+'</div>'
      +'<div class="profile-host">'+esc(host)+'</div></div>';
  }
  html+='<div class="add-profile-btn" id="cloud-sync-btn" data-focusable><span class="plus" style="font-size:36px">&#x21BB;</span><span>Cloud Sync</span></div>';
  html+='<div class="add-profile-btn" id="add-profile-btn" data-focusable><span class="plus" style="font-size:36px">+</span><span>Lokal Hinzufügen</span></div>';
  grid.innerHTML=html;
  grid.querySelectorAll('.profile-card').forEach(function(card){
    card.addEventListener('click',function(e){
      var del=e.target.closest('[data-delid]');
      if(del){ e.stopPropagation(); confirmDeleteProfile(del.getAttribute('data-delid')); return; }
      activateProfile(card.getAttribute('data-pid'));
    });
    card.addEventListener('mouseover',function(){
      setFocus(card,'focused');
      S.cursors.profile=parseInt(card.getAttribute('data-pidx')||0);
    });
  });
  var cloudBtn=$('cloud-sync-btn');
  cloudBtn.addEventListener('click',function(){ syncCloudProfile(); });
  cloudBtn.addEventListener('mouseover',function(){
    setFocus(cloudBtn,'focused');
    S.cursors.profile=Profiles.list.length;
  });
  var addBtn=$('add-profile-btn');
  addBtn.addEventListener('click',function(){ openProfileModal(null); });
  addBtn.addEventListener('mouseover',function(){
    setFocus(addBtn,'focused');
    S.cursors.profile=Profiles.list.length+1;
  });
  var macEl = $('tv-mac-address');
  if(macEl) macEl.textContent = Device.getMac();
  updateFocus();
}

async function syncCloudProfile() {
  showFullLoader('Prüfe Cloud...', 'Suche Playlist auf dem Server');
  try {
    var mac = Device.getMac();
    var url = CONFIG.API.PROFILE_URL + '?mac=' + encodeURIComponent(mac); 

    var r = await fetch(url, {cache: 'no-store'});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    var data = await r.json();
    
    // Flexibel für einzelnes Objekt oder Array von Objekten
    var profilesData = Array.isArray(data) ? data : [data];
    var addedCount = 0;
    
    for (var i = 0; i < profilesData.length; i++) {
      var item = profilesData[i];
      var prof = null;
      if(item && item.host && item.user && item.pass) {
          prof = { name: item.name || 'Cloud XC', type: 'xc', host: item.host, user: item.user, pass: item.pass };
      } else if(item && item.m3uUrl) {
          prof = { name: item.name || 'Cloud M3U', type: 'm3u', m3uUrl: item.m3uUrl };
      }
      
      if (prof) {
          var existing = Profiles.list.find(function(p) { return (p.type==='xc' && p.host===prof.host && p.user===prof.user) || (p.type==='m3u' && p.m3uUrl===prof.m3uUrl); });
          if(existing) { prof.id = existing.id; Profiles.update(existing.id, prof); } 
          else { Profiles.add(prof); }
          addedCount++;
      }
    }
    
    if (addedCount > 0) {
        renderProfileScreen(); renderSettingsProfiles();
        hideFullLoader();
        showToast(addedCount + ' Playlist(s) erfolgreich synchronisiert!', 3000);
    } else { hideFullLoader(); showToast('Keine gültige Playlist für diese MAC gefunden.', 4000); }
  } catch(e) { hideFullLoader(); showToast('Fehler bei Cloud-Synchronisation', 4000); Logger.warn('[CloudSync] Error:', e.message); }
}

async function activateProfile(id){
  var p=Profiles.get(id); if(!p) return;

  // 1. HARTER UI- UND CACHE-RESET BEIM PROFILWECHSEL
  if(S.playerVisible) {
    Player.destroy();
    S.playerVisible = false;
  }
  S.epgOpen = false; S.chListOpen = false; S.seriesDetailOpen = false;
  
  S.categories = []; S.streams = []; S.filteredStreams = []; S.currentStream = null;
  S.rawCategories = { live: null, vod: null, series: null };
  S.rawStreams = { live: null, vod: null, series: null };
  S.fullStreams = { live: null, vod: null, series: null };
  S.seriesInfoCache = {};
  S.epgCache = {};
  
  EpgData.loaded = false;
  EpgData.channels = {};
  EpgData.programmes = {};
  EpgData._nowMap = {};
  EpgData._nextMap = {};
  EpgData._nameMap = null;

  // 2. PROFIL SETZEN BEVOR DATEN GELADEN WERDEN
  API.setProfile(p);
  Profiles.setActive(id); 
  Settings.loadProfile(id);
  loadFavs(); loadResume(); loadResumeSeries();

  // ── M3U Profile ───────────────────────────────────────────────
  if(p.type==='m3u'){
    S.isM3U=true;
    var dbKey = 'm3u_' + p.id;
    var cached = await PlaylistDB.get(dbKey);
    if(cached){
      S.m3uStreams=cached.streams;
      S.m3uCategories=cached.categories;
      S.rawCategories = { live: S.m3uCategories, vod: [], series: [] };
      S.rawStreams = { live: S.m3uStreams, vod: [], series: [] };
      launchLiveTv();
      return;
    }
    showFullLoader('M3U wird geladen...', 'Verbinde mit Server');
    try{
      var r=await fetchWithRetry(p.m3uUrl,30000,1);
      var text=await r.text();
      var parsed=parseM3U(text);
      S.m3uStreams=parsed.streams;
      S.m3uCategories=parsed.categories;
      PlaylistDB.set(dbKey, {streams: parsed.streams, categories: parsed.categories});
      S.rawCategories = { live: S.m3uCategories, vod: [], series: [] };
      S.rawStreams = { live: S.m3uStreams, vod: [], series: [] };
      hideFullLoader();
      if (S.wizardMode) return;
      launchLiveTv();
    }catch(e){
      hideFullLoader();
      showToast('M3U Fehler: '+(e.message||'Laden fehlgeschlagen'),3500);
      S.screen='profile'; S.focusArea='profile_grid'; renderProfileScreen();
    }
    return;
  }

  // ── XC Profile ────────────────────────────────────────────────
  S.isM3U=false; S.m3uStreams=[]; S.m3uCategories=[];
  
  // SCHUTZ VOR IP-BANN: Maximal 1 Login-Check pro Minute bei schnellen Neustarts
  showFullLoader('Verbinde...', 'Überprüfe Zugangsdaten und lade Profil');
  try {
    var now = Date.now();
    var lastAuth = parseInt(localStorage.getItem('xcp_last_auth_' + p.id) || '0');
    if (now - lastAuth > 60000) { // 60 Sekunden Cooldown
      var d = await API.auth();
      if(d && d.user_info && d.user_info.auth === 0) showToast('Achtung: XC Zugang abgelaufen oder ungültig!', 5000);
      try { localStorage.setItem('xcp_last_auth_' + p.id, now.toString()); } catch(e){ /* localStorage voll */ }
    }
  } catch(e) { Logger.warn('[Auth] Check failed:', e.message); }
  
  hideFullLoader();
  if (S.wizardMode) { return; }
  launchLiveTv();
}