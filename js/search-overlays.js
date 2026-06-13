document.getElementById('nf-search-overlay-container').innerHTML = `
<div id="nf-search-overlay" class="hidden">
  <div class="nf-search-modal">
    <input id="search-input-nf" type="text" placeholder="Filme und Serien suchen…" autocomplete="off" />
    <div class="nfs-hint" id="nfs-hint">Tippen zum Suchen · ↓ zu den Treffern · OK zum Abspielen · Zurück zum Schließen</div>
    <div class="nf-search-results" id="nf-search-results"></div>
  </div>
</div>
`;

document.getElementById('live-search-overlay-container').innerHTML = `
<div id="live-search-overlay" class="hidden">
  <div class="nf-search-modal">
    <input id="search-input-live" type="text" placeholder="Sender suchen…" autocomplete="off" />
    <div class="nfs-hint" id="lvs-hint">Tippen zum Suchen · ↓ zu den Treffern · OK zum Umschalten · Zurück zum Schließen</div>
    <div class="nf-search-results" id="live-search-results"></div>
  </div>
</div>
`;