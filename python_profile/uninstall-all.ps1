<# ==========================================
 Profile Comparison Tool - Uninstaller
 NO winget/choco. Uses existing NSSM only.
 Stops & removes the two services.
========================================== #>

$BackendSvc = "ProfileComparison.Backend"
$FrontendSvc = "ProfileComparison.Frontend"

# If NSSM is in PATH this finds it; otherwise set $NssmExe manually.
$NssmExe = (Get-Command nssm -ErrorAction SilentlyContinue).Path
if (-not $NssmExe) { $NssmExe = "D:\sw\nssm-2.24\win64\nssm.exe" }

if (-not (Test-Path $NssmExe)) {
  Write-Host "ERROR: NSSM not found. Set `$NssmExe to the full path of nssm.exe." -ForegroundColor Red
  exit 1
}

& $NssmExe stop   $FrontendSvc 2>$null
& $NssmExe remove $FrontendSvc confirm 2>$null

& $NssmExe stop   $BackendSvc 2>$null
& $NssmExe remove $BackendSvc confirm 2>$null

Write-Host "Removed services: $BackendSvc, $FrontendSvc" -ForegroundColor Green