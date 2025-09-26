import { Service } from "node-windows";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// var Service = require("node-windows").Service;
var svc = new Service({
  name: "Scripts Manager Backend",
  description: "Node.js server responsible for managing / running scripts.",

  // --------------------------------------------------------------------------------
  // change this to the path of the index.js file inside the src folder
  script: path.join(__dirname, "src", "index.js"),
  // --------------------------------------------------------------------------------

  wait: 10,
  maxRetries: 10,
  stopTimeout: 10000,
  stopMethod: "stop",
  stopTimeout: 10000,
});

svc.on("install", function () {
  svc.start();
});

svc.install();
