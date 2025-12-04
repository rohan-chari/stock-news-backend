const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Watchlist Service
 * Contains business logic for watchlist operations
 */

/**
 * Clean company name by removing common suffixes
 * @param {string|null} companyName - Company name to clean
 * @returns {string|null} - Cleaned company name
 */
const cleanCompanyName = (companyName) => {
  if (!companyName) return companyName;

  // Common company suffixes to remove (case-insensitive)
  const suffixes = [
    'INC',
    'INC.',
    'LLC',
    'LLC.',
    'CORP',
    'CORP.',
    'CORPORATION',
    'LTD',
    'LTD.',
    'LIMITED',
    'CO',
    'CO.',
    'COMPANY',
    'LP',
    'LP.',
    'LLP',
    'LLP.',
    'PC',
    'PC.',
    'PLC',
    'PLC.',
  ];

  let cleaned = companyName.trim();

  // Remove each suffix if it appears at the end
  for (const suffix of suffixes) {
    const regex = new RegExp(`\\s+${suffix.replace('.', '\\.')}\\s*$`, 'i');
    cleaned = cleaned.replace(regex, '');
  }

  return cleaned.trim() || companyName; // Return original if cleaning results in empty string
};

/**
 * Add or remove stock from user's watchlist (toggle behavior)
 * If stock exists in watchlist, remove it. If not, add it.
 * @param {string} userId - User ID
 * @param {string} stockId - Stock ID
 * @returns {Promise<Object>} - Object with action ('added' or 'removed') and stock info
 */
const addOrRemoveStock = async (userId, stockId) => {
  // Verify stock exists
  const stock = await prisma.stock.findUnique({
    where: { id: stockId },
  });

  if (!stock) {
    throw new Error('Stock not found');
  }

  // Check if stock is already in watchlist
  const existingWatchlistItem = await prisma.userStock.findUnique({
    where: {
      userId_stockId: {
        userId,
        stockId,
      },
    },
  });

  if (existingWatchlistItem) {
    // Remove from watchlist
    await prisma.userStock.delete({
      where: {
        userId_stockId: {
          userId,
          stockId,
        },
      },
    });

    return {
      action: 'removed',
      stock: {
        id: stock.id,
        symbol: stock.symbol,
        displaySymbol: stock.displaySymbol,
        description: stock.description,
        type: stock.type,
        exchange: stock.exchange,
        logo: stock.logo,
      },
    };
  } else {
    // Add to watchlist
    await prisma.userStock.create({
      data: {
        userId,
        stockId,
      },
    });

    return {
      action: 'added',
      stock: {
        id: stock.id,
        symbol: stock.symbol,
        displaySymbol: stock.displaySymbol,
        description: stock.description,
        type: stock.type,
        exchange: stock.exchange,
        logo: stock.logo,
      },
    };
  }
};

/**
 * Get user's watchlist with full stock details
 * @param {string} userId - User ID
 * @returns {Promise<Object>} - Watchlist with stock IDs and full stock details
 */
const getUserWatchlist = async (userId) => {
  const watchlistItems = await prisma.userStock.findMany({
    where: { userId },
    include: {
      stock: true,
    },
    orderBy: {
      stock: {
        description: 'asc', // Alphabetical order by company name
      },
    },
  });

  // Extract stock IDs
  const stockIds = watchlistItems.map(item => item.stockId);

  // Map to response format with full stock details
  const stocks = watchlistItems.map(item => ({
    id: item.stock.id,
    symbol: item.stock.symbol,
    displaySymbol: item.stock.displaySymbol,
    description: cleanCompanyName(item.stock.description), // Clean company name
    type: item.stock.type,
    exchange: item.stock.exchange,
    logo: item.stock.logo,
    createdAt: item.stock.createdAt,
    updatedAt: item.stock.updatedAt,
    addedToWatchlistAt: item.createdAt, // When user added this stock
  }));

  return {
    stockIds,
    stocks,
  };
};

module.exports = {
  addOrRemoveStock,
  getUserWatchlist,
};

