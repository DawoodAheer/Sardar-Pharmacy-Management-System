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
  role
) => {
  return jwt.sign(
    {
      id: userId.toString(),
      role,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn: "15m",
    }
  );
};

/*
|--------------------------------------------------------------------------
| Generate Refresh Token
|--------------------------------------------------------------------------
| Long-lived token used to obtain a new access token.
|--------------------------------------------------------------------------
*/
export const generateRefreshToken = (
  userId
) => {
  return jwt.sign(
    {
      id: userId.toString(),
    },
    process.env.JWT_REFRESH_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

/*
|--------------------------------------------------------------------------
| Send Refresh Token Cookie
|--------------------------------------------------------------------------
| Refresh token is stored in an httpOnly cookie so JavaScript
| running in the browser cannot directly read it.
|--------------------------------------------------------------------------
*/
export const sendRefreshTokenCookie = (
  res,
  refreshToken
) => {
  res.cookie("refreshToken", refreshToken, {
    httpOnly: true,

    secure:
      process.env.NODE_ENV === "production",

    sameSite: "lax",

    path: "/",

    maxAge:
      7 * 24 * 60 * 60 * 1000,
  });
};