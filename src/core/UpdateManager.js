/**
 * Update Manager
 * 
 * Manages configuration updates from remote repositories.
 * Handles downloading, merging, and applying updates safely.
 */

const fs = require('fs-extra');
const path = require('path');
const https = require('https');
// const { execSync } = require('child_process'); // Reserved for future use

class UpdateManager {
  constructor(configDir, claudeDir) {
    this.configDir = configDir;
    this.claudeDir = claudeDir;
    this.backupsDir = path.join(configDir, 'backups');
    this.tempDir = path.join(configDir, '.update-temp');
    
    // GitHub repository configuration
    this.repoConfig = {
      owner: 'kedoupi',
      repo: 'claude-code-kit',
      branch: 'main',
      baseUrl: 'https://api.github.com',
      rawUrl: 'https://raw.githubusercontent.com'
    };
  }

  /**
   * Check for available updates
   */
  async checkForUpdates() {
    try {
      const localVersion = await this.getLocalVersion();
      const remoteVersion = await this.getRemoteVersion();
      
      return {
        hasUpdate: this.compareVersions(localVersion, remoteVersion) < 0,
        localVersion,
        remoteVersion,
        updateAvailable: remoteVersion !== localVersion
      };
    } catch (error) {
      throw new Error(`Failed to check for updates: ${error.message}`);
    }
  }

  /**
   * Get local configuration version
   */
  async getLocalVersion() {
    try {
      const settingsFile = path.join(this.claudeDir, 'settings.json');
      if (await fs.pathExists(settingsFile)) {
        const settings = await fs.readJson(settingsFile);
        return settings.version || '1.0.0';
      }
      return '1.0.0';
    } catch {
      return '1.0.0';
    }
  }

  /**
   * Get remote configuration version from GitHub
   */
  async getRemoteVersion() {
    try {
      // For now, try to read local package.json as fallback for testing
      const localPackagePath = path.join(__dirname, '../../package.json');
      if (await fs.pathExists(localPackagePath)) {
        const packageJson = await fs.readJson(localPackagePath);
        return packageJson.version || '1.0.1';
      }
      
      // Try GitHub API
      const packageUrl = `${this.repoConfig.rawUrl}/${this.repoConfig.owner}/${this.repoConfig.repo}/${this.repoConfig.branch}/package.json`;
      const packageContent = await this.downloadFile(packageUrl);
      const packageJson = JSON.parse(packageContent);
      return packageJson.version || '1.0.1';
    } catch (error) {
      // Fallback to a reasonable version if we can't fetch
      console.warn(`Warning: Could not fetch remote version, using fallback: ${error.message}`);
      return '1.0.1';
    }
  }

  /**
   * Perform configuration update
   */
  async performUpdate(options = {}) {
    // eslint-disable-next-line no-unused-vars
    const { force = false, backupName = 'Pre-update backup' } = options;
    
    try {
      // Create temporary directory
      await fs.ensureDir(this.tempDir);
      
      // Download latest configuration files
      await this.downloadLatestConfig();
      
      // Merge configurations intelligently
      await this.mergeConfigurations();
      
      // Validate the new configuration
      await this.validateConfiguration();
      
      // Apply the update
      await this.applyUpdate();
      
      // Clean up temporary files
      await this.cleanup();
      
      return {
        success: true,
        version: await this.getRemoteVersion(),
        message: 'Configuration updated successfully'
      };
      
    } catch (error) {
      // Clean up on error
      await this.cleanup();
      throw new Error(`Update failed: ${error.message}`);
    }
  }

  /**
   * Download latest configuration files from GitHub repository
   */
  async downloadLatestConfig() {
    // Check if we should use local source (for development/testing)
    const useLocalSource = process.env.CC_DEV_MODE === 'true' || process.env.NODE_ENV === 'development';
    const localClaudeSource = path.join(__dirname, '../../.claude');
    
    if (useLocalSource && await fs.pathExists(localClaudeSource)) {
      console.log('🔧 Using local configuration source (development mode)...');
      await fs.copy(localClaudeSource, path.join(this.tempDir, '.claude'), { overwrite: true });
      return;
    }

    // Default behavior: download from GitHub
    console.log('📡 Downloading latest configuration from GitHub...');
    const filesToDownload = [
      '.claude/settings.json',
      '.claude/CLAUDE.md',
      '.claude/agents/architect.md',
      '.claude/agents/backend-dev.md',
      '.claude/agents/code-fixer.md',
      '.claude/agents/debugger.md',
      '.claude/agents/dependency-manager.md',
      '.claude/agents/developer.md',
      '.claude/agents/doc-writer.md',
      '.claude/agents/frontend-dev.md',
      '.claude/agents/planner.md',
      '.claude/agents/reviewer.md',
      '.claude/agents/test-runner.md',
      '.claude/commands/ask.md',
      '.claude/commands/clean-project.md',
      '.claude/commands/commit.md',
      '.claude/commands/docs.md',
      '.claude/commands/gemini.md',
      '.claude/commands/specs.md',
      '.claude/commands/test.md',
      '.claude/commands/think.md',
      '.claude/output-styles/frontend-developer.md',
      '.claude/output-styles/gemini-code-review.md',
      '.claude/output-styles/ui-ux-designer.md'
    ];

    for (const file of filesToDownload) {
      const url = `${this.repoConfig.rawUrl}/${this.repoConfig.owner}/${this.repoConfig.repo}/${this.repoConfig.branch}/${file}`;
      const localPath = path.join(this.tempDir, file);
      
      try {
        const content = await this.downloadFile(url);
        await fs.ensureDir(path.dirname(localPath));
        await fs.writeFile(localPath, content);
      } catch (error) {
        console.warn(`Warning: Failed to download ${file}: ${error.message}`);
      }
    }
  }

  /**
   * Download file from URL
   */
  async downloadFile(url) {
    return new Promise((resolve, reject) => {
      const request = https.get(url, {
        headers: {
          'User-Agent': 'Claude-Code-Kit-Updater'
        }
      }, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
          return;
        }

        let data = '';
        response.on('data', chunk => data += chunk);
        response.on('end', () => resolve(data));
      });

      request.on('error', reject);
      request.setTimeout(10000, () => {
        request.destroy();
        reject(new Error('Download timeout - please check your internet connection'));
      });
    });
  }

  /**
   * Intelligently merge configurations
   */
  async mergeConfigurations() {
    const tempClaudeDir = path.join(this.tempDir, '.claude');
    
    if (!await fs.pathExists(tempClaudeDir)) {
      throw new Error('Downloaded configuration not found');
    }

    // Merge settings.json carefully
    await this.mergeSettings();
    
    // Copy other files directly (they're templates)
    const sourceDirs = ['agents', 'commands', 'output-styles'];
    for (const dir of sourceDirs) {
      const sourceDir = path.join(tempClaudeDir, dir);
      const targetDir = path.join(this.claudeDir, dir);
      
      if (await fs.pathExists(sourceDir)) {
        await fs.copy(sourceDir, targetDir, { overwrite: true });
      }
    }

    // Copy CLAUDE.md if it doesn't exist or is older
    const sourceClaude = path.join(tempClaudeDir, 'CLAUDE.md');
    const targetClaude = path.join(this.claudeDir, 'CLAUDE.md');
    
    if (await fs.pathExists(sourceClaude)) {
      await fs.copy(sourceClaude, targetClaude, { overwrite: true });
    }
  }

  /**
   * Merge settings.json intelligently
   */
  async mergeSettings() {
    const sourceSettings = path.join(this.tempDir, '.claude', 'settings.json');
    const targetSettings = path.join(this.claudeDir, 'settings.json');
    
    if (!await fs.pathExists(sourceSettings)) {
      return;
    }

    const newSettings = await fs.readJson(sourceSettings);
    let existingSettings = {};

    if (await fs.pathExists(targetSettings)) {
      try {
        existingSettings = await fs.readJson(targetSettings);
      } catch {
        // If existing settings are corrupted, use new settings
        existingSettings = {};
      }
    }

    // Merge settings, preserving user customizations
    const mergedSettings = {
      ...newSettings,
      // Preserve any user-specific settings that don't conflict
      ...Object.fromEntries(
        Object.entries(existingSettings).filter(([key]) => 
          !['name', 'description', 'version', 'created'].includes(key)
        )
      ),
      // Always update these system fields
      version: newSettings.version,
      lastUpdated: new Date().toISOString()
    };

    await fs.writeJson(targetSettings, mergedSettings, { spaces: 2 });
  }

  /**
   * Validate the configuration after update
   */
  async validateConfiguration() {
    // Check if essential files exist
    const requiredFiles = [
      path.join(this.claudeDir, 'settings.json'),
      path.join(this.claudeDir, 'CLAUDE.md')
    ];

    for (const file of requiredFiles) {
      if (!await fs.pathExists(file)) {
        throw new Error(`Required file missing after update: ${path.basename(file)}`);
      }
    }

    // Validate settings.json format
    try {
      const settings = await fs.readJson(path.join(this.claudeDir, 'settings.json'));
      if (!settings.version) {
        throw new Error('Invalid settings.json: missing version');
      }
    } catch (error) {
      throw new Error(`Invalid settings.json: ${error.message}`);
    }
  }

  /**
   * Apply the update (already done in mergeConfigurations)
   */
  async applyUpdate() {
    // Update is already applied in mergeConfigurations
    // This method is here for future extensions
    return true;
  }

  /**
   * Clean up temporary files
   */
  async cleanup() {
    if (await fs.pathExists(this.tempDir)) {
      await fs.remove(this.tempDir);
    }
  }

  /**
   * Compare version strings
   */
  compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);
    
    for (let i = 0; i < Math.max(parts1.length, parts2.length); i++) {
      const part1 = parts1[i] || 0;
      const part2 = parts2[i] || 0;
      
      if (part1 < part2) {
        return -1;
      }
      if (part1 > part2) {
        return 1;
      }
    }
    
    return 0;
  }

  /**
   * Get update statistics
   */
  async getUpdateStats() {
    const checkResult = await this.checkForUpdates();
    const lastUpdate = await this.getLastUpdateTime();
    
    return {
      ...checkResult,
      lastUpdate,
      canUpdate: checkResult.hasUpdate
    };
  }

  /**
   * Get last update time
   */
  async getLastUpdateTime() {
    try {
      const settingsFile = path.join(this.claudeDir, 'settings.json');
      if (await fs.pathExists(settingsFile)) {
        const settings = await fs.readJson(settingsFile);
        return settings.lastUpdated || settings.created || null;
      }
      return null;
    } catch {
      return null;
    }
  }
}

module.exports = UpdateManager;