import express from "express";
import { getScripts } from "../management/services.js";
import { runScript, killScriptRuns } from "./services.js";

const app = express();

// script execution {
    // run script
    // kill script
    
// kill script's running processes
app.post("/:id/kill", async (req, res) => {
  const { id } = req.params;

  if (!id) {
    return res.status(400).json({ error: "Missing required field: scriptId" });
  }

  const script = await getScripts.getScriptById(id);

  if (!script) {
    return res.status(404).json({ error: "Script not found" });
  }

  try {
    await killScriptRuns(script.id);
    return res.status(200).json({ message: "Script runs killed successfully" });
  } catch (error) {
    console.error("Error killing script runs:", error);
    return res.status(500).json({ error: "Failed to kill script runs" });
  }
});
// run script
app.post("/run", async (req, res) => {
  const { scriptId, executionPath } = req.body;

  if (!scriptId) {
    return res.status(400).json({ error: "Missing required field: scriptId" });
  }

  try {
    // Get script details from database
    const script = await getScripts.getScriptById(scriptId);

    if (!script) {
      return res.status(404).json({ error: "Script not found" });
    }

    // Run the script using database information
    const result = await runScript(
      script.id,
      script.filePath,
      script.type,
      executionPath
    );

    res.status(200).json({
      message: "Script execution started",
      id: result.scriptRunId,
      logFile: result.logFile,
      script: {
        id: script.id,
        name: script.name,
        type: script.type,
      },
    });
  } catch (error) {
    console.error("Error starting script execution:", error);
    res.status(500).json({
      error: "Failed to start script execution",
      details: error.message,
    });
  }
});

export default app;