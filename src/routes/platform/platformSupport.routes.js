const express = require('express');
const router = express.Router();
const controller = require('../../controllers/platform/platformSupport.controller');

// Support Ticket Queue Endpoints
router.get('/tickets', controller.getTicketQueue);
router.post('/tickets', controller.createTicket);
router.get('/tickets/:id', controller.getTicketById);
router.patch('/tickets/:id/status', controller.updateTicketStatus);
router.patch('/tickets/:id/assign', controller.assignAgent);
router.post('/tickets/:id/messages', controller.sendTicketMessage);
router.post('/tickets/:id/refund', controller.moderateRefund);

// Knowledge Base FAQ Endpoints
router.get('/kb', controller.getKnowledgeBase);
router.post('/kb', controller.createKnowledgeArticle);

// Restaurant Health & Operational Diagnostics Endpoints
router.get('/restaurants/health', controller.getRestaurantHealthBoard);
router.get('/restaurants/:id/diagnostics', controller.getRestaurantDiagnostics);
router.post('/restaurants/:id/diagnostics/action', controller.runRestaurantDiagnosticAction);

// Dedicated Advertisement Support & Campaign Audit Endpoints
router.get('/ads/tickets', controller.getAdSupportTickets);
router.get('/ads/campaigns/:campaignId/context', controller.getAdCampaignContext);
router.post('/ads/campaigns/:campaignId/moderate', controller.moderateAdCampaign);
router.post('/ads/tickets/:ticketId/refund', controller.processAdWalletRefund);

module.exports = router;
