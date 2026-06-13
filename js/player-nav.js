document.getElementById('ch-list-overlay-container').innerHTML = `
  <div id="ch-list-overlay" class="hidden">
    <div id="clo-topbar">
      <div id="clo-group-btn">
        <span id="clo-group-name">Alle Sender</span>
      </div>
    </div>
    <div id="clo-content-wrap" style="display:flex; flex:1; overflow:hidden;">
      <div id="clo-left-pane"></div>
      <div id="clo-list" style="flex:1;"></div>
    </div>
    <div id="clo-hints">
      <span class="clo-hint"><span class="clo-hint-key">OK</span> Sender wählen</span>
      <span class="clo-hint" id="hint-lr"><span class="clo-hint-key">&#x25C4;&#x25BA;</span> Kategorie wechseln</span>
      <span class="clo-hint" id="hint-split-lr"><span class="clo-hint-key">&#x25C4;&#x25BA;</span> Fokus wechseln</span>
      <span class="clo-hint" id="hint-green"><span class="clo-hint-key">GRÜN</span> Kategorien</span>
      <span class="clo-hint"><span class="clo-hint-key">GELB</span> Favorit</span>
      <span class="clo-hint"><span class="clo-hint-key">BACK</span> Schließen</span>
    </div>
  </div>
`;

document.getElementById('epg-panel-container').innerHTML = `
  <div id="epg-panel" class="slide-panel">
    <div class="panel-hdr"><h3>&#x1F4CB; Programm</h3><p id="epg-ch-name"></p></div>
    <div class="panel-body" id="epg-body" onclick="handleEpgClick(event)"></div>
  </div>
`;

document.getElementById('epg-grid-overlay-container').innerHTML = `
  <div id="epg-grid-overlay" class="hidden">
    <div class="eg-topbar">
      <h3>&#x1F4C5; TV-Programm</h3>
      <span class="eg-date" id="eg-date"></span>
      <div style="flex:1"></div>
      <span class="kh" style="color:var(--mid)"><span class="kbp">&#x2190;&#x2192;</span> Zeitleiste</span>
      <span class="kh" style="color:var(--mid)"><span class="kbp">&#x2191;&#x2193;</span> Sender</span>
      <span class="kh" style="color:var(--mid)"><span class="kbp">OK</span> Umschalten</span>
      <span class="kh" style="color:var(--mid)"><span class="kbp">BACK</span> Schließen</span>
    </div>
    <div class="eg-container">
      <div class="eg-channels" id="eg-channels"></div>
      <div class="eg-time-header"><div class="eg-time-header-inner" id="eg-time-hdr"></div></div>
      <div class="eg-grid-scroll" id="eg-grid-scroll">
        <div class="eg-grid-inner" id="eg-grid-inner">
          <div class="eg-now-line" id="eg-now-line"><div class="eg-now-dot"></div></div>
        </div>
      </div>
    </div>
  </div>
`;