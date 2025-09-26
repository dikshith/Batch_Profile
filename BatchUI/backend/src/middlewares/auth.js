import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "secret-key-scripts-app-dashboard";

export const authMiddleware = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.header("Authorization");

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Access denied. No token provided.",
      });
    }

    // Extract token
    const token = authHeader.substring(7); // Remove "Bearer " prefix

    if (!token) {
      return res.status(401).json({
        error: "Access denied. No token provided.",
      });
    }

    try {
      // Verify token
      const decoded = jwt.verify(token, JWT_SECRET);
      req.user = decoded;
      next();
    } catch (error) {
      return res.status(401).json({
        error: "Invalid token.",
      });
    }
  } catch (error) {
    console.error("Auth middleware error:", error);
    return res.status(500).json({
      error: "Internal server error during authentication.",
    });
  }
};

// Generate JWT token (never expires)
export const generateToken = (user) => {
  return jwt.sign(
    {
      id: user.id,
      username: user.username,
    },
    JWT_SECRET
    // No expiresIn option = token never expires
  );
};

export { JWT_SECRET };
