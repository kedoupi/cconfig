const chalk = require('chalk');

/**
 * Display CCVM banner with ASCII art
 * @param {string} subtitle - Optional subtitle to display below the banner
 */
function displayBanner(subtitle = 'Claude Code Version Manager') {
  const banner = chalk.cyan(`
╭─────────────────────────────────────────────────────────────╮
│                                                             │
│  ██████  ██████ ██    ██ ███    ███                         │
│ ██      ██      ██    ██ ████  ████                         │
│ ██      ██      ██    ██ ██ ████ ██                         │
│ ██      ██      ██    ██ ██  ██  ██                         │
│  ██████  ██████  ██████  ██      ██                         │
│                                                             │
│ ${chalk.white.bold(subtitle.padEnd(59))} │
│                                                             │
╰─────────────────────────────────────────────────────────────╯
  `);
  
  console.log(banner);
}

/**
 * Display CCVM banner with version and homepage info
 * @param {string} subtitle - Optional subtitle to display
 */
function displayBannerWithInfo(subtitle) {
  try {
    const packageJson = require('../../package.json');
    const version = packageJson.version;
    const homepage = packageJson.homepage || 'https://github.com/kedoupi/ccvm';
    
    displayBanner(subtitle);
    
    console.log(chalk.gray(`  Version: ${version}`));
    console.log(chalk.gray(`  Homepage: ${homepage}`));
    console.log(); // Empty line
  } catch (error) {
    // If package.json can't be read, fallback to basic banner
    displayBanner(subtitle);
  }
}

/**
 * Create compact CCVM logo for smaller displays
 */
function displayCompactBanner() {
  const compactLogo = chalk.cyan.bold(`
  ╭──────────────────────────╮
  │  ██████  ██████ ██    ██ │
  │ ██      ██      ██    ██ │
  │ ██      ██      ██    ██ │
  │ ██      ██      ██    ██ │
  │  ██████  ██████  ██████  │
  │ ${chalk.white('Claude Code Version Manager')} │
  ╰──────────────────────────╯
  `);
  
  console.log(compactLogo);
}

/**
 * Display welcome message with banner
 * @param {string} message - Welcome message to display
 */
function displayWelcome(message = 'Welcome to CCVM!') {
  displayBanner();
  console.log(chalk.yellow('🎉 ' + message));
  console.log();
}

/**
 * Display error banner for critical errors
 * @param {string} errorMessage - Error message to display
 */
function displayErrorBanner(errorMessage) {
  console.log();
  console.log(chalk.red('╭─' + '─'.repeat(errorMessage.length + 2) + '─╮'));
  console.log(chalk.red('│ ') + chalk.white.bold('❌ ' + errorMessage) + chalk.red(' │'));
  console.log(chalk.red('╰─' + '─'.repeat(errorMessage.length + 2) + '─╯'));
  console.log();
}

/**
 * Display success banner
 * @param {string} successMessage - Success message to display
 */
function displaySuccessBanner(successMessage) {
  console.log();
  console.log(chalk.green('╭─' + '─'.repeat(successMessage.length + 2) + '─╮'));
  console.log(chalk.green('│ ') + chalk.white.bold('✅ ' + successMessage) + chalk.green(' │'));
  console.log(chalk.green('╰─' + '─'.repeat(successMessage.length + 2) + '─╯'));
  console.log();
}

module.exports = {
  displayBanner,
  displayBannerWithInfo,
  displayCompactBanner,
  displayWelcome,
  displayErrorBanner,
  displaySuccessBanner
};