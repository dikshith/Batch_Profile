// src/index.ts
import express from "express";
import "express-async-errors";
import bodyParser from "body-parser";
import cors from "cors";
import { createServer } from "http";
import { Server } from "socket.io";

import { errorHandlerMiddleware } from "./middlewares/errorHandler.js";
import { authMiddleware } from "./middlewares/auth.js";

import { SERVERCONFIG } from "./config/server.js";

import scriptsController from "./scripts/controller.js";
import authController from "./auth/controller.js";
import { connectDB } from "./config/db/db.js";
import { ScriptSocket } from "./sockets/ScriptSocket.js";

import { syncScriptsToDB } from "./utils/sync_db.js";
import { initializeAdmin } from "./utils/initAdmin.js";

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
});

// Initialize script socket handler
const scriptSocket = new ScriptSocket(io);
scriptSocket.init();

// Export socket instance for use in other modules
export { scriptSocket };

app.use(
  cors({
    origin: "*",
    credentials: true,
    optionsSuccessStatus: 200,
    methods: "GET,POST,PUT,PATCH,DELETE,OPTIONS",
  })
);
app.use(express.json());

app.use(bodyParser.urlencoded({ extended: false }));

const router = express.Router();

// Public routes (no authentication required)
router.use("/auth", authController);

// Protected routes (authentication required)
router.use("/scripts", authMiddleware, scriptsController);

// make all endpoints start with the prefix api/v1
app.use("/", router);

app.use(errorHandlerMiddleware);

httpServer.listen(SERVERCONFIG.PORT, async () => {
  console.log(`Server is running on http://localhost:${SERVERCONFIG.PORT} `);

  try {
    await connectDB();
    console.log("Database connected successfully");

    // Initialize admin user
    await initializeAdmin();

    await syncScriptsToDB();
  } catch (err) {
    console.error("Database connection error:", err);
  }
});
