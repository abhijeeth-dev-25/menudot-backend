const express = require('express');
const CustomerHomeController = require('../../controllers/customer/customerHome.controller');
const CustomerMenuController = require('../../controllers/customer/customerMenu.controller');
const CustomerAccountController = require('../../controllers/customer/customerAccount.controller');
const CustomerStatusController = require('../../controllers/customer/customerStatus.controller');
const CustomerAdController = require('../../controllers/customer/customerAd.controller');
const validate = require('../../middlewares/validate');
const { linkSwiggySchema } = require('../../validators/experienceService.validator');

const router = express.Router();

// ==========================================
// HOME PAGE & EXPERIENCES
// ==========================================
router.get('/home-feed', CustomerHomeController.getHomeFeed);
router.get('/experience-services', CustomerHomeController.getExperienceServices);
router.get('/branches', CustomerHomeController.getBranches);

// ==========================================
// MENU & SEARCH
// ==========================================
router.get('/menu', CustomerMenuController.getMenuCatalog);
router.get('/menu/search', CustomerMenuController.searchMenu);
router.get('/menu/items/:itemId', CustomerMenuController.getItemDetails);

// ==========================================
// ACCOUNT, SWIGGY LINK & BILLS
// ==========================================
router.post('/swiggy/link', validate(linkSwiggySchema), CustomerAccountController.linkSwiggyAccount);
router.get('/swiggy/status', CustomerAccountController.getSwiggyStatus);
router.get('/orders/history', CustomerAccountController.getOrderHistory);
router.get('/bill', CustomerAccountController.getBillSummary);

// ==========================================
// ORDER TRACKING & TABLE SERVICE
// ==========================================
router.get('/status', CustomerStatusController.getOrderStatus);
router.post('/service-request', CustomerStatusController.requestTableService);

// ==========================================
// AD PLACEMENT ENGINE
// ==========================================
router.get('/ads', CustomerAdController.getAdsForPlacement);

module.exports = router;
