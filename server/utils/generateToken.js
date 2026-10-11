import jwt from "jsonwebtoken";

/*
|--------------------------------------------------------------------------
| Generate Access Token
|--------------------------------------------------------------------------
| Short-lived token used for authenticated API requests.
|--------------------------------------------------------------------------
*/
export const generateAccessToken = (
  userId,
  role,
  tokenVersion = 0
) => {
  return jwt.sign(
    {
      id: userId.toString(),
      role,
      tokenVersion,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: "3650d", // 10 years for offline pharmacy uninterrupted use
    }
  );
};

/*
|--------------------------------------------------------------------------
| Generate Refresh Token
|--------------------------------------------------------------------------
| Long-lived token used to obtain a new access token (10 years offline).
|--------------------------------------------------------------------------
*/
export const generateRefreshToken = (
  userId,
  tokenVersion = 0
) => {
  return jwt.sign(
    {
      id: userId.toString(),
      tokenVersion,
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: "3650d", // 10 years for offline pharmacy uninterrupted use
    }
  );
};

/*
|--------------------------------------------------------------------------
| Send Refresh Token Cookie
|--------------------------------------------------------------------------
| Refresh token is stored in an httpOnly cookie so JavaScript
| running in the browser cannot directly read it.
| In offline local environment (HTTP), secure is false unless COOKIE_SECURE is true.
|--------------------------------------------------------------------------
*/
export const sendRefreshTokenCookie = (
  res,
  refreshToken
) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,

    // Set false for offline local network HTTP so browsers don't discard the cookie
    secure: process.env.COOKIE_SECURE === "true",

    sameSite: "lax",

    path: "/",

    maxAge:
      10 * 365 * 24 * 60 * 60 * 1000, // 10 years
  });
};
