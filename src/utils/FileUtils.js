const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * 文件操作工具类
 * 提供优化的文件操作方法，包括批量操作、原子写入、安全删除等功能
 * 
 * @class
 * @example
 * const FileUtils = require('./FileUtils');
 * 
 * // 安全读取JSON文件
 * const config = await FileUtils.readJsonSafe('config.json', {});
 * 
 * // 原子写入JSON文件
 * await FileUtils.writeJsonAtomic('config.json', config);
 * 
 * // 批量检查文件存在性
 * const results = await FileUtils.batchPathExists(['file1.txt', 'file2.txt']);
 */
class FileUtils {
  /**
   * 配置缓存实例，避免重复读取配置文件
   * @type {Map<string, {data: *, timestamp: number, ttl: number}>}
   * @private
   */
  static #configCache = new Map();
  
  /**
   * 目录大小缓存，避免重复计算目录大小
   * @type {Map<string, {size: number, timestamp: number, ttl: number}>}
   * @private
   */
  static #dirSizeCache = new Map();
  
  /**
   * 清除指定类型的缓存
   * 
   * @param {string} type - 缓存类型 ('config' | 'dirSize' | 'all')
   * @param {string} [key] - 特定缓存键（可选）
   * @returns {void}
   * 
   * @example
   * // 清除所有配置缓存
   * FileUtils.clearCache('config');
   * 
   * // 清除特定目录的大小缓存
   * FileUtils.clearCache('dirSize', '/path/to/directory');
   * 
   * // 清除所有缓存
   * FileUtils.clearCache('all');
   */
  static clearCache(type, key) {
    if (type === 'config' || type === 'all') {
      if (key) {
        this.#configCache.delete(key);
      } else {
        this.#configCache.clear();
      }
    }
    
    if (type === 'dirSize' || type === 'all') {
      if (key) {
        this.#dirSizeCache.delete(key);
      } else {
        this.#dirSizeCache.clear();
      }
    }
  }

  /**
   * 批量检查文件路径是否存在
   * 
   * @param {string[]} paths - 要检查的路径数组
   * @returns {Promise<Array<{path: string, exists: boolean}>>} 包含路径和存在状态的数组
   * 
   * @example
   * const results = await FileUtils.batchPathExists([
   *   '/path/to/file1.txt',
   *   '/path/to/file2.txt'
   * ]);
   * console.log(results);
   * // 输出: [
   * //   { path: '/path/to/file1.txt', exists: true },
   * //   { path: '/path/to/file2.txt', exists: false }
   * // ]
   */
  static async batchPathExists(paths) {
    const promises = paths.map(async (filePath) => {
      try {
        await fs.access(filePath);
        return { path: filePath, exists: true };
      } catch {
        return { path: filePath, exists: false };
      }
    });
    
    const results = await Promise.allSettled(promises);
    return results.map(result => 
      result.status === 'fulfilled' ? result.value : null
    ).filter(Boolean);
  }

  /**
   * 安全地读取JSON文件，文件不存在时返回默认值
   * 支持缓存机制，避免重复读取相同的配置文件
   * 
   * @param {string} filePath - 文件路径
   * @param {*} [defaultValue=null] - 默认值，文件不存在时返回
   * @param {Object} [options={}] - 读取选项
   * @param {boolean} [options.useCache=true] - 是否使用缓存
   * @param {number} [options.cacheTTL=300000] - 缓存时间（毫秒，默认5分钟）
   * @returns {Promise<*>} 解析后的JSON数据或默认值
   * @throws {Error} 当文件存在但JSON解析失败时抛出错误
   * 
   * @example
   * // 读取配置文件，不存在时返回空对象（使用缓存）
   * const config = await FileUtils.readJsonSafe('config.json', {});
   * 
   * // 读取用户数据，强制不使用缓存
   * const userData = await FileUtils.readJsonSafe('user.json', null, { useCache: false });
   * 
   * // 清除特定文件的缓存
   * FileUtils.clearCache('config', 'config.json');
   */
  static async readJsonSafe(filePath, defaultValue = null, options = {}) {
    const { useCache = true, cacheTTL = 300000 } = options;
    
    // 检查缓存
    if (useCache) {
      const cached = this.#configCache.get(filePath);
      if (cached && Date.now() - cached.timestamp < cacheTTL) {
        return cached.data;
      }
    }
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // 缓存结果
      if (useCache) {
        this.#configCache.set(filePath, {
          data,
          timestamp: Date.now(),
          ttl: cacheTTL
        });
      }
      
      return data;
    } catch (error) {
      if (error.code === 'ENOENT') {
        return defaultValue;
      }
      throw error;
    }
  }

  /**
   * 安全地写入JSON文件（带原子操作）
   * 使用临时文件确保写入操作的原子性，避免写入过程中的数据损坏
   * 写入成功后自动清除缓存，确保下次读取的是最新数据
   * 
   * @param {string} filePath - 文件路径
   * @param {*} data - 要写入的数据
   * @param {Object} [options={}] - 写入选项
   * @param {number} [options.mode=0o644] - 文件权限模式
   * @param {number} [options.spaces=2] - JSON格式化缩进空格数
   * @param {boolean} [options.clearCache=true] - 是否自动清除缓存
   * @returns {Promise<void>}
   * @throws {Error} 当写入失败时抛出错误，会自动清理临时文件
   * 
   * @example
   * // 基本写入（自动清除缓存）
   * await FileUtils.writeJsonAtomic('config.json', { key: 'value' });
   * 
   * // 自定义权限和格式化
   * await FileUtils.writeJsonAtomic('config.json', data, {
   *   mode: 0o600,  // 仅所有者可读写
   *   spaces: 4     // 4空格缩进
   * });
   */
  static async writeJsonAtomic(filePath, data, options = {}) {
    const { mode = 0o644, spaces = 2, clearCache = true } = options;
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    
    try {
      const content = JSON.stringify(data, null, spaces);
      await fs.writeFile(tempPath, content, { mode });
      await fs.rename(tempPath, filePath);
      
      // 写入成功后清除缓存
      if (clearCache) {
        this.#configCache.delete(filePath);
      }
    } catch (error) {
      // 清理临时文件
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * 确保目录存在，如果不存在则创建
   * 
   * @param {string} dirPath - 目录路径
   * @param {number} [mode=0o755] - 目录权限模式
   * @returns {Promise<void>}
   * 
   * @example
   * // 创建目录（默认权限 755）
   * await FileUtils.ensureDir('/path/to/directory');
   * 
   * // 创建私有目录（仅所有者可访问）
   * await FileUtils.ensureDir('/path/to/private', 0o700);
   */
  static async ensureDir(dirPath, mode = 0o755) {
    try {
      await fs.mkdir(dirPath, { recursive: true, mode });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * 流式计算文件哈希值，支持大文件处理
   * 使用流式读取避免内存问题，适合处理大文件
   * 
   * @param {string} filePath - 文件路径
   * @param {string} [algorithm='sha256'] - 哈希算法 ('md5', 'sha1', 'sha256', 'sha512')
   * @returns {Promise<string>} 文件的十六进制哈希值
   * @throws {Error} 当文件不存在或读取失败时抛出错误
   * 
   * @example
   * // 计算文件的SHA256哈希
   * const hash = await FileUtils.hashFile('large-file.zip');
   * console.log('SHA256:', hash);
   * 
   * // 计算文件的MD5哈希
   * const md5 = await FileUtils.hashFile('file.txt', 'md5');
   * console.log('MD5:', md5);
   */
  static async hashFile(filePath, algorithm = 'sha256') {
    const hash = crypto.createHash(algorithm);
    const stream = require('fs').createReadStream(filePath, { highWaterMark: 1024 * 1024 });
    
    for await (const chunk of stream) {
      hash.update(chunk);
    }
    
    return hash.digest('hex');
  }

  /**
   * 安全删除文件或目录，路径不存在时静默忽略
   * 
   * @param {string} targetPath - 要删除的文件或目录路径
   * @returns {Promise<void>}
   * 
   * @example
   * // 删除文件
   * await FileUtils.safeRemove('/path/to/file.txt');
   * 
   * // 删除目录及其内容
   * await FileUtils.safeRemove('/path/to/directory');
   * 
   * // 删除不存在的路径（不会报错）
   * await FileUtils.safeRemove('/nonexistent/path');
   */
  static async safeRemove(targetPath) {
    try {
      const stats = await fs.lstat(targetPath);
      if (stats.isDirectory()) {
        await fs.rm(targetPath, { recursive: true, force: true });
      } else {
        await fs.unlink(targetPath);
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * 递归复制文件或目录
   * 
   * @param {string} source - 源文件或目录路径
   * @param {string} destination - 目标文件或目录路径
   * @returns {Promise<void>}
   * @throws {Error} 当源路径不存在或复制失败时抛出错误
   * 
   * @example
   * // 复制文件
   * await FileUtils.copy('/path/to/source.txt', '/path/to/destination.txt');
   * 
   * // 复制目录（递归复制所有内容）
   * await FileUtils.copy('/path/to/source-dir', '/path/to/destination-dir');
   */
  static async copy(source, destination) {
    const stats = await fs.lstat(source);
    
    if (stats.isDirectory()) {
      await FileUtils.ensureDir(destination);
      const items = await fs.readdir(source);
      
      for (const item of items) {
        const srcPath = path.join(source, item);
        const destPath = path.join(destination, item);
        await FileUtils.copy(srcPath, destPath);
      }
    } else {
      await fs.copyFile(source, destination);
    }
  }

  /**
   * 递归计算目录的总大小（包含所有子目录和文件）
   * 支持缓存机制，避免重复计算相同的目录大小
   * 
   * @param {string} dirPath - 目录路径
   * @param {Object} [options={}] - 计算选项
   * @param {boolean} [options.useCache=true] - 是否使用缓存
   * @param {number} [options.cacheTTL=60000] - 缓存时间（毫秒，默认1分钟）
   * @param {number} [options.maxConcurrency=10] - 最大并发数，避免内存问题
   * @returns {Promise<number>} 目录总大小（字节）
   * @throws {Error} 当目录不存在或无法访问时抛出错误
   * 
   * @example
   * // 计算目录大小（使用缓存）
   * const size = await FileUtils.getDirectorySize('/path/to/directory');
   * console.log(`目录大小: ${size} 字节`);
   * console.log(`目录大小: ${(size / 1024 / 1024).toFixed(2)} MB`);
   * 
   * // 强制重新计算
   * const freshSize = await FileUtils.getDirectorySize('/path/to/directory', { useCache: false });
   */
  static async getDirectorySize(dirPath, options = {}) {
    const { useCache = true, cacheTTL = 60000, maxConcurrency = 10 } = options;
    
    // 检查缓存
    if (useCache) {
      const cached = this.#dirSizeCache.get(dirPath);
      if (cached && Date.now() - cached.timestamp < cacheTTL) {
        return cached.size;
      }
    }
    
    let totalSize = 0;
    const processingQueue = [];
    let activePromises = 0;
    
    async function calculateSize(currentPath) {
      activePromises++;
      
      try {
        const stats = await fs.lstat(currentPath);
        
        if (stats.isDirectory()) {
          const items = await fs.readdir(currentPath);
          
          // 使用队列控制并发数，避免内存问题
          for (const item of items) {
            const itemPath = path.join(currentPath, item);
            
            if (activePromises >= maxConcurrency) {
              await new Promise(resolve => {
                processingQueue.push(resolve);
              });
            }
            
            await calculateSize(itemPath);
          }
        } else {
          totalSize += stats.size;
        }
      } finally {
        activePromises--;
        
        // 处理等待队列
        if (processingQueue.length > 0 && activePromises < maxConcurrency) {
          const nextResolve = processingQueue.shift();
          nextResolve();
        }
      }
    }
    
    await calculateSize(dirPath);
    
    // 缓存结果
    if (useCache) {
      this.#dirSizeCache.set(dirPath, {
        size: totalSize,
        timestamp: Date.now(),
        ttl: cacheTTL
      });
    }
    
    return totalSize;
  }
}

module.exports = FileUtils;