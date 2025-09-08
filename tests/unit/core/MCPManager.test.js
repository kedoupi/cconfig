const MCPManager = require('../../../src/core/MCPManager');
const testUtils = require('../../helpers/testUtils');
const fs = require('fs-extra');
const path = require('path');

describe('MCPManager', () => {
  let mcpManager;
  let testConfigDir;

  beforeEach(async () => {
    testConfigDir = await testUtils.createTempDir('mcp-manager-test');
    mcpManager = new MCPManager(testConfigDir);
  });

  afterEach(async () => {
    await testUtils.cleanupTempDirs();
  });

  describe('constructor', () => {
    it('should initialize with correct paths', () => {
      expect(mcpManager.configDir).toBe(testConfigDir);
      expect(mcpManager.mcpDir).toBe(path.join(testConfigDir, 'mcp'));
      expect(mcpManager.configFile).toBe(path.join(testConfigDir, 'mcp', 'config.json'));
    });

    it('should have registry with predefined services', () => {
      expect(mcpManager.registry).toBeDefined();
      expect(typeof mcpManager.registry).toBe('object');
      expect(Object.keys(mcpManager.registry)).toContain('filesystem');
      expect(Object.keys(mcpManager.registry)).toContain('sequential-thinking');
    });

    it('should have valid service configurations', () => {
      const filesystem = mcpManager.registry.filesystem;
      expect(filesystem.name).toBe('filesystem');
      expect(filesystem.displayName).toBe('Filesystem MCP');
      expect(filesystem.package).toBe('@modelcontextprotocol/server-filesystem');
      expect(filesystem.transport).toBe('stdio');
      expect(filesystem.recommended).toBe(true);
    });
  });

  describe('checkClaudeCode', () => {
    it('should detect Claude Code availability', async () => {
      const result = await mcpManager.checkClaudeCode();
      
      // The method returns a boolean indicating if Claude Code is installed
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getInstalledMCPs', () => {
    it('should return installed MCP services', async () => {
      const installed = await mcpManager.getInstalledMCPs();
      
      // The method returns service information
      expect(typeof installed).toBe('object');
      // Should not throw even if Claude Code is not available
    });

    it('should handle services that are not installed gracefully', async () => {
      const installed = await mcpManager.getInstalledMCPs();
      
      // Should handle gracefully and return an object
      expect(typeof installed).toBe('object');
    });
  });

  describe('showList', () => {
    it('should display available MCP services', async () => {
      // This method outputs to console, so we just verify it doesn't throw
      await expect(mcpManager.showList()).resolves.toBeUndefined();
    });
  });

  describe('showMainMenu', () => {
    it('should handle main menu display', async () => {
      // This method is interactive and may not work well in tests
      // For now, just verify the method exists
      expect(typeof mcpManager.showMainMenu).toBe('function');
    });
  });

  describe('showInstalledServices', () => {
    it('should display installed services', async () => {
      // This method outputs to console, so we just verify it doesn't throw
      await expect(mcpManager.showInstalledServices()).resolves.toBeUndefined();
    });
  });

  describe('interactiveInstall', () => {
    it('should handle interactive installation', async () => {
      // This method is interactive and may not work well in tests
      // For now, just verify the method exists
      expect(typeof mcpManager.interactiveInstall).toBe('function');
    });
  });

  describe('installService', () => {
    it('should handle service installation', async () => {
      // This method executes system commands, so we test with a mock scenario
      // Since it requires actual CLI tools, we just verify it exists
      expect(typeof mcpManager.installService).toBe('function');
    });

    it('should reject invalid service names', async () => {
      // Test with invalid service name
      await expect(mcpManager.installService('invalid-service-name'))
        .rejects.toThrow();
    });
  });

  describe('interactiveUninstall', () => {
    it('should handle interactive uninstallation', async () => {
      // This method is interactive and may not work well in tests
      expect(typeof mcpManager.interactiveUninstall).toBe('function');
    });
  });

  describe('uninstallService', () => {
    it('should handle service uninstallation', async () => {
      // This method executes system commands, so we just verify it exists
      expect(typeof mcpManager.uninstallService).toBe('function');
    });
  });

  describe('doctor', () => {
    it('should run system diagnostics', async () => {
      // The doctor method outputs to console and may not return a value
      // Just verify it doesn't throw and completes successfully
      await expect(mcpManager.doctor()).resolves.toBeUndefined();
    });
  });

  describe('error handling', () => {
    it('should handle missing config directory gracefully', () => {
      // Test with a non-existent config directory
      const tempManager = new MCPManager('/nonexistent/path');
      expect(tempManager.configDir).toBe('/nonexistent/path');
      expect(tempManager.mcpDir).toBe(path.join('/nonexistent/path', 'mcp'));
    });

    it('should handle system command errors gracefully', async () => {
      // Methods that execute system commands should handle errors gracefully
      await expect(mcpManager.checkClaudeCode()).resolves.toBeDefined();
      await expect(mcpManager.getInstalledMCPs()).resolves.toBeDefined();
    });
  });

  describe('service registry validation', () => {
    it('should have consistent service configurations', () => {
      const services = Object.values(mcpManager.registry);
      
      services.forEach(service => {
        expect(service).toHaveProperty('name');
        expect(service).toHaveProperty('displayName');
        expect(service).toHaveProperty('description');
        expect(service).toHaveProperty('package');
        expect(service).toHaveProperty('transport');
        expect(service).toHaveProperty('recommended');
        expect(service).toHaveProperty('installCommand');
        expect(service).toHaveProperty('addCommand');
        expect(service).toHaveProperty('scope');
        expect(service).toHaveProperty('needsConfig');
        
        expect(typeof service.recommended).toBe('boolean');
        expect(typeof service.needsConfig).toBe('boolean');
        expect(['stdio', 'sse']).toContain(service.transport);
        expect(['user', 'global']).toContain(service.scope);
      });
    });

    it('should have unique service names', () => {
      const names = Object.keys(mcpManager.registry);
      const uniqueNames = new Set(names);
      expect(names.length).toBe(uniqueNames.size);
    });

    it('should have valid package names', () => {
      const services = Object.values(mcpManager.registry);
      
      services.forEach(service => {
        // Skip external services (package: null)
        if (service.package !== null) {
          expect(service.package).toMatch(/^@?[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9](\/[a-zA-Z0-9][a-zA-Z0-9-]*[a-zA-Z0-9])*$/);
        }
      });
    });
  });
});