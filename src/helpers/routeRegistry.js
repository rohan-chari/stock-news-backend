/**
 * Route Registry Helper
 * Maintains a registry of all application routes
 */

const routes = [];

/**
 * Register a route
 * @param {string} method - HTTP method (GET, POST, etc.)
 * @param {string} path - Route path
 * @param {string} description - Route description
 */
const registerRoute = (method, path, description = '') => {
  routes.push({
    method: method.toUpperCase(),
    path,
    description,
  });
};

/**
 * Get all registered routes
 * @returns {Array} Array of route objects
 */
const getAllRoutes = () => {
  return [...routes];
};

/**
 * Get routes grouped by base path
 * @returns {Object} Routes grouped by base path
 */
const getRoutesByBasePath = () => {
  const grouped = {};
  routes.forEach((route) => {
    const basePath = route.path.split('/')[1] || 'root';
    if (!grouped[basePath]) {
      grouped[basePath] = [];
    }
    grouped[basePath].push({
      method: route.method,
      path: route.path,
      description: route.description,
    });
  });
  return grouped;
};

module.exports = {
  registerRoute,
  getAllRoutes,
  getRoutesByBasePath,
};

