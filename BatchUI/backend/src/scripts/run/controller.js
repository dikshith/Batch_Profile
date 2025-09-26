import { Router } from "express";
import { getScriptRuns, deleteScriptRun, scriptRunStats } from "./services.js";
import cleanupScheduler from "./cleanupScheduler.js";

const app = Router();

// Route to get all script runs (for monitoring dashboard)
app.get("/all", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "DESC",
      status,
      scriptId,
      dateFrom,
      dateTo,
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      sortBy,
      sortOrder,
      status,
      scriptId: scriptId ? parseInt(scriptId) : undefined,
      dateFrom,
      dateTo,
    };

    const result = await getScriptRuns.getAllRuns(options);

    res.status(200).json({
      message: "All script runs retrieved successfully",
      ...result,
    });
  } catch (error) {
    console.error("Error retrieving all script runs:", error);
    res.status(500).json({
      error: "Failed to retrieve script runs",
      details: error.message,
    });
  }
});

app.get("/stats", async (req, res) => {
  const countScriptRun = await scriptRunStats.scriptRunCount();
  const countCompleted = await scriptRunStats.scriptRunCountByStatus(
    "completed"
  );
  const countFailed = await scriptRunStats.scriptRunCountByStatus("failed");
  const countRunning = await scriptRunStats.scriptRunCountByStatus("running");

  res.status(200).json({
    message: "Script run stats retrieved successfully",
    total: countScriptRun,
    completed: countCompleted,
    running: countRunning,
    failed: countFailed,
  });
});

// Route to get a specific script run by ID
app.get("/:runId", async (req, res) => {
  try {
    const { runId } = req.params;
    const scriptRun = await getScriptRuns.getRunById(runId);

    if (!scriptRun) {
      return res.status(404).json({ error: "Script run not found" });
    }

    res.status(200).json({
      message: "Script run retrieved successfully",
      scriptRun,
    });
  } catch (error) {
    console.error("Error retrieving script run:", error);
    res.status(500).json({
      error: "Failed to retrieve script run",
      details: error.message,
    });
  }
});

// Route to delete multiple script runs
app.delete("/", async (req, res) => {
  try {
    const { runIds } = req.body;

    if (!runIds || !Array.isArray(runIds) || runIds.length === 0) {
      return res.status(400).json({
        error: "runIds array is required and must not be empty",
      });
    }

    // Validate that all runs exist
    const existingRuns = await Promise.all(
      runIds.map(async (runId) => {
        try {
          return await getScriptRuns.getRunById(runId);
        } catch (error) {
          return null;
        }
      })
    );

    const validRunIds = existingRuns
      .filter((run) => run !== null)
      .map((run) => run.id);

    if (validRunIds.length === 0) {
      return res.status(404).json({ error: "No valid script runs found" });
    }

    // Delete the script runs
    await deleteScriptRun.deleteBulkRuns(validRunIds);

    res.status(200).json({
      message: "Script runs deleted successfully",
      deletedCount: validRunIds.length,
      requestedCount: runIds.length,
      validRunIds,
    });
  } catch (error) {
    console.error("Error deleting bulk script runs:", error);
    res.status(500).json({
      error: "Failed to delete script runs",
      details: error.message,
    });
  }
});

// Route to get cleanup statistics
app.get("/cleanup/stats", async (req, res) => {
  try {
    const { days = 30, status } = req.query;

    const options = {
      days: parseInt(days),
      status: status || null,
    };

    const stats = await deleteScriptRun.getCleanupStats(options);

    res.status(200).json({
      message: "Cleanup statistics retrieved successfully",
      stats,
    });
  } catch (error) {
    console.error("Error retrieving cleanup stats:", error);
    res.status(500).json({
      error: "Failed to retrieve cleanup statistics",
      details: error.message,
    });
  }
});

// Route to perform cleanup (dry run)
app.post("/cleanup/dry-run", async (req, res) => {
  try {
    const { days = 30, status } = req.body;

    const options = {
      days: parseInt(days),
      status: status || null,
      dryRun: true,
    };

    const result = await deleteScriptRun.cleanupOldRuns(options);

    res.status(200).json({
      message: "Cleanup dry run completed",
      ...result,
    });
  } catch (error) {
    console.error("Error performing cleanup dry run:", error);
    res.status(500).json({
      error: "Failed to perform cleanup dry run",
      details: error.message,
    });
  }
});

// Route to perform actual cleanup
app.post("/cleanup", async (req, res) => {
  try {
    const { days = 30, status, confirm = false } = req.body;

    if (!confirm) {
      return res.status(400).json({
        error:
          "Confirmation required. Set 'confirm' to true to proceed with cleanup.",
      });
    }

    const options = {
      days: parseInt(days),
      status: status || null,
      dryRun: false,
    };

    const result = await deleteScriptRun.cleanupOldRuns(options);

    res.status(200).json({
      message: "Cleanup completed successfully",
      ...result,
    });
  } catch (error) {
    console.error("Error performing cleanup:", error);
    res.status(500).json({
      error: "Failed to perform cleanup",
      details: error.message,
    });
  }
});

// Route to get scheduler status
app.get("/scheduler/status", async (req, res) => {
  try {
    const status = cleanupScheduler.getStatus();

    res.status(200).json({
      message: "Scheduler status retrieved successfully",
      status,
    });
  } catch (error) {
    console.error("Error retrieving scheduler status:", error);
    res.status(500).json({
      error: "Failed to retrieve scheduler status",
      details: error.message,
    });
  }
});

// Route to get detailed scheduler status
app.get("/scheduler/status/detailed", async (req, res) => {
  try {
    const detailedStatus = cleanupScheduler.getDetailedStatus();

    res.status(200).json({
      message: "Detailed scheduler status retrieved successfully",
      status: detailedStatus,
    });
  } catch (error) {
    console.error("Error retrieving detailed scheduler status:", error);
    res.status(500).json({
      error: "Failed to retrieve detailed scheduler status",
      details: error.message,
    });
  }
});

// Route to start scheduler
app.post("/scheduler/start", async (req, res) => {
  try {
    const config = req.body;

    cleanupScheduler.start(config);

    const status = cleanupScheduler.getStatus();

    res.status(200).json({
      message: "Scheduler started successfully",
      status,
    });
  } catch (error) {
    console.error("Error starting scheduler:", error);
    res.status(500).json({
      error: "Failed to start scheduler",
      details: error.message,
    });
  }
});

// Route to stop scheduler
app.post("/scheduler/stop", async (req, res) => {
  try {
    cleanupScheduler.stop();

    const status = cleanupScheduler.getStatus();

    res.status(200).json({
      message: "Scheduler stopped successfully",
      status,
    });
  } catch (error) {
    console.error("Error stopping scheduler:", error);
    res.status(500).json({
      error: "Failed to stop scheduler",
      details: error.message,
    });
  }
});

// Route to update scheduler configuration
app.put("/scheduler/config", async (req, res) => {
  try {
    const newConfig = req.body;

    const status = cleanupScheduler.updateConfig(newConfig);

    res.status(200).json({
      message: "Scheduler configuration updated successfully",
      status,
    });
  } catch (error) {
    console.error("Error updating scheduler config:", error);
    res.status(500).json({
      error: "Failed to update scheduler configuration",
      details: error.message,
    });
  }
});

// Route to run cleanup manually via scheduler
app.post("/scheduler/run", async (req, res) => {
  try {
    await cleanupScheduler.runCleanup();

    res.status(200).json({
      message: "Manual cleanup completed successfully",
    });
  } catch (error) {
    console.error("Error running manual cleanup:", error);
    res.status(500).json({
      error: "Failed to run manual cleanup",
      details: error.message,
    });
  }
});

export default app;
