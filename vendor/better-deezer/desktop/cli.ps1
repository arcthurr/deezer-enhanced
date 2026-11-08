#Requires -Version 5.1
<#
.SYNOPSIS
  better-deezer: the Better Deezer command (like spicetify for Spotify).

.DESCRIPTION
  Installed in %LOCALAPPDATA%\BetterDeezer with a better-deezer.cmd shim in
  its bin folder, which setup.ps1 adds to the user PATH:

    better-deezer status      what is installed, is Deezer patched, is there an update
    better-deezer update      install the latest release (-f: even if up to date)
    better-deezer apply       patch Deezer again (after a Deezer update)
    better-deezer restore     put Deezer back as it was, keep Better Deezer installed
    better-deezer restart     restart Deezer
    better-deezer logs        last lines of the log
    better-deezer uninstall   remove Better Deezer
    better-deezer version     print the version

  Options: -f / --force (update), -y / --yes (no questions).
  Not an advanced script on purpose: options stay in $args, so "--force" works too.
#>
param([string]$Command = 'help')

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $Here 'ui.ps1')
# The install folder holds config.json, the payload and the scripts to run. Started
# from a clone (desktop\cli.ps1), the command still acts on the real install.
$Root = $Here
$installed = Join-Path $env:LOCALAPPDATA 'BetterDeezer'
if (-not (Test-Path (Join-Path $Here 'config.json')) -and (Test-Path (Join-Path $installed 'config.json'))) { $Root = $installed }

$Repo = 'Gabizoc/Better-Deezer'
$Required = @('setup.ps1', 'patch.ps1', 'uninstall.ps1', 'cli.ps1', 'ui.ps1', 'better-deezer.user.js')
$RunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$Options = @($args | ForEach-Object { "$_".ToLowerInvariant() })
$Force = [bool]($Options | Where-Object { $_ -in @('-f', '--force', '-force') })
$Yes = [bool]($Options | Where-Object { $_ -in @('-y', '--yes', '-yes') })

# ---------- helpers ----------

function Get-BdConfig {
  $file = Join-Path $Root 'config.json'
  if (Test-Path $file) {
    try { return Get-Content -Raw -Encoding UTF8 $file | ConvertFrom-Json } catch { Write-Verbose "config.json: $_" }
  }
  return $null
}

function Get-BdVersion {
  $payload = Join-Path $Root 'better-deezer.user.js'
  if (Test-Path $payload) {
    foreach ($line in (Get-Content -TotalCount 6 -Encoding UTF8 $payload)) { if ($line -match '@version\s+(\S+)') { return $Matches[1] } }
  }
  $config = Get-BdConfig
  if ($config -and $config.PSObject.Properties['Version']) { return $config.Version }
  return '?'
}

function Get-BdDeezerPath {
  $config = Get-BdConfig
  if ($config -and $config.PSObject.Properties['DeezerPath'] -and $config.DeezerPath -and (Test-Path $config.DeezerPath)) { return $config.DeezerPath }
  return $null
}

function Test-BdPatched {
  param([string]$DeezerPath)
  try { return [bool](& (Join-Path $Root 'patch.ps1') -Check -DeezerPath $DeezerPath) } catch { return $null }
}

function Test-BdDeezerRunning { return @(Get-Process -Name 'Deezer' -ErrorAction SilentlyContinue).Count -gt 0 }

function Restart-BdDeezer {
  param([string]$DeezerPath)
  foreach ($p in @(Get-Process -Name 'Deezer' -ErrorAction SilentlyContinue)) { try { $null = $p.CloseMainWindow() } catch { Write-Verbose "$_" } }
  $deadline = (Get-Date).AddSeconds(5)
  while ((Get-Date) -lt $deadline -and (Test-BdDeezerRunning)) { Start-Sleep -Milliseconds 250 }
  Get-Process -Name 'Deezer' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 800
  Start-Process -FilePath $DeezerPath -WorkingDirectory (Split-Path -Parent $DeezerPath)
}

function ConvertTo-BdVersion {
  param([string]$Text)
  $clean = ($Text -replace '^v', '') -replace '[^0-9.].*$', ''
  try { return [version]$clean } catch { return [version]'0.0' }
}

# Latest release: GitHub's public API, or the GitHub CLI (gh) when the API cannot be
# reached or rate-limits anonymous calls and gh is signed in.
function Get-BdLatest {
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  try {
    $r = Invoke-RestMethod -UseBasicParsing -Uri "https://api.github.com/repos/$Repo/releases/latest" -Headers @{ 'User-Agent' = 'better-deezer' } -TimeoutSec 10
    $assets = @{}
    foreach ($a in @($r.assets)) { $assets[$a.name] = $a.browser_download_url }
    return @{ Tag = $r.tag_name; Version = $r.tag_name.TrimStart('v'); Source = 'web'; Assets = $assets }
  } catch {
    Write-Verbose "GitHub API: $_"
  }
  if (Get-Command gh -ErrorAction SilentlyContinue) {
    $json = & gh release view --repo $Repo --json 'tagName,assets' 2>$null
    if ($LASTEXITCODE -eq 0 -and $json) {
      $r = ($json -join "`n") | ConvertFrom-Json
      $assets = @{}
      foreach ($a in @($r.assets)) { $assets[$a.name] = $a.url }
      return @{ Tag = $r.tagName; Version = $r.tagName.TrimStart('v'); Source = 'gh'; Assets = $assets }
    }
  }
  throw (T 'Impossible de joindre les versions sur GitHub. Vérifiez votre connexion et réessayez dans quelques minutes (GitHub limite les requêtes anonymes), ou connectez GitHub CLI (gh auth login).' 'Cannot reach the releases on GitHub. Check your connection and try again in a few minutes (GitHub rate-limits anonymous calls), or sign in to GitHub CLI (gh auth login).')
}

function Save-BdRelease {
  param($Release, [string]$Dir)
  $missing = @($Required | Where-Object { -not $Release.Assets.ContainsKey($_) })
  if ($missing.Count) {
    throw ((T 'La version {0} ne contient pas {1} : trop ancienne pour la commande update. Réinstallez depuis la page des versions.' 'Release {0} has no {1}: too old for the update command. Reinstall from the releases page.') -f $Release.Tag, ($missing -join ', '))
  }
  $names = @($Required)
  if ($Release.Assets.ContainsKey('SHA256SUMS.txt')) { $names += 'SHA256SUMS.txt' }
  if ($Release.Source -eq 'gh') {
    $patterns = @($names | ForEach-Object { @('-p', $_) })
    & gh release download $Release.Tag --repo $Repo -D $Dir --clobber @patterns 2>$null
    if ($LASTEXITCODE -ne 0) { throw (T 'Le téléchargement avec gh a échoué.' 'Download with gh failed.') }
  } else {
    $ProgressPreference = 'SilentlyContinue'
    foreach ($n in $names) { Invoke-WebRequest -UseBasicParsing -Uri $Release.Assets[$n] -OutFile (Join-Path $Dir $n) }
  }
  foreach ($n in $names) { Unblock-File -Path (Join-Path $Dir $n) -ErrorAction SilentlyContinue }

  # Integrity: every file against SHA256SUMS.txt (sha256sum format: "<hash>  <name>").
  $sums = Join-Path $Dir 'SHA256SUMS.txt'
  if (Test-Path $sums) {
    $expected = @{}
    foreach ($line in Get-Content $sums) { if ($line -match '^([0-9a-f]{64})\s+\*?(.+)$') { $expected[$Matches[2].Trim()] = $Matches[1] } }
    foreach ($n in $Required) {
      if ($expected.ContainsKey($n) -and (Get-FileHash -Algorithm SHA256 (Join-Path $Dir $n)).Hash.ToLowerInvariant() -ne $expected[$n]) {
        throw ((T 'Fichier corrompu : {0} (somme SHA-256 différente). Rien n''a été installé.' 'Corrupted file: {0} (SHA-256 mismatch). Nothing was installed.') -f $n)
      }
    }
    return $true
  }
  return $false
}

# ---------- commands ----------

function Show-BdHelp {
  Write-BdBanner -Subtitle (T 'Le skin de Deezer, intégré à l''application' 'The Deezer skin, built into the app') -Version (Get-BdVersion)
  Write-Host '  ' -NoNewline
  Write-Host (T 'Utilisation' 'Usage') -ForegroundColor DarkGray -NoNewline
  Write-Host '  better-deezer ' -NoNewline
  Write-Host (T '<commande>' '<command>') -ForegroundColor Magenta
  Write-Host ''
  $rows = @(
    @('status', (T 'État de l''installation, de Deezer et des mises à jour' 'Install, Deezer and update status')),
    @('update', (T 'Installe la dernière version (-f : même si à jour)' 'Install the latest version (-f: even if up to date)')),
    @('apply', (T 'Réapplique Better Deezer à Deezer (après une mise à jour de Deezer)' 'Apply Better Deezer to Deezer again (after a Deezer update)')),
    @('restore', (T 'Remet Deezer d''origine, sans désinstaller' 'Put Deezer back as it was, without uninstalling')),
    @('restart', (T 'Redémarre Deezer' 'Restart Deezer')),
    @('logs', (T 'Dernières lignes du journal' 'Last lines of the log')),
    @('uninstall', (T 'Désinstalle Better Deezer' 'Uninstall Better Deezer')),
    @('version', (T 'Affiche la version' 'Print the version'))
  )
  foreach ($r in $rows) {
    Write-Host ('  ' + $r[0].PadRight(12)) -ForegroundColor Magenta -NoNewline
    Write-Host $r[1]
  }
  Write-Host ''
}

function Invoke-BdStatus {
  Write-BdBanner -Subtitle (T 'État' 'Status') -Version (Get-BdVersion)
  $exe = Get-BdDeezerPath
  if (-not $exe) {
    Write-BdFail (T 'Deezer introuvable' 'Deezer not found') (T 'réinstallez Better Deezer' 'reinstall Better Deezer')
    return 1
  }
  $deezerVersion = (Get-Item $exe).VersionInfo.ProductVersion
  Write-BdOk 'Deezer' ("$deezerVersion  " + (Format-BdPath $exe))

  $patched = Test-BdPatched $exe
  if ($patched -eq $true) { Write-BdOk (T 'Better Deezer appliqué' 'Better Deezer applied') }
  elseif ($patched -eq $false) { Write-BdWarn (T 'Deezer n''est pas modifié' 'Deezer is not patched') (T 'mis à jour ? lancez : better-deezer apply' 'updated? run: better-deezer apply') }
  else { Write-BdFail (T 'Impossible de lire Deezer' 'Cannot read Deezer') (T 'voir : better-deezer logs' 'see: better-deezer logs') }

  if (Test-Path (Join-Path $Root 'better-deezer.user.js')) { Write-BdOk (T 'Skin' 'Skin') ('v' + (Get-BdVersion)) }
  else { Write-BdFail (T 'Skin absent' 'Skin missing') (T 'lancez : better-deezer update -f' 'run: better-deezer update -f') }

  if (Get-ItemProperty -Path $RunKey -Name 'BetterDeezer' -ErrorAction SilentlyContinue) { Write-BdOk (T 'Réapplication auto' 'Auto re-apply') (T 'à l''ouverture de session' 'at sign-in') }
  else { Write-BdInfo (T 'Réapplication auto' 'Auto re-apply') (T 'désactivée (better-deezer apply la réactive)' 'off (better-deezer apply turns it on)') }

  try {
    $latest = Get-BdLatest
    $remote = ConvertTo-BdVersion $latest.Version
    $local = ConvertTo-BdVersion (Get-BdVersion)
    if ($remote -gt $local) {
      Write-BdWarn (T 'Mise à jour disponible' 'Update available') ("v$($latest.Version)  › better-deezer update")
    } elseif ($remote -lt $local) {
      Write-BdInfo (T 'Version non publiée' 'Unreleased version') ((T 'dernière version publiée : v{0}' 'latest release: v{0}') -f $latest.Version)
    } else {
      Write-BdOk (T 'À jour' 'Up to date') (T 'dernière version' 'latest version')
    }
  } catch {
    Write-BdInfo (T 'Mises à jour' 'Updates') (T 'GitHub injoignable' 'GitHub unreachable')
  }
  Write-Host ''
  return 0
}

function Invoke-BdUpdate {
  Write-BdBanner -Subtitle (T 'Mise à jour' 'Update') -Version (Get-BdVersion)
  Write-BdStep (T 'Recherche de la dernière version' 'Looking for the latest version')
  $latest = Get-BdLatest
  $current = Get-BdVersion
  if (-not $Force -and (ConvertTo-BdVersion $latest.Version) -le (ConvertTo-BdVersion $current)) {
    $detail = if ((ConvertTo-BdVersion $latest.Version) -lt (ConvertTo-BdVersion $current)) { (T 'v{0} (dernière publiée : v{1})' 'v{0} (latest release: v{1})') -f $current, $latest.Version } else { "v$current" }
    Write-BdOk (T 'Déjà à jour' 'Already up to date') $detail
    Write-BdHint (T 'Pour réinstaller quand même :' 'To reinstall anyway:') 'better-deezer update -f'
    Write-Host ''
    return 0
  }
  Write-BdOk (T 'Version trouvée' 'Version found') ("v$($latest.Version)" + $(if ($latest.Source -eq 'gh') { '  (GitHub CLI)' } else { '' }))

  $dir = Join-Path $env:TEMP 'BetterDeezer-update'
  if (Test-Path $dir) { Remove-Item -Recurse -Force $dir }
  $null = New-Item -ItemType Directory -Force -Path $dir
  Write-BdStep (T 'Téléchargement' 'Downloading')
  $verified = Save-BdRelease $latest $dir
  if ($verified) { Write-BdOk (T 'Fichiers téléchargés' 'Files downloaded') (T 'sommes SHA-256 vérifiées' 'SHA-256 checked') }
  else { Write-BdWarn (T 'Fichiers téléchargés' 'Files downloaded') (T 'pas de SHA256SUMS.txt dans la version' 'no SHA256SUMS.txt in the release') }

  $wasRunning = Test-BdDeezerRunning
  $null = & (Join-Path $dir 'setup.ps1') -Update -NoLaunch
  Remove-Item -Recurse -Force $dir -ErrorAction SilentlyContinue

  $exe = Get-BdDeezerPath
  if ($wasRunning -and $exe -and (Test-BdDeezerRunning)) {
    if ($Yes -or (Read-BdConfirm (T 'Redémarrer Deezer pour charger la nouvelle version ?' 'Restart Deezer to load the new version?'))) {
      Restart-BdDeezer $exe
      Write-BdOk (T 'Deezer redémarré' 'Deezer restarted')
    } else {
      Write-BdInfo (T 'La nouvelle version se chargera au prochain démarrage de Deezer' 'The new version loads next time Deezer starts')
    }
  }
  Write-BdDone ((T 'Better Deezer {0} est installé.' 'Better Deezer {0} is installed.') -f "v$($latest.Version)")
  return 0
}

function Invoke-BdApply {
  Write-BdBanner -Subtitle (T 'Application à Deezer' 'Apply to Deezer') -Version (Get-BdVersion)
  $exe = Get-BdDeezerPath
  if (-not $exe) { Write-BdFail (T 'Deezer introuvable' 'Deezer not found') (T 'réinstallez Better Deezer' 'reinstall Better Deezer'); return 1 }
  if (Test-BdPatched $exe) {
    Write-BdOk (T 'Déjà appliqué' 'Already applied') (Format-BdPath $exe)
  } else {
    $wasRunning = Test-BdDeezerRunning
    $null = & (Join-Path $Root 'patch.ps1') -DeezerPath $exe 6>$null
    Write-BdOk (T 'Better Deezer appliqué' 'Better Deezer applied') (Format-BdPath $exe)
    if ($wasRunning) { Write-BdInfo (T 'Deezer a été redémarré' 'Deezer was restarted') }
  }
  $ps = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
  $null = New-ItemProperty -Force -Path $RunKey -Name 'BetterDeezer' -PropertyType String -Value ('"{0}" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{1}" -Quiet' -f $ps, (Join-Path $Root 'patch.ps1'))
  Write-BdOk (T 'Réapplication auto' 'Auto re-apply') (T 'à l''ouverture de session' 'at sign-in')
  Write-BdDone (T 'Ouvrez Deezer comme d''habitude.' 'Open Deezer as usual.')
  return 0
}

function Invoke-BdRestore {
  Write-BdBanner -Subtitle (T 'Deezer d''origine' 'Original Deezer') -Version (Get-BdVersion)
  $exe = Get-BdDeezerPath
  if (-not $exe) { Write-BdFail (T 'Deezer introuvable' 'Deezer not found'); return 1 }
  if ((Test-BdDeezerRunning) -and -not $Yes) {
    if (-not (Read-BdConfirm (T 'Deezer va être fermé. Continuer ?' 'Deezer will be closed. Continue?'))) { Write-Host ''; return 0 }
  }
  $null = & (Join-Path $Root 'patch.ps1') -Remove -DeezerPath $exe 6>$null
  Remove-ItemProperty -Path $RunKey -Name 'BetterDeezer' -ErrorAction SilentlyContinue
  Write-BdOk (T 'Deezer remis d''origine' 'Deezer restored') (Format-BdPath $exe)
  Write-BdOk (T 'Réapplication auto' 'Auto re-apply') (T 'désactivée' 'off')
  Write-BdDone (T 'Better Deezer reste installé.' 'Better Deezer stays installed.') Gray
  Write-BdHint (T 'Pour le remettre :' 'To put it back:') 'better-deezer apply'
  Write-Host ''
  return 0
}

function Invoke-BdLog {
  Write-BdBanner -Subtitle (T 'Journal' 'Log') -Version (Get-BdVersion)
  $log = Join-Path $Root 'patch.log'
  if (-not (Test-Path $log)) { Write-BdInfo (T 'Journal vide' 'Empty log'); Write-Host ''; return 0 }
  Get-Content -Tail 20 -Encoding UTF8 $log | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
  Write-Host ''
  Write-BdInfo (Format-BdPath $log)
  Write-Host ''
  return 0
}

# ---------- main ----------
$code = 0
try {
  switch ($Command.ToLowerInvariant().TrimStart('-')) {
    { $_ -in @('help', 'h', '?', '') } { Show-BdHelp }
    'status' { $code = Invoke-BdStatus }
    { $_ -in @('update', 'upgrade') } { $code = Invoke-BdUpdate }
    'apply' { $code = Invoke-BdApply }
    { $_ -in @('restore', 'remove') } { $code = Invoke-BdRestore }
    'restart' {
      $exe = Get-BdDeezerPath
      if (-not $exe) { Write-BdFail (T 'Deezer introuvable' 'Deezer not found'); $code = 1 }
      else { Restart-BdDeezer $exe; Write-Host ''; Write-BdOk (T 'Deezer redémarré' 'Deezer restarted'); Write-Host '' }
    }
    { $_ -in @('logs', 'log') } { $code = Invoke-BdLog }
    'uninstall' {
      $uninstallArgs = @{}
      if ($Yes) { $uninstallArgs['Quiet'] = $true }
      & (Join-Path $Root 'uninstall.ps1') @uninstallArgs
    }
    { $_ -in @('version', 'v') } { Write-Output (Get-BdVersion) }
    default {
      Write-Host ''
      Write-BdFail ((T 'Commande inconnue : {0}' 'Unknown command: {0}') -f $Command)
      Show-BdHelp
      $code = 1
    }
  }
} catch {
  Write-Host ''
  Write-BdFail (T 'Erreur' 'Error') "$_"
  Write-Host ''
  $code = 1
}
exit $code
