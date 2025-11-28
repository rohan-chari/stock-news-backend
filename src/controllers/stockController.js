const stockService = require('../services/stockService');
const { sendSuccess, sendError } = require('../helpers/responseHelper');
const { validateRequest } = require('../helpers/validationHelper');

/**
 * Stock Controller
 * Handles HTTP requests and responses for stock operations
 * Delegates business logic to services
 */

/**
 * Search stocks
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const searchStocks = async (req, res, next) => {
  try {
    const validationError = validateRequest(req);
    if (validationError) {
      return sendError(res, validationError.message, 400);
    }

    const { q: query } = req.query;
    
    // TODO: Add validation for query parameter
    
    const data = await stockService.searchStocks(query);
    sendSuccess(res, data, 'Stocks retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  searchStocks,
};

