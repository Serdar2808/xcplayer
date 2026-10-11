// ── GESEHEN / FORTSCHRITT AUF ALLEN POSTERN ─────────────────────
// Gesehen-Liste je Profil: v<stream_id> (Film), e<episode_id> (Folge), s<series_id> (ganze Serie)
var Watched = {
  _m: null, _k: null,
  _load: function(){
    var p = Profiles.getActive(), k = 'xcp_watched_' + (p ? p.id : 'default');
    if(this._m && this._k === k) return this._m;
    this._k = k;
    try { this._m = JSON.parse(localStorage.getItem(k) || '{}') || {}; } catch(e){ this._m = {}; }
    return this._m;
  },
  has: function(id){ return !!this._load()[id]; },
  set: function(id, on){
    var m = this._load();
    if(on){ if(m[id]) return; m[id] = Date.now(); }
    else { if(!m[id]) return; delete m[id]; }
    var keys = Object.keys(m);
    if(keys.length > 3000) keys.sort(function(a, b){ return m[a] - m[b]; }).slice(0, keys.length - 3000).forEach(function(x){ delete m[x]; });
    try { localStorage.setItem(this._k, JSON.stringify(m)); } catch(e){}
    _mediaStateVer++;
  }
};
var _mediaStateVer = 0;
// Balken bzw. Gesehen-Haken für ein Poster. kind: 'vod' | 'series' | 'ep'
function mediaStateHtml(s, kind){
  if(!s) return '';
  var pos = 0, dur = 0, seen = false;
  if(kind === 'series'){
    var sid = String(s.series_id || ''), rec = S.resumeSeries && S.resumeSeries[sid];
    if(rec && !rec.next){ pos = rec.pos || 0; dur = rec.dur || ContinueDur.get(rec.episode_id); }
    seen = !rec && Watched.has('s' + sid);
  } else {
    var id = String(kind === 'ep' ? s.id : s.stream_id);
    pos = S.resume[id] || 0;
    dur = (kind === 'vod' && s.duration_secs) || ContinueDur.get(id) || (kind === 'ep' ? _csParseDur(s.info) : 0);
    seen = !pos && Watched.has((kind === 'ep' ? 'e' : 'v') + id);
  }
  if(pos >= 20 && dur > 0) return '<div class="xc-prog"><i style="width:' + Math.max(2, Math.min(100, Math.round(pos / dur * 100))) + '%"></i></div>';
  if(seen) return '<div class="xc-seen" title="Gesehen">&#x2713;</div>';
  return '';
}
// Nach dem Schauen: sichtbare Poster neu beschriften
function refreshMediaStates(){
  _mediaStateVer++;
  if(typeof NF !== 'undefined' && NF.data) document.querySelectorAll('#netflix-grid .nf-card[data-row]').forEach(function(el){
    var row = NF.data[+el.dataset.row], s = row && row.streams[+el.dataset.col], st = el.querySelector('.xc-pstate');
    if(s && st) st.innerHTML = mediaStateHtml(s, S.tab === 'series' ? 'series' : 'vod');
  });
  if(S.tab !== 'live' && typeof renderVirtualGrid === 'function' && $('grid-content') && $('grid-content').children.length) renderVirtualGrid();
  if(S.seriesDetailOpen) document.querySelectorAll('#episode-list .ep-item').forEach(function(el){
    var ep = S.currentEpsArray && S.currentEpsArray[+el.dataset.idx], st = el.querySelector('.xc-pstate');
    if(ep && st) st.innerHTML = mediaStateHtml(ep, 'ep');
  });
}

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
  await _csAdvanceFinished(resumeSeriesData);
  seriesKeys = Object.keys(resumeSeriesData);
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
    if(!rec || (!rec.next && (!rec.pos || rec.pos < 20))) continue;
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
         html += '<div class="cs-item"><div class="nf-card cs-card" data-focusable data-focus-class="nf-focused" data-onfocus data-noscroll data-k="'+k+'" data-row="'+r+'">'
           + img
           + '<div class="nf-card-title" aria-hidden="true">'+esc(it.title)+'</div>'
           + (it.badge ? '<div class="cs-badge">'+esc(it.badge)+'</div>' : '')
           // Ohne bekannte Länge kein (leerer) Balken - sähe aus wie "nie gestartet"
           + '</div><div class="cs-prog' + (it.dur > 0 && !(it.rec && it.rec.next) ? '' : ' cs-prog-none') + '"><i style="width:'+it.pct+'%"></i></div>'
           + (it.kind === 'series' ? '<button class="cs-toseries" data-focusable data-k="'+k+'" data-row="'+r+'">Zur Serie</button>' : '')
           + '</div>';
       });
       html += '</div></div><div class="cs-info" id="cs-info-'+r+'"></div></div>';
     });
     grid.classList.add('cs-nf');
     grid.innerHTML = html;
     grid.querySelectorAll('.cs-toseries').forEach(function(b){
       b.addEventListener('click', function(){ continueOpenSeries(parseInt(b.getAttribute('data-k'), 10)); });
       b.addEventListener('xcfocus', function(){ var c = b.parentNode.querySelector('.cs-card'); if(c) _csFocused(c); });
     });
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
  if(items.length) _csFillDurations(items);
  if(!S._navTabHold){
    S.focusArea = 'continue';
    setTimeout(function(){
       if(typeof SpatialNav !== 'undefined') {
          SpatialNav.focusBySelector('.cs-card') || SpatialNav.focusBySelector('#cs-empty-back');
       }
    }, 50);
  }
}

// Gesamtlängen (Sekunden) für den Fortschrittsbalken - beim Schauen gespeichert
// bzw. einmalig beim Anbieter nachgeschlagen und gemerkt
var ContinueDur = {
  _m: null,
  _load: function(){
    if(!this._m){ try { this._m = JSON.parse(localStorage.getItem('xcp_cont_dur') || '{}') || {}; } catch(e){ this._m = {}; } }
    return this._m;
  },
  get: function(id){ return id ? (this._load()[String(id)] || 0) : 0; },
  set: function(id, secs){
    secs = Math.floor(secs || 0);
    if(!id || !(secs > 0) || !isFinite(secs)) return;
    var m = this._load();
    if(m[String(id)] === secs) return;
    m[String(id)] = secs;
    try { localStorage.setItem('xcp_cont_dur', JSON.stringify(m)); } catch(e){}
  }
};
// "duration_secs" oder "duration" ("1:45:10" / "45:10") aus Film-/Folgen-Infos
function _csParseDur(info){
  if(!info) return 0;
  var s = parseInt(info.duration_secs, 10);
  if(s > 0) return s;
  var m = String(info.duration || '').match(/^(\d+):(\d+)(?::(\d+))?$/);
  if(!m) return 0;
  return m[3] !== undefined ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : (+m[1]) * 60 + (+m[2]);
}
async function _csSeriesInfo(sid){
  var info = S.seriesInfoCache[sid];
  if(info) return info;
  var p = Profiles.getActive(), dbKey = (p ? p.id : 'unknown') + '_seriesInfo_' + sid;
  info = await PlaylistDB.get(dbKey);
  if(!info){ info = await API.getSeriesInfo(sid); if(info) PlaylistDB.set(dbKey, info); }
  if(info) S.seriesInfoCache[sid] = info;
  return info;
}
// Fehlende Längen nachschlagen und Balken/Infozeile nachträglich füllen
async function _csFillDurations(items){
  if(S.isM3U) return;
  for(var i = 0; i < items.length; i++){
    var it = items[i];
    if(it.dur > 0) continue;
    var secs = 0;
    try {
      if(it.kind === 'vod'){
        var d = await API.getVodInfo(it.stream.stream_id);
        secs = _csParseDur(d && d.info);
        if(secs) ContinueDur.set(it.stream.stream_id, secs);
      } else {
        var info = await _csSeriesInfo(it.rec.series_id), eps = (info && info.episodes) || {}, ep = null;
        Object.keys(eps).forEach(function(sn){ (eps[sn] || []).forEach(function(e){ if(String(e.id) === String(it.rec.episode_id)) ep = e; }); });
        secs = _csParseDur(ep && ep.info);
        if(secs) ContinueDur.set(it.rec.episode_id, secs);
      }
    } catch(e){}
    if(!(secs > 0) || $('cs-grid')._items !== items) continue;
    _csDecorate([it]);
    var card = document.querySelector('#cs-grid .cs-card[data-k="' + items.indexOf(it) + '"]');
    if(!card) continue;
    var bar = card.parentNode.querySelector('.cs-prog');
    if(bar){ bar.classList.remove('cs-prog-none'); bar.firstChild.style.width = it.pct + '%'; }
    if(SpatialNav.focused === card) _csFocused(card);
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
      dur = s.duration_secs || ContinueDur.get(s.stream_id);
      meta.push('<span class="nf-info-meta-tag">Film</span>');
    } else {
      var r = it.rec;
      it.thumb = r.cover || (it.stream && (it.stream.cover || it.stream.stream_icon)) || '';
      it.title = r.name || (it.stream && it.stream.name) || 'Serie';
      it.plot = (it.stream && it.stream.plot) || '';
      dur = r.dur || ContinueDur.get(r.episode_id);
      it.badge = (r.next ? 'Neu: ' : '') + 'S' + (r.season_num || '?') + ' · E' + (r.episode_num || '?');
      meta.push('<span class="nf-info-meta-tag">Serie</span>');
      meta.push('Staffel ' + esc(r.season_num || '?') + ' · Folge ' + esc(r.episode_num || '?'));
      // Folgentitel ohne den oft vorangestellten "Serie - S01E05 -"-Teil
      var et = String(r.ep_title || '').replace(/^.*?S\d+\s*E\d+\s*[-–:]?\s*/i, '').trim();
      if(et) meta.push(esc(et));
    }
    it.dur = dur || 0;
    it.pct = dur > 0 && it.pos > 0 ? Math.max(1, Math.min(100, Math.round(it.pos / dur * 100))) : 0;
    if(it.rec && it.rec.next) meta.push('Nächste Folge' + (dur > 0 ? ' · ' + Math.max(1, Math.round(dur / 60)) + ' Min' : ''));
    else meta.push('bei ' + fmtDur(it.pos) + (dur > 0 ? ' · noch ' + Math.max(1, Math.round((dur - it.pos) / 60)) + ' Min' : ''));
    it.meta = meta.join(' &nbsp;·&nbsp; ');
  });
}

// Fokussierte Karte: an den Reihenanfang holen (wie Netflix) und Infozeile füllen
function _csFocused(card){
  var items = $('cs-grid')._items || [], it = items[parseInt(card.getAttribute('data-k'), 10)];
  var track = card.closest('.cs-track');
  if(track) Motion.scroll(track, null, track.scrollLeft + card.getBoundingClientRect().left - track.getBoundingClientRect().left - 50);
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
  // Senkrecht: immer die ganze Reihe (Überschrift bis Infozeile) zeigen - die erste ganz oben
  var scr = $('continue-screen'), row = card.closest('.cs-row');
  if(scr && row){
    if(row === row.parentNode.firstElementChild){ Motion.scroll(scr, 0); return; }
    var sr = scr.getBoundingClientRect(), rr = row.getBoundingClientRect();
    var pad = parseInt(getComputedStyle(scr).paddingTop, 10) || 0;
    var top = scr.scrollTop + rr.top - sr.top - pad;              // Reihe oben an den Rand
    var bottom = scr.scrollTop + rr.bottom - sr.bottom + 40;      // Reihe unten ganz sichtbar
    if(rr.top < sr.top + pad) Motion.scroll(scr, top);
    else if(rr.bottom > sr.bottom - 40) Motion.scroll(scr, Math.min(top, bottom));
  }
}

// "Zur Serie": Folgenübersicht bei der aktuellen Folge öffnen
function continueOpenSeries(k){
  var it = ($('cs-grid')._items || [])[k];
  if(!it || it.kind !== 'series') return;
  var s = it.stream || { series_id: it.rec.series_id, name: it.rec.name, cover: it.rec.cover };
  openSeries(s, { season: it.rec.season_idx || 0, ep: it.rec.ep_idx || 0 });
}

// Serien, deren gemerkte Folge schon über "Als gesehen markieren ab" liegt (ältere Einträge):
// auf die nächste Folge vorrücken bzw. bei der letzten Folge entfernen
async function _csAdvanceFinished(map){
  var wp = +Settings.watchedPct || 100, changed = false;
  var keys = Object.keys(map);
  for(var i = 0; i < keys.length; i++){
    var rec = map[keys[i]];
    if(!rec || rec.next || !(rec.dur > 0) || rec.pos / rec.dur * 100 < Math.min(wp, 97)) continue;
    try {
      var info = await _csSeriesInfo(rec.series_id), eps = (info && info.episodes) || {};
      var seasons = Object.keys(eps).sort(function(a, b){ return +a - +b; }), si = -1, ei = -1;
      seasons.forEach(function(sn, a){ (eps[sn] || []).forEach(function(e, b){ if(String(e.id) === String(rec.episode_id)){ si = a; ei = b; } }); });
      if(si < 0) continue;
      Watched.set('e' + rec.episode_id, true);
      if(S.resume[String(rec.episode_id)]){ delete S.resume[String(rec.episode_id)]; saveResume(); }
      ei++;
      if(!(eps[seasons[si]] || [])[ei]){ si++; ei = 0; }
      var next = seasons[si] && (eps[seasons[si]] || [])[ei];
      if(next){
        map[keys[i]] = { series_id: rec.series_id, episode_id: next.id || '', episode_num: next.episode_num || (ei + 1), season_num: seasons[si],
          ep_idx: ei, season_idx: si, name: rec.name, cover: rec.cover, ep_title: next.title || '',
          dur: ContinueDur.get(next.id) || _csParseDur(next.info), pos: 0, next: true, ts: rec.ts || Date.now() };
      } else {
        delete map[keys[i]];
        Watched.set('s' + rec.series_id, true);
      }
      changed = true;
    } catch(e){}
  }
  if(changed) saveResumeSeries();
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