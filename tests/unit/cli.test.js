/**
 * CLI Commands Unit Tests
 * CLI命令单元测试
 */

const { execSync } = require('child_process');
const path = require('path');

const CLI_PATH = path.resolve(__dirname, '../../bin/cconfig.js');

describe('CConfig CLI', () => {
  
  test('should show version information', () => {
    const output = execSync(`node ${CLI_PATH} --version`, { encoding: 'utf8' });
    expect(output).toContain('1.1.0');
  });

  test('should show help information', () => {
    const output = execSync(`node ${CLI_PATH} --help`, { encoding: 'utf8' });
    expect(output).toContain('Claude Configuration Manager');
    expect(output).toContain('add');
    expect(output).toContain('list');
    expect(output).toContain('env');
  });

  test('should handle invalid command gracefully', () => {
    try {
      execSync(`node ${CLI_PATH} invalid-command`, { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      expect(error.status).toBe(1);
      expect(error.stderr || error.stdout).toContain('unknown command');
    }
  });

  test('should show env command help', () => {
    const output = execSync(`node ${CLI_PATH} env --help`, { encoding: 'utf8' });
    expect(output).toContain('输出指定或默认 Provider 的环境变量');
    expect(output).toContain('--provider');
    expect(output).toContain('--shell');
  });

  test('should handle env command without configuration', () => {
    try {
      execSync(`node ${CLI_PATH} env`, { encoding: 'utf8', stdio: 'pipe' });
    } catch (error) {
      const output = error.stdout || error.stderr;
      expect(output).toContain('No default provider configured');
    }
  });

});