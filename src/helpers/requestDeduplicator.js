/**
 * Request Deduplicator
 * Prevents multiple concurrent requests for the same resource
 * Returns the same promise for duplicate requests
 */
class RequestDeduplicator {
  constructor() {
    this.pendingRequests = new Map();
  }

  /**
   * Execute a request, deduplicating concurrent requests with the same key
   * @param {string} key - Unique key for the request
   * @param {Function} requestFn - Async function to execute
   * @returns {Promise<any>}
   */
  async execute(key, requestFn) {
    // If a request for this key is already pending, return the same promise
    if (this.pendingRequests.has(key)) {
      return this.pendingRequests.get(key);
    }

    // Create new request promise
    const requestPromise = (async () => {
      try {
        const result = await requestFn();
        return result;
      } finally {
        // Remove from pending requests when done
        this.pendingRequests.delete(key);
      }
    })();

    // Store the promise
    this.pendingRequests.set(key, requestPromise);

    return requestPromise;
  }

  /**
   * Check if a request is pending for the given key
   * @param {string} key - Request key
   * @returns {boolean}
   */
  hasPendingRequest(key) {
    return this.pendingRequests.has(key);
  }

  /**
   * Get count of pending requests
   * @returns {number}
   */
  getPendingCount() {
    return this.pendingRequests.size;
  }

  /**
   * Clear all pending requests (for testing/cleanup)
   */
  clear() {
    this.pendingRequests.clear();
  }
}

// Export singleton instance
const requestDeduplicator = new RequestDeduplicator();

module.exports = requestDeduplicator;

