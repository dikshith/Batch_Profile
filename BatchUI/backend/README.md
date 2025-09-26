# Windows Scripts WebApp

A powerful Node.js backend application for managing and executing Windows scripts (PowerShell, Batch, and Bash) with real-time monitoring capabilities.

## 🚀 Features

- **Script Management**: Upload, create, update, and delete scripts
- **Multiple Script Types**: Support for PowerShell (.ps1), Batch (.bat/.cmd), and Bash (.sh) scripts
- **Real-time Monitoring**: Live progress tracking and logging via WebSocket
- **File Browser**: Browse and manage files/folders in the scripts directory
- **Authentication**: JWT-based authentication with user management
- **Automated Cleanup**: Scheduled cleanup of old script runs
- **Database Integration**: SQLite database for persistent storage

## 📁 Directory Structure

```
backend/
├── 📁 src/                    # Main source code
│   ├── 📁 auth/              # Authentication module
│   ├── 📁 config/            # Configuration files
│   ├── 📁 middlewares/       # Express middlewares
│   ├── 📁 scripts/           # Script management modules
│   │   ├── 📁 execution/     # Script execution logic
│   │   ├── 📁 management/    # Script CRUD operations
│   │   └── 📁 run/          # Script run history
│   ├── 📁 sockets/          # WebSocket handlers
│   └── 📁 utils/            # Utility functions
├── 📁 logs/                  # Script execution logs
├── 📁 scripts/               # Uploaded script files
├── 📄 database.db           # SQLite database
├── 📄 service.js            # Windows service config
└── 📄 startup.bat           # Startup script
```

## 🛠️ Setup Instructions

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
   The server runs on port 3000 by default. To use a different port:
   ```bash
   PORT=4000 npm start
   ```

### Default Credentials

- Username: `admin`
- Password: `admin`
  ⚠️ **Important**: Change these credentials after first login!

## 📚 Module Documentation

Each major component has its own README.md with detailed documentation:

- [Authentication Module](src/auth/README.md)
- [Scripts Module](src/scripts/README.md)
  - [Execution Module](src/scripts/execution/README.md)
  - [Management Module](src/scripts/management/README.md)
  - [Run Module](src/scripts/run/README.md)
- [Configuration](src/config/README.md)
- [Utilities](src/utils/README.md)

## ⚙️ Configuration

### Database

- File: `src/config/db/db.js`
- Default location: `./database.db`
- Type: SQLite

### Server

- File: `src/config/server.js`
- Default port: 3000
- CORS: Enabled for all origins

### Authentication

- JWT Secret: Set via `JWT_SECRET` environment variable
- Default secret: "secret-key-scripts-app-dashboard"
- Token expiration: Never (permanent tokens)

## 🔒 Security Notes

1. Change default admin credentials immediately
2. Set a strong JWT_SECRET in production
3. Review CORS settings for production
4. Ensure proper file permissions on scripts directory
5. Monitor script execution for security risks

## 🚀 Running as a Windows Service

1. Install as service:

   ```bash
   npm run start:service
   ```

2. Stop service:
   ```bash
   npm run stop:service
   ```

## 📝 API Documentation

See [API_DOCUMENTATION.md](API_DOCUMENTATION.md) for detailed API endpoints.

## 🛡️ Authentication Documentation

See [AUTHENTICATION_DOCUMENTATION.md](AUTHENTICATION_DOCUMENTATION.md) for auth system details.

## 🔧 Common Modifications

See [QUICK_REFERENCE_GUIDE.md](QUICK_REFERENCE_GUIDE.md) for common customization points.

## 📊 Monitoring and Logging

- Script logs: `logs/` directory
- Application logs: Console output
- Database logs: Disabled by default
