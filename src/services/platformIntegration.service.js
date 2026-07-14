const PlatformIntegrationRepository = require('../repositories/platformIntegration.repository');
const MenuItem = require('../models/menuItem.model');
const AppError = require('../exceptions/AppError');
const { encrypt, decrypt } = require('../utils/fieldEncryption.util');
const logger = require('../utils/logger');

class PlatformIntegrationService {
  /**
   * Configures or updates a platform integration for a restaurant.
   * Encrypts the raw credentials before storage.
   */
  async configureIntegration(restaurantId, data) {
    const { platform, externalRestaurantId, credentials, syncSettings } = data;

    // Encrypt sensitive credential tokens
    const encryptedCredentials = {
      accessTokenEnc: encrypt(credentials.accessToken),
      refreshTokenEnc: credentials.refreshToken ? encrypt(credentials.refreshToken) : null,
      expiresAt: credentials.expiresAt || null,
    };

    const existing = await PlatformIntegrationRepository.findByPlatform(restaurantId, platform);

    if (existing) {
      logger.info({ restaurantId, platform }, 'Updating existing platform integration');
      const updated = await PlatformIntegrationRepository.update(restaurantId, existing._id, {
        externalRestaurantId,
        credentials: encryptedCredentials,
        syncSettings: syncSettings || existing.syncSettings,
        status: 'active',
        isDeleted: false,
        deletedAt: null,
      });
      return updated;
    }

    logger.info({ restaurantId, platform }, 'Configuring new platform integration');
    const created = await PlatformIntegrationRepository.create(restaurantId, {
      platform,
      externalRestaurantId,
      credentials: encryptedCredentials,
      syncSettings,
      status: 'active',
    });
    return created;
  }

  /**
   * Fetches all integrations for a restaurant, decrypting or redacting credentials based on user role.
   */
  async getIntegrations(restaurantId, userRole) {
    const integrations = await PlatformIntegrationRepository.findAll(restaurantId);

    return integrations.map((integration) => {
      const integrationObj = integration.toObject();

      if (userRole === 'owner') {
        // Decrypt credentials for the owner
        integrationObj.credentials = {
          accessToken: decrypt(integration.credentials.accessTokenEnc),
          refreshToken: integration.credentials.refreshTokenEnc 
            ? decrypt(integration.credentials.refreshTokenEnc) 
            : null,
          expiresAt: integration.credentials.expiresAt,
        };
      } else {
        // Redact credentials for managers/chefs/servers
        integrationObj.credentials = {
          accessToken: '[REDACTED]',
          refreshToken: '[REDACTED]',
          expiresAt: integration.credentials.expiresAt,
        };
      }

      return integrationObj;
    });
  }

  /**
   * Updates an integration's sync settings or status.
   */
  async updateIntegration(restaurantId, id, updateData) {
    const integration = await PlatformIntegrationRepository.findById(restaurantId, id);
    if (!integration) {
      throw new AppError(404, 'Platform integration not found.');
    }

    const payload = {};

    if (updateData.syncSettings) {
      payload.syncSettings = {
        ...(integration.syncSettings ? integration.syncSettings.toObject() : {}),
        ...updateData.syncSettings,
      };
    }

    if (updateData.status) {
      payload.status = updateData.status;
    }

    if (updateData.externalRestaurantId) {
      payload.externalRestaurantId = updateData.externalRestaurantId;
    }

    if (updateData.credentials) {
      payload.credentials = {
        accessTokenEnc: updateData.credentials.accessToken 
          ? encrypt(updateData.credentials.accessToken) 
          : integration.credentials.accessTokenEnc,
        refreshTokenEnc: updateData.credentials.refreshToken 
          ? encrypt(updateData.credentials.refreshToken) 
          : integration.credentials.refreshTokenEnc,
        expiresAt: updateData.credentials.expiresAt !== undefined 
          ? updateData.credentials.expiresAt 
          : integration.credentials.expiresAt,
      };
    }

    const updated = await PlatformIntegrationRepository.update(restaurantId, id, payload);
    return updated;
  }

  /**
   * Simulates a mock Menu Sync pipeline.
   * Finds all menu items mapped to this platform and updates their syncedAt field in the DB.
   */
  async syncMenu(restaurantId, id) {
    const integration = await PlatformIntegrationRepository.findById(restaurantId, id);
    if (!integration) {
      throw new AppError(404, 'Platform integration not found.');
    }

    if (integration.status !== 'active') {
      throw new AppError(400, 'Cannot sync menu for an inactive or suspended integration.');
    }

    if (!integration.syncSettings.menuSync) {
      throw new AppError(400, 'Menu synchronization is disabled in settings.');
    }

    const platform = integration.platform;

    // Find all menu items for the restaurant
    const items = await MenuItem.find({ restaurantId, isDeleted: false });

    let syncedCount = 0;
    const syncTime = new Date();

    for (const item of items) {
      const mapping = item.platformMappings?.[platform];
      if (mapping && mapping.itemId && mapping.status === 'active') {
        item.platformMappings[platform].syncedAt = syncTime;
        item.markModified('platformMappings');
        await item.save();
        syncedCount++;
      }
    }

    // Update lastSyncedAt on the integration record
    integration.lastSyncedAt = syncTime;
    await integration.save();

    logger.info(
      { restaurantId, platform, syncedCount },
      'Successfully completed mock menu synchronization'
    );

    return {
      syncedItemsCount: syncedCount,
      lastSyncedAt: syncTime,
    };
  }
}

module.exports = new PlatformIntegrationService();
