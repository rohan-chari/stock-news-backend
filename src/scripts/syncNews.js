require('dotenv').config();
const newsService = require('../services/newsService');

(async () => {
  try {
    const result = await newsService.syncNewsForAllWatchlistStocks();
    if (result.success) {
      console.log('Success:', result);
      process.exit(0);
    } else {
      console.error('Failed:', result.error);
      process.exit(1);
    }
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
})();

