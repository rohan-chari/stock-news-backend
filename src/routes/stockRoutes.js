const express = require('express');
const { query } = require('express-validator');
const stockController = require('../controllers/stockController');
const { registerRoute } = require('../helpers/routeRegistry');

const router = express.Router();

/**
 * Validation rules
 */
const searchValidation = [
  query('q')
    .notEmpty()
    .withMessage('Query parameter (q) is required')
    .isString()
    .withMessage('Query parameter (q) must be a string')
    .trim()
    .isLength({ min: 1 })
    .withMessage('Query parameter (q) cannot be empty'),
];

/**
 * Routes
 */
router.get('/search', searchValidation, stockController.searchStocks);
registerRoute('GET', '/stocks/search', 'Search stocks by query parameter (q)');

module.exports = router;

