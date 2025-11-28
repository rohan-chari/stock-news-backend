/**
 * Base Model class
 * Provides common model functionality
 * Can be extended by specific models
 */
class BaseModel {
  constructor(data = {}) {
    Object.assign(this, data);
  }

  /**
   * Convert model to plain object
   * @returns {Object}
   */
  toJSON() {
    return { ...this };
  }

  /**
   * Validate model data
   * Override in child classes
   * @returns {boolean}
   */
  validate() {
    return true;
  }
}

module.exports = BaseModel;

