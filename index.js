const { getRouter } = require('stremio-addon-sdk');
const addonInterface = require('./addon.js');

module.exports = getRouter(addonInterface);
