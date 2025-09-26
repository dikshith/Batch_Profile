import { deleteScriptRun } from "./services.js";

class CleanupScheduler {
  constructor() {
    this.scheduler = null;
    this.isRunning = false;
    this.nextRunTime = null;
    this.lastRunTime = null;
    this.config = {
      enabled: false,
      interval: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
      days: 30,
      status: null, // null means all statuses
      dryRun: false,
    };
  }

  // Start the cleanup scheduler
  start(config = {}) {
    if (this.isRunning) {
      console.log("Cleanup scheduler is already running");
      return;
    }

    this.config = { ...this.config, ...config };

    if (!this.config.enabled) {
      console.log("Cleanup scheduler is disabled");
      this.nextRunTime = null;
      return;
    }

    console.log(`Starting cleanup scheduler with config:`, this.config);

    // Run initial cleanup
    this.runCleanup();

    // Calculate next run time
    this.nextRunTime = new Date(Date.now() + this.config.interval);

    // Schedule periodic cleanup
    this.scheduler = setInterval(() => {
      this.runCleanup();
      // Update next run time after each execution
      this.nextRunTime = new Date(Date.now() + this.config.interval);
    }, this.config.interval);

    this.isRunning = true;
    console.log(
      `Cleanup scheduler started. Will run every ${
        this.config.interval / (1000 * 60 * 60)
      } hours`
    );
    console.log(`Next run scheduled for: ${this.nextRunTime.toISOString()}`);
  }

  // Stop the cleanup scheduler
  stop() {
    if (this.scheduler) {
      clearInterval(this.scheduler);
      this.scheduler = null;
    }
    this.isRunning = false;
    this.nextRunTime = null;
    console.log("Cleanup scheduler stopped");
  }

  // Run cleanup manually
  async runCleanup() {
    try {
      console.log("Running scheduled cleanup...");
      this.lastRunTime = new Date();

      const options = {
        days: this.config.days,
        status: this.config.status,
        dryRun: this.config.dryRun,
      };

      const result = await deleteScriptRun.cleanupOldRuns(options);

      if (this.config.dryRun) {
        console.log("Cleanup dry run completed:", result.summary);
      } else {
        console.log(
          `Cleanup completed: ${result.deletedRuns} runs deleted, ${result.deletedLogFiles} log files deleted`
        );

        if (result.errors && result.errors.length > 0) {
          console.warn(
            `${result.errors.length} errors occurred during cleanup`
          );
        }
      }

      // Update next run time after successful execution
      if (this.isRunning) {
        this.nextRunTime = new Date(Date.now() + this.config.interval);
        console.log(
          `Next cleanup scheduled for: ${this.nextRunTime.toISOString()}`
        );
      }
    } catch (error) {
      console.error("Error during scheduled cleanup:", error);
      // Even on error, update next run time
      if (this.isRunning) {
        this.nextRunTime = new Date(Date.now() + this.config.interval);
      }
    }
  }

  // Get scheduler status
  getStatus() {
    return {
      isRunning: this.isRunning,
      config: this.config,
      nextRun: this.nextRunTime,
      lastRun: this.lastRunTime,
      timeUntilNextRun: this.nextRunTime
        ? this.nextRunTime.getTime() - Date.now()
        : null,
      formattedNextRun: this.nextRunTime
        ? this.nextRunTime.toISOString()
        : null,
      formattedLastRun: this.lastRunTime
        ? this.lastRunTime.toISOString()
        : null,
    };
  }

  // Update scheduler configuration
  updateConfig(newConfig) {
    const wasRunning = this.isRunning;

    if (wasRunning) {
      this.stop();
    }

    this.config = { ...this.config, ...newConfig };

    if (wasRunning && this.config.enabled) {
      this.start();
    }

    return this.getStatus();
  }

  // Get cleanup statistics
  async getStats() {
    try {
      const options = {
        days: this.config.days,
        status: this.config.status,
      };

      return await deleteScriptRun.getCleanupStats(options);
    } catch (error) {
      console.error("Error getting cleanup stats:", error);
      throw error;
    }
  }

  // Get detailed scheduler information
  getDetailedStatus() {
    const status = this.getStatus();
    const now = new Date();

    return {
      ...status,
      currentTime: now.toISOString(),
      isOverdue: this.nextRunTime && this.nextRunTime < now,
      timeUntilNextRunFormatted: this.formatTimeUntilNextRun(),
      intervalFormatted: this.formatInterval(),
    };
  }

  // Format time until next run in human-readable format
  formatTimeUntilNextRun() {
    if (!this.nextRunTime) return null;

    const timeUntil = this.nextRunTime.getTime() - Date.now();

    if (timeUntil <= 0) return "Overdue";

    const hours = Math.floor(timeUntil / (1000 * 60 * 60));
    const minutes = Math.floor((timeUntil % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeUntil % (1000 * 60)) / 1000);

    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s`;
    } else if (minutes > 0) {
      return `${minutes}m ${seconds}s`;
    } else {
      return `${seconds}s`;
    }
  }

  // Format interval in human-readable format
  formatInterval() {
    const hours = Math.floor(this.config.interval / (1000 * 60 * 60));
    const minutes = Math.floor(
      (this.config.interval % (1000 * 60 * 60)) / (1000 * 60)
    );

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    } else {
      return `${minutes}m`;
    }
  }

  // Force next run time calculation (useful for testing)
  recalculateNextRun() {
    if (this.isRunning && this.config.enabled) {
      this.nextRunTime = new Date(Date.now() + this.config.interval);
      console.log(
        `Next run time recalculated: ${this.nextRunTime.toISOString()}`
      );
    }
  }
}

// Create singleton instance
const cleanupScheduler = new CleanupScheduler();

export default cleanupScheduler;
