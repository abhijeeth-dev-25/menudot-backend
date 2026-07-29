const AuthService = require('../../services/restaurant/auth.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class AuthController {
  /**
   * Register a new user account.
   */
  register = asyncHandler(async (req, res) => {
    const result = await AuthService.register(req.body);
    return sendSuccess(res, 201, 'User account registered successfully', result);
  });

  /**
   * User login.
   */
  login = asyncHandler(async (req, res) => {
    const { identifier, email, password } = req.body;
    const loginIdentifier = identifier || email;
    const result = await AuthService.login(loginIdentifier, password);
    return sendSuccess(res, 200, 'User logged in successfully', result);
  });

  /**
   * Platform admin user login.
   */
  platformLogin = asyncHandler(async (req, res) => {
    const { identifier, email, password } = req.body;
    const loginIdentifier = identifier || email;
    const result = await AuthService.platformLogin(loginIdentifier, password);
    return sendSuccess(res, 200, 'Platform administrator logged in successfully', result);
  });

  /**
   * Shared screen device login.
   */
  loginScreen = asyncHandler(async (req, res) => {
    const { restaurantId, username, password } = req.body;
    const result = await AuthService.loginScreen(restaurantId, username, password);
    return sendSuccess(res, 200, 'Screen device authenticated successfully', result);
  });

  /**
   * Refresh access & refresh tokens.
   */
  refresh = asyncHandler(async (req, res) => {
    const { refreshToken } = req.body;
    const result = await AuthService.refreshSession(refreshToken);
    return sendSuccess(res, 200, 'Session tokens refreshed successfully', result);
  });

  /**
   * Logout user session.
   */
  logout = asyncHandler(async (req, res) => {
    // Stateless JWT logout: write access token to Redis blacklist to revoke it immediately
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const jwt = require('jsonwebtoken');
      const { safeRedisCall } = require('../../database/redis');

      try {
        const decoded = jwt.decode(token);
        if (decoded && decoded.exp) {
          const remainingLifespan = decoded.exp - Math.floor(Date.now() / 1000);
          if (remainingLifespan > 0) {
            await safeRedisCall(async (client) => {
              await client.setEx(`blacklist:${token}`, remainingLifespan, 'revoked');
            });
          }
        }
      } catch (err) {
        // ignore decoding errors
      }
    }

    return sendSuccess(res, 200, 'User logged out successfully', null);
  });

  /**
   * Fetch authenticated user personal profile.
   */
  getProfile = asyncHandler(async (req, res) => {
    const profile = await AuthService.getUserProfile(req.user._id);
    return sendSuccess(res, 200, 'User profile fetched successfully', profile);
  });

  /**
   * Update authenticated user personal profile (fullName, mobile).
   */
  updateProfile = asyncHandler(async (req, res) => {
    const updated = await AuthService.updateUserProfile(req.user._id, req.body);
    return sendSuccess(res, 200, 'User profile updated successfully', updated);
  });

  /**
   * Upload authenticated user profile photo.
   */
  uploadAvatar = asyncHandler(async (req, res) => {
    const { avatarUrl } = req.body;
    const updated = await AuthService.uploadUserAvatar(req.user._id, avatarUrl);
    return sendSuccess(res, 200, 'User avatar updated successfully', updated);
  });

  /**
   * Change user password securely.
   */
  changePassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;
    const result = await AuthService.changePassword(req.user._id, oldPassword, newPassword);
    return sendSuccess(res, 200, 'Password changed successfully', result);
  });
}

module.exports = new AuthController();
