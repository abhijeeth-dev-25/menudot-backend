const SupportTicket = require('../../models/supportTicket.model');
const SupportMessage = require('../../models/supportMessage.model');
const SupportKnowledgeBase = require('../../models/supportKnowledgeBase.model');
const { sendSuccess } = require('../../utils/response');
const AppError = require('../../exceptions/AppError');

/**
 * Get ticket queue for platform admin with filtering and pagination
 */
exports.getTicketQueue = async (req, res, next) => {
  try {
    const { status, priority, category, requesterType, search } = req.query;
    const filter = {};

    if (status && status !== 'all') filter.status = status;
    if (priority && priority !== 'all') filter.priority = priority;
    if (category && category !== 'all') filter.category = category;
    if (requesterType && requesterType !== 'all') filter.requesterType = requesterType;

    if (search) {
      filter.$or = [
        { ticketNumber: { $regex: search, $options: 'i' } },
        { subject: { $regex: search, $options: 'i' } },
        { requesterName: { $regex: search, $options: 'i' } },
        { requesterEmail: { $regex: search, $options: 'i' } },
      ];
    }

    const tickets = await SupportTicket.find(filter)
      .sort({ updatedAt: -1 })
      .limit(100);

    return sendSuccess(res, 200, 'Support tickets fetched successfully', tickets);
  } catch (error) {
    next(error);
  }
};

/**
 * Get single ticket details and conversation thread
 */
exports.getTicketById = async (req, res, next) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('restaurantId', 'name slug location')
      .populate('orderId', 'orderNumber grandTotal status');

    if (!ticket) {
      throw new AppError(404, 'Support ticket not found');
    }

    const messages = await SupportMessage.find({ ticketId: ticket._id }).sort({ createdAt: 1 });

    return sendSuccess(res, 200, 'Ticket details retrieved', {
      ticket,
      messages,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Update ticket status or SLA metadata
 */
exports.updateTicketStatus = async (req, res, next) => {
  try {
    const { status, priority, resolutionNotes } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      throw new AppError(404, 'Support ticket not found');
    }

    if (status) ticket.status = status;
    if (priority) ticket.priority = priority;
    if (resolutionNotes) ticket.resolutionNotes = resolutionNotes;

    if (status === 'resolved') {
      ticket.resolvedAt = new Date();
    } else if (status === 'closed') {
      ticket.closedAt = new Date();
    }

    await ticket.save();

    // Create system audit message
    await SupportMessage.create({
      ticketId: ticket._id,
      senderType: 'system',
      senderName: 'System Auditor',
      content: `Ticket status updated to [${ticket.status.toUpperCase()}]. Priority: [${ticket.priority.toUpperCase()}].`,
    });

    return sendSuccess(res, 200, 'Ticket status updated successfully', ticket);
  } catch (error) {
    next(error);
  }
};

/**
 * Assign agent to ticket
 */
exports.assignAgent = async (req, res, next) => {
  try {
    const { agentId, agentName } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      throw new AppError(404, 'Support ticket not found');
    }

    ticket.assignedAgentId = agentId || req.user?._id;
    ticket.assignedAgentName = agentName || req.user?.fullName || 'Platform Agent';
    if (ticket.status === 'open') {
      ticket.status = 'assigned';
    }

    await ticket.save();

    await SupportMessage.create({
      ticketId: ticket._id,
      senderType: 'system',
      senderName: 'System Auditor',
      content: `Ticket assigned to agent [${ticket.assignedAgentName}].`,
    });

    return sendSuccess(res, 200, 'Agent assigned to ticket', ticket);
  } catch (error) {
    next(error);
  }
};

/**
 * Post response message or internal note to ticket
 */
exports.sendTicketMessage = async (req, res, next) => {
  try {
    const { content, isInternalNote, attachments } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      throw new AppError(404, 'Support ticket not found');
    }

    const message = await SupportMessage.create({
      ticketId: ticket._id,
      senderType: 'agent',
      senderId: req.user?._id,
      senderName: req.user?.fullName || 'Platform Support Agent',
      content,
      isInternalNote: !!isInternalNote,
      attachments: attachments || [],
    });

    if (!isInternalNote && (ticket.status === 'open' || ticket.status === 'assigned')) {
      ticket.status = 'in_progress';
      await ticket.save();
    }

    return sendSuccess(res, 201, 'Message posted to ticket', message);
  } catch (error) {
    next(error);
  }
};

/**
 * Approve or Reject Refund Request
 */
exports.moderateRefund = async (req, res, next) => {
  try {
    const { action, approvedAmount, reason } = req.body;
    const ticket = await SupportTicket.findById(req.params.id);

    if (!ticket) {
      throw new AppError(404, 'Support ticket not found');
    }

    if (!ticket.refundDetails) {
      ticket.refundDetails = {};
    }

    if (action === 'approve') {
      ticket.refundDetails.status = 'approved';
      ticket.refundDetails.approvedAmount = approvedAmount || ticket.refundDetails.requestedAmount;
      ticket.refundDetails.reason = reason || 'Approved by platform support manager';
      ticket.status = 'resolved';
    } else {
      ticket.refundDetails.status = 'rejected';
      ticket.refundDetails.reason = reason || 'Refund criteria not met';
    }

    await ticket.save();

    await SupportMessage.create({
      ticketId: ticket._id,
      senderType: 'system',
      senderName: 'Financial Disbursal Bot',
      content: `Refund Request ${action.toUpperCase()}: ₹${ticket.refundDetails.approvedAmount || 0} (${ticket.refundDetails.reason})`,
    });

    return sendSuccess(res, 200, `Refund ${action}d successfully`, ticket);
  } catch (error) {
    next(error);
  }
};

/**
 * Create new Customer / Partner Ticket
 */
exports.createTicket = async (req, res, next) => {
  try {
    const {
      requesterType,
      requesterName,
      requesterEmail,
      requesterMobile,
      restaurantId,
      orderId,
      category,
      priority,
      subject,
      description,
      refundRequestedAmount,
    } = req.body;

    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const ticketNumber = `TKT-${new Date().getFullYear()}-${randomSuffix}`;

    const slaDueDate = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24hr SLA

    const ticket = await SupportTicket.create({
      ticketNumber,
      requesterType: requesterType || 'customer',
      requesterId: req.user?._id || null,
      requesterName: requesterName || req.user?.fullName || 'Anonymous',
      requesterEmail: requesterEmail || req.user?.email || 'user@menudot.com',
      requesterMobile: requesterMobile || req.user?.mobile || '',
      restaurantId: restaurantId || null,
      orderId: orderId || null,
      category: category || 'general',
      priority: priority || 'medium',
      subject,
      description,
      slaDueDate,
      refundDetails: refundRequestedAmount
        ? { requestedAmount: refundRequestedAmount, status: 'pending' }
        : { status: 'none' },
    });

    await SupportMessage.create({
      ticketId: ticket._id,
      senderType: requesterType === 'customer' ? 'customer' : 'partner',
      senderId: req.user?._id || null,
      senderName: ticket.requesterName,
      content: description,
    });

    return sendSuccess(res, 201, 'Support ticket submitted successfully', ticket);
  } catch (error) {
    next(error);
  }
};

/**
 * Knowledge Base (FAQ)
 */
exports.getKnowledgeBase = async (req, res, next) => {
  try {
    const { category, audience } = req.query;
    const filter = {};

    if (category) filter.category = category;
    if (audience) filter.targetAudience = { $in: [audience, 'both'] };

    const articles = await SupportKnowledgeBase.find(filter).sort({ viewsCount: -1 });
    return sendSuccess(res, 200, 'Knowledge base articles fetched', articles);
  } catch (error) {
    next(error);
  }
};

exports.createKnowledgeArticle = async (req, res, next) => {
  try {
    const article = await SupportKnowledgeBase.create(req.body);
    return sendSuccess(res, 201, 'Article created successfully', article);
  } catch (error) {
    next(error);
  }
};

/**
 * Restaurant Health & Operational Diagnostics Control Center
 */
const RestaurantHealthService = require('../../services/restaurantHealth.service');

exports.getRestaurantHealthBoard = async (req, res, next) => {
  try {
    const healthBoard = await RestaurantHealthService.getAllRestaurantsHealth();
    return sendSuccess(res, 200, 'Restaurant health summary board fetched', healthBoard);
  } catch (error) {
    next(error);
  }
};

exports.getRestaurantDiagnostics = async (req, res, next) => {
  try {
    const diagnosticFile = await RestaurantHealthService.getRestaurantDiagnosticFile(req.params.id);
    if (!diagnosticFile) {
      throw new AppError(404, 'Restaurant diagnostic record not found');
    }
    return sendSuccess(res, 200, 'Restaurant diagnostic file fetched', diagnosticFile);
  } catch (error) {
    next(error);
  }
};

exports.runRestaurantDiagnosticAction = async (req, res, next) => {
  try {
    const { actionType } = req.body;
    const result = await RestaurantHealthService.runDiagnosticAction(req.params.id, actionType);
    return sendSuccess(res, 200, 'Diagnostic action executed', result);
  } catch (error) {
    next(error);
  }
};

/**
 * Dedicated Advertisement Support & Campaign Moderation Controller
 */
const AdSupportService = require('../../services/adSupport.service');

exports.getAdSupportTickets = async (req, res, next) => {
  try {
    const filter = {
      category: { $in: ['ad_campaign_approval', 'ad_payment_billing', 'ad_budget_refund', 'ad_coupon_promotion', 'ad_technical_performance'] },
    };
    if (req.query.status) filter.status = req.query.status;

    const tickets = await SupportTicket.find(filter).sort({ createdAt: -1 });
    return sendSuccess(res, 200, 'Ad support tickets fetched', tickets);
  } catch (error) {
    next(error);
  }
};

exports.getAdCampaignContext = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const { ticketId } = req.query;
    const context = await AdSupportService.compileAdCampaignContext(campaignId, ticketId);
    return sendSuccess(res, 200, 'Ad campaign case file compiled', context);
  } catch (error) {
    next(error);
  }
};

exports.moderateAdCampaign = async (req, res, next) => {
  try {
    const { campaignId } = req.params;
    const { action, rejectionReason } = req.body;
    const result = await AdSupportService.moderateAdCampaign(campaignId, action, rejectionReason);
    return sendSuccess(res, 200, `Ad campaign ${action}d successfully`, result);
  } catch (error) {
    next(error);
  }
};

exports.processAdWalletRefund = async (req, res, next) => {
  try {
    const { ticketId } = req.params;
    const { refundAmount, creditType } = req.body;
    const result = await AdSupportService.processAdWalletRefund(ticketId, refundAmount, creditType);
    return sendSuccess(res, 200, 'Ad wallet refund processed successfully', result);
  } catch (error) {
    next(error);
  }
};


