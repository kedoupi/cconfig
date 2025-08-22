const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const https = require('https');
const { spawn } = require('child_process');
const chalk = require('chalk');

/**
 * 配置版本管理系统
 * 负责配置文件的版本检测、下载和更新
 */
class VersionManager {
  constructor(options = {}) {
    this.configDir = options.configDir || path.join(os.homedir(), '.cc-config');
    this.templatesDir = path.join(this.configDir, 'templates');
    this.cacheDir = path.join(this.configDir, '.cache');
    this.versionFile = path.join(this.configDir, 'version.json');
    
    // 远程配置源
    this.remoteRegistry = options.remoteRegistry || {
      baseUrl: 'https://raw.githubusercontent.com/anthropics/claude-code-kit/main',
      templatesPath: '/.claude-templates',
      versionPath: '/version.json'
    };
    
    // 当前版本信息
    this.currentVersion = require('../../package.json').version;
    this.lastCheck = null;
    this.checkInterval = options.checkInterval || 24 * 60 * 60 * 1000; // 24小时
  }

  /**
   * 初始化版本管理
   */
  async initialize() {
    try {
      await fs.ensureDir(this.templatesDir);
      await fs.ensureDir(this.cacheDir);
      
      // 初始化版本文件
      if (!await fs.pathExists(this.versionFile)) {
        await this.writeVersionInfo(this.getDefaultVersionInfo());
      }
      
      return true;
    } catch (error) {
      throw new Error(`版本管理初始化失败: ${error.message}`);
    }
  }

  /**
   * 检查远程版本更新
   */
  async checkForUpdates(options = {}) {
    try {
      const { force = false, includeTemplates = true } = options;
      
      // 检查是否需要检查更新
      const versionInfo = await this.readVersionInfo();
      const now = Date.now();
      
      if (!force && versionInfo.lastCheck) {
        const timeSinceLastCheck = now - new Date(versionInfo.lastCheck).getTime();
        if (timeSinceLastCheck < this.checkInterval) {
          return {
            updateAvailable: false,
            reason: 'Recently checked',
            nextCheck: new Date(new Date(versionInfo.lastCheck).getTime() + this.checkInterval)
          };
        }
      }

      // 获取远程版本信息
      const remoteVersion = await this.fetchRemoteVersion();
      const hasAppUpdate = this.compareVersions(remoteVersion.version, this.currentVersion) > 0;
      
      let hasTemplateUpdates = false;
      let templateChanges = [];
      
      if (includeTemplates) {
        const templateCheck = await this.checkTemplateUpdates(remoteVersion);
        hasTemplateUpdates = templateCheck.hasUpdates;
        templateChanges = templateCheck.changes;
      }

      // 更新检查时间
      versionInfo.lastCheck = new Date().toISOString();
      versionInfo.remoteVersion = remoteVersion;
      await this.writeVersionInfo(versionInfo);

      return {
        updateAvailable: hasAppUpdate || hasTemplateUpdates,
        appUpdate: {
          available: hasAppUpdate,
          current: this.currentVersion,
          latest: remoteVersion.version,
          changelog: remoteVersion.changelog || []
        },
        templateUpdates: {
          available: hasTemplateUpdates,
          changes: templateChanges
        },
        checkTime: new Date().toISOString()
      };
    } catch (error) {
      throw new Error(`检查更新失败: ${error.message}`);
    }
  }

  /**
   * 检查模板更新
   */
  async checkTemplateUpdates(remoteVersion) {
    try {
      const changes = [];
      const remoteTemplates = remoteVersion.templates || {};
      const localVersionInfo = await this.readVersionInfo();
      const localTemplates = localVersionInfo.templates || {};

      for (const [templateName, remoteInfo] of Object.entries(remoteTemplates)) {
        const localInfo = localTemplates[templateName];
        
        if (!localInfo) {
          // 新模板
          changes.push({
            type: 'new',
            name: templateName,
            description: remoteInfo.description || '新增模板'
          });
        } else if (remoteInfo.version !== localInfo.version) {
          // 版本更新
          changes.push({
            type: 'updated',
            name: templateName,
            oldVersion: localInfo.version,
            newVersion: remoteInfo.version,
            description: remoteInfo.description || '模板更新'
          });
        } else if (remoteInfo.checksum !== localInfo.checksum) {
          // 内容变更
          changes.push({
            type: 'modified',
            name: templateName,
            description: '模板内容已修改'
          });
        }
      }

      // 检查已删除的模板
      for (const templateName of Object.keys(localTemplates)) {
        if (!remoteTemplates[templateName]) {
          changes.push({
            type: 'removed',
            name: templateName,
            description: '模板已被移除'
          });
        }
      }

      return {
        hasUpdates: changes.length > 0,
        changes
      };
    } catch (error) {
      throw new Error(`检查模板更新失败: ${error.message}`);
    }
  }

  /**
   * 下载远程配置
   */
  async downloadUpdates(options = {}) {
    try {
      const {
        includeApp = true,
        includeTemplates = true,
        templates = [],
        backup = true
      } = options;

      const results = {
        app: { updated: false, error: null },
        templates: { updated: [], failed: [], skipped: [] },
        backup: null
      };

      // 创建备份
      if (backup) {
        const BackupManager = require('./BackupManager');
        const backupManager = new BackupManager();
        const backupResult = await backupManager.createBackup('更新前自动备份', {
          type: 'auto-update'
        });
        results.backup = backupResult.timestamp;
      }

      // 下载模板更新
      if (includeTemplates) {
        const updateCheck = await this.checkForUpdates({ includeTemplates: true });
        
        if (updateCheck.templateUpdates.available) {
          for (const change of updateCheck.templateUpdates.changes) {
            if (templates.length === 0 || templates.includes(change.name)) {
              try {
                await this.downloadTemplate(change.name);
                results.templates.updated.push(change.name);
              } catch (error) {
                results.templates.failed.push({
                  name: change.name,
                  error: error.message
                });
              }
            } else {
              results.templates.skipped.push(change.name);
            }
          }
        }
      }

      // 更新版本信息
      const versionInfo = await this.readVersionInfo();
      if (results.templates.updated.length > 0) {
        versionInfo.lastUpdate = new Date().toISOString();
        versionInfo.templates = versionInfo.templates || {};
        
        // 更新模板版本信息
        const remoteVersion = await this.fetchRemoteVersion();
        for (const templateName of results.templates.updated) {
          if (remoteVersion.templates && remoteVersion.templates[templateName]) {
            versionInfo.templates[templateName] = remoteVersion.templates[templateName];
          }
        }
        
        await this.writeVersionInfo(versionInfo);
      }

      return results;
    } catch (error) {
      throw new Error(`下载更新失败: ${error.message}`);
    }
  }

  /**
   * 下载单个模板
   */
  async downloadTemplate(templateName) {
    try {
      const remoteUrl = `${this.remoteRegistry.baseUrl}${this.remoteRegistry.templatesPath}/${templateName}`;
      const localPath = path.join(this.templatesDir, templateName);

      // 创建目录
      await fs.ensureDir(path.dirname(localPath));

      // 下载文件
      const content = await this.fetchRemoteFile(remoteUrl);
      
      // 验证内容
      if (!content || content.length === 0) {
        throw new Error(`下载的模板内容为空: ${templateName}`);
      }

      // 原子性写入
      const tempPath = `${localPath}.tmp`;
      await fs.writeFile(tempPath, content);
      await fs.move(tempPath, localPath);

      return {
        name: templateName,
        size: content.length,
        path: localPath
      };
    } catch (error) {
      throw new Error(`下载模板失败 ${templateName}: ${error.message}`);
    }
  }

  /**
   * 对比配置文件差异
   */
  async compareConfigs(localPath, remotePath) {
    try {
      const localExists = await fs.pathExists(localPath);
      const remoteExists = await fs.pathExists(remotePath);

      if (!localExists && !remoteExists) {
        return { type: 'none', changes: [] };
      }

      if (!localExists) {
        return { type: 'new', changes: ['文件新增'] };
      }

      if (!remoteExists) {
        return { type: 'removed', changes: ['文件已删除'] };
      }

      // 读取文件内容
      const localContent = await fs.readFile(localPath, 'utf8');
      const remoteContent = await fs.readFile(remotePath, 'utf8');

      if (localContent === remoteContent) {
        return { type: 'identical', changes: [] };
      }

      // 计算差异
      const changes = await this.calculateDiff(localContent, remoteContent);

      return {
        type: 'modified',
        changes,
        localSize: localContent.length,
        remoteSize: remoteContent.length
      };
    } catch (error) {
      throw new Error(`对比配置失败: ${error.message}`);
    }
  }

  /**
   * 实现增量更新
   */
  async performIncrementalUpdate(options = {}) {
    try {
      const {
        dryRun = false,
        includeTemplates = true,
        preserveUserConfig = true
      } = options;

      const updatePlan = {
        templates: [],
        configs: [],
        actions: []
      };

      // 检查可用更新
      const updateCheck = await this.checkForUpdates({ includeTemplates });

      if (!updateCheck.updateAvailable) {
        return {
          hasUpdates: false,
          plan: updatePlan,
          message: '没有可用更新'
        };
      }

      // 计划模板更新
      if (includeTemplates && updateCheck.templateUpdates.available) {
        for (const change of updateCheck.templateUpdates.changes) {
          const localPath = path.join(this.templatesDir, change.name);
          const userPath = path.join(os.homedir(), '.claude', change.name);
          
          let action = 'update';
          let notes = [];

          // 检查用户是否有自定义配置
          if (preserveUserConfig && await fs.pathExists(userPath)) {
            const userContent = await fs.readFile(userPath, 'utf8');
            const templateContent = await fs.pathExists(localPath) 
              ? await fs.readFile(localPath, 'utf8') 
              : '';

            if (userContent !== templateContent) {
              action = 'merge';
              notes.push('检测到用户自定义内容，将尝试合并');
            }
          }

          updatePlan.templates.push({
            name: change.name,
            type: change.type,
            action,
            notes,
            localPath,
            userPath
          });

          updatePlan.actions.push(`${action.toUpperCase()}: ${change.name}`);
        }
      }

      // 执行更新
      if (!dryRun && updatePlan.templates.length > 0) {
        const downloadResult = await this.downloadUpdates({
          includeTemplates: true,
          templates: updatePlan.templates.map(t => t.name)
        });

        return {
          hasUpdates: true,
          plan: updatePlan,
          result: downloadResult,
          executed: true
        };
      }

      return {
        hasUpdates: true,
        plan: updatePlan,
        executed: false,
        dryRun
      };
    } catch (error) {
      throw new Error(`增量更新失败: ${error.message}`);
    }
  }

  /**
   * 获取远程版本信息
   */
  async fetchRemoteVersion() {
    try {
      const versionUrl = `${this.remoteRegistry.baseUrl}${this.remoteRegistry.versionPath}`;
      const content = await this.fetchRemoteFile(versionUrl);
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`获取远程版本失败: ${error.message}`);
    }
  }

  /**
   * 下载远程文件
   */
  async fetchRemoteFile(url) {
    return new Promise((resolve, reject) => {
      const req = https.get(url, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }

        let data = '';
        res.on('data', chunk => {
          data += chunk;
        });

        res.on('end', () => {
          resolve(data);
        });
      });

      req.on('error', reject);
      req.setTimeout(30000, () => {
        req.destroy();
        reject(new Error('请求超时'));
      });
    });
  }

  /**
   * 比较版本号
   */
  compareVersions(version1, version2) {
    const v1Parts = version1.split('.').map(Number);
    const v2Parts = version2.split('.').map(Number);
    
    const maxLength = Math.max(v1Parts.length, v2Parts.length);
    
    for (let i = 0; i < maxLength; i++) {
      const v1Part = v1Parts[i] || 0;
      const v2Part = v2Parts[i] || 0;
      
      if (v1Part > v2Part) return 1;
      if (v1Part < v2Part) return -1;
    }
    
    return 0;
  }

  /**
   * 计算文件差异
   */
  async calculateDiff(content1, content2) {
    // 简单的行级差异计算
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');
    const changes = [];

    const maxLines = Math.max(lines1.length, lines2.length);
    
    for (let i = 0; i < maxLines; i++) {
      const line1 = lines1[i] || '';
      const line2 = lines2[i] || '';
      
      if (line1 !== line2) {
        if (!line1) {
          changes.push(`+${i + 1}: ${line2}`);
        } else if (!line2) {
          changes.push(`-${i + 1}: ${line1}`);
        } else {
          changes.push(`~${i + 1}: ${line1} -> ${line2}`);
        }
      }
    }

    return changes.slice(0, 50); // 限制显示的差异数量
  }

  /**
   * 读取版本信息
   */
  async readVersionInfo() {
    try {
      if (!await fs.pathExists(this.versionFile)) {
        return this.getDefaultVersionInfo();
      }

      const content = await fs.readFile(this.versionFile, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      return this.getDefaultVersionInfo();
    }
  }

  /**
   * 写入版本信息
   */
  async writeVersionInfo(versionInfo) {
    try {
      const content = JSON.stringify(versionInfo, null, 2);
      await fs.writeFile(this.versionFile, content, 'utf8');
      await fs.chmod(this.versionFile, 0o600);
    } catch (error) {
      throw new Error(`写入版本信息失败: ${error.message}`);
    }
  }

  /**
   * 获取默认版本信息
   */
  getDefaultVersionInfo() {
    return {
      version: this.currentVersion,
      created: new Date().toISOString(),
      lastCheck: null,
      lastUpdate: null,
      templates: {},
      remoteVersion: null
    };
  }

  /**
   * 获取版本状态
   */
  async getVersionStatus() {
    try {
      const versionInfo = await this.readVersionInfo();
      const now = new Date();
      
      let lastCheckFormatted = '从未检查';
      let nextCheckFormatted = '立即可检查';
      
      if (versionInfo.lastCheck) {
        const lastCheck = new Date(versionInfo.lastCheck);
        const timeSinceCheck = now - lastCheck;
        const daysSinceCheck = Math.floor(timeSinceCheck / (24 * 60 * 60 * 1000));
        
        lastCheckFormatted = daysSinceCheck === 0 
          ? '今天' 
          : `${daysSinceCheck}天前`;
          
        const nextCheck = new Date(lastCheck.getTime() + this.checkInterval);
        if (nextCheck > now) {
          const hoursUntilNext = Math.ceil((nextCheck - now) / (60 * 60 * 1000));
          nextCheckFormatted = `${hoursUntilNext}小时后`;
        }
      }

      return {
        currentVersion: this.currentVersion,
        remoteVersion: versionInfo.remoteVersion?.version || '未知',
        lastCheck: lastCheckFormatted,
        nextCheck: nextCheckFormatted,
        lastUpdate: versionInfo.lastUpdate 
          ? new Date(versionInfo.lastUpdate).toLocaleString()
          : '从未更新',
        templateCount: Object.keys(versionInfo.templates || {}).length,
        cacheSize: await this.getCacheSize()
      };
    } catch (error) {
      throw new Error(`获取版本状态失败: ${error.message}`);
    }
  }

  /**
   * 获取缓存大小
   */
  async getCacheSize() {
    try {
      if (!await fs.pathExists(this.cacheDir)) {
        return 0;
      }

      const items = await fs.readdir(this.cacheDir);
      let totalSize = 0;

      for (const item of items) {
        const itemPath = path.join(this.cacheDir, item);
        const stats = await fs.stat(itemPath);
        totalSize += stats.size;
      }

      return totalSize;
    } catch (error) {
      return 0;
    }
  }

  /**
   * 清理缓存
   */
  async clearCache() {
    try {
      if (await fs.pathExists(this.cacheDir)) {
        await fs.remove(this.cacheDir);
        await fs.ensureDir(this.cacheDir);
      }
      
      return true;
    } catch (error) {
      throw new Error(`清理缓存失败: ${error.message}`);
    }
  }
}

module.exports = VersionManager;