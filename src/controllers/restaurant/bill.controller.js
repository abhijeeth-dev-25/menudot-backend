const BillService = require('../../services/restaurant/bill.service');
const { sendSuccess } = require('../../utils/response');
const asyncHandler = require('../../utils/asyncHandler');

class BillController {
  /**
   * Generates or updates an unpaid bill for a table.
   * POST /api/v1/bills/table/:tableId/generate
   */
  generateTableBill = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const { tableId } = req.params;
    const staffUserId = req.user?._id || null;

    const bill = await BillService.generateBillForTable(restaurantId, tableId, staffUserId);
    return sendSuccess(res, 201, 'Bill generated successfully with payment QR code', bill);
  });

  generateTableBillPublic = asyncHandler(async (req, res) => {
    const { code } = req.body;
    const TableRepository = require('../../repositories/restaurant/table.repository');
    const AppError = require('../../exceptions/AppError');

    const table = await TableRepository.findByQrCode(code);
    if (!table) {
      throw new AppError(404, 'Table not found or invalid QR code.');
    }

    const bill = await BillService.generateBillForTable(table.restaurantId.toString(), table._id.toString(), null);
    return sendSuccess(res, 201, 'Bill generated successfully for table', bill);
  });

  /**
   * Settles a bill (full or split payment) via offline or online channel.
   * POST /api/v1/bills/:billId/settle
   */
  settleBill = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const { billId } = req.params;
    const staffUserId = req.user?._id || null;

    const settledBill = await BillService.settleBill(restaurantId, billId, req.body, staffUserId);
    return sendSuccess(res, 200, 'Bill settled and table checked out successfully', settledBill);
  });

  /**
   * Retrieves thermal printable receipt HTML or ESC/POS payload.
   * GET /api/v1/bills/:id/print
   */
  getPrintableReceipt = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const { id } = req.params;
    const { format } = req.query;

    const result = await BillService.getPrintableReceipt(restaurantId, id, format);

    if (format === 'html' || !format) {
      res.setHeader('Content-Type', 'text/html');
      return res.status(200).send(result.html);
    }

    return sendSuccess(res, 200, 'Printable receipt data retrieved', result);
  });

  /**
   * Retrieves active unpaid bills stream and today's settlement summary.
   * GET /api/v1/bills/live
   */
  getLiveBills = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const result = await BillService.getLiveBills(restaurantId);
    return sendSuccess(res, 200, 'Live bills and daily summary retrieved successfully', result);
  });

  /**
   * Retrieves paginated historical bills based on filters.
   * GET /api/v1/bills/history
   */
  getBillHistory = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const result = await BillService.getBillHistory(restaurantId, req.query);
    return sendSuccess(res, 200, 'Bill history retrieved successfully', result);
  });

  /**
   * Retrieves single bill details by ID.
   * GET /api/v1/bills/:id
   */
  getBillDetails = asyncHandler(async (req, res) => {
    const restaurantId = req.restaurantId;
    const { id } = req.params;

    const bill = await BillService.getBillDetails(restaurantId, id);
    return sendSuccess(res, 200, 'Bill details retrieved successfully', bill);
  });
}

module.exports = new BillController();
