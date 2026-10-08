document.getElementById('nf-search-overlay-container').innerHTML = `
<div id="nf-search-overlay" class="hidden">
  <div class="nf-search-modal">
    <div class="nfs-row"><button class="nfs-back" aria-label="Zurück" onclick="NFSearch.close()"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/></svg></button>
    <input id="search-input-nf" type="text" placeholder="Filme und Serien suchen…" autocomplete="off" /></div>
    <div class="nfs-hint" id="nfs-hint">Tippen zum Suchen · ↓ zu den Treffern · OK zum Abspielen · Zurück zum Schließen</div>
    <div class="nf-search-results" id="nf-search-results"></div>
  </div>
</div>
`;

document.getElementById('live-search-overlay-container').innerHTML = `
<div id="live-search-overlay" class="hidden">
  <div class="nf-search-modal">
    <div class="nfs-row"><button class="nfs-back" aria-label="Zurück" onclick="LiveSearch.close()"><svg viewBox="0 0 24 24"><path fill="currentColor" d="M20 11H7.8l5.6-5.6L12 4l-8 8 8 8 1.4-1.4L7.8 13H20z"/></svg></button>
    <input id="search-input-live" type="text" placeholder="Sender suchen…" autocomplete="off" /></div>
    <div class="nfs-hint" id="lvs-hint">Tippen zum Suchen · ↓ zu den Treffern · OK zum Umschalten · Zurück zum Schließen</div>
    <div class="nf-search-results" id="live-search-results"></div>
  </div>
</div>
`;