# Authentication Module

## Overview

The authentication module provides JWT-based authentication with user management. Features:

- JWT token authentication
- User management (admin)
- Password hashing
- Route protection
- Token persistence

## 🔧 Core Components

### model.js

User model with password hashing:

```javascript
const User = sequelize.define("User", {
  username: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

// Password hashing hook
User.beforeCreate(async (user) => {
  if (user.password) {
    user.password = await bcrypt.hash(user.password, 10);
  }
});
```

### services.js

Authentication business logic:

1. **Login**

   ```javascript
   async loginUser(username, password) {
     const user = await User.findOne({
       where: { username, isActive: true }
     });
     const isValid = await user.comparePassword(password);
     const token = generateToken(user);
     return { token, user };
   }
   ```

2. **Credential Management**
   ```javascript
   async updateCredentials(userId, newUsername, newPassword) {
     const user = await User.findByPk(userId);
     await user.update({
       username: newUsername,
       password: newPassword,
     });
   }
   ```

### middleware/auth.js

JWT authentication middleware:

```javascript
export const authMiddleware = (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) return res.status(401).json({ error: "No token" });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(401).json({ error: "Invalid token" });
  }
};
```

## 🔐 Authentication Flow

1. **Initial Setup**

   ```javascript
   // Create default admin
   await User.create({
     username: "admin",
     password: "admin",
     isActive: true,
   });
   ```

2. **Login Process**

   ```javascript
   POST /auth/login
   {
     username: "admin",
     password: "admin"
   }
   ↓
   {
     token: "jwt.token.here",
     user: {
       id: 1,
       username: "admin"
     }
   }
   ```

3. **Token Usage**
   ```http
   GET /protected/route
   Authorization: Bearer jwt.token.here
   ```

## 🔌 API Endpoints

### Authentication

1. **Login**

   ```http
   POST /auth/login
   Body:
   {
     username: string,
     password: string
   }
   ```

2. **Update Credentials**

   ```http
   PATCH /auth/credentials
   Body:
   {
     newUsername?: string,
     newPassword?: string
   }
   ```

3. **Get Current User**

   ```http
   GET /auth/me
   ```

4. **Logout**
   ```http
   POST /auth/logout
   ```

### User Management

1. **Get All Users**

   ```http
   GET /auth/users
   ```

### Route Protection

```javascript
// Protect routes
app.use("/scripts", authMiddleware);
app.use("/runs", authMiddleware);
```

## 📊 Database Model

### User Model

```javascript
{
  username: STRING(unique),  // Username
  password: STRING,         // Hashed password
  isActive: BOOLEAN,       // Account status
  createdAt: DATE,        // Creation timestamp
  updatedAt: DATE         // Last update
}
```

## 🔧 Customization Points

### JWT Configuration

```javascript
const JWT_CONFIG = {
  secret: process.env.JWT_SECRET || "default-secret-key",
  expiresIn: "never", // Token never expires
  algorithm: "HS256",
};
```
