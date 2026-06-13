// ── EPG LOGO FALLBACK ────────────────────────────────────────────
function getStreamLogoWithEpgFallback(stream){
  if(stream.stream_icon) return stream.stream_icon;
  if(EpgData.loaded && EpgData._channelMap){
    var epgId = (stream.epg_channel_id||'').toLowerCase().trim() || stream.name.toLowerCase().trim();
    var ch = EpgData._channelMap[epgId];
    if(ch && ch.icon) return ch.icon;
  }
  return '';
}

// ── XMLTV PARSER ─────────────────────────────────────────────────
function parseXmltvDate(str) {
  if (!str) return null;
  var m = str.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})\s*([+-]\d{4})?$/);
  if (!m) return null;
  var tz = m[7] ? m[7].slice(0,3)+':'+m[7].slice(3) : 'Z';
  try { return new Date(m[1]+'-'+m[2]+'-'+m[3]+'T'+m[4]+':'+m[5]+':'+m[6]+tz); } catch(e) { return null; }
}

function unescapeXml(str) {
  if(!str) return '';
  return str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'");
}

async function parseXMLTV(xmlStr) {
  var shiftMs = (Settings.epgShift || 0) * 3600000;
  var channels = {}, programmes = {};
  var nowMs = Date.now(), maxT = nowMs + CONFIG.EPG_RANGE_DAYS*86400000, minT = nowMs - CONFIG.EPG_RANGE_DAYS*86400000;

  Logger.info('[EPG] Starting non-blocking regex parsing...');

  var chRegex = /<channel\s+([^>]+)>([\s\S]*?)<\/channel>/gi;
  var match;
  var chCount = 0;
  while ((match = chRegex.exec(xmlStr)) !== null) {
    if (++chCount % 500 === 0) await new Promise(function(r){ setTimeout(r, 0); });
    var idMatch = /id="([^"]+)"/i.exec(match[1]);
    if (!idMatch) continue;
    var cid = idMatch[1].toLowerCase().trim();
    var inner = match[2];
    var nameMatch = /<display-name[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/display-name>/i.exec(inner);
    var iconMatch = /<icon\s+src="([^"]+)"/i.exec(inner);
    channels[cid] = {
      name: nameMatch ? unescapeXml(nameMatch[1].trim()) : cid,
      icon: iconMatch ? iconMatch[1] : ''
    };
  }

  var progRegex = /<programme\s+([^>]+)>([\s\S]*?)<\/programme>/gi;
  var progCount = 0;
  var skipped = 0;
  
  while ((match = progRegex.exec(xmlStr)) !== null) {
    if (++progCount % 1000 === 0) {
      await new Promise(function(r){ setTimeout(r, 0); });
    }
    var attrs = match[1];
    var inner = match[2];
    var startMatch = /start\s*=\s*"([^"]+)"/i.exec(attrs);
    var stopMatch = /stop\s*=\s*"([^"]+)"/i.exec(attrs);
    var chMatch = /channel\s*=\s*"([^"]+)"/i.exec(attrs);
    if (!startMatch || !stopMatch || !chMatch) continue;

    var start = parseXmltvDate(startMatch[1]);
    var stop = parseXmltvDate(stopMatch[1]);
    if (!start || !stop) continue;
    
    if (shiftMs !== 0) {
      start = new Date(start.getTime() + shiftMs);
      stop  = new Date(stop.getTime() + shiftMs);
    }
    if (stop.getTime() < minT || start.getTime() > maxT) { skipped++; continue; }

    var chId = chMatch[1].toLowerCase().trim();
    var tMatch = /<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/i.exec(inner);
    var dMatch = /<desc[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/desc>/i.exec(inner);
    var iMatch = /<icon\s+src="([^"]+)"/i.exec(inner);

    if (!programmes[chId]) programmes[chId] = [];
    programmes[chId].push({
      start: start, stop: stop,
      title: tMatch ? unescapeXml(tMatch[1].trim()) : '',
      description: dMatch ? unescapeXml(dMatch[1].trim()) : '',
      icon: iMatch ? iMatch[1] : ''
    });
  }

  Logger.info('[EPG] Done. Channels: ' + Object.keys(channels).length + ', with progs: ' + Object.keys(programmes).length + ', total progs processed: ' + progCount + ', skipped: ' + skipped);
  return {channels: channels, programmes: programmes};
}

// ── EPG DATEN SERVICE ────────────────────────────────────────────
var EpgData = {
  channels:{}, programmes:{}, loaded:false, _loading:false,
  _nameMap: null,

  load: async function() {
    if (this._loading) return;
    this._loading = true;
    var cached = await EPGStore.getXmltvData();
    if (cached) {
      this._deserializeFromDb(cached);
      this.loaded = true; this._loading = false;
      this._nameMap = null;
      Logger.info('[EPG] Loaded from cache, ' + Object.keys(this.channels).length + ' channels');
      showToast('EPG: ' + Object.keys(this.channels).length + ' Sender geladen (Intern)', 2500);
      if(typeof this._updatePlayerAfterLoad === 'function') this._updatePlayerAfterLoad();
      return;
    }
    this._loading = false;
    await this.refresh();
  },
  refresh: async function() {
    var url = CONFIG.API.EPG_XML_URL || "https://leppe-lager.duckdns.org/gewicht/epg-filtered.xml";
    showToast('Lade EPG vom Server…', 60000);
    try {
      var r = await fetchWithRetry(url, CONFIG.EPG_FETCH_TIMEOUT, 1);
      var text = await r.text();
      var result = await parseXMLTV(text);
      this.channels = result.channels; this.programmes = result.programmes; this.loaded = true;
      this._loading = false;
      this._nameMap = null;
      EPGStore.saveXmltvData(this._serializeForDb());
      var toastEl = document.getElementById('toast'); if(toastEl) toastEl.classList.remove('show');
      showToast('EPG: '+Object.keys(this.channels).length+' Sender geladen (Server)', 2500);
      if(typeof this._updatePlayerAfterLoad === 'function') this._updatePlayerAfterLoad();
    } catch(e) {
      Logger.warn('[EPG] Primäre Quelle fehlgeschlagen:', e.message);
      this._loading = false;
      var toastEl = document.getElementById('toast'); if(toastEl) toastEl.classList.remove('show');
      showToast('EPG Fehler — primäre Quelle nicht erreichbar', 3000);
    }
  },
  _serializeForDb: function() {
    var out = {channels: this.channels, programmes: {}};
    for (var id in this.programmes) {
      var progs = this.programmes[id];
      out.programmes[id] = [];
      for (var i=0; i<progs.length; i++) {
        out.programmes[id].push({
          startTs: progs[i].start.getTime(), stopTs: progs[i].stop.getTime(),
          title: progs[i].title, description: progs[i].description, icon: progs[i].icon
        });
      }
    }
    return out;
  },
  _deserializeFromDb: function(raw) {
    this.channels = raw.channels; this.programmes = {};
    for (var id in raw.programmes) {
      var progs = raw.programmes[id];
      this.programmes[id] = [];
      for (var i=0; i<progs.length; i++) {
        this.programmes[id].push({
          start: new Date(progs[i].startTs), stop: new Date(progs[i].stopTs),
          title: progs[i].title, description: progs[i].description, icon: progs[i].icon
        });
      }
    }
  },
  _buildNameMap: function(){
    this._nameMap = {};
    for(var id in this.channels){
      var name = this.channels[id].name || '';
      var cleaned = this._cleanName(name);
      if(cleaned && !this._nameMap[cleaned]) this._nameMap[cleaned] = id;
    }
  },
  _cleanName: function(name){
    var s = (name||'').toLowerCase().trim();
    s = s.replace(/[\s*+°]+$/, '').trim();
    s = s.replace(/\s*\([^)]*\)\s*$/g, '').trim();
    s = s.replace(/\s+(fhd|uhd|4k|2k|hd|sd|1080p?|720p?|480p?)[*+]?\s*$/i, '').trim();
    s = s.replace(/\s+(hevc|h\.?265|h\.?264|avc)[*+]?\s*$/i, '').trim();
    s = (s||'').replace(/^(?:\|\s*[A-Z]{2,5}\s*\||[A-Z]{2,5}\s*[:\|]|\[\s*[A-Z]{2,5}\s*\]|[A-Z]{2,3}\s*[-–]|\d{1,4}[\.\)])\s*/i,'').trim();
    s = s.replace(/[^a-z0-9äöüß]+/g, ' ').trim();
    return s;
  },
  findId: function(stream) {
    var tvgId = (stream.epg_channel_id || '').toLowerCase().trim();
    if (tvgId && this.programmes[tvgId]) return tvgId;
    var customEpg = (typeof Settings !== 'undefined' && Settings.customNames && Settings.customNames.epgs) ? Settings.customNames.epgs[String(stream.stream_id)] : '';
    if(customEpg){
      customEpg = customEpg.toLowerCase().trim();
      if(this.programmes[customEpg]) return customEpg;
    }
    if(!this._nameMap) this._buildNameMap();
    var cleaned = this._cleanName(stream.name);
    if(cleaned && this._nameMap[cleaned]) return this._nameMap[cleaned];
    return null;
  },
  getNow: function(stream) {
    var id = this.findId(stream); if (!id) return null;
    var progs = this.programmes[id]; if (!progs) return null;
    var now = Date.now();
    for(var i=0; i<progs.length; i++){
      var st = progs[i].start.getTime(), sp = progs[i].stop.getTime();
      if(st <= now && sp > now) return progs[i];
    }
    return null;
  },
  getNext: function(stream) {
    var id = this.findId(stream); if (!id) return null;
    var progs = this.programmes[id]; if (!progs) return null;
    var now = Date.now();
    for(var i=0; i<progs.length; i++){
      if(progs[i].start.getTime() > now) return progs[i];
    }
    return null;
  },
  getUpcoming: function(stream, count) {
    var id = this.findId(stream); if (!id) return [];
    var progs = this.programmes[id]; if (!progs) return [];
    var now = Date.now(), res = [];
    for (var i=0; i<progs.length && res.length<(count||5); i++) { if (progs[i].start.getTime()>now) res.push(progs[i]); }
    return res;
  },
  _updatePlayerAfterLoad: function(){
    if(typeof updateGridEpg === 'function') updateGridEpg();
    if(S.playerVisible && S.currentStream && S.playerType === 'live' && typeof Player !== 'undefined') {
      Player._startOsdClock();
      Player._renderOsdFromEpgData(S.currentStream);
      if(S.epgOpen) Player.renderEpgPanel(S.currentStream.stream_id);
      if(S.chListOpen && typeof renderChListOverlay === 'function') renderChListOverlay();
    }
  }
};

// ── EPG CACHE & HILFSFUNKTIONEN ──────────────────────────────────
function epgCachePut(streamId, listings) {
  S.epgCache[streamId] = listings;
  var keys = Object.keys(S.epgCache);
  if(keys.length > CONFIG.EPG_CACHE_MAX) {
    var toRemove = keys.length - CONFIG.EPG_CACHE_MAX;
    for(var i = 0; i < toRemove; i++) delete S.epgCache[keys[i]];
  }
}

function findCurrentEpg(streamId,now){
  var items=S.epgCache[streamId]; if(!items||!items.length) return null;
  for(var i=0;i<items.length;i++){
    var st=getTs(items[i],'start'), sp=getTs(items[i],'stop');
    if(st&&sp&&st<=now&&sp>now) return items[i];
  }
  return null;
}