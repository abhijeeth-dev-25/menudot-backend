const express = require('express');
const CouponController = require('../../controllers/platform/coupon.controller');
const { protect } = require('../../middlewares/auth');

const router = express.Router();

// --- PUBLIC CUSTOMER ENDPOINTS ---
router.post('/apply', CouponController.applyCoupon);
router.get('/', CouponController.listCoupons);

// --- SECURE MERCHANT / ADMIN ENDPOINTS ---
router.post('/', protect, CouponController.createCoupon);

module.exports = router;
