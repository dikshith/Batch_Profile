const express = require("express");
const path = require("path");

const app = express();

// you change the port here
// const PORT = 4200;
const PORT = 5200;

// Serve static files from the Angular app
// Serve static files from the Angular app
app.use(
  express.static(path.join(__dirname, "../", "dist/scripts-dashboard/browser"))
);

// Always return the index.html for any route that Angular should handle
app.all("/{*any}", (req, res) => {
  res.sendFile(
    path.join(__dirname, "../", "dist/scripts-dashboard/browser/index.html")
  );
});

app.listen(PORT, () => {
  console.log(`App is running at http://localhost:${PORT}`);
});
