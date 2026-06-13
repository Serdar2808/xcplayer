// ── BENUTZERDEFINIERTER BESTÄTIGUNGSDIALOG ────────────────────────
var _confirmCallback = null;
function showConfirm(title, msg, yesLabel, callback) {
  $('confirm-title').textContent = title;
  $('confirm-msg').textContent = msg;
  $('confirm-yes').textContent = yesLabel || 'Löschen';
  _confirmCallback = callback;
  $('confirm-modal').classList.remove('hidden');
  FocusTrap.trap('confirm-modal');
  setTimeout(function(){ SpatialNav.focusBySelector('#confirm-no'); }, 50);
}
function closeConfirm(result) {
  $('confirm-modal').classList.add('hidden');
  FocusTrap.release('confirm-modal');
  var cb = _confirmCallback;
  _confirmCallback = null;
  if(cb) cb(result);
}
$('confirm-yes').addEventListener('click', function(){ closeConfirm(true); });
$('confirm-no').addEventListener('click', function(){ closeConfirm(false); });

function confirmDeleteProfile(id){
  var p=Profiles.get(id);
  if(!p) return;
  var wasActive = (id === Profiles.activeId); // Prüfen, ob das aktuell aktive Profil gelöscht wird

  showConfirm('Profil löschen', 'Profil "'+p.name+'" wirklich löschen?', 'Löschen', function(yes){
    if(yes){
      Profiles.remove(id);
      
      // Verwaiste LocalStorage-Datenketten des gelöschten Profils aufräumen
      localStorage.removeItem('xcp_favs_' + id);
      localStorage.removeItem('xcp_resume_' + id);
      localStorage.removeItem('xcp_resume_series_' + id);
      localStorage.removeItem('xcp_last_live_' + id);
      localStorage.removeItem('xcp_first_live_' + id);
      localStorage.removeItem('xcp_last_auth_' + id);
      localStorage.removeItem('xcp_profile_settings_' + id);
      
      // Verwaiste große Datensätze (Playlists & EPG) restlos aus der IndexedDB löschen
      if(typeof PlaylistDB !== 'undefined' && PlaylistDB.db) {
        var tx = PlaylistDB.db.transaction(['data'], 'readwrite');
        var req = tx.objectStore('data').openCursor();
        req.onsuccess = function(e) {
          var cursor = e.target.result;
          if(cursor) { if(cursor.key.indexOf(id) !== -1) cursor.delete(); cursor.continue(); }
        };
      }
      
      if(typeof EPGStore !== 'undefined' && EPGStore.db) {
        ['xmltv', 'epg'].forEach(function(storeName) {
          if(EPGStore.db.objectStoreNames.contains(storeName)) {
            var txEpg = EPGStore.db.transaction([storeName], 'readwrite');
            var reqEpg = txEpg.objectStore(storeName).openCursor();
            reqEpg.onsuccess = function(e) {
              var cursor = e.target.result;
              if(cursor) { if(cursor.key.indexOf(id) !== -1) cursor.delete(); cursor.continue(); }
            };
          }
        });
      }
      
      // HARD-RESET: Wenn das aktive Profil oder das letzte verbleibende Profil gelöscht wurde
      if(wasActive || Profiles.list.length === 0) {
        S.categories = []; S.streams = []; S.filteredStreams = []; S.currentStream = null;
        S.rawCategories = { live: null, vod: null, series: null };
        S.rawStreams = { live: null, vod: null, series: null };
        S.fullStreams = { live: null, vod: null, series: null };
        S.seriesInfoCache = {};
        S.epgCache = {};
        if(typeof EpgData !== 'undefined') EpgData.loaded = false;
        
        if(S.playerVisible && typeof Player !== 'undefined') Player.close();
        if(S.settingsOpen && typeof closeSettings !== 'undefined') closeSettings();
        
        if(Profiles.list.length === 0) {
          if(typeof Wizard !== 'undefined') Wizard.start();
        } else {
          S.screen = 'profile';
          S.focusArea = 'profile_grid';
          renderProfileScreen(); 
        }
      } else {
        renderProfileScreen(); renderSettingsProfiles();
      }
    }
    
    // Fokus-Management nach dem Schließen des Dialogs
    if (Profiles.list.length === 0) {
      // Fokus wird vom Wizard gesteuert
    } else if(wasActive) {
      setTimeout(function(){ SpatialNav.focusBySelector('.profile-card') || SpatialNav.focusBySelector('#add-profile-btn'); }, 50);
    } else if(S.settingsOpen) {
      setTimeout(function(){ SpatialNav.focusBySelector('#settings-screen [data-focusable]'); }, 50);
    } else {
      setTimeout(function(){ SpatialNav.focusBySelector('#add-profile-btn'); }, 50);
    }
  });
}

// ── PROFIL MODAL ──────────────────────────────────────────────────
var _editProfileId=null, _profileTabMode='xc';

function openProfileModal(editId){
  _editProfileId=editId; $('pmodal-error').classList.add('hidden');
  if(editId){
    var p=Profiles.get(editId); if(!p) return;
    $('pmodal-title').textContent='Profil bearbeiten';
    $('pf-name').value=p.name||'';
    if(p.type==='m3u'){ switchPTab('m3u'); $('pf-m3u').value=p.m3uUrl||''; }
    else { switchPTab('xc'); $('pf-host').value=p.host||''; $('pf-user').value=p.user||''; $('pf-pass').value=p.pass||''; }
  } else {
    $('pmodal-title').textContent='Neues Profil';
    $('pf-name').value=''; $('pf-host').value=''; $('pf-user').value=''; $('pf-pass').value=''; $('pf-m3u').value='';
    switchPTab('xc');
  }
  $('profile-modal').classList.remove('hidden');
  FocusTrap.trap('profile-modal');
  
  // UX: Direkter Fokus in das erste Textfeld, um sofort tippen zu können
  var firstInput = $('pf-name');
  setTimeout(function(){ SpatialNav.focus(firstInput); }, 50);
}

function closeProfileModal(){ 
  $('profile-modal').classList.add('hidden'); 
  FocusTrap.release('profile-modal');
  setTimeout(function(){
    if(S.settingsOpen) SpatialNav.focusBySelector('#settings-screen [data-focusable]');
    else SpatialNav.focusBySelector('#add-profile-btn');
  }, 50);
}

function switchPTab(mode){
  _profileTabMode=mode;
  $('ptab-xc').classList.toggle('active',mode==='xc');
  $('ptab-m3u').classList.toggle('active',mode==='m3u');
  $('pf-xc-fields').classList.toggle('hidden',mode!=='xc');
  $('pf-m3u-fields').classList.toggle('hidden',mode!=='m3u');
}

$('pmodal-save').addEventListener('click',function(){
  // Schutz vor Button-Spamming (Doppelt-Erstellung bei TV-Fernbedienungen)
  if(this._isSaving) return;
  this._isSaving = true;
  var self = this;
  var unlock = function() { self._isSaving = false; };

  var name=$('pf-name').value.trim();
  if(!name){ showModalErr('Bitte Namen eingeben'); unlock(); return; }
  var prof;
  if(_profileTabMode==='m3u'){
    var m3u=$('pf-m3u').value.trim();
    if(!m3u){ showModalErr('Bitte M3U URL eingeben'); unlock(); return; }
    prof={name:name,type:'m3u',m3uUrl:m3u};
  } else {
    var host=$('pf-host').value.trim(),user=$('pf-user').value.trim(),pass=$('pf-pass').value.trim();
    if(!host||!user||!pass){ showModalErr('Bitte alle Felder ausfüllen'); unlock(); return; }
    prof={name:name,type:'xc',host:host,user:user,pass:pass};
  }
  if(_editProfileId){ prof.id=_editProfileId; Profiles.update(_editProfileId,prof); }
  else Profiles.add(prof);
  closeProfileModal(); renderProfileScreen(); renderSettingsProfiles();
  
  setTimeout(unlock, 500); // Lock nach 500ms wieder freigeben
});

// UX: Auto-Submit per Enter-Taste direkt aus den Eingabefeldern
['pf-name', 'pf-host', 'pf-user', 'pf-pass', 'pf-m3u'].forEach(function(id) {
  var el = document.getElementById(id);
  if(el) {
    el.addEventListener('keydown', function(e) {
      if(e.keyCode === 13) {
        e.preventDefault();
        document.getElementById('pmodal-save').click();
      }
    });
  }
});

$('pmodal-cancel').addEventListener('click',closeProfileModal);
function showModalErr(m){ var e=$('pmodal-error'); e.textContent=m; e.classList.remove('hidden'); }