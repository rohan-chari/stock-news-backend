const morgan = require('morgan');

/**
 * HTTP request logger middleware
 * Uses morgan for logging HTTP requests
 */
const logger = morgan('combined');

module.exports = logger;

