const ScreenRepository = require('../repositories/screen.repository');
const RestaurantStaffRepository = require('../repositories/restaurantStaff.repository');
const AppError = require('../exceptions/AppError');
const logger = require('../utils/logger');

const DEFAULT_PERMISSIONS = {
  owner: ['*'],
  manager: ['view_restaurant', 'manage_staff', 'manage_menu', 'view_orders'],
  server: ['view_orders', 'view_tables', 'view_bookings'],
  chef: ['view_orders', 'update_order_status', 'manage_item_stock'],
};

class ScreenService {
  async createScreen(restaurantId, screenData) {
    const { name, screenType, username, password, assignedRole, permissions, allowedServices, allowedTables, assignedStaffId } = screenData;

    // 1. Verify unique username per restaurant
    const existingScreen = await ScreenRepository.findByUsername(restaurantId, username);
    if (existingScreen) {
      throw new AppError(400, `A screen with username "${username}" already exists at this outlet.`);
    }

    // 2. Validate assignedStaffId belongs to the restaurant staff list if provided
    if (assignedStaffId) {
      const staff = await RestaurantStaffRepository.findByUserId(restaurantId, assignedStaffId);
      if (!staff) {
        throw new AppError(400, 'Invalid assignedStaffId. The staff member must belong to this restaurant.');
      }
    }

    // 3. Map default permissions based on role if none are provided
    const screenPermissions = permissions || DEFAULT_PERMISSIONS[assignedRole] || [];

    const newScreen = await ScreenRepository.create(restaurantId, {
      name,
      screenType,
      username,
      passwordHash: password, // Pre-save hooks will encrypt password
      assignedRole,
      permissions: screenPermissions,
      allowedServices: allowedServices || ['water', 'bill', 'cleaning', 'queries', 'others'],
      allowedTables: allowedTables || [],
      assignedStaffId: assignedStaffId || null,
      status: 'active',
    });

    logger.info({ restaurantId, screenId: newScreen._id, name }, 'New screen terminal registered successfully');

    const result = newScreen.toObject();
    delete result.passwordHash;
    return result;
  }

  async getScreens(restaurantId) {
    // Only return screens that are not soft-deleted
    return ScreenRepository.findAllByRestaurant(restaurantId);
  }

  async updateScreen(restaurantId, screenId, updateData) {
    const screen = await ScreenRepository.findById(restaurantId, screenId);
    if (!screen) {
      throw new AppError(404, 'Screen device not found.');
    }

    // Validate staff association if updated
    if (updateData.assignedStaffId) {
      const staff = await RestaurantStaffRepository.findByUserId(restaurantId, updateData.assignedStaffId);
      if (!staff) {
        throw new AppError(400, 'The specified staff user does not belong to this restaurant.');
      }
    }

    const updates = { ...updateData };

    // If role is updated, adjust permissions
    if (updateData.assignedRole && updateData.assignedRole !== screen.assignedRole) {
      if (!updateData.permissions) {
        updates.permissions = DEFAULT_PERMISSIONS[updateData.assignedRole] || [];
      }
    }

    const updatedScreen = await ScreenRepository.update(restaurantId, screenId, updates);
    const result = updatedScreen.toObject();
    delete result.passwordHash;
    return result;
  }

  async deleteScreen(restaurantId, screenId) {
    const screen = await ScreenRepository.findById(restaurantId, screenId);
    if (!screen) {
      throw new AppError(404, 'Screen device not found.');
    }

    return ScreenRepository.delete(restaurantId, screenId);
  }
}

module.exports = new ScreenService();
