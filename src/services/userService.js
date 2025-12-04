const { PrismaClient } = require('@prisma/client');

// Prisma 7: Client will use DATABASE_URL from environment variables
// If you need to pass it explicitly, use: new PrismaClient({ datasourceUrl: process.env.DATABASE_URL })
const prisma = new PrismaClient();

/**
 * User Service
 * Contains business logic for user operations
 */

/**
 * Find or create a user by OAuth provider
 * @param {string} provider - OAuth provider name ('apple', 'google', etc.)
 * @param {string} providerId - Unique ID from the OAuth provider
 * @param {Object} userData - User data from OAuth provider
 * @param {string} userData.email - User email
 * @param {string} userData.name - User name
 * @returns {Promise<Object>} - User object
 */
const findOrCreateUserByProvider = async (provider, providerId, userData = {}) => {
  const { email, name } = userData;

  // First, try to find existing user provider
  let userProvider = await prisma.userProvider.findUnique({
    where: {
      provider_providerId: {
        provider,
        providerId,
      },
    },
    include: {
      user: true,
    },
  });

  if (userProvider) {
    // User provider exists, return the user
    return userProvider.user;
  }

  // User provider doesn't exist, check if user exists by email
  let user = null;
  if (email) {
    user = await prisma.user.findUnique({
      where: { email },
    });
  }

  if (user) {
    // User exists with this email, create a new provider link
    userProvider = await prisma.userProvider.create({
      data: {
        userId: user.id,
        provider,
        providerId,
        email: email || null,
      },
      include: {
        user: true,
      },
    });

    // Update user name if provided and not already set
    if (name && !user.name) {
      user = await prisma.user.update({
        where: { id: user.id },
        data: { name },
      });
    }

    return user;
  }

  // Create new user and provider
  const newUser = await prisma.user.create({
    data: {
      email: email || null,
      name: name || null,
      providers: {
        create: {
          provider,
          providerId,
          email: email || null,
        },
      },
    },
  });

  return newUser;
};

/**
 * Find user by ID
 * @param {string} userId - User ID
 * @returns {Promise<Object|null>} - User object or null
 */
const findUserById = async (userId) => {
  return await prisma.user.findUnique({
    where: { id: userId },
    include: {
      providers: true,
    },
  });
};

/**
 * Update user information
 * @param {string} userId - User ID
 * @param {Object} data - Data to update
 * @returns {Promise<Object>} - Updated user object
 */
const updateUser = async (userId, data) => {
  return await prisma.user.update({
    where: { id: userId },
    data,
  });
};

module.exports = {
  findOrCreateUserByProvider,
  findUserById,
  updateUser,
  prisma, // Export prisma client for advanced queries if needed
};

