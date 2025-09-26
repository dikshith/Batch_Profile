import User from "../auth/model.js";
import sequelize from "../config/db/db.js";

export async function initializeAdmin() {
  try {
    console.log("Initializing admin user...");

    // Check if any user exists in the database
    const userCount = await User.count();

    if (userCount > 0) {
      console.log(
        "Users already exist in the database. Skipping admin initialization."
      );
      return;
    }

    // Create admin user only if no users exist
    const adminUser = await User.create({
      username: "admin",
      password: "admin",
      isActive: true,
    });

    console.log("✅ Admin user created successfully");
    console.log(`Username: ${adminUser.username}`);
    console.log("Password: admin");
    console.log("⚠️  Please change the password after first login!");
  } catch (error) {
    console.error("Error initializing admin user:", error);
    throw error;
  }
}

// Run initialization if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  initializeAdmin()
    .then(() => {
      console.log("Admin initialization completed");
      process.exit(0);
    })
    .catch((error) => {
      console.error("Admin initialization failed:", error);
      process.exit(1);
    });
}
