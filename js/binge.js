// ── BINGE MODUS ──────────────────────────────────────────────────
var BingeMode = {
  _timer: null,
  _remaining: 8,
  _active: false,
  _rafId: null,
  _startTs: 0,
  _totalMs: 8000,

  start: function(){
    if(S.playerType !== 'series') return;
    var nextIdx = S.currentEpIdx + 1;
    if(nextIdx >= S.currentEpsArray.length) return; // No next ep
    var nextEp = S.currentEpsArray[nextIdx];
    var epName = nextEp.title || ('Episode ' + (nextEp.episode_num || nextIdx+1));
    var sTitle = $('s-title') ? $('s-title').textContent : '';
    $('binge-ep-name').textContent = sTitle + ' · ' + epName;
    this._active = true;
    this._remaining = 8;
    this._startTs = Date.now();
    $('binge-countdown').textContent = '8';
    $('binge-prog-fill').style.width = '100%';
    $('binge-bar').classList.add('show');
    
    S.focusArea = 'binge';
    setTimeout(function(){ if(typeof SpatialNav !== 'undefined') SpatialNav.focusBySelector('#binge-skip'); }, 50);

    this._tick();
  },

  _tick: function(){
    if(!this._active) return;
    var elapsed = Date.now() - this._startTs;
    var rem = Math.max(0, 8 - Math.floor(elapsed / 1000));
    var pct = Math.max(0, 100 - (elapsed / this._totalMs * 100));
    $('binge-countdown').textContent = rem;
    $('binge-prog-fill').style.width = pct.toFixed(1) + '%';
    if(elapsed >= this._totalMs){
      this.stop();
      Player.nextEp();
      return;
    }
    var self = this;
    this._rafId = requestAnimationFrame(function(){ self._tick(); });
  },

  stop: function(){
    this._active = false;
    cancelAnimationFrame(this._rafId);
    $('binge-bar').classList.remove('show');
  }
};

function bingeSkipNow(){ BingeMode.stop(); Player.nextEp(); }
function bingeStop(){ S._bingeCancelled = true; BingeMode.stop(); showToast('Autoplay gestoppt', 1500); }