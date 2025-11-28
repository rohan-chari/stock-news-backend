const exampleService = require('../services/exampleService');
const { sendSuccess, sendError } = require('../helpers/responseHelper');
const { validateRequest } = require('../helpers/validationHelper');

/**
 * Example Controller
 * Handles HTTP requests and responses
 * Delegates business logic to services
 */

/**
 * Get example by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const getExampleById = async (req, res, next) => {
  try {
    const validationError = validateRequest(req);
    if (validationError) {
      return sendError(res, validationError.message, 400);
    }

    const { id } = req.params;
    const data = await exampleService.getExampleById(id);

    if (!data) {
      return sendError(res, 'Example not found', 404);
    }

    sendSuccess(res, data, 'Example retrieved successfully');
  } catch (error) {
    next(error);
  }
};

/**
 * Create example
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const createExample = async (req, res, next) => {
  try {
    const validationError = validateRequest(req);
    if (validationError) {
      return sendError(res, validationError.message, 400);
    }

    const data = await exampleService.createExample(req.body);
    sendSuccess(res, data, 'Example created successfully', 201);
  } catch (error) {
    next(error);
  }
};

/**
 * Get all examples
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const getAllExamples = async (req, res, next) => {
  try {
    // Example: Get all items
    const data = [];
    sendSuccess(res, data, 'Examples retrieved successfully');
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getExampleById,
  createExample,
  getAllExamples,
};

