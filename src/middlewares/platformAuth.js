const AppError = require('../exceptions/AppError');
const { ROLE_PERMISSIONS, PLATFORM_ROLES } = require('../config/platformPermissions');

/**
 * Middleware to restrict access to platform-wide endpoints based on global roles and permissions.
 * Assumes the `protect` middleware has already run and attached `req.user`.
 * 
 * @param {...string} requiredPermissions - Permissions required to access this endpoint
 */
function restrictToPlatformPermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user) {
      return next(new AppError(500, 'User context missing. protect middleware must run before platform authorization checks.'));
    }

    const { globalRole } = req.user;

    // 1. Super Admins bypass all permission checks
    if (globalRole === PLATFORM_ROLES.SUPER_ADMIN) {
      return next();
    }

    // 2. Fetch permissions map for the role
    const assignedPermissions = ROLE_PERMISSIONS[globalRole] || [];

    // 3. Verify all required permissions are met
    const hasAccess = requiredPermissions.every((permission) =>
      assignedPermissions.includes(permission)
    );

    if (!hasAccess) {
      return next(
        new AppError(
          403,
          'Permission denied. Your platform team role lacks authorization to perform this action.'
        )
      );
    }

    next();
  };
}

module.exports = {
  restrictToPlatformPermission,
};
