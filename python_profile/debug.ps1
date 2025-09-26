# Save this as debug.ps1
Write-Host "Starting debug script..."

# Check admin status
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")
Write-Host "Running as Admin: $isAdmin"

# Check NSSM
$nssmPath = "D:\sw\nssm-2.24\win64\nssm.exe"
$nssmExists = Test-Path $nssmPath
Write-Host "NSSM exists at $nssmPath`: $nssmExists"

if ($nssmExists) {
    try {
        $nssmVersion = & $nssmPath version 2>&1
        Write-Host "NSSM Version: $nssmVersion"
        Write-Host "Exit Code: $LASTEXITCODE"
    } catch {
        Write-Host "Error running NSSM: $_"
    }
}

Write-Host "Debug script completed."