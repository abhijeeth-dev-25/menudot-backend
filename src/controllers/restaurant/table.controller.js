const TableService = require('../../services/restaurant/table.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class TableController {
  // ==========================================
  // STAFF ACTIONS
  // ==========================================

  createTable = asyncHandler(async (req, res) => {
    const table = await TableService.createTable(req.restaurantId, req.body);
    return sendSuccess(res, 201, 'Table created successfully', table);
  });

  getTables = asyncHandler(async (req, res) => {
    const tables = await TableService.getTables(req.restaurantId);
    return sendSuccess(res, 200, 'Tables retrieved successfully', tables);
  });

  updateTable = asyncHandler(async (req, res) => {
    const { tableId } = req.params;
    const table = await TableService.updateTable(req.restaurantId, tableId, req.body);
    return sendSuccess(res, 200, 'Table updated successfully', table);
  });

  deleteTable = asyncHandler(async (req, res) => {
    const { tableId } = req.params;
    await TableService.deleteTable(req.restaurantId, tableId);
    return sendSuccess(res, 200, 'Table deleted successfully');
  });

  toggleQrCode = asyncHandler(async (req, res) => {
    const { tableId } = req.params;
    const { isActive } = req.body;
    const table = await TableService.toggleQrCode(req.restaurantId, tableId, isActive);
    return sendSuccess(
      res,
      200,
      `QR code scanning ${isActive ? 'enabled' : 'disabled'} successfully`,
      table
    );
  });

  checkoutTable = asyncHandler(async (req, res) => {
    const { tableId } = req.params;
    const table = await TableService.checkoutTable(req.restaurantId, tableId);
    return sendSuccess(res, 200, 'Table checked out and vacant successfully', table);
  });

  // ==========================================
  // PUBLIC CUSTOMER ACTIONS
  // ==========================================

  processCustomerScan = asyncHandler(async (req, res) => {
    const catalog = await TableService.processCustomerScan(req.body);
    return sendSuccess(res, 200, 'Welcome to Menudot! Table session initialized.', catalog);
  });

  triggerServiceCall = asyncHandler(async (req, res) => {
    const { restaurantId, tableNumber, serviceType } = req.body;
    const socketManager = require('../../utils/socket');
    
    socketManager.sendServiceCallNotification(restaurantId, tableNumber, serviceType, {
      requestedAt: new Date(),
    });
    
    return sendSuccess(res, 200, `Requested ${serviceType} service successfully.`);
  });

  getCustomerOrder = asyncHandler(async (req, res) => {
    const { orderId } = req.params;
    const Order = require('../models/order.model');
    const order = await Order.findOne({ _id: orderId, isDeleted: false });
    if (!order) {
      const AppError = require('../../exceptions/AppError');
      throw new AppError(404, 'Order not found or has been removed.');
    }
    return sendSuccess(res, 200, 'Order retrieved successfully', order);
  });

  placeDineInOrder = asyncHandler(async (req, res) => {
    const order = await TableService.placeDineInOrder(req.body);
    return sendSuccess(res, 201, 'Dine-in order placed successfully via QR', order);
  });
}

module.exports = new TableController();
