const express = require('express');
const { body } = require('express-validator');
const watchlistController = require('../controllers/watchlistController');
const authenticate = require('../middleware/authenticate');
const { registerRoute } = require('../helpers/routeRegistry');

const router = express.Router();

/**
 * Validation rules
 */
const toggleStockValidation = [
  body('stockId')
    .notEmpty()
    .withMessage('Stock ID is required')
    .isString()
    .withMessage('Stock ID must be a string')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Stock ID cannot be empty'),
];

/**
 * Routes
 * All routes require authentication
 */
router.post('/', authenticate, toggleStockValidation, watchlistController.toggleStock);
registerRoute('POST', '/watchlist', 'Add or remove stock from watchlist (requires authentication)');

router.get('/', authenticate, watchlistController.getWatchlist);
registerRoute('GET', '/watchlist', 'Get user watchlist (requires authentication)');

router.get('/news', authenticate, watchlistController.getNews);
registerRoute('GET', '/watchlist/news', 'Get news for a stock by stockId (requires authentication, query param: stockId)');

module.exports = router;

