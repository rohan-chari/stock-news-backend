const authService = require('../services/authService');
const { sendSuccess, sendError } = require('../helpers/responseHelper');
const { validateRequest } = require('../helpers/validationHelper');

/**
 * Auth Controller
 * Handles HTTP requests and responses for authentication operations
 */

/**
 * Authenticate with Apple Sign-In
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @param {Function} next - Express next middleware
 */
const authenticateApple = async (req, res, next) => {
  try {
    // Log the full request body

    
    const validationError = validateRequest(req);
    if (validationError) {
      console.log('Validation errors:', JSON.stringify(validationError.errors, null, 2));
      return sendError(res, validationError.message, 400);
    }

    const { token, email, givenName, familyName } = req.body;
    


    // Verify Apple token and get/create user
    const user = await authService.verifyAppleAuth(token, email, givenName, familyName);

    // Generate our own JWT token
    const jwtToken = authService.generateToken(user);

    // Return success response with token and user info
    sendSuccess(res, {
      token: jwtToken,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    }, 'Authentication successful');
  } catch (error) {
    // Handle specific error types
    if (error.message === 'Missing Apple identity token' || error.message.includes('Invalid')) {
      return sendError(res, 'Invalid Apple token', 401);
    }
    next(error);
  }
};

module.exports = {
  authenticateApple,
};

