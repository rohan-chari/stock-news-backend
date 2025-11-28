/**
 * Response helper utilities
 * Provides standardized response formatting
 */

/**
 * Send success response
 * @param {Object} res - Express response object
 * @param {*} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code
 */
const sendSuccess = (res, data = null, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
  });
};

/**
 * Send error response
 * @param {Object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code
 */
const sendError = (res, message = 'Internal Server Error', statusCode = 500) => {
  res.status(statusCode).json({
    success: false,
    error: {
      message,
    },
  });
};

module.exports = {
  sendSuccess,
  sendError,
};

