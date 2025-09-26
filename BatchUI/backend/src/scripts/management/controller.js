import { Router } from "express";
import {
  getScripts,
  addScript,
  updateScript,
  deleteScript,
  listDirectory,
} from "./services.js";
import { getScriptRuns } from "../run/services.js";
import fs from "fs";
import path from "path";
import multer from "multer";

const app = Router();

// script management {
// get all scripts
// get script by id
// create script
// update script
// delete script

// Configure multer for all file uploads with folder structure preservation

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "scripts/"); // Store uploaded scripts in scripts/ directory
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}${ext}`);
  },
});

const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    cb(null, true); // accept all file types
  },
});

const uploadAll = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      // Use fieldname (e.g., 'folder/file.txt') to get the relative folder
      console.log("file", file);
      const relativePath = path.dirname(file.fieldname);
      const fullPath = path.join("scripts", relativePath);

      console.log(relativePath, fullPath);

      // Create the folder if it doesn't exist
      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log(`Created directory: ${fullPath}`);
      }

      console.log(`Multer destination for ${file.originalname}: ${fullPath}`);
      cb(null, fullPath);
    },

    filename: (req, file, cb) => {
      // Use the file name from fieldname instead of originalname
      const filename = path.basename(file.fieldname); // e.g., 'file.txt'
      console.log(`Saving file as: ${filename}`);
      cb(null, filename);
    },
  }),

  fileFilter: (req, file, cb) => {
    cb(null, true); // accept all file types
  },
});

// Route to get all scripts (powershell, batch, shell by default)
app.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "DESC",
      type,
      search,
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100), // Max 100 items per page
      sortBy,
      sortOrder,
      type,
      search,
    };

    const result = await getScripts.getAllScripts(options);

    res.status(200).json({
      message: "Scripts retrieved successfully",
      ...result,
    });
  } catch (error) {
    console.error("Error retrieving scripts:", error);
    res.status(500).json({
      error: "Failed to retrieve scripts",
      details: error.message,
    });
  }
});

// Route to get statistics for dashboard
app.get("/stats", async (req, res) => {
  try {
    const stats = await getScripts.getStatistics();

    res.status(200).json({
      message: "Statistics retrieved successfully",
      stats,
    });
  } catch (error) {
    console.error("Error retrieving statistics:", error);
    res.status(500).json({
      error: "Failed to retrieve statistics",
      details: error.message,
    });
  }
});

// Route to get non-script files only
app.get("/files", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 100,
      sortBy = "createdAt",
      sortOrder = "DESC",
      search,
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100), // Max 100 items per page
      sortBy,
      sortOrder,
      search,
    };

    const result = await getScripts.getNonScriptFiles(options);

    res.status(200).json({
      message: "Non-script files retrieved successfully",
      ...result,
    });
  } catch (error) {
    console.error("Error retrieving non-script files:", error);
    res.status(500).json({
      error: "Failed to retrieve non-script files",
      details: error.message,
    });
  }
});

// Route to add non-script files
app.post(
  "/files/add",
  /* upload.array("files") */ uploadAll.any(),
  async (req, res) => {
    try {
      const { description, filePaths } = req.body;
      // Parse the file paths if provided
      let filePathsMap = {};
      if (filePaths) {
        try {
          filePathsMap = JSON.parse(filePaths);
          console.log("Received file paths:", filePathsMap);
        } catch (error) {
          console.warn("Failed to parse filePaths:", error);
        }
      }

      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          error: "No files uploaded",
        });
      }

      const files = [];
      for (const file of req.files) {
        console.log(`Processing file: ${file.originalname}`);
        console.log(`  All file properties:`, Object.keys(file));
        console.log(`  webkitRelativePath: ${file.webkitRelativePath}`);
        console.log(`  originalname: ${file.originalname}`);
        console.log(`  fieldname: ${file.fieldname}`);
        console.log(`  mimetype: ${file.mimetype}`);
        console.log(`  size: ${file.size}`);

        // Get the relative path from the filePaths map or webkitRelativePath
        let relativePath = "";
        const fileName = file.originalname;

        if (filePathsMap[fileName]) {
          // Use the path from the frontend
          relativePath = path.dirname(filePathsMap[fileName]);
          console.log(`  Using relativePath from filePaths: ${relativePath}`);
        } else if (file.webkitRelativePath) {
          // Fallback to webkitRelativePath if available
          relativePath = path.dirname(file.webkitRelativePath);
          console.log(
            `  Using relativePath from webkitRelativePath: ${relativePath}`
          );
        } else {
          // Try to extract from originalname if it contains path separators
          const originalName = file.originalname;
          if (originalName.includes("/") || originalName.includes("\\")) {
            relativePath = path.dirname(originalName);
            console.log(
              `  Extracted relativePath from originalname: ${relativePath}`
            );
          }
        }

        console.log(`  relativePath: ${relativePath}`);
        console.log(`  file.path: ${file.path}`);
        console.log(`  file.destination: ${file.destination}`);

        const nameWithoutExtension = path.parse(file.originalname).name;
        const extension = path.extname(file.originalname).toLowerCase();

        // Determine if it's a script file
        const isScriptFile = [".bat", ".cmd", ".ps1", ".sh"].includes(
          extension
        );

        // Determine type based on extension
        let type;
        if (extension === ".bat") type = "batch";
        else if (extension === ".cmd") type = "batch";
        else if (extension === ".ps1") type = "powershell";
        else if (extension === ".sh") type = "bash";
        else type = extension.slice(1); // Remove the dot and use extension as type

        // Move file to correct location if it has a relative path
        let finalFilePath = file.path;

        if (relativePath) {
          const targetDir = path.join("scripts", relativePath);
          const targetPath = path.join(targetDir, file.originalname);

          // Ensure target directory exists
          if (!fs.existsSync(targetDir)) {
            fs.mkdirSync(targetDir, { recursive: true });
            console.log(`  Created target directory: ${targetDir}`);
          }

          // Move file to correct location
          if (file.path !== targetPath) {
            fs.renameSync(file.path, targetPath);
            finalFilePath = targetPath;
            console.log(`  Moved file from ${file.path} to ${targetPath}`);
          }
        }

        // Check if the file already exists
        const existingFile = await getScripts.getScript({
          filePath: finalFilePath,
        });

        if (existingFile) {
          return res.status(400).json({
            error: `File ${file.originalname} already exists at ${
              relativePath || "root"
            }`,
          });
        }

        // Use the original filename as the name, the filePath will contain the full path
        files.push({
          name: nameWithoutExtension,
          description: description || "",
          type,
          filePath: finalFilePath,
          isScript: isScriptFile,
        });
      }

      // Save the files to the database
      const savedFiles = await addScript.saveMultipleToDatabase(files);

      return res.status(201).json({
        message: `${savedFiles.length} file(s) added successfully`,
        files: savedFiles,
      });
    } catch (error) {
      console.error("Error adding files:", error);
      res.status(500).json({
        error: "Failed to add files",
        details: error.message,
      });
    }
  }
);

// Route to delete a file or folder by path
app.delete("/files", async (req, res) => {
  try {
    const relPath = req.query.path;
    if (!relPath) {
      return res.status(400).json({ error: "Missing 'path' query parameter" });
    }
    const { deleteByPath } = await import("./services.js");
    const result = await deleteByPath(relPath);
    res.status(200).json({ message: "Delete successful", ...result });
  } catch (error) {
    console.error("Error deleting file/folder:", error);
    res.status(500).json({
      error: "Failed to delete file or folder",
      details: error.message,
    });
  }
});

// Route to get a specific script by ID
app.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const script = await getScripts.getScriptById(id);

    if (!script) {
      return res.status(404).json({ error: "Script not found" });
    }

    res.status(200).json({
      message: "Script retrieved successfully",
      script,
    });
  } catch (error) {
    console.error("Error retrieving script:", error);
    res.status(500).json({
      error: "Failed to retrieve script",
      details: error.message,
    });
  }
});

// Route to get script runs for a specific script
app.get("/:id/runs", async (req, res) => {
  try {
    const { id } = req.params;
    const {
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "DESC",
      status,
    } = req.query;

    const options = {
      page: parseInt(page),
      limit: Math.min(parseInt(limit), 100),
      sortBy,
      sortOrder,
      status,
    };

    const result = await getScriptRuns.getByScriptId(id, options);

    res.status(200).json({
      message: "Script runs retrieved successfully",
      ...result,
    });
  } catch (error) {
    console.error("Error retrieving script runs:", error);
    res.status(500).json({
      error: "Failed to retrieve script runs",
      details: error.message,
    });
  }
});

// Route to get script file content for editing
app.get("/:id/content", async (req, res) => {
  try {
    const { id } = req.params;

    // Get script details
    const script = await getScripts.getScriptById(id);
    if (!script) {
      return res.status(404).json({ error: "Script not found" });
    }

    // Read script file content
    if (!fs.existsSync(script.filePath)) {
      return res.status(404).json({ error: "Script file not found on disk" });
    }

    const content = fs.readFileSync(script.filePath, "utf8");

    res.status(200).json({
      message: "Script content retrieved successfully",
      script: {
        id: script.id,
        name: script.name,
        description: script.description,
        type: script.type,
        scriptContent: content,
      },
    });
  } catch (error) {
    console.error("Error retrieving script content:", error);
    res.status(500).json({
      error: "Failed to retrieve script content",
      details: error.message,
    });
  }
});

// Route to add a new script (via UI)
app.post("/add", async (req, res) => {
  try {
    const { name, description, type, scriptContent } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        error: "Missing required fields: name and type are required",
      });
    }

    if (!["batch", "powershell", "cmd", "bash"].includes(type)) {
      return res.status(400).json({
        error:
          "Invalid script type. Must be 'batch', 'powershell', 'cmd', or 'bash'",
      });
    }

    // check if the file already exists
    let extension =
      type === "batch"
        ? ".bat"
        : type === "powershell"
        ? ".ps1"
        : type === "cmd"
        ? ".bat" // cmd files use .bat extension
        : type === "bash"
        ? ".sh"
        : null;
    const existingScript = await getScripts.getScript({
      filePath: path.join("scripts", name + extension),
    });

    if (existingScript) {
      return res.status(400).json({
        error: "Script already exists",
      });
    }

    let filePath;

    if (scriptContent) {
      try {
        filePath = await addScript.createScriptFile(name, scriptContent, type);
        console.log(`Script file created at: ${filePath}`);
      } catch (error) {
        console.error("Failed to create script file:", error);
        return res.status(500).json({
          error: "Failed to create script file",
          details: error.message,
        });
      }
    } else {
      return res.status(400).json({
        error: "Either upload a file or provide scriptContent",
      });
    }

    // Add script to database
    let script;
    try {
      script = await addScript.saveToDatabase({
        name,
        description: description || "",
        type,
        filePath,
        isScript: true,
      });
      console.log(`Script saved to database with ID: ${script.id}`);
    } catch (error) {
      // If database save fails, clean up the created file
      try {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
          console.log(
            `Cleaned up script file after database error: ${filePath}`
          );
        }
      } catch (cleanupError) {
        console.error("Failed to clean up script file:", cleanupError);
      }
      throw error;
    }

    res.status(201).json({
      message: "Script added successfully",
      script: {
        id: script.id,
        name: script.name,
        description: script.description,
        type: script.type,
        filePath: script.filePath,
      },
    });
  } catch (error) {
    console.error("Error adding script:", error);
    res.status(500).json({
      error: "Failed to add script",
      details: error.message,
    });
  }
});

// Route to update a script
app.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, type, scriptContent } = req.body;

    console.log("Updating script:", id, req.body);

    // Validate script type if provided
    if (type && !["batch", "powershell", "cmd", "bash"].includes(type)) {
      return res.status(400).json({
        error:
          "Invalid script type. Must be 'batch', 'powershell', 'cmd', or 'bash'",
      });
    }

    // Check if script exists
    const existingScript = await getScripts.getScriptById(id);
    if (!existingScript) {
      return res.status(404).json({ error: "Script not found" });
    }

    // Read existing script content if no new content is provided
    if (!scriptContent && existingScript.filePath) {
      try {
        const existingScriptContent = fs.readFileSync(
          existingScript.filePath,
          "utf8"
        );
        // If no new content provided, use existing content
        if (!scriptContent) {
          scriptContent = existingScriptContent;
        }
      } catch (error) {
        console.warn(
          `Could not read existing script content: ${error.message}`
        );
      }
    }

    // Update script using comprehensive service method
    let updatedScript;
    try {
      updatedScript = await updateScript.updateScript(id, {
        name,
        description,
        type,
        scriptContent,
      });
      console.log(`Script updated successfully: ${updatedScript.id}`);
    } catch (error) {
      console.error("Failed to update script:", error);
      return res.status(500).json({
        error: "Failed to update script",
        details: error.message,
      });
    }

    res.status(200).json({
      message: "Script updated successfully",
      script: {
        id: updatedScript.id,
        name: updatedScript.name,
        description: updatedScript.description,
        type: updatedScript.type,
        filePath: updatedScript.filePath,
      },
    });
  } catch (error) {
    console.error("Error updating script:", error);
    res.status(500).json({
      error: "Failed to update script",
      details: error.message,
    });
  }
});

// Route to delete a script
app.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { deleteRuns = true } = req.query; // Optional: delete associated runs

    // Check if script exists
    const existingScript = await getScripts.getScriptById(id);
    if (!existingScript) {
      return res.status(404).json({ error: "Script not found" });
    }

    // Delete the script and optionally its runs
    const deletionResult = await deleteScript.deleteFromDatabase(id, {
      deleteRuns: deleteRuns === "true",
      filePath: existingScript.filePath,
    });

    res.status(200).json({
      message: "Script deleted successfully",
      deletedScript: {
        id: existingScript.id,
        name: existingScript.name,
      },
      deletedRuns: deletionResult.deletedRuns || 0,
      fileDeleted: deletionResult.fileDeleted,
    });
  } catch (error) {
    console.error("Error deleting script:", error);
    res.status(500).json({
      error: "Failed to delete script",
      details: error.message,
    });
  }
});

// Route to list files and folders in a given directory (non-recursive)
app.get("/files/list", async (req, res) => {
  try {
    const relPath = req.query.path || "";
    const result = await listDirectory(relPath);
    res.status(200).json({ items: result });
  } catch (error) {
    console.error("Error listing directory:", error);
    res.status(500).json({
      error: "Failed to list directory",
      details: error.message,
    });
  }
});

export default app;
