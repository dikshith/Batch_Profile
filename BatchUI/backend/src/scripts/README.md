# Scripts Module Documentation

## Overview

The scripts module is the core of the application, responsible for managing, executing, and monitoring scripts. It's divided into three main sub-modules:

1. **Management** (`/management`): Handles CRUD operations for scripts
2. **Execution** (`/execution`): Handles script execution and process management
3. **Run** (`/run`): Manages script run history and monitoring

## 📁 Module Structure

```
scripts/
├── models.js              # Database models (Script, ScriptRun)
├── controller.js          # Main router
├── services.js           # Service re-exports
├── execution/            # Script execution module
│   ├── controller.js     # Execution routes
│   └── services.js      # Execution logic
├── management/           # Script management module
│   ├── controller.js     # Management routes
│   └── services.js      # Management logic
└── run/                  # Script run module
    ├── controller.js     # Run routes
    └── services.js      # Run logic
```

## 📊 Database Models

### Script Model

```javascript
{
  name: STRING,           // Script name
  description: TEXT,      // Optional description
  type: STRING,          // Script type (powershell, batch, bash, or file extension)
  filePath: STRING,      // Path relative to scripts/ directory
  isScript: BOOLEAN      // Whether it's a script or regular file
}
```

### ScriptRun Model

```javascript
{
  startTime: DATE,       // Run start time
  endTime: DATE,        // Run end time
  status: ENUM,         // pending, running, completed, failed
  progress: INTEGER,    // 0-100 progress percentage
  logFile: STRING,      // Path to log file
  pid: INTEGER         // Process ID (optional)
}
```

## 🔧 Core Functionality

### 1. Script Management

- File upload with folder structure preservation
- Text-based script creation
- Script updates (content and metadata)
- Script deletion (file and DB)
- File browser capabilities
- Support for any file type

### 2. Script Execution

- PowerShell script execution via `node-powershell`
- Batch script execution via `child_process.spawn`
- Bash script execution via `node-bash`
- Real-time progress tracking
- Process management and termination
- Working directory support

### 3. Run Management

- Run history tracking
- Log file management
- Run status updates
- Automated cleanup of old runs

## 🔌 WebSocket Integration

The module uses Socket.IO for real-time updates:

- Script progress updates
- Log streaming
- Status changes
- Run completion/failure notifications

## 📝 Important Files

### models.js

- Defines database schema
- Sets up relationships
- Handles model validation

### controller.js

- Routes requests to appropriate sub-modules
- Handles file uploads
- Manages authentication middleware

### services.js

- Re-exports service functions
- Centralizes business logic
- Handles file system operations

## 🛠️ Common Customizations

### Adding New Script Types

1. Update `management/controller.js`:

```javascript
// Add new extension mapping
const typeMap = {
  ps1: "powershell",
  bat: "batch",
  sh: "bash",
  "your-ext": "your-type",
};
```

2. Update `execution/services.js`:

```javascript
if (type === "your-type") {
  run_your_script_type(resolvedScriptPath, scriptRun, logStream);
}
```

### Modifying File Storage

In `management/services.js`:

```javascript
const SCRIPTS_DIR = "your/custom/path";
```

### Customizing Run Cleanup

In `run/services.js`:

```javascript
const RETENTION_DAYS = 30; // Change retention period
```

## 🔒 Security Considerations

1. **File Upload Security**

   - Validate file types
   - Check file sizes
   - Prevent path traversal
   - Sanitize file names

2. **Script Execution**

   - Validate script content
   - Set execution timeouts
   - Monitor resource usage
   - Handle process termination

3. **File Access**
   - Restrict to scripts directory
   - Validate paths
   - Check permissions

## 📊 Monitoring

### Progress Tracking

Scripts can report progress using:

```
PROGRESS: 50
```

### Log Files

- Located in `logs/` directory
- Named with pattern: `{scriptId}-{timestamp}.log`
- Real-time streaming via WebSocket

## 🔄 Database Sync

The `sync_db.js` utility:

- Syncs files on disk with database
- Removes orphaned records
- Updates file metadata

## 🚨 Error Handling

1. **File Operations**

   - Missing files
   - Permission issues
   - Invalid paths

2. **Script Execution**

   - Process failures
   - Timeout errors
   - Resource limits

3. **Database Operations**
   - Unique constraints
   - Foreign key violations
   - Connection issues

## 📝 Best Practices

1. **File Management**

   - Use relative paths
   - Validate file existence
   - Handle concurrent access

2. **Script Execution**

   - Set appropriate timeouts
   - Monitor resource usage
   - Clean up processes

3. **Error Handling**
   - Log errors properly
   - Provide clear messages
   - Clean up resources

## 🔍 Debugging Tips

1. **Script Issues**

   - Check log files
   - Monitor process output
   - Verify file permissions

2. **Database Issues**

   - Check sync status
   - Verify relationships
   - Monitor constraints

3. **File System Issues**
   - Verify paths
   - Check permissions
   - Monitor disk space
