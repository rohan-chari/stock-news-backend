const express = require('express');
const exampleRoutes = require('./exampleRoutes');
const stockRoutes = require('./stockRoutes');
const { getAllRoutes, registerRoute } = require('../helpers/routeRegistry');

const router = express.Router();

/**
 * API Routes
 * All routes are prefixed with /api
 */
router.use('/examples', exampleRoutes);
router.use('/stocks', stockRoutes);

/**
 * Health check endpoint
 * Returns server status and all available routes
 */
router.get('/health', (req, res) => {
  const baseUrl = `${req.protocol}://${req.get('host')}`;
  const apiBase = '/api';
  
  res.json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    baseUrl: `${baseUrl}${apiBase}`,
    routes: getAllRoutes().map(route => ({
      method: route.method,
      path: `${apiBase}${route.path}`,
      fullPath: `${baseUrl}${apiBase}${route.path}`,
      description: route.description,
    })),
  });
});

// Register health endpoint
registerRoute('GET', '/health', 'Health check endpoint');

module.exports = router;

