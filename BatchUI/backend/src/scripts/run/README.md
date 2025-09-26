# Script Run Module

## Overview

The run module manages script execution history, run logs, and automated cleanup. Key features:

- Run history tracking
- Log file management
- Run status monitoring
- Automated cleanup scheduler
- Run statistics

## 🔧 Core Components

### services.js

Contains run management logic:

1. **Run History**

   ```javascript
   const getScriptRuns = {
     async getAll(options),
     async getByScriptId(scriptId, options),
     async getById(id),
   };
   ```

2. **Run Deletion**

   ```javascript
   const deleteScriptRun = {
     async deleteRun(id),
     async deleteByScriptId(scriptId),
   };
   ```

3. **Cleanup Service**
   ```javascript
   const cleanupService = {
     async cleanupOldRuns(days),
     async getCleanupStats(),
   };
   ```

### cleanupScheduler.js

Manages automated cleanup:

```javascript
class CleanupScheduler {
  constructor(days = 30) {
    this.retentionDays = days;
    this.nextRunTime = null;
    this.lastRunTime = null;
    this.isRunning = false;
  }

  start() {
    // Start automated cleanup
  }

  getStatus() {
    // Get scheduler status
  }
}
```

## 📊 Database Model

### ScriptRun Model

```javascript
{
  startTime: DATE,        // Run start time
  endTime: DATE,         // Run end time
  status: ENUM,          // pending, running, completed, failed
  progress: INTEGER,     // 0-100 progress percentage
  logFile: STRING,      // Path to log file
  pid: INTEGER,         // Process ID (optional)
  scriptId: INTEGER     // Foreign key to Script
}
```

## 🔄 Run Lifecycle

1. **Creation**

   ```javascript
   const run = await ScriptRun.create({
     scriptId,
     startTime: new Date(),
     status: "running",
     logFile,
     progress: 0,
   });
   ```

2. **Progress Updates**

   ```javascript
   await run.update({
     progress: newProgress,
   });
   ```

3. **Completion**

   ```javascript
   await run.update({
     status: "completed",
     endTime: new Date(),
     progress: 100,
   });
   ```

4. **Failure**
   ```javascript
   await run.update({
     status: "failed",
     endTime: new Date(),
   });
   ```

## 📝 Log Management

### Log File Structure

```
logs/
├── {scriptId}-{timestamp}.log
└── cleanup/
    └── {date}-cleanup.log
```

### Log Rotation

- Based on retention period
- Deleted with run records
- Cleanup logs preserved

## 🔄 Automated Cleanup

### Configuration

```javascript
const scheduler = new CleanupScheduler({
  retentionDays: 30, // Keep runs for 30 days
  checkInterval: 24 * 60 * 60, // Check daily
  batchSize: 100, // Delete in batches
});
```

### Cleanup Process

1. Find old runs
2. Delete log files
3. Remove DB records
4. Update statistics

### Status Tracking

```javascript
{
  nextRunTime: Date,          // Next scheduled cleanup
  lastRunTime: Date,          // Last cleanup time
  isRunning: Boolean,         // Current status
  lastRunStats: {            // Last run statistics
    deletedRuns: Number,
    freedSpace: Number,
    duration: Number,
  }
}
```

## 🔌 API Endpoints

### Run Management

1. **Get All Runs**

   ```http
   GET /scripts/runs
   Query params:
   - scriptId: number
   - status: string
   - startDate: date
   - endDate: date
   ```

2. **Get Run Details**

   ```http
   GET /scripts/runs/:id
   ```

3. **Delete Run**
   ```http
   DELETE /scripts/runs/:id
   ```

### Cleanup Management

1. **Start Manual Cleanup**

   ```http
   POST /scripts/runs/cleanup
   Body:
   {
     days: number
   }
   ```

2. **Get Cleanup Status**
   ```http
   GET /scripts/runs/cleanup/status
   ```

## 📊 Statistics

### Run Statistics

```javascript
{
  total: Number,           // Total runs
  completed: Number,       // Successful runs
  failed: Number,         // Failed runs
  running: Number,        // Active runs
  averageDuration: Number, // Average run time
}
```

### Cleanup Statistics

```javascript
{
  lastCleanup: Date,      // Last cleanup time
  deletedRuns: Number,    // Total runs deleted
  freedSpace: Number,     // Space recovered (bytes)
  nextCleanup: Date,      // Next scheduled cleanup
}
```

## 🚨 Error Handling

### Run Errors

```javascript
try {
  await deleteScriptRun(id);
} catch (error) {
  if (error.code === "ENOENT") {
    // Handle missing log file
  } else {
    // Handle other errors
  }
}
```

### Cleanup Errors

```javascript
try {
  await cleanup.start();
} catch (error) {
  console.error("Cleanup failed:", error);
  await notifyAdministrator(error);
}
```

## 🔒 Security

### Access Control

- Run deletion requires auth
- Log file access restricted
- Cleanup logs protected

### Data Protection

- Log file sanitization
- Path validation
- Permission checks

## 🔧 Customization Points

### Retention Policy

```javascript
const config = {
  retentionDays: process.env.RETENTION_DAYS || 30,
  cleanupInterval: process.env.CLEANUP_INTERVAL || "0 0 * * *", // Daily at midnight
};
```

### Log Format

```javascript
function formatLogEntry(run, message) {
  return `[${new Date().toISOString()}] ${run.id}: ${message}\n`;
}
```

### Cleanup Rules

```javascript
function shouldCleanup(run) {
  const age = Date.now() - run.endTime;
  return age > retentionDays * 24 * 60 * 60 * 1000;
}
```

## 📝 Best Practices

1. **Run Management**

   - Regular cleanup
   - Log rotation
   - Space monitoring
   - Performance tracking

2. **Error Handling**

   - Graceful degradation
   - Retry mechanisms
   - Error notification
   - Data recovery

3. **Performance**

   - Batch processing
   - Index optimization
   - Log compression
   - Resource limits

4. **Monitoring**
   - Space usage
   - Cleanup success
   - Error rates
   - Performance metrics
