const mongoose = require('mongoose');
const { verifyAccessToken } = require('../utils/jwt.util');
const AppError = require('../exceptions/AppError');
const asyncHandler = require('../utils/asyncHandler');
const UserRepository = require('../repositories/restaurant/user.repository');
const RestaurantStaffRepository = require('../repositories/restaurant/restaurantStaff.repository');
const ScreenRepository = require('../repositories/restaurant/screen.repository');

/**
 * Authentication middleware that verifies JWT and attaches user or screen device context.
 */
const protect = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Extract Bearer token from headers
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    return next(new AppError(401, 'Authentication token required. Please log in.'));
  }

  try {
    // Check if token has been revoked / blacklisted in Redis
    const { safeRedisCall } = require('../database/redis');
    const isBlacklisted = await safeRedisCall(async (client) => {
      return await client.exists(`blacklist:${token}`);
    }, 0);

    if (isBlacklisted) {
      return next(new AppError(401, 'Session has been revoked. Please log in again.'));
    }

    // 2. Verify token signature and expiry
    const decoded = verifyAccessToken(token);

    // 3. Attach token payload metadata to request
    req.auth = decoded;

    // 4. Resolve DB entities based on token type
    if (decoded.type === 'user') {
      const user = await UserRepository.findById(decoded.id);
      if (!user) {
        return next(new AppError(401, 'The user belonging to this token no longer exists.'));
      }
      if (user.status !== 'active') {
        return next(new AppError(403, 'Your user account has been suspended.'));
      }
      req.user = user;
    } else if (decoded.type === 'screen') {
      // Screen device context
      // Note: Screens are tenant-scoped, we query by ID and restaurantId stored in token
      const screen = await ScreenRepository.findById(decoded.restaurantId, decoded.id);
      if (!screen) {
        return next(new AppError(401, 'The screen device belonging to this token no longer exists.'));
      }
      if (screen.status !== 'active') {
        return next(new AppError(403, 'This screen device has been deactivated.'));
      }
      req.screen = screen;
    } else {
      return next(new AppError(401, 'Invalid authentication token type.'));
    }

    next();
  } catch (error) {
    return next(new AppError(401, 'Session invalid or expired. Please log in again.'));
  }
});

/**
 * Tenant resolution middleware.
 * Binds `restaurantId` to request context and verifies if the user is authorized to access it.
 */
const resolveTenant = asyncHandler(async (req, res, next) => {
  if (!req.auth) {
    return next(new AppError(500, 'Auth context missing. resolveTenant must run after protect middleware.'));
  }

  let restaurantIdStr;

  // 1. Resolve restaurant ID string
  if (req.auth.type === 'screen') {
    // Screen devices are pre-bound to a restaurantId in their token payload
    restaurantIdStr = req.auth.restaurantId;
  } else {
    // Users can access multiple restaurants, they pass x-restaurant-id header or path params
    restaurantIdStr = req.headers['x-restaurant-id'] || req.params.restaurantId || req.query.restaurantId;
  }

  if (!restaurantIdStr) {
    return next(new AppError(400, 'Restaurant identification (x-restaurant-id header) is required.'));
  }

  if (!mongoose.Types.ObjectId.isValid(restaurantIdStr)) {
    return next(new AppError(400, 'Invalid restaurant identifier format.'));
  }

  const restaurantId = new mongoose.Types.ObjectId(restaurantIdStr);
  req.restaurantId = restaurantId;

  // 2. If it's an internal platform user / super_admin, bypass staff membership checks
  if (req.user && req.user.globalRole !== 'restaurant_user') {
    req.staff = {
      role: 'owner',
      permissions: ['*'],
    };
    return next();
  }

  // 3. For standard users, verify they are members of the restaurant staff
  if (req.auth.type === 'user') {
    const staff = await RestaurantStaffRepository.findByUserId(restaurantId, req.user._id);
    if (!staff) {
      return next(new AppError(403, 'Access denied. You do not belong to this restaurant\'s staff list.'));
    }
    if (staff.status !== 'active') {
      return next(new AppError(403, 'Your staff employment at this restaurant is inactive.'));
    }
    req.staff = staff;
  } else if (req.auth.type === 'screen') {
    // Screen devices are already verified in the protect middleware
    // We map screen details to req.staff object for uniformity in authorization checks
    req.staff = {
      role: req.screen.assignedRole,
      permissions: req.screen.permissions,
    };
  }

  next();
});

/**
 * Authorization: Restrict access to specific staff roles.
 * @param {...string} roles - Allowed roles (owner, manager, server, chef)
 */
function restrictToRoles(...roles) {
  return (req, res, next) => {
    if (!req.staff) {
      return next(new AppError(500, 'Staff context missing. resolveTenant must run before authorization checks.'));
    }

    if (req.user?.globalRole === 'platform_admin' || req.user?.globalRole === 'super_admin') {
      return next(); // Platform admins bypass role restrictions
    }

    const userRole = req.staff.role;
    const userRoles = (userRole === 'waiter' || userRole === 'server') ? ['waiter', 'server'] : [userRole];

    const hasRole = roles.some((r) => userRoles.includes(r));
    if (!hasRole) {
      return next(new AppError(403, 'Permission denied. Your role is unauthorized to perform this action.'));
    }

    next();
  };
}

/**
 * Authorization: Restrict access to specific fine-grained permissions.
 * @param {...string} permissions - Required permission tokens
 */
function restrictToPermissions(...permissions) {
  return (req, res, next) => {
    if (!req.staff) {
      return next(new AppError(500, 'Staff context missing. resolveTenant must run before authorization checks.'));
    }

    if (req.user?.globalRole === 'platform_admin' || req.staff.role === 'owner') {
      return next(); // Owners and platform admins bypass permission restrictions
    }

    // Check if staff has all required permissions
    const staffPermissions = req.staff.permissions || [];
    const hasAllPermissions = permissions.every((p) => staffPermissions.includes(p));

    if (!hasAllPermissions) {
      return next(new AppError(403, 'Permission denied. You lack the required permissions to perform this action.'));
    }

    next();
  };
}

/**
 * Authorization: Restrict access to specific global roles (e.g. platform_admin).
 * @param {...string} roles - Allowed global roles
 */
function restrictToGlobalRole(...roles) {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.globalRole)) {
      return next(
        new AppError(
          403,
          'Permission denied. Only global administrators can perform this action.'
        )
      );
    }
    next();
  };
}

module.exports = {
  protect,
  resolveTenant,
  restrictToRoles,
  restrictToPermissions,
  restrictToGlobalRole,
};
