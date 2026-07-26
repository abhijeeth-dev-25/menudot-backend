const UserRepository = require('../../repositories/restaurant/user.repository');
const RestaurantRepository = require('../../repositories/restaurant/restaurant.repository');
const ScreenRepository = require('../../repositories/restaurant/screen.repository');
const RestaurantStaffRepository = require('../../repositories/restaurant/restaurantStaff.repository');
const AppError = require('../../exceptions/AppError');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../../utils/jwt.util');
const { sendEmail } = require('../../utils/email');
const { runTransaction } = require('../../utils/transaction');
const mongoose = require('mongoose');
const crypto = require('crypto');

class AuthService {
  /**
   * Register a new restaurant and owner account.
   * On registration, both documents are created in a transaction.
   * Owner is suspended and Restaurant is in 'submitted' onboarding stage until approved.
   * Sends an onboarding application email containing all details to company inbox.
   * @param {object} registrationData - Unified registration attributes
   */
  async register(registrationData) {
    const {
      ownerName,
      email,
      mobile,
      whatsapp,
      restaurantName,
      location,
      schedule,
      outletType,
      legal,
      bank,
      menuSetup,
    } = registrationData;

    // 1. Validate unique owner credentials
    const existingEmail = await UserRepository.findByEmail(email);
    if (existingEmail) {
      throw new AppError(400, 'A user with this email address already exists.');
    }

    const existingMobile = await UserRepository.findByMobile(mobile);
    if (existingMobile) {
      throw new AppError(400, 'A user with this mobile number already exists.');
    }

    // 2. Validate unique restaurant name / slug
    const slug = restaurantName
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)+/g, '');

    const existingSlug = await RestaurantRepository.findBySlug(slug);
    if (existingSlug) {
      throw new AppError(400, 'A restaurant with this name is already onboarding or registered.');
    }

    // 3. Generate a secure temporary password for the owner account
    const tempPassword = crypto.randomBytes(8).toString('hex'); // 16 hex characters

    // 4. Execute Mongoose Transaction to persist User & Restaurant in one atomic batch
    let user;
    let restaurant;

    await runTransaction(async (session) => {
      // Create suspended owner account
      user = await UserRepository.create({
        fullName: ownerName,
        email,
        mobile,
        passwordHash: tempPassword, // Will be hashed in userSchema pre-save hook
        status: 'suspended', // Suspended until company review approves it
      }, { session });

      // Create restaurant in submitted stage
      restaurant = await RestaurantRepository.create({
        name: restaurantName,
        slug,
        owner: {
          userId: user._id,
          fullName: ownerName,
          email,
          mobile,
          whatsapp: whatsapp || null,
        },
        location: {
          address: location.address,
          city: location.city,
          state: location.state,
          pincode: location.pincode,
          geo: {
            type: 'Point',
            coordinates: location.coordinates,
          },
        },
        schedule,
        outletType,
        legal,
        bank,
        menuProfile: {
          foodType: menuSetup.foodType,
          cuisines: menuSetup.cuisines,
          costForTwo: menuSetup.costForTwo,
          packingCharge: menuSetup.packingCharge || { type: 'none', value: 0 },
        },
        onboarding: {
          stage: 'submitted',
          submittedAt: new Date(),
        },
        subscription: {
          status: 'suspended', // Suspended until onboarding approval
        },
      }, { session });
    });

    // 5. Send onboarding receipt email to Owner
    const emailSubject = `[MenuDot] Onboarding Application Initiated: ${restaurantName}`;
    const emailText = `
      Dear ${ownerName},
      
      Thank you for registering your restaurant "${restaurantName}" on MenuDot.
      
      We have received your application. Our Restaurant Verification Team is currently reviewing your documents (FSSAI, GSTIN, PAN, and Bank details).
      
      onboarding Stage: SUBMITTED
      
      We will notify you by email as soon as your account is approved and activated.
      
      Best regards,
      - The MenuDot Team
    `;

    const emailHtml = `
      <h2>Restaurant Onboarding Initiated</h2>
      <p>Dear ${ownerName},</p>
      <p>Thank you for choosing MenuDot! Your onboarding application for <strong>${restaurantName}</strong> has been successfully received.</p>
      
      <p><strong>Next Steps:</strong></p>
      <ul>
        <li>Our <strong>Restaurant Verification Team</strong> will review your submitted legal and banking credentials.</li>
        <li>Once documents are verified, a <strong>Platform Administrator</strong> will activate your account.</li>
        <li>You will receive an email containing a temporary password to access your manager dashboard shortly.</li>
      </ul>
      
      <p>If you have any questions, please feel free to reach out to our Customer Support Team.</p>
      <br />
      <p>Best regards,<br /><strong>The MenuDot Team</strong></p>
    `;

    // Dispatch background email. If SMTP fails in dev, it will log mock logs and continue.
    sendEmail({
      to: email,
      subject: emailSubject,
      text: emailText,
      html: emailHtml,
    }).catch((err) => logger.error({ err }, 'Background onboarding email transmission failed'));

    // Return application receipt message
    return {
      message: 'Onboarding application submitted successfully. Our team will review your documents and provide login credentials shortly.',
      application: {
        restaurantId: restaurant._id,
        ownerId: user._id,
        restaurantName,
        ownerName,
        onboardingStage: 'submitted',
      },
    };
  }

  /**
   * Log in a user using credentials.
   * @param {string} identifier - Email or mobile
   * @param {string} password - Raw password
   */
  async login(identifier, password) {
    if (!identifier || !password) {
      throw new AppError(400, 'Credentials and password are required.');
    }

    let user;
    if (identifier.includes('@')) {
      user = await UserRepository.findByEmail(identifier);
    } else {
      user = await UserRepository.findByMobile(identifier);
    }

    if (!user) {
      throw new AppError(401, 'Invalid login credentials.');
    }

    if (user.status !== 'active') {
      throw new AppError(403, 'Your account is pending verification and approval, or has been suspended. Please check your email.');
    }

    const isMatch = await user.isPasswordMatch(password);
    if (!isMatch) {
      throw new AppError(401, 'Invalid login credentials.');
    }

    // Update login timestamp
    await UserRepository.update(user._id, { lastLoginAt: new Date() });

    const accessToken = generateAccessToken(user, 'user');
    const refreshToken = generateRefreshToken(user, 'user');

    const sanitizedUser = user.toObject();
    delete sanitizedUser.passwordHash;

    if (user.globalRole === 'platform_admin') {
      sanitizedUser.role = 'platform_admin';
      sanitizedUser.restaurantId = null;
    } else {
      const staffRecords = await RestaurantStaffRepository.findRestaurantsForUser(user._id);
      if (staffRecords && staffRecords.length > 0) {
        sanitizedUser.role = staffRecords[0].role;
        sanitizedUser.restaurantId = (staffRecords[0].restaurantId && staffRecords[0].restaurantId._id) 
          ? staffRecords[0].restaurantId._id.toString() 
          : staffRecords[0].restaurantId.toString();
      } else {
        const Restaurant = require('../../models/restaurant.model');
        const firstRestaurant = await Restaurant.findOne({});
        sanitizedUser.role = 'owner';
        sanitizedUser.restaurantId = firstRestaurant ? firstRestaurant._id.toString() : null;
      }
    }

    return {
      user: sanitizedUser,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * Log in a shared screen device.
   * @param {string} restaurantId - The target restaurant ID
   * @param {string} username - Screen username identifier
   * @param {string} password - Screen password
   */
  async loginScreen(restaurantId, username, password) {
    if (!restaurantId || !username || !password) {
      throw new AppError(400, 'Restaurant, username, and password are required.');
    }

    const screen = await ScreenRepository.findByUsername(restaurantId, username);
    if (!screen) {
      throw new AppError(401, 'Invalid device credentials.');
    }

    if (screen.status !== 'active') {
      throw new AppError(403, 'This screen device has been deactivated.');
    }

    const isMatch = await screen.isPasswordMatch(password);
    if (!isMatch) {
      throw new AppError(401, 'Invalid device credentials.');
    }

    // Update last active
    await ScreenRepository.update(restaurantId, screen._id, { lastActiveAt: new Date() });

    const accessToken = generateAccessToken(screen, 'screen');
    const refreshToken = generateRefreshToken(screen, 'screen');

    const sanitizedScreen = screen.toObject();
    delete sanitizedScreen.passwordHash;

    return {
      screen: sanitizedScreen,
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  /**
   * Rotates and refreshes session tokens.
   * @param {string} token - Current Refresh Token
   */
  async refreshSession(token) {
    if (!token) {
      throw new AppError(400, 'Refresh token required.');
    }

    try {
      const decoded = verifyRefreshToken(token);
      let entity;
      let type = decoded.type;

      if (type === 'user') {
        entity = await UserRepository.findById(decoded.id);
        if (!entity || entity.status !== 'active') {
          throw new AppError(401, 'Session owner account is invalid or suspended.');
        }
      } else if (type === 'screen') {
        entity = await ScreenRepository.findById(decoded.restaurantId, decoded.id);
        if (!entity || entity.status !== 'active') {
          throw new AppError(401, 'Session device is invalid or deactivated.');
        }
      } else {
        throw new AppError(401, 'Invalid refresh token type.');
      }

      // Generate new tokens (rotation)
      const accessToken = generateAccessToken(entity, type);
      const refreshToken = generateRefreshToken(entity, type);

      return {
        tokens: {
          accessToken,
          refreshToken,
        },
      };
    } catch (error) {
      if (error instanceof AppError) throw error;
      throw new AppError(401, 'Session expired or token is invalid.');
    }
  }

  /**
   * Get user personal profile details.
   */
  async getUserProfile(userId) {
    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError(404, 'User profile not found.');
    }

    const staffRecords = await RestaurantStaffRepository.findRestaurantsForUser(userId);
    const sanitized = user.toObject();
    delete sanitized.passwordHash;

    if (staffRecords && staffRecords.length > 0) {
      sanitized.role = staffRecords[0].role;
      sanitized.permissions = staffRecords[0].permissions || [];
      sanitized.restaurantId = staffRecords[0].restaurantId;
      sanitized.employment = staffRecords[0].employment;
    }

    return sanitized;
  }

  /**
   * Update personal profile details (fullName, mobile).
   */
  async updateUserProfile(userId, { fullName, mobile }) {
    const updateData = {};
    if (fullName) updateData.fullName = fullName.trim();
    if (mobile) updateData.mobile = mobile.trim();

    const user = await UserRepository.update(userId, updateData);
    if (!user) {
      throw new AppError(404, 'User profile not found.');
    }

    const sanitized = user.toObject();
    delete sanitized.passwordHash;
    return sanitized;
  }

  /**
   * Upload user avatar photo.
   */
  async uploadUserAvatar(userId, avatarUrl) {
    const user = await UserRepository.update(userId, { avatarUrl });
    if (!user) {
      throw new AppError(404, 'User profile not found.');
    }

    const sanitized = user.toObject();
    delete sanitized.passwordHash;
    return sanitized;
  }

  /**
   * Change user password securely with old password verification.
   */
  async changePassword(userId, oldPassword, newPassword) {
    if (!oldPassword || !newPassword) {
      throw new AppError(400, 'Current and new password are required.');
    }

    if (newPassword.length < 6) {
      throw new AppError(400, 'New password must be at least 6 characters long.');
    }

    const user = await UserRepository.findById(userId);
    if (!user) {
      throw new AppError(404, 'User account not found.');
    }

    const isMatch = await user.isPasswordMatch(oldPassword);
    if (!isMatch) {
      throw new AppError(400, 'Current password provided is incorrect.');
    }

    user.passwordHash = newPassword;
    await user.save();

    return { message: 'Password updated successfully.' };
  }
}

module.exports = new AuthService();
