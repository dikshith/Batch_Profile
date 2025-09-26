<# ==========================================================
 Profile Comparison Tool - Full Installer (Dev/Prod switch)
 - No winget/choco/venv. Uses existing Python/Node/NSSM.
 - Backend: installs Python deps (system Python), runs app.py as service
 - Frontend:
     * prod: cleans locks, installs deps, builds Angular, serves dist via http-server
     * dev : cleans locks, installs deps, runs ng serve
 - Opens firewall ports
 Run as: Administrator PowerShell
 Usage:
   PowerShell -NoProfile -ExecutionPolicy Bypass -File .\install-all.ps1 -Mode prod
   PowerShell -NoProfile -ExecutionPolicy Bypass -File .\install-all.ps1 -Mode dev
========================================================== #>

param(
  [ValidateSet('dev','prod')] [string]$Mode = 'prod',
  [int]$BackendPort = 5000,
  [int]$FrontendPort = 4200,
  [string]$Root = "D:\dump2_comparison\sep06_cl",
  [string]$NssmExe = "D:\sw\nssm-2.24\win64\nssm.exe"   # set if NSSM not in PATH
)

$ErrorActionPreference = "Continue"

# -------- Paths/Names --------
$BackendDir  = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"
$LogsDir     = Join-Path $Root "logs"

$BackendSvc  = "ProfileComparison.Backend"
$FrontendSvc  = "ProfileComparison.Frontend"

# -------- Helpers --------
function Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

function Get-PythonPath {
  if (Get-Command py -ErrorAction SilentlyContinue) {
    $out = & py -3 -c "import sys; print(sys.executable)" 2>$null
    if ($LASTEXITCODE -eq 0 -and $out) { return $out.Trim() }
  }
  if (Get-Command python -ErrorAction SilentlyContinue) {
    $out = & python -c "import sys; print(sys.executable)" 2>$null
    if ($LASTEXITCODE -eq 0 -and $out) { return $out.Trim() }
  }
  Fail "Python 3 not found in PATH."
}

function Resolve-Node  { $n = Get-Command node -ErrorAction SilentlyContinue; if ($n) { $n.Path } else { Fail "node.exe not found in PATH." } }
function Resolve-NPM   { $n = Get-Command npm  -ErrorAction SilentlyContinue; if ($n) { $n.Path } else { Fail "npm not found in PATH." } }

function Resolve-NSSM {
  if ($NssmExe -and (Test-Path $NssmExe)) { return $NssmExe }
  $cmd = Get-Command nssm -ErrorAction SilentlyContinue
  if ($cmd) { return $cmd.Path }
  Fail "NSSM not found. Set -NssmExe to nssm.exe or add it to PATH."
}

function Stop-ServiceIfExists([string]$name, [string]$nssmPath) {
  $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
  if ($svc) { & $nssmPath stop $name 2>$null | Out-Null }
}

function Remove-ServiceIfExists([string]$name, [string]$nssmPath) {
  $svc = Get-Service -Name $name -ErrorAction SilentlyContinue
  if ($svc) {
    & $nssmPath stop $name 2>$null | Out-Null
    Start-Sleep -Seconds 1
    & $nssmPath remove $name confirm 2>$null | Out-Null
  }
}

# Kill node/ng/npm holding locks
function Stop-NodeProcessesUsingPath([string]$path) {
  try {
    $procs = Get-CimInstance Win32_Process | Where-Object {
      ($_.Name -match 'node|npm|ng') -and
      ($_.CommandLine -and ($_.CommandLine -like "*$path*"))
    }
    foreach ($p in $procs) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue }
  } catch {}
}

function Unlock-Tree([string]$path) {
  if (-not (Test-Path $path)) { return }
  & cmd.exe /c "attrib -r -s -h `"$path\*.*`" /s /d" 2> $null
}

function Remove-LockedDir([string]$path) {
  if (-not (Test-Path $path)) { return $true }
  Unlock-Tree $path
  & cmd.exe /c "rmdir /s /q `"$path`"" 2> $null
  Start-Sleep -Milliseconds 300
  if (-not (Test-Path $path)) { return $true }
  $tmp = Join-Path $env:TEMP ("empty_" + [guid]::NewGuid())
  New-Item -ItemType Directory -Force -Path $tmp | Out-Null
  & robocopy $tmp $path /MIR | Out-Null
  Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
  & cmd.exe /c "rmdir /s /q `"$path`"" 2> $null
  Start-Sleep -Milliseconds 300
  return -not (Test-Path $path)
}

# Angular helpers
function Get-AngularProjectName([string]$frontendDir) {
  $angularJson = Join-Path $frontendDir "angular.json"
  if (-not (Test-Path $angularJson)) { Fail "angular.json not found in $frontendDir" }
  try {
    $json = Get-Content $angularJson -Raw | ConvertFrom-Json
    if ($json.defaultProject) { return $json.defaultProject }
    $names = @()
    foreach ($p in $json.projects.PSObject.Properties) { $names += $p.Name }
    if ($names.Count -gt 0) { return $names[0] }
  } catch {}
  Fail "Could not determine Angular project name from angular.json"
}
function Get-AngularDistPath([string]$frontendDir) {
  $angularJson = Join-Path $frontendDir "angular.json"
  if (Test-Path $angularJson) {
    try {
      $json = Get-Content $angularJson -Raw | ConvertFrom-Json
      foreach ($projName in $json.projects.PSObject.Properties.Name) {
        $proj = $json.projects.$projName
        $out1 = $proj.architect.build.options.outputPath
        if ($out1) {
          $p = Join-Path $frontendDir $out1
          if (Test-Path $p) { return (Resolve-Path $p).Path }
        }
      }
    } catch {}
  }
  $dist = Join-Path $frontendDir "dist"
  if (Test-Path $dist) {
    $sub = Get-ChildItem $dist -Directory | Select-Object -First 1
    if ($sub) { return $sub.FullName }
    return $dist
  }
  return $dist
}

# -------- Start --------
Write-Host "`n== Install ($Mode) ==" -ForegroundColor Green
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

$PY   = Get-PythonPath
$NODE = Resolve-Node
$NPM  = Resolve-NPM
$NSSM = Resolve-NSSM
$NodeDir = Split-Path $NODE

Write-Host "Python : $PY"
Write-Host "node   : $NODE"
Write-Host "npm    : $NPM"
Write-Host "nssm   : $NSSM"

# Stop services & locking processes
Stop-ServiceIfExists -name $FrontendSvc -nssmPath $NSSM
Stop-ServiceIfExists -name $BackendSvc  -nssmPath $NSSM
Stop-NodeProcessesUsingPath -path $FrontendDir

# -------- Backend (system Python) --------
Write-Host "`nInstalling backend dependencies..." -ForegroundColor Cyan
$req = Join-Path $BackendDir "requirements.txt"
if (-not (Test-Path $req)) { Fail "Missing $req" }

& $PY -m pip install --upgrade pip
if ($LASTEXITCODE -ne 0) { Fail "Failed to upgrade pip." }

& $PY -m pip install -r $req
if ($LASTEXITCODE -ne 0) { Fail "Failed to install backend requirements." }

# Ensure Flask present (in case not listed)
& $PY -c "import flask" 2>$null
if ($LASTEXITCODE -ne 0) {
  Write-Host "Flask not found; installing Flask..." -ForegroundColor Yellow
  & $PY -m pip install Flask
  if ($LASTEXITCODE -ne 0) { Fail "Failed to install Flask into system Python." }
}

# -------- Frontend deps (robust against EBUSY) --------
Write-Host "`nInstalling frontend dependencies..." -ForegroundColor Cyan
Push-Location $FrontendDir
if (Test-Path (Join-Path $FrontendDir "package-lock.json")) {
  & $NPM ci
  if ($LASTEXITCODE -ne 0) {
    Write-Host "npm ci failed. Cleaning locks (EBUSY mitigation)..." -ForegroundColor Yellow
    Stop-NodeProcessesUsingPath -path $FrontendDir
    Unlock-Tree $FrontendDir
    & $NPM cache verify | Out-Null
    & $NPM cache clean --force | Out-Null
    $nm = Join-Path $FrontendDir "node_modules"
    if (Test-Path $nm) {
      if (-not (Remove-LockedDir -path $nm)) {
        Pop-Location; Fail "Failed to remove locked node_modules. Close editors/AV & retry."
      }
    }
    & $NPM install
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "npm install failed after cleanup." }
  }
} else {
  & $NPM install
  if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "npm install failed." }
}

# Ensure @angular/cli locally for both modes
$NgJs = Join-Path $FrontendDir "node_modules\@angular\cli\bin\ng.js"
if (-not (Test-Path $NgJs)) {
  Write-Host "Installing @angular/cli locally..." -ForegroundColor Yellow
  & $NPM install --save-dev @angular/cli
  if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Failed to install @angular/cli" }
}

# If prod: build and ensure http-server
$DistPath = $null
if ($Mode -eq 'prod') {
  $ProjectName = Get-AngularProjectName -frontendDir $FrontendDir
  Write-Host "Angular project: $ProjectName"
  Write-Host "Building Angular (production)..." -ForegroundColor Cyan
  & $NODE $NgJs build $ProjectName --configuration production
  if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Angular build failed" }

  $DistPath = Get-AngularDistPath -frontendDir $FrontendDir
  if (-not (Test-Path $DistPath)) { Pop-Location; Fail "Angular dist path not found after build." }

  $HttpServerCli = Join-Path $FrontendDir "node_modules\http-server\bin\http-server"
  if (-not (Test-Path $HttpServerCli)) {
    Write-Host "Installing http-server (dev dependency)..." -ForegroundColor Yellow
    & $NPM install --save-dev http-server
    if ($LASTEXITCODE -ne 0) { Pop-Location; Fail "Failed to install http-server" }
  }
}
Pop-Location

# -------- (Re)create services --------
Write-Host "`nCreating Windows services (NSSM)..." -ForegroundColor Cyan
Remove-ServiceIfExists -name $BackendSvc -nssmPath $NSSM
Remove-ServiceIfExists -name $FrontendSvc -nssmPath $NSSM
New-Item -ItemType Directory -Force -Path $LogsDir | Out-Null

# Backend service
& $NSSM install $BackendSvc "$PY" "app.py"
& $NSSM set     $BackendSvc AppDirectory  $BackendDir
& $NSSM set     $BackendSvc AppStdout     (Join-Path $LogsDir "backend.out.log")
& $NSSM set     $BackendSvc AppStderr     (Join-Path $LogsDir "backend.err.log")
& $NSSM set     $BackendSvc AppRotateFiles 1
& $NSSM set     $BackendSvc AppRotateOnline 1
& $NSSM set     $BackendSvc AppRotateBytes 10485760
& $NSSM set     $BackendSvc AppEnvironmentExtra "PYTHONUNBUFFERED=1","PORT=$BackendPort"
& $NSSM set     $BackendSvc Start SERVICE_AUTO_START
sc.exe failure $BackendSvc reset=86400 actions=restart/60000 | Out-Null
& $NSSM set     $BackendSvc AppStopMethodConsole 15000
& $NSSM set     $BackendSvc AppKillProcessTree 1

# Frontend service
if ($Mode -eq 'prod') {
  # Serve compiled dist via http-server using node.exe
  & $NSSM install $FrontendSvc "$NODE" "node_modules\http-server\bin\http-server `"$DistPath`" -p $FrontendPort"
  & $NSSM set     $FrontendSvc AppDirectory  $FrontendDir
} else {
  # Angular dev server (call ng.js directly with node.exe)
  & $NSSM install $FrontendSvc "$NODE" "node_modules\@angular\cli\bin\ng.js serve --port $FrontendPort --host 0.0.0.0 --no-open"
  & $NSSM set     $FrontendSvc AppDirectory  $FrontendDir
  # Ensure Node is visible to the service account
  & $NSSM set     $FrontendSvc AppEnvironmentExtra "Path=$NodeDir;$env:Path"
}
& $NSSM set     $FrontendSvc AppStdout     (Join-Path $LogsDir "frontend.out.log")
& $NSSM set     $FrontendSvc AppStderr     (Join-Path $LogsDir "frontend.err.log")
& $NSSM set     $FrontendSvc AppRotateFiles 1
& $NSSM set     $FrontendSvc AppRotateOnline 1
& $NSSM set     $FrontendSvc AppRotateBytes 10485760
& $NSSM set     $FrontendSvc Start SERVICE_AUTO_START
sc.exe failure $FrontendSvc reset=86400 actions=restart/60000 | Out-Null
& $NSSM set     $FrontendSvc AppStopMethodConsole 15000
& $NSSM set     $FrontendSvc AppKillProcessTree 1

# -------- Start services --------
& $NSSM start $BackendSvc
& $NSSM start $FrontendSvc

# -------- Firewall --------
Write-Host "`nAdding firewall rules (idempotent)..." -ForegroundColor Cyan
New-NetFirewallRule -DisplayName "ProfileComparison Backend $BackendPort"  -Direction Inbound -Action Allow -Protocol TCP -LocalPort $BackendPort  -Profile Any -ErrorAction SilentlyContinue | Out-Null
New-NetFirewallRule -DisplayName "ProfileComparison Frontend $FrontendPort" -Direction Inbound -Action Allow -Protocol TCP -LocalPort $FrontendPort -Profile Any -ErrorAction SilentlyContinue | Out-Null

# -------- Summary --------
Write-Host "`n== Install complete ($Mode) ==" -ForegroundColor Green
Write-Host "Backend  : http://localhost:$BackendPort"
Write-Host "Frontend : http://localhost:$FrontendPort  ($Mode mode)"
Write-Host "Services : $BackendSvc, $FrontendSvc"
Write-Host "Logs     : $LogsDir"
