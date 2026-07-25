const asyncHandler = require('../../utils/asyncHandler');
const founderAuthService = require('../../services/platform/founderAuth.service');

/**
 * Controller to handle Founder Step-Up OTP request and verification.
 */
class FounderAuthController {
  /**
   * Dispatches 6-digit OTP to abhijeethkar.geddam.dev@gmail.com
   */
  requestOTP = asyncHandler(async (req, res) => {
    const result = await founderAuthService.requestFounderOTP();
    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        expiresInSeconds: result.expiresInSeconds,
      },
    });
  });

  /**
   * Verifies OTP and returns short-lived Authorization Token for critical changes
   */
  verifyOTP = asyncHandler(async (req, res) => {
    const { otp } = req.body;
    const result = await founderAuthService.verifyFounderOTP(otp);
    res.status(200).json({
      success: true,
      message: result.message,
      data: {
        founderAuthToken: result.founderAuthToken,
      },
    });
  });
}

module.exports = new FounderAuthController();
