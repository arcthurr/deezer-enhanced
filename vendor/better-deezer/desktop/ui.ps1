<#
.SYNOPSIS
  ui.ps1: shared console look for the Better Deezer scripts (dot-sourced).

.DESCRIPTION
  One style everywhere (setup, update, uninstall, the better-deezer command):

     ▌ Better Deezer  1.1.0
     ▌ Installation dans l'application Deezer

     ● Deezer trouvé          C:\Users\...\Deezer.exe
     ● Deezer modifié
     ▲ Something to know
     × Something failed

  Only characters every Windows console font has (block, circle, triangle,
  multiplication sign), in the 16 console colors. French when Windows is in
  French, English otherwise.
#>

$script:BdFrench = (Get-UICulture).TwoLetterISOLanguageName -eq 'fr'

function T {
  param([string]$Fr, [string]$En)
  if ($script:BdFrench) { return $Fr } else { return $En }
}

function Write-BdBanner {
  param([string]$Subtitle, [string]$Version)
  Write-Host ''
  Write-Host '  ▌ ' -ForegroundColor Magenta -NoNewline
  Write-Host 'Better Deezer' -ForegroundColor White -NoNewline
  if ($Version) { Write-Host "  $Version" -ForegroundColor DarkGray } else { Write-Host '' }
  if ($Subtitle) {
    Write-Host '  ▌ ' -ForegroundColor Magenta -NoNewline
    Write-Host $Subtitle -ForegroundColor Gray
  }
  Write-Host ''
}

# A line: colored mark, label padded to a column, optional dim detail.
function Write-BdLine {
  param([string]$Mark, [ConsoleColor]$Color, [string]$Label, [string]$Detail)
  Write-Host "  $Mark " -ForegroundColor $Color -NoNewline
  if ($Detail) {
    Write-Host ($Label.PadRight(26)) -NoNewline
    Write-Host $Detail -ForegroundColor DarkGray
  } else {
    Write-Host $Label
  }
}

function Write-BdOk { param([string]$Label, [string]$Detail) Write-BdLine '●' Green $Label $Detail }
function Write-BdStep { param([string]$Label, [string]$Detail) Write-BdLine '›' Magenta $Label $Detail }
function Write-BdWarn { param([string]$Label, [string]$Detail) Write-BdLine '▲' Yellow $Label $Detail }
function Write-BdFail { param([string]$Label, [string]$Detail) Write-BdLine '×' Red $Label $Detail }
function Write-BdInfo { param([string]$Label, [string]$Detail) Write-BdLine '·' DarkGray $Label $Detail }

# Closing line in color, then a blank line.
function Write-BdDone {
  param([string]$Message, [ConsoleColor]$Color = 'Green')
  Write-Host ''
  Write-Host "  $Message" -ForegroundColor $Color
  Write-Host ''
}

# Hint with a command to type: "  Text  command".
function Write-BdHint {
  param([string]$Text, [string]$Command)
  Write-Host "  $Text " -ForegroundColor DarkGray -NoNewline
  Write-Host $Command -ForegroundColor Magenta
}

# Yes / no question; Enter takes the default.
function Read-BdConfirm {
  param([string]$Question, [bool]$Default = $true)
  $choices = if ($Default) { T '(O/n)' '(Y/n)' } else { T '(o/N)' '(y/N)' }
  Write-Host "  ? " -ForegroundColor Magenta -NoNewline
  $answer = (Read-Host "$Question $choices").Trim().ToLowerInvariant()
  if (-not $answer) { return $Default }
  return $answer -match '^(o|oui|y|yes)$'
}

# Shorten paths under the user's folders for display.
function Format-BdPath {
  param([string]$Path)
  if (-not $Path) { return '' }
  $local = $env:LOCALAPPDATA
  if ($local -and $Path.StartsWith($local, [StringComparison]::OrdinalIgnoreCase)) { return '%LOCALAPPDATA%' + $Path.Substring($local.Length) }
  return $Path
}
