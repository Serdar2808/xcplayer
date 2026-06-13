// ── HILFSFUNKTIONEN ───────────────────────────────────────────────
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function clean(h){ return (h||'').replace(/\/+$/,''); }

function b64dec(s){
  if(!s) return '';
  if(/^[A-Za-z0-9+\/]+=*$/.test(s) && s.length > 4){
    try{
      var dec = atob(s);
      try{ return decodeURIComponent(escape(dec)); }catch(e2){ return dec; }
    }catch(e){ return s; }
  }
  return s;
}

function getTs(e, field){
  var shiftSec = (Settings.epgShift || 0) * 3600;
  if(e[field+'_timestamp']) return parseInt(e[field+'_timestamp']) + shiftSec;
  var s = e[field];
  if(!s) return 0;
  if(!isNaN(s)) return parseInt(s) + shiftSec;
  try{
    // Sicheres Parsing für veraltete TV-Browser
    var safeStr = s.replace(' ', 'T');
    if (safeStr.indexOf('Z') === -1 && safeStr.indexOf('+') === -1 && safeStr.indexOf('-') === -1) {
      safeStr += 'Z'; // Erzwinge UTC, wenn keine Zeitzone im EPG angegeben ist
    }
    var d = new Date(safeStr);
    if(!isNaN(d.getTime())) return Math.floor(d.getTime()/1000) + shiftSec;
  }catch(ex){ }
  return 0;
}

function fmtTimeMs(date){ return date ? date.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}) : ''; }
function fmtTime(ts){ return ts ? new Date(ts*1000).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}) : ''; }
function fmtDur(s){
  if(!s||isNaN(s)) return '0:00';
  s=Math.max(0,Math.floor(s));
  var h=Math.floor(s/3600),m=Math.floor((s%3600)/60),sec=s%60;
  if(h>0) return h+':'+pad(m)+':'+pad(sec);
  return m+':'+pad(sec);
}
function pad(n){ return n<10?'0'+n:String(n); }
function fmtClock(){ return new Date().toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'}); }
function fmtDateClock(){
  var d=new Date();
  var t=d.toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});
  return d.toLocaleDateString('de-DE',{weekday:'short',day:'numeric',month:'short'}).replace(',','') + ' \u2022 ' + t;
}
function showToast(msg,dur){
  var t=$('toast'); t.textContent=msg; t.classList.add('show');
  clearTimeout(t._t); t._t=setTimeout(function(){ t.classList.remove('show'); }, dur || CONFIG.TOAST_DEFAULT_MS);
}
function showFullLoader(msg, subMsg){ var fl = $('full-loader'); $('fl-msg').textContent = msg || 'Bitte warten...'; $('fl-sub').textContent = subMsg || ''; $('fl-sub').style.display = subMsg ? 'block' : 'none'; fl.classList.add('show'); }
function hideFullLoader(){ $('full-loader').classList.remove('show'); }
function _logoErr(el){ if(el.src) _failedImgs[el.src] = true; el.style.display='none'; var ph=el.nextElementSibling; if(ph) ph.style.display='flex'; }
function _posterErr(el){ if(el.src) _failedImgs[el.src] = true; el.parentNode.innerHTML='<div class="poster-ph"><span class="phi">&#x1F3AC;</span></div>'; }
