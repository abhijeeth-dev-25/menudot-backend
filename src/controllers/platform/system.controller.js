const mongoose = require('mongoose');
const User = require('../../models/user.model');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');
const AppError = require('../../exceptions/AppError');

// Global emergency control flag in memory (production-grade would use Redis/DB config)
let isPlatformUnderMaintenance = false;

class SystemController {
  /**
   * Fetch database collection statistics (Super Admin only).
   */
  getDatabaseStats = asyncHandler(async (req, res) => {
    const stats = {
      dbName: mongoose.connection.name,
      readyState: mongoose.connection.readyState,
      collections: {},
    };

    const collections = await mongoose.connection.db.listCollections().toArray();
    for (const coll of collections) {
      const count = await mongoose.connection.db.collection(coll.name).countDocuments();
      stats.collections[coll.name] = count;
    }

    return sendSuccess(res, 200, 'Database statistics fetched successfully', stats);
  });

  /**
   * Toggles emergency global maintenance mode (Super Admin only).
   */
  toggleEmergencyControl = asyncHandler(async (req, res) => {
    const { maintenance } = req.body;
    if (maintenance === undefined || maintenance === null) {
      throw new AppError(400, 'Maintenance status "maintenance" is required.');
    }

    isPlatformUnderMaintenance = !!maintenance;
    return sendSuccess(res, 200, `Platform emergency maintenance mode updated to ${isPlatformUnderMaintenance}`, {
      isPlatformUnderMaintenance,
    });
  });

  /**
   * Provision new platform user accounts (Super Admin only).
   */
  createPlatformUser = asyncHandler(async (req, res) => {
    const { fullName, email, mobile, password, globalRole } = req.body;

    const allowedPlatformRoles = [
      'super_admin',
      'platform_admin',
      'operations',
      'verification',
      'finance',
      'support',
      'safety',
      'sales',
      'tech',
      'audit',
    ];

    if (!allowedPlatformRoles.includes(globalRole)) {
      throw new AppError(400, `Invalid platform role "${globalRole}".`);
    }

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      throw new AppError(400, 'A user with this email already exists.');
    }

    const newUser = await User.create({
      fullName,
      email,
      mobile,
      passwordHash: password, // triggers bcrypt hashing in save hook
      globalRole,
      status: 'active',
    });

    const result = newUser.toObject();
    delete result.passwordHash;

    return sendSuccess(res, 201, `Platform user account (${globalRole}) created successfully`, result);
  });

  /**
   * Integration Webhook Health & Audit Log Inspection (Technical / Admin).
   * GET /api/v1/platform/system/integrations/logs
   */
  getIntegrationLogs = asyncHandler(async (req, res) => {
    // In production, queries aggregator webhook audit collections or Pino logger logs
    const mockLogs = [
      {
        provider: 'swiggy',
        event: 'order_status_update',
        status: 'SUCCESS',
        payloadId: 'swiggy_ord_901',
        timestamp: new Date(),
      },
      {
        provider: 'zomato',
        event: 'menu_sync',
        status: 'SUCCESS',
        payloadId: 'zomato_sync_102',
        timestamp: new Date(),
      },
    ];

    return sendSuccess(res, 200, 'Aggregator integration logs retrieved successfully', {
      totalEvents: mockLogs.length,
      logs: mockLogs,
    });
  });
}

module.exports = new SystemController();
