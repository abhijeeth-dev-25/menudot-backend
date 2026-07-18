const RestaurantRepository = require('../repositories/restaurant.repository');
const RestaurantStaffRepository = require('../repositories/restaurantStaff.repository');
const UserRepository = require('../repositories/user.repository');
const AppError = require('../exceptions/AppError');
const { sendEmail } = require('../utils/email');
const { runTransaction } = require('../utils/transaction');
const { uploadImage } = require('../utils/imagekit');
const mongoose = require('mongoose');
const crypto = require('crypto');
const logger = require('../utils/logger');

class RestaurantService {
  /**
   * Approves or rejects onboarding (Platform Admins only).
   * Generates a temporary login password for the owner upon approval.
   * Updates owner account status to 'active' and maps staff roles in a transaction.
   * 
   * @param {string} restaurantId - The target restaurant ID
   * @param {string} action - 'approve' or 'reject'
   * @param {string} [rejectionReason] - Message if rejected
   * @param {string} adminId - Platform admin User ID
   */
  async reviewOnboarding(restaurantId, action, rejectionReason, adminId) {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant onboarding application not found.');
    }

    if (restaurant.onboarding.stage !== 'submitted') {
      throw new AppError(
        400,
        `Application has already been reviewed (current stage: ${restaurant.onboarding.stage})`
      );
    }

    const ownerUserId = restaurant.owner.userId;
    const ownerEmail = restaurant.owner.email;
    const ownerName = restaurant.owner.fullName;

    // Start a transaction for safe state transitions
    let updatedRestaurant;
    let tempPassword = '';

    await runTransaction(async (session) => {
      if (action === 'approve') {
        // 1. Generate new temporary password
        tempPassword = crypto.randomBytes(6).toString('hex'); // 12-char hex password

        // 2. Activate user account and set the temporary password
        const user = await UserRepository.findById(ownerUserId, { session });
        if (!user) {
          throw new AppError(500, 'Owner user account associated with this application not found.');
        }

        user.passwordHash = tempPassword; // Will trigger schema pre-save hashing
        user.status = 'active';
        await user.save({ session });

        // 3. Create staff mapping join entry mapping user as owner
        await RestaurantStaffRepository.create(restaurantId, {
          userId: ownerUserId,
          role: 'owner',
          permissions: ['*'],
          screenAccess: ['*'],
          status: 'active',
        }, { session });

        // 4. Update Restaurant onboarding stage
        updatedRestaurant = await RestaurantRepository.update(restaurantId, {
          'onboarding.stage': 'approved',
          'onboarding.approvedAt': new Date(),
          'onboarding.approvedBy': adminId,
          'subscription.status': 'trial',
          // 30 days active trial from approval date
          'subscription.renewsAt': new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        }, { session });
      } else {
        // Reject application
        updatedRestaurant = await RestaurantRepository.update(restaurantId, {
          'onboarding.stage': 'rejected',
          'onboarding.rejectionReason': rejectionReason,
        }, { session });

        // Optional: Keep user suspended or flag them
        await UserRepository.update(ownerUserId, { status: 'suspended' }, { session });
      }
    });

    // 5. Send status email to Owner
    if (action === 'approve') {
      const emailSubject = `[Menudot] Onboarding Approved! Welcome to Menudot`;
      const emailText = `
        Dear ${ownerName},
        
        We are thrilled to inform you that your onboarding application for "${restaurant.name}" has been approved!
        
        Your account is now active. Please use the following login credentials to access your restaurant dashboard:
        
        Dashboard Link: http://localhost:3000/dashboard
        Login Identifier: ${ownerEmail} (or mobile: ${restaurant.owner.mobile})
        Temporary Password: ${tempPassword}
        
        * For security reasons, please change your password immediately after logging in.
        
        Welcome aboard!
        - The Menudot Team
      `;

      const emailHtml = `
        <h2>Welcome to Menudot, ${ownerName}!</h2>
        <p>Your onboarding application for <strong>${restaurant.name}</strong> has been verified and approved.</p>
        <p>You can now log in to the restaurant management dashboard using the credentials below:</p>
        <div style="background: #f4f4f4; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <strong>Username/Email:</strong> ${ownerEmail}<br />
          <strong>Temporary Password:</strong> <code style="font-size: 1.2em; color: #d63384;">${tempPassword}</code>
        </div>
        <p style="color: #666; font-size: 0.9em;">* Please change your temporary password on your first login for security.</p>
        <br />
        <p>Best regards,<br /><strong>The Menudot Team</strong></p>
      `;

      sendEmail({
        to: ownerEmail,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
      }).catch((err) => logger.error({ err }, 'Failed to send onboarding approval email'));
    } else {
      // Send rejection notice
      const emailSubject = `[Menudot] Onboarding Application Update`;
      const emailText = `
        Dear ${ownerName},
        
        Thank you for submitting your application for "${restaurant.name}".
        
        After reviewing your documents, we regret to inform you that we cannot approve your onboarding application at this time due to the following reason:
        
        "${rejectionReason}"
        
        Please correct these details and submit a new application, or contact support if you believe this was an error.
        
        Regards,
        - The Menudot Team
      `;

      const emailHtml = `
        <h2>Onboarding Application Status Update</h2>
        <p>Dear ${ownerName},</p>
        <p>We have reviewed your application for <strong>${restaurant.name}</strong>.</p>
        <p>Regrettably, we cannot approve it at this time for the following reason:</p>
        <blockquote style="background: #fff3f3; border-left: 5px solid #dc3545; padding: 10px 15px; margin: 20px 0;">
          ${rejectionReason}
        </blockquote>
        <p>If you have any questions, please contact our support desk.</p>
        <br />
        <p>Regards,<br /><strong>The Menudot Team</strong></p>
      `;

      sendEmail({
        to: ownerEmail,
        subject: emailSubject,
        text: emailText,
        html: emailHtml,
      }).catch((err) => logger.error({ err }, 'Failed to send onboarding rejection email'));
    }

    return updatedRestaurant;
  }

  /**
   * Fetch restaurant configuration profile.
   * @param {string} restaurantId - The target restaurant
   */
  async getRestaurantDetails(restaurantId) {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant profile not found.');
    }
    return restaurant;
  }

  /**
   * Fetch all pending onboarding submissions (Platform Admins only).
   */
  async getPendingOnboardings() {
    return RestaurantRepository.findAllPendingOnboarding();
  }

  /**
   * Uploads restaurant cover image to ImageKit and saves URL to profile.
   */
  async uploadRestaurantImage(restaurantId, fileBuffer, originalName) {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant profile not found.');
    }

    const { url } = await uploadImage(fileBuffer, `restaurant_${restaurantId}_${originalName}`);
    const updated = await RestaurantRepository.update(restaurantId, { imageUrl: url });
    logger.info({ restaurantId, url }, 'Restaurant cover image uploaded successfully');
    return updated;
  }

  /**
   * Updates restaurant profile configuration (Owner/Manager only).
   */
  async updateRestaurantProfile(restaurantId, updateData) {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant profile not found.');
    }

    const updated = await RestaurantRepository.update(restaurantId, updateData);
    logger.info({ restaurantId }, 'Restaurant profile updated successfully');
    return updated;
  }

  /**
   * Fetch all restaurants (Platform Admins only).
   */
  async getRestaurants(filter = {}) {
    const query = {};
    if (filter.stage) {
      query['onboarding.stage'] = filter.stage;
    }
    const Restaurant = require('../models/restaurant.model');
    return Restaurant.find(query).sort({ createdAt: -1 });
  }

  /**
   * Soft deletes a restaurant account (Platform Admin / Developer only).
   */
  async deleteRestaurantAdmin(restaurantId) {
    const restaurant = await RestaurantRepository.findById(restaurantId);
    if (!restaurant) {
      throw new AppError(404, 'Restaurant profile not found.');
    }

    const deleted = await RestaurantRepository.delete(restaurantId);
    logger.info({ restaurantId }, 'Restaurant account soft-deleted by platform admin');
    return deleted;
  }
}

module.exports = new RestaurantService();
