# Baut das webOS-Paket und installiert es auf dem LG-TV.
#
#   .\build.ps1              -> bauen + installieren + starten
#   .\build.ps1 -NurBauen    -> nur build\com.xcplayer.app_<version>_all.ipk erzeugen
#
# Voraussetzungen: webOS CLI (ares-*) und TV im Entwicklermodus,
# eingerichtet mit ares-setup-device (Name siehe -Geraet).
param(
    [string]$Geraet = "meinTV",
    [switch]$NurBauen
)
$ErrorActionPreference = "Stop"

$appId = "com.xcplayer.app"
$root  = $PSScriptRoot
$build = Join-Path $root "build"
$stage = Join-Path $build "stage"

# Nur die App-Dateien packen. Früher wurde der ganze Projektordner gepackt -
# inklusive der jeweils vorherigen .ipk, wodurch das Paket bei jedem Build
# größer wurde (zuletzt 40 MB statt ~1 MB).
if (Test-Path $build) { Remove-Item $build -Recurse -Force }
New-Item -ItemType Directory -Force $stage | Out-Null
foreach ($item in "appinfo.json", "index.html", "icon.png", "largeIcon.png", "css", "js", "images", "fonts") {
    Copy-Item (Join-Path $root $item) $stage -Recurse
}

& ares-package $stage -o $build
if ($LASTEXITCODE -ne 0) { throw "Paketieren fehlgeschlagen" }
$ipk = Get-ChildItem $build -Filter *.ipk | Select-Object -First 1
Write-Host "Paket: $($ipk.FullName) ($([math]::Round($ipk.Length / 1MB, 1)) MB)"
if ($NurBauen) { return }

& ares-install -d $Geraet $ipk.FullName
if ($LASTEXITCODE -ne 0) { throw "Installation fehlgeschlagen (TV an? Entwicklermodus-Sitzung abgelaufen?)" }
& ares-launch -d $Geraet $appId
