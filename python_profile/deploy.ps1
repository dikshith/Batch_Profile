# ====================================================================
# NSSM Windows Service Deployment Script - Profile Comparison Tool
# ====================================================================

#Requires -RunAsAdministrator

param(
    [Parameter(Mandatory=$false)]
    [string]$Action = "install",
    
    [Parameter(Mandatory=$false)]
    [string]$ServiceName = "ProfileComparison",
    
    [Parameter(Mandatory=$false)]
    [string]$InstallPath = "D:\dump2_comparison\sep06_cl",
    
    [Parameter(Mandatory=$false)]
    [string]$SourcePath = $PWD.Path,
    
    [Parameter(Mandatory=$false)]
    [int]$BackendPort = 5000,
    
    [Parameter(Mandatory=$false)]
    [int]$FrontendPort = 8080,
    
    [Parameter(Mandatory=$false)]
    [string]$NSSMPath = "D:\sw\nssm-2.24\win64\nssm.exe"
)

# Configuration
$BackendServiceName = "$ServiceName-Backend"
$FrontendServiceName = "$ServiceName-Frontend"

function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    } else {
        $input | Write-Output
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

function Test-Port {
    param([int]$Port)
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -InformationLevel Quiet -ErrorAction SilentlyContinue
        return $connection
    } catch {
        return $false
    }
}

function Test-NSSM {
    try {
        # Test if NSSM executable exists
        if (-not (Test-Path $NSSMPath)) {
            Write-ColorOutput Red "❌ NSSM not found at: $NSSMPath"
            Write-ColorOutput Yellow "Please ensure NSSM is installed and in PATH, or specify -NSSMPath"
            Write-ColorOutput Yellow "Download NSSM from: https://nssm.cc/download"
            return $false
        }
        
        # Test if NSSM can be executed (it will show help text)
        $nssmTest = & $NSSMPath 2>&1
        if ($nssmTest -match "NSSM.*service manager") {
            Write-ColorOutput Green "✅ NSSM found and working"
            return $true
        } else {
            Write-ColorOutput Red "❌ NSSM found but not working properly"
            return $false
        }
    } catch {
        Write-ColorOutput Red "❌ Error testing NSSM: $_"
        return $false
    }
}

function Deploy-Application {
    Write-ColorOutput Yellow "Deploying application to $InstallPath..."
    
    # Create installation directory
    if (Test-Path $InstallPath) {
        Write-ColorOutput Yellow "Removing existing installation..."
        try {
            Remove-Item -Path $InstallPath -Recurse -Force
        } catch {
            Write-ColorOutput Red "Failed to remove existing installation: $_"
            return $false
        }
    }
    
    try {
        New-Item -ItemType Directory -Path $InstallPath -Force | Out-Null
        
        # Copy application files
        Write-ColorOutput Yellow "Copying application files..."
        Copy-Item -Path "$SourcePath\*" -Destination $InstallPath -Recurse -Force
        
        # Create logs directory
        New-Item -ItemType Directory -Path "$InstallPath\logs" -Force | Out-Null
        
        Write-ColorOutput Green "✅ Application deployed successfully"
        return $true
    } catch {
        Write-ColorOutput Red "❌ Failed to deploy application: $_"
        return $false
    }
}

function Create-BackendService {
    Write-ColorOutput Yellow "Creating backend service with NSSM..."
    
    $backendPath = "$InstallPath\backend"
    $pythonExe = "python"
    $appScript = "$backendPath\app.py"
    
    # Check if Python is available
    try {
        $pythonVersion = & python --version 2>&1
        Write-ColorOutput Green "Using Python: $pythonVersion"
    } catch {
        Write-ColorOutput Red "❌ Python not found in PATH"
        return $false
    }
    
    # Check if app.py exists
    if (-not (Test-Path $appScript)) {
        Write-ColorOutput Red "❌ Backend app.py not found at: $appScript"
        return $false
    }
    
    try {
        # Remove existing service if it exists
        $existingService = Get-Service -Name $BackendServiceName -ErrorAction SilentlyContinue
        if ($existingService) {
            Write-ColorOutput Yellow "Removing existing backend service..."
            & $NSSMPath stop $BackendServiceName | Out-Null
            & $NSSMPath remove $BackendServiceName confirm | Out-Null
            Start-Sleep -Seconds 2
        }
        
        # Install new service
        & $NSSMPath install $BackendServiceName $pythonExe $appScript
        
        # Configure service
        & $NSSMPath set $BackendServiceName DisplayName "Profile Comparison Backend"
        & $NSSMPath set $BackendServiceName Description "Python Profile Dump Comparison Backend Service"
        & $NSSMPath set $BackendServiceName Start SERVICE_AUTO_START
        & $NSSMPath set $BackendServiceName AppDirectory $backendPath
        & $NSSMPath set $BackendServiceName AppStdout "$InstallPath\logs\backend-stdout.log"
        & $NSSMPath set $BackendServiceName AppStderr "$InstallPath\logs\backend-stderr.log"
        & $NSSMPath set $BackendServiceName AppRotateFiles 1
        & $NSSMPath set $BackendServiceName AppRotateOnline 1
        & $NSSMPath set $BackendServiceName AppRotateSeconds 86400
        & $NSSMPath set $BackendServiceName AppRotateBytes 1048576
        
        # Set environment variables
        & $NSSMPath set $BackendServiceName AppEnvironmentExtra "FLASK_ENV=production"
        
        Write-ColorOutput Green "✅ Backend service created: $BackendServiceName"
        return $true
    } catch {
        Write-ColorOutput Red "❌ Failed to create backend service: $_"
        return $false
    }
}

function Create-FrontendService {
    Write-ColorOutput Yellow "Creating frontend service with NSSM..."
    
    $frontendPath = "$InstallPath\frontend"
    
    # Look for built frontend
    $distPaths = @(
        "$frontendPath\dist\python-profile-comparison",
        "$frontendPath\dist",
        "$frontendPath\build",
        $frontendPath
    )
    
    $distPath = $null
    foreach ($path in $distPaths) {
        if (Test-Path "$path\index.html") {
            $distPath = $path
            break
        }
    }
    
    if (-not $distPath) {
        Write-ColorOutput Red "❌ Frontend files not found. Please build the frontend first."
        Write-ColorOutput Yellow "Expected locations: $($distPaths -join ', ')"
        return $false
    }
    
    Write-ColorOutput Green "Found frontend files at: $distPath"
    
    # Create simple HTTP server using PowerShell
    $serverScript = @"
param([int]`$Port = $FrontendPort)

`$listener = New-Object System.Net.HttpListener
`$listener.Prefixes.Add("http://+:`$Port/")

try {
    `$listener.Start()
    Write-Host "Frontend server started on port `$Port"
    Write-Host "Serving from: $distPath"
    
    while (`$listener.IsListening) {
        `$context = `$listener.GetContext()
        `$request = `$context.Request
        `$response = `$context.Response
        
        # Add CORS headers
        `$response.Headers.Add("Access-Control-Allow-Origin", "*")
        `$response.Headers.Add("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        `$response.Headers.Add("Access-Control-Allow-Headers", "Content-Type, Authorization")
        
        # Handle preflight requests
        if (`$request.HttpMethod -eq "OPTIONS") {
            `$response.StatusCode = 200
            `$response.OutputStream.Close()
            continue
        }
        
        # Get requested file path
        `$urlPath = `$request.Url.LocalPath
        if (`$urlPath -eq "/") { `$urlPath = "/index.html" }
        
        `$filePath = Join-Path "$distPath" `$urlPath.TrimStart('/')
        
        # Serve index.html for Angular routes (SPA)
        if (-not (Test-Path `$filePath) -and `$urlPath -ne "/index.html") {
            `$filePath = Join-Path "$distPath" "index.html"
        }
        
        if (Test-Path `$filePath) {
            `$content = [System.IO.File]::ReadAllBytes(`$filePath)
            `$response.ContentLength64 = `$content.Length
            
            # Set content type
            `$extension = [System.IO.Path]::GetExtension(`$filePath).ToLower()
            switch (`$extension) {
                ".html" { `$response.ContentType = "text/html; charset=utf-8" }
                ".js"   { `$response.ContentType = "application/javascript; charset=utf-8" }
                ".css"  { `$response.ContentType = "text/css; charset=utf-8" }
                ".json" { `$response.ContentType = "application/json; charset=utf-8" }
                ".png"  { `$response.ContentType = "image/png" }
                ".jpg"  { `$response.ContentType = "image/jpeg" }
                ".jpeg" { `$response.ContentType = "image/jpeg" }
                ".gif"  { `$response.ContentType = "image/gif" }
                ".ico"  { `$response.ContentType = "image/x-icon" }
                ".svg"  { `$response.ContentType = "image/svg+xml" }
                ".woff" { `$response.ContentType = "font/woff" }
                ".woff2" { `$response.ContentType = "font/woff2" }
                ".ttf"  { `$response.ContentType = "font/ttf" }
                default { `$response.ContentType = "application/octet-stream" }
            }
            
            `$response.OutputStream.Write(`$content, 0, `$content.Length)
        } else {
            `$response.StatusCode = 404
            `$content = [System.Text.Encoding]::UTF8.GetBytes("File not found: `$urlPath")
            `$response.OutputStream.Write(`$content, 0, `$content.Length)
        }
        
        `$response.OutputStream.Close()
    }
} catch {
    Write-Error "Server error: `$_"
} finally {
    if (`$listener.IsListening) {
        `$listener.Stop()
    }
}
"@
    
    $serverScriptPath = "$frontendPath\server.ps1"
    $serverScript | Out-File -FilePath $serverScriptPath -Encoding UTF8
    
    try {
        # Remove existing service if it exists
        $existingService = Get-Service -Name $FrontendServiceName -ErrorAction SilentlyContinue
        if ($existingService) {
            Write-ColorOutput Yellow "Removing existing frontend service..."
            & $NSSMPath stop $FrontendServiceName | Out-Null
            & $NSSMPath remove $FrontendServiceName confirm | Out-Null
            Start-Sleep -Seconds 2
        }
        
        # Install new service
        & $NSSMPath install $FrontendServiceName "powershell.exe" "-ExecutionPolicy Bypass -File `"$serverScriptPath`" -Port $FrontendPort"
        
        # Configure service
        & $NSSMPath set $FrontendServiceName DisplayName "Profile Comparison Frontend"
        & $NSSMPath set $FrontendServiceName Description "Angular Frontend for Profile Comparison Tool"
        & $NSSMPath set $FrontendServiceName Start SERVICE_AUTO_START
        & $NSSMPath set $FrontendServiceName AppDirectory $frontendPath
        & $NSSMPath set $FrontendServiceName AppStdout "$InstallPath\logs\frontend-stdout.log"
        & $NSSMPath set $FrontendServiceName AppStderr "$InstallPath\logs\frontend-stderr.log"
        & $NSSMPath set $FrontendServiceName AppRotateFiles 1
        & $NSSMPath set $FrontendServiceName AppRotateOnline 1
        & $NSSMPath set $FrontendServiceName AppRotateSeconds 86400
        & $NSSMPath set $FrontendServiceName AppRotateBytes 1048576
        
        # Set dependency on backend service
        & $NSSMPath set $FrontendServiceName DependOnService $BackendServiceName
        
        Write-ColorOutput Green "✅ Frontend service created: $FrontendServiceName"
        return $true
    } catch {
        Write-ColorOutput Red "❌ Failed to create frontend service: $_"
        return $false
    }
}

function Start-Services {
    Write-ColorOutput Yellow "Starting services..."
    
    # Start backend service
    Write-ColorOutput Yellow "Starting backend service..."
    try {
        & $NSSMPath start $BackendServiceName
        Start-Sleep -Seconds 5
        
        $backendService = Get-Service -Name $BackendServiceName -ErrorAction SilentlyContinue
        if ($backendService -and $backendService.Status -eq "Running") {
            Write-ColorOutput Green "✅ Backend service started"
            
            # Wait for backend to be ready
            $attempts = 0
            do {
                Start-Sleep -Seconds 2
                $attempts++
                $backendReady = Test-Port -Port $BackendPort
            } while (-not $backendReady -and $attempts -lt 30)
            
            if ($backendReady) {
                Write-ColorOutput Green "✅ Backend responding on port $BackendPort"
            } else {
                Write-ColorOutput Yellow "⚠️ Backend service started but not responding on port $BackendPort"
            }
        } else {
            Write-ColorOutput Red "❌ Backend service failed to start"
            return
        }
    } catch {
        Write-ColorOutput Red "❌ Failed to start backend service: $_"
        return
    }
    
    # Start frontend service
    Write-ColorOutput Yellow "Starting frontend service..."
    try {
        & $NSSMPath start $FrontendServiceName
        Start-Sleep -Seconds 5
        
        $frontendService = Get-Service -Name $FrontendServiceName -ErrorAction SilentlyContinue
        if ($frontendService -and $frontendService.Status -eq "Running") {
            Write-ColorOutput Green "✅ Frontend service started"
            
            # Wait for frontend to be ready
            $attempts = 0
            do {
                Start-Sleep -Seconds 2
                $attempts++
                $frontendReady = Test-Port -Port $FrontendPort
            } while (-not $frontendReady -and $attempts -lt 30)
            
            if ($frontendReady) {
                Write-ColorOutput Green "✅ Frontend responding on port $FrontendPort"
            } else {
                Write-ColorOutput Yellow "⚠️ Frontend service started but not responding on port $FrontendPort"
            }
        } else {
            Write-ColorOutput Red "❌ Frontend service failed to start"
        }
    } catch {
        Write-ColorOutput Red "❌ Failed to start frontend service: $_"
    }
}

function Stop-Services {
    Write-ColorOutput Yellow "Stopping services..."
    
    try {
        & $NSSMPath stop $FrontendServiceName | Out-Null
        Write-ColorOutput Green "✅ Frontend service stopped"
    } catch {
        Write-ColorOutput Yellow "⚠️ Frontend service was not running"
    }
    
    Start-Sleep -Seconds 2
    
    try {
        & $NSSMPath stop $BackendServiceName | Out-Null
        Write-ColorOutput Green "✅ Backend service stopped"
    } catch {
        Write-ColorOutput Yellow "⚠️ Backend service was not running"
    }
}

function Remove-Services {
    Write-ColorOutput Yellow "Removing services..."
    
    # Stop services first
    Stop-Services
    Start-Sleep -Seconds 3
    
    # Remove services
    try {
        & $NSSMPath remove $FrontendServiceName confirm | Out-Null
        Write-ColorOutput Green "✅ Frontend service removed"
    } catch {
        Write-ColorOutput Yellow "⚠️ Frontend service was not installed"
    }
    
    try {
        & $NSSMPath remove $BackendServiceName confirm | Out-Null
        Write-ColorOutput Green "✅ Backend service removed"
    } catch {
        Write-ColorOutput Yellow "⚠️ Backend service was not installed"
    }
}

function Show-ServiceStatus {
    Write-ColorOutput Cyan "=== Service Status ==="
    
    try {
        $backendService = Get-Service -Name $BackendServiceName -ErrorAction SilentlyContinue
        if ($backendService) {
            $backendColor = if ($backendService.Status -eq "Running") { "Green" } else { "Red" }
            Write-ColorOutput $backendColor "Backend ($BackendServiceName): $($backendService.Status)"
            
            if ($backendService.Status -eq "Running") {
                $backendReady = Test-Port -Port $BackendPort
                $statusText = if ($backendReady) { "✅ Responding" } else { "❌ Not Responding" }
                Write-ColorOutput $backendColor "  Port $BackendPort`: $statusText"
            }
        } else {
            Write-ColorOutput Red "Backend Service: Not Installed"
        }
        
        $frontendService = Get-Service -Name $FrontendServiceName -ErrorAction SilentlyContinue
        if ($frontendService) {
            $frontendColor = if ($frontendService.Status -eq "Running") { "Green" } else { "Red" }
            Write-ColorOutput $frontendColor "Frontend ($FrontendServiceName): $($frontendService.Status)"
            
            if ($frontendService.Status -eq "Running") {
                $frontendReady = Test-Port -Port $FrontendPort
                $statusText = if ($frontendReady) { "✅ Responding" } else { "❌ Not Responding" }
                Write-ColorOutput $frontendColor "  Port $FrontendPort`: $statusText"
            }
        } else {
            Write-ColorOutput Red "Frontend Service: Not Installed"
        }
        
    } catch {
        Write-ColorOutput Red "Error checking service status: $_"
    }
    
    Write-ColorOutput Cyan ""
    Write-ColorOutput Cyan "=== Access URLs ==="
    Write-ColorOutput Cyan "Frontend: http://localhost:$FrontendPort"
    Write-ColorOutput Cyan "Backend API: http://localhost:$BackendPort/api/health"
}

function Show-Help {
    Write-ColorOutput Cyan @"
Profile Comparison Tool - NSSM Windows Service Deployment

USAGE:
    .\deploy.ps1 [ACTION] [OPTIONS]

ACTIONS:
    install     - Deploy app, create and start services (default)
    uninstall   - Stop and remove services
    start       - Start services
    stop        - Stop services
    restart     - Restart services
    status      - Show service status

OPTIONS:
    -ServiceName     Service name prefix (default: ProfileComparison)
    -InstallPath     Installation directory (default: D:\dump2_comparison\sep06_cl)
    -SourcePath      Source code directory (default: current directory)
    -BackendPort     Backend port (default: 5000)
    -FrontendPort    Frontend port (default: 8080)
    -NSSMPath        Path to nssm.exe (default: D:\sw\nssm-2.24\win64\nssm.exe)

EXAMPLES:
    .\deploy.ps1
    .\deploy.ps1 -Action status
    .\deploy.ps1 -Action install -FrontendPort 8080
    .\deploy.ps1 -NSSMPath "C:\tools\nssm.exe"

REQUIREMENTS:
    - Run as Administrator
    - NSSM installed and in PATH (or specify -NSSMPath)
    - Python 3.8+ in PATH
    - Frontend built (dist folder with index.html)
"@
}

# Main execution
Write-ColorOutput Green "🚀 Profile Comparison Tool - NSSM Service Deployment"
Write-ColorOutput Green "===================================================="

# Check if running as administrator
if (-NOT ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole] "Administrator")) {
    Write-ColorOutput Red "❌ This script requires Administrator privileges"
    Write-ColorOutput Yellow "Please run PowerShell as Administrator"
    exit 1
}

# Check NSSM availability
if (-not (Test-NSSM)) {
    exit 1
}

switch ($Action.ToLower()) {
    "install" {
        Write-ColorOutput Yellow "Installing services..."
        
        if (-not (Deploy-Application)) { exit 1 }
        
        $backendCreated = Create-BackendService
        $frontendCreated = Create-FrontendService
        
        if ($backendCreated -and $frontendCreated) {
            Start-Services
            Show-ServiceStatus
            Write-ColorOutput Green "🎉 Installation completed!"
            Write-ColorOutput Cyan "Access: http://localhost:$FrontendPort"
        } else {
            Write-ColorOutput Red "❌ Service creation failed"
            exit 1
        }
    }
    
    "uninstall" {
        Remove-Services
        if (Test-Path $InstallPath) {
            Remove-Item -Path $InstallPath -Recurse -Force
            Write-ColorOutput Green "✅ Installation directory removed"
        }
        Write-ColorOutput Green "🎉 Uninstallation completed!"
    }
    
    "start" {
        Start-Services
        Show-ServiceStatus
    }
    
    "stop" {
        Stop-Services
        Show-ServiceStatus
    }
    
    "restart" {
        Stop-Services
        Start-Sleep -Seconds 5
        Start-Services
        Show-ServiceStatus
    }
    
    "status" {
        Show-ServiceStatus
    }
    
    "help" {
        Show-Help
    }
    
    default {
        Write-ColorOutput Red "Unknown action: $Action"
        Show-Help
        exit 1
    }
}