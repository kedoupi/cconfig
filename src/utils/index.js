const errorHandler = require('./errorHandler');
const logger = require('./logger');
const banner = require('./banner');

module.exports = {
  ...errorHandler,
  ...logger,
  ...banner
};