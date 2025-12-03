const puppeteer = require('puppeteer');

/**
 * Browser Manager
 * Singleton pattern to manage a shared Puppeteer browser instance
 * Reuses the same browser across all requests, creates new pages per request
 */
class BrowserManager {
  constructor() {
    this.browser = null;
    this.initializing = false;
    this.initPromise = null;
  }

  /**
   * Initialize browser instance (call on server start)
   * @returns {Promise<puppeteer.Browser>}
   */
  async initialize() {
    // If browser already exists and is connected, return it
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    // If browser is currently being initialized, wait for it
    if (this.initializing && this.initPromise) {
      return this.initPromise;
    }

    // Start initialization
    this.initializing = true;
    this.initPromise = this._initializeBrowser();

    try {
      this.browser = await this.initPromise;
      return this.browser;
    } finally {
      this.initializing = false;
      this.initPromise = null;
    }
  }

  /**
   * Get browser instance (returns existing or initializes if needed)
   * @returns {Promise<puppeteer.Browser>}
   */
  async getBrowser() {
    // If browser already exists and is connected, return it
    if (this.browser && this.browser.isConnected()) {
      return this.browser;
    }

    // If browser is currently being initialized, wait for it
    if (this.initializing && this.initPromise) {
      return this.initPromise;
    }

    // Fallback: initialize if not already initialized
    return this.initialize();
  }

  /**
   * Initialize a new browser instance
   * @private
   * @returns {Promise<puppeteer.Browser>}
   */
  async _initializeBrowser() {
    console.log('Initializing browser instance...');
    
    try {
      const browser = await puppeteer.launch({
        headless: 'new', // Use new headless mode for better compatibility
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--disable-software-rasterizer',
        ],
        defaultViewport: { width: 1920, height: 1080 },
      });

      console.log('Browser initialized successfully');
      return browser;
    } catch (error) {
      console.error('Error initializing browser:', error.message);
      throw error;
    }
  }

  /**
   * Create a new page from the shared browser
   * @returns {Promise<puppeteer.Page>}
   */
  async createPage() {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    // Set viewport to full screen size
    await page.setViewport({ width: 1920, height: 1080 });
    return page;
  }

  /**
   * Close a page (cleanup)
   * @param {puppeteer.Page} page - Page to close
   */
  async closePage(page) {
    if (page && !page.isClosed()) {
      await page.close();
    }
  }

  /**
   * Close the browser instance
   * @returns {Promise<void>}
   */
  async closeBrowser() {
    if (this.browser) {
      console.log('Closing browser instance...');
      await this.browser.close();
      this.browser = null;
    }
  }

  /**
   * Check if browser is initialized and connected
   * @returns {boolean}
   */
  isBrowserReady() {
    return this.browser !== null && this.browser.isConnected();
  }
}

// Export singleton instance
const browserManager = new BrowserManager();

// Graceful shutdown handling
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, closing browser...');
  await browserManager.closeBrowser();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received, closing browser...');
  await browserManager.closeBrowser();
  process.exit(0);
});

module.exports = browserManager;

