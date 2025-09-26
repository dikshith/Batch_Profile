# Script Execution Module

## Overview

The execution module is responsible for running scripts and managing their processes. It supports multiple script types:

- PowerShell (.ps1)
- Batch (.bat/.cmd)
- Bash (.sh)

## 🔧 Core Components

### services.js

Contains the core execution logic:

1. **runScript**: Main entry point for script execution

   ```javascript
   runScript(scriptId, scriptPath, type, (executionPath = null));
   ```

   - Creates log file
   - Initializes script run record
   - Delegates to appropriate runner

2. **run_powershell_script**: PowerShell execution handler

   ```javascript
   run_powershell_script(scriptPath, scriptRun, logStream);
   ```

   - Uses `node-powershell`
   - Handles output streaming
   - Manages process lifecycle

3. **run_batch_script**: Batch script handler

   ```javascript
   run_batch_script(scriptPath, scriptRun, logStream);
   ```

   - Uses `child_process.spawn`
   - Sets up process options
   - Manages output pipes

4. **run_bash_script**: Bash script handler

   ```javascript
   run_bash_script(scriptPath, scriptRun, logStream);
   ```

   - Uses `node-bash`
   - Similar to PowerShell handling
   - Manages process state

5. **killScriptRuns**: Process termination
   ```javascript
   killScriptRuns(scriptId);
   ```
   - Kills running processes
   - Updates run status
   - Cleans up resources

## 📊 Process Management

### Running Processes Map

```javascript
const running_processes = new Map();
```

- Tracks active script processes
- Keys: Script run IDs
- Values: Process objects

### Bulk

```js
check_bulk();
```

why ??

by default node-powershell and node-bash add a bulk delimeter string (16 character to the output stream )
so function checks for that and don't output it

## 🔄 Execution Flow

1. **Script Run Initialization**

   ```javascript
   const scriptRun = await ScriptRun.create({
     scriptId: scriptId,
     startTime: new Date(),
     status: "running",
     logFile: logFile,
     progress: 0,
   });
   ```

2. **Log File Setup**

   ```javascript
   const logStream = fs.createWriteStream(logFile, { flags: "a" });
   ```

3. **Process Execution**

   - Based on script type
   - Sets up working directory
   - Configures process options

4. **Output Handling**

   - Streams to log file
   - Emits via WebSocket
   - Tracks progress

5. **Process Completion**
   - Updates run status
   - Records end time
   - Cleans up resources

## 📝 Progress Tracking

Scripts can report progress using the format:

```
PROGRESS: 50
```

The system:

1. Detects progress markers
2. Updates database
3. Emits WebSocket event
4. Updates UI in real-time

## 🔌 WebSocket Events

### Run Updates

```javascript
scriptSocket.emitRunUpdate(scriptRun.id, {
  status: "running",
  startTime: scriptRun.startTime,
  progress: 0,
});
```

### Log Updates

```javascript
scriptSocket.emitRunUpdate(scriptRun.id, {
  log: text,
  type: "stdout",
  ...scriptRun,
});
```

### Run Completion

```javascript
scriptSocket.emitRunComplete(scriptRun.id, status, endTime);
```

## 🚨 Error Handling

### Process Errors

```javascript
proc.on("error", async (error) => {
  console.error(`Script ${scriptRun.scriptId} error:`, error);
  await scriptRun.update({
    status: "failed",
    endTime: new Date(),
  });
  scriptSocket.emitRunError(scriptRun.id, error.message);
});
```

### File System Errors

- Missing script files
- Log write failures
- Permission issues

### Process Termination

- Graceful shutdown
- Force kill if needed
- Resource cleanup

## 🔒 Security Considerations

1. **Process Isolation**

   - Working directory restriction
   - No shell injection
   - Resource limits

2. **File Access**

   - Path validation
   - Permission checks
   - Sanitized inputs

3. **Error Prevention**
   - Input validation
   - Process monitoring
   - Timeout handling

## 📊 Monitoring

### Process State

- Active processes
- Run duration
- Resource usage

### Log Management

- File rotation
- Size limits
- Cleanup policies

### Progress Updates

- Real-time tracking
- Completion status
- Error reporting

## 🔧 Customization Points

### Add New Script Type

```javascript
async function run_custom_script(scriptPath, scriptRun, logStream) {
  // Implementation
}

// In runScript:
if (type === "custom") {
  run_custom_script(resolvedScriptPath, scriptRun, logStream);
}
```

### Modify Process Options

```javascript
const options = {
  detached: true,
  shell: false,
  stdio: ["pipe", "pipe", "pipe"],
  windowsHide: true,
  cwd: path.dirname(scriptPath),
  // Add custom options
};
```

### Custom Progress Format

```javascript
const match = text.match(/YOUR_PROGRESS_FORMAT:\s*(\d+)/i);
if (match) {
  const progress = parseInt(match[1]);
  // Handle progress
}
```

## 🔍 Debugging

### Process Issues

1. Check log files
2. Monitor process state
3. Verify working directory
4. Check resource usage

### Output Problems

1. Verify log streams
2. Check WebSocket events
3. Monitor bulk handling
4. Validate progress format

### Termination Issues

1. Check process tree
2. Verify cleanup
3. Monitor resources
4. Check error handling
