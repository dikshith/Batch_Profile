# Quick Reference Guide - Common Modifications

## 🚀 Quick Start Modifications

### 1. Change Database Location

**File:** `src/config/db/db.js`

```javascript
// Change this line:
const dbPath = path.join(__dirname, "../../../database.db");
// To your preferred location:
const dbPath = path.join(__dirname, "../../../your-custom-path/database.db");
```

### 2. Change Server Port

**File:** `src/config/server.js`

```javascript
// Change port number:
const PORT = process.env.PORT || 3000; // Change 3000 to your port
```

### 3. Change Script Storage Location

**File:** `src/scripts/management/services.js`

```javascript
// In createScriptFile function, change:
const scriptsDir = "scripts";
// To:
const scriptsDir = "your-custom-scripts-path";
```

### 4. Change Log Storage Location

**File:** `src/scripts/execution/services.js`

```javascript
// In runScript function, change:
const logDir = "logs";
// To:
const logDir = "your-custom-logs-path";
```

## 📝 Adding New Script Types

### 1. Update File Validation

**File:** `src/scripts/management/controller.js`

```javascript
// In upload configuration, add new extensions:
const allowedExtensions = [".bat", ".cmd", ".ps1", ".your-extension"];
```

### 2. Update Script Type Detection

**File:** `src/scripts/management/controller.js`

```javascript
// In the file upload handler, add new type mapping:
let type =
  path.extname(file.originalname).slice(1).toLowerCase() === "bat"
    ? "batch"
    : path.extname(file.originalname).slice(1).toLowerCase() === "cmd"
    ? "cmd"
    : path.extname(file.originalname).slice(1).toLowerCase() === "ps1"
    ? "powershell"
    : path.extname(file.originalname).slice(1).toLowerCase() ===
      "your-extension"
    ? "your-script-type"
    : null;
```

### 3. Update Execution Logic

**File:** `src/scripts/execution/services.js`

```javascript
// In runScript function, add execution logic for new type:
const scriptCommand =
  type === "ps1" || type === "powershell"
    ? "powershell.exe"
    : type === "your-script-type"
    ? "your-executor.exe"
    : "cmd.exe";
```

## 🔧 API Endpoint Modifications

### Add New Route

**File:** `src/scripts/management/controller.js` (or appropriate module)

```javascript
// Add new route:
app.get("/your-new-endpoint", async (req, res) => {
  try {
    // Your logic here
    res.status(200).json({ message: "Success" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Modify Existing Route

**File:** `src/scripts/management/controller.js` (or appropriate module)

```javascript
// Find existing route and modify:
app.get("/:id", async (req, res) => {
  // Add your modifications here
});
```

## 🔌 Socket Event Modifications

### Add New Socket Event

**File:** `src/sockets/ScriptSocket.js`

```javascript
// Add new event handler:
socket.on("your-new-event", (data) => {
  // Handle your new event
  this.io.emit("your-new-event-response", response);
});
```

### Modify Existing Socket Event

**File:** `src/sockets/ScriptSocket.js`

```javascript
// Find existing event and modify:
socket.on("run-script", (data) => {
  // Add your modifications here
});
```

## 📊 Database Schema Changes

### Add New Field to Script Model

**File:** `src/scripts/models.js`

```javascript
const Script = sequelize.define("Script", {
  // Existing fields...
  newField: {
    type: DataTypes.STRING,
    allowNull: true,
  },
});
```

### Add New Field to ScriptRun Model

**File:** `src/scripts/models.js`

```javascript
const ScriptRun = sequelize.define("ScriptRun", {
  // Existing fields...
  newField: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
});
```

## 🔒 Security Modifications

### Change File Upload Limits

**File:** `src/scripts/management/controller.js`

```javascript
// In multer configuration:
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  // ... other options
});
```

### Add Authentication

**File:** `src/scripts/management/controller.js`

```javascript
// Add middleware to routes:
app.use("/your-protected-route", authMiddleware);
```

## 📈 Statistics and Monitoring

### Add New Statistics

**File:** `src/scripts/management/services.js`

```javascript
// In getStatistics function:
async getStatistics() {
  // Add your new statistics here
  const newStat = await YourModel.count();

  return {
    // Existing stats...
    newStat,
  };
}
```

## 🗂️ File Organization Changes

### Change File Naming Convention

**File:** `src/scripts/management/services.js`

```javascript
// In createScriptFile function:
const filename = `${name.replace(
  /[^a-zA-Z0-9]/g,
  "_"
)}-${timestamp}${extension}`;
// Change to your naming convention:
const filename = `${name}-${Date.now()}${extension}`;
```

### Change Directory Structure

**File:** `src/scripts/management/services.js`

```javascript
// Create subdirectories:
const scriptsDir = path.join("scripts", type); // scripts/batch/, scripts/powershell/
```

## 🔄 Process Management

### Change Execution Policy

**File:** `src/scripts/execution/services.js`

```javascript
// In runScript function:
const args =
  type === "ps1" || type === "powershell"
    ? ["-ExecutionPolicy", "Bypass", "-File", resolvedScriptPath]
    : ["/c", resolvedScriptPath];
// Change execution policy:
const args =
  type === "ps1" || type === "powershell"
    ? ["-ExecutionPolicy", "RemoteSigned", "-File", resolvedScriptPath]
    : ["/c", resolvedScriptPath];
```

### Add Process Timeout

**File:** `src/scripts/execution/services.js`

```javascript
// In runScript function, add timeout:
const proc = spawn(scriptCommand, args, options);
setTimeout(() => {
  if (proc && !proc.killed) {
    proc.kill("SIGTERM");
  }
}, 300000); // 5 minutes timeout
```

## 📝 Logging Modifications

### Change Log Format

**File:** `src/scripts/execution/services.js`

```javascript
// In script_run_update function:
logStream.write(text);
// Change to:
logStream.write(`[${new Date().toISOString()}] ${text}`);
```

### Add Log Rotation

**File:** `src/scripts/execution/services.js`

```javascript
// Add log rotation logic in runScript function
const logFile = path.join(logDir, `${scriptId}-${timestamp}.log`);
// Add size check and rotation
```
