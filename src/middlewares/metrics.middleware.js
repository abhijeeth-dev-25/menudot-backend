// In-memory Prometheus metric counters & histograms
const metricsState = {
  totalRequests: 0,
  requestsByMethodStatus: {},
  requestDurations: [],
  activeConnections: 0,
};

/**
 * Middleware collecting HTTP metrics for Prometheus scraping.
 */
function metricsMiddleware(req, res, next) {
  const startTime = Date.now();
  metricsState.totalRequests += 1;
  metricsState.activeConnections += 1;

  res.on('finish', () => {
    metricsState.activeConnections = Math.max(0, metricsState.activeConnections - 1);
    const durationMs = Date.now() - startTime;
    const durationSeconds = durationMs / 1000;

    // Track status code counts
    const key = `${req.method}_${res.statusCode}`;
    metricsState.requestsByMethodStatus[key] = (metricsState.requestsByMethodStatus[key] || 0) + 1;

    // Keep rolling sample of request durations (max 1000 samples)
    metricsState.requestDurations.push(durationSeconds);
    if (metricsState.requestDurations.length > 1000) {
      metricsState.requestDurations.shift();
    }
  });

  next();
}

/**
 * Formats metrics in official Prometheus plain text format.
 */
function getPrometheusMetrics() {
  const lines = [
    '# HELP http_requests_total Total number of HTTP requests processed',
    '# TYPE http_requests_total counter',
    `http_requests_total ${metricsState.totalRequests}`,
    '',
    '# HELP http_requests_by_status Total HTTP requests by method and status',
    '# TYPE http_requests_by_status counter',
  ];

  for (const [key, count] of Object.entries(metricsState.requestsByMethodStatus)) {
    const [method, status] = key.split('_');
    lines.push(`http_requests_by_status{method="${method}",status="${status}"} ${count}`);
  }

  // Calculate average latency
  const sum = metricsState.requestDurations.reduce((a, b) => a + b, 0);
  const count = metricsState.requestDurations.length;
  const avgDuration = count > 0 ? (sum / count).toFixed(4) : 0;

  lines.push('');
  lines.push('# HELP http_request_duration_seconds_avg Average HTTP request duration');
  lines.push('# TYPE http_request_duration_seconds_avg gauge');
  lines.push(`http_request_duration_seconds_avg ${avgDuration}`);

  lines.push('');
  lines.push('# HELP active_connections Active HTTP connections');
  lines.push('# TYPE active_connections gauge');
  lines.push(`active_connections ${metricsState.activeConnections}`);

  return lines.join('\n');
}

module.exports = {
  metricsMiddleware,
  getPrometheusMetrics,
};
