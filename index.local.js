const addon = require('./index');

addon.listen(7000, function () {
  console.log('Add-on Repository URL: http://127.0.0.1:7000/manifest.json');
});