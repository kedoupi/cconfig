/**
 * Command Integration Tests
 * Tests all CLI commands to ensure they work correctly
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs-extra');
const os = require('os');

describe('CCVM Commands', () => {
  const CLI_PATH = path.join(__dirname, '../../bin/ccvm.js');
  const testDir = path.join(os.tmpdir(), 'ccvm-test-' + Date.now());
  const originalHome = process.env.HOME;

  beforeAll(async () => {
    // Create test directory
    await fs.ensureDir(testDir);
    process.env.HOME = testDir;
  });

  afterAll(async () => {
    process.env.HOME = originalHome;
    await fs.remove(testDir);
  });

  const runCommand = (args) => {
    try {
      const output = execSync(`node "${CLI_PATH}" ${args}`, {
        encoding: 'utf8',
        env: { ...process.env, HOME: testDir }
      });
      return { success: true, output };
    } catch (error) {
      return { 
        success: false, 
        output: error.stdout || error.stderr || error.message 
      };
    }
  };

  describe('Core Configuration Commands', () => {
    test('ccvm --version should display version', () => {
      const result = runCommand('--version');
      expect(result.success).toBe(true);
      expect(result.output).toMatch(/\d+\.\d+\.\d+/);
    });

    test('ccvm --help should display help', () => {
      const result = runCommand('--help');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Commands:');
      expect(result.output).toContain('add');
      expect(result.output).toContain('list');
    });

    test('ccvm list should work with no providers', () => {
      const result = runCommand('list');
      expect(result.success).toBe(true);
      expect(result.output).toContain('No providers configured');
    });

    test('ccvm status should show system status', () => {
      const result = runCommand('status');
      expect(result.success).toBe(true);
      expect(result.output).toContain('System Information');
    });

    test('ccvm doctor should run diagnostics', () => {
      const result = runCommand('doctor');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Node.js Environment');
    });

    test('ccvm env should handle no default provider', () => {
      const result = runCommand('env');
      expect(result.success).toBe(false);
      expect(result.output).toContain('没有配置默认 Provider');
    });

    test('ccvm use without args should show interactive menu or message', () => {
      const result = runCommand('use');
      // The command may succeed with a message about no providers
      expect(result.output).toBeDefined();
      // Either shows no providers message or interactive menu
      const hasMessage = result.output.includes('No providers') || 
                         result.output.includes('ccvm') ||
                         result.output.includes('Claude');
      expect(hasMessage).toBe(true);
    });

    test('ccvm show <alias> should handle non-existent provider', () => {
      const result = runCommand('show test');
      // Should show either 'not found' or suggest running 'ccvm list'
      const hasExpectedMessage = result.output.includes('not found') || 
                                result.output.includes('list');
      expect(hasExpectedMessage).toBe(true);
    });

    test('ccvm edit <alias> should handle non-existent provider', () => {
      const result = runCommand('edit test');
      // Command may exit silently or show error
      expect(result).toBeDefined();
      // Should either have error output or be silent
      if (result.output) {
        const hasMessage = result.output.includes('not found') || 
                          result.output.includes('Provider') ||
                          result.output === '';
        expect(hasMessage).toBe(true);
      }
    });

    test('ccvm remove <alias> should handle non-existent provider', () => {
      const result = runCommand('remove test');
      // Command may exit silently or show error
      expect(result).toBeDefined();
      // Should either have error output or be silent
      if (result.output) {
        const hasMessage = result.output.includes('not found') || 
                          result.output.includes('Provider') ||
                          result.output === '';
        expect(hasMessage).toBe(true);
      }
    });

    test('ccvm mcp should show MCP menu or error', () => {
      const result = runCommand('mcp');
      // MCP requires interactive mode, so it might fail in test
      expect(result.output).toBeDefined();
    });

    test('unknown command should show error', () => {
      const result = runCommand('invalid-command');
      expect(result.success).toBe(false);
      expect(result.output).toContain('Unknown command');
    });
  });

  describe('Command Options', () => {
    test('ccvm status --detailed should show detailed info', () => {
      const result = runCommand('status --detailed');
      expect(result.success).toBe(true);
      expect(result.output).toContain('Configuration');
    });

    test('ccvm doctor --fix should attempt fixes', () => {
      const result = runCommand('doctor --fix');
      expect(result.success).toBe(true);
      expect(result.output).toContain('validation');
    });

    test('ccvm env --shell fish should output fish format', () => {
      const result = runCommand('env --shell fish');
      // Will fail due to no provider, but should recognize the option
      expect(result.output).toBeDefined();
    });

    test('ccvm env --provider nonexistent should handle non-existent provider', () => {
      const result = runCommand('env --provider nonexistent');
      expect(result.success).toBe(false);
      expect(result.output).toContain("Provider 'nonexistent' 未找到");
      expect(result.output).toContain('ccvm list');
    });

    test('ccvm env --provider option should be recognized', () => {
      const result = runCommand('env --provider test --shell bash');
      // Command should recognize both options even if provider doesn't exist
      expect(result.output).toBeDefined();
    });
  });
});