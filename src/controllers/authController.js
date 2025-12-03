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
    console.log('=== Apple Auth Request Received ===');
    console.log('Full request body:', JSON.stringify(req.body, null, 2));
    console.log('Request headers:', JSON.stringify(req.headers, null, 2));
    
    const validationError = validateRequest(req);
    if (validationError) {
      console.log('Validation errors:', JSON.stringify(validationError.errors, null, 2));
      return sendError(res, validationError.message, 400);
    }

    const { token, email, givenName, familyName } = req.body;
    
    // Log extracted fields
    console.log('Extracted fields:');
    console.log('  - token:', token ? `${token.substring(0, 50)}...` : 'undefined');
    console.log('  - email:', email || 'undefined');
    console.log('  - givenName:', givenName || 'undefined');
    console.log('  - familyName:', familyName || 'undefined');
    console.log('===================================');

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

