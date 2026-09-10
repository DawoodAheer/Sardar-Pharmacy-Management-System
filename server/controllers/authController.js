import User from "../models/User.js";
import jwt from "jsonwebtoken";
import crypto from "crypto";

import {
  generateAccessToken,
  generateRefreshToken,
  sendRefreshTokenCookie,
} from "../utils/generateToken.js";

import { sendPasswordResetEmail } from "../utils/emailService.js";

/*
|--------------------------------------------------------------------------
| Normalize Email
|--------------------------------------------------------------------------
*/

const normalizeEmail = (email) => {
  return String(email || "").trim().toLowerCase();
};

/*
|--------------------------------------------------------------------------
| Safe User Response
|--------------------------------------------------------------------------
*/

const buildUserResponse = (user, accessToken = null) => {
  const response = {
    _id: user._id,
    name: user.name,
    email: user.email,
    phone: user.phone || "",
    role: user.role,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt,
  };

  if (accessToken) {
    response.accessToken = accessToken;
  }

  return response;
};

/*
|--------------------------------------------------------------------------
| Register Customer
|--------------------------------------------------------------------------
| POST /api/auth/register
| Public
|--------------------------------------------------------------------------
*/

export const registerUser = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const userExists = await User.findOne({
      email: normalizedEmail,
    });

    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // Public registration can ONLY create customers
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone: phone?.trim() || "",
      role: "customer",
      accountStatus: "pending",
    });

    return res.status(201).json({
      success: true,
      message: "Account created successfully. Please wait for pharmacist approval before logging in.",
      request: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.accountStatus,
      },
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Register Pharmacist
|--------------------------------------------------------------------------
| POST /api/auth/register-pharmacist
| Public
|--------------------------------------------------------------------------
|
| Pharmacist can submit a request,
| but accountStatus will be pending.
| They cannot login until Superadmin approves them.
|--------------------------------------------------------------------------
*/

export const registerPharmacist = async (req, res, next) => {
  try {
    const { name, email, password, phone } = req.body;

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    // Check existing account
    const userExists = await User.findOne({
      email: normalizedEmail,
    });

    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // Create pharmacist with pending status
    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password,
      phone: phone?.trim() || "",
      role: "pharmacist",
      accountStatus: "pending",
    });

    // Do NOT generate token here
    // because pharmacist is not approved yet.

    return res.status(201).json({
      success: true,
      message:
        "Pharmacist registration request submitted. Please wait for Superadmin approval.",
      request: {
        _id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        accountStatus: user.accountStatus,
        createdAt: user.createdAt,
      },
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Login User
|--------------------------------------------------------------------------
| POST /api/auth/login
| Public
|--------------------------------------------------------------------------
*/

export const loginUser = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const normalizedEmail = normalizeEmail(email);

    const user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const passwordMatched =
      await user.matchPassword(password);

    if (!passwordMatched) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    if (
      user.role !== "superadmin" &&
      user.accountStatus === "pending"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your account is waiting for Superadmin approval",
      });
    }

    if (
      user.accountStatus === "rejected"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your account registration request was rejected",
      });
    }

    /*
     * Generate fresh tokens
     */
    const accessToken = generateAccessToken(
      user._id,
      user.role
    );

    const refreshToken = generateRefreshToken(
      user._id
    );

    sendRefreshTokenCookie(res, refreshToken);

    return res.status(200).json({
      success: true,
      message: `Welcome back, ${user.name}`,
      user: buildUserResponse(
        user,
        accessToken
      ),
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Logout User
|--------------------------------------------------------------------------
| POST /api/auth/logout
|--------------------------------------------------------------------------
*/

export const logoutUser = async (req, res, next) => {
  try {
    res.cookie("refreshToken", "", {
      httpOnly: true,
      expires: new Date(0),
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production",
      path: "/",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Refresh Access Token
|--------------------------------------------------------------------------
| POST /api/auth/refresh
|--------------------------------------------------------------------------
*/

export const refreshAccessToken = async (
  req,
  res,
  next
) => {
  try {
    const refreshToken =
      req.cookies?.refreshToken;

    if (!refreshToken) {
      return res.status(401).json({
        success: false,
        message:
          "Session expired. Please log in again",
      });
    }

    const decoded = jwt.verify(
      refreshToken,
      process.env.JWT_REFRESH_SECRET
    );

    if (!decoded?.id) {
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token",
      });
    }

    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "User account no longer exists",
      });
    }

    // Do not refresh token for rejected/pending non-admin accounts
    if (
      user.role !== "superadmin" &&
      user.accountStatus !== "approved"
    ) {
      return res.status(403).json({
        success: false,
        message:
          "Your account is not approved",
      });
    }

    const newAccessToken =
      generateAccessToken(
        user._id,
        user.role
      );

    const newRefreshToken =
      generateRefreshToken(user._id);

    sendRefreshTokenCookie(
      res,
      newRefreshToken
    );

    return res.status(200).json({
      success: true,
      message: "Access token refreshed",
      accessToken: newAccessToken,
    });
  } catch (error) {
    if (error.name !== "TokenExpiredError") {
      console.error(
        "Refresh token error:",
        error.message
      );
    }

    res.cookie("refreshToken", "", {
      httpOnly: true,
      expires: new Date(0),
      sameSite: "lax",
      secure:
        process.env.NODE_ENV === "production",
      path: "/",
    });

    return res.status(401).json({
      success: false,
      message:
        "Session expired. Please log in again",
    });
  }
};

/*
|--------------------------------------------------------------------------
| Get Current User
|--------------------------------------------------------------------------
| GET /api/auth/me
|--------------------------------------------------------------------------
*/

export const getMe = async (req, res, next) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await User.findById(
      req.user._id
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    return res.status(200).json({
      success: true,
      user: buildUserResponse(user),
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Update User Profile
|--------------------------------------------------------------------------
| PUT /api/auth/profile
|--------------------------------------------------------------------------
*/

export const updateUserProfile = async (
  req,
  res,
  next
) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        success: false,
        message: "Not authenticated",
      });
    }

    const user = await User.findById(
      req.user._id
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User account not found",
      });
    }

    const {
      name,
      phone,
      currentPassword,
      password,
    } = req.body;

    if (
      typeof name === "string" &&
      name.trim()
    ) {
      user.name = name.trim();
    }

    if (typeof phone === "string") {
      user.phone = phone.trim();
    }

    if (password) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message:
            "Current password is required to change your password",
        });
      }

      const passwordMatched =
        await user.matchPassword(
          currentPassword
        );

      if (!passwordMatched) {
        return res.status(400).json({
          success: false,
          message:
            "Current password is incorrect",
        });
      }

      if (password.length < 6) {
        return res.status(400).json({
          success: false,
          message:
            "New password must be at least 6 characters",
        });
      }

      user.password = password;
    }

    const updatedUser = await user.save();

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
      user: buildUserResponse(updatedUser),
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Forgot Password
|--------------------------------------------------------------------------
| POST /api/auth/forgot-password
| Public
|--------------------------------------------------------------------------
*/

export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        message: "Please enter your email address",
      });
    }

    const normalizedEmail = normalizeEmail(email);
    const user = await User.findOne({ email: normalizedEmail });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "No account found with this email address",
      });
    }

    // Generate token and 6-digit OTP
    const { resetToken, resetOtp } = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });

    // Client URL (supports offline localhost)
    const clientUrl = process.env.CLIENT_URL || "http://localhost:5173";
    const resetUrl = `${clientUrl.replace(/\/$/, "")}/reset-password/${resetToken}`;

    // Attempt to dispatch email (works if SMTP configured)
    const emailSent = await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl,
      resetOtp,
    });

    console.log(`[PASSWORD RESET] Generated reset request for: ${user.email}`);
    console.log(`[PASSWORD RESET] 6-Digit OTP: ${resetOtp}`);
    console.log(`[PASSWORD RESET] Reset URL: ${resetUrl}`);

    return res.status(200).json({
      success: true,
      message: emailSent
        ? "Password reset instructions have been sent to your email."
        : "Reset code generated! Since offline mode is active, your recovery code is provided below.",
      emailSent,
      // Provide recovery info in response for offline/local usage without SMTP server
      offlineInfo: !emailSent
        ? {
            code: resetOtp,
            token: resetToken,
            email: user.email,
            resetUrl: `/reset-password/${resetToken}`,
          }
        : null,
    });
  } catch (error) {
    next(error);
  }
};

/*
|--------------------------------------------------------------------------
| Reset Password
|--------------------------------------------------------------------------
| POST /api/auth/reset-password/:token
| POST /api/auth/reset-password
| Public
|--------------------------------------------------------------------------
*/

export const resetPassword = async (req, res, next) => {
  try {
    const token = req.params.token || req.body.token;
    const { otp, email, password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "Please provide a new password",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long",
      });
    }

    let user = null;

    // 1. Direct token from URL link
    if (token) {
      const hashedToken = crypto
        .createHash("sha256")
        .update(token)
        .digest("hex");

      user = await User.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { $gt: Date.now() },
      });
    }

    // 2. 6-digit OTP code with user's email
    if (!user && otp && email) {
      const normalizedEmail = normalizeEmail(email);
      user = await User.findOne({
        email: normalizedEmail,
        resetPasswordOtp: String(otp).trim(),
        resetPasswordExpire: { $gt: Date.now() },
      });
    }

    if (!user) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid or expired reset code or link. Please request a new one.",
      });
    }

    // Set new password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    user.resetPasswordOtp = undefined;

    await user.save();

    return res.status(200).json({
      success: true,
      message:
        "Password has been reset successfully! You can now log in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};