<#
.SYNOPSIS
  Better Deezer installer bootstrap (Windows 10/11, no admin rights).

.DESCRIPTION
  One line in PowerShell:
    irm https://github.com/Gabizoc/Better-Deezer/releases/latest/download/install.ps1 | iex

  This file is plain ASCII on purpose: "irm | iex" may decode it with the wrong
  charset. It downloads the release files to %TEMP%\BetterDeezer-setup (or uses
  the ones next to it in an extracted release zip) and runs setup.ps1 as a real
  file, which does the actual install and draws the real interface.
  See setup.ps1 for what is installed.

  Options for setup.ps1 through environment variables (handy with iex):
    $env:BD_DEEZER_PATH = 'D:\Apps\Deezer\Deezer.exe'   unusual Deezer location
#>
$ErrorActionPreference = 'Stop'
$repo = 'Gabizoc/Better-Deezer'
$files = @('setup.ps1', 'patch.ps1', 'uninstall.ps1', 'cli.ps1', 'ui.ps1', 'better-deezer.user.js')
$here = $null
if ($PSScriptRoot -and (Test-Path (Join-Path $PSScriptRoot 'setup.ps1'))) { $here = $PSScriptRoot }

if (-not $here) {
  if ($PSVersionTable.PSVersion.Major -lt 5) { throw 'Better Deezer needs Windows PowerShell 5.1 or later.' }
  [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
  $here = Join-Path $env:TEMP 'BetterDeezer-setup'
  $null = New-Item -ItemType Directory -Force -Path $here
  Write-Host ''
  Write-Host '  > ' -ForegroundColor Magenta -NoNewline
  Write-Host 'Better Deezer' -ForegroundColor White -NoNewline
  Write-Host ('  downloading {0} files from GitHub...' -f $files.Count) -ForegroundColor DarkGray
  $ProgressPreference = 'SilentlyContinue'
  $failure = $null
  try {
    foreach ($f in $files) {
      Invoke-WebRequest -UseBasicParsing -Uri "https://github.com/$repo/releases/latest/download/$f" -OutFile (Join-Path $here $f)
    }
  } catch { $failure = $_.Exception.Message }

  # If the direct download fails (proxy, blocked github.com, an error that Windows
  # PowerShell 5.1 may report as "connection closed"), a signed-in GitHub CLI can
  # often still fetch the release.
  if ($failure -and (Get-Command gh -ErrorAction SilentlyContinue)) {
    Write-Host '    trying GitHub CLI (gh)...' -ForegroundColor DarkGray
    $patterns = @(); foreach ($f in $files) { $patterns += @('--pattern', $f) }
    & gh release download --repo $repo --dir $here --clobber @patterns 2>$null
    $missing = @($files | Where-Object { -not (Test-Path (Join-Path $here $_)) })
    if ($LASTEXITCODE -eq 0 -and $missing.Count -eq 0) { $failure = $null }
  }

  if ($failure) {
    Write-Host ''
    Write-Host '  x ' -ForegroundColor Red -NoNewline
    Write-Host ('Download failed: {0}' -f $failure)
    Write-Host '    Check your connection and try again, or download better-deezer-windows.zip from' -ForegroundColor DarkGray
    Write-Host "    https://github.com/$repo/releases and run install.ps1 from it." -ForegroundColor DarkGray
    Write-Host ''
    return
  }
}

$argList = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', (Join-Path $here 'setup.ps1'))
$ps = Join-Path $env:WINDIR 'System32\WindowsPowerShell\v1.0\powershell.exe'
& $ps @argList
