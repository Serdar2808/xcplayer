// ════════════════════════════════════════════════════════════════
//  BOOTSPLASH — XC Player Pro
//  Cyan-Laser-Animation beim App-Start (4 Sekunden, dann Fade-Out)
//  Muss VOR allen anderen Scripts geladen werden, damit der Splash
//  sichtbar ist bevor die App initialisiert.
// ════════════════════════════════════════════════════════════════
(function(){

  var DURATION_MS = 2500;     // Kürzere Anzeigedauer, da statisch
  var FADE_OUT_MS = 600;      // Fade-Out Dauer am Ende

  // ── HTML+SVG Markup ───────────────────────────────────────────
  // WICHTIG: Alle animierten Pfade/Linien starten mit stroke-dasharray="9999"
  // und stroke-dashoffset="9999", damit sie BEIM ERSTEN PAINT bereits unsichtbar
  // sind. Sonst sieht man den fertig-gezeichneten Splash für 1-2 Frames als
  // statisches Bild, bevor die Animation startet.
  var HTML =
    '<svg id="bs-svg" viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid meet">' +
      '<defs>' +
        '<linearGradient id="bs-cool" x1="0%" y1="0%" x2="100%" y2="0%">' +
          '<stop offset="0%" stop-color="#1e3a8a"/>' +
          '<stop offset="100%" stop-color="#0e7490"/>' +
        '</linearGradient>' +
        '<linearGradient id="bs-accent" x1="0%" y1="0%" x2="100%" y2="0%">' +
          '<stop offset="0%" stop-color="#3b82f6" stop-opacity="0"/>' +
          '<stop offset="25%" stop-color="#3b82f6" stop-opacity="1"/>' +
          '<stop offset="75%" stop-color="#06b6d4" stop-opacity="1"/>' +
          '<stop offset="100%" stop-color="#06b6d4" stop-opacity="0"/>' +
        '</linearGradient>' +
        '<radialGradient id="bs-bgg" cx="50%" cy="50%" r="55%">' +
          '<stop offset="0%" stop-color="#22d3ee" stop-opacity="0.20"/>' +
          '<stop offset="100%" stop-color="#07090f" stop-opacity="0"/>' +
        '</radialGradient>' +
      '</defs>' +

      // Hintergrund-Glow (sofort sichtbar)
      '<rect id="bs-bgl" x="0" y="0" width="1920" height="1080" fill="url(#bs-bgg)" opacity="1"/>' +

      '<g id="bs-cools">' +
        '<path id="bs-c-x1" d="M 660 320 L 920 600" stroke="url(#bs-cool)" stroke-width="50" fill="none" stroke-linecap="round"/>' +
        '<path id="bs-c-x2" d="M 920 320 L 660 600" stroke="url(#bs-cool)" stroke-width="50" fill="none" stroke-linecap="round"/>' +
        '<path id="bs-c-c"  d="M 1217 370 A 140 140 0 1 0 1217 550" stroke="url(#bs-cool)" stroke-width="50" fill="none" stroke-linecap="round"/>' +
      '</g>' +

      // Akzent-Linien über und unter "PLAYER PRO" (sofort sichtbar)
      '<line id="bs-ln-top" x1="640" y1="735" x2="1280" y2="735" stroke="url(#bs-accent)" stroke-width="3" stroke-linecap="round"/>' +
      '<text id="bs-tx" x="960" y="820" text-anchor="middle" fill="url(#bs-cool)" font-family="Sora, system-ui, sans-serif" font-size="56" font-weight="600" letter-spacing="14" opacity="1">PLAYER PRO</text>' +
      '<line id="bs-ln-bot" x1="640" y1="865" x2="1280" y2="865" stroke="url(#bs-accent)" stroke-width="3" stroke-linecap="round"/>' +
    '</svg>';

  // ── DOM injection ─────────────────────────────────────────────
  function injectSplash(){
    if(document.getElementById('boot-splash')) return;
    var div = document.createElement('div');
    div.id = 'boot-splash';
    // Inline-Style als Fallback, falls CSS noch nicht geladen ist —
    // verhindert dass User-Inhalte (Profil-Screen, full-loader Spinner) durchblitzen
    div.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;background:#07090f;z-index:99999;display:flex;align-items:center;justify-content:center;overflow:hidden;pointer-events:none;';
    div.innerHTML = HTML;
    // Vor allem anderen einfügen (erstes Kind von <body>)
    if(document.body.firstChild){
      document.body.insertBefore(div, document.body.firstChild);
    } else {
      document.body.appendChild(div);
    }
  }

  // ── Helper ────────────────────────────────────────────────────
  function $(id){ return document.getElementById(id); }

  // ── Animation starten ─────────────────────────────────────────
  function play(){
    // Komplett-Fadeout des gesamten Splash
    setTimeout(function(){
      var sp = $('boot-splash');
      if(!sp) return;
      sp.style.transition = 'opacity ' + FADE_OUT_MS + 'ms ease-in';
      sp.style.opacity = 0;
      // Nach Fade-Out komplett aus dem DOM entfernen
      setTimeout(function(){
        if(sp && sp.parentNode) sp.parentNode.removeChild(sp);
      }, FADE_OUT_MS + 50);
    }, DURATION_MS);
  }

  // ── Initialisierung ───────────────────────────────────────────
  function start(){
    injectSplash();
    // Ein Frame warten, damit das SVG im DOM ist und getTotalLength funktioniert
    requestAnimationFrame(function(){
      requestAnimationFrame(play);
    });
  }

  // KRITISCH: Wenn document.body schon existiert (Script ist im body geladen),
  // sofort starten — nicht auf DOMContentLoaded warten. Sonst kann das init()-
  // Script darunter den full-loader Spinner zeigen, BEVOR der Splash injiziert ist.
  if(document.body){
    start();
  } else if(document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }

  // Optional global verfügbar machen (für manuellen Replay/Skip falls nötig)
  window.BootSplash = { start: start };

})();
