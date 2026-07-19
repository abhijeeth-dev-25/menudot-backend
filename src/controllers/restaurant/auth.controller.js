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
    const { identifier, password } = req.body;
    const result = await AuthService.login(identifier, password);
    return sendSuccess(res, 200, 'User logged in successfully', result);
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
    // Statelss JWT logout is primarily managed client-side by purging tokens.
    // Return standard success to confirm client action.
    return sendSuccess(res, 200, 'User logged out successfully', null);
  });
}

module.exports = new AuthController();
