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

  var html = '';
  if(items.length === 0){
     html = '<div class="empty-s">Keine Filme oder Serien angefangen.<br><br><button class="btn btn-secondary" id="cs-empty-back" data-focusable onclick="handleBack()">Zurück</button></div>';
  } else {
     for(var k=0; k<items.length; k++){
        var it = items[k];
        var thumb, title, subTxt, pct;
        if(it.kind === 'vod'){
          var s = it.stream;
          thumb = s.stream_icon||s.cover||'';
          title = esc(s.name||s.title||'Film');
          var durSecs = s.duration_secs||0;
          pct = durSecs>0 ? Math.min(100,Math.round(it.pos/durSecs*100)) : 0;
          subTxt = durSecs>0
            ? Math.max(0,Math.floor((durSecs-it.pos)/60))+' Min verbleibend'
            : 'Fortsetzen bei '+fmtDur(it.pos);
        } else {
          var r = it.rec;
          thumb = r.cover || (it.stream && (it.stream.cover||it.stream.stream_icon)) || '';
          var seName = r.name || (it.stream && it.stream.name) || 'Serie';
          var seLabel = 'S'+(r.season_num||'?')+'E'+(r.episode_num||'?');
          title = esc(seName) + ' <span style="opacity:.7">· '+esc(seLabel)+'</span>';
          subTxt = 'Fortsetzen bei '+fmtDur(it.pos);
          pct = 0; // Episodenlänge unbekannt → keine Fortschrittsanzeige
        }
        var imgEl = thumb
          ? '<img class="ct-thumb" src="'+esc(thumb)+'" onerror="this.style.display=\'none\'">'
          : '<div class="ct-thumb-ph">&#x1F3AC;</div>';
        html += '<div class="continue-tile" style="width:440px; height:100px; padding:0 20px;" data-focusable data-focus-class="htile-focused" onclick="continuePlay('+k+')">'
          + imgEl
          + '<div class="ct-info"><div class="ct-title" style="font-size:var(--fs-md);">'+title+'</div><div class="ct-sub" style="font-size:var(--fs-sm);">'+subTxt+'</div></div>'
          + '<div class="ct-bar"><div class="ct-bar-fill" style="width:'+pct+'%"></div></div>'
          + '</div>';
     }
  }
  $('cs-grid').innerHTML = html;
  $('cs-grid')._items = items;
  if(!S._navTabHold){
    S.focusArea = 'continue';
    setTimeout(function(){ 
       if(typeof SpatialNav !== 'undefined') {
          SpatialNav.focusBySelector('.continue-tile') || SpatialNav.focusBySelector('#cs-empty-back');
       }
    }, 50);
  }
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