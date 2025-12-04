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
 * Get date strings for last 10 days
 */
const getDateRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 10);
  
  return {
    from: from.toISOString().split('T')[0], // YYYY-MM-DD
    to: to.toISOString().split('T')[0],
  };
};

/**
 * Check if we've fetched news for this stock within the last 10 minutes
 */
const hasRecentNews = async (stockId) => {
  const tenMinutesAgo = new Date();
  tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);
  
  const recentNews = await prisma.news.findFirst({
    where: {
      stockId,
      createdAt: {
        gte: tenMinutesAgo,
      },
    },
  });
  
  return !!recentNews;
};

/**
 * Fetch and save news for a stock
 * @param {string} stockId - Stock ID (UUID)
 * @returns {Promise<Array>} - Array of saved news articles
 */
const fetchAndSaveNews = async (stockId) => {
  // Find stock by ID
  const stock = await prisma.stock.findUnique({
    where: { id: stockId },
  });
  
  if (!stock) {
    throw new Error('Stock not found');
  }
  
  // Check if we've fetched recently
  const hasRecent = await hasRecentNews(stock.id);
  if (hasRecent) {
    // Return existing news for this stock (we fetched recently, so no need to fetch again)
    return await prisma.news.findMany({
      where: {
        stockId: stock.id,
      },
      orderBy: {
        datetime: 'desc',
      },
      take: 10, // Limit to 10 most recent articles
    });
  }
  
  // Fetch news from Finnhub using the stock's symbol
  const { from, to } = getDateRange();
  const newsData = await fetchCompanyNews(stock.symbol.toUpperCase(), from, to);
  
  if (!newsData || !Array.isArray(newsData)) {
    return [];
  }
  
  // Save news articles (use finnhubId as unique identifier)
  const savedArticles = [];
  for (const article of newsData) {
    try {
      // Convert Unix timestamp (seconds) to JavaScript Date
      const articleDate = article.datetime 
        ? new Date(article.datetime * 1000) 
        : new Date();
      
      const saved = await prisma.news.upsert({
        where: { finnhubId: article.id },
        update: {
          category: article.category || null,
          headline: article.headline || '',
          summary: article.summary || null,
          url: article.url,
          image: article.image || null,
          source: article.source || null,
          datetime: articleDate,
        },
        create: {
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
      savedArticles.push(saved);
    } catch (error) {
      // Skip duplicate errors or other individual article errors
      console.error(`Error saving article ${article.id}:`, error.message);
    }
  }
  
  // Return news for this stock (limited to 10 most recent)
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

module.exports = {
  fetchAndSaveNews,
};

