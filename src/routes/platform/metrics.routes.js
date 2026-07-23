const express = require('express');
const { getPrometheusMetrics } = require('../../middlewares/metrics.middleware');

const router = express.Router();

/**
 * Public/Internal Prometheus metrics scraping endpoint.
 * GET /metrics
 */
router.get('/', (req, res) => {
  res.setHeader('Content-Type', 'text/plain; version=0.0.4');
  return res.status(200).send(getPrometheusMetrics());
});

module.exports = router;
