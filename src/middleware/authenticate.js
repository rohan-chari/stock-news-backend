const jwt = require('jsonwebtoken');
const config = require('../config');
const { sendError } = require('../helpers/responseHelper');

/**
 * Authentication middleware
 * Verifies JWT token and attaches user ID to request object
 */
const authenticate = (req, res, next) => {
  try {
    // Get token from Authorization header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return sendError(res, 'Authentication required. Please provide a valid token.', 401);
    }

    // Extract token
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = jwt.verify(token, config.jwtSecret);

    // Attach user ID to request object
    req.userId = decoded.userId;

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return sendError(res, 'Invalid token.', 401);
    }
    if (error.name === 'TokenExpiredError') {
      return sendError(res, 'Token has expired.', 401);
    }
    next(error);
  }
};

module.exports = authenticate;

