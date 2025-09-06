#!/usr/bin/env node

/**
 * Integration Test for Claude Code Kit
 * 
 * Tests the complete workflow of the system to ensure all components
 * work together properly.
 */

const fs = require('fs-extra');
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const { promisify } = require('util');

// Import core modules
const ConfigManager = require('../src/core/ConfigManager');
const ProviderManager = require('../src/core/ProviderManager');
// BackupManager removed as per user requirements
const ErrorHandler = require('../src/utils/errorHandler');

const execAsync = promisify(exec);

// Test configuration
const TEST_CONFIG_DIR = path.join(os.tmpdir(), 'cc-test-' + Date.now());
const TEST_CLAUDE_DIR = path.join(os.tmpdir(), 'claude-test-' + Date.now());

class IntegrationTest {
  constructor() {
    this.configManager = new ConfigManager(TEST_CONFIG_DIR);
    this.providerManager = new ProviderManager(TEST_CONFIG_DIR);
    // BackupManager removed as per user requirements
    // AliasGenerator removed as per user requirements
    this.errorHandler = new ErrorHandler();
    
    this.results = {
      passed: 0,
      failed: 0,
      errors: []
    };
  }

  /**
   * Run all integration tests
   */
  async runTests() {
    console.log('🧪 Starting Claude Code Kit Integration Tests\n');
    console.log(`Test Config Dir: ${TEST_CONFIG_DIR}`);
    console.log(`Test Claude Dir: ${TEST_CLAUDE_DIR}\n`);

    try {
      // Test each component individually
      await this.testConfigManager();
      await this.testProviderManager();
      // Backup manager test removed as per user requirements
      // AliasGenerator test removed as per user requirements
      await this.testErrorHandler();
      
      // Test full workflow
      await this.testFullWorkflow();
      
      // Cleanup
      await this.cleanup();
      
      // Report results
      this.reportResults();
      
    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      await this.cleanup();
      process.exit(1);
    }
  }

  /**
   * Test ConfigManager functionality
   */
  async testConfigManager() {
    console.log('📝 Testing ConfigManager...');
    
    try {
      // Test initialization
      await this.configManager.init();
      this.pass('ConfigManager initialization');
      
      // Test directory creation
      const configExists = await fs.pathExists(TEST_CONFIG_DIR);
      if (configExists) {
        this.pass('Configuration directory created');
      } else {
        this.fail('Configuration directory not created');
      }
      
      // Test validation
      const validation = await this.configManager.validateConfiguration();
      if (validation.valid) {
        this.pass('Configuration validation');
      } else {
        this.fail(`Configuration validation failed: ${validation.issues.join(', ')}`);
      }
      
      // Test system info
      const systemInfo = await this.configManager.getSystemInfo();
      if (systemInfo && systemInfo.version) {
        this.pass('System info retrieval');
      } else {
        this.fail('System info retrieval failed');
      }
      
    } catch (error) {
      this.fail(`ConfigManager test failed: ${error.message}`);
    }
  }

  /**
   * Test ProviderManager functionality
   */
  async testProviderManager() {
    console.log('🔧 Testing ProviderManager...');
    
    try {
      // Test adding a provider
      const testProvider = {
        alias: 'test-provider',
        baseURL: 'https://api.example.com',
        apiKey: 'test-api-key-123456789',
        timeout: '5000'
      };
      
      await this.providerManager.addProvider(testProvider);
      this.pass('Provider addition');
      
      // Test provider retrieval
      const provider = await this.providerManager.getProvider('test-provider');
      if (provider && provider.alias === 'test-provider') {
        this.pass('Provider retrieval');
      } else {
        this.fail('Provider retrieval failed');
      }
      
      // Test provider listing
      const providers = await this.providerManager.listProviders();
      if (providers.length === 1 && providers[0].alias === 'test-provider') {
        this.pass('Provider listing');
      } else {
        this.fail('Provider listing failed');
      }
      
      // Test provider update
      const updatedProvider = { ...testProvider, timeout: '10000' };
      await this.providerManager.updateProvider('test-provider', updatedProvider);
      const retrievedProvider = await this.providerManager.getProvider('test-provider');
      if (retrievedProvider.timeout === '10000') {
        this.pass('Provider update');
      } else {
        this.fail('Provider update failed');
      }
      
      // Test provider testing
      const testResult = await this.providerManager.testProvider('test-provider');
      if (testResult && typeof testResult.reachable === 'boolean') {
        this.pass('Provider testing');
      } else {
        this.fail('Provider testing failed');
      }
      
    } catch (error) {
      this.fail(`ProviderManager test failed: ${error.message}`);
    }
  }

  /**
   * BackupManager test removed as per user requirements
   */

  // AliasGenerator test removed as per user requirements

  /**
   * Test ErrorHandler functionality
   */
  async testErrorHandler() {
    console.log('🚨 Testing ErrorHandler...');
    
    try {
      // Test error handling
      const testError = new Error('Test error for integration test');
      testError.code = 'TEST_ERROR';
      
      const formattedError = await this.errorHandler.handleError(testError, {
        operation: 'integration-test',
        component: 'ErrorHandler'
      });
      
      if (formattedError && formattedError.category && formattedError.suggestions) {
        this.pass('Error handling and formatting');
      } else {
        this.fail('Error handling failed');
      }
      
      // Test error logging
      const recentErrors = await this.errorHandler.getRecentErrors(1);
      if (recentErrors.length > 0 && recentErrors[0].message === 'Test error for integration test') {
        this.pass('Error logging');
      } else {
        this.fail('Error logging failed');
      }
      
      // Test error statistics
      const stats = await this.errorHandler.getErrorStats();
      if (stats && stats.total >= 1) {
        this.pass('Error statistics');
      } else {
        this.fail('Error statistics failed');
      }
      
    } catch (error) {
      this.fail(`ErrorHandler test failed: ${error.message}`);
    }
  }

  /**
   * Test full workflow integration
   */
  async testFullWorkflow() {
    console.log('🔄 Testing Full Workflow Integration...');
    
    try {
      // Create a second provider
      const secondProvider = {
        alias: 'workflow-test',
        baseURL: 'https://api.workflow.test',
        apiKey: 'workflow-test-key-123456789',
        timeout: '3000'
      };
      
      await this.providerManager.addProvider(secondProvider);
      
      // Regenerate aliases
      await this.aliasGenerator.generateAliases();
      
      // Verify aliases include both providers
      const aliasContent = await fs.readFile(path.join(TEST_CONFIG_DIR, 'aliases.sh'), 'utf8');
      if (aliasContent.includes('test-provider') && aliasContent.includes('workflow-test')) {
        this.pass('Multi-provider alias generation');
      } else {
        this.fail('Multi-provider alias generation failed');
      }
      
      // Backup workflow test removed as per user requirements
      
      // Test configuration validation with multiple components
      const validation = await this.configManager.validateConfiguration();
      if (validation.valid) {
        this.pass('Full system validation');
      } else {
        this.fail(`Full system validation failed: ${validation.issues.join(', ')}`);
      }
      
      // Test provider removal
      await this.providerManager.removeProvider('workflow-test');
      const remainingProviders = await this.providerManager.listProviders();
      if (remainingProviders.length === 1 && remainingProviders[0].alias === 'test-provider') {
        this.pass('Provider removal');
      } else {
        this.fail('Provider removal failed');
      }
      
    } catch (error) {
      this.fail(`Full workflow test failed: ${error.message}`);
    }
  }

  /**
   * Mark test as passed
   */
  pass(testName) {
    console.log(`  ✅ ${testName}`);
    this.results.passed++;
  }

  /**
   * Mark test as failed
   */
  fail(testName) {
    console.log(`  ❌ ${testName}`);
    this.results.failed++;
    this.results.errors.push(testName);
  }

  /**
   * Clean up test directories
   */
  async cleanup() {
    try {
      await fs.remove(TEST_CONFIG_DIR);
      await fs.remove(TEST_CLAUDE_DIR);
    } catch (error) {
      console.warn('Warning: Failed to clean up test directories:', error.message);
    }
  }

  /**
   * Report test results
   */
  reportResults() {
    console.log('\n📊 Integration Test Results');
    console.log('=====================================');
    console.log(`Total Tests: ${this.results.passed + this.results.failed}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    
    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.errors.forEach(error => console.log(`  - ${error}`));
      console.log('\n🚨 Integration tests failed! Please fix the issues above.');
      process.exit(1);
    } else {
      console.log('\n🎉 All integration tests passed successfully!');
      console.log('✅ Claude Code Kit is ready for production use.');
    }
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  const test = new IntegrationTest();
  test.runTests().catch(error => {
    console.error('❌ Test execution failed:', error.message || error);
    process.exit(1);
  });
}

module.exports = IntegrationTest;