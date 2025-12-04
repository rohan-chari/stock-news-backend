require('dotenv').config();
const stockSyncService = require('../services/stockSyncService');

/**
 * Manual script to sync all US common stocks from Finnhub
 * Run with: node src/scripts/syncStocks.js
 */

(async () => {
  try {
    console.log('Starting manual stock sync...');
    const stats = await stockSyncService.syncStocksWithLogos();
    console.log('\nSync completed successfully!');
    console.log('Statistics:', stats);
    process.exit(0);
  } catch (error) {
    console.error('\nSync failed:', error);
    process.exit(1);
  }
})();

