const mongoose = require('mongoose');

/**
 * Utility to run operations within a MongoDB transaction.
 * Automatically falls back to standard execution if transactions are disabled
 * (e.g. running on a local standalone MongoDB instance that isn't a replica set).
 * 
 * @param {Function} callback - Async callback containing database operations: (session) => Promise<any>
 * @returns {Promise<any>} The result returned by the callback
 */
async function runTransaction(callback) {
  // We can disable transactions locally by setting MONGODB_USE_TRANSACTIONS=false in .env
  const useTransactions = process.env.MONGODB_USE_TRANSACTIONS !== 'false';

  if (!useTransactions) {
    // Run normal execution without transaction session
    return callback(null);
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const result = await callback(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = {
  runTransaction,
};
