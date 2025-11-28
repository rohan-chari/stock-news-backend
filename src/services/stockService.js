const fs = require('fs').promises;
const path = require('path');
const https = require('https');
const http = require('http');
const { URL } = require('url');
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
 * Download image from URL and save to disk
 * @param {string} imageUrl - URL of the image to download
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
  let page = null;

  try {
    // Create a new page from the shared browser
    page = await browserManager.createPage();
    console.log(`Scraping logo for stock: ${normalizedQuery}`);

    // Navigate to Google Images
    //    await page.goto('https://www.google.com/search?q=ASTS+logo&tbs=isz:i&udm=2', { waitUntil: 'networkidle0' });

    // Wait for the search box to be available and type the search query
    const searchQuery = `${normalizedQuery} stock logo`;
    await page.goto(`https://www.google.com/search?q=${searchQuery}&tbs=isz:i&udm=2`, { waitUntil: 'networkidle0' });
    
    console.log(`Search completed for: ${normalizedQuery}`);
    
    // Wait for images to load
    await new Promise(r => setTimeout(r, 2000));
    
    // Find the first image from the main results grid (skip suggestion chips)
    const firstImagePosition = await page.evaluate(() => {
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
          const rect = img.getBoundingClientRect();
          return {
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2,
            found: true
          };
        }
      }
      
      // Fallback: find by size
      const allImages = Array.from(document.querySelectorAll('img[data-src], img[src]'));
      const validImages = [];
      
      for (const img of allImages) {
        if (img.naturalWidth > 80 || img.width > 80 || img.height > 80) {
          const rect = img.getBoundingClientRect();
          validImages.push({
            size: img.naturalWidth * img.naturalHeight || img.width * img.height,
            x: rect.left + rect.width / 2,
            y: rect.top + rect.height / 2
          });
        }
      }
      
      if (validImages.length > 0) {
        validImages.sort((a, b) => b.size - a.size);
        return {
          x: validImages[0].x,
          y: validImages[0].y,
          found: true
        };
      }
      
      return { found: false };
    });
    
    if (!firstImagePosition.found) {
      console.error(`No image found for ${normalizedQuery}`);
      return null;
    }
    
    // Get the browser instance to track new pages
    const browser = await browserManager.getBrowser();
    const initialPages = await browser.pages();
    const initialPageCount = initialPages.length;
    
    // Right-click on the first image
    await page.mouse.click(firstImagePosition.x, firstImagePosition.y, { button: 'right' });
    await new Promise(r => setTimeout(r, 1000)); // Wait for context menu
    
    // Try multiple approaches to find and click "Open image in new tab"
    let menuClicked = false;
    
    // Approach 1: Try XPath with various text patterns
    const xpathPatterns = [
      "//div[contains(text(), 'Open image')]",
      "//div[contains(text(), 'View image')]",
      "//div[contains(text(), 'Open image in new tab')]",
      "//div[contains(text(), 'Open in new tab')]",
      "//span[contains(text(), 'Open image')]",
      "//span[contains(text(), 'View image')]",
    ];
    
    for (const xpath of xpathPatterns) {
      try {
        const menuItem = await page.waitForXPath(xpath, { timeout: 1000, visible: true });
        if (menuItem) {
          await menuItem.click();
          menuClicked = true;
          console.log('Clicked menu item using XPath:', xpath);
          break;
        }
      } catch (error) {
        // Continue to next pattern
        continue;
      }
    }
    
    // Approach 2: If XPath didn't work, try finding by evaluating
    if (!menuClicked) {
      const clicked = await page.evaluate(() => {
        // Try various selectors for menu items
        const selectors = [
          'div[role="menuitem"]',
          'div[jsname]',
          'div[class*="menu"]',
          'div[class*="MenuItem"]',
          'span[role="menuitem"]',
        ];
        
        for (const selector of selectors) {
          const items = Array.from(document.querySelectorAll(selector));
          for (const item of items) {
            const text = (item.textContent || item.innerText || '').toLowerCase().trim();
            if (text.includes('open image') || 
                text.includes('view image') || 
                (text.includes('open') && text.includes('image')) ||
                text === 'open image in new tab') {
              item.click();
              return true;
            }
          }
        }
        return false;
      });
      
      if (clicked) {
        menuClicked = true;
        console.log('Clicked menu item using evaluate');
      }
    }
    
    // Approach 3: Try keyboard navigation (arrow down + enter)
    if (!menuClicked) {
      await new Promise(r => setTimeout(r, 300));
      // Press arrow down to select first menu item, then enter
      await page.keyboard.press('ArrowDown');
      await new Promise(r => setTimeout(r, 200));
      await page.keyboard.press('Enter');
      menuClicked = true;
      console.log('Used keyboard navigation to select menu item');
    }
    
    // Wait for new tab to open
    await new Promise(r => setTimeout(r, 1500));
    
    // Get the new page (should be the image)
    const allPages = await browser.pages();
    let imagePage = null;
    
    if (allPages.length > initialPageCount) {
      // New page was opened
      imagePage = allPages[allPages.length - 1];
    } else {
      // Check if current page navigated to image
      imagePage = page;
    }
    
    // Wait a bit more for the image to load
    await new Promise(r => setTimeout(r, 1000));
    
    const firstImageUrl = imagePage.url();
    
    // Close the image tab if it's a new tab
    if (imagePage !== page) {
      await imagePage.close();
    }
    
    if (!firstImageUrl) {
      console.error(`No image found for ${normalizedQuery}`);
      return null;
    }
    
    console.log(`Found image URL: ${firstImageUrl}`);
    
    // Download and save the image
    const savedPath = await downloadAndSaveImage(firstImageUrl, normalizedQuery);
    
    if (savedPath) {
      console.log(`Logo saved successfully: ${savedPath}`);
      return savedPath;
    }
    
    console.log(`Logo scraping completed for: ${normalizedQuery}`);
    return null;
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

