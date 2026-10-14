param([switch]$NoPause, [string]$DesktopDirectory)
$ErrorActionPreference = 'Stop'
$projectDirectory = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
if (-not $DesktopDirectory) { $DesktopDirectory = [Environment]::GetFolderPath('Desktop') }
if (-not (Test-Path -LiteralPath $DesktopDirectory -PathType Container)) { throw 'Your Windows desktop folder is unavailable.' }
$launcher = Join-Path $projectDirectory 'Start-Sardar-Pharmacy.bat'
if (-not (Test-Path -LiteralPath $launcher)) { throw 'Pharmacy launcher is missing. Extract the entire GitHub ZIP first.' }
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut((Join-Path $DesktopDirectory 'Sardar Medical Store.lnk'))
$shortcut.TargetPath = $launcher
$shortcut.WorkingDirectory = $projectDirectory
$shortcut.Description = 'Start Sardar Medical Store with Docker'
$shortcut.WindowStyle = 7
$shortcut.IconLocation = "$env:SystemRoot\System32\shell32.dll,14"
$shortcut.Save()
Write-Host 'Desktop shortcut ready: Sardar Medical Store'
if (-not $NoPause) { Read-Host 'Press Enter to close' }
