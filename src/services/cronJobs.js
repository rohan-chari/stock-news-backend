const cron = require('node-cron');
const stockSyncService = require('./stockSyncService');

/**
 * Cron Jobs Service
 * Manages all scheduled cron jobs for the application
 */

/**
 * Initialize and start all cron jobs
 */
const initializeCronJobs = () => {
  console.log('Initializing cron jobs...');

  // Schedule stock sync job: Every Sunday at 3:00 AM
  // Cron format: minute hour day-of-month month day-of-week
  // 0 3 * * 0 = 0 minutes, 3 hours, any day of month, any month, Sunday (0)
  cron.schedule('0 3 * * 0', async () => {
    console.log('Stock sync cron job triggered at', new Date().toISOString());
    
    try {
      await stockSyncService.syncStocksWithLogos();
      console.log('Stock sync cron job completed successfully');
    } catch (error) {
      console.error('Stock sync cron job failed:', error);
      // Error is already logged in the service, but we log here too for cron context
    }
  }, {
    scheduled: true,
    timezone: 'America/New_York', // Adjust timezone as needed
  });

  console.log('Cron jobs initialized:');
  console.log('  - Stock sync: Every Sunday at 3:00 AM');
};

/**
 * Stop all cron jobs (useful for graceful shutdown)
 */
const stopCronJobs = () => {
  // node-cron doesn't have a built-in way to stop all jobs
  // This is a placeholder for future implementation if needed
  console.log('Stopping cron jobs...');
};

module.exports = {
  initializeCronJobs,
  stopCronJobs,
};

