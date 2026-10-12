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
  var laterList = Later.all();
  if(vodKeys.length === 0 && seriesKeys.length === 0 && laterList.length === 0){
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
  // Für später gemerkt (Optionen, OK lang drücken) - zuletzt gemerkt zuerst
  laterList.forEach(function(x){ if(x.s) items.push({ kind:'later', lk:x.k, stream:x.s, pos:0, ts:x.ts }); });

  var grid = $('cs-grid');
  if(items.length === 0){
     grid.classList.remove('cs-nf');
     grid.innerHTML = '<div class="empty-s">Keine Filme oder Serien angefangen.<br><br><button class="btn btn-secondary" id="cs-empty-back" data-focusable onclick="handleBack()">Zurück</button></div>';
  } else {
     _csDecorate(items);
     // Wie die Netflix-Ansicht: je eine Reihe für Serien und Filme
     var rows = [
       { title: 'Serien weiterschauen', items: items.filter(function(x){ return x.kind === 'series'; }) },
       { title: 'Filme weiterschauen', items: items.filter(function(x){ return x.kind === 'vod'; }) },
       { title: 'Für später', items: items.filter(function(x){ return x.kind === 'later'; }) }
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
           + (it.kind === 'series' ? '<button class="cs-toseries" data-focusable data-onfocus data-noscroll data-k="'+k+'" data-row="'+r+'">Zur Serie</button>' : '')
           + '</div>';
       });
       html += '</div></div><div class="cs-info" id="cs-info-'+r+'"></div></div>';
     });
     grid.classList.add('cs-nf');
     grid.innerHTML = html;
     grid.querySelectorAll('.cs-toseries').forEach(function(b){
       b.addEventListener('click', function(){ continueOpenSeries(parseInt(b.getAttribute('data-k'), 10)); });
       // Poster bleibt groß, solange der Button darunter fokussiert ist
       b.addEventListener('xcfocus', function(){
         var c = b.parentNode.querySelector('.cs-card'); if(!c) return;
         c.classList.add('nf-focused'); _csFocused(c);
         b._xcblur = function(){ c.classList.remove('nf-focused'); b._xcblur = null; };
       });
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
    if(it.dur > 0 || it.kind === 'later') continue;
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
    if(it.kind === 'later'){
      var ls = it.stream;
      it.thumb = ls.stream_icon || ls.cover || '';
      it.title = ls.name || ls.title || (it.lk === 'series' ? 'Serie' : 'Film');
      it.plot = ls.plot || '';
      dur = 0;
      meta.push('<span class="nf-info-meta-tag">' + (it.lk === 'series' ? 'Serie' : 'Film') + '</span>');
      meta.push('Für später gemerkt');
    } else if(it.kind === 'vod'){
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
        ? '<div class="cs-hint">Nochmal antippen: ' + (it.kind === 'later' ? 'öffnen' : 'fortsetzen') + ' · lang: Optionen <button class="cs-remove" onclick="continueRemove(' + k + ')">&#x2715; Entfernen</button></div>'
        : '<div class="cs-hint">OK: ' + (it.kind === 'later' ? 'öffnen' : 'fortsetzen') + ' &nbsp;·&nbsp; OK lang: Optionen &nbsp;·&nbsp; <span class="cs-key-red"></span> ROT: entfernen</div>');
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
  showConfirm(it.kind === 'later' ? 'Aus „Für später“ entfernen?' : 'Aus Weiterschauen entfernen?', name, 'Entfernen', function(yes){
    if(!yes) { setTimeout(function(){ SpatialNav.focusBySelector('.cs-card[data-k="' + k + '"]'); }, 50); return; }
    if(it.kind === 'later'){
      Later.remove(it.lk, it.stream);
    } else if(it.kind === 'vod'){
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
  if(it.kind === 'later'){
    if(it.lk === 'series') openSeries(it.stream);
    else Player.play(API.vodUrl(it.stream), it.stream, 'vod');
    return;
  }
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
// ── FÜR SPÄTER (Merkliste je Profil) ───────────────────────────
// Einträge: { k: 'vod' | 'series', id, s: Stream-Objekt, ts }
var Later = {
  _l: null, _k: null,
  _load: function(){
    var p = Profiles.getActive(), k = 'xcp_later_' + (p ? p.id : 'default');
    if(this._l && this._k === k) return this._l;
    this._k = k;
    try { this._l = JSON.parse(localStorage.getItem(k) || '[]') || []; } catch(e){ this._l = []; }
    return this._l;
  },
  _save: function(){ try { localStorage.setItem(this._k, JSON.stringify(this._l)); } catch(e){} },
  _id: function(kind, s){ return String(kind === 'series' ? s.series_id : s.stream_id); },
  all: function(){ return this._load().slice(); },
  has: function(kind, s){ var id = this._id(kind, s); return this._load().some(function(x){ return x.k === kind && x.id === id; }); },
  add: function(kind, s){
    if(this.has(kind, s)) return;
    var l = this._load(); l.unshift({ k: kind, id: this._id(kind, s), s: s, ts: Date.now() });
    if(l.length > 200) l.length = 200;
    this._save();
  },
  remove: function(kind, s){
    var id = this._id(kind, s), l = this._load();
    this._l = l.filter(function(x){ return !(x.k === kind && x.id === id); });
    this._save();
  }
};

// ── OPTIONEN (OK lang drücken bzw. lang antippen) ──────────────
// Für Filme, Serien und Folgen: gesehen/zurücksetzen, von vorn, für später, Favorit
var CtxMenu = {
  _el: null, _items: [], _prev: null, _area: null,
  isOpen: function(){ return !!(this._el && !this._el.classList.contains('hidden')); },

  // Ziel aus dem aktuellen Fokus (Fernbedienung)
  fromFocus: function(){
    if(S.playerVisible || S.sysMenuOpen || S.screen === 'settings') return null;
    if(!$('confirm-modal').classList.contains('hidden') || !$('profile-modal').classList.contains('hidden')) return null;
    var tabKind = S.tab === 'series' ? 'series' : S.tab === 'vod' ? 'vod' : null, f = SpatialNav.focused;
    if(S.focusArea === 'netflix' && tabKind && typeof NF !== 'undefined' && NF.data){
      var row = NF.data[NF.rowIdx], s = row && row.streams[NF.colIdx];
      return s ? { kind: tabKind, s: s } : null;
    }
    if(S.focusArea === 'grid' && tabKind && f && f.classList.contains('grid-item-wrap')){
      var g = S.filteredStreams[S.cursors.grid]; return g ? { kind: tabKind, s: g } : null;
    }
    if(S.focusArea === 'series_ep' && S.seriesDetailOpen){
      var ep = S.currentEpsArray[S.cursors.ep]; return ep ? { kind: 'ep', ep: ep, idx: S.cursors.ep, s: S.currentSeriesStream } : null;
    }
    if(S.focusArea === 'continue' && f && f.classList.contains('cs-card')) return this._fromCont(+f.getAttribute('data-k'));
    if(S.focusArea === 'nf-search' && tabKind && typeof NFSearch !== 'undefined' && NFSearch.mode === 'results'){
      var r = NFSearch.results[NFSearch.focusedIdx]; return r && !r._hist && !r._histClear ? { kind: tabKind, s: r } : null;
    }
    return null;
  },
  // Ziel aus dem angetippten Element (Touch)
  fromEl: function(el){
    if(S.playerVisible) return null;
    var tabKind = S.tab === 'series' ? 'series' : S.tab === 'vod' ? 'vod' : null;
    if(el.classList.contains('cs-card')) return this._fromCont(+el.getAttribute('data-k'));
    if(el.classList.contains('ep-item')){ var ep = S.currentEpsArray[+el.dataset.idx]; return ep ? { kind: 'ep', ep: ep, idx: +el.dataset.idx, s: S.currentSeriesStream } : null; }
    if(!tabKind) return null;
    if(el.classList.contains('nf-card') && el.dataset.row !== undefined && typeof NF !== 'undefined' && NF.data){
      var row = NF.data[+el.dataset.row], s = row && row.streams[+el.dataset.col]; return s ? { kind: tabKind, s: s } : null;
    }
    if(el.classList.contains('grid-item-wrap')){ var g = S.filteredStreams[+el.dataset.idx]; return g ? { kind: tabKind, s: g } : null; }
    if(el.classList.contains('nfs-card') && !el.classList.contains('nfs-hist')){ var r = NFSearch.results[+el.dataset.idx]; return r && !r._hist && !r._histClear ? { kind: tabKind, s: r } : null; }
    return null;
  },
  _fromCont: function(k){
    var it = ($('cs-grid')._items || [])[k]; if(!it) return null;
    if(it.kind === 'later') return { kind: it.lk, s: it.stream };
    if(it.kind === 'vod') return { kind: 'vod', s: it.stream };
    return { kind: 'series', s: it.stream || { series_id: it.rec.series_id, name: it.rec.name, cover: it.rec.cover } };
  },

  _isFav: function(kind, s){ var id = kind === 'series' ? s.series_id : s.stream_id; return !!(S.favs && S.favs[kind] && S.favs[kind].indexOf(id) !== -1); },
  _toggleFav: function(kind, s){
    var id = kind === 'series' ? s.series_id : s.stream_id, l = S.favs[kind], i = l.indexOf(id);
    if(i === -1){ l.push(id); showToast('Zu Favoriten hinzugefügt', 1500); } else { l.splice(i, 1); showToast('Aus Favoriten entfernt', 1500); }
    saveFavs();
  },

  open: function(t){
    if(!t || !t.s) return;
    var self = this, items = [], s = t.s;
    var add = function(ico, label, fn){ items.push({ ico: ico, label: label, fn: fn }); };
    var title = '', sub = '';
    if(t.kind === 'vod'){
      var id = String(s.stream_id), pos = S.resume[id] || 0, seen = Watched.has('v' + id);
      title = s.name || 'Film'; sub = pos >= 20 ? 'Angefangen bei ' + fmtDur(pos) : (seen ? 'Gesehen' : 'Film');
      add('&#x2713;', seen && !pos ? 'Als ungesehen markieren' : 'Als gesehen markieren', function(){ self._markVod(s, !(seen && !pos)); });
      if(pos){
        add('&#x21BA;', 'Fortschritt zurücksetzen', function(){ delete S.resume[id]; saveResume(); showToast('Fortschritt zurückgesetzt', 1500); });
        add('&#x25B6;', 'Von Anfang an abspielen', function(){ Player.playFresh(function(){ Player.play(API.vodUrl(s), s, 'vod'); }); });
      }
    } else if(t.kind === 'series'){
      title = s.name || 'Serie'; sub = 'Serie';
      var rec = S.resumeSeries && S.resumeSeries[String(s.series_id)];
      if(rec) sub = (rec.next ? 'Als Nächstes: ' : 'Angefangen: ') + 'Staffel ' + (rec.season_num || '?') + ' · Folge ' + (rec.episode_num || '?');
      else if(Watched.has('s' + s.series_id)) sub = 'Gesehen';
      add('&#x2713;', 'Ganze Serie als gesehen markieren', function(){ return self._markSeries(s, true); });
      add('&#x21BA;', 'Serie zurücksetzen', function(){ return self._markSeries(s, false); });
    } else {
      var ep = t.ep, eid = String(ep.id), epos = S.resume[eid] || 0, eseen = Watched.has('e' + eid);
      var sn = S.seriesSeasonsArr[S.cursors.season] || '?';
      title = String(ep.title || '').replace(/^.*?S\d+\s*E\d+\s*[-–:]?\s*/i, '') || 'Folge';
      sub = 'Staffel ' + sn + ' · Folge ' + (ep.episode_num || t.idx + 1);
      add('&#x2713;', eseen && !epos ? 'Als ungesehen markieren' : 'Als gesehen markieren', function(){ return self._markUpTo(s, ep, eseen && !epos ? 'unmark' : 'one'); });
      if(epos){
        add('&#x21BA;', 'Fortschritt zurücksetzen', function(){
          delete S.resume[eid]; saveResume();
          var r = S.resumeSeries && S.resumeSeries[String(s.series_id)];
          if(r && String(r.episode_id) === eid){ delete S.resumeSeries[String(s.series_id)]; saveResumeSeries(); }
          showToast('Fortschritt zurückgesetzt', 1500);
        });
        add('&#x25B6;', 'Von Anfang an abspielen', function(){ Player.playFresh(function(){ playEpisode(t.idx); }); });
      }
      add('&#x2713;', 'Bis hier als gesehen markieren', function(){ return self._markUpTo(s, ep, 'upto'); });
      add('&#x2713;', 'Ganze Staffel ' + sn + ' als gesehen markieren', function(){ return self._markUpTo(s, ep, 'season'); });
    }
    if(t.kind !== 'ep'){
      var later = Later.has(t.kind, s);
      add(later ? '&#x2715;' : '&#x2691;', later ? 'Aus „Für später“ entfernen' : 'Für später merken', function(){
        if(later){ Later.remove(t.kind, s); showToast('Aus „Für später“ entfernt', 1500); }
        else { Later.add(t.kind, s); showToast('Gemerkt - steht in Weiterschauen', 2000); }
      });
      var fav = this._isFav(t.kind, s);
      add(fav ? '&#x2606;' : '&#x2605;', fav ? 'Aus Favoriten entfernen' : 'Zu Favoriten hinzufügen', function(){ self._toggleFav(t.kind, s); });
    }
    this._render(title, sub, items);
  },

  _render: function(title, sub, items){
    if(!this._el){
      this._el = document.createElement('div');
      this._el.id = 'xc-ctx'; this._el.className = 'hidden';
      this._el.innerHTML = '<div class="xc-ctx-box"><div class="xc-ctx-title"></div><div class="xc-ctx-sub"></div><div class="xc-ctx-list"></div></div>';
      var self = this;
      this._el.addEventListener('click', function(e){
        var b = e.target.closest && e.target.closest('.xc-ctx-item');
        if(b) self.run(+b.getAttribute('data-i'));
        else if(!(e.target.closest && e.target.closest('.xc-ctx-box'))) self.close();
      });
      document.body.appendChild(this._el);
    }
    this._items = items;
    this._prev = SpatialNav.focused; this._area = S.focusArea;
    this._el.querySelector('.xc-ctx-title').textContent = title;
    this._el.querySelector('.xc-ctx-sub').textContent = sub;
    this._el.querySelector('.xc-ctx-list').innerHTML = items.map(function(it, i){
      return '<button class="xc-ctx-item" data-focusable data-i="' + i + '"><span class="xc-ctx-ico">' + it.ico + '</span>' + esc(it.label) + '</button>';
    }).join('');
    this._el.classList.remove('hidden');
    SpatialNav.focus(this._el.querySelector('.xc-ctx-item'));
  },
  move: function(d){
    var list = this._el.querySelectorAll('.xc-ctx-item'), i = Array.prototype.indexOf.call(list, SpatialNav.focused) + d;
    if(i < 0 || i >= list.length){ Motion.bump(this._el.querySelector('.xc-ctx-box'), d < 0 ? 'u' : 'd'); return; }
    SpatialNav.focus(list[i]);
  },
  close: function(){
    if(!this.isOpen()) return;
    this._el.classList.add('hidden');
    S.focusArea = this._area;
    if(this._prev && document.body.contains(this._prev)) SpatialNav.focus(this._prev); else clearFocus();
    if(S.focusArea === 'netflix' && typeof NF !== 'undefined' && NF._updateFocusDOM) NF._updateFocusDOM();
  },
  run: async function(i){
    var it = this._items[i]; if(!it) return;
    this.close();
    try { await it.fn(); } catch(e){ Logger.warn('[CtxMenu]', e && e.message); }
    // Poster, Folgen und Weiterschauen neu beschriften
    refreshMediaStates();
    if(S.screen === 'continue' && !S.seriesDetailOpen && !S.playerVisible) renderContinueScreen();
  },

  _markVod: function(s, on){
    var id = String(s.stream_id);
    Watched.set('v' + id, on);
    if(S.resume[id]){ delete S.resume[id]; saveResume(); }
    showToast(on ? 'Als gesehen markiert' : 'Als ungesehen markiert', 1500);
  },
  // Alle Folgen der Serie in Reihenfolge
  _eps: async function(sid){
    var info = await _csSeriesInfo(sid), eps = (info && info.episodes) || {}, out = [];
    Object.keys(eps).sort(function(a, b){ return +a - +b; }).forEach(function(sn, si){
      (eps[sn] || []).forEach(function(e, ei){ out.push({ e: e, sn: sn, si: si, ei: ei }); });
    });
    return out;
  },
  _markSeries: async function(s, on){
    var sid = String(s.series_id), list = await this._eps(sid);
    list.forEach(function(x){ Watched.set('e' + x.e.id, on); delete S.resume[String(x.e.id)]; });
    Watched.set('s' + sid, on);
    if(S.resumeSeries && S.resumeSeries[sid]){ delete S.resumeSeries[sid]; saveResumeSeries(); }
    saveResume();
    showToast(on ? 'Serie als gesehen markiert' : 'Serie zurückgesetzt', 1500);
  },
  // mode: 'one' (nur diese Folge) | 'upto' (alle bis hier) | 'season' (ganze Staffel) | 'unmark'
  _markUpTo: async function(s, ep, mode){
    var sid = String(s.series_id), eid = String(ep.id);
    if(mode === 'unmark'){ Watched.set('e' + eid, false); Watched.set('s' + sid, false); showToast('Als ungesehen markiert', 1500); return; }
    var list = await this._eps(sid), at = -1;
    for(var i = 0; i < list.length; i++) if(String(list[i].e.id) === eid){ at = i; break; }
    if(at < 0) return;
    var from = mode === 'upto' ? 0 : at, to = at;
    if(mode === 'season'){
      while(from > 0 && list[from - 1].sn === list[at].sn) from--;
      while(to < list.length - 1 && list[to + 1].sn === list[at].sn) to++;
    }
    for(var j = from; j <= to; j++){ Watched.set('e' + list[j].e.id, true); delete S.resume[String(list[j].e.id)]; }
    saveResume();
    // Weiterschauen auf die Folge danach stellen - wenn die Markierung den Stand erreicht oder überholt
    var rec = S.resumeSeries && S.resumeSeries[sid], recAt = -1;
    if(rec) for(var r = 0; r < list.length; r++) if(String(list[r].e.id) === String(rec.episode_id)){ recAt = r; break; }
    if(!rec || recAt <= to){
      var last = list[to];
      S.resumeSeries[sid] = { series_id: sid, episode_id: last.e.id, episode_num: last.e.episode_num || (last.ei + 1), season_num: last.sn,
        ep_idx: last.ei, season_idx: last.si, name: (rec && rec.name) || s.name || '', cover: (rec && rec.cover) || s.cover || s.stream_icon || '',
        dur: 1, pos: 1, ts: (rec && rec.ts) || Date.now() };
      await _csAdvanceFinished(S.resumeSeries);   // rückt auf die nächste Folge vor bzw. markiert die Serie als gesehen
    }
    showToast(mode === 'one' ? 'Als gesehen markiert' : mode === 'season' ? 'Staffel als gesehen markiert' : 'Bis hier als gesehen markiert', 1500);
  }
};

// Fernbedienung: OK kurz = wie bisher, OK gehalten = Optionen. Die kurze Aktion läuft
// beim Loslassen; kommt keine keyup (manche Geräte), nach der Wartezeit ohne Wiederholung.
var _lp = { down: false, fired: false, rep: false, timer: null, pass: false };
function _lpShortOk(){
  var ev = document.createEvent('Event'); ev.initEvent('keydown', true, true);
  ev.keyCode = 13; ev.which = 13;
  _lp.pass = true; try { window.dispatchEvent(ev); } finally { _lp.pass = false; }
}
window.addEventListener('keydown', function(e){
  var k = e.keyCode;
  if(CtxMenu.isOpen()){
    e.preventDefault(); e.stopImmediatePropagation();
    if(k === 38) CtxMenu.move(-1);
    else if(k === 40) CtxMenu.move(1);
    else if(k === 13 && !e.repeat && !_lp.down){ var f = SpatialNav.focused; if(f && f.classList.contains('xc-ctx-item')) CtxMenu.run(+f.getAttribute('data-i')); }
    else if(k === KEYS.ESC || k === KEYS.BKSP || k === KEYS.BACK || k === KEYS.BACK2){ if(k === KEYS.BACK || k === KEYS.BACK2) S._backConsumed = true; CtxMenu.close(); }
    return;
  }
  if(k !== 13 || _lp.pass) return;
  if(_lp.down){ e.preventDefault(); e.stopImmediatePropagation(); _lp.rep = true; return; }   // Wiederholung beim Halten
  var t = CtxMenu.fromFocus(); if(!t) return;
  e.preventDefault(); e.stopImmediatePropagation();
  _lp.down = true; _lp.fired = false; _lp.rep = !!e.repeat;
  clearTimeout(_lp.timer);
  _lp.timer = setTimeout(function(){
    if(!_lp.down) return;
    _lp.fired = true;
    if(_lp.rep) CtxMenu.open(CtxMenu.fromFocus() || t);
    else { _lp.down = false; _lpShortOk(); }   // keine Wiederholung und kein Loslassen: normales OK
  }, 600);
}, true);
window.addEventListener('keyup', function(e){
  if(e.keyCode !== 13) return;
  if(CtxMenu.isOpen() && _lp.down){ _lp.down = false; e.preventDefault(); e.stopImmediatePropagation(); return; }   // Loslassen nach dem Öffnen
  if(!_lp.down) return;
  _lp.down = false; clearTimeout(_lp.timer);
  e.preventDefault(); e.stopImmediatePropagation();
  if(!_lp.fired) _lpShortOk();
}, true);

// Touch: lang antippen öffnet die Optionen (der folgende Klick wird geschluckt)
(function(){
  var lt = null, swallowUntil = 0;
  var SEL = '.nf-card,.grid-item-wrap,.ep-item,.cs-card,.nfs-card';
  document.addEventListener('touchstart', function(e){
    lt = null;
    if(e.touches.length !== 1 || CtxMenu.isOpen()) return;
    var el = e.target.closest && e.target.closest(SEL); if(!el || !CtxMenu.fromEl(el)) return;
    var t0 = e.touches[0], my = { x: t0.clientX, y: t0.clientY, fired: false };
    my.timer = setTimeout(function(){
      if(lt !== my) return;
      my.fired = true; swallowUntil = Date.now() + 800;
      try { if(navigator.vibrate) navigator.vibrate(15); } catch(err){}
      CtxMenu.open(CtxMenu.fromEl(el));
    }, 550);
    lt = my;
  }, { capture: true, passive: true });
  document.addEventListener('touchmove', function(e){
    if(!lt || lt.fired) return;
    var t0 = e.touches[0];
    if(Math.abs(t0.clientX - lt.x) > 12 || Math.abs(t0.clientY - lt.y) > 12){ clearTimeout(lt.timer); lt = null; }
  }, { capture: true, passive: true });
  document.addEventListener('touchend', function(e){
    if(!lt) return;
    clearTimeout(lt.timer);
    if(lt.fired && e.cancelable) e.preventDefault();
    lt = null;
  }, { capture: true, passive: false });
  document.addEventListener('touchcancel', function(){ if(lt){ clearTimeout(lt.timer); lt = null; } }, true);
  document.addEventListener('click', function(e){
    if(Date.now() < swallowUntil && !(e.target.closest && e.target.closest('#xc-ctx'))){ e.preventDefault(); e.stopImmediatePropagation(); swallowUntil = 0; }
  }, true);
  document.addEventListener('contextmenu', function(e){ if(e.target.closest && e.target.closest(SEL)) e.preventDefault(); }, true);
})();
