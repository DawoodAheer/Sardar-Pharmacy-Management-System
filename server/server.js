import mongoose from 'mongoose';
import jobRoutes from './routes/jobRoutes.js';
import { startJobQueue, stopJobQueue } from './utils/backgroundJobs.js';
import { monitorRequests } from './utils/systemMonitor.js';
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import cookieParser from "cookie-parser";

import connectDB from "./config/db.js";

import {
  notFound,
  errorHandler,
} from "./middleware/errorMiddleware.js";

import operationsRoutes from './routes/operationsRoutes.js';
import authRoutes from "./routes/authRoutes.js";
import userRoutes from "./routes/userRoutes.js";
import medicineRoutes from "./routes/medicineRoutes.js";
import billRoutes from "./routes/billRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js";
import customerRoutes from "./routes/customerRoutes.js";
import pharmacistRoutes from "./routes/pharmacistRoutes.js";
import udharRoutes from "./routes/udharRoutes.js";
import mobileScannerRoutes from "./routes/mobileScannerRoutes.js";
import deletionRequestRoutes from "./routes/deletionRequestRoutes.js";
import backupRoutes from "./routes/backupRoutes.js";
import purchaseOrderRoutes from "./routes/purchaseOrderRoutes.js";
import { initMobileScannerWebSocket } from "./controllers/mobileScannerController.js";

import {
  initializeNotificationScheduler,
} from "./utils/notificationScheduler.js";

import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Environment variables are loaded by env-loader.js (via --import flag)
// before any ES module imports are evaluated. No need to call dotenv here.

// Connect to Database
let databaseInitialized = false;
const databaseStartup = connectDB();
databaseStartup.then(async () => { await startJobQueue(); databaseInitialized = true; initializeNotificationScheduler(); });

const app = express();
app.use(monitorRequests);

// CORS configuration
const allowedOrigins = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:5174",
  "http://127.0.0.1:5174",
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://localhost:80",
  "http://127.0.0.1:80",
  "http://localhost",
  "http://127.0.0.1",
  "https://ai-based-medicine-quality.vercel.app",
  process.env.CLIENT_URL,
].filter(Boolean);

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const cleanOrigin = origin.replace(/\/$/, "");

  if (allowedOrigins.some((o) => o && o.replace(/\/$/, "") === cleanOrigin)) {
    return true;
  }

  const localhostPattern = /^http:\/\/(localhost|127\.0\.0\.1):517[0-9]$/;
  const localhostAltPattern = /^http:\/\/(localhost|127\.0\.0\.1):300[0-9]$/;
  // Allow phones on the same local network (192.168.x.x or 10.x.x.x)
  const lanPattern = /^http:\/\/(192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):\d+$/;

  return localhostPattern.test(cleanOrigin) || localhostAltPattern.test(cleanOrigin) || lanPattern.test(cleanOrigin);
};

app.use(
  cors({
    origin: (origin, callback) => {
      if (isAllowedOrigin(origin)) {
        return callback(null, true);
      }

      const msg = `The CORS policy for this site does not allow access from the specified Origin: ${origin}`;

      return callback(new Error(msg), false);
    },

    credentials: true,
  })
);

// Express middleware
app.use(express.json({ limit: '50mb' }));
app.use(
  express.urlencoded({ limit: '50mb', extended: true })
);

app.use(cookieParser());

// Static uploads folder
app.use(
  "/uploads",
  express.static(
    path.join(__dirname, "uploads")
  )
);

// Base Route
app.get("/", (req, res) => {
  res.send("Sardar Medical Store API is running...");
});

// Used by npm run dev to distinguish this workspace API from another local API.
app.get("/api/dev-identity", (_req, res) => {
  res.type("text/plain").send("sardar-pharmacy-dev-api-v2");
});

app.get('/api/health', (_req, res) => {
  const ready = databaseInitialized && mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ready, databaseConnected: mongoose.connection.readyState === 1 });
});

// Register API Routes
app.use("/api/auth", authRoutes);
app.use('/api/jobs', jobRoutes);
app.use("/api/operations", operationsRoutes);

app.use("/api/users", userRoutes);

app.use("/api/medicines", medicineRoutes);

app.use("/api/bills", billRoutes);

app.use(
  "/api/notifications",
  notificationRoutes
);

app.use("/api/customers", customerRoutes);

// Pharmacist registration routes
app.use(
  "/api/pharmacist",
  pharmacistRoutes
);

// Udhar (Credit/Khata) routes
app.use("/api/udhar", udharRoutes);

app.use("/api/mobile-scanner", mobileScannerRoutes);
app.use("/api/deletion-requests", deletionRequestRoutes);
app.use("/api/backups", backupRoutes);
app.use("/api/purchase-orders", purchaseOrderRoutes);

// Error Middleware
app.use(notFound);
app.use(errorHandler);

// Server
const PORT = process.env.PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(
    `Server running in ${
      process.env.NODE_ENV || "development"
    } mode on port ${PORT} (accessible on local network)`
  );
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(
      `Port ${PORT} is already in use. Stop the running server or set a different PORT in server/.env.`
    );
    process.exit(1);
  }

  throw error;
});

// Initialize WebSocket scanner on same HTTP server
initMobileScannerWebSocket(server);

let stopping = false;
const stopServer = () => {
  if (stopping) return;
  stopping = true;
  databaseInitialized = false;
  stopJobQueue();
  const timeout = setTimeout(() => process.exit(1), 25000); timeout.unref();
  server.close(async () => { await mongoose.disconnect(); clearTimeout(timeout); process.exit(0); });
};
process.once('SIGTERM', stopServer);
process.once('SIGINT', stopServer);
