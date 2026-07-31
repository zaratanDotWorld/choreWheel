// SPDX-FileCopyrightText: 2020 Kronosapiens Labs, LLC
// SPDX-License-Identifier: AGPL-3.0-or-later

require('dotenv').config({ quiet: true });

module.exports = {
  development: {
    client: 'pg',
    connection: process.env.PG_CONNECTION_DEV,
  },
  test: {
    client: 'pg',
    connection: process.env.PG_CONNECTION_TEST,
  },
  production: {
    client: 'pg',
    connection: {
      connectionString: process.env.PG_CONNECTION_PROD,
      ssl: { rejectUnauthorized: false },
    },
  },
};
