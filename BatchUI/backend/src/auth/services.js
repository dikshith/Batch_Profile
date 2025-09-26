import User from "./model.js";
import { generateToken } from "../middlewares/auth.js";

// Service functions for authentication
export const authServices = {
  // Login user and return token
  async loginUser(username, password) {
    // Validate input
    if (!username || !password) {
      throw new Error("Username and password are required");
    }

    // Find user by username
    const user = await User.findOne({
      where: { username: username, isActive: true },
    });

    if (!user) {
      throw new Error("Invalid credentials");
    }

    // Check password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      throw new Error("Invalid credentials");
    }

    // Generate token
    const token = generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    };
  },

  // Update user credentials
  async updateCredentials(userId, newUsername, newPassword) {
    // Validate input
    if (!newUsername && !newPassword) {
      throw new Error(
        "At least one of newUsername or newPassword must be provided"
      );
    }

    // Get current user
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Check if new username already exists (if changing username)
    if (newUsername && newUsername !== user.username) {
      const existingUser = await User.findOne({
        where: { username: newUsername },
      });
      if (existingUser) {
        throw new Error("Username already exists");
      }
    }

    // Update user
    const updateData = {};
    if (newUsername) updateData.username = newUsername;
    if (newPassword) updateData.password = newPassword;

    await user.update(updateData);

    // Generate new token with updated user info
    const token = generateToken(user);

    return {
      token,
      user: {
        id: user.id,
        username: user.username,
      },
    };
  },

  // Get user info by ID
  async getUserById(userId) {
    const user = await User.findByPk(userId, {
      attributes: ["id", "username", "isActive"],
    });

    if (!user) {
      throw new Error("User not found");
    }

    return user;
  },

  // Check if user exists by ID
  async userExists(userId) {
    const user = await User.findByPk(userId);
    return !!user;
  },

  // Get user by username
  async getUserByUsername(username) {
    return await User.findOne({
      where: { username: username, isActive: true },
    });
  },

  // Create new user
  async createUser(username, password) {

    // Check if username already exists
    const existingUser = await User.findOne({
      where: { username: username },
    });
    if (existingUser) {
      throw new Error("Username already exists");
    }

    // Create user
    const user = await User.create({
      username,
      password,
      isActive: true,
    });

    return {
      id: user.id,
      username: user.username,
      isActive: user.isActive,
    };
  },

  // Deactivate user
  async deactivateUser(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await user.update({ isActive: false });
    return true;
  },

  // Activate user
  async activateUser(userId) {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error("User not found");
    }

    await user.update({ isActive: true });
    return true;
  },

  // Get all users (for admin purposes)
  async getAllUsers() {
    return await User.findAll({
      attributes: ["id", "username", "isActive", "createdAt", "updatedAt"],
      order: [["createdAt", "DESC"]],
    });
  },

  // Get user count
  async getUserCount() {
    return await User.count();
  },
};
