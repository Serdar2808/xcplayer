// ── WEITERSCHAUEN (Bildschirm) ─────────────────────────────────
async function renderContinueScreen() {
  if(typeof _updateNavbarVisibility === 'function') _updateNavbarVisibility();
  if(typeof updateNavTabsActive === 'function') updateNavTabsActive('continue');
  $('cs-grid').innerHTML = '<div class="loading-c"><div class="spinner"></div></div>';
  var resumeData = S.resume || {};
  var resumeSeriesData = S.resumeSeries || {};
  var vodKeys = Object.keys(resumeData);
  var seriesKeys = Object.keys(resumeSeriesData);
  if(vodKeys.length === 0 && seriesKeys.length === 0){
      $('cs-grid').innerHTML = '<div class="empty-s">Keine Filme oder Serien angefangen.</div>';
      if(!S._navTabHold) S.focusArea = 'continue';
      return;
  }

  // VOD-Streams einmalig laden, falls nötig (nur wenn überhaupt VOD-Resumes existieren)
  if(vodKeys.length > 0 && (!S.fullStreams.vod || S.fullStreams.vod.length === 0)){
      var d = await getOrFetchData('streams', 'vod');
      var arr = Array.isArray(d) ? d : [];
      if (arr.length > 0) {
          var c = await getOrFetchData('cats', 'vod');
          var cats = processCatsFilter(Array.isArray(c) ? c : [], 'vod');
          S.fullStreams.vod = processStreamsFilter(arr, 'vod', cats);
      }
  }
  var vodMap = {};
  if(S.fullStreams.vod){
    for(var i=0;i<S.fullStreams.vod.length;i++){
      vodMap[String(S.fullStreams.vod[i].stream_id)] = S.fullStreams.vod[i];
    }
  }

  // Serien-Streams für Klick-Handler bereitstellen (damit openSeries() das Original-Stream-Objekt bekommt)
  if(seriesKeys.length > 0 && (!S.fullStreams.series || S.fullStreams.series.length === 0)){
      var ds = await getOrFetchData('streams', 'series');
      var arrs = Array.isArray(ds) ? ds : [];
      if (arrs.length > 0) {
          var sc = await getOrFetchData('cats', 'series');
          var scats = processCatsFilter(Array.isArray(sc) ? sc : [], 'series');
          S.fullStreams.series = processStreamsFilter(arrs, 'series', scats);
      }
  }
  var seriesMap = {};
  if(S.fullStreams.series){
    for(var si=0;si<S.fullStreams.series.length;si++){
      seriesMap[String(S.fullStreams.series[si].series_id)] = S.fullStreams.series[si];
    }
  }

  // Items sammeln (Filme + Serien) und nach Zeitstempel/Position sortieren
  var items = [];
  for(var j=0; j<vodKeys.length; j++){
    var sid = vodKeys[j];
    var pos = resumeData[sid];
    if(!pos || pos < 20) continue;
    var stream = vodMap[sid];
    if(!stream) continue;
    items.push({ kind:'vod', stream:stream, pos:pos, ts: 0 });
  }
  for(var sk=0; sk<seriesKeys.length; sk++){
    var ssid = seriesKeys[sk];
    var rec = resumeSeriesData[ssid];
    if(!rec || !rec.pos || rec.pos < 20) continue;
    items.push({ kind:'series', rec:rec, stream: seriesMap[ssid] || null, pos: rec.pos, ts: rec.ts || 0 });
  }
  // Neueste zuerst (Serien haben ts; VOD hat 0 → landen hinten – das ist okay als Default)
  items.sort(function(a,b){ return (b.ts||0) - (a.ts||0); });

  var grid = $('cs-grid');
  if(items.length === 0){
     grid.classList.remove('cs-nf');
     grid.innerHTML = '<div class="empty-s">Keine Filme oder Serien angefangen.<br><br><button class="btn btn-secondary" id="cs-empty-back" data-focusable onclick="handleBack()">Zurück</button></div>';
  } else {
     _csDecorate(items);
     // Wie die Netflix-Ansicht: je eine Reihe für Serien und Filme
     var rows = [
       { title: 'Serien weiterschauen', items: items.filter(function(x){ return x.kind === 'series'; }) },
       { title: 'Filme weiterschauen', items: items.filter(function(x){ return x.kind === 'vod'; }) }
     ].filter(function(r){ return r.items.length; });
     var html = '';
     rows.forEach(function(row, r){
       html += '<div class="cs-row"><div class="nf-row-header">'+row.title+'</div><div class="cs-track"><div class="cs-inner">';
       row.items.forEach(function(it){
         var k = items.indexOf(it);
         var img = it.thumb
           ? '<img class="nf-card-img" src="'+esc(it.thumb)+'" decoding="async" alt="" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'">'
             + '<div class="nf-card-img-ph" style="display:none">&#x1F3AC;</div>'
           : '<div class="nf-card-img-ph">&#x1F3AC;</div>';
         // Karte + Fortschrittsbalken (cyan) darunter
         html += '<div class="cs-item"><div class="nf-card cs-card" data-focusable data-focus-class="nf-focused" data-onfocus data-k="'+k+'" data-row="'+r+'">'
           + img
           + '<div class="nf-card-title" aria-hidden="true">'+esc(it.title)+'</div>'
           + (it.badge ? '<div class="cs-badge">'+esc(it.badge)+'</div>' : '')
           + '</div><div class="cs-prog"><i style="width:'+it.pct+'%"></i></div></div>';
       });
       html += '</div></div><div class="cs-info" id="cs-info-'+r+'"></div></div>';
     });
     grid.classList.add('cs-nf');
     grid.innerHTML = html;
     grid.querySelectorAll('.cs-card').forEach(function(card){
       card.addEventListener('xcfocus', function(){ _csFocused(card); });
       card.addEventListener('mouseover', function(){ if(SpatialNav.focused !== card) setFocus(card); });
       card.addEventListener('click', function(){
         // Touch wie in der Netflix-Ansicht: erstes Antippen wählt aus, zweites setzt fort
         if(SpatialNav.focused !== card){ setFocus(card); return; }
         continuePlay(parseInt(card.getAttribute('data-k'), 10));
       });
     });
  }
  grid._items = items;
  if(!S._navTabHold){
    S.focusArea = 'continue';
    setTimeout(function(){
       if(typeof SpatialNav !== 'undefined') {
          SpatialNav.focusBySelector('.cs-card') || SpatialNav.focusBySelector('#cs-empty-back');
       }
    }, 50);
  }
}

// Anzeige-Daten je Eintrag: Bild, Titel, Staffel/Folge, Fortschritt, Infozeile
function _csDecorate(items){
  items.forEach(function(it){
    var dur, meta = [];
    if(it.kind === 'vod'){
      var s = it.stream;
      it.thumb = s.stream_icon || s.cover || '';
      it.title = s.name || s.title || 'Film';
      it.plot = s.plot || '';
      dur = s.duration_secs || 0;
      meta.push('<span class="nf-info-meta-tag">Film</span>');
    } else {
      var r = it.rec;
      it.thumb = r.cover || (it.stream && (it.stream.cover || it.stream.stream_icon)) || '';
      it.title = r.name || (it.stream && it.stream.name) || 'Serie';
      it.plot = (it.stream && it.stream.plot) || '';
      dur = r.dur || 0;
      it.badge = 'S' + (r.season_num || '?') + ' · E' + (r.episode_num || '?');
      meta.push('<span class="nf-info-meta-tag">Serie</span>');
      meta.push('Staffel ' + esc(r.season_num || '?') + ' · Folge ' + esc(r.episode_num || '?'));
      // Folgentitel ohne den oft vorangestellten "Serie - S01E05 -"-Teil
      var et = String(r.ep_title || '').replace(/^.*?S\d+\s*E\d+\s*[-–:]?\s*/i, '').trim();
      if(et) meta.push(esc(et));
    }
    it.pct = dur > 0 ? Math.min(100, Math.round(it.pos / dur * 100)) : 0;
    meta.push('bei ' + fmtDur(it.pos) + (dur > 0 ? ' · noch ' + Math.max(1, Math.round((dur - it.pos) / 60)) + ' Min' : ''));
    it.meta = meta.join(' &nbsp;·&nbsp; ');
  });
}

// Fokussierte Karte: an den Reihenanfang holen (wie Netflix) und Infozeile füllen
function _csFocused(card){
  var items = $('cs-grid')._items || [], it = items[parseInt(card.getAttribute('data-k'), 10)];
  var track = card.closest('.cs-track');
  if(track) track.scrollLeft = Math.max(0, track.scrollLeft + card.getBoundingClientRect().left - track.getBoundingClientRect().left - 50);
  document.querySelectorAll('#cs-grid .cs-info').forEach(function(el){ el.innerHTML = ''; });
  var box = $('cs-info-' + card.getAttribute('data-row'));
  if(box && it){
    var phone = document.documentElement.classList.contains('xc-phone'), k = card.getAttribute('data-k');
    box.innerHTML = '<div class="nf-info-meta">' + it.meta + '</div>' +
      (it.plot ? '<div class="cs-plot">' + esc(it.plot) + '</div>' : '') +
      (phone
        ? '<div class="cs-hint">Nochmal antippen: fortsetzen <button class="cs-remove" onclick="continueRemove(' + k + ')">&#x2715; Entfernen</button></div>'
        : '<div class="cs-hint">OK: fortsetzen &nbsp;·&nbsp; <span class="cs-key-red"></span> ROT: aus Weiterschauen entfernen</div>');
  }
}

// Eintrag aus Weiterschauen entfernen (Fortschritt wird gelöscht)
function continueRemove(k){
  var items = $('cs-grid')._items || [], it = items[k];
  if(!it) return;
  var name = it.title + (it.badge ? ' (' + it.badge + ')' : '');
  showConfirm('Aus Weiterschauen entfernen?', name, 'Entfernen', function(yes){
    if(!yes) { setTimeout(function(){ SpatialNav.focusBySelector('.cs-card[data-k="' + k + '"]'); }, 50); return; }
    if(it.kind === 'vod'){
      delete S.resume[String(it.stream.stream_id)];
      saveResume();
    } else {
      var sid = String(it.rec.series_id);
      if(S.resumeSeries) delete S.resumeSeries[sid];
      if(it.rec.episode_id) delete S.resume[String(it.rec.episode_id)];
      saveResume();
      if(typeof saveResumeSeries === 'function') saveResumeSeries();
    }
    showToast('Entfernt', 1500);
    renderContinueScreen();
  });
}

async function _playSeriesFromContinue(s, targetEpId) {
    try {
        var info = S.seriesInfoCache[s.series_id];
        if(!info){
          var p = Profiles.getActive();
          var dbKey = (p?p.id:'unknown') + '_seriesInfo_' + s.series_id;
          if(!S.isM3U) info = await PlaylistDB.get(dbKey);
          if(!info){ info = await API.getSeriesInfo(s.series_id); if(!S.isM3U&&info) PlaylistDB.set(dbKey, info); }
          S.seriesInfoCache[s.series_id] = info;
        }
        S.seriesEpisodes = info.episodes || {};
        S.seriesSeasonsArr = Object.keys(S.seriesEpisodes).sort(function(a,b){ return +a - +b; });
        var foundSeasonIdx = 0, foundEpIdx = 0, foundEp = null;
        for(var i=0; i<S.seriesSeasonsArr.length; i++){
            var eps = S.seriesEpisodes[S.seriesSeasonsArr[i]] || [];
            for(var j=0; j<eps.length; j++){
                if(String(eps[j].id) === String(targetEpId)){
                    foundSeasonIdx = i; foundEpIdx = j; foundEp = eps[j]; break;
                }
            }
            if(foundEp) break;
        }
        if(!foundEp){ hideFullLoader(); showToast('Episode nicht gefunden', 2000); return; }
        
        S.currentSeriesStream = s;
        S.cursors.season = foundSeasonIdx;
        S.currentEpsArray = S.seriesEpisodes[S.seriesSeasonsArr[foundSeasonIdx]];
        S.currentEpIdx = foundEpIdx;
        S.cursors.ep = foundEpIdx;
        
        var sn = S.seriesSeasonsArr[foundSeasonIdx] || '?';
        var name = (info.info&&info.info.name || s.name || 'Serie') + ' S' + sn + 'E' + (foundEp.episode_num || foundEpIdx+1);
        
        hideFullLoader();
        Player.play(API.epUrl(foundEp), {name:name, series_id: s.series_id, episode_id: foundEp.id}, 'series');
    } catch(e) {
        hideFullLoader();
        showToast('Fehler beim Laden', 2000);
    }
}

function continuePlay(idx){
  var tiles=$('cs-grid')._items;
  if(!tiles||!tiles[idx]) return;
  var it=tiles[idx];
  if(it.kind === 'series'){
    showFullLoader('Lade Episode...', '');
    var s = it.stream;
    if(!s) s = { series_id: it.rec.series_id, name: it.rec.name, cover: it.rec.cover };
    _playSeriesFromContinue(s, it.rec.episode_id);
    return;
  }
  // VOD
  var sv=it.stream;
  var url=API.vodUrl(sv);
  Player.play(url,sv,'vod');
}