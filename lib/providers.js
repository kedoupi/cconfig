const fs = require('fs-extra');
const path = require('path');
const {
  PROVIDERS_DIR,
  CONFIG_FILE,
  getProviderFile,
  isWindows,
  formatRelativeTime,
  truncateMiddle,
  ensureDirectories
} = require('./config');

// Provider operations
async function createProvider(alias, apiUrl, apiKey) {
  const provider = {
    alias,
    apiUrl,
    apiKey,
    createdAt: new Date().toISOString(),
  };

  const providerFile = getProviderFile(alias);
  await fs.writeJson(providerFile, provider);

  // Secure permissions (best-effort on non-Windows)
  if (!isWindows()) {
    try {
      await fs.chmod(providerFile, 0o600);
    } catch (e) {
      // 忽略权限设置失败（在非类 Unix 系统可能不支持）
    }
  }

  return provider;
}

async function updateProvider(alias, apiUrl, apiKey) {
  const providerFile = getProviderFile(alias);

  if (!(await fs.pathExists(providerFile))) {
    throw new Error(`Provider '${alias}' not found`);
  }

  const provider = await fs.readJson(providerFile);
  provider.apiUrl = apiUrl;
  if (apiKey && apiKey.trim()) {
    provider.apiKey = apiKey;
  }
  provider.updatedAt = new Date().toISOString();

  await fs.writeJson(providerFile, provider);
  if (!isWindows()) {
    try {
      await fs.chmod(providerFile, 0o600);
    } catch (e) {
      // 忽略权限设置失败
    }
  }

  return provider;
}

async function deleteProvider(alias) {
  const providerFile = getProviderFile(alias);

  if (!(await fs.pathExists(providerFile))) {
    throw new Error(`Provider '${alias}' not found`);
  }

  await fs.remove(providerFile);

  // 如果删除的是默认 provider，同步清空默认配置
  try {
    const config = await fs.readJson(CONFIG_FILE);
    if (config.defaultProvider === alias) {
      config.defaultProvider = null;
      await fs.writeJson(CONFIG_FILE, config);
      return { clearedDefault: true };
    }
  } catch (e) {
    // 忽略读取/写入配置失败
  }

  return { clearedDefault: false };
}

async function getProvider(alias) {
  const providerFile = getProviderFile(alias);

  if (!(await fs.pathExists(providerFile))) {
    throw new Error(`Provider '${alias}' not found`);
  }

  return await fs.readJson(providerFile);
}

async function listProviders() {
  await ensureDirectories();

  const files = await fs.readdir(PROVIDERS_DIR);
  const jsonFiles = files.filter(f => f.endsWith('.json'));

  if (jsonFiles.length === 0) {
    return [];
  }

  const config = await fs.readJson(CONFIG_FILE);
  const providers = [];

  for (const file of jsonFiles) {
    try {
      const provider = await fs.readJson(path.join(PROVIDERS_DIR, file));
      const isDefault = provider.alias === config.defaultProvider;
      const lastUsed = provider.lastUsed
        ? formatRelativeTime(provider.lastUsed)
        : '-';

      providers.push({
        ...provider,
        isDefault,
        lastUsedFormatted: lastUsed
      });
    } catch (e) {
      // 跳过无法读取的文件
    }
  }

  return providers;
}

async function setDefaultProvider(alias) {
  await ensureDirectories();

  const providerFile = getProviderFile(alias);
  if (!(await fs.pathExists(providerFile))) {
    throw new Error(`Provider '${alias}' not found`);
  }

  const config = await fs.readJson(CONFIG_FILE);
  config.defaultProvider = alias;
  await fs.writeJson(CONFIG_FILE, config);

  // 更新 lastUsed 字段
  try {
    const provider = await fs.readJson(providerFile);
    provider.lastUsed = new Date().toISOString();
    await fs.writeJson(providerFile, provider);
  } catch (e) {
    // 忽略 lastUsed 更新失败
  }

  return config;
}

async function getDefaultProvider() {
  await ensureDirectories();

  const config = await fs.readJson(CONFIG_FILE);
  return config.defaultProvider;
}

module.exports = {
  createProvider,
  updateProvider,
  deleteProvider,
  getProvider,
  listProviders,
  setDefaultProvider,
  getDefaultProvider,
};