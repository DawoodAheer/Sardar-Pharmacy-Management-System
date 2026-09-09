import express from "express";

import {
  registerPharmacist,
} from "../controllers/authController.js";

const router = express.Router();

router.post(
  "/register",
  registerPharmacist
);

export default router;