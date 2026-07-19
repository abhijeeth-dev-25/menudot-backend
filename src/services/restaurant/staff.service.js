const RestaurantStaffRepository = require('../../repositories/restaurant/restaurantStaff.repository');
const UserRepository = require('../../repositories/restaurant/user.repository');
const AppError = require('../../exceptions/AppError');
const { runTransaction } = require('../../utils/transaction');
const logger = require('../../utils/logger');

const DEFAULT_PERMISSIONS = {
  owner: ['*'],
  manager: ['view_restaurant', 'manage_staff', 'manage_menu', 'view_orders'],
  server: ['view_orders', 'view_tables', 'view_bookings'],
  chef: ['view_orders', 'update_order_status', 'manage_item_stock'],
};

class StaffService {
  async createStaff(restaurantId, callerRole, staffData) {
    const { fullName, email, mobile, password, role, salary } = staffData;

    // 1. Validate role boundaries
    // Managers can only create servers and chefs. Owners can create any role.
    if (callerRole === 'manager' && (role === 'owner' || role === 'manager')) {
      throw new AppError(403, 'Permission Denied: Managers can only create Server or Chef accounts.');
    }

    // 2. Validate email and mobile uniqueness
    const existingEmail = await UserRepository.findByEmail(email);
    if (existingEmail) {
      throw new AppError(400, `A user with the email "${email}" already exists.`);
    }

    const existingMobile = await UserRepository.findByMobile(mobile);
    if (existingMobile) {
      throw new AppError(400, `A user with the mobile number "${mobile}" already exists.`);
    }

    let staffRecord;

    // 3. Execute creation inside transaction block
    await runTransaction(async (session) => {
      // Create global user account
      const user = await UserRepository.create(
        {
          fullName,
          email,
          mobile,
          passwordHash: password, // Pre-save hook hashes it
          status: 'active',
          globalRole: 'restaurant_user',
        },
        { session }
      );

      // Create scoped staff mapping
      staffRecord = await RestaurantStaffRepository.create(
        restaurantId,
        {
          userId: user._id,
          role,
          permissions: DEFAULT_PERMISSIONS[role] || [],
          employment: {
            salary: {
              amount: salary || 0,
            },
          },
          status: 'active',
        },
        { session }
      );
    });

    logger.info(
      { restaurantId, staffId: staffRecord._id, role },
      'Successfully created new staff member account'
    );

    return {
      staffId: staffRecord._id,
      fullName,
      email,
      mobile,
      role: staffRecord.role,
      permissions: staffRecord.permissions,
      status: staffRecord.status,
      salary: staffRecord.employment?.salary?.amount,
    };
  }

  async getStaffList(restaurantId) {
    return RestaurantStaffRepository.findStaffByRestaurant(restaurantId, { isDeleted: false });
  }

  async updateStaff(restaurantId, callerRole, staffId, updateData) {
    const staff = await RestaurantStaffRepository.findById(restaurantId, staffId);
    if (!staff) {
      throw new AppError(404, 'Staff member not found.');
    }

    // Load staff user profile
    const user = await UserRepository.findById(staff.userId);
    if (!user) {
      throw new AppError(404, 'Underlying user account not found.');
    }

    // 1. Enforce manager access boundaries
    if (callerRole === 'manager') {
      if (staff.role === 'owner' || staff.role === 'manager') {
        throw new AppError(403, 'Permission Denied: Managers cannot modify Owner or Manager accounts.');
      }
      if (updateData.role === 'owner' || updateData.role === 'manager') {
        throw new AppError(403, 'Permission Denied: Managers cannot promote staff to Owner or Manager roles.');
      }
    }

    const updates = { ...updateData };

    // If role is updated, default permissions are automatically mapped (unless custom array is sent)
    if (updateData.role && updateData.role !== staff.role) {
      if (!updateData.permissions) {
        updates.permissions = DEFAULT_PERMISSIONS[updateData.role] || [];
      }
    }

    let updatedStaff;

    await runTransaction(async (session) => {
      // Update global user name if supplied
      if (updateData.fullName && updateData.fullName !== user.fullName) {
        await UserRepository.update(user._id, { fullName: updateData.fullName }, { session });
      }

      // Update staff details
      const staffUpdates = {};
      if (updates.role) staffUpdates.role = updates.role;
      if (updates.permissions) staffUpdates.permissions = updates.permissions;
      if (updates.status) staffUpdates.status = updates.status;
      if (updates.salary !== undefined) {
        staffUpdates['employment.salary.amount'] = updates.salary;
      }

      updatedStaff = await RestaurantStaffRepository.update(restaurantId, staffId, staffUpdates, { session });
    });

    return updatedStaff;
  }

  async deleteStaff(restaurantId, callerRole, staffId) {
    const staff = await RestaurantStaffRepository.findById(restaurantId, staffId);
    if (!staff) {
      throw new AppError(404, 'Staff member not found.');
    }

    // Enforce manager boundaries
    if (callerRole === 'manager' && (staff.role === 'owner' || staff.role === 'manager')) {
      throw new AppError(403, 'Permission Denied: Managers cannot terminate Owner or Manager accounts.');
    }

    // Soft delete membership
    return RestaurantStaffRepository.delete(restaurantId, staffId);
  }
}

module.exports = new StaffService();
