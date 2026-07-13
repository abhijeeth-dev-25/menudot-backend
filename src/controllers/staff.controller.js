const StaffService = require('../services/staff.service');
const { sendSuccess } = require('../utils/response');
const asyncHandler = require('../utils/asyncHandler');

class StaffController {
  createStaff = asyncHandler(async (req, res) => {
    // req.restaurantId and req.staff are populated by resolveTenant middleware
    const staff = await StaffService.createStaff(
      req.restaurantId,
      req.staff.role,
      req.body
    );
    return sendSuccess(res, 201, 'Staff member account created successfully', staff);
  });

  getStaffList = asyncHandler(async (req, res) => {
    const staffList = await StaffService.getStaffList(req.restaurantId);
    return sendSuccess(res, 200, 'Staff list retrieved successfully', staffList);
  });

  updateStaff = asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    const staff = await StaffService.updateStaff(
      req.restaurantId,
      req.staff.role,
      staffId,
      req.body
    );
    return sendSuccess(res, 200, 'Staff member details updated successfully', staff);
  });

  deleteStaff = asyncHandler(async (req, res) => {
    const { staffId } = req.params;
    await StaffService.deleteStaff(req.restaurantId, req.staff.role, staffId);
    return sendSuccess(res, 200, 'Staff member employment terminated successfully');
  });
}

module.exports = new StaffController();
