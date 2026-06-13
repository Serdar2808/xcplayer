document.getElementById('player-topbar-container').innerHTML = `
  <div id="player-topbar" class="fade">
    <div class="ptop-left">
      <button id="p-back-btn" class="p-back" onclick="Player.close()" data-focusable>&#x2190;</button>
      <button class="pbtn hidden" id="btn-restart-vod" onclick="Player.restart()" data-focusable>
        <span class="btn-icon">&#x25C0;|</span>
        <span class="btn-text">Von Anfang an</span>
      </button>
      <button class="pbtn hidden" id="btn-next-ep" onclick="Player.nextEp()" data-focusable>
        <span class="btn-icon">|&#x25B6;</span>
        <span class="btn-text">N&auml;chste Folge</span>
      </button>
    </div>
    <div class="ptop-right">
      <div style="display:flex;align-items:center;gap:12px;justify-content:flex-end;">
        <span id="sub-indicator" class="hidden" style="font-size:var(--fs-xs);color:var(--accent);font-weight:600">CC</span>
        <span id="p-vod-topname"></span>
      </div>
      <div id="vod-info-bar"></div>
    </div>
  </div>
`;

document.getElementById('sub-panel-container').innerHTML = `
  <div id="sub-panel" class="hidden">
    <div class="sp-hdr"><h3>Untertitel</h3></div>
    <div id="sub-list"></div>
  </div>
`;

document.getElementById('audio-panel-container').innerHTML = `
  <div id="audio-panel" class="hidden">
    <div class="sp-hdr"><h3>Audiospur</h3></div>
    <div id="audio-list"></div>
  </div>
`;

document.getElementById('variant-bar-container').innerHTML = `
  <div id="variant-bar" class="hide">
    <div class="vbar-label" id="vbar-label">Duplikate</div>
    <div class="vbar-chips" id="vbar-chips"></div>
  </div>
`;

document.getElementById('live-osd-container').innerHTML = `
  <div id="live-osd" class="hidden fade">
    <div class="osd-inner">
      <div class="osd-logo-col">
        <img id="osd-logo" alt="" onerror="if(window._logoErr) _logoErr(this)">
        <div id="osd-logo-ph" style="display:none">&#x1F4E1;</div>
      </div>
      <div class="osd-mid">
        <div>
          <div class="osd-ch-row">
            <span id="osd-ch-name"></span>
          <span class="osd-sep">|</span>
            <div id="osd-show-title"></div>
          </div>
          <div class="osd-epg-time" id="osd-epg-time"></div>
        </div>
        <div>
          <div class="osd-prog-track">
            <div class="osd-prog-fill" id="osd-prog-fill" style="width:0%"></div>
          </div>
          <div class="osd-time-row">
            <span id="osd-elapsed"></span>
            <span id="osd-duration"></span>
            <span id="osd-remaining"></span>
          </div>
        </div>
        <div class="osd-next-row" id="osd-next-row"></div>
      </div>
      <div class="osd-right-col">
        <div>
          <div class="osd-clock-big" id="osd-clock"></div>
          <div class="osd-ends" id="osd-ends"></div>
        </div>
        <div class="osd-badges" id="osd-badges"></div>
      </div>
    </div>
    <div class="osd-hints">
      <span class="kh hide-compact"><span class="kbp">OK</span> <span class="kh-full">Senderliste</span><span class="kh-short">Senderl.</span></span>
      <span class="kh hide-compact"><span class="kbp">&#x2191;&#x2193;</span> Sender&#177;</span>
      <span class="kh"><span class="kbp">&#x2194;</span> Duplikate</span>
      <span class="kh"><span class="kbp">ROT</span> Timeshift</span>
      <span class="kh"><span class="kbp">GELB</span> EPG</span>
      <span class="kh"><span class="kbp">GRÜN</span> <span class="kh-full">Untertitel</span><span class="kh-short">Untert.</span></span>
      <span class="kh"><span class="kbp">BLAU</span> Suche</span>
      <span class="kh"><span class="kbp">BACK</span> Stop</span>
    </div>
  </div>
`;

document.getElementById('ctrl-vod-container').innerHTML = `
  <div id="ctrl-vod" class="hidden fade">
    <div style="width:80%; margin:0 auto;">
      <div style="display:flex; align-items:center; margin-bottom:24px;">
        <button class="pbtn big accent" id="btn-pp-vod" onclick="Player.togglePP()" data-focusable style="flex-shrink:0; margin-right:24px;">&#9654;</button>
        <span id="pc-cur-t" style="font-variant-numeric:tabular-nums; color:white; font-size:var(--fs-md); font-weight:500; width:80px; text-align:right; flex-shrink:0;">0:00</span>
        <div class="seek-track" id="seek-track" onclick="seekClick(event)">
          <div class="seek-fill" id="seek-fill"></div>
          <div class="seek-thumb" id="seek-thumb" style="left:-12px"></div>
        </div>
        <span id="pc-tot-t" style="font-variant-numeric:tabular-nums; color:rgba(255,255,255,.6); font-size:var(--fs-md); font-weight:500; width:80px; flex-shrink:0;">0:00</span>
      </div>
      <div style="display:flex; gap:16px; justify-content:center;">
        <button class="pbtn" id="btn-audio" onclick="Player.toggleAudio()" data-focusable><span class="ico-w">&#x1F50A;</span> Audiospur</button>
        <button class="pbtn" id="btn-sub" onclick="Player.toggleSubtitles()" data-focusable><span class="ico-w">&#x1F4AC;</span> Untertitel</button>
      </div>
    </div>
  </div>
`;