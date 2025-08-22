const ConfigStorage = require('./ConfigStorage');

class ProviderManager {
  constructor() {
    this.configStorage = new ConfigStorage();
  }

  /**
   * 添加新的服务商配置
   */
  async addProvider(name, config) {
    try {
      // 确保配置目录存在
      await this.configStorage.initialize();

      const providers = await this.configStorage.listProviders({
        includeMetadata: false,
      });

      if (providers[name]) {
        throw new Error(`服务商 "${name}" 已存在`);
      }

      // 检查别名冲突
      const existingAlias = Object.values(providers).find(
        p => p.alias === config.alias
      );
      if (existingAlias) {
        throw new Error(`别名 "${config.alias}" 已被使用`);
      }

      await this.configStorage.writeProvider(name, config);
      return true;
    } catch (error) {
      throw new Error(`添加服务商失败: ${error.message}`);
    }
  }

  /**
   * 获取所有服务商配置
   */
  async getProviders() {
    try {
      await this.configStorage.initialize();
      return await this.configStorage.listProviders({ includeMetadata: true });
    } catch (error) {
      return {};
    }
  }

  /**
   * 获取指定服务商配置
   */
  async getProvider(name) {
    try {
      await this.configStorage.initialize();
      return await this.configStorage.readProvider(name);
    } catch (error) {
      throw new Error(`获取服务商配置失败: ${error.message}`);
    }
  }

  /**
   * 更新服务商配置
   */
  async updateProvider(name, updates) {
    try {
      await this.configStorage.initialize();
      const providers = await this.configStorage.listProviders({
        includeMetadata: false,
      });

      if (!providers[name]) {
        throw new Error(`服务商 "${name}" 不存在`);
      }

      // 获取当前配置
      const currentConfig = await this.configStorage.readProvider(name);

      // 检查别名冲突 (如果要更新别名)
      if (updates.alias && updates.alias !== currentConfig.alias) {
        const existingAlias = Object.values(providers).find(
          p => p.alias === updates.alias
        );
        if (existingAlias) {
          throw new Error(`别名 "${updates.alias}" 已被使用`);
        }
      }

      // 合并更新
      const updatedConfig = {
        ...currentConfig,
        ...updates,
      };

      await this.configStorage.writeProvider(name, updatedConfig);
      return true;
    } catch (error) {
      throw new Error(`更新服务商配置失败: ${error.message}`);
    }
  }

  /**
   * 删除服务商配置
   */
  async removeProvider(name) {
    try {
      await this.configStorage.initialize();
      const providers = await this.configStorage.listProviders({
        includeMetadata: false,
      });

      if (!providers[name]) {
        throw new Error(`服务商 "${name}" 不存在`);
      }

      const success = await this.configStorage.removeProvider(name);
      if (!success) {
        throw new Error(`删除服务商 "${name}" 失败`);
      }

      return true;
    } catch (error) {
      throw new Error(`删除服务商失败: ${error.message}`);
    }
  }

  /**
   * 启用/禁用服务商
   */
  async toggleProvider(name, enabled) {
    try {
      return await this.updateProvider(name, { enabled });
    } catch (error) {
      throw new Error(
        `${enabled ? '启用' : '禁用'}服务商失败: ${error.message}`
      );
    }
  }

  /**
   * 测试服务商连接
   */
  async testProvider(name) {
    try {
      const provider = await this.getProvider(name);

      if (!provider.apiKey) {
        return {
          success: false,
          message: '缺少API密钥',
          details: null,
        };
      }

      // 基础的URL验证
      try {
        new URL(provider.baseURL);
      } catch {
        return {
          success: false,
          message: '无效的Base URL格式',
          details: null,
        };
      }

      return {
        success: true,
        message: '配置验证通过',
        details: {
          alias: provider.alias,
          baseURL: provider.baseURL,
          timeout: provider.timeout,
          hasApiKey: Boolean(provider.apiKey),
          enabled: provider.enabled,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `连接测试失败: ${error.message}`,
        details: null,
      };
    }
  }

  /**
   * 获取服务商统计信息
   */
  async getStats() {
    try {
      const providers = await this.getProviders();

      const stats = {
        total: Object.keys(providers).length,
        enabled: Object.values(providers).filter(p => p.enabled).length,
        disabled: Object.values(providers).filter(p => !p.enabled).length,
        withApiKey: Object.values(providers).filter(p => p.apiKey).length,
        aliases: Object.values(providers).map(p => p.alias),
      };

      return stats;
    } catch (error) {
      throw new Error(`获取统计信息失败: ${error.message}`);
    }
  }

  /**
   * 列出所有别名
   */
  async listAliases() {
    try {
      const providers = await this.getProviders();
      return Object.values(providers)
        .filter(p => p.enabled)
        .map(p => ({
          alias: p.alias,
          description: p.description || `${p.baseURL} 服务商`,
        }));
    } catch (error) {
      throw new Error(`获取别名列表失败: ${error.message}`);
    }
  }

  /**
   * 检查别名是否可用
   */
  async isAliasAvailable(alias) {
    try {
      const providers = await this.getProviders();
      return !Object.values(providers).some(p => p.alias === alias);
    } catch (error) {
      return true; // 如果读取失败，假设别名可用
    }
  }

  /**
   * 获取推荐的别名
   */
  async suggestAlias(baseName) {
    try {
      let counter = 1;
      let suggested = baseName;

      while (!(await this.isAliasAvailable(suggested))) {
        suggested = `${baseName}${counter}`;
        counter++;

        // 防止无限循环
        if (counter > 100) {
          suggested = `${baseName}_${Date.now()}`;
          break;
        }
      }

      return suggested;
    } catch (error) {
      return `${baseName}_${Date.now()}`;
    }
  }

  /**
   * 导出服务商配置
   */
  async exportConfig(name = null, options = {}) {
    try {
      await this.configStorage.initialize();

      if (name) {
        const provider = await this.configStorage.readProvider(name);
        return { [name]: provider };
      }

      // 使用 ConfigStorage 的批量导出功能
      const exportData = await this.configStorage.batchExport(options);
      return exportData.providers;
    } catch (error) {
      throw new Error(`导出配置失败: ${error.message}`);
    }
  }

  /**
   * 导入服务商配置
   */
  async importConfig(configData, options = {}) {
    try {
      await this.configStorage.initialize();

      // 使用 ConfigStorage 的批量导入功能
      const result = await this.configStorage.batchImport(configData, options);

      return {
        imported: result.results.filter(r => r.success).map(r => r.name),
        skipped: [], // ConfigStorage 处理跳过逻辑
        errors: result.results
          .filter(r => !r.success)
          .map(r => ({
            name: r.name,
            error: r.error,
          })),
        total: result.results.length,
        successful: result.successful,
        failed: result.failed,
      };
    } catch (error) {
      throw new Error(`导入配置失败: ${error.message}`);
    }
  }
}

module.exports = ProviderManager;
