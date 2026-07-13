const UserRepository = require('../repositories/user.repository');
const RestaurantRepository = require('../repositories/restaurant.repository');
const ScreenRepository = require('../repositories/screen.repository');
const AppError = require('../exceptions/AppError');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken } = require('../utils/jwt.util');
const { sendEmail } = require('../utils/email');
const { runTransaction } = require('../utils/transaction');
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

    // 5. Send detailed onboarding application email to company mailbox
    const companyEmail = process.env.SMTP_COMPANY_RECEIVER || 'onboarding@menudot.com';
    const emailSubject = `[ONBOARDING APPLICATION] New registration request: ${restaurantName}`;
    const emailText = `
      NEW RESTAURANT ONBOARDING REQUEST
      
      === Owner Details ===
      Name: ${ownerName}
      Email: ${email}
      Mobile: ${mobile}
      WhatsApp: ${whatsapp || 'N/A'}
      
      === Restaurant Details ===
      Name: ${restaurantName}
      Slug: ${slug}
      Outlet Type: ${outletType}
      Address: ${location.address}, ${location.city}, ${location.state} - ${location.pincode}
      Coordinates: [${location.coordinates.join(', ')}]
      Working Days: ${schedule.workingDays.join(', ')}
      Timing: ${schedule.openTime} to ${schedule.closeTime}
      
      === Legal/Financial Details ===
      PAN: ${legal.pan}
      GSTIN: ${legal.gstin}
      FSSAI: ${legal.fssaiNumber} (Expires: ${legal.fssaiExpiry})
      Bank Account: ${bank.accountNumber} (IFSC: ${bank.ifsc})
      
      === Menu Profile ===
      Food Type: ${menuSetup.foodType}
      Cuisines: ${menuSetup.cuisines.join(', ')}
      Cost for Two: ${menuSetup.costForTwo}
      Packing Charges: ${menuSetup.packingCharge ? `${menuSetup.packingCharge.type} (${menuSetup.packingCharge.value})` : 'None'}
    `;

    const emailHtml = `
      <h2>New Onboarding Registration Received</h2>
      <p>A new restaurant onboarding application has been submitted for <strong>${restaurantName}</strong>.</p>
      
      <h3>1. Owner Details</h3>
      <ul>
        <li><strong>Full Name:</strong> ${ownerName}</li>
        <li><strong>Email:</strong> ${email}</li>
        <li><strong>Mobile:</strong> ${mobile}</li>
        <li><strong>WhatsApp:</strong> ${whatsapp || 'N/A'}</li>
      </ul>
      
      <h3>2. Restaurant Profile</h3>
      <ul>
        <li><strong>Restaurant Name:</strong> ${restaurantName}</li>
        <li><strong>Slug:</strong> ${slug}</li>
        <li><strong>Outlet Type:</strong> ${outletType}</li>
        <li><strong>Address:</strong> ${location.address}, ${location.city}, ${location.state} - ${location.pincode}</li>
        <li><strong>Coordinates:</strong> [${location.coordinates.join(', ')}]</li>
        <li><strong>Working Days:</strong> ${schedule.workingDays.join(', ')}</li>
        <li><strong>Hours:</strong> ${schedule.openTime} - ${schedule.closeTime}</li>
      </ul>
      
      <h3>3. Documents & Financials</h3>
      <ul>
        <li><strong>Owner PAN:</strong> ${legal.pan}</li>
        <li><strong>GSTIN:</strong> ${legal.gstin}</li>
        <li><strong>FSSAI Number:</strong> ${legal.fssaiNumber} (Expires: ${legal.fssaiExpiry})</li>
        <li><strong>Bank Account:</strong> ${bank.accountNumber}</li>
        <li><strong>IFSC Code:</strong> ${bank.ifsc}</li>
      </ul>
      
      <h3>4. Menu Configuration</h3>
      <ul>
        <li><strong>Food Type:</strong> ${menuSetup.foodType}</li>
        <li><strong>Cuisines:</strong> ${menuSetup.cuisines.join(', ')}</li>
        <li><strong>Cost for Two:</strong> ${menuSetup.costForTwo}</li>
      </ul>
    `;

    // Dispatch background email. If SMTP fails in dev, it will log mock logs and continue.
    sendEmail({
      to: companyEmail,
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
}

module.exports = new AuthService();
