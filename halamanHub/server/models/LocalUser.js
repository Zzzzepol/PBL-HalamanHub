const { localConnection } = require('../config/connections');
const User = require('./User');

// The local copy is an authentication cache for offline admin access.
module.exports = localConnection === User.db
  ? User
  : localConnection.model('User', User.schema);
