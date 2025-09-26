# Configuration Module

## Overview

The configuration module manages server and database settings. It provides:

- Database configuration (SQLite)
- Server settings
- Environment variables
- CORS configuration
- Middleware setup

## 🔧 Core Components

### db/db.js

Database configuration:

```javascript
import { Sequelize } from "sequelize";

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./database.db",
  logging: false,
});

export async function initDB() {
  try {
    await import("../../scripts/models.js");
    await sequelize.sync({ alter: true });
    console.log("Database Initialized and synced");
  } catch (error) {
    console.error("Database initialization failed:", error);
    throw error;
  }
}
```

### server.js

Server configuration:

```javascript
export const SERVERCONFIG = {
  PORT: process.env.PORT || 3000,
  CORS: {
    origin: "*",
    methods: ["GET", "POST", "PATCH", "DELETE"],
    credentials: true,
  },
  JWT_SECRET: process.env.JWT_SECRET || "secret-key-scripts-app-dashboard",
};
```

## 📊 Database Configuration

### SQLite Settings

```javascript
{
  dialect: "sqlite",
  storage: "./database.db",
  logging: false,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  }
}
```

## 🔌 Server Configuration

### Environment Variables

```bash
PORT=3000                    # Server port
JWT_SECRET=your-secret-key   # JWT signing key
NODE_ENV=development         # Environment
```

### CORS Settings

```javascript
const corsOptions = {
  origin: "*", // Allow all origins
  methods: [
    // Allowed methods
    "GET",
    "POST",
    "PATCH",
    "DELETE",
  ],
  credentials: true, // Allow credentials
  optionsSuccessStatus: 200,
};
```

## 🔄 Initialization Flow

1. **Database Setup**

   ```javascript
   // 1. Create connection
   const sequelize = new Sequelize(config);

   // 2. Import models
   await import("../../scripts/models.js");

   // 3. Sync database
   await sequelize.sync({ alter: true });
   ```

2. **Server Setup**

   ```javascript
   // 1. Create Express app
   const app = express();

   // 2. Configure middleware
   app.use(cors(SERVERCONFIG.CORS));
   app.use(bodyParser.json());

   // 3. Initialize routes
   app.use("/auth", authController);
   app.use("/scripts", authMiddleware, scriptsController);
   ```

## 🔧 Customization Points

### Database Configuration

1. **Change Database Location**

   ```javascript
   const config = {
     storage: process.env.DB_PATH || "./database.db",
   };
   ```

2. **Enable Logging**

   ```javascript
   const config = {
     logging: console.log, // or custom logger
   };
   ```

3. **Connection Pool**
   ```javascript
   const config = {
     pool: {
       max: 10, // Maximum connections
       min: 0, // Minimum connections
       acquire: 30000, // Acquisition timeout
       idle: 10000, // Idle timeout
     },
   };
   ```

### Server Configuration

1. **Custom Port**

   ```javascript
   const PORT = process.env.PORT || 3000;
   ```

2. **CORS Origins**

   ```javascript
   const CORS = {
     origin: process.env.ALLOWED_ORIGINS?.split(",") || "*",
   };
   ```

3. **Security Headers**
   ```javascript
   app.use(helmet());
   app.use(compression());
   ```

## 🔒 Security Configuration

### JWT Settings

```javascript
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET,
  expiresIn: "never",
  algorithm: "HS256",
};
```

### CORS Security

```javascript
const CORS_CONFIG = {
  origin:
    process.env.NODE_ENV === "production" ? ["https://your-domain.com"] : "*",
  methods: ["GET", "POST", "PATCH", "DELETE"],
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
};
```

## 📝 Environment Configuration

### Development

```bash
# .env.development
PORT=3000
JWT_SECRET=dev-secret
NODE_ENV=development
```

### Production

```bash
# .env.production
PORT=80
JWT_SECRET=strong-secret
NODE_ENV=production
ALLOWED_ORIGINS=https://your-domain.com
```

## 🚨 Error Handling

### Database Errors

```javascript
try {
  await sequelize.authenticate();
} catch (error) {
  console.error("Unable to connect to database:", error);
  process.exit(1);
}
```

### Server Errors

```javascript
process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});
```

## 📊 Monitoring

### Database Health

```javascript
async function checkDbHealth() {
  try {
    await sequelize.authenticate();
    return { status: "up", message: "Database connected" };
  } catch (error) {
    return { status: "down", error: error.message };
  }
}
```

### Server Health

```javascript
app.get("/health", (req, res) => {
  res.json({
    status: "up",
    timestamp: new Date(),
    uptime: process.uptime(),
  });
});
```
