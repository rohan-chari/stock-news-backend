const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
const puppeteer = require('puppeteer');
const requestDeduplicator = require('../helpers/requestDeduplicator');
const finnhub = require('finnhub');
const config = require('../config');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

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
    
    // Find the first image from the main results grid and log its HTML
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
    
    // Extract src from parent HTML and log it
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

          } else {

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
 * Search stocks using Finnhub API
 * @param {string} query - Search query
 * @returns {Promise<Object>} - Search results from Finnhub
 */
const searchStocksWithFinnhub = (query) => {
  return new Promise((resolve, reject) => {
    if (!query) {
      return resolve({ count: 0, result: [] });
    }

    const finnhubClient = new finnhub.DefaultApi();
    finnhubClient.apiKey = config.finnhubApiKey || "cuu5a01r01qv6ijlqqg0cuu5a01r01qv6ijlqqgg";

    finnhubClient.symbolSearch(query, { exchange: 'US' }, (error, data, response) => {
      if (error) {
        reject(error);
      } else {
        resolve(data);
      }
    });
  });
};

/**
 * Find or create a stock in the database
 * @param {Object} stockData - Stock data from Finnhub
 * @param {string} stockData.symbol - Stock symbol
 * @param {string} stockData.displaySymbol - Display symbol
 * @param {string} stockData.description - Company description
 * @param {string} stockData.type - Stock type
 * @returns {Promise<Object>} - Stock object from database
 */
const findOrCreateStock = async (stockData) => {
  const { symbol, displaySymbol, description, type } = stockData;
  
  if (!symbol) {
    throw new Error('Stock symbol is required');
  }

  const normalizedSymbol = symbol.toUpperCase().trim();

  // Check if stock exists in database
  let stock = await prisma.stock.findUnique({
    where: { symbol: normalizedSymbol },
  });

  // If stock doesn't exist, create it
  if (!stock) {
    stock = await prisma.stock.create({
      data: {
        symbol: normalizedSymbol,
        displaySymbol: displaySymbol || normalizedSymbol,
        description: description || null,
        type: type || null,
        exchange: 'US', // We're filtering by US exchange
      },
    });
    console.log(`Created new stock in database: ${normalizedSymbol}`);
  }

  return stock;
};

/**
 * Get logo path for a stock, checking DB first, then local assets
 * @param {Object} stock - Stock object from database
 * @returns {Promise<string|null>} - Logo path or null
 */
const getStockLogoPath = async (stock) => {
  // First check DB logo
  if (stock.logo) {
    return stock.logo;
  }

  // If DB logo is null, check local assets folder
  const localLogo = await checkStockLogo(stock.symbol);
  
  if (localLogo) {
    // Update DB with local logo path
    try {
      await prisma.stock.update({
        where: { id: stock.id },
        data: { logo: localLogo },
      });
      console.log(`Updated stock ${stock.symbol} with local logo path: ${localLogo}`);
    } catch (error) {
      console.error(`Error updating logo path for stock ${stock.symbol}:`, error);
    }
    return localLogo;
  }

  return null;
};

/**
 * Process a stock: check for logo and scrape if needed
 * @param {Object} stock - Stock object from database
 * @returns {Promise<string|null>} - Logo path or null
 */
const processStockLogo = async (stock) => {
  let logoPath = stock.logo;
  
  // If logo exists in DB, return it
  if (logoPath) {
    return logoPath;
  }

  // Check if logo exists locally
  logoPath = await checkStockLogo(stock.symbol);

  // If logo doesn't exist locally, scrape it (with deduplication)
  if (!logoPath) {
    logoPath = await requestDeduplicator.execute(
      `scrape-logo-${stock.symbol}`,
      () => scrapeStockLogo(stock.symbol)
    );
  }
  
  // Update database with logo path if we found/scraped one (and stock doesn't have it)
  if (logoPath && !stock.logo) {
    try {
      await prisma.stock.update({
        where: { id: stock.id },
        data: { logo: logoPath },
      });
      console.log(`Updated stock ${stock.symbol} with logo path: ${logoPath}`);
    } catch (error) {
      console.error(`Error updating logo path for stock ${stock.symbol}:`, error);
    }
  }

  return logoPath;
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
      results: [],
    };
  }

  const normalizedQuery = query.toUpperCase().trim();
  const processedStocks = [];
  const seenSymbols = new Set(); // Track unique symbols

  // Step 1: Search database first
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

  // Step 2: Process stocks from database
  for (const stock of dbStocks) {
    if (seenSymbols.has(stock.symbol)) {
      continue;
    }
    seenSymbols.add(stock.symbol);

    try {
      // Get logo path: check DB first, then local assets, update DB if found locally
      let logoPath = await getStockLogoPath(stock);

      // If we have stock and logo, return both
      if (logoPath) {
        processedStocks.push({
          id: stock.id,
          symbol: stock.symbol,
          displaySymbol: stock.displaySymbol,
          description: stock.description,
          type: stock.type,
          exchange: stock.exchange,
          logo: logoPath,
          createdAt: stock.createdAt,
          updatedAt: stock.updatedAt,
        });
      } else {
        // If we have stock but no logo, start scraper (async, don't wait)
        processStockLogo(stock).then((logo) => {
          // Update the stock in results if it's already there, or add it
          const stockIndex = processedStocks.findIndex(s => s.id === stock.id);
          if (stockIndex >= 0) {
            processedStocks[stockIndex].logo = logo;
          }
        }).catch((error) => {
          console.error(`Error processing logo for ${stock.symbol}:`, error);
        });

        // Add stock to results immediately (logo will be added async)
        processedStocks.push({
          id: stock.id,
          symbol: stock.symbol,
          displaySymbol: stock.displaySymbol,
          description: stock.description,
          type: stock.type,
          exchange: stock.exchange,
          logo: null, // Will be updated async
          createdAt: stock.createdAt,
          updatedAt: stock.updatedAt,
        });
      }
    } catch (error) {
      console.error(`Error processing stock ${stock.symbol}:`, error);
    }
  }

  // Step 3: If database doesn't have stocks, search Finnhub
  if (dbStocks.length === 0) {
    let finnhubResults = [];
    try {
      finnhubResults = await requestDeduplicator.execute(
        `finnhub-search-${normalizedQuery}`,
        () => searchStocksWithFinnhub(normalizedQuery)
      );
      console.log('Finnhub search data:', finnhubResults);
    } catch (error) {
      console.error('Error fetching Finnhub results:', error);
      // Return empty results if Finnhub fails
      return {
        query: normalizedQuery,
        results: [],
      };
    }

    // Step 4: Process each stock from Finnhub results
    const stocks = finnhubResults.result || [];

    for (const stockData of stocks) {
      try {
        // Skip if we've already processed this symbol
        const normalizedSymbol = stockData.symbol?.toUpperCase().trim();
        if (!normalizedSymbol || seenSymbols.has(normalizedSymbol)) {
          continue;
        }
        seenSymbols.add(normalizedSymbol);

        // Find or create stock in database
        const stock = await findOrCreateStock(stockData);
        
        // Get logo path: check DB first, then local assets, then scrape if needed
        let logoPath = await getStockLogoPath(stock);
        
        // If no logo found, process (scrape) it
        if (!logoPath) {
          logoPath = await processStockLogo(stock);
        }

        // Add processed stock to results
        processedStocks.push({
          id: stock.id,
          symbol: stock.symbol,
          displaySymbol: stock.displaySymbol,
          description: stock.description,
          type: stock.type,
          exchange: stock.exchange,
          logo: logoPath,
          createdAt: stock.createdAt,
          updatedAt: stock.updatedAt,
        });
      } catch (error) {
        console.error(`Error processing stock ${stockData.symbol}:`, error);
        // Continue with other stocks even if one fails
      }
    }
  }

  // Ensure uniqueness by symbol (additional safety check)
  const uniqueStocks = processedStocks.reduce((acc, stock) => {
    if (!acc.find(s => s.symbol === stock.symbol)) {
      acc.push(stock);
    }
    return acc;
  }, []);

  return {
    query: normalizedQuery,
    results: uniqueStocks,
  };
};

module.exports = {
  searchStocks,
};

