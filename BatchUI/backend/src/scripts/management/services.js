import fs from "fs";
import path from "path";
import { Script, ScriptRun } from "../models.js";

import { Op, fn, col } from "sequelize";

export const scriptsDir = "scripts";
// Service functions for adding scripts
export const addScript = {
  // Create a script file from text content
  async createScriptFile(name, scriptContent, type) {
    try {
      // Ensure scripts directory exists
      if (!fs.existsSync(scriptsDir)) {
        fs.mkdirSync(scriptsDir, { recursive: true });
        console.log(`Created scripts directory: ${scriptsDir}`);
      }

      // Determine file extension based on script type
      const extension =
        type === "powershell"
          ? ".ps1"
          : type === "batch" || type === "cmd"
          ? ".bat"
          : type === "bash"
          ? ".sh"
          : null;

      if (!extension) {
        throw new Error(`Invalid script type: ${type}`);
      }

      const filename = `${name}${extension}`;
      const filePath = path.join(scriptsDir, filename);

      console.log(`Creating script file: ${filePath}`);
      console.log(`Script content length: ${scriptContent.length} characters`);

      // Write script content to file
      fs.writeFileSync(filePath, scriptContent, "utf8");

      // Verify file was created
      if (!fs.existsSync(filePath)) {
        throw new Error(`Failed to create file: ${filePath}`);
      }

      const stats = fs.statSync(filePath);
      console.log(
        `Script file created successfully: ${filePath} (${stats.size} bytes)`
      );

      return filePath;
    } catch (error) {
      console.error(`Error creating script file: ${error.message}`);
      throw error;
    }
  },

  // Save script metadata to database
  async saveToDatabase(scriptData) {
    try {
      console.log(
        `Saving script to database: ${scriptData.name} (${scriptData.type})`
      );

      const script = await Script.create({
        name: scriptData.name,
        description: scriptData.description,
        type: scriptData.type,
        filePath: scriptData.filePath,
        isScript:
          scriptData.isScript !== undefined ? scriptData.isScript : true,
      });

      console.log(`Script saved to database with ID: ${script.id}`);
      return script;
    } catch (error) {
      console.error("Error saving script to database:", error);
      throw error;
    }
  },

  async saveMultipleToDatabase(scripts) {
    try {
      const createdScripts = await Script.bulkCreate(scripts, {
        validate: true,
      });
      return createdScripts;
    } catch (error) {
      console.error("Error saving multiple scripts to database:", error);
      throw error;
    }
  },
};

// Service functions for retrieving scripts
export const getScripts = {
  // Get all scripts with pagination, sorting, and filtering
  async getAllScripts(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "DESC",
        type,
        search,
        includeNonScripts = false,
        relativePath,
      } = options;

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Build where clause for filtering
      const whereClause = {};

      // Filter by script types by default (powershell, batch, bash)
      if (!includeNonScripts) {
        whereClause.isScript = true;
        if (type && ["powershell", "batch", "bash"].includes(type)) {
          whereClause.type = type;
        }
      } else {
        // If including non-scripts, filter by type if specified
        if (type) {
          whereClause.type = type;
        }
      }

      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
        ];
      }

      // Validate sort fields
      const allowedSortFields = ["name", "type", "createdAt", "updatedAt"];
      const validSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "createdAt";
      const validSortOrder = ["ASC", "DESC"].includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "DESC";

      // Get scripts with pagination
      const { count, rows } = await Script.findAndCountAll({
        where: whereClause,
        order: [[validSortBy, validSortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset),
        include: [
          {
            model: ScriptRun,
            attributes: ["id", "status", "startTime", "endTime"],
            order: [["createdAt", "DESC"]],
            limit: 3, // Show last 3 runs per script
            required: false,
          },
        ],
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(count / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        scripts: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      console.error("Error retrieving scripts:", error);
      throw error;
    }
  },

  // Get script by ID
  async getScriptById(id) {
    try {
      const script = await Script.findByPk(id, {
        include: [
          {
            model: ScriptRun,
            order: [["createdAt", "DESC"]],
            limit: 5, // Get last 5 runs
          },
        ],
      });
      return script;
    } catch (error) {
      console.error("Error retrieving script:", error);
      throw error;
    }
  },

  // Get statistics for dashboard
  async getStatistics() {
    try {
      // Get total counts
      const totalScripts = await Script.count({
        where: {
          isScript: true,
        },
      });
      const totalRuns = await ScriptRun.count();

      const scriptsByType = await Script.findAll({
        attributes: ["type", [fn("COUNT", col("id")), "count"]],
        group: ["type"],
        raw: true,
      });

      const runsByStatus = await ScriptRun.findAll({
        attributes: ["status", [fn("COUNT", col("id")), "count"]],
        group: ["status"],
        raw: true,
      });

      // Get recent activity (last 24 hours)
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);

      const recentRuns = await ScriptRun.count({
        where: {
          startTime: {
            [Op.gte]: last24Hours,
          },
        },
      });

      // Get currently running scripts
      const currentlyRunning = await ScriptRun.count({
        where: {
          status: "running",
        },
      });

      // Get success rate (last 100 runs)
      const last100Runs = await ScriptRun.findAll({
        attributes: ["status"],
        order: [["createdAt", "DESC"]],
        limit: 100,
        raw: true,
      });

      const successfulRuns = last100Runs.filter(
        (run) => run.status === "completed"
      ).length;
      const successRate =
        last100Runs.length > 0
          ? ((successfulRuns / last100Runs.length) * 100).toFixed(1)
          : 0;

      return {
        overview: {
          totalScripts,
          totalRuns,
          recentRuns,
          currentlyRunning,
          successRate: parseFloat(successRate),
        },
        scriptsByType: scriptsByType.reduce((acc, item) => {
          acc[item.type] = parseInt(item.count);
          return acc;
        }, {}),
        runsByStatus: runsByStatus.reduce((acc, item) => {
          acc[item.status] = parseInt(item.count);
          return acc;
        }, {}),
      };
    } catch (error) {
      console.error("Error retrieving statistics:", error);
      throw error;
    }
  },

  async getScript(filters) {
    const whereClause = {};
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== null) {
        whereClause[key] = value;
      }
    }

    const script = await Script.findOne({
      where: whereClause,
    });

    return script;
  },

  // Get non-script files with pagination, sorting, and filtering
  async getNonScriptFiles(options = {}) {
    try {
      const {
        page = 1,
        limit = 10,
        sortBy = "createdAt",
        sortOrder = "DESC",
        search,
      } = options;

      // Calculate offset for pagination
      const offset = (page - 1) * limit;

      // Build where clause for filtering non-script files
      const whereClause = {
        isScript: false,
      };

      if (search) {
        whereClause[Op.or] = [
          { name: { [Op.like]: `%${search}%` } },
          { description: { [Op.like]: `%${search}%` } },
        ];
      }

      // Validate sort fields
      const allowedSortFields = ["name", "type", "createdAt", "updatedAt"];
      const validSortBy = allowedSortFields.includes(sortBy)
        ? sortBy
        : "createdAt";
      const validSortOrder = ["ASC", "DESC"].includes(sortOrder.toUpperCase())
        ? sortOrder.toUpperCase()
        : "DESC";

      // Get non-script files with pagination
      const { count, rows } = await Script.findAndCountAll({
        where: whereClause,
        order: [[validSortBy, validSortOrder]],
        limit: parseInt(limit),
        offset: parseInt(offset),
      });

      // Calculate pagination metadata
      const totalPages = Math.ceil(count / limit);
      const hasNextPage = page < totalPages;
      const hasPrevPage = page > 1;

      return {
        files: rows,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalItems: count,
          itemsPerPage: parseInt(limit),
          hasNextPage,
          hasPrevPage,
        },
      };
    } catch (error) {
      console.error("Error retrieving non-script files:", error);
      throw error;
    }
  },
};

// Service functions for updating scripts
export const updateScript = {
  // Update script file: Delete old file and create new one
  async updateScriptFile(existingScript, newName, newContent, newType) {
    try {
      console.log(`Updating script file: ${existingScript.name} -> ${newName}`);
      console.log(
        `Script type: ${newType}, Content length: ${newContent.length} characters`
      );

      // Step 1: Delete the old file first
      if (fs.existsSync(existingScript.filePath)) {
        fs.unlinkSync(existingScript.filePath);
        console.log(`Deleted old script file: ${existingScript.filePath}`);
      } else {
        console.log(`Old script file not found: ${existingScript.filePath}`);
      }

      // Step 2: Create new file with new data
      const newFilePath = await addScript.createScriptFile(
        newName,
        newContent,
        newType
      );
      console.log(`Created new script file: ${newFilePath}`);

      // Verify the new file was created
      if (!fs.existsSync(newFilePath)) {
        throw new Error(`New script file was not created at: ${newFilePath}`);
      }

      const stats = fs.statSync(newFilePath);
      console.log(`New file verified: ${newFilePath} (${stats.size} bytes)`);

      return newFilePath;
    } catch (error) {
      console.error(`Error updating script file: ${error.message}`);
      throw error;
    }
  },

  // Update script in database
  async updateInDatabase(scriptId, updateData) {
    try {
      const script = await Script.findByPk(scriptId);
      if (!script) {
        throw new Error("Script not found");
      }

      // If we're replacing the file, delete the old one
      if (updateData.replaceFile && updateData.oldFilePath) {
        try {
          if (fs.existsSync(updateData.oldFilePath)) {
            fs.unlinkSync(updateData.oldFilePath);
            console.log(`Deleted old script file: ${updateData.oldFilePath}`);
          }
        } catch (error) {
          console.warn(`Failed to delete old script file: ${error.message}`);
        }
      }

      // Remove helper properties before updating
      const { replaceFile, oldFilePath, ...dbUpdateData } = updateData;

      // Update the script
      await script.update(dbUpdateData);

      return script;
    } catch (error) {
      console.error("Error updating script in database:", error);
      throw error;
    }
  },

  // Comprehensive update method: handles both file and database updates
  async updateScript(scriptId, updateData) {
    try {
      const script = await Script.findByPk(scriptId);
      if (!script) {
        throw new Error("Script not found");
      }

      const { name, description, type, scriptContent, ...otherData } =
        updateData;

      // If script content is provided, update the file
      let newFilePath = script.filePath;
      if (scriptContent !== undefined) {
        const scriptName = name || script.name;
        const scriptType = type || script.type;

        newFilePath = await this.updateScriptFile(
          script,
          scriptName,
          scriptContent,
          scriptType
        );
      }

      // Prepare database update data
      const dbUpdateData = {
        ...otherData,
      };

      if (name !== undefined) dbUpdateData.name = name;
      if (description !== undefined) dbUpdateData.description = description;
      if (type !== undefined) dbUpdateData.type = type;
      if (newFilePath !== script.filePath) dbUpdateData.filePath = newFilePath;

      // Update the script in database
      await script.update(dbUpdateData);

      // Return the updated script
      return await Script.findByPk(scriptId);
    } catch (error) {
      console.error("Error updating script:", error);
      throw error;
    }
  },
};

// Service functions for deleting scripts
export const deleteScript = {
  // Delete script from database and optionally file system
  async deleteFromDatabase(scriptId, options = {}) {
    const { deleteRuns = false, filePath } = options;

    try {
      const script = await Script.findByPk(scriptId);
      if (!script) {
        throw new Error("Script not found");
      }

      let deletedRuns = 0;
      let fileDeleted = false;

      // Delete associated script runs if requested
      if (deleteRuns) {
        const runCount = await ScriptRun.destroy({
          where: { scriptId },
        });
        deletedRuns = runCount;
        console.log(`Deleted ${runCount} script runs for script ${scriptId}`);
      }

      // Delete the script file
      if (filePath) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            fileDeleted = true;
            console.log(`Deleted script file: ${filePath}`);
          }
        } catch (error) {
          console.warn(`Failed to delete script file: ${error.message}`);
        }
      }

      // Delete the script from database
      await script.destroy();

      return {
        deletedRuns,
        fileDeleted,
      };
    } catch (error) {
      console.error("Error deleting script:", error);
      throw error;
    }
  },
};

export const scriptStats = {
  async scriptCount() {
    const count = await Script.count();
    return count;
  },
};

// Non-recursive directory listing for file browser
export async function listDirectory(relPath = "") {
  const dirPath = path.join(scriptsDir, relPath);
  if (!fs.existsSync(dirPath) || !fs.statSync(dirPath).isDirectory()) {
    return [];
  }
  // Get all scripts in this directory
  const items = fs.readdirSync(dirPath);
  // Build a map of filePath to id for all scripts in this directory
  const filePaths = items.map((name) => path.join("scripts", relPath, name));
  const scripts = await Script.findAll({
    where: {
      filePath: {
        [Op.in]: filePaths,
      },
    },
    attributes: ["id", "filePath"],
  });

  const filePathToId = Object.fromEntries(
    scripts.map((s) => [s.filePath.replace(/\\/g, "/"), s.id])
  );
  console.log("filePaths", filePathToId);
  return items.map((name) => {
    const absPath = path.join(dirPath, name);
    const stat = fs.statSync(absPath);
    const relFilePath = path.join("scripts", relPath, name).replace(/\\/g, "/");
    return {
      name,
      type: stat.isDirectory() ? "folder" : "file",
      size: stat.isFile() ? stat.size : undefined,
      mtime: stat.mtime,
      path: path.join(relPath, name).replace(/\\/g, "/"),
      id: stat.isFile() ? filePathToId[relFilePath] || null : null,
    };
  });
}

// Delete file or folder by path (and clean up DB)
export async function deleteByPath(relPath) {
  const targetPath = path.join(scriptsDir, relPath);
  if (!fs.existsSync(targetPath)) {
    throw new Error("File or folder does not exist");
  }
  const deletedFiles = [];
  const deletedFolders = [];
  const deletedDbIds = [];
  // Helper to delete a file and DB record
  async function deleteFile(filePath) {
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      fs.unlinkSync(filePath);
      deletedFiles.push(filePath.replace(/\\/g, "/"));
      // Remove DB record if present
      const dbFilePath = filePath;
      /*   .replace(/\\/g, "/")
      .replace(/^.*scripts\//, "scripts/");
      */
      console.log("dbFilePath", dbFilePath);
      const script = await Script.findOne({ where: { filePath: dbFilePath } });
      if (script) {
        deletedDbIds.push(script.id);
        await script.destroy();
      }
    }
  }
  // Helper to recursively delete a folder
  async function deleteFolder(folderPath) {
    if (!fs.existsSync(folderPath) || !fs.statSync(folderPath).isDirectory())
      return;
    for (const name of fs.readdirSync(folderPath)) {
      const abs = path.join(folderPath, name);
      if (fs.statSync(abs).isDirectory()) {
        await deleteFolder(abs);
      } else {
        await deleteFile(abs);
      }
    }
    fs.rmdirSync(folderPath);
    deletedFolders.push(folderPath.replace(/\\/g, "/"));
  }
  if (fs.statSync(targetPath).isDirectory()) {
    // Remove all DB records for files under this folder
    const absTarget = path.resolve(targetPath).replace(/\\/g, "/");
    const dbFiles = await Script.findAll({
      where: {
        filePath: {
          [Op.like]: `scripts/${relPath
            .replace(/\\/g, "/")
            .replace(/\/+$/, "")}/%`,
        },
      },
    });
    for (const script of dbFiles) {
      deletedDbIds.push(script.id);
      await script.destroy();
    }
    await deleteFolder(targetPath);
  } else {
    await deleteFile(targetPath);
  }
  return { deletedFiles, deletedFolders, deletedDbIds };
}
