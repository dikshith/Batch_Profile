import { ScriptRun, Script } from "../models.js";
import { Op } from "sequelize";
import fs from "fs";

// Service functions for retrieving script runs
export const getScriptRuns = {
  // Get all script runs for a specific script with pagination
  async getByScriptId(scriptId, options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "DESC",
        status,
      } = options;

      const offset = (page - 1) * limit;

      // Build where clause
      const whereClause = { scriptId };
      if (
        status &&
        ["pending", "running", "completed", "failed"].includes(status)
      ) {
        whereClause.status = status;
      }

      // Validate sort fields
      const allowedSortFields = [
        "startTime",
        "endTime",
        "status",
        "progress",
        "createdAt",
      ];
      const validSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "createdAt";
      const validSortOrder = ["ASC", "DESC"].includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "DESC";

      const { count, rows } = await ScriptRun.findAndCountAll({
        where: whereClause,
        order: [[validSortBy, validSortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset),
        include: [
          {
            model: Script,
            attributes: ["name", "type"],
          },
        ],
      });

      const totalPages = Math.ceil(count / limit);

      return {
        scriptRuns: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      console.error("Error retrieving script runs:", error);
      throw error;
    }
  },

  // Get all script runs with pagination, sorting, and filtering
  async getAllRuns(options = {}) {
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
      } = options;

      const offset = (page - 1) * limit;

      // Build where clause for filtering
      const whereClause = {};
      if (
        status &&
        ["pending", "running", "completed", "failed"].includes(status)
      ) {
        whereClause.status = status;
      }
      if (scriptId) {
        whereClause.scriptId = scriptId;
      }
      if (dateFrom || dateTo) {
        whereClause.startTime = {};
        if (dateFrom) {
          whereClause.startTime[Op.gte] = new Date(dateFrom);
        }
        if (dateTo) {
          whereClause.startTime[Op.lte] = new Date(dateTo);
        }
      }

      // Validate sort fields
      const allowedSortFields = [
        "startTime",
        "endTime",
        "status",
        "progress",
        "createdAt",
      ];
      const validSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "createdAt";
      const validSortOrder = ["ASC", "DESC"].includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "DESC";

      const { count, rows } = await ScriptRun.findAndCountAll({
        where: whereClause,
        order: [[validSortBy, validSortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset),
        include: [
          {
            model: Script,
            attributes: ["name", "type", "description"],
          },
        ],
      });

      const totalPages = Math.ceil(count / limit);

      return {
        scriptRuns: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage: page < totalPages,
          hasPrevPage: page > 1,
        },
      };
    } catch (error) {
      console.error("Error retrieving all script runs:", error);
      throw error;
    }
  },

  // Get script run by ID
  async getRunById(id) {
    try {
      const scriptRun = await ScriptRun.findByPk(id, {
        include: [
          {
            model: Script,
            attributes: ["name", "type", "description"],
          },
        ],
      });
      if (scriptRun.status === "completed" && scriptRun.logFile) {
        const log_content = fs.readFileSync(scriptRun.logFile, "utf8");
        scriptRun.dataValues.content = log_content;
      }
      return scriptRun;
    } catch (error) {
      console.error("Error retrieving script run:", error);
      throw error;
    }
  },
};

export const scriptRunStats = {
  async scriptRunCount() {
    const count = await ScriptRun.count();
    return count;
  },

  async scriptRunCountByStatus(status) {
    const count = await ScriptRun.count({ where: { status } });
    return count;
  },
};

// Service functions for deleting script runs
export const deleteScriptRun = {
  // Delete script run by ID (for cleanup)
  async deleteRunById(runId) {
    try {
      const scriptRun = await ScriptRun.findByPk(runId);
      if (!scriptRun) {
        throw new Error("Script run not found");
      }

      // Delete associated log file if it exists
      if (scriptRun.logFile && fs.existsSync(scriptRun.logFile)) {
        try {
          fs.unlinkSync(scriptRun.logFile);
          console.log(`Deleted log file: ${scriptRun.logFile}`);
        } catch (error) {
          console.warn(`Failed to delete log file: ${error.message}`);
        }
      }

      // Delete the script run
      await scriptRun.destroy();

      return { logFileDeleted: true };
    } catch (error) {
      console.error("Error deleting script run:", error);
      throw error;
    }
  },

  // Delete multiple script runs by their IDs
  async deleteBulkRuns(runIds) {
    console.log("Deleting bulk runs:", runIds);
    return Promise.all(
      runIds.map(async (runId) => {
        await this.deleteRunById(runId);
      })
    )
      .then(() => {
        console.log("Bulk runs deleted successfully");
      })
      .catch((error) => {
        console.error("Error deleting bulk runs:", error);
        throw error;
      });
  },

  // Clean up script runs older than specified days
  async cleanupOldRuns(options = {}) {
    const {
      days = 30, // Default to 30 days
      status = null, // Optional: only delete runs with specific status
      dryRun = false, // If true, only show what would be deleted
    } = options;

    try {
      console.log(`Starting cleanup of script runs older than ${days} days...`);

      // Calculate the cutoff date
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      // Build where clause
      const whereClause = {
        startTime: {
          [Op.lt]: cutoffDate,
        },
      };

      // Add status filter if specified
      if (
        status &&
        ["pending", "running", "completed", "failed"].includes(status)
      ) {
        whereClause.status = status;
      }

      // Get runs that would be deleted
      const runsToDelete = await ScriptRun.findAll({
        where: whereClause,
        include: [
          {
            model: Script,
            attributes: ["name", "type"],
          },
        ],
        order: [["startTime", "ASC"]],
      });

      console.log(`Found ${runsToDelete.length} runs to delete`);

      if (dryRun) {
        // Return information about what would be deleted
        const summary = {
          totalRuns: runsToDelete.length,
          cutoffDate: cutoffDate,
          runsByStatus: {},
          runsByScript: {},
          logFilesToDelete: 0,
        };

        // Count by status
        runsToDelete.forEach((run) => {
          summary.runsByStatus[run.status] =
            (summary.runsByStatus[run.status] || 0) + 1;
        });

        // Count by script
        runsToDelete.forEach((run) => {
          const scriptName = run.Script ? run.Script.name : "Unknown";
          summary.runsByScript[scriptName] =
            (summary.runsByScript[scriptName] || 0) + 1;
        });

        // Count log files that would be deleted
        runsToDelete.forEach((run) => {
          if (run.logFile && fs.existsSync(run.logFile)) {
            summary.logFilesToDelete++;
          }
        });

        return {
          dryRun: true,
          summary,
          runs: runsToDelete.map((run) => ({
            id: run.id,
            scriptName: run.Script ? run.Script.name : "Unknown",
            status: run.status,
            startTime: run.startTime,
            logFile: run.logFile,
            hasLogFile: run.logFile && fs.existsSync(run.logFile),
          })),
        };
      }

      // Actually delete the runs
      let deletedCount = 0;
      let logFilesDeleted = 0;
      let errors = [];

      for (const run of runsToDelete) {
        try {
          // Delete associated log file if it exists
          if (run.logFile && fs.existsSync(run.logFile)) {
            try {
              fs.unlinkSync(run.logFile);
              logFilesDeleted++;
              console.log(`Deleted log file: ${run.logFile}`);
            } catch (error) {
              console.warn(
                `Failed to delete log file ${run.logFile}: ${error.message}`
              );
            }
          }

          // Delete the script run
          await run.destroy();
          deletedCount++;

          if (deletedCount % 100 === 0) {
            console.log(`Deleted ${deletedCount} runs so far...`);
          }
        } catch (error) {
          console.error(`Error deleting run ${run.id}:`, error.message);
          errors.push({
            runId: run.id,
            error: error.message,
          });
        }
      }

      const result = {
        dryRun: false,
        deletedRuns: deletedCount,
        deletedLogFiles: logFilesDeleted,
        cutoffDate: cutoffDate,
        errors: errors,
        totalProcessed: runsToDelete.length,
      };

      console.log(
        `Cleanup completed: ${deletedCount} runs deleted, ${logFilesDeleted} log files deleted`
      );

      if (errors.length > 0) {
        console.warn(`${errors.length} errors occurred during cleanup`);
      }

      return result;
    } catch (error) {
      console.error("Error during cleanup:", error);
      throw error;
    }
  },

  // Get cleanup statistics
  async getCleanupStats(options = {}) {
    const { days = 30, status = null } = options;

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);

      const whereClause = {
        startTime: {
          [Op.lt]: cutoffDate,
        },
      };

      if (
        status &&
        ["pending", "running", "completed", "failed"].includes(status)
      ) {
        whereClause.status = status;
      }

      const oldRuns = await ScriptRun.findAll({
        where: whereClause,
        attributes: ["status", "logFile"],
        raw: true,
      });

      const stats = {
        totalOldRuns: oldRuns.length,
        cutoffDate: cutoffDate,
        byStatus: {},
        logFilesCount: 0,
        storageEstimate: 0,
      };

      // Count by status
      oldRuns.forEach((run) => {
        stats.byStatus[run.status] = (stats.byStatus[run.status] || 0) + 1;

        // Count log files
        if (run.logFile && fs.existsSync(run.logFile)) {
          stats.logFilesCount++;
          try {
            const stats = fs.statSync(run.logFile);
            stats.storageEstimate += stats.size;
          } catch (error) {
            // Ignore file stat errors
          }
        }
      });

      return stats;
    } catch (error) {
      console.error("Error getting cleanup stats:", error);
      throw error;
    }
  },
};
