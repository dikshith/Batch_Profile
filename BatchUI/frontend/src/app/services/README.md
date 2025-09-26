# Services

This directory contains all the business logic and data management services of the application.

## Service Structure

### Authentication & Connection

- `auth.service.ts` - Authentication management
  - User authentication
  - JWT token handling
  - User state management
  - Login/logout functionality
- `connect-server.service.ts` - Server connection
  - API URL management
  - Connection status


### Script Management

- `script-service.ts` - Core script operations
  - CRUD operations for scripts
  - Script execution
  - Script status management
  - File uploads
  - Pagination handling
- `script-run.service.ts` - Execution management
  - Run history
  - Execution status tracking
  - Progress monitoring
  - Log management

### Real-time Communication

- `socket.service.ts` - WebSocket handling
  - Real-time updates
  - Script execution monitoring
  - Status notifications
  - Connection management

### System Operations

- `cleanup.service.ts` - Cleanup operations
  - Automated cleanup scheduling
  - Manual cleanup execution
  - Status tracking
  - History management