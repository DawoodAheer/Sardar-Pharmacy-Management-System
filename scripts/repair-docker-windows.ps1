$ErrorActionPreference = 'Stop'
$identity = [Security.Principal.WindowsIdentity]::GetCurrent()
$principal = New-Object Security.Principal.WindowsPrincipal($identity)
if (-not $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
    $process = Start-Process powershell -Verb RunAs -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', ('"' + $PSCommandPath + '"')) -Wait -PassThru
    exit $process.ExitCode
}
try {
    $processor = Get-CimInstance Win32_Processor
    if ($processor.VirtualizationFirmwareEnabled -contains $false) { throw 'Enable virtualization in BIOS/UEFI first. No Windows settings were changed.' }
    foreach ($featureName in @('Microsoft-Windows-Subsystem-Linux', 'VirtualMachinePlatform')) {
        $feature = Get-WindowsOptionalFeature -Online -FeatureName $featureName
        if ($feature.State -ne 'Enabled') {
            Enable-WindowsOptionalFeature -Online -FeatureName $featureName -All -NoRestart | Out-Null
        }
    }
    $boot = & "$env:windir\System32\bcdedit.exe" /enum
    if ($LASTEXITCODE -ne 0) { throw 'Could not inspect Windows boot settings.' }
    if (($boot -join "`n") -match 'hypervisorlaunchtype\s+Off') {
        & "$env:windir\System32\bcdedit.exe" /set hypervisorlaunchtype auto
        if ($LASTEXITCODE -ne 0) { throw 'Could not enable hypervisor startup.' }
    }
    Write-Host 'Save your work and restart Windows. Then open Docker Desktop and Start-Sardar-Pharmacy.bat.' -ForegroundColor Green
    Write-Host 'If the hypervisor error remains, inspect Docker Desktop diagnostics before changing other boot settings.'
    Read-Host 'Press Enter to close'
} catch {
    Write-Host $_.Exception.Message -ForegroundColor Red
    Read-Host 'Press Enter to close'
    exit 1
}
