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
      
      console.log(`Saved data URL image: ${filename}`);
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
    
    // Console log only the src link
    console.log('Image Src:', imageSrc);
    
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
        console.log(`Logo saved successfully: ${savedPath}`);
        return savedPath;
      }
    }
     
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

