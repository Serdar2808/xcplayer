// ── ABRUFEN MIT NEUVERSUCH ───────────────────────────────────────
async function fetchWithRetry(url, timeout, retries){
  timeout = timeout || CONFIG.FETCH_TIMEOUT;
  retries = retries === undefined ? CONFIG.FETCH_RETRIES : retries;
  var lastErr;
  for(var i=0;i<=retries;i++){
    var controller = window.AbortController ? new AbortController() : null;
    var signal = controller ? controller.signal : undefined;
    var timer = setTimeout(function(){ if(controller) controller.abort(); }, timeout);
    try{
      var r = await fetch(url, {cache:'no-store', signal:signal});
      clearTimeout(timer);
      if(!r.ok) throw new Error('HTTP '+r.status);
      return r;
    }catch(e){
      clearTimeout(timer);
      lastErr=e;
      Logger.warn('[Fetch] Attempt '+(i+1)+' failed for:', url.substring(0,80), e.message);
      if(i<retries) await new Promise(function(res){ setTimeout(res, 1000*(i+1)); });
    }
  }
  throw lastErr;
}

// ── DATEN MANAGER (RAM -> DB -> API) ──────────────────────────────
async function getOrFetchData(type, tab) {
  var memCache = type === 'cats' ? S.rawCategories : S.rawStreams;
  
  // 1. RAM prüfen (Sofort) — nur nutzen, wenn nicht leer
  if (memCache[tab] && memCache[tab].length > 0) return memCache[tab];
  
  if (S.isM3U) {
    if (type === 'cats') return tab === 'live' ? S.m3uCategories : [];
    if (type === 'streams') return tab === 'live' ? S.m3uStreams : [];
    return [];
  }

  var p = Profiles.getActive();
  var pId = p ? p.id : 'unknown';
  var dbKey = pId + '_' + type + '_' + tab;
  
  var dbData = await PlaylistDB.get(dbKey);
  if (dbData) {
    if (!Array.isArray(dbData) && typeof dbData === 'object') dbData = Object.values(dbData);
    if (Array.isArray(dbData) && dbData.length > 0) {
      memCache[tab] = dbData;
      return dbData;
    }
  }
  
  var freshData = [];
  try {
    if (type === 'cats') freshData = await (tab==='live' ? API.getLiveCats() : (tab==='vod' ? API.getVodCats() : API.getSeriesCats()));
    else freshData = await (tab==='live' ? API.getLive(null) : (tab==='vod' ? API.getVod(null) : API.getSeries(null)));
  } catch(e) {
    Logger.warn('[DataManager] API fetch error for', type, tab, ':', e.message);
    return [];
  }

  if (freshData && !Array.isArray(freshData) && typeof freshData === 'object') freshData = Object.values(freshData);
  if (Array.isArray(freshData) && freshData.length > 0) {
    memCache[tab] = freshData;
    PlaylistDB.set(dbKey, freshData);
    return freshData;
  }
  return [];
}

// ── API ZUGRIFF ───────────────────────────────────────────────────
var API = {
  _p:null,
  setProfile:function(p){ this._p=p; },
  base:function(){
    var p=this._p;
    return clean(p.host)+'/player_api.php?username='+encodeURIComponent(p.user)+'&password='+encodeURIComponent(p.pass);
  },
  call: async function(params){
    var url=this.base()+(params?'&'+params:'');
    var r = await fetchWithRetry(url);
    return r.json();
  },
  auth:function(){ return this.call(''); },
  getLiveCats:function(){
    if(S.isM3U) return Promise.resolve(S.m3uCategories);
    return this.call('action=get_live_categories');
  },
  getVodCats:function(){  return this.call('action=get_vod_categories'); },
  getSeriesCats:function(){ return this.call('action=get_series_categories'); },
  getLive:function(c){
    if(S.isM3U){
      var arr=S.m3uStreams;
      if(c&&c!=='fav') arr=arr.filter(function(s){ return s.category_id===c; });
      return Promise.resolve(arr);
    }
    return this.call(c&&c!=='fav'?'action=get_live_streams&category_id='+c:'action=get_live_streams');
  },
  getVod:function(c){  return this.call(c&&c!=='fav'?'action=get_vod_streams&category_id='+c:'action=get_vod_streams'); },
  getSeries:function(c){ return this.call(c&&c!=='fav'?'action=get_series&category_id='+c:'action=get_series'); },
  getSeriesInfo:function(id){ return this.call('action=get_series_info&series_id='+id); },
  liveUrl:function(s){
    if(S.isM3U&&s.url) return s.url;
    var p=this._p;
    return clean(p.host)+'/live/'+p.user+'/'+p.pass+'/'+s.stream_id+(Settings.nativePlayer ? '.ts' : '.m3u8');
  },
  vodUrl:function(s){
    var p=this._p;
    return clean(p.host)+'/movie/'+p.user+'/'+p.pass+'/'+s.stream_id+'.'+(s.container_extension||'mp4');
  },
  epUrl:function(ep){
    var p=this._p;
    return clean(p.host)+'/series/'+p.user+'/'+p.pass+'/'+ep.id+'.'+(ep.container_extension||'mp4');
  },
  catchupUrl:function(s, startTs, durationMin){
    var p=this._p;
    var ext = Settings.nativePlayer ? '.ts' : '.m3u8';
    return clean(p.host)+'/timeshift/'+p.user+'/'+p.pass+'/'+durationMin+'/'+startTs+'/'+s.stream_id+ext;
  },
  streamUrl:function(s){ return S.tab==='live'?this.liveUrl(s):this.vodUrl(s); }
};

// ── M3U PARSER ────────────────────────────────────────────────────
function parseM3U(text){
  var lines=text.split(/\r?\n/), streams=[], categories=[], catMap={}, catId=0;
  var stream=null;
  for(var i=0;i<lines.length;i++){
    var l=lines[i].trim();
    if(!l) continue;
    if(l.startsWith('#EXTINF')){
      stream={};
      var tvgId=l.match(/tvg-id="([^"]*)"/); stream.epg_channel_id=tvgId?tvgId[1]:'';
      var tvgName=l.match(/tvg-name="([^"]*)"/);
      var tvgLogo=l.match(/tvg-logo="([^"]*)"/); stream.stream_icon=tvgLogo?tvgLogo[1]:'';
      var grp=l.match(/group-title="([^"]*)"/); var grpName=grp?grp[1]:'Unbekannt';
      if(!catMap[grpName]){
        catId++; catMap[grpName]=String(catId);
        categories.push({category_id:String(catId),category_name:grpName,parent_id:0});
      }
      stream.category_id=catMap[grpName];
      var comma=l.lastIndexOf(','); stream.name=comma>=0?l.slice(comma+1).trim():(tvgName?tvgName[1]:'Sender');
      stream.stream_id='m3u_'+i;
      stream.stream_type='live';
    } else if(stream && !l.startsWith('#')){
      stream.url=l; streams.push(stream); stream=null;
    }
  }
  return{streams:streams,categories:categories};
}