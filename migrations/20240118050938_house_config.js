/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('House', function(t) {
    t.jsonb('choresConf').notNull().defaultTo({});
    t.jsonb('heartsConf').notNull().defaultTo({});
    t.jsonb('thingsConf').notNull().defaultTo({});
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('House', function(t) {
    t.dropColumn('choresConf');
    t.dropColumn('heartsConf');
    t.dropColumn('thingsConf');
  });
};
