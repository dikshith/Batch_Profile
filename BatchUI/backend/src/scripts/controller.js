import { Router } from "express";
import runController from "./run/controller.js";
import managementController from "./management/controller.js";
import executionController from "./execution/controller.js";

const app = Router();

app.use("", managementController);
app.use("", executionController);
app.use("/runs", runController);

export default app;
