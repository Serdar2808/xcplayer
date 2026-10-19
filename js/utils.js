// ── HILFSFUNKTIONEN ───────────────────────────────────────────────
function $(id){ return document.getElementById(id); }
function esc(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
// ── BEWEGUNG: eine Dauer und Kurve für alle Übergänge ────────────
// Scrollen per JS (statt scroll-behavior:smooth mit browsereigenem Tempo) und
// am Listenende ein kurzes Federn statt Endlosschleife oder starrem Stopp
var Motion = {
  DUR: 250,
  CSS: '.25s cubic-bezier(.33,1,.68,1)',          // gleiche Kurve wie _ease (easeOutCubic)
  _ease: function(t){ return 1 - Math.pow(1 - t, 3); },
  _off: function(){ return document.documentElement.classList.contains('reduce-motion'); },
  // Weich scrollen; top/left null = unverändert
  scroll: function(el, top, left, instant){
    if(!el) return;
    var st = el.scrollTop, sl = el.scrollLeft;
    if(top == null) top = st; if(left == null) left = sl;
    top = Math.max(0, Math.min(el.scrollHeight - el.clientHeight, Math.round(top)));
    left = Math.max(0, Math.min(el.scrollWidth - el.clientWidth, Math.round(left)));
    if(el._mAnim){ cancelAnimationFrame(el._mAnim); el._mAnim = null; }
    el._mTo = top;
    if(instant || this._off() || (Math.abs(top - st) < 1 && Math.abs(left - sl) < 1)){ el.scrollTop = top; el.scrollLeft = left; return; }
    var t0 = null, d = this.DUR, ease = this._ease;
    function step(ts){
      if(t0 === null) t0 = ts;
      var p = Math.min(1, (ts - t0) / d), e = ease(p);
      el.scrollTop = st + (top - st) * e; el.scrollLeft = sl + (left - sl) * e;
      el._mAnim = p < 1 ? requestAnimationFrame(step) : null;
    }
    el._mAnim = requestAnimationFrame(step);
  },
  // Am Ende einer Liste: Inhalt federt kurz gegen die Richtung (dir: l/r/u/d)
  // Fokus kam nicht weiter (Ende einer Liste): den umgebenden Bereich federn lassen
  bumpAt: function(el, dir){
    if(!el || !el.closest) return;
    this.bump(el.closest('#st-content, #st-rail, #episode-list, .cs-track, #continue-screen, .nf-search-results, #sys-sidebar, .modal-box, .pe-body') || el.parentNode, dir);
  },
  bump: function(el, dir){
    if(!el || this._off()) return;
    var c = 'xc-bump-' + dir;
    if(el.classList.contains(c)) return;            // gedrückt gehalten: nicht neu anstoßen
    el.classList.add(c);
    clearTimeout(el._bumpT);
    el._bumpT = setTimeout(function(){ el.classList.remove(c); }, 320);
  }
};
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

// Gehaltene Pfeiltaste erkennen (e.repeat fehlt auf alten TV-Browsern): solange
// keine keyup kam, ist jede weitere keydown derselben Taste eine Wiederholung.
// Damit läuft der Fokus beim Halten bis zum Rand und bleibt dort stehen, statt
// über die Kante ins Menü zu springen - dafür braucht es einen neuen Druck.
var _keyHeld = {};
window.addEventListener('keydown', function(e){
  var k = e.keyCode, now = Date.now();
  if(k < 37 || k > 40){ S._keyRepeat = false; return; }
  S._keyRepeat = !!(e.repeat || (_keyHeld[k] && now - _keyHeld[k] < 700));
  _keyHeld[k] = now;
}, true);
window.addEventListener('keyup', function(e){ delete _keyHeld[e.keyCode]; S._keyRepeat = false; }, true);
window.addEventListener('blur', function(){ _keyHeld = {}; S._keyRepeat = false; });

// Die App-Fläche (html/body) darf nie scrollen: scrollIntoView verschiebt trotz
// overflow:hidden auch body mit, danach war die Menüleiste oben abgeschnitten
document.addEventListener('scroll', function(e){
  var t = e.target, b = document.body, h = document.documentElement;
  if(t !== document && t !== b && t !== h) return;
  if(b.scrollTop || b.scrollLeft){ b.scrollTop = 0; b.scrollLeft = 0; }
  if(h.scrollTop || h.scrollLeft){ h.scrollTop = 0; h.scrollLeft = 0; }
}, true);
