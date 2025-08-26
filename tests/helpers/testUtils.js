/**
 * Test Utilities
 * 
 * Helper functions and utilities for testing Claude Code Kit.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');

class TestUtils {
  constructor() {
    this.tempDirs = new Set();
  }

  /**
   * Create a temporary directory for testing
   */
  async createTempDir(prefix = 'cc-test') {
    const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), `${prefix}-`));
    this.tempDirs.add(tempDir);
    return tempDir;
  }

  /**
   * Clean up all temporary directories
   */
  async cleanupTempDirs() {
    for (const dir of this.tempDirs) {
      try {
        await fs.remove(dir);
      } catch (error) {
        console.warn(`Failed to remove temp dir ${dir}:`, error.message);
      }
    }
    this.tempDirs.clear();
  }

  /**
   * Create a complete test environment
   */
  async createTestEnvironment(prefix = 'test-env') {
    const tempDir = await this.createTempDir(prefix);
    const configDir = path.join(tempDir, '.ccvm');
    const claudeDir = path.join(tempDir, '.claude');
    
    const config = await this.createTestConfigStructure(configDir);
    const claude = await this.createTestClaudeStructure(claudeDir);
    
    return {
      tempDir,
      configDir,
      claudeDir,
      config,
      claude
    };
  }

  /**
   * Clean up test environment
   */
  async cleanupTestEnvironment(configDir) {
    const tempDir = path.dirname(configDir);
    try {
      await fs.remove(tempDir);
      this.tempDirs.delete(tempDir);
    } catch (error) {
      console.warn(`Failed to cleanup test environment ${tempDir}:`, error.message);
    }
  }

  /**
   * Create a test configuration directory structure
   */
  async createTestConfigStructure(baseDir) {
    const structure = {
      configDir: baseDir,
      providersDir: path.join(baseDir, 'providers'),
      backupsDir: path.join(baseDir, 'backups'),
      aliasesFile: path.join(baseDir, 'aliases.sh')
    };

    // Create directories
    await fs.ensureDir(structure.providersDir);
    await fs.ensureDir(structure.backupsDir);

    // Create initial files
    await fs.writeFile(structure.aliasesFile, '# Test aliases\n');

    return structure;
  }

  /**
   * Create a test Claude configuration directory
   */
  async createTestClaudeStructure(baseDir) {
    const structure = {
      claudeDir: baseDir,
      commandsDir: path.join(baseDir, 'commands'),
      agentsDir: path.join(baseDir, 'agents'),
      outputStylesDir: path.join(baseDir, 'output-styles'),
      settingsFile: path.join(baseDir, 'settings.json'),
      claudeFile: path.join(baseDir, 'CLAUDE.md')
    };

    // Create directories
    await fs.ensureDir(structure.commandsDir);
    await fs.ensureDir(structure.agentsDir);
    await fs.ensureDir(structure.outputStylesDir);

    // Create initial files
    await fs.writeJson(structure.settingsFile, {
      name: 'Test Configuration',
      version: '1.0.0'
    });

    await fs.writeFile(structure.claudeFile, '# Test Claude Configuration\n');

    return structure;
  }

  /**
   * Mock file system operations
   */
  mockFileSystem() {
    const mockFs = {
      files: new Map(),
      dirs: new Set()
    };

    const originalExists = fs.pathExists;
    const originalReadJson = fs.readJson;
    const originalWriteJson = fs.writeJson;
    const originalReadFile = fs.readFile;
    const originalWriteFile = fs.writeFile;
    const originalEnsureDir = fs.ensureDir;
    const originalRemove = fs.remove;
    const originalCopy = fs.copy;

    // Mock fs.pathExists
    fs.pathExists = jest.fn(async (filePath) => {
      return mockFs.files.has(filePath) || mockFs.dirs.has(filePath);
    });

    // Mock fs.readJson
    fs.readJson = jest.fn(async (filePath) => {
      if (mockFs.files.has(filePath)) {
        const content = mockFs.files.get(filePath);
        return JSON.parse(content);
      }
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    });

    // Mock fs.writeJson
    fs.writeJson = jest.fn(async (filePath, data) => {
      mockFs.files.set(filePath, JSON.stringify(data, null, 2));
    });

    // Mock fs.readFile
    fs.readFile = jest.fn(async (filePath) => {
      if (mockFs.files.has(filePath)) {
        return mockFs.files.get(filePath);
      }
      throw new Error(`ENOENT: no such file or directory, open '${filePath}'`);
    });

    // Mock fs.writeFile
    fs.writeFile = jest.fn(async (filePath, data) => {
      mockFs.files.set(filePath, data);
    });

    // Mock fs.ensureDir
    fs.ensureDir = jest.fn(async (dirPath) => {
      mockFs.dirs.add(dirPath);
    });

    // Mock fs.remove
    fs.remove = jest.fn(async (filePath) => {
      mockFs.files.delete(filePath);
      mockFs.dirs.delete(filePath);
    });

    // Mock fs.copy
    fs.copy = jest.fn(async (src, dest) => {
      if (mockFs.files.has(src)) {
        mockFs.files.set(dest, mockFs.files.get(src));
      }
    });

    // Return cleanup function
    return () => {
      fs.pathExists = originalExists;
      fs.readJson = originalReadJson;
      fs.writeJson = originalWriteJson;
      fs.readFile = originalReadFile;
      fs.writeFile = originalWriteFile;
      fs.ensureDir = originalEnsureDir;
      fs.remove = originalRemove;
      fs.copy = originalCopy;
    };
  }

  /**
   * Create a test provider configuration
   */
  createTestProvider(overrides = {}) {
    return {
      alias: 'testprovider',
      baseURL: 'https://api.testprovider.com',
      apiKey: 'test-api-key-12345678901234567890',
      timeout: '3000000',
      ...overrides
    };
  }

  /**
   * Create multiple test providers
   */
  createTestProviders(count = 3) {
    return Array.from({ length: count }, (_, i) => ({
      alias: `testprovider${i + 1}`,
      baseURL: `https://api.testprovider${i + 1}.com`,
      apiKey: `test-api-key-${i + 1}-12345678901234567890`,
      timeout: '3000000'
    }));
  }

  /**
   * Create test provider files
   */
  async createTestProviderFiles(providersDir, providers) {
    for (const provider of providers) {
      const filePath = path.join(providersDir, `${provider.alias}.json`);
      await fs.writeJson(filePath, provider, { spaces: 2 });
    }
  }

  /**
   * Create test backup with metadata
   */
  async createTestBackup(backupsDir, timestamp, metadata = {}) {
    const backupDir = path.join(backupsDir, timestamp);
    await fs.ensureDir(backupDir);

    const backupMetadata = {
      timestamp,
      description: 'Test backup',
      size: '1.2 MB',
      created_by: 'test',
      ...metadata
    };

    await fs.writeJson(path.join(backupDir, 'metadata.json'), backupMetadata);

    // Create dummy backup content
    const claudeBackupDir = path.join(backupDir, 'claude');
    await fs.ensureDir(claudeBackupDir);
    await fs.writeJson(path.join(claudeBackupDir, 'settings.json'), {
      name: 'Backed up settings'
    });

    return backupMetadata;
  }

  /**
   * Simulate shell command execution
   */
  mockShellCommand(command, response) {
    require('child_process');

    // Mock the exec function
    jest.doMock('child_process', () => ({
      exec: jest.fn((cmd, callback) => {
        if (cmd.includes(command)) {
          callback(null, { stdout: response, stderr: '' });
        } else {
          callback(new Error(`Command not found: ${cmd}`));
        }
      })
    }));

    // Return cleanup function
    return () => {
      jest.unmock('child_process');
    };
  }

  /**
   * Validate provider configuration structure
   */
  validateProviderConfig(provider) {
    const required = ['alias', 'baseURL', 'apiKey'];
    const missing = required.filter(key => !provider[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required fields: ${missing.join(', ')}`);
    }

    // Validate alias format
    if (!/^[a-zA-Z0-9-_]+$/.test(provider.alias)) {
      throw new Error('Invalid alias format');
    }

    // Validate URL
    try {
      new URL(provider.baseURL);
    } catch {
      throw new Error('Invalid base URL');
    }

    return true;
  }

  /**
   * Generate test data for performance testing
   */
  generateLargeTestData(size = 1000) {
    const providers = [];
    
    for (let i = 0; i < size; i++) {
      providers.push({
        alias: `provider${i}`,
        baseURL: `https://api.provider${i}.com`,
        apiKey: `key-${i}-${this.randomString(20)}`,
        timeout: '3000000'
      });
    }

    return providers;
  }

  /**
   * Wait for a specified amount of time
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Generate random string
   */
  randomString(length = 8) {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Wait for async operations
   */
  async waitFor(condition, timeout = 5000, interval = 100) {
    const start = Date.now();
    
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    
    throw new Error(`Condition not met within ${timeout}ms`);
  }

  /**
   * Assert file contents
   */
  async assertFileContains(filePath, expectedContent) {
    const content = await fs.readFile(filePath, 'utf8');
    expect(content).toContain(expectedContent);
  }

  /**
   * Assert directory structure
   */
  async assertDirectoryStructure(baseDir, expectedStructure) {
    for (const item of expectedStructure) {
      const itemPath = path.join(baseDir, item);
      const exists = await fs.pathExists(itemPath);
      expect(exists).toBe(true);
    }
  }

  /**
   * Measure operation performance
   */
  async measurePerformance(operation, iterations = 1) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await operation();
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1000000); // Convert to milliseconds
    }
    
    return {
      average: times.reduce((a, b) => a + b, 0) / times.length,
      min: Math.min(...times),
      max: Math.max(...times),
      times
    };
  }
}

// Create singleton instance
const testUtils = new TestUtils();

// Export both the instance and specific functions for convenience
module.exports = testUtils;
module.exports.createTestEnvironment = testUtils.createTestEnvironment.bind(testUtils);
module.exports.cleanupTestEnvironment = testUtils.cleanupTestEnvironment.bind(testUtils);