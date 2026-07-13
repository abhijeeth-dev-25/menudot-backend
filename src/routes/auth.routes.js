const express = require('express');
const AuthController = require('../controllers/auth.controller');
const validate = require('../middlewares/validate');
const {
  publicRegisterSchema,
  loginSchema,
  screenLoginSchema,
  refreshSchema,
} = require('../validators/auth.validator');

const router = express.Router();

// Public auth endpoints
router.post('/register', validate(publicRegisterSchema), AuthController.register);
router.post('/login', validate(loginSchema), AuthController.login);
router.post('/login/screen', validate(screenLoginSchema), AuthController.loginScreen);
router.post('/refresh', validate(refreshSchema), AuthController.refresh);
router.post('/logout', AuthController.logout);

module.exports = router;
