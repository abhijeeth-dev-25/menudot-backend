const RestaurantRepository = require('../../repositories/restaurant/restaurant.repository');
const AppError = require('../../exceptions/AppError');
const logger = require('../../utils/logger');

class VerificationService {
  /**
   * List all restaurants pending document verification (Verification Team queue).
   */
  async getPendingVerifications() {
    const Restaurant = require('../../models/restaurant.model');
    // Fetch restaurants that are submitted or already being checked (under_review)
    return Restaurant.find({
      'onboarding.stage': { $in: ['submitted', 'under_review'] },
    }).sort({ 'onboarding.submittedAt': 1 });
  }

  /**
   * Toggles document verification checkboxes.
   * Auto-transitions onboarding stage to 'verified' when PAN, GSTIN, FSSAI, and Bank details are all verified.
   * 
   * @param {string} restaurantId - Restaurant ID
   * @param {string} docType - 'pan' | 'gstin' | 'fssai' | 'bank'
   * @param {boolean} isVerified - Status check
   * @param {string} verifierId - User ID of verifier
   */
  async verifyDocument(restaurantId, docType, isVerified, verifierId) {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant onboarding application not found.');
    }

    const validDocs = ['pan', 'gstin', 'fssai', 'bank'];
    if (!validDocs.includes(docType)) {
      throw new AppError(400, `Invalid document type "${docType}". Must be one of ${validDocs.join(', ')}.`);
    }

    const currentStage = restaurant.onboarding.stage;
    if (currentStage !== 'submitted' && currentStage !== 'under_review') {
      throw new AppError(400, `Cannot verify documents for restaurant in stage "${currentStage}".`);
    }

    // Update specific checkmark
    const fieldKey = `${docType}Verified`;
    restaurant.onboarding.verificationChecklist[fieldKey] = isVerified;

    // Transition to under_review automatically when document verification starts
    restaurant.onboarding.stage = 'under_review';

    // Check if all documents are verified
    const checklist = restaurant.onboarding.verificationChecklist;
    const allVerified = checklist.panVerified && checklist.gstinVerified && checklist.fssaiVerified && checklist.bankVerified;

    if (allVerified) {
      restaurant.onboarding.stage = 'verified';
      restaurant.onboarding.verifiedBy = verifierId;
      restaurant.onboarding.verifiedAt = new Date();
      logger.info({ restaurantId, verifierId }, 'Restaurant documents fully verified. Moving stage to verified.');
    } else {
      // Clear verified audit fields if any document was marked unverified
      restaurant.onboarding.verifiedBy = null;
      restaurant.onboarding.verifiedAt = null;
    }

    // Save update via model save hook to preserve versioning/hooks
    await restaurant.save();
    return restaurant;
  }
}

module.exports = new VerificationService();
