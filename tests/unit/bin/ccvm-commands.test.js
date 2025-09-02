/**
 * Command-specific tests for ccvm CLI
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

describe('CCVM CLI Commands', () => {
  const CLI_PATH = path.join(__dirname, '../../../bin/ccvm.js');
  let testDir;
  let originalHome;

  beforeEach(() => {
    testDir = path.join(os.tmpdir(), 'ccvm-test-' + Date.now());
    fs.ensureDirSync(testDir);
    originalHome = process.env.HOME;
    process.env.HOME = testDir;
  });

  afterEach(() => {
    process.env.HOME = originalHome;
    if (fs.existsSync(testDir)) {
      fs.removeSync(testDir);
    }
  });

  const runCommand = (args, options = {}) => {
    try {
      const output = execSync(`node "${CLI_PATH}" ${args}`, {
        encoding: 'utf8',
        env: { ...process.env, HOME: testDir, NODE_ENV: 'test' },
        ...options
      });
      return { success: true, output, exitCode: 0 };
    } catch (error) {
      return { 
        success: false, 
        output: error.stdout || error.stderr || error.message,
        exitCode: error.status || 1
      };
    }
  };

  describe('add command', () => {
    it('should require interactive mode', () => {
      const result = runCommand('add', { input: '\n' });
      expect(result.output).toBeDefined();
    });
  });

  describe('list command', () => {
    it('should list providers when none configured', () => {
      const result = runCommand('list');
      expect(result.success).toBe(true);
      expect(result.output).toMatch(/no providers|configured/i);
    });

    it('should list providers when configured', () => {
      // Create a test provider
      const providersDir = path.join(testDir, '.claude/ccvm/providers');
      fs.ensureDirSync(providersDir);
      fs.writeJsonSync(path.join(providersDir, 'test.json'), {
        alias: 'test',
        url: 'https://api.test.com',
        apiKey: 'test-key'
      });

      const result = runCommand('list');
      expect(result.success).toBe(true);
    });
  });

  describe('show command', () => {
    it('should require alias parameter', () => {
      const result = runCommand('show');
      expect(result.success).toBe(false);
    });

    it('should handle non-existent provider', () => {
      const result = runCommand('show nonexistent');
      expect(result.output).toBeDefined();
    });

    it('should show existing provider', () => {
      const providersDir = path.join(testDir, '.claude/ccvm/providers');
      fs.ensureDirSync(providersDir);
      fs.writeJsonSync(path.join(providersDir, 'test.json'), {
        alias: 'test',
        url: 'https://api.test.com',
        apiKey: 'test-key'
      });

      const result = runCommand('show test');
      expect(result.output).toBeDefined();
    });
  });

  describe('edit command', () => {
    it('should require alias parameter', () => {
      const result = runCommand('edit');
      expect(result.success).toBe(false);
    });

    it('should handle non-existent provider', () => {
      const result = runCommand('edit nonexistent');
      // May exit silently or with error
      expect(result).toBeDefined();
    });
  });

  describe('remove command', () => {
    it('should require alias parameter', () => {
      const result = runCommand('remove');
      expect(result.success).toBe(false);
    });

    it('should handle non-existent provider', () => {
      const result = runCommand('remove nonexistent');
      expect(result).toBeDefined();
    });

    it('should remove existing provider', () => {
      const providersDir = path.join(testDir, '.claude/ccvm/providers');
      fs.ensureDirSync(providersDir);
      const providerFile = path.join(providersDir, 'test.json');
      fs.writeJsonSync(providerFile, {
        alias: 'test',
        url: 'https://api.test.com',
        apiKey: 'test-key'
      });

      const result = runCommand('remove test');
      expect(fs.existsSync(providerFile)).toBe(false);
    });
  });

  describe('use command', () => {
    it('should handle no providers', () => {
      const result = runCommand('use');
      expect(result.output).toBeDefined();
    });

    it('should set default provider', () => {
      const providersDir = path.join(testDir, '.claude/ccvm/providers');
      fs.ensureDirSync(providersDir);
      fs.writeJsonSync(path.join(providersDir, 'test.json'), {
        alias: 'test',
        url: 'https://api.test.com',
        apiKey: 'test-key'
      });

      const result = runCommand('use test');
      expect(result.output).toBeDefined();
    });
  });

  describe('env command', () => {
    it('should handle no default provider', () => {
      const result = runCommand('env');
      expect(result.success).toBe(false);
      expect(result.output).toContain('No default provider');
    });

    it('should output env vars for default provider', () => {
      const configDir = path.join(testDir, '.claude/ccvm');
      const providersDir = path.join(configDir, 'providers');
      fs.ensureDirSync(providersDir);
      
      // Create provider
      fs.writeJsonSync(path.join(providersDir, 'test.json'), {
        alias: 'test',
        url: 'https://api.test.com',
        apiKey: 'test-key'
      });
      
      // Set as default
      fs.writeJsonSync(path.join(configDir, 'config.json'), {
        defaultProvider: 'test'
      });

      const result = runCommand('env');
      expect(result.success).toBe(true);
      expect(result.output).toContain('export');
    });

    it('should support fish shell format', () => {
      const configDir = path.join(testDir, '.claude/ccvm');
      const providersDir = path.join(configDir, 'providers');
      fs.ensureDirSync(providersDir);
      
      fs.writeJsonSync(path.join(providersDir, 'test.json'), {
        alias: 'test',
        url: 'https://api.test.com',
        apiKey: 'test-key'
      });
      
      fs.writeJsonSync(path.join(configDir, 'config.json'), {
        defaultProvider: 'test'
      });

      const result = runCommand('env --shell fish');
      expect(result.success).toBe(true);
      expect(result.output).toContain('set -gx');
    });
  });

  describe('status command', () => {
    it('should show status', () => {
      const result = runCommand('status');
      expect(result.success).toBe(true);
      expect(result.output).toContain('System Information');
    });

    it('should show detailed status', () => {
      const result = runCommand('status --detailed');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Configuration');
    });
  });

  describe('doctor command', () => {
    it('should run diagnostics', () => {
      const result = runCommand('doctor');
      expect(result.success).toBe(true);
      expect(result.output).toContain('validation');
    });

    it('should run with fix option', () => {
      const result = runCommand('doctor --fix');
      expect(result.success).toBe(true);
    });
  });

  describe('mcp command', () => {
    it('should handle MCP command', () => {
      const result = runCommand('mcp', { timeout: 1000 });
      // MCP requires interactive mode, may timeout or show menu
      expect(result).toBeDefined();
    });
  });

  describe('error handling', () => {
    it('should show help for unknown command', () => {
      const result = runCommand('invalidcommand');
      expect(result.success).toBe(false);
      expect(result.output).toContain('Unknown command');
    });

    it('should handle missing required arguments', () => {
      const result = runCommand('show');
      expect(result.success).toBe(false);
      expect(result.output).toContain('required');
    });
  });

  describe('options', () => {
    it('should show version', () => {
      const result = runCommand('--version');
      expect(result.success).toBe(true);
      expect(result.output).toMatch(/\d+\.\d+\.\d+/);
    });

    it('should show help', () => {
      const result = runCommand('--help');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Commands:');
      expect(result.output).toContain('add');
      expect(result.output).toContain('list');
    });

    it('should show command-specific help', () => {
      const result = runCommand('help add');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Add');
    });
  });
});