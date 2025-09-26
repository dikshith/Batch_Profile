# Script Management Module

## Overview

The management module handles all CRUD (Create, Read, Update, Delete) operations for scripts and files. It supports:

- File uploads (single/multiple)
- Folder uploads with structure preservation
- Text-based script creation
- File/folder browsing
- Script updates and deletion
- Any file type support

## 🔧 Core Components

### controller.js

Handles HTTP routes and file upload configuration:

1. **File Upload Configuration**

   ```javascript
   const storage = multer.diskStorage({
     destination: (req, file, cb) => {
       cb(null, "scripts/");
     },
     filename: (req, file, cb) => {
       const ext = path.extname(file.originalname);
       const name = path.basename(file.originalname, ext);
       cb(null, `${name}${ext}`);
     },
   });
   ```

2. **Folder Upload Configuration**
   ```javascript
   const uploadAll = multer({
     storage: multer.diskStorage({
       destination: (req, file, cb) => {
         const relativePath = path.dirname(file.fieldname);
         const fullPath = path.join("scripts", relativePath);
         fs.mkdirSync(fullPath, { recursive: true });
         cb(null, fullPath);
       },
       filename: (req, file, cb) => {
         const filename = path.basename(file.fieldname);
         cb(null, filename);
       },
     }),
   });
   ```

### services.js

Contains business logic for script management:

1. **Script Creation**

   ```javascript
   const addScript = {
     async createScriptFile(name, content, type),
     async saveToDatabase(scriptData),
     async saveMultipleToDatabase(scripts),
   };
   ```

2. **Script Retrieval**

   ```javascript
   const getScripts = {
     async getAllScripts(options),
     async getScriptById(id),
     async getNonScriptFiles(),
   };
   ```

3. **Script Updates**

   ```javascript
   const updateScript = {
     async updateScriptFile(existingScript, newName, newContent, newType),
     async updateScript(id, updates),
   };
   ```

4. **File Browser**
   ```javascript
   async function listDirectory(relPath = "");
   async function deleteByPath(relPath);
   ```

## 📁 File Management

### File Types

1. **Scripts**

   - PowerShell (.ps1)
   - Batch (.bat/.cmd)
   - Bash (.sh)
   - `isScript: true`

2. **Regular Files**
   - Any extension
   - Type = file extension
   - `isScript: false`

### File Storage

- Base directory: `scripts/`
- Relative paths in DB
- Preserved folder structure
- Unique filenames

### Folder Structure

```
scripts/
├── folder1/
│   ├── script1.ps1
│   └── data.txt
├── folder2/
│   └── subfolder/
│       └── script2.bat
└── script3.sh
```

## 🔄 API Endpoints

### Script Management

1. **Create Script**

   ```http
   POST /scripts/add
   Content-Type: multipart/form-data

   files: [File]
   name: string
   description: string
   type: string
   ```

2. **Get Scripts**

   ```http
   GET /scripts
   Query params:
   - type: string
   - isScript: boolean
   - search: string
   ```

3. **Update Script**

   ```http
   PATCH /scripts/:id
   Content-Type: application/json

   {
     name: string,
     description: string,
     content: string,
     type: string
   }
   ```

4. **Delete Script**
   ```http
   DELETE /scripts/:id
   ```

### File Browser

1. **List Directory**

   ```http
   GET /scripts/files/list
   Query params:
   - path: string
   ```

2. **Delete Path**
   ```http
   DELETE /scripts/files/list
   Query params:
   - path: string
   ```

## 🔒 Security Features

### File Upload Security

1. **Path Validation**

   ```javascript
   const safePath = path
     .normalize(path.join("scripts", relativePath))
     .replace(/^(\.\.[\/\\])+/, "");
   ```

2. **File Type Validation**

   ```javascript
   const isValidType = allowedTypes.includes(fileExtension);
   ```

3. **Size Limits**
   ```javascript
   const upload = multer({
     limits: {
       fileSize: maxFileSize,
     },
   });
   ```

### Access Control

1. **Directory Restriction**

   - Confined to `scripts/`
   - No parent traversal
   - Permission checks

2. **File Operations**
   - Safe file deletion
   - Atomic updates
   - Concurrent access handling

## 📊 Database Integration

### Script Model

```javascript
{
  name: STRING,
  description: TEXT,
  type: STRING,
  filePath: STRING,
  isScript: BOOLEAN,
}
```

### File Sync

1. **Database ↔ Filesystem Sync**

   ```javascript
   async function syncScriptsToDB() {
     // Sync files on disk with database
   }
   ```

2. **Orphan Cleanup**
   ```javascript
   // Remove DB records for deleted files
   if (!fs.existsSync(script.filePath)) {
     await script.destroy();
   }
   ```

## 🚨 Error Handling

### Upload Errors

1. **Duplicate Files**

   ```javascript
   if (existingScript) {
     return res.status(400).json({
       error: "Script with this name already exists",
     });
   }
   ```

2. **Invalid Types**
   ```javascript
   if (!isValidFileType(file.originalname)) {
     return res.status(400).json({
       error: "Invalid file type",
     });
   }
   ```

### File Operation Errors

1. **Missing Files**

   ```javascript
   if (!fs.existsSync(filePath)) {
     throw new Error("File not found");
   }
   ```

2. **Permission Issues**
   ```javascript
   try {
     await fs.access(filePath, fs.constants.W_OK);
   } catch (error) {
     throw new Error("Permission denied");
   }
   ```

## 🔧 Customization Points

### Add File Type Support

```javascript
const fileTypeMap = {
  ".ps1": { type: "powershell", isScript: true },
  ".bat": { type: "batch", isScript: true },
  ".sh": { type: "bash", isScript: true },
  ".your-ext": { type: "your-type", isScript: false },
};
```

### Modify Storage Location

```javascript
const SCRIPTS_DIR = process.env.SCRIPTS_DIR || "scripts";
```

### Custom Naming Convention

```javascript
function generateFileName(originalName, type) {
  // Your custom naming logic
}
```

## 📝 Best Practices

1. **File Operations**

   - Use atomic operations
   - Validate paths
   - Handle concurrency
   - Clean up on failure

2. **Error Handling**

   - Validate inputs
   - Provide clear messages
   - Log errors
   - Clean up resources

3. **Security**

   - Sanitize inputs
   - Validate file types
   - Check permissions
   - Prevent traversal

4. **Performance**
   - Batch operations
   - Stream large files
   - Clean up temporary files
   - Optimize queries
