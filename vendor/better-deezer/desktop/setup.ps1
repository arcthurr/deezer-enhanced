<#
.SYNOPSIS
  setup.ps1: adds Better Deezer to the Deezer desktop app (Windows 10/11, no admin rights).

.DESCRIPTION
  Normally started by install.ps1 (the ASCII bootstrap used by
  "irm .../install.ps1 | iex"), or by "better-deezer update". Can be run
  directly from a release folder or a clone:
    powershell -ExecutionPolicy Bypass -File setup.ps1

  What it does (like Spicetify for Spotify: Deezer itself is patched, there is no other app):
    - copies the scripts and better-deezer.user.js to %LOCALAPPDATA%\BetterDeezer
      (from this folder, a clone's dist\, or the latest GitHub release),
    - adds the better-deezer command (bin\better-deezer.cmd, on the user PATH),
    - runs patch.ps1, which adds a small hook to Deezer's resources\app.asar
      (Deezer is closed and restarted if it was running),
    - registers patch.ps1 -Quiet at sign-in (HKCU Run) to re-apply it after a Deezer update,
    - registers an uninstaller in Settings > Apps (current user only),
    - removes the old launcher and its shortcuts (first versions).

.PARAMETER DeezerPath
  Full path to Deezer.exe if it is installed somewhere unusual.
  With "irm | iex", set $env:BD_DEEZER_PATH instead.

.PARAMETER NoLaunch
  Do not start Deezer at the end.

.PARAMETER Update
  Called by "better-deezer update": shorter output, Deezer path from the current install.
#>
[CmdletBinding()]
param(
  [string]$DeezerPath = $env:BD_DEEZER_PATH,
  [switch]$NoLaunch,
  [switch]$Update
)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Stop'

$Repo = 'Gabizoc/Better-Deezer'
$Dest = Join-Path $env:LOCALAPPDATA 'BetterDeezer'
$Files = @('patch.ps1', 'uninstall.ps1', 'cli.ps1', 'ui.ps1', 'better-deezer.user.js')
$PowerShellExe = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
$Here = $null
if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot 'patch.ps1'))) { $Here = $PSScriptRoot }

function Get-BdFile {
  # One release file into $Target: next to this script, a clone's dist\, or GitHub.
  param([string]$Name, [string]$Target)
  if ($Here -and (Test-Path (Join-Path $Here $Name))) {
    Copy-Item -Force (Join-Path $Here $Name) $Target
  } elseif ($Here -and $Name -eq 'better-deezer.user.js' -and (Test-Path (Join-Path $Here "..\dist\$Name"))) {
    Copy-Item -Force (Join-Path $Here "..\dist\$Name") $Target
  } else {
    [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
    $ProgressPreference = 'SilentlyContinue'
    Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$Repo/releases/latest/download/$Name" -OutFile $Target
  }
  Unblock-File -Path $Target -ErrorAction SilentlyContinue
}

# The look comes from ui.ps1: next to this script, or fetched like the other files.
$uiFile = if ($Here) { Join-Path $Here 'ui.ps1' } else { $null }
if (-not $uiFile -or -not (Test-Path $uiFile)) {
  $uiFile = Join-Path $env:TEMP 'BetterDeezer-ui.ps1'
  Get-BdFile 'ui.ps1' $uiFile
}
. $uiFile

function Find-Deezer {
  $config = Join-Path $Dest 'config.json'
  if (Test-Path $config) {
    try {
      $saved = (Get-Content -Raw -Encoding UTF8 $config | ConvertFrom-Json).DeezerPath
      if ($saved -and (Test-Path $saved)) { return $saved }
    } catch { Write-Verbose "config.json: $_" }
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

function Get-PayloadVersion {
  param([string]$Path)
  if (Test-Path $Path) {
    foreach ($line in (Get-Content -TotalCount 6 -Encoding UTF8 $Path)) { if ($line -match '@version\s+(\S+)') { return $Matches[1] } }
  }
  return $null
}

# User PATH: add the bin folder once (kept unexpanded), tell open programs, and this session.
function Add-BdToPath {
  param([string]$Bin)
  $display = '%LOCALAPPDATA%\BetterDeezer\bin'
  $key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
  try {
    $current = [string]$key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    $parts = @($current -split ';' | Where-Object { $_ })
    if (-not ($parts | Where-Object { $_ -ieq $display -or $_ -ieq $Bin })) {
      $key.SetValue('Path', (@($parts) + $display) -join ';', [Microsoft.Win32.RegistryValueKind]::ExpandString)
      $changed = $true
    } else { $changed = $false }
  } finally { $key.Close() }
  if ($changed) {
    if (-not ('BdNative.Env' -as [type])) {
      Add-Type -Namespace BdNative -Name Env -MemberDefinition '[DllImport("user32.dll", SetLastError = true, CharSet = CharSet.Unicode)] public static extern System.IntPtr SendMessageTimeout(System.IntPtr hWnd, uint Msg, System.UIntPtr wParam, string lParam, uint fuFlags, uint uTimeout, out System.UIntPtr lpdwResult);'
    }
    $result = [UIntPtr]::Zero
    $null = [BdNative.Env]::SendMessageTimeout([IntPtr]0xffff, 0x1A, [UIntPtr]::Zero, 'Environment', 2, 2000, [ref]$result)
  }
  if (($env:Path -split ';') -notcontains $Bin) { $env:Path = "$env:Path;$Bin" }
  return $changed
}

try {
  # 1. What we install
  $payloadSource = if ($Here -and (Test-Path (Join-Path $Here 'better-deezer.user.js'))) { Join-Path $Here 'better-deezer.user.js' } elseif ($Here) { Join-Path $Here '..\dist\better-deezer.user.js' } else { $null }
  $version = Get-PayloadVersion $payloadSource
  $subtitle = if ($Update) { T 'Installation de la nouvelle version' 'Installing the new version' } else { T 'Installation dans l''application Deezer' 'Install into the Deezer desktop app' }
  if (-not $Update) { Write-BdBanner -Subtitle $subtitle -Version $(if ($version) { "v$version" }) }

  # 2. Deezer
  if (-not $DeezerPath) { $DeezerPath = Find-Deezer }
  if (-not $DeezerPath -or -not (Test-Path $DeezerPath)) {
    Write-BdWarn (T 'Deezer.exe introuvable' 'Deezer.exe not found') (T 'installez Deezer : https://www.deezer.com/download' 'install Deezer: https://www.deezer.com/download')
    Write-Host '  ? ' -ForegroundColor Magenta -NoNewline
    $DeezerPath = (Read-Host (T 'Chemin complet de Deezer.exe (Entrée pour annuler)' 'Full path to Deezer.exe (Enter to cancel)')).Trim('"', ' ')
    if (-not $DeezerPath -or -not (Test-Path $DeezerPath)) { throw (T 'Installation annulée : Deezer.exe introuvable.' 'Install cancelled: Deezer.exe not found.') }
  }
  if (-not $Update) { Write-BdOk (T 'Deezer trouvé' 'Deezer found') ("$((Get-Item $DeezerPath).VersionInfo.ProductVersion)  " + (Format-BdPath $DeezerPath)) }

  # 3. Files
  $null = New-Item -ItemType Directory -Force -Path $Dest
  foreach ($f in $Files) { Get-BdFile $f (Join-Path $Dest $f) }
  if (-not $version) { $version = Get-PayloadVersion (Join-Path $Dest 'better-deezer.user.js') }
  if (-not $version) { $version = 'unknown' }
  @{ DeezerPath = $DeezerPath; Version = $version; InstalledAt = (Get-Date).ToString('s') } |
    ConvertTo-Json | Set-Content -Encoding UTF8 (Join-Path $Dest 'config.json')
  Write-BdOk (T 'Fichiers installés' 'Files installed') ("v$version  " + (Format-BdPath $Dest))

  # 4. The better-deezer command
  $bin = Join-Path $Dest 'bin'
  $null = New-Item -ItemType Directory -Force -Path $bin
  Set-Content -Encoding ASCII -Path (Join-Path $bin 'better-deezer.cmd') -Value @(
    '@echo off',
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0..\cli.ps1" %*'
  )
  $pathAdded = Add-BdToPath $bin
  if (-not $Update) { Write-BdOk (T 'Commande better-deezer' 'better-deezer command') $(if ($pathAdded) { T 'ajoutée au PATH' 'added to PATH' } else { T 'déjà dans le PATH' 'already on PATH' }) }

  # 5. Old launcher (first versions): stop it, remove its shortcuts and files.
  $launchers = @(Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -and $_.CommandLine -like '*BetterDeezer*launcher.ps1*' })
  foreach ($p in $launchers) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
  $old = $launchers.Count -gt 0
  foreach ($s in @(
      (Join-Path ([Environment]::GetFolderPath('Programs')) 'Better Deezer.lnk'),
      (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Better Deezer.lnk'),
      (Join-Path $Dest 'launcher.ps1'), (Join-Path $Dest 'launcher.log'), (Join-Path $Dest 'launcher.log.old'))) {
    if (Test-Path $s) { Remove-Item -Force $s; $old = $true }
  }
  if ($old) { Write-BdInfo (T 'Ancien lanceur retiré' 'Old launcher removed') (T 'raccourcis « Better Deezer » supprimés' '"Better Deezer" shortcuts deleted') }

  # 6. Patch Deezer (closes and restarts it if it was running).
  $patch = Join-Path $Dest 'patch.ps1'
  if (& $patch -Check -DeezerPath $DeezerPath) {
    if (-not $Update) { Write-BdOk (T 'Deezer déjà modifié' 'Deezer already patched') }
  } else {
    $wasRunning = @(Get-Process -Name 'Deezer' -ErrorAction SilentlyContinue).Count -gt 0
    try {
      $null = & $patch -DeezerPath $DeezerPath 6>$null
    } catch {
      if ("$_" -match 'denied|refus') {
        throw (T 'Impossible de modifier Deezer : accès refusé. Si Deezer est installé dans Program Files, relancez l''installation dans un PowerShell ouvert en administrateur.' 'Cannot modify Deezer: access denied. If Deezer is installed in Program Files, run the install again from a PowerShell opened as administrator.')
      }
      throw
    }
    Write-BdOk (T 'Deezer modifié' 'Deezer patched') (T 'Better Deezer est intégré à l''application' 'Better Deezer is now part of the app')
    if ($wasRunning) { Write-BdInfo (T 'Deezer a été redémarré' 'Deezer was restarted') }
  }

  # 7. Re-apply after Deezer updates (an update replaces app.asar): quietly at each sign-in.
  $null = New-ItemProperty -Force -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'BetterDeezer' -PropertyType String -Value ('"{0}" -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "{1}" -Quiet' -f $PowerShellExe, $patch)
  if (-not $Update) { Write-BdOk (T 'Réapplication auto' 'Auto re-apply') (T 'après chaque mise à jour de Deezer' 'after every Deezer update') }

  # 8. Settings > Apps entry (per user, no admin)
  $key = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\BetterDeezer'
  $null = New-Item -Force -Path $key
  $uninstall = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "{0}"' -f (Join-Path $Dest 'uninstall.ps1')
  $props = @{
    DisplayName = 'Better Deezer'
    DisplayVersion = $version
    Publisher = 'Better Deezer contributors'
    DisplayIcon = "$DeezerPath,0"
    InstallLocation = $Dest
    UninstallString = $uninstall
    QuietUninstallString = "$uninstall -Quiet"
    URLInfoAbout = "https://github.com/$Repo"
  }
  foreach ($name in $props.Keys) { $null = New-ItemProperty -Force -Path $key -Name $name -Value $props[$name] -PropertyType String }
  $null = New-ItemProperty -Force -Path $key -Name 'NoModify' -Value 1 -PropertyType DWord
  $null = New-ItemProperty -Force -Path $key -Name 'NoRepair' -Value 1 -PropertyType DWord
  if (-not $Update) { Write-BdOk (T 'Désinstallation' 'Uninstall') (T 'Paramètres › Applications › Better Deezer' 'Settings › Apps › Better Deezer') }

  if (-not $Update) {
    Write-BdDone ((T 'Better Deezer v{0} est installé. Ouvrez Deezer comme d''habitude.' 'Better Deezer v{0} is installed. Open Deezer as usual.') -f $version)
    Write-BdHint (T 'État et mises à jour :' 'Status and updates:') 'better-deezer status  ·  better-deezer update'
    if ($pathAdded) { Write-Host ('  ' + (T '(dans un nouveau terminal)' '(in a new terminal)')) -ForegroundColor DarkGray }
    Write-Host ''
    if (-not $NoLaunch -and @(Get-Process -Name 'Deezer' -ErrorAction SilentlyContinue).Count -eq 0) {
      Start-Process -FilePath $DeezerPath -WorkingDirectory (Split-Path -Parent $DeezerPath)
    }
  }
} catch {
  if ($Update) { throw } # better-deezer update reports it
  Write-Host ''
  Write-BdFail (T 'Installation interrompue' 'Install stopped') "$_"
  Write-Host ''
  exit 1
}
