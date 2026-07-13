const express = require('express');
const StaffController = require('../controllers/staff.controller');
const validate = require('../middlewares/validate');
const { protect, resolveTenant, restrictToRoles } = require('../middlewares/auth');
const { createStaffSchema, updateStaffSchema } = require('../validators/staff.validator');

const router = express.Router();

// All staff operations require authentication and tenant scopes
router.use(protect);
router.use(resolveTenant);

// Only owners and managers can access staff directories or modify staff
router.use(restrictToRoles('owner', 'manager'));

router.post('/', validate(createStaffSchema), StaffController.createStaff);
router.get('/', StaffController.getStaffList);
router.put('/:staffId', validate(updateStaffSchema), StaffController.updateStaff);
router.delete('/:staffId', StaffController.deleteStaff);

module.exports = router;
