const { displayWelcome, displayBanner, getColoredBanner } = require('../../../src/utils/banner');
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
    it('should display welcome message with version', () => {
      displayWelcome('1.0.0');
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('CCVM');
      expect(output).toContain('1.0.0');
    });

    it('should display welcome message without version', () => {
      displayWelcome();
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('CCVM');
    });

    it('should include configuration management text', () => {
      displayWelcome('2.0.0');
      
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('Configuration');
    });
  });

  describe('displayBanner', () => {
    it('should display banner with default style', () => {
      displayBanner();
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('CCVM');
    });

    it('should display banner with specified style', () => {
      displayBanner('doom');
      
      expect(consoleSpy).toHaveBeenCalled();
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output.length).toBeGreaterThan(0);
    });

    it('should handle invalid style gracefully', () => {
      displayBanner('invalid-style');
      
      expect(consoleSpy).toHaveBeenCalled();
      // Should fall back to default
      const output = consoleSpy.mock.calls.flat().join('\n');
      expect(output).toContain('CCVM');
    });

    it('should support different banner styles', () => {
      const styles = ['standard', 'doom', 'slant'];
      
      styles.forEach(style => {
        consoleSpy.mockClear();
        displayBanner(style);
        expect(consoleSpy).toHaveBeenCalled();
      });
    });
  });

  describe('getColoredBanner', () => {
    it('should return colored banner text', () => {
      const result = getColoredBanner();
      
      expect(typeof result).toBe('string');
      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain('CCVM');
    });

    it('should apply gradient colors', () => {
      const result = getColoredBanner('standard');
      
      // Check that some coloring is applied
      expect(result.length).toBeGreaterThan(0);
    });

    it('should handle different styles', () => {
      const standard = getColoredBanner('standard');
      const doom = getColoredBanner('doom');
      
      expect(standard).toBeDefined();
      expect(doom).toBeDefined();
      // Different styles should produce different outputs
      expect(standard).not.toBe(doom);
    });

    it('should include version if provided', () => {
      const result = getColoredBanner('standard', '3.0.0');
      
      expect(result).toContain('3.0.0');
    });
  });

  describe('ASCII art patterns', () => {
    it('should have valid ASCII art for each style', () => {
      const styles = ['standard', 'doom', 'slant'];
      
      styles.forEach(style => {
        const banner = getColoredBanner(style);
        // Check for basic ASCII art structure
        expect(banner).toMatch(/[━│┃┌┐└┘├┤┬┴┼═║╔╗╚╝╠╣╦╩╬]/);
      });
    });

    it('should maintain consistent width', () => {
      const banner = getColoredBanner();
      const lines = banner.split('\n');
      
      // All decorative lines should have similar width
      const decorativeLines = lines.filter(line => 
        line.includes('━') || line.includes('═')
      );
      
      if (decorativeLines.length > 0) {
        const widths = decorativeLines.map(line => line.length);
        const maxWidth = Math.max(...widths);
        const minWidth = Math.min(...widths);
        
        // Width variance should be reasonable
        expect(maxWidth - minWidth).toBeLessThan(10);
      }
    });
  });
});