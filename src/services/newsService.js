const { PrismaClient } = require('@prisma/client');
const https = require('https');
const { URL } = require('url');
const config = require('../config');

const prisma = new PrismaClient();

/**
 * Fetch company news from Finnhub API using REST API
 */
const fetchCompanyNews = (symbol, from, to) => {
  return new Promise((resolve, reject) => {
    const apiKey = config.finnhubApiKey;
    const apiUrl = new URL('https://finnhub.io/api/v1/company-news');
    apiUrl.searchParams.append('symbol', symbol.toUpperCase());
    apiUrl.searchParams.append('from', from);
    apiUrl.searchParams.append('to', to);
    apiUrl.searchParams.append('token', apiKey);

    https.get(apiUrl.toString(), (res) => {
      let data = '';

      // A chunk of data has been received
      res.on('data', (chunk) => {
        data += chunk;
      });

      // The whole response has been received
      res.on('end', () => {
        try {
          if (res.statusCode !== 200) {
            reject(new Error(`Finnhub API returned status ${res.statusCode}: ${data}`));
            return;
          }

          const newsData = JSON.parse(data);
          resolve(newsData);
        } catch (error) {
          reject(new Error(`Error parsing Finnhub API response: ${error.message}`));
        }
      });
    }).on('error', (error) => {
      reject(new Error(`Error fetching from Finnhub API: ${error.message}`));
    });
  });
};


/**
 * Get date strings for current day only (for cron job)
 */
const getCurrentDayRange = () => {
  const today = new Date();
  const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
  
  return {
    from: dateStr,
    to: dateStr,
  };
};

/**
 * Delay helper for rate limiting
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise<void>}
 */
const delay = (ms) => {
  return new Promise(resolve => setTimeout(resolve, ms));
};

/**
 * Get news for a stock from database (no API calls)
 * @param {string} stockId - Stock ID (UUID)
 * @returns {Promise<Array>} - Array of news articles from database
 */
const getNewsForStock = async (stockId) => {
  // Verify stock exists
  const stock = await prisma.stock.findUnique({
    where: { id: stockId },
  });
  
  if (!stock) {
    throw new Error('Stock not found');
  }
  
  // Return news for this stock from database
  return await prisma.news.findMany({
    where: {
      stockId: stock.id,
    },
    orderBy: {
      datetime: 'desc',
    },
    take: 10, // Limit to 10 most recent articles
  });
};

/**
 * Get news for all stocks in a user's watchlist from database (no API calls)
 * @param {string} userId - User ID
 * @returns {Promise<Array>} - Array of news articles with stock information, sorted by datetime (newest first)
 */
const getNewsForUserStocks = async (userId) => {
  // Get user's watchlist stocks
  const watchlistItems = await prisma.userStock.findMany({
    where: { userId },
    include: {
      stock: true,
    },
  });

  if (watchlistItems.length === 0) {
    return [];
  }

  // Get all stock IDs from watchlist
  const stockIds = watchlistItems.map(item => item.stockId);

  // Fetch all news for these stocks from database
  const allNews = await prisma.news.findMany({
    where: {
      stockId: {
        in: stockIds,
      },
    },
    orderBy: {
      datetime: 'desc',
    },
    take: 100, // Limit total results
  });

  // Create a map of stockId to stock info for quick lookup
  const stockMap = new Map();
  watchlistItems.forEach(item => {
    stockMap.set(item.stockId, item.stock);
  });

  // Add stock information to each article and sort
  const newsWithStock = allNews.map(article => {
    const stock = stockMap.get(article.stockId);
    return {
      ...article,
      stock: stock ? {
        id: stock.id,
        symbol: stock.symbol,
        displaySymbol: stock.displaySymbol,
        description: stock.description,
        type: stock.type,
        exchange: stock.exchange,
        logo: stock.logo,
      } : null,
    };
  });

  // Sort all news by publish date (datetime) - newest first
  newsWithStock.sort((a, b) => {
    const dateA = new Date(a.datetime);
    const dateB = new Date(b.datetime);
    return dateB - dateA; // Negative if B is newer (B comes first)
  });

  return newsWithStock;
};

/**
 * Check if article is relevant to the stock
 * Article is relevant if headline or summary contains company name or ticker
 * @param {Object} article - News article from Finnhub
 * @param {Object} stock - Stock object with symbol and description
 * @returns {boolean} - True if article is relevant
 */
const isArticleRelevant = (article, stock) => {
  const headline = (article.headline || '').toLowerCase();
  const summary = (article.summary || '').toLowerCase();
  const ticker = (stock.symbol || '').toLowerCase();
  const companyName = (stock.description || '').toLowerCase();
  
  // Check if headline or summary contains ticker (using word boundaries for better matching)
  // For tickers, we want to match whole words to avoid false positives (e.g., "A" matching "Apple")
  if (ticker) {
    // Use word boundary regex for ticker matching
    const tickerRegex = new RegExp(`\\b${ticker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (tickerRegex.test(headline) || tickerRegex.test(summary)) {
      return true;
    }
  }
  
  // Extract main company name (remove common suffixes like "INC", "CORP", etc.)
  const companyNameWords = companyName
    .replace(/\b(inc|corp|corporation|ltd|limited|llc|co|company)\b/gi, '')
    .trim()
    .split(/\s+/)
    .filter(word => word.length > 2); // Filter out short words
  
  // Check if headline or summary contains any significant word from company name
  if (companyNameWords.length > 0) {
    const hasCompanyName = companyNameWords.some(word => 
      headline.includes(word) || summary.includes(word)
    );
    if (hasCompanyName) {
      return true;
    }
  }
  
  return false;
};

/**
 * Fetch and save news for a single stock (for cron job)
 * Only fetches current day news and filters by relevance
 * @param {Object} stock - Stock object
 * @returns {Promise<number>} - Number of articles saved
 */
const fetchAndSaveNewsForStock = async (stock) => {
  try {
    // Fetch news from Finnhub for current day only
    const { from, to } = getCurrentDayRange();
    const newsData = await fetchCompanyNews(stock.symbol.toUpperCase(), from, to);
    
    if (!newsData || !Array.isArray(newsData)) {
      return 0;
    }
    
    // Filter articles by relevance
    const relevantArticles = newsData.filter(article => 
      isArticleRelevant(article, stock)
    );
    
    if (relevantArticles.length === 0) {
      return 0;
    }
    
    // Save relevant news articles
    let newCount = 0;
    let updatedCount = 0;
    
    for (const article of relevantArticles) {
      try {
        // Check if article already exists
        const existing = await prisma.news.findUnique({
          where: { finnhubId: article.id },
        });
        
        // Convert Unix timestamp (seconds) to JavaScript Date
        const articleDate = article.datetime 
          ? new Date(article.datetime * 1000) 
          : new Date();
        
        if (existing) {
          // Article exists, update it
          await prisma.news.update({
            where: { finnhubId: article.id },
            data: {
              category: article.category || null,
              headline: article.headline || '',
              summary: article.summary || null,
              url: article.url,
              image: article.image || null,
              source: article.source || null,
              datetime: articleDate,
            },
          });
          updatedCount++;
        } else {
          // New article, create it
          await prisma.news.create({
            data: {
              stockId: stock.id,
              finnhubId: article.id,
              category: article.category || null,
              headline: article.headline || '',
              summary: article.summary || null,
              url: article.url,
              image: article.image || null,
              source: article.source || null,
              datetime: articleDate,
            },
          });
          newCount++;
        }
      } catch (error) {
        // Skip duplicate errors or other individual article errors
        console.error(`Error saving article ${article.id} for stock ${stock.symbol}:`, error.message);
      }
    }
    
    return { new: newCount, updated: updatedCount, total: newCount + updatedCount };
  } catch (error) {
    console.error(`Error fetching news for stock ${stock.symbol}:`, error.message);
    return 0;
  }
};

/**
 * Fetch and save news for all distinct stocks in user watchlists (for cron job)
 * This function is called by the cron job every 20 minutes
 * @returns {Promise<Object>} - Summary of the sync operation
 */
const syncNewsForAllWatchlistStocks = async () => {
  console.log('Starting news sync for all watchlist stocks...');
  
  try {
    // Get all user stocks to find distinct stockIds
    const userStocks = await prisma.userStock.findMany({
      select: {
        stockId: true,
      },
    });
    
    if (userStocks.length === 0) {
      console.log('No stocks found in watchlists');
      return {
        totalStocks: 0,
        totalArticles: 0,
        success: true,
      };
    }
    
    // Get unique stockIds
    const uniqueStockIds = [...new Set(userStocks.map(us => us.stockId))];
    
    // Fetch the stock details for unique stockIds
    const uniqueStocks = await prisma.stock.findMany({
      where: {
        id: {
          in: uniqueStockIds,
        },
      },
      select: {
        id: true,
        symbol: true,
        description: true,
      },
    });
    
    console.log(`Found ${uniqueStocks.length} distinct stocks in watchlists`);
    
    // Fetch news for each stock with rate limiting (max 1 request per second = 55 per minute)
    // Delay of 1100ms ensures we stay under 55 requests per minute (60 seconds / 55 = ~1.09 seconds)
    const RATE_LIMIT_DELAY_MS = 1100; // 1.1 seconds between requests
    
    let totalArticles = 0;
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < uniqueStocks.length; i++) {
      const stock = uniqueStocks[i];
      try {
        const result = await fetchAndSaveNewsForStock(stock);
        totalArticles += result.total;
        successCount++;
        
        if (result.total > 0) {
          if (result.new > 0 && result.updated > 0) {
            console.log(`${stock.symbol}: ${result.new} new, ${result.updated} updated (${result.total} total)`);
          } else if (result.new > 0) {
            console.log(`${stock.symbol}: ${result.new} new articles`);
          } else if (result.updated > 0) {
            console.log(`${stock.symbol}: ${result.updated} articles updated (no new articles)`);
          }
        } else {
          console.log(`${stock.symbol}: No new articles found`);
        }
        
        // Rate limiting: wait before next request (except for the last one)
        if (i < uniqueStocks.length - 1) {
          await delay(RATE_LIMIT_DELAY_MS);
        }
      } catch (error) {
        errorCount++;
        console.error(`Error processing stock ${stock.symbol}:`, error.message);
        
        // Still delay even on error to maintain rate limit
        if (i < uniqueStocks.length - 1) {
          await delay(RATE_LIMIT_DELAY_MS);
        }
      }
    }
    
    console.log(`News sync completed: ${totalArticles} articles processed for ${successCount} stocks (${errorCount} errors)`);
    
    return {
      totalStocks: uniqueStocks.length,
      totalArticles,
      successCount,
      errorCount,
      success: true,
    };
  } catch (error) {
    console.error('Error in news sync job:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  getNewsForStock,
  getNewsForUserStocks,
  syncNewsForAllWatchlistStocks,
};

