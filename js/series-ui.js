// ── SERIES ────────────────────────────────────────────────────────
async function openSeries(s){
  S.seriesDetailOpen=true; S.currentSeriesStream=s;
  $('episode-list').innerHTML='<div class="loading-c"><div class="spinner"></div></div>';
  try{
    var info = S.seriesInfoCache[s.series_id];
    if(!info){
      var p = Profiles.getActive();
      var pId = p ? p.id : 'unknown';
      var dbKey = pId + '_seriesInfo_' + s.series_id;
      if(!S.isM3U) info = await PlaylistDB.get(dbKey);
      if(!info){
        info = await API.getSeriesInfo(s.series_id);
        if(!S.isM3U && info) PlaylistDB.set(dbKey, info);
      }
      S.seriesInfoCache[s.series_id] = info;
    }
    var cover=(info.info&&info.info.cover)||'';
    $('s-cover').src=cover; $('shero-bg').style.backgroundImage=cover?'url('+cover+')':'';
    $('s-title').textContent=(info.info&&info.info.name)||s.name||'';
    var plotText = (info.info&&info.info.plot)||'';
    $('s-plot').textContent=plotText;
    requestAnimationFrame(function(){
      var plotWrap=$('s-plot-wrap');
      var plotEl=$('s-plot');
      if(plotWrap && plotEl){
        var overflow = plotEl.scrollHeight - plotWrap.clientHeight;
        if(overflow > 4){
          plotEl.style.setProperty('--plot-shift', (-overflow - 10) + 'px');
          plotEl.classList.add('is-overflow');
        } else {
          plotEl.classList.remove('is-overflow');
          plotEl.style.removeProperty('--plot-shift');
        }
      }
    });
    S.seriesEpisodes=info.episodes||{};
    S.seriesSeasonsArr=Object.keys(S.seriesEpisodes).sort(function(a,b){ return +a-+b; });
    var html='';
    for(var i=0;i<S.seriesSeasonsArr.length;i++)
      html+='<button class="sbtn'+(i===0?' active':'')+'" data-focusable data-s="'+S.seriesSeasonsArr[i]+'" data-idx="'+i+'" id="ss-'+i+'">Staffel '+S.seriesSeasonsArr[i]+'</button>';
    $('season-tabs').innerHTML=html;
    S.cursors.season=0; S.focusArea='series_season';
    if(S.seriesSeasonsArr.length>0) selectSeason(0);
    updateFocus();
  }catch(e){ Logger.warn('[openSeries] error:', e.message); $('episode-list').innerHTML='<div class="empty-s"><p>Fehler</p></div>'; }
}
function selectSeason(idx){
  S.cursors.season=idx;
  document.querySelectorAll('.sbtn').forEach(function(b){ b.classList.remove('active'); });
  var ss=$('ss-'+idx); if(ss) ss.classList.add('active');
  S.currentEpsArray=S.seriesEpisodes[S.seriesSeasonsArr[idx]]||[];
  S.currentEpIdx=0; S.cursors.ep=0;
  var html='<div class="ep-section-lbl">'+S.currentEpsArray.length+' Episoden</div>';
  for(var i=0;i<S.currentEpsArray.length;i++){
    var ep=S.currentEpsArray[i];
    var epNum = ep.episode_num || (i+1);
    var epTitle = ep.title || (ep.info&&ep.info.name) || 'Episode ' + epNum;
    var epDur = (ep.info&&ep.info.duration) || '';
    var epPlot = (ep.info&&ep.info.plot) || '';
    var epImg = (ep.info&&ep.info.movie_image) || '';
    
    var imgHtml = epImg 
      ? '<img class="ep-thumb" src="'+esc(epImg)+'" loading="lazy" onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'flex\'"><div class="ep-thumb-ph" style="display:none">&#x1F4FA;</div>'
      : '<div class="ep-thumb-ph">&#x1F4FA;</div>';

    html+='<div class="ep-item" data-focusable id="ep-'+i+'" data-idx="'+i+'">'
      +'<div class="ep-thumb-wrap">'+imgHtml+'<div class="ep-play-overlay">&#9654;</div></div>'
      +'<div class="ep-info-col">'
      +'<div class="ep-title-row"><div class="ep-title">'+epNum+'. '+esc(epTitle)+'</div><div class="ep-dur">'+esc(epDur)+'</div></div>'
      +(epPlot?'<div class="ep-plot">'+esc(epPlot)+'</div>':'')
      +'</div></div>';
  }
  $('episode-list').innerHTML=html;
}
function playEpisode(idx){
  var ep=S.currentEpsArray[idx]; if(!ep) return;
  S.currentEpIdx=idx; S.cursors.ep=idx;
  var sn=S.seriesSeasonsArr[S.cursors.season]||'?';
  var name=($('s-title').textContent)+' S'+sn+'E'+(ep.episode_num||idx+1);
  $('series-detail').classList.add('hidden');
  Player.play(API.epUrl(ep),{name:name, series_id:S.currentSeriesStream?S.currentSeriesStream.series_id:'', episode_id:ep.id},'series');
}
function closeSeries(){
  S.seriesDetailOpen=false;
  var ca=$('content-area');
  if(ca && ca.classList.contains('nf-mode')){
    S.focusArea='netflix';
    if(typeof NF!=='undefined' && NF._updateFocusDOM) NF._updateFocusDOM();
  } else {
    S.focusArea='grid'; updateFocus();
  }
}