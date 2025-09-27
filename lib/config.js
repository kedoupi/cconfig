const fs = require('fs-extra');
const path = require('path');
const os = require('os');

// Configuration constants
const resolveBaseDir = () => {
  if (process.env.CCONFIG_HOME) {
    return process.env.CCONFIG_HOME;
  }
  return path.join(os.homedir(), '.cconfig');
};

const getConfigPaths = () => {
  const baseDir = resolveBaseDir();

  return {
    CONFIG_DIR: baseDir,
    PROVIDERS_DIR: path.join(baseDir, 'providers'),
    CONFIG_FILE: path.join(baseDir, 'config.json')
  };
};

const { CONFIG_DIR, PROVIDERS_DIR, CONFIG_FILE } = getConfigPaths();

// Legacy path for migration
const LEGACY_CLAUDE_DIR = path.join(os.homedir(), '.claude');
const LEGACY_CONFIG_DIR = path.join(LEGACY_CLAUDE_DIR, 'cconfig');

// Utility functions
/**
 * 检查当前操作系统是否为 Windows
 * @returns {boolean} 如果是 Windows 返回 true，否则返回 false
 */
function isWindows() {
  return process.platform === 'win32';
}

/**
 * 验证别名格式是否符合要求
 * @param {string} alias - 要验证的别名
 * @throws {Error} 别名格式不正确时抛出错误
 */
function validateAlias(alias) {
  const ALIAS_RE = /^[a-zA-Z0-9_-]{1,64}$/;
  if (!alias || !ALIAS_RE.test(alias)) {
    throw new Error('别名仅允许字母、数字、下划线、短横线，且长度<=64');
  }
}

function getProviderFile(alias) {
  validateAlias(alias);
  const file = path.join(PROVIDERS_DIR, `${alias}.json`);
  // Basic path safety (defense-in-depth after regex)
  const resolved = path.resolve(file);
  const providersRoot = path.resolve(PROVIDERS_DIR) + path.sep;
  if (!resolved.startsWith(providersRoot)) {
    throw new Error('非法的别名导致的路径问题');
  }
  return file;
}

function validateApiUrlSecure(urlStr) {
  try {
    const url = new URL(urlStr);
    const protocol = url.protocol;
    if (protocol !== 'http:' && protocol !== 'https:') {
      return '请输入有效的 HTTP 或 HTTPS URL';
    }
    return true;
  } catch {
    return '请输入有效的 URL 格式';
  }
}

function formatRelativeTime(isoStr) {
  try {
    if (!isoStr) {
      return '-';
    }
    const t = new Date(isoStr).getTime();
    if (Number.isNaN(t)) {
      return '-';
    }
    const now = Date.now();
    const diffSec = Math.max(0, Math.floor((now - t) / 1000));
    if (diffSec < 60) {
      return '刚刚';
    }
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) {
      return `${diffMin} 分钟前`;
    }
    const diffHour = Math.floor(diffMin / 60);
    if (diffHour < 24) {
      return `${diffHour} 小时前`;
    }
    const diffDay = Math.floor(diffHour / 24);
    if (diffDay < 7) {
      return `${diffDay} 天前`;
    }
    return new Date(isoStr).toLocaleString();
  } catch {
    return '-';
  }
}

function truncateMiddle(str, maxLen) {
  // 防御性编程：类型和边界检查
  if (typeof str !== 'string') {
    return String(str || '');
  }

  // 确保 maxLen 是有效数字
  maxLen = typeof maxLen === 'number' && maxLen > 0 ? maxLen : 50;

  if (str.length <= maxLen) {
    return str;
  }
  if (maxLen <= 3) {
    return str.slice(0, maxLen);
  }
  const half = Math.floor((maxLen - 3) / 2);
  return (
    str.slice(0, half) + '...' + str.slice(str.length - (maxLen - 3 - half))
  );
}

// Migration functionality
async function migrateFromLegacyPath() {
  const legacyExists = await fs.pathExists(LEGACY_CONFIG_DIR);
  const newExists = await fs.pathExists(CONFIG_DIR);

  if (legacyExists && !newExists) {
    console.log('🔄 检测到旧配置目录，正在迁移到新位置...');

    try {
      // Create new directory structure
      await fs.ensureDir(CONFIG_DIR);

      // Copy all files from legacy directory
      await fs.copy(LEGACY_CONFIG_DIR, CONFIG_DIR);

      console.log(`✅ 配置已成功迁移: ${LEGACY_CONFIG_DIR} → ${CONFIG_DIR}`);

      // Ask user if they want to remove old directory
      console.log(`💡 旧配置目录 ${LEGACY_CONFIG_DIR} 已保留，您可以手动删除`);

      return true;
    } catch (error) {
      console.error(`❌ 配置迁移失败: ${error.message}`);
      console.error(`请手动将 ${LEGACY_CONFIG_DIR} 复制到 ${CONFIG_DIR}`);
      throw error;
    }
  }

  return false;
}

// Ensure directories exist
async function ensureDirectories() {
  try {
    // First try migration if needed
    await migrateFromLegacyPath();

    await fs.ensureDir(CONFIG_DIR);
    await fs.ensureDir(PROVIDERS_DIR);

    // 安全地检查和创建配置文件
    try {
      if (!(await fs.pathExists(CONFIG_FILE))) {
        await fs.writeJson(CONFIG_FILE, { defaultProvider: null });
      } else {
        // 验证现有配置文件的格式
        const existingConfig = await fs.readJson(CONFIG_FILE);
        if (!existingConfig || typeof existingConfig !== 'object') {
          console.warn('配置文件格式异常，重新初始化...');
          await fs.writeJson(CONFIG_FILE, { defaultProvider: null });
        }
      }
    } catch (configError) {
      console.warn(`配置文件操作警告: ${configError.message}，使用默认配置`);
      await fs.writeJson(CONFIG_FILE, { defaultProvider: null });
    }
  } catch (error) {
    throw new Error(`配置初始化失败: ${error.message}`);
  }
}

module.exports = {
  CONFIG_DIR,
  PROVIDERS_DIR,
  CONFIG_FILE,
  LEGACY_CONFIG_DIR,
  isWindows,
  validateAlias,
  getProviderFile,
  validateApiUrlSecure,
  formatRelativeTime,
  truncateMiddle,
  ensureDirectories,
  migrateFromLegacyPath,
};
