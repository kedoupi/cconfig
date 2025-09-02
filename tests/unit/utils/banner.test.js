const { 
  displayWelcome, 
  displayBanner, 
  displayBannerWithInfo,
  displayCompactBanner,
  displayErrorBanner,
  displaySuccessBanner 
} = require('../../../src/utils/banner');
const chalk = require('chalk');

describe('banner', () => {
  let consoleSpy;

  beforeEach(() => {
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('displayWelcome', () => {
    it('should display welcome message with default', () => {
      displayWelcome();
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Welcome to CCVM!');
      expect(output).toContain('██████');
    });

    it('should display welcome message with custom message', () => {
      displayWelcome('Custom welcome message');
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Custom welcome message');
    });

    it('should include banner in welcome', () => {
      displayWelcome();
      
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Claude Code Version Manager');
    });
  });

  describe('displayBanner', () => {
    it('should display banner with default subtitle', () => {
      displayBanner();
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Claude Code Version Manager');
      expect(output).toContain('██████');
    });

    it('should display banner with custom subtitle', () => {
      displayBanner('Custom Subtitle');
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Custom Subtitle');
    });

    it('should display ASCII art', () => {
      displayBanner();
      
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('╭');
      expect(output).toContain('╰');
      expect(output).toContain('│');
    });
  });

  describe('displayBannerWithInfo', () => {
    it('should display banner with package info', () => {
      displayBannerWithInfo('Test Subtitle');
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Version:');
      expect(output).toContain('Homepage:');
    });

    it('should fallback gracefully when package.json not found', () => {
      jest.doMock('../../../package.json', () => {
        throw new Error('Not found');
      });
      
      displayBannerWithInfo();
      
      expect(consoleSpy).toHaveBeenCalled();
    });
  });

  describe('displayCompactBanner', () => {
    it('should display compact banner', () => {
      displayCompactBanner();
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('██████');
      expect(output).toContain('Claude Code Version Manager');
    });
  });

  describe('displayErrorBanner', () => {
    it('should display error banner with message', () => {
      displayErrorBanner('Test error message');
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('❌');
      expect(output).toContain('Test error message');
    });
  });

  describe('displaySuccessBanner', () => {
    it('should display success banner with message', () => {
      displaySuccessBanner('Operation successful');
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('✅');
      expect(output).toContain('Operation successful');
    });
  });

});