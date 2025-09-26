const Service = require("node-windows").Service;
const path = require("path");
const svc = new Service({
  name: "Angular Service",
  description: "Angular Service",
  script: path.join(__dirname, "server.js"),
  wait: 10,
  maxRetries: 10,
  stopTimeout: 10000,
  stopMethod: "stop",
  stopTimeout: 10000,
});

// Listen for the 'install' event to indicate that the service was installed
svc.on("install", () => {
  console.log("Service installed.");
  svc.start(); // Start the service after it's installed
});

// Install the service if needed
if (process.argv[2] === "install") {
  // Only install the service if it's not installed yet
  if (!svc.exists) {
    console.log("Installing service...");
    svc.install();
  } else {
    console.log("Service already installed.");
  }
} else if (process.argv[2] === "uninstall") {
  // Uninstall the service if requested
  if (svc.exists) {
    console.log("Uninstalling service...");
    svc.uninstall();
  } else {
    console.log("Service not found.");
  }
} else {
  console.log("Invalid argument. Use 'install' or 'uninstall'.");
}

