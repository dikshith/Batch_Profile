import { Router } from "express";
import { authMiddleware } from "../middlewares/auth.js";
import { authServices } from "./services.js";

const app = Router();

// Route to test if server is running (no auth required)
app.get("/test", (req, res) => {
  res.status(200).json({
    message: "Server is running!",
    timestamp: new Date().toISOString(),
  });
});

// Route to login
app.post("/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    const result = await authServices.loginUser(username, password);

    res.status(200).json({
      message: "Login successful",
      ...result,
    });
  } catch (error) {
    console.error("Login error:", error);

    // Handle specific error types
    if (error.message === "Username and password are required") {
      return res.status(400).json({
        error: error.message,
      });
    }

    if (error.message === "Invalid credentials") {
      return res.status(401).json({
        error: error.message,
      });
    }

    res.status(500).json({
      error: "Internal server error during login",
      details: error.message,
    });
  }
});

// Route to change username or password (requires authentication)
app.patch("/credentials", authMiddleware, async (req, res) => {
  try {
    const { newUsername, newPassword } = req.body;

    const result = await authServices.updateCredentials(
      req.user.id,
      newUsername,
      newPassword
    );

    res.status(200).json({
      message: "Credentials updated successfully",
      ...result,
    });
  } catch (error) {
    console.error("Update credentials error:", error);

    // Handle specific error types
    if (
      error.message ===
      "At least one of newUsername or newPassword must be provided"
    ) {
      return res.status(400).json({
        error: error.message,
      });
    }

    if (error.message === "User not found") {
      return res.status(404).json({
        error: error.message,
      });
    }

    if (error.message === "Username already exists") {
      return res.status(400).json({
        error: error.message,
      });
    }

    res.status(500).json({
      error: "Internal server error during credentials update",
      details: error.message,
    });
  }
});

// Route to get current user info (requires authentication)
app.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await authServices.getUserById(req.user.id);

    res.status(200).json({
      message: "User info retrieved successfully",
      user,
    });
  } catch (error) {
    console.error("Get user info error:", error);

    if (error.message === "User not found") {
      return res.status(404).json({
        error: error.message,
      });
    }

    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});

// Route to logout (client-side token removal, but can be used for logging)
app.post("/logout", authMiddleware, (req, res) => {
  res.status(200).json({
    message: "Logout successful",
  });
});

// Route to get all users (admin functionality)
app.get("/users", authMiddleware, async (req, res) => {
  try {
    const users = await authServices.getAllUsers();

    res.status(200).json({
      message: "Users retrieved successfully",
      users,
    });
  } catch (error) {
    console.error("Get users error:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});

// http://localhost:3000/auth/users/create
// this.apiUrl
// this.apiUrl()/auth/users/create
app.post("/users/create", authMiddleware, async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({
        error: "Username and password are required",
      });
    }
    const result = await authServices.createUser(username, password);
    res.status(200).json({
      message: "User created successfully",
      ...result,
    });
  } catch (error) {
    console.error("Create user error:", error);
    res.status(error.status || 500).json({
      error: error.message || "Something went wrong while creating user",
      details: error.message,
    });
  }
});

export default app;
