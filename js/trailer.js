// ── TRAILER VORSCHAU (Poster-Vorschau nach 3s Hover) ─────────
var TrailerPreview = {
  _timer: null,
  _visible: false,
  _lastIdx: -1,
  _hideTimer: null,

  hover: function(stream, anchorEl){
    clearTimeout(this._timer);
    clearTimeout(this._hideTimer);
    var id = stream.stream_id || stream.series_id || -1;
    if(this._lastIdx === id && this._visible) return;
    var self = this;
    this._timer = setTimeout(function(){ self._show(stream, anchorEl); }, 3000);
  },

  _show: function(stream, anchorEl){
    var q = (stream.name || stream.title || '').trim();
    if(!q) return;

    var ov = $('trailer-overlay');
    var rect = anchorEl ? anchorEl.getBoundingClientRect() : {left:300,top:200,width:184,height:285};
    var w=280, h=170;
    var left = Math.min(rect.left + rect.width + 12, 1920-w-20);
    var top  = Math.max(20, Math.min(rect.top + (rect.height-h)/2, 1080-h-20));
    ov.style.left   = left + 'px';
    ov.style.top    = top  + 'px';
    ov.style.width  = w    + 'px';
    ov.style.height = h    + 'px';
    ov.style.position = 'fixed';

    var cover = stream.stream_icon || stream.cover || '';
    var bg = cover ? 'url('+esc(cover)+') center/cover no-repeat' : 'var(--bg2)';
    ov.innerHTML =
      '<div style="width:100%;height:100%;background:'+bg+';border-radius:10px;overflow:hidden;position:relative">'
      + '<div style="position:absolute;inset:0;background:linear-gradient(to top,rgba(0,0,0,.8) 0%,transparent 50%);display:flex;flex-direction:column;justify-content:flex-end;padding:12px;">'
      + '<div style="font-size:var(--fs-sm);font-weight:600;color:white;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">'+esc(q)+'</div>'
      + '<div style="font-size:11px;color:rgba(255,255,255,.55);">3s Vorschau — '+esc(stream.releaseDate||stream.year||'')+'</div>'
      + '</div>'
      + '</div>';

    ov.classList.add('show');
    this._visible = true;
    this._lastIdx = stream.stream_id || stream.series_id || -1;

    // Automatisches Ausblenden nach 4s
    var self = this;
    this._hideTimer = setTimeout(function(){ self.hide(); }, 4000);
  },

  hide: function(){
    clearTimeout(this._timer);
    clearTimeout(this._hideTimer);
    if(!this._visible) return;
    var ov = $('trailer-overlay');
    if(ov){ ov.classList.remove('show'); }
    this._visible = false;
    this._lastIdx = -1;
  }
};