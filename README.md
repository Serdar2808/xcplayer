# XC Player — webOS App

Ein vollständiger Xtream Codes IPTV Player für LG Smart TVs (webOS).

## Features
- 📡 **Live TV** — Senderliste mit Kategorien, Live-Badge, EPG-Vorschau in Kacheln
- 🎬 **VOD (Filme)** — Poster-Grid mit Cover, Bewertung, Jahr
- 📺 **Serien** — Staffel/Episoden-Browser mit Metadaten
- 📋 **EPG** — Programm-Panel im Player (jetzt/nächste), Zeitanzeige
- 🔍 **Suche** — Live-Suche in allen Bereichen
- ⌨ **Remote-Steuerung** — Vollständige Fernbedienungsunterstützung
- 💾 **Zugangsdaten speichern** — Automatisches Login via localStorage

## Fernbedienungs-Mapping
| Taste | Funktion |
|-------|----------|
| OK / Enter | Play / Pause |
| BACK | Zurück / EPG schließen |
| ↑ / ↓ | Vorheriger / Nächster Sender |
| GELB (405) | EPG Panel öffnen/schließen |
| BLAU (406) | Untertitel (CC) umschalten |
| ROT (403) | Wiedergabe stoppen |

## Installation (webOS)

### Voraussetzungen
- LG TV mit webOS 3.x oder neuer
- Developer Mode App auf dem TV aktiviert
- webOS CLI (`@webosose/ares-cli`) installiert

### Schritte
```bash
# webOS CLI installieren
npm install -g @webosose/ares-cli

# TV als Gerät hinzufügen
ares-setup-device

# App paketieren
ares-package xcplayer/

# App installieren
ares-install --device <TV_NAME> com.xcplayer.app_1.0.0_all.ipk

# App starten
ares-launch --device <TV_NAME> com.xcplayer.app
```

### Offline-Betrieb (ohne Internet für Fonts/HLS.js)
Für produktiven Einsatz ohne Internetzugang:
1. HLS.js herunterladen: https://cdn.jsdelivr.net/npm/hls.js@1.5.15/dist/hls.min.js → als `hls.min.js` speichern
2. In `index.html` die CDN-URL durch `hls.min.js` ersetzen
3. Google Fonts ggf. lokal einbetten oder durch System-Fonts ersetzen

## Hinweise
- Der Player nutzt HLS.js für .m3u8-Streams (Live TV)
- VOD/Serien werden direkt per `<video>`-Tag abgespielt
- EPG wird base64-dekodiert (Standard Xtream Codes Format)
- Icons werden als Platzhalter angezeigt wenn nicht erreichbar
