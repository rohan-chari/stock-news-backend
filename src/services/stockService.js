const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Stock Service
 * Contains business logic for stock operations
 * Services handle the core business logic, separate from HTTP concerns
 */

/**
 * Search stocks by query (database only)
 * @param {string} query - Search query
 * @returns {Promise<Object>} - Search results with logo URLs from database
 */
const searchStocks = async (query) => {
  if (!query) {
    return {
      query: '',
      results: [],
    };
  }

  const normalizedQuery = query.toUpperCase().trim();

  // Search database
  const dbStocks = await prisma.stock.findMany({
    where: {
      OR: [
        { symbol: { startsWith: normalizedQuery, mode: 'insensitive' } },
        { displaySymbol: { startsWith: normalizedQuery, mode: 'insensitive' } },
        { description: { contains: normalizedQuery, mode: 'insensitive' } },
      ],
    },
    take: 50, // Limit results
  });

  console.log(`Found ${dbStocks.length} stocks in database for query: ${normalizedQuery}`);

  // Map stocks to response format with logo URL from database
  const results = dbStocks.map(stock => ({
    id: stock.id,
    symbol: stock.symbol,
    displaySymbol: stock.displaySymbol,
    description: stock.description,
    type: stock.type,
    exchange: stock.exchange,
    logo: stock.logo, // Logo URL from DB (static path like /assets/stockLogos/AAPL.png)
    createdAt: stock.createdAt,
    updatedAt: stock.updatedAt,
  }));

  return {
    query: normalizedQuery,
    results,
  };
};

module.exports = {
  searchStocks,
};
