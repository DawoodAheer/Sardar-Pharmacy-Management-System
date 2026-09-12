import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
import User from "./User.js";

dotenv.config();

const createSuperAdmin = async () => {
  try {
    // MongoDB connection
    await mongoose.connect(
      process.env.MONGO_URI || "mongodb://localhost:27017/pharmadesk"
    );

    console.log("MongoDB Connected");

    const adminEmail = "aheerdawood014@gmail.com";
    const adminPassword = "Dawood@@5786";
    const adminName = "Dawood PharmaDesk Super Admin";

    // Check if admin already exists
    const existingAdmin = await User.findOne({
      email: adminEmail.toLowerCase(),
    });

    if (existingAdmin) {
      console.log("Superadmin already exists");
      console.log("Email:", existingAdmin.email);
      console.log("Role:", existingAdmin.role);

      await mongoose.connection.close();
      return;
    }

    // Create superadmin
    const admin = await User.create({
      name: adminName,
      email: adminEmail.toLowerCase(),
      password: adminPassword,
      phone: "",
      role: "superadmin",
      accountStatus: "approved",
    });

    console.log("Superadmin created successfully");
    console.log("--------------------------------");
    console.log("Name:", admin.name);
    console.log("Email:", admin.email);
    console.log("Password:", adminPassword);
    console.log("Role:", admin.role);
    console.log("Status:", admin.accountStatus);
    console.log("--------------------------------");

    await mongoose.connection.close();
  } catch (error) {
    console.error("Error creating superadmin:", error.message);

    await mongoose.connection.close();
    process.exit(1);
  }
};

createSuperAdmin();