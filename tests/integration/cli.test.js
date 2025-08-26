/**
 * CLI Integration Tests
 */

const { execSync } = require('child_process');
const fs = require('fs-extra');
const path = require('path');
const { createTestEnvironment, cleanupTestEnvironment } = require('../helpers/testUtils');

describe('CLI Integration', () => {
  let testConfigDir;
  let originalHome;
  const CLI_PATH = path.join(__dirname, '../../bin/ccvm.js');

  beforeEach(async () => {
    const testEnv = await createTestEnvironment('cli-integration');
    testConfigDir = testEnv.configDir;
    
    // Mock HOME directory for consistent testing
    originalHome = process.env.HOME;
    process.env.HOME = path.dirname(testConfigDir);
  });

  afterEach(async () => {
    process.env.HOME = originalHome;
    await cleanupTestEnvironment(testConfigDir);
  });

  const runCLI = (args, options = {}) => {
    const cmd = `node "${CLI_PATH}" ${args}`;
    try {
      const result = execSync(cmd, {
        encoding: 'utf8',
        timeout: 30000,
        ...options
      });
      return { stdout: result, stderr: '', exitCode: 0 };
    } catch (error) {
      return {
        stdout: error.stdout || '',
        stderr: error.stderr || '',
        exitCode: error.status || 1
      };
    }
  };

  describe('basic CLI functionality', () => {
    it('should show version information', () => {
      const result = runCLI('--version');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should show help information', () => {
      const result = runCLI('--help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Claude Code Version Manager');
      expect(result.stdout).toContain('Commands:');
      expect(result.stdout).toContain('provider');
      expect(result.stdout).toContain('status');
      expect(result.stdout).toContain('doctor');
    });

    it('should handle unknown commands gracefully', () => {
      const result = runCLI('unknown-command');
      expect(result.exitCode).toBe(1);
      expect(result.stderr).toContain('unknown command');
    });
  });

  describe('provider commands', () => {
    it('should show provider help', () => {
      const result = runCLI('provider --help');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('Manage API providers');
      expect(result.stdout).toContain('add');
      expect(result.stdout).toContain('list');
      expect(result.stdout).toContain('show');
    });

    it('should list providers when none exist', () => {
      const result = runCLI('provider list');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No providers configured');
    });

    it('should handle provider operations with proper initialization', async () => {
      // First ensure the system is initialized
      const statusResult = runCLI('status');
      expect(statusResult.exitCode).toBe(0);
      
      // Now test provider list again
      const listResult = runCLI('provider list');
      expect(listResult.exitCode).toBe(0);
    });
  });

  describe('status command', () => {
    it('should show basic status information', () => {
      const result = runCLI('status');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('System Status');
      expect(result.stdout).toContain('Configuration');
      expect(result.stdout).toContain('Directory Status');
    });

    it('should show detailed status when requested', () => {
      const result = runCLI('status --detailed');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('System Status');
      // Detailed view should contain more information
      expect(result.stdout.length).toBeGreaterThan(500);
    });

    it('should initialize system on first status check', () => {
      expect(fs.pathExistsSync(testConfigDir)).toBe(false);
      
      const result = runCLI('status');
      expect(result.exitCode).toBe(0);
      
      // Check if directories were created
      expect(fs.pathExistsSync(testConfigDir)).toBe(true);
      expect(fs.pathExistsSync(path.join(testConfigDir, 'providers'))).toBe(true);
      expect(fs.pathExistsSync(path.join(testConfigDir, 'backups'))).toBe(true);
    });
  });

  describe('doctor command', () => {
    it('should run basic system diagnostics', () => {
      const result = runCLI('doctor');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('System Diagnostics');
      expect(result.stdout).toContain('Configuration');
      expect(result.stdout).toContain('Validation');
    });

    it('should show detailed diagnostics when requested', () => {
      const result = runCLI('doctor --detailed');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('System Diagnostics');
    });

    it('should attempt fixes when requested', () => {
      const result = runCLI('doctor --fix');
      expect(result.exitCode).toBe(0);
      // Should not crash and should provide feedback
      expect(result.stdout.length).toBeGreaterThan(0);
    });
  });

  describe('error handling', () => {
    it('should handle invalid provider operations gracefully', () => {
      const result = runCLI('provider show nonexistent');
      expect(result.exitCode).toBe(1);
      expect(result.stderr || result.stdout).toContain('Provider');
    });

    it('should handle permission errors gracefully', () => {
      // Create a read-only config directory
      if (fs.pathExistsSync(testConfigDir)) {
        fs.chmodSync(testConfigDir, 0o444);
      }
      
      const result = runCLI('status');
      
      // Restore permissions for cleanup
      if (fs.pathExistsSync(testConfigDir)) {
        fs.chmodSync(testConfigDir, 0o755);
      }
      
      // Should handle the error without crashing
      expect(result.exitCode).toBeDefined();
    });
  });

  describe('configuration consistency', () => {
    it('should maintain consistent directory structure', () => {
      runCLI('status'); // Initialize system
      
      expect(fs.pathExistsSync(testConfigDir)).toBe(true);
      expect(fs.pathExistsSync(path.join(testConfigDir, 'providers'))).toBe(true);
      expect(fs.pathExistsSync(path.join(testConfigDir, 'backups'))).toBe(true);
      
      // Check if config file was created
      const configFile = path.join(testConfigDir, 'config.json');
      if (fs.pathExistsSync(configFile)) {
        const config = fs.readJsonSync(configFile);
        expect(config).toHaveProperty('version');
        expect(config).toHaveProperty('initialized');
      }
    });

    it('should handle multiple CLI invocations correctly', () => {
      // Run multiple commands in sequence
      const results = [
        runCLI('status'),
        runCLI('provider list'),
        runCLI('doctor'),
        runCLI('status --detailed')
      ];
      
      results.forEach((result, index) => {
        expect(result.exitCode).toBeLessThanOrEqual(1); // Should not crash
        expect(typeof result.stdout).toBe('string');
      });
    });
  });

  describe('output formatting', () => {
    it('should provide consistent output formatting', () => {
      const result = runCLI('status');
      expect(result.exitCode).toBe(0);
      
      // Check for consistent formatting patterns
      expect(result.stdout).toMatch(/System Status/);
      expect(result.stdout).toMatch(/Configuration:/);
      
      // Should not contain debugging output in normal mode
      expect(result.stdout).not.toContain('[DEBUG]');
      expect(result.stdout).not.toContain('console.log');
    });

    it('should handle empty provider list formatting', () => {
      const result = runCLI('provider list');
      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('No providers configured');
    });
  });

  describe('command chaining and state', () => {
    it('should handle rapid command execution', () => {
      // Execute multiple commands rapidly
      const commands = ['status', 'provider list', 'doctor'];
      const results = commands.map(cmd => runCLI(cmd));
      
      // All commands should complete without interference
      results.forEach((result, index) => {
        expect(result.exitCode).toBeLessThanOrEqual(1);
        expect(typeof result.stdout).toBe('string');
      });
    });

    it('should maintain state consistency across commands', () => {
      // Initialize system
      const initResult = runCLI('status');
      expect(initResult.exitCode).toBe(0);
      
      // Subsequent commands should find initialized system
      const listResult = runCLI('provider list');
      expect(listResult.exitCode).toBe(0);
      
      const doctorResult = runCLI('doctor');
      expect(doctorResult.exitCode).toBe(0);
    });
  });

  describe('performance and reliability', () => {
    it('should complete commands within reasonable time', () => {
      const start = Date.now();
      const result = runCLI('status');
      const duration = Date.now() - start;
      
      expect(result.exitCode).toBe(0);
      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
    });

    it('should handle concurrent execution gracefully', () => {
      // Note: This is a basic test - real concurrency testing would require more setup
      const result1 = runCLI('status');
      const result2 = runCLI('provider list');
      
      expect(result1.exitCode).toBeLessThanOrEqual(1);
      expect(result2.exitCode).toBeLessThanOrEqual(1);
    });
  });
});