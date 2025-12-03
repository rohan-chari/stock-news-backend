const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const config = require('./config');
const routes = require('./routes');
const errorHandler = require('./middleware/errorHandler');
const notFound = require('./middleware/notFound');
const logger = require('./middleware/logger');

/**
 * Initialize Express application
 */
const app = express();

/**
 * Security middleware
 */
app.use(helmet());

/**
 * CORS configuration
 */
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));

/**
 * Body parsing middleware
 */
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/**
 * Request logging
 */
app.use(logger);

/**
 * Static files - serve assets (logos, etc.)
 */
app.use('/assets', express.static(path.join(__dirname, 'assets')));

/**
 * API Routes
 */
app.use('/api', routes);

/**
 * Root endpoint
 */
app.get('/', (req, res) => {
  res.json({
    message: 'Welcome to Stock News Backend API',
    documentation: '/api/health',
  });
});

/**
 * 404 handler
 */
app.use(notFound);

/**
 * Error handling middleware (must be last)
 */
app.use(errorHandler);

/**
 * Start server
 */
const PORT = config.port;

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`Environment: ${config.nodeEnv}`);
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});

module.exports = app;

