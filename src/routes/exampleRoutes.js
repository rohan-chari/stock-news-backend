const express = require('express');
const { body, param } = require('express-validator');
const exampleController = require('../controllers/exampleController');
const { registerRoute } = require('../helpers/routeRegistry');

const router = express.Router();

/**
 * Validation rules
 */
const idValidation = param('id').isLength({ min: 1 }).withMessage('ID is required');

const createValidation = [
  body('name').notEmpty().withMessage('Name is required'),
  body('description').optional().isString().withMessage('Description must be a string'),
];

/**
 * Routes
 */
router.get('/', exampleController.getAllExamples);
registerRoute('GET', '/examples', 'Get all examples');

router.get('/:id', idValidation, exampleController.getExampleById);
registerRoute('GET', '/examples/:id', 'Get example by ID');

router.post('/', createValidation, exampleController.createExample);
registerRoute('POST', '/examples', 'Create a new example');

module.exports = router;

