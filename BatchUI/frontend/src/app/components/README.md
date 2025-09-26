# Components

This directory contains all the reusable UI components of the application.

## Component Structure

### Script Management

- `script-list/` - Main script management interface
  - Lists all scripts with status and actions
  - Supports bulk operations (run, delete)
  - Includes file browser integration
- `script-add/` - Script creation interface
  - Text-based script creation
  - File/directory upload support
  - Supports PowerShell, Batch, and Bash scripts
- `script-edit/` - Script editing interface
  - Modify existing scripts
  - Update script content and metadata
- `script-logs/` - Script execution logs
  - Real-time execution monitoring
  - Historical execution data
  - Progress tracking

### Cleanup Management

- `cleanup/` - Cleanup operations interface
  - Automated cleanup scheduling
  - Manual cleanup operations
  - Status monitoring
- `runs/` - Script execution history
  - Lists all script executions
  - Execution details and status
  - Filtering and sorting

### User Management

- `user-info/` - User profile management
  - User information display
  - Credential management
  - Authentication status

### File Management

- `file-browser/` - File system navigation
  - Directory browsing
  - File operations
  - Path navigation

## Common Features

Each component typically includes:

- `.ts` - Component logic and state management
- `.html` - Component template
- `.scss` - Component-specific styles

