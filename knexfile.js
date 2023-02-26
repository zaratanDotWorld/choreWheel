require('dotenv').config();

module.exports = {
  development: {
    client: 'pg',
    connection: process.env.PG_CONNECTION_DEV
  },
  test: {
    client: 'pg',
    connection: process.env.PG_CONNECTION_TEST
  },
  production: {
    client: 'pg',
    connection: process.env.PG_CONNECTION_PROD
  }
};
