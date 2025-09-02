const MCPManagerV2 = require('../../../src/core/MCPManagerV2');
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');
const inquirer = require('inquirer');

jest.mock('child_process');
jest.mock('fs-extra');
jest.mock('inquirer');

describe('MCPManagerV2', () => {
  let mcpManager;
  const testConfigDir = '/test/.claude/ccvm';

  beforeEach(() => {
    jest.clearAllMocks();
    mcpManager = new MCPManagerV2(testConfigDir);
    
    // Default mocks
    fs.existsSync.mockReturnValue(false);
    fs.ensureDirSync.mockReturnValue(undefined);
    fs.writeJsonSync.mockReturnValue(undefined);
    fs.readJsonSync.mockReturnValue({});
    fs.readdirSync.mockReturnValue([]);
  });

  describe('constructor', () => {
    it('should initialize with correct paths', () => {
      expect(mcpManager.configDir).toBe(testConfigDir);
      expect(mcpManager.mcpDir).toBe(path.join(testConfigDir, 'mcp'));
      expect(mcpManager.configFile).toBe(path.join(testConfigDir, 'mcp', 'mcp-config.json'));
    });
  });

  describe('init', () => {
    it('should create MCP directory if not exists', () => {
      fs.existsSync.mockReturnValue(false);
      
      mcpManager.init();
      
      expect(fs.ensureDirSync).toHaveBeenCalledWith(mcpManager.mcpDir);
    });

    it('should create default config if not exists', () => {
      fs.existsSync.mockReturnValueOnce(true).mockReturnValueOnce(false);
      
      mcpManager.init();
      
      expect(fs.writeJsonSync).toHaveBeenCalledWith(
        mcpManager.configFile,
        expect.objectContaining({
          version: '2.0.0',
          services: {},
          templates: expect.any(Object)
        }),
        { spaces: 2 }
      );
    });
  });

  describe('listServices', () => {
    it('should return empty array when no services', () => {
      fs.existsSync.mockReturnValue(false);
      
      const services = mcpManager.listServices();
      
      expect(services).toEqual([]);
    });

    it('should return formatted service list', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({
        services: {
          'test-service': {
            command: 'node',
            args: ['test.js'],
            enabled: true,
            type: 'custom'
          }
        }
      });
      
      const services = mcpManager.listServices();
      
      expect(services).toHaveLength(1);
      expect(services[0]).toEqual({
        name: 'test-service',
        command: 'node',
        args: ['test.js'],
        enabled: true,
        type: 'custom'
      });
    });
  });

  describe('addService', () => {
    beforeEach(() => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({ 
        services: {},
        templates: {
          'test-template': {
            command: 'node',
            args: ['app.js'],
            description: 'Test template'
          }
        }
      });
    });

    it('should add a new service', () => {
      const result = mcpManager.addService('new-service', {
        command: 'node',
        args: ['app.js'],
        type: 'custom'
      });
      
      expect(result.success).toBe(true);
      expect(fs.writeJsonSync).toHaveBeenCalled();
    });

    it('should reject duplicate service names', () => {
      fs.readJsonSync.mockReturnValue({
        services: {
          'existing': { command: 'test' }
        }
      });
      
      const result = mcpManager.addService('existing', {
        command: 'node',
        args: []
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should validate service configuration', () => {
      const result = mcpManager.addService('test', {});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Command is required');
    });

    it('should handle template-based services', () => {
      const result = mcpManager.addService('from-template', {
        template: 'test-template',
        type: 'template'
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('removeService', () => {
    it('should remove existing service', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({
        services: {
          'test-service': { command: 'node' }
        }
      });
      
      const result = mcpManager.removeService('test-service');
      
      expect(result.success).toBe(true);
      expect(fs.writeJsonSync).toHaveBeenCalled();
    });

    it('should handle non-existent service', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({ services: {} });
      
      const result = mcpManager.removeService('non-existent');
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('not found');
    });
  });

  describe('toggleService', () => {
    it('should toggle service enabled state', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({
        services: {
          'test': { command: 'node', enabled: true }
        }
      });
      
      const result = mcpManager.toggleService('test');
      
      expect(result.success).toBe(true);
      expect(result.enabled).toBe(false);
    });

    it('should handle non-existent service', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({ services: {} });
      
      const result = mcpManager.toggleService('non-existent');
      
      expect(result.success).toBe(false);
    });
  });

  describe('getServiceDetails', () => {
    it('should return service details', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({
        services: {
          'test': {
            command: 'node',
            args: ['app.js'],
            enabled: true,
            type: 'custom',
            env: { NODE_ENV: 'production' }
          }
        }
      });
      
      const details = mcpManager.getServiceDetails('test');
      
      expect(details).toEqual({
        name: 'test',
        command: 'node',
        args: ['app.js'],
        enabled: true,
        type: 'custom',
        env: { NODE_ENV: 'production' }
      });
    });

    it('should return null for non-existent service', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({ services: {} });
      
      const details = mcpManager.getServiceDetails('non-existent');
      
      expect(details).toBeNull();
    });
  });

  describe('validateService', () => {
    it('should validate valid service config', () => {
      const result = mcpManager.validateService({
        command: 'node',
        args: ['app.js']
      });
      
      expect(result.valid).toBe(true);
    });

    it('should reject invalid service config', () => {
      const result = mcpManager.validateService({});
      
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Command is required');
    });

    it('should validate service name', () => {
      const result = mcpManager.validateService({
        command: 'node'
      }, 'invalid/name');
      
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toContain('Invalid service name');
    });
  });

  describe('exportConfig', () => {
    it('should export configuration', () => {
      fs.existsSync.mockReturnValue(true);
      const mockConfig = {
        version: '2.0.0',
        services: { test: { command: 'node' } },
        templates: {}
      };
      fs.readJsonSync.mockReturnValue(mockConfig);
      
      const exported = mcpManager.exportConfig();
      
      expect(exported).toEqual(mockConfig);
    });

    it('should return default config when file not exists', () => {
      fs.existsSync.mockReturnValue(false);
      
      const exported = mcpManager.exportConfig();
      
      expect(exported).toEqual({ 
        version: '2.0.0',
        services: {},
        templates: {}
      });
    });
  });

  describe('importConfig', () => {
    it('should import valid configuration', () => {
      const config = {
        version: '2.0.0',
        services: {
          imported: { command: 'python', args: ['app.py'] }
        },
        templates: {}
      };
      
      const result = mcpManager.importConfig(config);
      
      expect(result.success).toBe(true);
      expect(fs.writeJsonSync).toHaveBeenCalled();
    });

    it('should validate configuration before import', () => {
      const result = mcpManager.importConfig({});
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid configuration');
    });

    it('should merge with existing services', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({
        version: '2.0.0',
        services: { existing: { command: 'node' } },
        templates: {}
      });
      
      const result = mcpManager.importConfig({
        version: '2.0.0',
        services: { new: { command: 'python' } },
        templates: {},
        merge: true
      });
      
      expect(result.success).toBe(true);
    });
  });

  describe('getTemplates', () => {
    it('should return available templates', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({
        templates: {
          'template1': { command: 'node', description: 'Template 1' },
          'template2': { command: 'python', description: 'Template 2' }
        }
      });
      
      const templates = mcpManager.getTemplates();
      
      expect(templates).toHaveLength(2);
      expect(templates[0].name).toBe('template1');
      expect(templates[1].name).toBe('template2');
    });

    it('should return empty array when no templates', () => {
      fs.existsSync.mockReturnValue(false);
      
      const templates = mcpManager.getTemplates();
      
      expect(templates).toEqual([]);
    });
  });

  describe('interactive methods', () => {
    it('should handle showMenu', async () => {
      inquirer.prompt.mockResolvedValue({ action: 'list' });
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({ services: {} });
      
      await mcpManager.showMenu();
      
      expect(inquirer.prompt).toHaveBeenCalled();
    });

    it('should handle addServiceInteractive', async () => {
      inquirer.prompt.mockResolvedValue({
        name: 'test-service',
        type: 'custom',
        command: 'node',
        args: 'app.js'
      });
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({ services: {} });
      
      await mcpManager.addServiceInteractive();
      
      expect(inquirer.prompt).toHaveBeenCalled();
    });
  });

  describe('checkMCPSupport', () => {
    it('should detect MCP support', () => {
      execSync.mockReturnValue('claude version 1.0.0');
      
      const result = mcpManager.checkMCPSupport();
      
      expect(result.supported).toBe(true);
    });

    it('should handle MCP not available', () => {
      execSync.mockImplementation(() => {
        throw new Error('command not found');
      });
      
      const result = mcpManager.checkMCPSupport();
      
      expect(result.supported).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should handle file read errors gracefully', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockImplementation(() => {
        throw new Error('Read error');
      });
      
      const services = mcpManager.listServices();
      
      expect(services).toEqual([]);
    });

    it('should handle file write errors', () => {
      fs.existsSync.mockReturnValue(true);
      fs.readJsonSync.mockReturnValue({ services: {} });
      fs.writeJsonSync.mockImplementation(() => {
        throw new Error('Write error');
      });
      
      const result = mcpManager.addService('test', {
        command: 'node',
        args: []
      });
      
      expect(result.success).toBe(false);
      expect(result.error).toContain('Write error');
    });
  });
});