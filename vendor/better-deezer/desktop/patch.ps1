#Requires -Version 5.1
<#
.SYNOPSIS
  Adds Better Deezer to the Deezer desktop app itself (or removes it), like Spicetify does for Spotify.

.DESCRIPTION
  Deezer's desktop app is Electron loading https://www.deezer.com. Its code
  lives in resources\app.asar (an archive: JSON header + file data). This script
  appends a small hook to build/main.js inside that archive:

    on every deezer.com page load (dom-ready), read
    %LOCALAPPDATA%\BetterDeezer\better-deezer.user.js and run it in the page.

  So the normal Deezer shortcut opens Deezer with the skin; there is no other
  app or launcher. If the skin file is missing, Deezer runs unchanged.

  Deezer's asar integrity check is off (Electron fuse), and the hook is written
  with an updated integrity hash anyway. Nothing is unpacked: the new main.js is
  appended to the archive data and the header is pointed at it, so every other
  file keeps its bytes and offset. A copy of the original is kept as
  app.asar.bd-backup the first time.

  A Deezer update replaces app.asar and drops the hook: run this script again
  (setup.ps1 also registers it to run silently at logon, which re-applies it).

.PARAMETER DeezerPath
  Full path to Deezer.exe. Default: config.json next to this script, then the
  usual install folders.

.PARAMETER Remove
  Take the hook out of app.asar (Deezer back to its original behaviour).

.PARAMETER Quiet
  No output and no message box; used by the logon task. Does nothing when
  Deezer is already patched, and never closes a running Deezer.

.PARAMETER Check
  Change nothing: output $true when Deezer is patched, $false otherwise.
#>
[CmdletBinding()]
param(
  [string]$DeezerPath,
  [switch]$Remove,
  [switch]$Quiet,
  [switch]$Check
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$Marker = 'better-deezer-hook'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$DataDir = Join-Path $env:LOCALAPPDATA 'BetterDeezer'
$null = New-Item -ItemType Directory -Force -Path $DataDir
$LogFile = Join-Path $DataDir 'patch.log'

function Write-BdLog {
  param([string]$Message)
  $line = '{0}  {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $Message
  Add-Content -Path $LogFile -Value $line -Encoding UTF8
  if ($Quiet -or $Check) { return }
  if (Get-Command Write-BdInfo -ErrorAction SilentlyContinue) { Write-BdInfo $Message } else { Write-Host "  > $Message" -ForegroundColor DarkGray }
}

# The shared look, when this script sits next to ui.ps1 (installed or release folder).
$ui = Join-Path $Root 'ui.ps1'
if (Test-Path $ui) { . $ui }

if ((Test-Path $LogFile) -and (Get-Item $LogFile).Length -gt 256KB) { Move-Item -Force $LogFile ($LogFile + '.old') }

# The hook appended to build/main.js. Plain ES5, wrapped in try: if anything
# fails, Deezer starts as if it were not there. Kept on one marked line so
# -Remove can cut it out exactly.
$Hook = @'
;(function(){/*better-deezer-hook*/try{var e=require("electron"),fs=require("fs"),path=require("path");var file=path.join(process.env.LOCALAPPDATA||"","BetterDeezer","better-deezer.user.js");var re=/^https:\/\/([a-z0-9-]+\.)*deezer\.com\//;e.app.on("web-contents-created",function(ev,wc){wc.on("dom-ready",function(){var url="";try{url=wc.getURL()}catch(x){}if(!re.test(url))return;fs.readFile(file,"utf8",function(err,src){if(err)return;wc.executeJavaScript(src).catch(function(){})})})})}catch(x){}})();/*/better-deezer-hook*/
'@
$Hook = "`n" + $Hook.Trim()

function Find-Deezer {
  $config = Join-Path $Root 'config.json'
  if (Test-Path $config) {
    try {
      $saved = (Get-Content -Raw -Encoding UTF8 $config | ConvertFrom-Json).DeezerPath
      if ($saved -and (Test-Path $saved)) { return $saved }
    } catch { Write-BdLog "config.json unreadable: $_" }
  }
  $candidates = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\deezer-desktop\Deezer.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Deezer\Deezer.exe'),
    (Join-Path $env:ProgramFiles 'Deezer\Deezer.exe')
  )
  if (${env:ProgramFiles(x86)}) { $candidates += (Join-Path ${env:ProgramFiles(x86)} 'Deezer\Deezer.exe') }
  foreach ($c in $candidates) { if (Test-Path $c) { return $c } }
  $keys = @(
    'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*',
    'HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*'
  )
  foreach ($k in $keys) {
    $entries = Get-ItemProperty -Path $k -ErrorAction SilentlyContinue |
      Where-Object { $_.PSObject.Properties['DisplayName'] -and $_.DisplayName -like 'Deezer*' }
    foreach ($e in $entries) {
      if ($e.PSObject.Properties['InstallLocation'] -and $e.InstallLocation) {
        $exe = Join-Path $e.InstallLocation 'Deezer.exe'
        if (Test-Path $exe) { return $exe }
      }
    }
  }
  return $null
}

# ---------- asar ----------
# Layout: uint32 4 | uint32 headerPickleSize | uint32 payloadSize | uint32 jsonLength | json | padding to 4 | data
# File offsets in the header are strings, relative to the start of data.

Add-Type -AssemblyName System.Web.Extensions
function New-Json {
  $s = New-Object System.Web.Script.Serialization.JavaScriptSerializer
  $s.MaxJsonLength = [int]::MaxValue
  $s.RecursionLimit = 1000
  return $s
}

function Read-Asar {
  param([string]$Path)
  $bytes = [IO.File]::ReadAllBytes($Path)
  $headerSize = [BitConverter]::ToUInt32($bytes, 4)
  $jsonLength = [BitConverter]::ToUInt32($bytes, 12)
  $json = [Text.Encoding]::UTF8.GetString($bytes, 16, $jsonLength)
  $header = (New-Json).DeserializeObject($json)
  $dataStart = 8 + $headerSize
  return @{ Bytes = $bytes; Header = $header; DataStart = $dataStart }
}

function Get-MainEntry {
  param($Asar)
  $build = $Asar.Header['files']['build']
  if (-not $build -or -not $build['files'].ContainsKey('main.js')) { throw 'build/main.js not found in app.asar: unknown Deezer version.' }
  return $build['files']['main.js']
}

function Get-MainSource {
  param($Asar)
  $entry = Get-MainEntry $Asar
  $start = $Asar.DataStart + [long]$entry['offset']
  return [Text.Encoding]::UTF8.GetString($Asar.Bytes, $start, [int]$entry['size'])
}

function Write-Asar {
  param($Asar, [string]$Path, [string]$MainSource)
  $main = [Text.Encoding]::UTF8.GetBytes($MainSource)
  $dataLength = $Asar.Bytes.Length - $Asar.DataStart

  $entry = Get-MainEntry $Asar
  $entry['offset'] = [string]$dataLength
  $entry['size'] = $main.Length
  $sha = [Security.Cryptography.SHA256]::Create()
  $hash = (($sha.ComputeHash($main) | ForEach-Object { $_.ToString('x2') }) -join '')
  $entry['integrity'] = @{ algorithm = 'SHA256'; hash = $hash; blockSize = 4194304; blocks = @($hash) }

  $json = [Text.Encoding]::UTF8.GetBytes((New-Json).Serialize($Asar.Header))
  $padded = [int]([Math]::Ceiling($json.Length / 4.0) * 4)
  $payloadSize = 4 + $padded
  $headerSize = 4 + $payloadSize

  $tmp = "$Path.bd-tmp"
  $out = [IO.File]::Create($tmp)
  try {
    $out.Write([BitConverter]::GetBytes([uint32]4), 0, 4)
    $out.Write([BitConverter]::GetBytes([uint32]$headerSize), 0, 4)
    $out.Write([BitConverter]::GetBytes([uint32]$payloadSize), 0, 4)
    $out.Write([BitConverter]::GetBytes([uint32]$json.Length), 0, 4)
    $out.Write($json, 0, $json.Length)
    $pad = $padded - $json.Length
    if ($pad -gt 0) { $out.Write((New-Object byte[] $pad), 0, $pad) }
    $out.Write($Asar.Bytes, $Asar.DataStart, $dataLength)
    $out.Write($main, 0, $main.Length)
  } finally {
    $out.Dispose()
  }

  # Check the new archive before replacing the real one.
  $check = Read-Asar $tmp
  if ((Get-MainSource $check) -ne $MainSource) { Remove-Item -Force $tmp; throw 'The patched app.asar did not read back correctly; Deezer was not changed.' }
  # Move-Item -Force cannot replace an existing file in Windows PowerShell 5.1.
  [IO.File]::Copy($tmp, $Path, $true)
  Remove-Item -Force $tmp
}

function Stop-Deezer {
  $running = @(Get-Process -Name 'Deezer' -ErrorAction SilentlyContinue)
  if ($running.Count -eq 0) { return $false }
  Write-BdLog "closing Deezer ($($running.Count) processes)"
  foreach ($p in $running) { try { $null = $p.CloseMainWindow() } catch { Write-Verbose "CloseMainWindow: $_" } }
  $deadline = (Get-Date).AddSeconds(5)
  while ((Get-Date) -lt $deadline -and @(Get-Process -Name 'Deezer' -ErrorAction SilentlyContinue).Count -gt 0) {
    Start-Sleep -Milliseconds 250
  }
  Get-Process -Name 'Deezer' -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  Start-Sleep -Milliseconds 800
  return $true
}

# ---------- main ----------
try {
  if (-not $DeezerPath) { $DeezerPath = Find-Deezer }
  if (-not $DeezerPath -or -not (Test-Path $DeezerPath)) {
    throw 'Deezer.exe not found. Install Deezer, or run: patch.ps1 -DeezerPath "C:\path\to\Deezer.exe"'
  }
  $asarPath = Join-Path (Split-Path -Parent $DeezerPath) 'resources\app.asar'
  if (-not (Test-Path $asarPath)) { throw "app.asar not found: $asarPath" }

  $asar = Read-Asar $asarPath
  $source = Get-MainSource $asar
  $patched = $source.Contains($Marker)

  if ($Check) { return $patched }

  if ($Remove) {
    if (-not $patched) { Write-BdLog 'Deezer is not patched, nothing to remove'; return }
    $start = $source.IndexOf("`n;(function(){/*$Marker*/")
    $end = $source.IndexOf("/*/$Marker*/")
    if ($start -lt 0 -or $end -lt 0) { throw 'Better Deezer hook found but not its bounds; reinstall Deezer to clean it.' }
    $clean = $source.Remove($start, $end + ("/*/$Marker*/").Length - $start)
    $null = Stop-Deezer
    Write-Asar $asar $asarPath $clean
    Write-BdLog "hook removed from $asarPath"
    return
  }

  if ($patched) { Write-BdLog "already patched: $asarPath"; return }

  if ($Quiet -and @(Get-Process -Name 'Deezer' -ErrorAction SilentlyContinue).Count -gt 0) {
    # Never close Deezer behind the user's back; the next logon will do it.
    Write-BdLog 'Deezer needs the hook again (updated?) but is running: skipped'
    return
  }

  $backup = "$asarPath.bd-backup"
  $wasRunning = Stop-Deezer
  Copy-Item -Force $asarPath $backup
  Write-Asar $asar $asarPath ($source + $Hook)
  Write-BdLog "hook added to $asarPath (backup: $backup)"
  if ($wasRunning) { Start-Process -FilePath $DeezerPath -WorkingDirectory (Split-Path -Parent $DeezerPath) }
} catch {
  Write-BdLog "error: $_"
  if ($Quiet) { exit 1 }
  throw
}
