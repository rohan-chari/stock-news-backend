const watchlistService = require('../services/watchlistService');
const { sendSuccess, sendError } = require('../helpers/responseHelper');
const { validateRequest } = require('../helpers/validationHelper');

/**
 * Watchlist Controller
 * Handles HTTP requests and responses for watchlist operations
 * Delegates business logic to services
 */

/**
 * Add or remove stock from watchlist (toggle)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const toggleStock = async (req, res, next) => {
  try {
    const validationError = validateRequest(req);
    if (validationError) {
      return sendError(res, validationError.message, 400);
    }

    const { stockId } = req.body;
    const userId = req.userId; // From authenticate middleware

    if (!stockId) {
      return sendError(res, 'Stock ID is required', 400);
    }

    const result = await watchlistService.addOrRemoveStock(userId, stockId);
    
    const message = result.action === 'added' 
      ? 'Stock added to watchlist successfully' 
      : 'Stock removed from watchlist successfully';
    
    sendSuccess(res, result, message);
  } catch (error) {
    if (error.message === 'Stock not found') {
      return sendError(res, error.message, 404);
    }
    next(error);
  }
};

/**
 * Get user's watchlist
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const getWatchlist = async (req, res, next) => {
  try {
    const userId = req.userId; // From authenticate middleware

    const data = await watchlistService.getUserWatchlist(userId);
    sendSuccess(res, data, 'Watchlist retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  toggleStock,
  getWatchlist,
};

