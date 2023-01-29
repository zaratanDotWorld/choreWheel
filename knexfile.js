require('dotenv').config();

module.exports = {
  test: {
    client: 'pg',
    connection: process.env.PG_CONNECTION_TEST
  }
};
