const fs = require('fs').promises;
const path = require('path');
const browserManager = require('../helpers/browserManager');
const requestDeduplicator = require('../helpers/requestDeduplicator');

/**
 * Stock Service
 * Contains business logic for stock operations
 * Services handle the core business logic, separate from HTTP concerns
 */

const STOCK_LOGOS_DIR = path.join(__dirname, '../assets/stockLogos');
const LOGO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'];

/**
 * Check if a stock logo exists for the given query
 * @param {string} query - Stock symbol or query
 * @returns {Promise<string|null>} - Logo file path if exists, null otherwise
 */
const checkStockLogo = async (query) => {
  if (!query) return null;

  // Normalize query: uppercase and remove whitespace
  const normalizedQuery = query.toUpperCase().trim();

  try {
    // Check for logo files with various extensions
    for (const ext of LOGO_EXTENSIONS) {
      const logoPath = path.join(STOCK_LOGOS_DIR, `${normalizedQuery}${ext}`);
      try {
        await fs.access(logoPath);
        // File exists, return the relative path
        return `/assets/stockLogos/${normalizedQuery}${ext}`;
      } catch (err) {
        // File doesn't exist, continue to next extension
        continue;
      }
    }
    return null;
  } catch (error) {
    // Directory doesn't exist or other error
    return null;
  }
};

/**
 * Scrape stock logo using Puppeteer
 * @param {string} query - Stock symbol or query
 * @returns {Promise<string|null>} - Logo file path if scraped and saved, null otherwise
 */
const scrapeStockLogo = async (query) => {
  if (!query) return null;

  const normalizedQuery = query.toUpperCase().trim();
  let page = null;

  try {
    // Create a new page from the shared browser
    page = await browserManager.createPage();
    console.log(`Scraping logo for stock: ${normalizedQuery}`);

    // Navigate to Google Images
    await page.goto('https://images.google.com', { waitUntil: 'networkidle0' });
    
    // Wait for the search box to be available and type the search query
    const searchQuery = `${normalizedQuery} stock logo`;
    
    // Wait a moment for the page to be fully loaded and search box to be focused
    await page.waitForTimeout(50);
    
    // Type directly using keyboard (since search box is already selected)
    await page.keyboard.type(searchQuery, { delay: 75 });
    
    // Press Enter to submit the search
    await page.keyboard.press('Enter');
    
    // Wait for search results to load
    await page.waitForSelector('img[data-src]', { timeout: 10000 }).catch(() => {
      // Fallback: wait for any image to appear
      return page.waitForSelector('img', { timeout: 10000 });
    });
    
    console.log(`Search completed for: ${normalizedQuery}`);
    
    // TODO: Extract logo image URL and download it
    // TODO: Save logo to STOCK_LOGOS_DIR with appropriate extension
    
    console.log(`Logo scraping completed for: ${normalizedQuery}`);
    return null; // Return null until scraping logic is implemented
  } catch (error) {
    console.error(`Error scraping logo for ${normalizedQuery}:`, error);
    return null;
  } finally {
    // Always close the page
    if (page) {
      //await browserManager.closePage(page);
    }
  }
};

/**
 * Search stocks by query
 * @param {string} query - Search query
 * @returns {Promise<Object>} - Search results
 */
const searchStocks = async (query) => {
  if (!query) {
    return {
      query: '',
      logo: null,
      results: [],
    };
  }

  const normalizedQuery = query.toUpperCase().trim();

  // First, check if logo exists locally
  let logoPath = await checkStockLogo(normalizedQuery);

  // If logo doesn't exist, scrape it (with deduplication)
  if (!logoPath) {
    logoPath = await requestDeduplicator.execute(
      `scrape-logo-${normalizedQuery}`,
      () => scrapeStockLogo(normalizedQuery)
    );
  }

  return {
    query: normalizedQuery,
    logo: logoPath,
    results: [],
  };
};

module.exports = {
  searchStocks,
};

