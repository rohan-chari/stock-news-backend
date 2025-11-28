/**
 * Example Service
 * Contains business logic for example operations
 * Services handle the core business logic, separate from HTTP concerns
 */

/**
 * Example service function
 * @param {string} id - Example identifier
 * @returns {Promise<Object>} - Example data
 */
const getExampleById = async (id) => {
  // Simulate async operation (e.g., database query)
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id,
        name: 'Example Item',
        description: 'This is an example service response',
        createdAt: new Date().toISOString(),
      });
    }, 100);
  });
};

/**
 * Create example item
 * @param {Object} data - Item data
 * @returns {Promise<Object>} - Created item
 */
const createExample = async (data) => {
  // Simulate async operation (e.g., database insert)
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve({
        id: Date.now().toString(),
        ...data,
        createdAt: new Date().toISOString(),
      });
    }, 100);
  });
};

module.exports = {
  getExampleById,
  createExample,
};

