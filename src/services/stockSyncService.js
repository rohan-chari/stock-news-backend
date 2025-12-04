const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const puppeteer = require('puppeteer');
const config = require('../config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Stock Sync Service
 * Handles scheduled synchronization of stocks from Finnhub API
 */

const STOCK_LOGOS_DIR = path.join(__dirname, '../assets/stockLogos');
const LOGO_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.svg', '.gif', '.webp'];

/**
 * Fetch all US common stocks from Finnhub API
 * @returns {Promise<Array>} - Array of stock objects
 */
const fetchAllUSCommonStocks = () => {
  return new Promise((resolve, reject) => {
    const apiKey = config.finnhubApiKey || "cuu5a01r01qv6ijlqqg0cuu5a01r01qv6ijlqqgg";
    const apiUrl = new URL('https://finnhub.io/api/v1/stock/symbol');
    apiUrl.searchParams.append('exchange', 'US');
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

          const stocks = JSON.parse(data);
          
          // Filter for Common Stock type only
          const commonStocks = (stocks || []).filter(stock => stock.type === 'Common Stock');
          resolve(commonStocks);
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
 * Upsert a single stock into the database
 * @param {Object} stockData - Stock data from Finnhub
 * @param {string} stockData.symbol - Stock symbol
 * @param {string} stockData.displaySymbol - Display symbol
 * @param {string} stockData.description - Company description
 * @param {string} stockData.type - Stock type (should be 'Common Stock')
 * @param {string} stockData.currency - Currency
 * @returns {Promise<Object>} - Upserted stock object from database
 */
const upsertStock = async (stockData) => {
  const { symbol, displaySymbol, description, type, currency } = stockData;
  
  if (!symbol) {
    throw new Error('Stock symbol is required');
  }

  const normalizedSymbol = symbol.toUpperCase().trim();

  // Use upsert (update or create) operation
  const stock = await prisma.stock.upsert({
    where: { symbol: normalizedSymbol },
    update: {
      displaySymbol: displaySymbol || normalizedSymbol,
      description: description || null,
      type: type || null,
      exchange: 'US',
      updatedAt: new Date(),
    },
    create: {
      symbol: normalizedSymbol,
      displaySymbol: displaySymbol || normalizedSymbol,
      description: description || null,
      type: type || null,
      exchange: 'US',
    },
  });

  return stock;
};

/**
 * Retry a function with exponential backoff
 * @param {Function} fn - Function to retry
 * @param {number} maxRetries - Maximum number of retries
 * @param {number} delay - Initial delay in milliseconds
 * @returns {Promise<any>} - Result of the function
 */
const retryWithBackoff = async (fn, maxRetries = 3, delay = 1000) => {
  let lastError;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      
      if (attempt < maxRetries) {
        const backoffDelay = delay * Math.pow(2, attempt);
        console.log(`Retry attempt ${attempt + 1}/${maxRetries} after ${backoffDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, backoffDelay));
      }
    }
  }
  
  throw lastError;
};

/**
 * Fetch and upsert all US common stocks
 * @returns {Promise<Object>} - Statistics about the sync operation
 */
const syncAllUSCommonStocks = async () => {
  console.log('Starting stock sync job at', new Date().toISOString());
  
  let stocks = [];
  let stats = {
    fetched: 0,
    upserted: 0,
    failed: 0,
    errors: [],
  };

  try {
    // Fetch all US common stocks with retry logic
    stocks = await retryWithBackoff(
      () => fetchAllUSCommonStocks(),
      3, // max retries
      2000 // initial delay 2 seconds
    );
    
    stats.fetched = stocks.length;
    console.log(`Fetched ${stats.fetched} US common stocks from Finnhub`);

    // Upsert each stock
    for (const stockData of stocks) {
      try {
        await upsertStock(stockData);
        stats.upserted++;
        
        // Log progress every 100 stocks
        if (stats.upserted % 100 === 0) {
          console.log(`Upserted ${stats.upserted}/${stats.fetched} stocks...`);
        }
      } catch (error) {
        stats.failed++;
        stats.errors.push({
          symbol: stockData.symbol,
          error: error.message,
        });
        console.error(`Error upserting stock ${stockData.symbol}:`, error.message);
        // Continue with next stock even if one fails
      }
    }

    console.log('Stock sync completed:', {
      fetched: stats.fetched,
      upserted: stats.upserted,
      failed: stats.failed,
    });

    // Log errors if any
    if (stats.errors.length > 0) {
      console.error('Failed stocks:', stats.errors);
    }

    return stats;
  } catch (error) {
    console.error('Error in stock sync job:', error);
    throw error;
  }
};

/**
 * Check if a stock logo exists locally
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
 * Download image from URL or data URL and save to disk
 * @param {string} imageUrl - URL of the image to download or data URL
 * @param {string} ticker - Stock ticker symbol
 * @returns {Promise<string|null>} - Saved file path or null if failed
 */
const downloadAndSaveImage = async (imageUrl, ticker) => {
  // Ensure directory exists
  try {
    await fs.mkdir(STOCK_LOGOS_DIR, { recursive: true });
  } catch (error) {
    // Directory might already exist, ignore error
  }
  
  // Handle data URLs (base64 encoded images)
  if (imageUrl.startsWith('data:image/')) {
    try {
      // Extract image type and base64 data
      const matches = imageUrl.match(/^data:image\/(\w+);base64,(.+)$/);
      if (!matches) {
        throw new Error('Invalid data URL format');
      }
      
      const imageType = matches[1]; // png, jpg, etc.
      const base64Data = matches[2];
      
      // Determine file extension
      let extension = '.png'; // default
      if (imageType === 'jpeg' || imageType === 'jpg') {
        extension = '.jpg';
      } else if (imageType === 'png') {
        extension = '.png';
      } else if (imageType === 'svg+xml') {
        extension = '.svg';
      } else if (imageType === 'gif') {
        extension = '.gif';
      } else if (imageType === 'webp') {
        extension = '.webp';
      } else {
        extension = `.${imageType}`;
      }
      
      // Decode base64 and save
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `${ticker}${extension}`;
      const filepath = path.join(STOCK_LOGOS_DIR, filename);
      
      await fs.writeFile(filepath, buffer);
      
      return `/assets/stockLogos/${filename}`;
    } catch (error) {
      console.error('Error saving data URL image:', error);
      return null;
    }
  }
  
  // Handle regular HTTP/HTTPS URLs
  return new Promise((resolve, reject) => {
    try {
      const url = new URL(imageUrl);
      const client = url.protocol === 'https:' ? https : http;
      
      client.get(imageUrl, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302) {
          return downloadAndSaveImage(response.headers.location, ticker)
            .then(resolve)
            .catch(reject);
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download image: ${response.statusCode}`));
          return;
        }
        
        // Determine file extension from content-type or URL
        const contentType = response.headers['content-type'];
        let extension = '.png'; // default
        
        if (contentType) {
          if (contentType.includes('jpeg') || contentType.includes('jpg')) {
            extension = '.jpg';
          } else if (contentType.includes('png')) {
            extension = '.png';
          } else if (contentType.includes('svg')) {
            extension = '.svg';
          } else if (contentType.includes('gif')) {
            extension = '.gif';
          } else if (contentType.includes('webp')) {
            extension = '.webp';
          }
        } else {
          // Try to get extension from URL
          const urlPath = url.pathname.toLowerCase();
          if (urlPath.endsWith('.jpg') || urlPath.endsWith('.jpeg')) {
            extension = '.jpg';
          } else if (urlPath.endsWith('.png')) {
            extension = '.png';
          } else if (urlPath.endsWith('.svg')) {
            extension = '.svg';
          } else if (urlPath.endsWith('.gif')) {
            extension = '.gif';
          } else if (urlPath.endsWith('.webp')) {
            extension = '.webp';
          }
        }
        
        const filename = `${ticker}${extension}`;
        const filepath = path.join(STOCK_LOGOS_DIR, filename);
        
        const fileStream = require('fs').createWriteStream(filepath);
        response.pipe(fileStream);
        
        fileStream.on('finish', () => {
          fileStream.close();
          resolve(`/assets/stockLogos/${filename}`);
        });
        
        fileStream.on('error', (err) => {
          require('fs').unlink(filepath, () => {}); // Delete the file on error
          reject(err);
        });
      }).on('error', (err) => {
        reject(err);
      });
    } catch (error) {
      reject(error);
    }
  });
};

/**
 * Scrape stock logo using Puppeteer
 * @param {string} query - Stock symbol or query
 * @returns {Promise<string|null>} - Logo file path if scraped and saved, null otherwise
 */
const scrapeStockLogo = async (query) => {
  if (!query) return null;

  const normalizedQuery = query.toUpperCase().trim();
  let browser = null;
  let page = null;

  try {
    // Create a new browser instance for this request
    browser = await puppeteer.launch({
      headless: 'new',
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--disable-software-rasterizer',
      ],
      defaultViewport: { width: 1920, height: 1080 },
      timeout: 30000, // 30 second timeout for browser launch
    });

    // Create a new page
    page = await browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });

    // Navigate to Google Images search
    const searchQuery = `${normalizedQuery} stock logo`;
    await page.goto(`https://www.google.com/search?q=${searchQuery}&tbs=isz:i&udm=2`, { 
      waitUntil: 'networkidle0',
      timeout: 30000, // 30 second timeout for page navigation
    });
    
    // Wait for images to load
    await new Promise(r => setTimeout(r, 2000));
    
    // Find the first image from the main results grid
    const firstImageInfo = await page.evaluate(() => {
      // Find all image containers in the main results grid
      const mainGridImages = document.querySelectorAll('div[data-ri] img, div.rg_l img, div[jsname="sHclz"] img');
      
      for (const img of mainGridImages) {
        // Skip if it's in a suggestion chip container
        const parentContainer = img.closest('div[data-ri]') || img.closest('div.rg_l');
        if (!parentContainer) continue;
        
        // Skip suggestion chips
        const isInSuggestionChip = img.closest('div[data-hveid]')?.querySelector('div[role="button"]') !== null ||
                                   img.closest('div[jscontroller]')?.getAttribute('jscontroller')?.includes('chip');
        
        if (isInSuggestionChip) continue;
        
        // Check if image is large enough (suggestion chips are usually < 80px)
        if (img.naturalWidth > 80 || img.width > 80 || img.height > 80) {
          return {
            found: true,
            html: img.outerHTML,
            src: img.getAttribute('src'),
            dataSrc: img.getAttribute('data-src'),
            parentHtml: parentContainer.outerHTML.substring(0, 500), // First 500 chars of parent
            tagName: img.tagName,
            className: img.className,
            id: img.id,
            attributes: Array.from(img.attributes).map(attr => ({ name: attr.name, value: attr.value }))
          };
        }
      }
      
      // Fallback: find by size
      const allImages = Array.from(document.querySelectorAll('img[data-src], img[src]'));
      const validImages = [];
      
      for (const img of allImages) {
        if (img.naturalWidth > 80 || img.width > 80 || img.height > 80) {
          validImages.push({
            img: img,
            size: img.naturalWidth * img.naturalHeight || img.width * img.height,
            html: img.outerHTML,
            src: img.getAttribute('src'),
            dataSrc: img.getAttribute('data-src'),
            parentHtml: img.parentElement ? img.parentElement.outerHTML.substring(0, 500) : null
          });
        }
      }
      
      if (validImages.length > 0) {
        validImages.sort((a, b) => b.size - a.size);
        return {
          found: true,
          html: validImages[0].html,
          src: validImages[0].src,
          dataSrc: validImages[0].dataSrc,
          parentHtml: validImages[0].parentHtml,
          tagName: validImages[0].img.tagName,
          className: validImages[0].img.className,
          id: validImages[0].img.id,
          attributes: Array.from(validImages[0].img.attributes).map(attr => ({ name: attr.name, value: attr.value }))
        };
      }
      
      return { found: false };
    });
    
    if (!firstImageInfo.found) {
      console.error(`No image found for ${normalizedQuery}`);
      return null;
    }
    
    // Extract src from parent HTML
    let imageSrc = firstImageInfo.src || firstImageInfo.dataSrc;
    
    // If src is not in the image element, try to extract from parent HTML
    if (!imageSrc || imageSrc.startsWith('data:')) {
      // Extract src from parent HTML using regex
      const srcMatch = firstImageInfo.parentHtml?.match(/src="([^"]+)"/);
      if (srcMatch && srcMatch[1]) {
        imageSrc = srcMatch[1];
      }
    }
    
    // Download and save the image if we have a valid src
    if (imageSrc) {
      // Convert relative URLs to absolute (but not data URLs)
      if (!imageSrc.startsWith('data:') && !imageSrc.startsWith('http')) {
        if (imageSrc.startsWith('//')) {
          imageSrc = `https:${imageSrc}`;
        } else if (imageSrc.startsWith('/')) {
          imageSrc = `https://www.google.com${imageSrc}`;
        }
      }
      
      const savedPath = await downloadAndSaveImage(imageSrc, normalizedQuery);
      
      if (savedPath) {
        return savedPath;
      }
    }
     
    return null;
  } catch (error) {
    console.error(`Error scraping logo for ${normalizedQuery}:`, error);
    return null;
  } finally {
    // Always close the page and browser, even on connection errors
    try {
      if (page) {
        try {
          if (!page.isClosed()) {
            await page.close();
          }
        } catch (pageError) {
          // Page might already be closed or connection lost
          console.error('Error closing page:', pageError.message);
        }
      }
    } catch (error) {
      console.error('Error accessing page:', error.message);
    }
    
    try {
      if (browser) {
        try {
          // Check if browser is still connected before closing
          if (browser.isConnected()) {
            await browser.close();
          }
        } catch (browserError) {
          // Browser might already be closed or connection lost
          console.error('Error closing browser:', browserError.message);
          // Force cleanup
          try {
            browser.process()?.kill('SIGKILL');
          } catch (killError) {
            // Ignore kill errors
          }
        }
      }
    } catch (error) {
      console.error('Error accessing browser:', error.message);
    }
  }
};

/**
 * Sync stocks and process logos for stocks without logos
 * This is the main function called by the cron job
 */
const syncStocksWithLogos = async () => {
  try {
    // Step 1: Sync all stocks from Finnhub
    const syncStats = await syncAllUSCommonStocks();
    
    // Step 2: Find stocks without logos and scrape them
    console.log('Starting logo scraping for stocks without logos...');
    const stocksWithoutLogos = await prisma.stock.findMany({
      where: { logo: null },
    });
    
    console.log(`Found ${stocksWithoutLogos.length} stocks without logos`);
    
    let logoStats = {
      checked: 0,
      foundLocally: 0,
      scraped: 0,
      failed: 0,
      errors: [],
    };
    
    for (const stock of stocksWithoutLogos) {
      try {
        logoStats.checked++;
        
        // First check if logo exists locally
        let logoPath = await checkStockLogo(stock.symbol);
        
        if (logoPath) {
          // Update DB with local logo path
          await prisma.stock.update({
            where: { id: stock.id },
            data: { logo: logoPath },
          });
          logoStats.foundLocally++;
          console.log(`Found local logo for ${stock.symbol}: ${logoPath}`);
        } else {
          // Scrape logo if not found locally
          logoPath = await scrapeStockLogo(stock.symbol);
          
          if (logoPath) {
            // Update DB with scraped logo path
            await prisma.stock.update({
              where: { id: stock.id },
              data: { logo: logoPath },
            });
            logoStats.scraped++;
            console.log(`Scraped logo for ${stock.symbol}: ${logoPath}`);
          } else {
            logoStats.failed++;
            console.log(`Could not find or scrape logo for ${stock.symbol}`);
          }
        }
        
        // Log progress every 50 stocks
        if (logoStats.checked % 50 === 0) {
          console.log(`Processed ${logoStats.checked}/${stocksWithoutLogos.length} stocks for logos...`);
        }
      } catch (error) {
        logoStats.failed++;
        logoStats.errors.push({
          symbol: stock.symbol,
          error: error.message,
        });
        console.error(`Error processing logo for ${stock.symbol}:`, error.message);
        // Continue with next stock even if one fails
      }
    }
    
    console.log('Logo scraping completed:', {
      checked: logoStats.checked,
      foundLocally: logoStats.foundLocally,
      scraped: logoStats.scraped,
      failed: logoStats.failed,
    });
    
    if (logoStats.errors.length > 0) {
      console.error('Failed logo scraping:', logoStats.errors.slice(0, 10)); // Log first 10 errors
    }
    
    console.log('Stock sync with logos completed successfully');
    return {
      ...syncStats,
      logoStats,
    };
  } catch (error) {
    console.error('Error in syncStocksWithLogos:', error);
    throw error;
  }
};

module.exports = {
  syncAllUSCommonStocks,
  syncStocksWithLogos,
  fetchAllUSCommonStocks,
  upsertStock,
};

