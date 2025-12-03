const express = require('express');
const { body } = require('express-validator');
const authController = require('../controllers/authController');
const { registerRoute } = require('../helpers/routeRegistry');

const router = express.Router();

/**
 * Validation rules for Apple authentication
 */
const appleAuthValidation = [
  body('token')
    .notEmpty()
    .withMessage('Apple identity token is required')
    .isString()
    .withMessage('Token must be a string'),
  body('email')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined) return true;
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    })
    .withMessage('Email must be a valid email address'),
  body('givenName')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined) return true;
      return typeof value === 'string';
    })
    .withMessage('Given name must be a string'),
  body('familyName')
    .optional({ nullable: true })
    .custom((value) => {
      if (value === null || value === undefined) return true;
      return typeof value === 'string';
    })
    .withMessage('Family name must be a string'),
];

/**
 * Routes
 */
router.post('/apple', appleAuthValidation, authController.authenticateApple);
registerRoute('POST', '/auth/apple', 'Authenticate with Apple Sign-In');

module.exports = router;

