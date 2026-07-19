const MediaAsset = require('../../models/mediaAsset.model');

class MediaAssetRepository {
  /**
   * Registers a new uploaded media asset in the DB.
   * @param {string} restaurantId - Owning restaurant
   * @param {object} assetData - Image url, file ID and size
   * @param {object} [options={}] - Mongoose transaction/session options
   */
  async create(restaurantId, assetData, options = {}) {
    const asset = new MediaAsset({
      ...assetData,
      restaurantId,
    });
    return asset.save(options);
  }

  /**
   * Finds a media asset by ID.
   * @param {string} restaurantId - Owning restaurant
   * @param {string} id - Asset ID
   */
  async findById(restaurantId, id) {
    return MediaAsset.findOne({ _id: id, restaurantId });
  }

  /**
   * Finds a media asset by its ImageKit fileId.
   * @param {string} restaurantId - Owning restaurant
   * @param {string} fileId - ImageKit file ID
   */
  async findByFileId(restaurantId, fileId) {
    return MediaAsset.findOne({ fileId, restaurantId });
  }

  /**
   * Removes a media asset registration from the database (hard deletion from db).
   * @param {string} restaurantId - Owning restaurant
   * @param {string} id - Asset ID
   */
  async delete(restaurantId, id) {
    return MediaAsset.findOneAndDelete({ _id: id, restaurantId });
  }
}

module.exports = new MediaAssetRepository();
