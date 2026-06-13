// ── GETEILTE KATEGORIEN (Zweispaltig) ─────────────────────────────
function renderChListSplitCats() {
  var opts = buildCatOpts();
  var html = '';
  for(var i=0; i<opts.length; i++) {
      var isCur = (i === S.chListCatIdx);
      var isFoc = (i === S.chListSplitCatCursor);
      var cls = 'clo-split-cat';
      if(isCur) cls += ' clo-active';
      if(isFoc && S.chListFocusArea === 'cats') cls += ' clo-focused';
      html += '<div class="'+cls+'" id="clsc-'+i+'">' + esc(opts[i].name) + '</div>';
  }
  $('clo-left-pane').innerHTML = html;
  _scrollSplitCatIntoView();
}

function _scrollSplitCatIntoView() {
  var container = $('clo-left-pane');
  var el = $('clsc-' + S.chListSplitCatCursor);
  if(!container || !el) return;
  var elRect = el.getBoundingClientRect(), cRect = container.getBoundingClientRect();
  var relTop = elRect.top - cRect.top + container.scrollTop, relBot = relTop + el.offsetHeight + 14;
  var cTop = container.scrollTop, cBot = container.scrollTop + container.clientHeight;
  if(relTop < cTop) container.scrollTop = relTop - 14;
  else if(relBot > cBot) container.scrollTop = relBot - container.clientHeight + 14;
}

function _updateSplitCatFocus() {
  var els = document.querySelectorAll('.clo-split-cat');
  for(var i=0; i<els.length; i++) {
      els[i].classList.remove('clo-focused');
      if(i === S.chListSplitCatCursor && S.chListFocusArea === 'cats') els[i].classList.add('clo-focused');
  }
    var ov = document.getElementById('ch-list-overlay');
    if(ov) ov.classList.toggle('focus-cats', S.chListFocusArea === 'cats');
  _updateVlistFocus(); // Focus in der Liste drüben entfernen
  _scrollSplitCatIntoView();
}

function chListCatSplitMove(dir) {
  var opts = buildCatOpts();
  var next = S.chListSplitCatCursor + dir;
  if(next < 0) next = opts.length - 1;
  if(next >= opts.length) next = 0;
  S.chListSplitCatCursor = next;
  S.chListCatIdx = next;
  chListCatChange(0); // Load streams
  S.chListFocusArea = 'cats'; // Keep focus on cats
  renderChListSplitCats();
  _updateSplitCatFocus();
}

function chListCatSplitSelect() {
  S.chListFocusArea = 'streams';
  if(S.filteredStreams.length === 0) S.chListFocusArea = 'cats';
  _updateSplitCatFocus();
  _updateVlistFocus();
}

// ── SENDERLISTE ──────────────────────────────────────────────────
function chListMove(dir){
  var max = S.filteredStreams.length-1;
  var newCursor = Math.max(0, Math.min(max, S.chListCursor+dir));
  if(newCursor === S.chListCursor) return;
  S.chListCursor = newCursor;

  var oldOffset = S_CLO_OFFSET;
  if(S.chListCursor < S_CLO_OFFSET) S_CLO_OFFSET = S.chListCursor;
  if(S.chListCursor >= S_CLO_OFFSET + VLIST_ROWS) S_CLO_OFFSET = S.chListCursor - VLIST_ROWS + 1;

  // Offset changed = window scrolled → full row update
  // Offset same = cursor moved within visible window → only update focus classes
  if(S_CLO_OFFSET !== oldOffset) _updateVlistRows();
  else _updateVlistFocus();
}
function chListSelect(){
  var s=S.filteredStreams[S.chListCursor]; if(!s) return;
  S.currentStreamIdx=S.chListCursor;
  S.chListOpen=false;
  saveLastStream(s);
  Player.play(API.liveUrl(s),s,'live');
}

// ── KATEGORIEN-ANSICHT (GRÜN) in Senderliste ──────────────────────
function chListCatViewOpen(){
  S.chListCatView = true;
  S.chListCatViewCursor = Math.max(0, S.chListCatIdx);
  $('ch-list-overlay').classList.add('cat-view');
  renderChListCatView();
}
function chListCatViewClose(){
  S.chListCatView = false;
  $('ch-list-overlay').classList.remove('cat-view');
  // Back to channel view — ensure list is properly rendered
  initChListOverlay();
  renderChListOverlay();
}
function chListCatViewMove(dir){
  var opts = buildCatOpts();
  var max = opts.length - 1;
  var next = Math.max(0, Math.min(max, S.chListCatViewCursor + dir));
  if(next === S.chListCatViewCursor) return;
  S.chListCatViewCursor = next;
  renderChListCatView();
}
function chListCatViewSelect(){
  S.chListCatIdx = S.chListCatViewCursor;
  S.chListCatView = false;
  $('ch-list-overlay').classList.remove('cat-view');
  // Rebuild channel list DOM and load streams for selected category
  S.chListCursor = 0;
  S_CLO_OFFSET = 0;
  initChListOverlay();
  chListCatChange(0); // Load category streams
}
function renderChListCatView(){
  var opts = buildCatOpts();
  var list = $('clo-list');
  var html = '';
  for(var i=0; i<opts.length; i++){
    var isSel = i === S.chListCatViewCursor;
    var isCur = i === S.chListCatIdx;
    var icon = opts[i].id === 'fav' ? '&#x2B50;' : (opts[i].id === null ? '&#x1F4FA;' : '&#x1F4C2;');
    // Sender in dieser Kategorie zählen
    var count = 0;
    if(S.streams && S.streams.length){
      if(opts[i].id === null) count = S.streams.length;
      else if(opts[i].id === 'fav') count = S.favs.live.length;
      else { for(var j=0; j<S.streams.length; j++) if(String(S.streams[j].category_id) === String(opts[i].id)) count++; }
    }
    html += '<div class="clo-cat-row'+(isSel?' clo-focused':'')+(isCur?' clo-active':'')+'">'
          + '<div class="clo-cat-icon">'+icon+'</div>'
          + '<div class="clo-cat-name">'+esc(opts[i].name)+'</div>'
          + '<div class="clo-cat-count">'+count+'</div>'
          + '</div>';
  }
  list.innerHTML = html;
  // Ausgewähltes in den sichtbaren Bereich scrollen
  var selEl = list.children[S.chListCatViewCursor];
  if(selEl) selEl.scrollIntoView({block:'nearest'});
  // Update category header
  $('clo-group-name').textContent = 'Kategorien ('+opts.length+')';
}

async function chListCatChange(dir){
  var opts=buildCatOpts();
  if(dir !== 0){
    var newIdx = S.chListCatIdx + dir;
    if(newIdx < 0) newIdx = opts.length - 1;
    if(newIdx >= opts.length) newIdx = 0;
    S.chListCatIdx = newIdx;
  }
  var opt=opts[S.chListCatIdx];
  $('clo-group-name').textContent = (opts[S.chListCatIdx]?opts[S.chListCatIdx].name:'Laden');
  try{
    var arr = S.streams || [];
    if(opt && opt.id === 'fav') {
      arr = arr.filter(function(s){ return S.favs.live.indexOf(s.stream_id)!==-1; });
    } else if (opt && opt.id !== null) {
      arr = arr.filter(function(s){ return String(s.category_id) === String(opt.id); });
    }
    S.filteredStreams = applyVariantGrouping(arr);
    S.chListCursor=0;
    if(S.currentStream){
      var baseCur = _baseName(S.currentStream.name);
      for(var i=0;i<S.filteredStreams.length;i++){
        if(S.filteredStreams[i].stream_id===S.currentStream.stream_id){ S.chListCursor=i; break; }
        if(Settings.groupVariants && _baseName(S.filteredStreams[i].name)===baseCur) { S.chListCursor=i; break; }
      }
    }
            S_CLO_OFFSET = Math.max(0, S.chListCursor - Math.floor(VLIST_ROWS/2));
    renderChListOverlay();
    if(Settings.splitList) renderChListSplitCats(); // Refresh active status
  }catch(e){ Logger.warn('[chListCatChange] error:', e.message); showToast('Fehler beim Laden'); }
}

function buildCatOpts(){
  var opts=[{id:null,name:'Alle'}];
  for(var i=0;i<S.categories.length;i++) opts.push({id:S.categories[i].category_id,name:S.categories[i].category_name});
  opts.push({id:'fav',name:'Favoriten'});
  return opts;
}

// ── SENDERNUMMER OSD ──────────────────────────────────────────────
function handleChNum(digit){
  S.chNumBuf+=digit; $('ch-osd-num').textContent=S.chNumBuf; $('ch-osd').classList.add('show');
  clearTimeout(S.chNumTimer);
  S.chNumTimer=setTimeout(function(){
    jumpToChNum(parseInt(S.chNumBuf)); S.chNumBuf=''; $('ch-osd').classList.remove('show');
  }, CONFIG.CH_NUM_TIMEOUT);
}
function jumpToChNum(num){
  var idx=num-1;
  if(idx>=0&&idx<S.filteredStreams.length){
    if(S.playerVisible&&S.playerType==='live'){
      S.currentStreamIdx=idx; Player.play(API.liveUrl(S.filteredStreams[idx]),S.filteredStreams[idx],'live');
    } else { S.cursors.grid=idx; S.focusArea='grid'; updateFocus(); }
  } else showToast('Kanal '+num+' nicht gefunden');
}