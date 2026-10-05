// ── ZAPPING HISTORIE ─────────────────────────────────────────────
var ZapHistory = {
  _list: [],
  _maxLen: 5,
  _osdTimer: null,
  _cursor: 0,   // which history item is selected
  _osdOpen: false,

  add: function(stream){
    if(!stream || !stream.stream_id) return;
    this._list = this._list.filter(function(s){ return s.stream_id !== stream.stream_id; });
    this._list.unshift(stream);
    if(this._list.length > this._maxLen) this._list.pop();
  },

  // Taste 0: Liste der letzten Sender öffnen (vorheriger Sender vorgewählt) statt
  // sofort umzuschalten - gewählt wird mit hoch/runter und OK. Nochmal 0 = nächster Eintrag.
  open: function(){
    if(this._osdOpen){ this._cursor = (this._cursor + 1) % this._list.length; this._render(); this._restartTimer(); return; }
    if(S.currentStream && S.currentStream.stream_id){
      this._list = this._list.filter(function(s){ return s.stream_id !== S.currentStream.stream_id; });
      this._list.unshift(S.currentStream);
      if(this._list.length > this._maxLen) this._list.pop();
    }
    if(this._list.length < 2){ showToast('Kein vorheriger Sender', 1500); return; }
    this._osdOpen = true;
    this._cursor = 1;
    this._render();
    var osd = $('zap-history-osd');
    if(osd) osd.classList.add('show');
    this._restartTimer();
  },

  _restartTimer: function(){
    clearTimeout(this._osdTimer);
    var self = this;
    this._osdTimer = setTimeout(function(){ self.hideOsd(); }, 6000);
  },

  goBack: function(){
    // Sicherstellen, dass der aktuelle Stream in list[0] ist
    if(S.currentStream && S.currentStream.stream_id){
      if(this._list.length === 0 || this._list[0].stream_id !== S.currentStream.stream_id){
        this._list.unshift(S.currentStream);
        if(this._list.length > this._maxLen) this._list.pop();
      }
    }
    if(this._list.length < 2){
      showToast('Kein vorheriger Sender', 1500);
      return;
    }
    // Reiner Tausch zwischen Position 0 und 1
    var cur  = this._list[0];
    var prev = this._list[1];
    this._list[0] = prev;
    this._list[1] = cur;
    saveLastStream(prev);
    this._goBackInProgress = true;
    Player.play(API.liveUrl(prev), prev, 'live');
    this._goBackInProgress = false;
    var self = this;
    setTimeout(function(){ self.showOsd(); }, 200);
  },

  showOsd: function(){
    this._osdOpen = true;
    this._cursor = 0;
    this._render();
    var osd = $('zap-history-osd');
    if(osd) osd.classList.add('show');
    clearTimeout(this._osdTimer);
    var self = this;
    this._osdTimer = setTimeout(function(){ self.hideOsd(); }, 4000);
  },

  hideOsd: function(){
    this._osdOpen = false;
    var osd = $('zap-history-osd');
    if(osd) osd.classList.remove('show');
    clearTimeout(this._osdTimer);
  },

  moveUp: function(){
    if(this._cursor > 0){ this._cursor--; this._render(); }
    clearTimeout(this._osdTimer);
    var self = this;
    this._osdTimer = setTimeout(function(){ self.hideOsd(); }, 4000);
  },

  moveDown: function(){
    if(this._cursor < this._list.length - 1){ this._cursor++; this._render(); }
    clearTimeout(this._osdTimer);
    var self = this;
    this._osdTimer = setTimeout(function(){ self.hideOsd(); }, 4000);
  },

  select: function(){
    var s = this._list[this._cursor];
    if(!s) return;
    this.hideOsd();
    if(this._cursor === 0 && S.currentStream && s.stream_id === S.currentStream.stream_id) return;   // läuft schon
    // Ausgewähltes nach vorne verschieben
    this._list.splice(this._cursor, 1);
    this._list.unshift(s);
    saveLastStream(s);
    Player.play(API.liveUrl(s), s, 'live');
  },

  _render: function(){
    var osd = $('zap-history-osd');
    if(!osd) return;
    var html = '';
    for(var i = 0; i < this._list.length; i++){
      var s = this._list[i];
      var isCur = (i === this._cursor);
      var logo = s.stream_icon
        ? '<img class="zh-logo" src="'+esc(s.stream_icon)+'" onerror="this.style.display=\'none\'">'
        : '<div class="zh-logo-ph">&#x1F4E1;</div>';
      html += '<div class="zh-item'+(isCur?' zh-current':'')+'" data-zh="'+i+'">'
        + logo + '<div class="zh-name">'+esc(s.name||'')+'</div>'
        + (i === 0 && S.currentStream && s.stream_id === S.currentStream.stream_id ? '<div class="zh-now">läuft</div>' : '')
        + (isCur ? '<div style="color:var(--accent);font-size:18px;flex-shrink:0">&#x25B6;</div>' : '')
        + '</div>';
    }
    var list = $('zh-list');
    list.innerHTML = html;
    // Antippen/Klicken (Handy, Magic Remote) wählt direkt
    if(!list._zhClick){
      list._zhClick = true;
      list.addEventListener('click', function(e){
        var it = e.target.closest && e.target.closest('[data-zh]'); if(!it) return;
        e.preventDefault(); e.stopPropagation();
        ZapHistory._cursor = parseInt(it.getAttribute('data-zh'), 10);
        ZapHistory.select();
      });
    }
  }
};