module.exports = {
  development: {
    client: 'pg',
    connection: process.env.PG_CONNECTION_DEV,
    migrations: {
      tableName: 'knex_migrations'
    },
    useNullAsDefault: true
  },

  test: {
    client: 'pg',
    connection: process.env.PG_CONNECTION_TEST,
    migrations: {
      tableName: 'knex_migrations'
    },
    useNullAsDefault: true
  },

  production: {
    client: 'pg',
    connection: process.env.PG_CONNECTION_PROD,
    migrations: {
      tableName: 'knex_migrations'
    },
    useNullAsDefault: true
  }
}
