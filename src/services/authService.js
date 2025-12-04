const jwt = require('jsonwebtoken');
const config = require('../config');
const verifyAppleToken = require('../helpers/verifyAppleToken');
const userService = require('./userService');

/**
 * Auth Service
 * Contains business logic for authentication operations
 */

/**
 * Verify Apple identity token and extract user info
 * @param {string} token - Apple identity token
 * @param {string} email - User email (optional, may not be provided on subsequent logins)
 * @param {string} givenName - User's first name (optional)
 * @param {string} familyName - User's last name (optional)
 * @returns {Promise<Object>} - User information and Apple subject ID
 */
const verifyAppleAuth = async (token, email, givenName, familyName) => {
  if (!token) {
    throw new Error('Missing Apple identity token');
  }

  // Verify the Apple token
  const applePayload = await verifyAppleToken(token);
  const appleSub = applePayload.sub; // Apple user ID (unique per app)

  // Find or create user by Apple provider
  const user = await userService.findOrCreateUserByProvider(
    'apple',
    appleSub,
    {
      email: email ?? null,
      name: `${givenName ?? ''} ${familyName ?? ''}`.trim() || null,
    }
  );

  return user;
};

/**
 * Generate JWT token for authenticated user
 * @param {Object} user - User object with id property
 * @returns {string} - JWT token
 */
const generateToken = (user) => {
  return jwt.sign(
    { userId: user.id },
    config.jwtSecret,
    { expiresIn: '30d' }
  );
};

module.exports = {
  verifyAppleAuth,
  generateToken,
};

