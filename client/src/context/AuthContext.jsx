import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import api from "../utils/api";

const AuthContext = createContext(null);

/*
|--------------------------------------------------------------------------
| AuthProvider
|--------------------------------------------------------------------------
|
| Authentication flow:
|
| Login/Register
|      ↓
| Access Token → React memory
| Refresh Token → httpOnly cookie
|
| When access token expires:
|      ↓
| API returns 401
|      ↓
| Refresh token request
|      ↓
| New access token
|      ↓
| Original request is retried
|
|--------------------------------------------------------------------------
*/

export const AuthProvider = ({ children }) => {
  /*
  |--------------------------------------------------------------------------
  | State
  |--------------------------------------------------------------------------
  */

  const [user, setUser] = useState(null);

  /*
   * Short-lived access token.
   * Kept in memory instead of localStorage.
   */
  const [accessToken, setAccessToken] =
    useState(null);

  /*
   * Prevent protected routes from rendering before
   * initial authentication check finishes.
   */
  const [loading, setLoading] =
    useState(true);

  /*
  |--------------------------------------------------------------------------
  | Refs
  |--------------------------------------------------------------------------
  */

  /*
   * Axios interceptors need the latest token.
   * A ref gives them access without recreating
   * the interceptors on every token change.
   */
  const tokenRef = useRef(null);

  /*
   * Prevent multiple simultaneous refresh requests.
   *
   * Example:
   * 5 API requests → 401
   *
   * Instead of:
   * 5 refresh requests
   *
   * We do:
   * 1 refresh request
   * 4 requests wait for the same Promise.
   */
  const refreshPromiseRef =
    useRef(null);

  /*
   * Used to avoid updating state after the
   * AuthProvider has unmounted.
   */
  const mountedRef =
    useRef(false);

  /*
  |--------------------------------------------------------------------------
  | Keep tokenRef synchronized
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    tokenRef.current = accessToken;
  }, [accessToken]);

  /*
  |--------------------------------------------------------------------------
  | Mounted state
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
    };
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Clear Local Authentication
  |--------------------------------------------------------------------------
  |
  | This clears frontend state only.
  |
  | Backend refresh-cookie clearing is handled
  | separately by logout().
  |
  |--------------------------------------------------------------------------
  */
  const clearLocalAuth = useCallback(() => {
    /*
     * Clear token reference immediately.
     */
    tokenRef.current = null;

    /*
     * Clear React authentication state.
     */
    if (mountedRef.current) {
      setUser(null);
      setAccessToken(null);
    }

    /*
     * Remove any Authorization header that may
     * have been manually stored in Axios defaults.
     */
    delete api.defaults.headers.common.Authorization;
  }, []);

  /*
  |--------------------------------------------------------------------------
  | Refresh Access Token
  |--------------------------------------------------------------------------
  */
  const refreshAccessToken =
    useCallback(async () => {
      /*
       * If another refresh request is already running,
       * reuse that request.
       */
      if (refreshPromiseRef.current) {
        return refreshPromiseRef.current;
      }

      refreshPromiseRef.current =
        (async () => {
          try {
            /*
             * The browser automatically sends the
             * httpOnly refreshToken cookie because
             * api.js contains withCredentials: true.
             */
            const response =
              await api.post(
                "/auth/refresh"
              );

            const newAccessToken =
              response.data?.accessToken;

            if (!newAccessToken) {
              throw new Error(
                "No access token received from server"
              );
            }

            /*
             * Update ref immediately.
             */
            tokenRef.current =
              newAccessToken;

            /*
             * Update React state.
             */
            if (mountedRef.current) {
              setAccessToken(
                newAccessToken
              );
            }

            return newAccessToken;
          } catch (error) {
            /*
             * Refresh failed.
             * Current authentication session
             * is no longer valid.
             */
            clearLocalAuth();

            throw error;
          } finally {
            /*
             * Allow future refresh requests.
             */
            refreshPromiseRef.current =
              null;
          }
        })();

      return refreshPromiseRef.current;
    }, [clearLocalAuth]);

  /*
  |--------------------------------------------------------------------------
  | Axios Request / Response Interceptors
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    /*
    |--------------------------------------------------------------------------
    | REQUEST INTERCEPTOR
    |--------------------------------------------------------------------------
    |
    | Automatically attach:
    |
    | Authorization: Bearer <accessToken>
    |
    |--------------------------------------------------------------------------
    */
    const requestInterceptor =
      api.interceptors.request.use(
        (config) => {
          const token =
            tokenRef.current;

          if (token) {
            config.headers =
              config.headers || {};

            config.headers.Authorization =
              `Bearer ${token}`;
          }

          return config;
        },
        (error) => {
          return Promise.reject(error);
        }
      );

    /*
    |--------------------------------------------------------------------------
    | RESPONSE INTERCEPTOR
    |--------------------------------------------------------------------------
    |
    | Access token expired:
    |
    | Request
    |    ↓
    |   401
    |    ↓
    | Refresh token
    |    ↓
    | New access token
    |    ↓
    | Retry original request
    |
    |--------------------------------------------------------------------------
    */
    const responseInterceptor =
      api.interceptors.response.use(
        (response) => {
          return response;
        },

        async (error) => {
          const originalRequest =
            error.config;

          /*
           * No original request available.
           */
          if (!originalRequest) {
            return Promise.reject(error);
          }

          const requestUrl =
            originalRequest.url || "";

          /*
           * Authentication endpoints must never
           * trigger automatic refresh.
           *
           * Otherwise an expired refresh token could
           * create an infinite loop.
           */
          const isAuthRequest =
            requestUrl.includes(
              "/auth/login"
            ) ||
            requestUrl.includes(
              "/auth/register"
            ) ||
            requestUrl.includes(
              "/auth/refresh"
            ) ||
            requestUrl.includes(
              "/auth/logout"
            );

          const isUnauthorized =
            error.response?.status === 401;

          /*
           * Refresh only once for each original request.
           */
          const shouldRefresh =
            isUnauthorized &&
            !originalRequest._retry &&
            !isAuthRequest;

          if (!shouldRefresh) {
            return Promise.reject(error);
          }

          /*
           * Prevent infinite retry loops.
           */
          originalRequest._retry = true;

          try {
            /*
             * Either:
             * - start a refresh request
             * OR
             * - wait for an already-running refresh request.
             */
            const newAccessToken =
              await refreshAccessToken();

            /*
             * Retry the original request using
             * the new access token.
             */
            originalRequest.headers =
              originalRequest.headers ||
              {};

            originalRequest.headers.Authorization =
              `Bearer ${newAccessToken}`;

            return api(
              originalRequest
            );
          } catch (refreshError) {
            return Promise.reject(
              refreshError
            );
          }
        }
      );

    /*
    |--------------------------------------------------------------------------
    | Cleanup
    |--------------------------------------------------------------------------
    */
    return () => {
      api.interceptors.request.eject(
        requestInterceptor
      );

      api.interceptors.response.eject(
        responseInterceptor
      );
    };
  }, [refreshAccessToken]);

  /*
  |--------------------------------------------------------------------------
  | Restore Authentication Session
  |--------------------------------------------------------------------------
  |
  | When the browser reloads:
  |
  | Browser
  |    ↓
  | httpOnly refresh cookie
  |    ↓
  | POST /auth/refresh
  |    ↓
  | New access token
  |    ↓
  | GET /auth/me
  |    ↓
  | Current user restored
  |
  |--------------------------------------------------------------------------
  */
  useEffect(() => {
    let cancelled = false;

    const initializeAuth =
      async () => {
        try {
          /*
           * Request a new access token using
           * the refresh-token cookie.
           */
          const response =
            await api.post(
              "/auth/refresh"
            );

          if (cancelled) {
            return;
          }

          const newAccessToken =
            response.data?.accessToken;

          if (!newAccessToken) {
            throw new Error(
              "No access token received during session restore"
            );
          }

          /*
           * Store token.
           */
          tokenRef.current =
            newAccessToken;

          setAccessToken(
            newAccessToken
          );

          /*
           * Get current authenticated user.
           *
           * The request interceptor will now
           * automatically attach the token.
           */
          const userResponse =
            await api.get(
              "/auth/me"
            );

          if (cancelled) {
            return;
          }

          /*
           * authController returns:
           *
           * {
           *   success: true,
           *   user: {...}
           * }
           */
          const currentUser =
            userResponse.data?.user;

          if (!currentUser) {
            throw new Error(
              "Current user data not found"
            );
          }

          setUser(currentUser);
        } catch {
          /*
           * No active session is completely normal
           * when the visitor has not logged in.
           *
           * We intentionally do not show a popup here.
           */
          clearLocalAuth();

          console.log(
            "No active authentication session."
          );
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };

    initializeAuth();

    return () => {
      cancelled = true;
    };
  }, [clearLocalAuth]);

  /*
  |--------------------------------------------------------------------------
  | LOGIN
  |--------------------------------------------------------------------------
  |
  | Backend response:
  |
  | {
  |   success: true,
  |   message: "...",
  |   user: {
  |     _id,
  |     name,
  |     email,
  |     phone,
  |     role,
  |     createdAt,
  |     accessToken
  |   }
  | }
  |
  |--------------------------------------------------------------------------
  */
  const login = async (
    email,
    password
  ) => {
    setLoading(true);

    try {
      const cleanEmail =
        String(email || "")
          .trim()
          .toLowerCase();

      if (
        !cleanEmail ||
        !password
      ) {
        throw new Error(
          "Email and password are required"
        );
      }

      const response =
        await api.post(
          "/auth/login",
          {
            email: cleanEmail,
            password,
          }
        );

      const loggedInUser =
        response.data?.user;

      const newAccessToken =
        loggedInUser?.accessToken;

      if (
        !loggedInUser ||
        !newAccessToken
      ) {
        throw new Error(
          "Invalid login response from server"
        );
      }

      /*
       * Save fresh access token.
       */
      tokenRef.current =
        newAccessToken;

      setAccessToken(
        newAccessToken
      );

      /*
       * Store user information separately.
       * Access token is intentionally not stored
       * inside the user state.
       */
      const safeUser = {
        _id: loggedInUser._id,
        name: loggedInUser.name,
        email: loggedInUser.email,
        phone:
          loggedInUser.phone || "",
        role: loggedInUser.role,
        createdAt:
          loggedInUser.createdAt,
      };

      setUser(safeUser);

      return {
        user: safeUser,
        message:
          response.data?.message ||
          "Login successful",
      };
    } catch (error) {
      const message =
        error.response?.data
          ?.message ||
        error.message ||
        "Login failed";

      /*
       * Preserve original error as the cause.
       *
       * This satisfies ESLint's
       * preserve-caught-error rule.
       */
      throw new Error(message, {
        cause: error,
      });
    } finally {
      setLoading(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | REGISTER
  |--------------------------------------------------------------------------
  |
  | Public registration always creates a CUSTOMER.
  |
  | Role is controlled by backend.
  |
  |--------------------------------------------------------------------------
  */
  const register = async (
    name,
    email,
    password,
    phone = ""
  ) => {
    setLoading(true);

    try {
      const cleanName =
        String(name || "").trim();

      const cleanEmail =
        String(email || "")
          .trim()
          .toLowerCase();

      const cleanPhone =
        String(phone || "").trim();

      if (
        !cleanName ||
        !cleanEmail ||
        !password
      ) {
        throw new Error(
          "Name, email and password are required"
        );
      }

      const response =
        await api.post(
          "/auth/register",
          {
            name: cleanName,
            email: cleanEmail,
            password,
            phone: cleanPhone,
          }
        );

      const registeredUser =
        response.data?.user;

      const newAccessToken =
        registeredUser?.accessToken;

      if (
        !registeredUser ||
        !newAccessToken
      ) {
        throw new Error(
          "Invalid registration response from server"
        );
      }

      /*
       * Save access token.
       */
      tokenRef.current =
        newAccessToken;

      setAccessToken(
        newAccessToken
      );

      /*
       * Store safe user information.
       */
      const safeUser = {
        _id:
          registeredUser._id,
        name:
          registeredUser.name,
        email:
          registeredUser.email,
        phone:
          registeredUser.phone || "",
        role:
          registeredUser.role,
        createdAt:
          registeredUser.createdAt,
      };

      setUser(safeUser);

      return {
        user: safeUser,
        message:
          response.data?.message ||
          "Account created successfully",
      };
    } catch (error) {
      const message =
        error.response?.data
          ?.message ||
        error.message ||
        "Registration failed";

      /*
       * Preserve original error.
       */
      throw new Error(message, {
        cause: error,
      });
    } finally {
      setLoading(false);
    }
  };

  /*
  |--------------------------------------------------------------------------
  | UPDATE PROFILE
  |--------------------------------------------------------------------------
  |
  | Usage:
  |
  | updateProfile({
  |   name,
  |   phone,
  |   currentPassword,
  |   password
  | })
  |
  |--------------------------------------------------------------------------
  */
  const updateProfile =
    async ({
      name = "",
      phone = "",
      currentPassword = "",
      password = "",
    }) => {
      try {
        const response =
          await api.put(
            "/auth/profile",
            {
              name:
                String(name).trim(),

              phone:
                String(phone).trim(),

              currentPassword,

              password,
            }
          );

        const updatedUser =
          response.data?.user;

        if (!updatedUser) {
          throw new Error(
            "Invalid profile response from server"
          );
        }

        /*
         * Preserve authentication token.
         *
         * Updating profile does not log
         * the user out.
         */
        setUser(
          (previousUser) => ({
            ...previousUser,

            _id:
              updatedUser._id,

            name:
              updatedUser.name,

            email:
              updatedUser.email,

            phone:
              updatedUser.phone || "",

            role:
              updatedUser.role,

            createdAt:
              updatedUser.createdAt,
          })
        );

        return {
          user: updatedUser,
          message:
            response.data?.message ||
            "Profile updated successfully",
        };
      } catch (error) {
        const message =
          error.response?.data
            ?.message ||
          error.message ||
          "Profile update failed";

        /*
         * Preserve original error.
         */
        throw new Error(message, {
          cause: error,
        });
      }
    };

  /*
  |--------------------------------------------------------------------------
  | LOGOUT
  |--------------------------------------------------------------------------
  |
  | Backend:
  | Clear refresh-token cookie
  |
  | Frontend:
  | Clear user
  | Clear access token
  | Clear token reference
  |
  |--------------------------------------------------------------------------
  */
  const logout = async () => {
    try {
      /*
       * Ask backend to clear refreshToken cookie.
       */
      await api.post(
        "/auth/logout"
      );
    } catch (error) {
      /*
       * Backend may temporarily be unavailable.
       * Frontend should still log the user out.
       */
      console.error(
        "Logout request failed:",
        error.message
      );
    } finally {
      /*
       * Always clear local authentication.
       */
      clearLocalAuth();

      /*
       * Clear pending refresh operation.
       */
      refreshPromiseRef.current =
        null;
    }
  };

  /*
  |--------------------------------------------------------------------------
  | Context Value
  |--------------------------------------------------------------------------
  */
  const contextValue = {
    user,

    setUser,

    accessToken,

    loading,

    login,

    register,

    logout,

    updateProfile,

    refreshAccessToken,

    isAuthenticated:
      Boolean(
        user && accessToken
      ),
  };

  return (
    <AuthContext.Provider
      value={contextValue}
    >
      {children}
    </AuthContext.Provider>
  );
};

/*
|--------------------------------------------------------------------------
| useAuth Hook
|--------------------------------------------------------------------------
|
| The ESLint React Fast Refresh rule normally prefers a file
| to export only React components.
|
| This hook intentionally lives here for the existing project
| structure, so the warning is disabled only for this export.
|--------------------------------------------------------------------------
*/

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const context =
    useContext(
      AuthContext
    );

  if (!context) {
    throw new Error(
      "useAuth must be used within an AuthProvider"
    );
  }

  return context;
};