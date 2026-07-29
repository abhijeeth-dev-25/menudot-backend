const express = require('express');
const AuthController = require('../../controllers/restaurant/auth.controller');
const validate = require('../../middlewares/validate');
const {
  publicRegisterSchema,
  loginSchema,
  screenLoginSchema,
  refreshSchema,
} = require('../../validators/auth.validator');

const { protect } = require('../../middlewares/auth');

const router = express.Router();

// Public auth endpoints
router.post('/register', validate(publicRegisterSchema), AuthController.register);
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/platform-login', validate(loginSchema), AuthController.platformLogin);
router.post('/login/screen', validate(screenLoginSchema), AuthController.loginScreen);
router.post('/refresh', validate(refreshSchema), AuthController.refresh);
router.post('/logout', AuthController.logout);

// Authenticated user profile & security endpoints
router.get('/me', protect, AuthController.getProfile);
router.patch('/me', protect, AuthController.updateProfile);
router.post('/avatar', protect, AuthController.uploadAvatar);
router.post('/change-password', protect, AuthController.changePassword);

// Founder Step-Up OTP Authorization endpoints
const FounderAuthController = require('../../controllers/platform/founderAuth.controller');
router.post('/founder-otp/request', FounderAuthController.requestOTP);
router.post('/founder-otp/verify', FounderAuthController.verifyOTP);

module.exports = router;
