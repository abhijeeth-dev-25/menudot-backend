const express = require('express');
const multer = require('multer');
const MenuController = require('../../controllers/restaurant/menu.controller');
const validate = require('../../middlewares/validate');
const { protect, resolveTenant } = require('../../middlewares/auth');
const {
  createCategorySchema,
  updateCategorySchema,
  createItemSchema,
  updateItemSchema,
  updateItemStatusSchema,
} = require('../../validators/menu.validator');

const router = express.Router();

// Multer configuration for memory storage file uploads (Enforcing max 5MB size and image mime-types)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedMimeTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only JPG, PNG, and WebP images are allowed.'));
    }
  },
});

// All menu operations require authentication and tenant mapping (requires 'x-restaurant-id' header)
router.use(protect);
router.use(resolveTenant);

// ==========================================
// CATEGORIES ENDPOINTS
// ==========================================
router.post('/categories', validate(createCategorySchema), MenuController.createCategory);
router.get('/categories', MenuController.getCategories);
router.put('/categories/:categoryId', validate(updateCategorySchema), MenuController.updateCategory);
router.delete('/categories/:categoryId', MenuController.deleteCategory);

// ==========================================
// MENU ITEMS ENDPOINTS
// ==========================================
router.post('/items', validate(createItemSchema), MenuController.createItem);
router.get('/items', MenuController.getItems);
router.get('/items/:itemId', MenuController.getItemDetails);
router.put('/items/:itemId', validate(updateItemSchema), MenuController.updateItem);
router.delete('/items/:itemId', MenuController.deleteItem);
router.patch('/items/:itemId/status', validate(updateItemStatusSchema), MenuController.toggleStockStatus);

// ==========================================
// MEDIA ENDPOINTS
// ==========================================
router.post('/media/upload', upload.single('image'), MenuController.uploadMedia);

module.exports = router;
