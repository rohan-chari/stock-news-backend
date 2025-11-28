const { validationResult } = require('express-validator');

/**
 * Validation helper
 * Extracts validation errors from express-validator
 * @param {Object} req - Express request object
 * @returns {Object|null} - Validation errors or null
 */
const validateRequest = (req) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return {
      message: 'Validation failed',
      errors: errors.array(),
    };
  }
  return null;
};

module.exports = {
  validateRequest,
};

