const VerificationService = require('../../services/platform/verification.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../exceptions/AppError');

class VerificationController {
  /**
   * Get pending verification queue.
   */
  getPendingVerifications = asyncHandler(async (req, res) => {
    const list = await VerificationService.getPendingVerifications();
    return sendSuccess(res, 200, 'Pending document verifications list retrieved successfully', list);
  });

  /**
   * Toggles checkmarks on a restaurant onboarding application document.
   */
  verifyDocument = asyncHandler(async (req, res) => {
    const { restaurantId } = req.params;
    const { docType, isVerified } = req.body;

    if (isVerified === undefined || isVerified === null) {
      throw new AppError(400, 'Verification status "isVerified" is required.');
    }

    const updated = await VerificationService.verifyDocument(
      restaurantId,
      docType,
      isVerified,
      req.user._id
    );

    const message = `Document "${docType}" verification status updated to ${isVerified}`;
    return sendSuccess(res, 200, message, updated);
  });
}

module.exports = new VerificationController();
