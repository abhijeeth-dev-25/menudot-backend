const User = require('../../models/user.model');

class UserRepository {
  /**
   * Creates a new user document.
   * @param {object} userData - User attributes
   * @param {object} [options={}] - Query/session options
   * @returns {Promise<User>} The created user
   */
  async create(userData, options = {}) {
    const user = new User(userData);
    return user.save(options);
  }

  /**
   * Finds a user by ID.
   * @param {string} id - User ID
   * @param {object} [options={}] - Query options
   * @returns {Promise<User|null>}
   */
  async findById(id, options = {}) {
    return User.findById(id, null, options);
  }

  /**
   * Finds a user by Email (case-insensitive).
   * @param {string} email - Email address
   * @returns {Promise<User|null>}
   */
  async findByEmail(email) {
    return User.findOne({ email: email.toLowerCase() });
  }

  /**
   * Finds a user by Mobile.
   * @param {string} mobile - Mobile number
   * @returns {Promise<User|null>}
   */
  async findByMobile(mobile) {
    if (!mobile) return null;
    const cleanDigits = mobile.replace(/\D/g, '');
    if (!cleanDigits) return null;
    return User.findOne({
      $or: [
        { mobile },
        { mobile: { $regex: cleanDigits + '$' } }
      ]
    });
  }

  /**
   * Updates user document fields.
   * @param {string} id - User ID
   * @param {object} updateData - Update operations
   * @returns {Promise<User|null>} Updated user
   */
  async update(id, updateData, options = {}) {
    return User.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true, runValidators: true, ...options }
    );
  }

  /**
   * Soft deletes a user by setting isDeleted=true.
   * @param {string} id - User ID
   * @returns {Promise<User|null>} Deleted user
   */
  async delete(id) {
    return User.findByIdAndUpdate(
      id,
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { new: true }
    );
  }
}

module.exports = new UserRepository();
