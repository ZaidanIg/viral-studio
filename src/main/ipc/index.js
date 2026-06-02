const registerCharacterIpc = require('./characterIpc');
const registerProductIpc = require('./productIpc');
const registerMarketingIpc = require('./marketingIpc');

function registerAllIpc() {
  registerCharacterIpc();
  registerProductIpc();
  registerMarketingIpc();
}

module.exports = registerAllIpc;
