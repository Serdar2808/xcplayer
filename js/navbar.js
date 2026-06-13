document.getElementById('navbar-container').innerHTML = `
<nav id="navbar" class="hidden">
  <div class="nav-logo-sm" id="nav-logo-btn">XC</div>
  <div class="nav-spacer-l"></div>
  <!-- Zentrierte Tab-Leiste: Suche-Lupe + Live TV / Filme / Serien / Weiterschauen / Einstellungen / Beenden -->
  <div id="nav-tabs">
    <!-- Suche: Lupe-Icon mit blauem Punkt davor (BLAU = Fernbedienungsfarbe) -->
    <div id="nav-tab-search" class="nav-tab-item nav-tab-search" data-focusable tabindex="0" role="button" aria-label="Suche">
      <span class="nav-tab-dot"></span>
      <svg class="nav-tab-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true">
        <circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>
      </svg>
    </div>
    <div id="nav-tab-live" class="nav-tab-item" data-focusable tabindex="0">Live TV</div>
    <div id="nav-tab-vod"  class="nav-tab-item" data-focusable tabindex="0">Filme</div>
    <div id="nav-tab-series" class="nav-tab-item" data-focusable tabindex="0">Serien</div>
    <div id="nav-tab-continue" class="nav-tab-item" data-focusable tabindex="0">Weiterschauen</div>
    <div id="nav-tab-settings" class="nav-tab-item" data-focusable tabindex="0">Einstellungen</div>
    <div id="nav-tab-exit" class="nav-tab-item nav-tab-exit" data-focusable tabindex="0">Beenden</div>
  </div>
  <div class="nav-spacer-r"></div>
  <!-- Versteckter Tab-Label (Legacy, wird intern weiter verwendet) -->
  <div id="nav-tab-label" style="display:none">Live TV</div>
  <div id="nav-clock" style="font-size:var(--fs-md); font-weight:600; color:var(--hi); margin-right:20px; font-variant-numeric:tabular-nums;"></div>
</nav>
`;