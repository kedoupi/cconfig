const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

/**
 * 文件操作工具类
 * 提供优化的文件操作方法
 */
class FileUtils {
  /**
   * 批量检查文件路径是否存在
   * @param {string[]} paths - 要检查的路径数组
   * @returns {Promise<Array>} 包含路径和存在状态的数组
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
   * 安全地读取JSON文件
   * @param {string} filePath - 文件路径
   * @param {*} defaultValue - 默认值
   * @returns {Promise<*>} 解析后的JSON或默认值
   */
  static async readJsonSafe(filePath, defaultValue = null) {
    try {
      const content = await fs.readFile(filePath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return defaultValue;
      }
      throw error;
    }
  }

  /**
   * 安全地写入JSON文件（带原子操作）
   * @param {string} filePath - 文件路径
   * @param {*} data - 要写入的数据
   * @param {Object} options - 选项
   */
  static async writeJsonAtomic(filePath, data, options = {}) {
    const { mode = 0o644, spaces = 2 } = options;
    const tempPath = `${filePath}.tmp.${Date.now()}`;
    
    try {
      const content = JSON.stringify(data, null, spaces);
      await fs.writeFile(tempPath, content, { mode });
      await fs.rename(tempPath, filePath);
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
   * 确保目录存在
   * @param {string} dirPath - 目录路径
   * @param {number} mode - 权限模式
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
   * 流式计算文件哈希
   * @param {string} filePath - 文件路径
   * @param {string} algorithm - 哈希算法
   * @returns {Promise<string>} 文件哈希值
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
   * 安全删除文件或目录
   * @param {string} targetPath - 要删除的路径
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
   * 复制文件或目录
   * @param {string} source - 源路径
   * @param {string} destination - 目标路径
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
   * 获取目录大小
   * @param {string} dirPath - 目录路径
   * @returns {Promise<number>} 目录大小（字节）
   */
  static async getDirectorySize(dirPath) {
    let totalSize = 0;
    
    async function calculateSize(currentPath) {
      const stats = await fs.lstat(currentPath);
      
      if (stats.isDirectory()) {
        const items = await fs.readdir(currentPath);
        await Promise.all(items.map(item => 
          calculateSize(path.join(currentPath, item))
        ));
      } else {
        totalSize += stats.size;
      }
    }
    
    await calculateSize(dirPath);
    return totalSize;
  }
}

module.exports = FileUtils;