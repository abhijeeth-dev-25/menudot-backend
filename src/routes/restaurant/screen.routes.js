const express = require('express');
const ScreenController = require('../../controllers/restaurant/screen.controller');
const validate = require('../../middlewares/validate');
const { protect, resolveTenant, restrictToRoles } = require('../../middlewares/auth');
const { createScreenSchema, updateScreenSchema } = require('../../validators/screen.validator');

const router = express.Router();

// Screen configuration and listing is restricted to restaurant owners and managers
router.use(protect);
router.use(resolveTenant);
router.use(restrictToRoles('owner', 'manager'));

router.post('/', validate(createScreenSchema), ScreenController.createScreen);
router.get('/', ScreenController.getScreens);
router.put('/:screenId', validate(updateScreenSchema), ScreenController.updateScreen);
router.delete('/:screenId', ScreenController.deleteScreen);

module.exports = router;
