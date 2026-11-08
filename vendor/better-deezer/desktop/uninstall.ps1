#Requires -Version 5.1
<#
.SYNOPSIS
  Removes Better Deezer (desktop) and puts Deezer back to its original behaviour.

.DESCRIPTION
  Takes the hook out of Deezer's app.asar (patch.ps1 -Remove), removes the
  better-deezer command from the user PATH, the sign-in entry, the Settings >
  Apps entry and %LOCALAPPDATA%\BetterDeezer. Started from Settings > Apps,
  "better-deezer uninstall", or:
    powershell -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\BetterDeezer\uninstall.ps1"

.PARAMETER Quiet
  No questions, no pause at the end.
#>
[CmdletBinding()]
param([switch]$Quiet)

Set-StrictMode -Version 2.0
$ErrorActionPreference = 'Continue'

$Dest = Join-Path $env:LOCALAPPDATA 'BetterDeezer'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$ui = Join-Path $Here 'ui.ps1'
if (Test-Path $ui) {
  . $ui
} else {
  # Minimal fallback (ui.ps1 already deleted): plain lines.
  function T { param([string]$Fr, [string]$En) if ((Get-UICulture).TwoLetterISOLanguageName -eq 'fr') { $Fr } else { $En } }
  function Write-BdBanner { param([string]$Subtitle, [string]$Version) Write-Host ''; Write-Host "  Better Deezer  $Subtitle $Version"; Write-Host '' }
  function Write-BdOk { param([string]$Label, [string]$Detail) Write-Host "  + $Label  $Detail" }
  function Write-BdInfo { param([string]$Label, [string]$Detail) Write-Host "  . $Label  $Detail" -ForegroundColor DarkGray }
  function Write-BdWarn { param([string]$Label, [string]$Detail) Write-Host "  ! $Label  $Detail" -ForegroundColor Yellow }
  function Write-BdDone { param([string]$Message) Write-Host ''; Write-Host "  $Message" -ForegroundColor Green; Write-Host '' }
  function Read-BdConfirm { param([string]$Question) (Read-Host "$Question (O/n)") -notmatch '^(n|no|non)$' }
}

Write-BdBanner -Subtitle (T 'Désinstallation' 'Uninstall')

if (-not $Quiet) {
  if (-not (Read-BdConfirm (T 'Désinstaller Better Deezer ? Deezer sera fermé s''il est ouvert.' 'Uninstall Better Deezer? Deezer will be closed if it is open.'))) {
    Write-Host ''
    return
  }
  Write-Host ''
}

# 1. Unpatch Deezer. Even if this fails (Deezer uninstalled, updated...), keep cleaning up:
#    without the skin file next to it, a leftover hook does nothing.
$patch = Join-Path $Dest 'patch.ps1'
if (Test-Path $patch) {
  try {
    $null = & $patch -Remove 6>$null
    Write-BdOk (T 'Deezer remis d''origine' 'Deezer restored')
  } catch {
    Write-BdWarn (T 'Deezer n''a pas pu être restauré' 'Could not restore Deezer') "$_"
  }
}

# 2. Sign-in entry, Settings > Apps entry.
Remove-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run' -Name 'BetterDeezer' -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\BetterDeezer' -ErrorAction SilentlyContinue
Write-BdOk (T 'Entrées Windows retirées' 'Windows entries removed') (T 'démarrage, Paramètres › Applications' 'sign-in, Settings › Apps')

# 3. The better-deezer command: its folder off the user PATH.
$key = [Microsoft.Win32.Registry]::CurrentUser.OpenSubKey('Environment', $true)
if ($key) {
  try {
    $current = [string]$key.GetValue('Path', '', [Microsoft.Win32.RegistryValueOptions]::DoNotExpandEnvironmentNames)
    $bin = Join-Path $Dest 'bin'
    $parts = @($current -split ';' | Where-Object { $_ -and $_ -ine '%LOCALAPPDATA%\BetterDeezer\bin' -and $_ -ine $bin })
    if ($parts.Count -ne @($current -split ';' | Where-Object { $_ }).Count) {
      $key.SetValue('Path', ($parts -join ';'), [Microsoft.Win32.RegistryValueKind]::ExpandString)
      Write-BdOk (T 'Commande better-deezer retirée' 'better-deezer command removed')
    }
  } finally { $key.Close() }
}

# 4. Shortcuts and process of the old launcher (first versions).
Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe' OR Name = 'pwsh.exe'" -ErrorAction SilentlyContinue |
  Where-Object { $_.CommandLine -and $_.CommandLine -like '*BetterDeezer*launcher.ps1*' } |
  ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
foreach ($s in @(
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'Better Deezer.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'Better Deezer.lnk'))) {
  if (Test-Path $s) { Remove-Item -Force $s }
}

# 5. Files. This script may live in the folder: delete it from a detached cmd once we exit.
if (Test-Path $Dest) {
  $inside = $PSCommandPath -and $PSCommandPath.StartsWith($Dest, [StringComparison]::OrdinalIgnoreCase)
  if ($inside) {
    Start-Process -FilePath 'cmd.exe' -WindowStyle Hidden -ArgumentList @('/c', "timeout /t 2 /nobreak >nul & rmdir /s /q `"$Dest`"")
  } else {
    Remove-Item -Recurse -Force $Dest
  }
  Write-BdOk (T 'Fichiers supprimés' 'Files deleted') '%LOCALAPPDATA%\BetterDeezer'
}

Write-BdDone (T 'Better Deezer est désinstallé. Deezer fonctionne comme avant.' 'Better Deezer is uninstalled. Deezer works as before.')
Write-BdInfo (T 'Vos réglages Better Deezer restent dans Deezer jusqu''à ce que vous vidiez son cache.' 'Your Better Deezer settings stay in Deezer''s storage until you clear its cache.')
Write-Host ''
if (-not $Quiet) { Start-Sleep -Seconds 3 }
