// ── VARIANTEN (Duplikate) ────────────────────────────────────────
function _baseName(name){
  var s = (name||'').toLowerCase().trim();
  // Schritt 0: Abschließende Sonderzeichen wie * + ° etc. entfernen
  s = s.replace(/[\s*+°•·]+$/, '').trim();
  // Schritt 1: Inhalt in Klammern am Ende entfernen: (BK), (backup), (HEVC) etc.
  s = s.replace(/\s*\([^)]*\)\s*$/g, '').trim();
  // Schritt 2: Bekannte Suffix-Wörter iterativ entfernen (wiederholen, bis stabil)
  var QUALITY  = /\s+(fhd|uhd|4k|2k|hd|sd|1080p?|720p?|480p?|1080|720|576)[*+]?$/i;
  var CODEC    = /\s+(hevc|h\.?265|h\.?264|avc|av1|mpeg2)[*+]?$/i;
  var EXTRAS   = /\s+(ultra|feed|backup|bk|alt|multi|ppv|plus|premium|platinum|gold)[*+]?$/i;
  var prev;
  var stripped = false;
  for(var pass=0; pass<6; pass++){
    prev = s;
    s = s.replace(QUALITY,'').trim();
    s = s.replace(CODEC,'').trim();
    s = s.replace(EXTRAS,'').trim();
    // Trailing-Nummer nur entfernen, wenn in diesem Durchlauf etwas entfernt wurde
    if(s !== prev){ stripped = true; s = s.replace(/\s+\d+$/, '').trim(); }
  }
  return s.trim();
}

function buildVariants(stream){
  var base=_baseName(stream.name);
  S.variants=[];
  for(var i=0;i<S.streams.length;i++){
    if(_baseName(S.streams[i].name)===base)
      S.variants.push({stream:S.streams[i]});
  }
  S.variantIdx=0;
  for(var j=0;j<S.variants.length;j++){
    if(S.variants[j].stream.stream_id===stream.stream_id){ S.variantIdx=j; break; }
  }
}
function openVariantBar(){
  if(S.variants.length<2){ showToast('Keine Duplikate verfügbar',2000); return; }
  S.variantBarOpen=true;
  $('vbar-label').textContent='Duplikate';
  renderVariantChips(); Player.showControls(); resetVariantTimer();
}
function closeVariantBar(){
  S.variantBarOpen=false; clearTimeout(S.variantTimer);
}
function renderVariantChips(){
  var html='';
  for(var i=0;i<S.variants.length;i++){
    var isFoc=i===S.variantIdx, isCur=S.variants[i].stream.stream_id===S.currentStream.stream_id;
    var cls='vchip'+(isFoc?' v-focused':'')+(isCur&&!isFoc?' v-current':'');
    html+='<div class="'+cls+'" data-vi="'+i+'">'+esc(S.variants[i].stream.name)+'</div>';
  }
  $('vbar-chips').innerHTML=html;
  $('vbar-chips').querySelectorAll('.vchip').forEach(function(chip){
    chip.addEventListener('click',function(){
      S.variantIdx=parseInt(chip.getAttribute('data-vi')); switchVariant(S.variantIdx);
    });
  });
}
function switchVariant(idx){
  var v=S.variants[idx]; if(!v) return;
  closeVariantBar(); 
  var foundIdx = S.filteredStreams.indexOf(v.stream);
  if(foundIdx !== -1) S.currentStreamIdx = foundIdx;
  Player.play(API.liveUrl(v.stream),v.stream,'live');
}
function resetVariantTimer(){
  clearTimeout(S.variantTimer);
  S.variantTimer=setTimeout(function(){ closeVariantBar(); }, CONFIG.VARIANT_TIMEOUT_MS);
}