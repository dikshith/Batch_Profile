import { spawn } from "child_process";
import fs from "fs";
import path from "path";
import { ScriptRun } from "../models.js";
import { PowerShell } from "node-powershell";
import { scriptSocket } from "../../index.js";
import { getScriptRuns } from "../services.js";
import { Script } from "../models.js";

import { Bash } from "node-bash";

const running_processes = new Map();
const bulk_map = new Map();
export async function runScript(
  scriptId,
  scriptPath,
  type,
  executionPath = null
) {
  const timestamp = Date.now();
  const logDir = "logs";
  const logFile = path.join(logDir, `${scriptId}-${timestamp}.log`);

  // Ensure logs directory exists
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }

  // Verify script file exists before attempting to run
  if (!fs.existsSync(scriptPath)) {
    throw new Error(
      `Script file not found: ${scriptPath}. This may indicate the file was deleted or moved during an update.`
    );
  }

  const resolvedScriptPath = path.resolve(scriptPath);

  try {
    // Create log file write stream
    const logStream = fs.createWriteStream(logFile, { flags: "a" });

    // Create script run record in database
    const scriptRun = await ScriptRun.create({
      scriptId: scriptId,
      startTime: new Date(),
      status: "running",
      logFile: logFile,
      progress: 0,
    });

    // Emit run started event
    scriptSocket.emitRunUpdate(scriptRun.id, {
      status: "running",
      startTime: scriptRun.startTime,
      progress: 0,
    });

    if (type === "ps1" || type === "powershell") {
      run_powershell_script(resolvedScriptPath, scriptRun, logStream);
    } else if (type === "shell" || type === "sh" || type === "bash") {
      run_bash_script(resolvedScriptPath, scriptRun, logStream);
    } else {
      run_batch_script(resolvedScriptPath, scriptRun, logStream);
    }

    return { scriptRunId: scriptRun.id, logFile };
  } catch (error) {
    console.error("Error starting script:", error);
    throw error;
  }
}
async function run_bash_script(scriptPath, scriptRun, logStream) {
  // Double-check file exists before reading
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`Bash script file not found: ${scriptPath}`);
  }

  const script = fs.readFileSync(scriptPath, "utf8");
  const scriptDir = path.dirname(scriptPath);

  const bash = new Bash({
    verbose: true,
    spawnOptions: {
      cwd: scriptDir,
    },
  });

  running_processes.set(scriptRun.id, bash);

  bash.streams.stdout.on("data", async (data) => {
    if (!check_bulk(data, scriptRun.id)) {
      console.log("printing data:", data);
      script_run_update(data, scriptRun, logStream);
    }
  });

  bash.streams.stderr.on("data", async (data) => {
    if (!check_bulk(data, scriptRun.id)) {
      script_run_update(data, scriptRun, logStream, true);
    }
  });

  let status = "",
    endTime = new Date(),
    progress = 0;

  bash
    .invoke(script)
    .then((result) => {
      status = "completed";
      endTime = new Date();
      progress = 100;
    })
    .catch((error) => {
      status = "failed";
      endTime = new Date();
      progress = 100;
    })
    .finally(async () => {
      try {
        running_processes.delete(scriptRun.id);
        await scriptRun.update({
          status: status,
          endTime: endTime,
          progress: progress,
        });
        scriptSocket.emitRunComplete(scriptRun.id, status, endTime);
        bulk_map.delete(scriptRun.id);
        logStream.end();
        bash
          .dispose()
          .then(() => {})
          .catch((error) => {
            console.error(
              `Error disposing bash process ${scriptRun.id}:`,
              error
            );
          });
      } catch (error) {
        console.error("Error deleting bulk map:", error);
      }
    });
}

async function run_batch_script(scriptPath, scriptRun, logStream) {
  const options = {
    detached: true,
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    windowsHide: true,
    cwd: path.dirname(scriptPath),
  };

  const proc = spawn("cmd.exe", ["/c", scriptPath], options);

  // Pipe process output directly to log file
  proc.stdout.pipe(logStream);
  proc.stderr.pipe(logStream);

  proc.stdout.on("data", async (data) => {
    const text = data.toString();
    const match = text.match(/PROGRESS:\s*(\d+)/i);
    if (match) {
      const progress = parseInt(match[1]);
      console.log("progress", progress);
      if (!isNaN(progress)) {
        await scriptRun.update({ progress });
        scriptSocket.emitRunUpdate(scriptRun.id, {
          ...scriptRun,
          progress,
        });
      }
    }
    scriptSocket.emitRunUpdate(scriptRun.id, {
      log: text,
      type: "stdout",
      ...scriptRun,
    });
  });

  proc.stderr.on("data", (data) => {
    const text = data.toString();
    console.log("stderr data:", text);
    logStream.write(text);
    scriptSocket.emitRunUpdate(scriptRun.id, {
      log: text,
      type: "stderr",
    });
  });

  proc.on("exit", (code, signal) => {
    console.log(`Child process exited with code ${code} and signal ${signal}`);
    if (code) {
      console.error("Child exited with code", code);
    } else if (signal) {
      console.error("Child was killed with signal", signal);
    } else {
      console.log("Child exited okay");
    }
  });

  proc.on("close", async (code) => {
    console.log("script closed with code:", code);
    const status = code === 0 ? "completed" : "failed";
    console.log(
      `Script ${scriptRun.scriptId} finished with status: ${status} (exit code: ${code})`
    );

    const endTime = new Date();
    await scriptRun.update({
      status: status,
      endTime: endTime,
      progress: 100,
    });

    scriptSocket.emitRunComplete(scriptRun.id, status, endTime);
    logStream.end();
  });

  proc.on("error", async (error) => {
    console.error(`Script ${scriptRun.scriptId} error:`, error);
    const endTime = new Date();
    await scriptRun.update({
      status: "failed",
      endTime: endTime,
    });
    scriptSocket.emitRunError(scriptRun.id, error.message);
  });

  proc.unref(); // Let it run in background
  return proc;
}

async function script_run_update(data, scriptRun, logStream, error = false) {
  const text = data.toString();
  console.log(text);
  const match = text.match(/PROGRESS:\s*(\d+)/i);
  if (match) {
    const progress = parseInt(match[1]);
    console.log("progress", progress);
    if (!isNaN(progress)) {
      await scriptRun.update({ progress });

      scriptSocket.emitRunUpdate(scriptRun.id, {
        ...scriptRun,
        progress,
        log: text,
      });
    }
  }
  scriptSocket.emitRunUpdate(scriptRun.id, {
    log: text,
    type: "stdout",
    ...scriptRun,
  });
  logStream.write(text);
}

function check_bulk(data, scriptRunId) {
  const BULK_DELIMITER_LENGTH = 16;
  const text = data.toString().trim();
  console.log("text:", text);

  if (text.length === BULK_DELIMITER_LENGTH) {
    console.log("bulk_map:", bulk_map);
    if (bulk_map.has(scriptRunId)) {
      const bulk = bulk_map.get(scriptRunId);
      if (bulk.text === text) {
        bulk.count++;
        if (bulk.count >= 4) {
          bulk_map.delete(scriptRunId);
        }
        return true;
      } else {
        return false;
      }
    } else {
      bulk_map.set(scriptRunId, {
        text,
        count: 1,
      });
      return true;
    }
  } else {
    return false;
  }
}

async function run_powershell_script(scriptPath, scriptRun, logStream) {
  // Double-check file exists before reading
  if (!fs.existsSync(scriptPath)) {
    throw new Error(`PowerShell script file not found: ${scriptPath}`);
  }

  const script = fs.readFileSync(scriptPath, "utf8");

  const scriptDir = path.dirname(scriptPath);

  const ps = new PowerShell({
    verbose: true,
    executionPolicy: "Bypass",
    noProfile: false,
    spawnOptions: {
      cwd: scriptDir,
    },
  });

  running_processes.set(scriptRun.id, ps);
  ps.streams.stdout.on("data", async (data) => {
    console.log("stdout data:", data);
    if (!check_bulk(data, scriptRun.id)) {
      script_run_update(data, scriptRun, logStream);
    }
  });

  ps.streams.stderr.on("data", async (data) => {
    if (!check_bulk(data, scriptRun.id)) {
      script_run_update(data, scriptRun, logStream, true);
    }
  });

  let status = "",
    endTime = new Date(),
    progress = 0;

  ps.invoke(script)
    .then((result) => {
      status = "completed";
      endTime = new Date();
      progress = 100;
    })
    .catch((error) => {
      status = "failed";
      endTime = new Date();
      progress = 100;
    })
    .finally(async () => {
      try {
        running_processes.delete(scriptRun.id);
        await scriptRun.update({
          status: status,
          endTime: endTime,
          progress: progress,
        });
        scriptSocket.emitRunComplete(scriptRun.id, status, endTime);
        bulk_map.delete(scriptRun.id);
        logStream.end();
        ps.dispose()
          .then(() => {})
          .catch((error) => {
            console.error(
              `Error disposing powershell process ${scriptRun.id}:`,
              error
            );
          });
      } catch (error) {
        console.error("Error deleting bulk map:", error);
      }
    });
}

export const killScriptRuns = async (id) => {
  const res = await getScriptRuns.getByScriptId(id, {
    status: "running",
  });

  const runs = res.scriptRuns;

  // make all of them failed
  for (const run of runs) {
    await ScriptRun.update(
      {
        status: "failed",
      },
      {
        where: { id: run.id },
      }
    );
    scriptSocket.emitRunUpdate(run.id, {
      status: "failed",
      message: "Script run killed",
    });
  }

  let scriptType = "";
  if (runs.length > 0) {
    const script = await Script.findByPk(runs[0].scriptId);
    scriptType = script.type;
  }

  // kill the processes
  for (const run of runs) {
    console.log(`Disposing powershell run ${run.id}`);
    if (scriptType === "powershell" || scriptType === "ps1") {
      const ps = running_processes.get(run.id);
      try {
        ps.streams.stdout.destroy();
        ps.streams.stderr.destroy();
        ps.streams.stdin.destroy();
        await ps.dispose("SIGINT");
        console.log("killed");
      } catch (error) {
        // console.error(`Error disposing powershell process ${run.id}:`, error);
      }
      continue;
    }
    if (run.pid) {
      treeKill(run.pid, (error) => {
        if (error) {
          console.error(`Error killing process ${run.pid}:`, error);
        } else {
          console.log(`Killed process ${run.pid}`);
        }
      });
    }
  }
};
