/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('ChoreValue', function(t) {
    t.json('metadata');
    t.dropColumn('ranking');
    t.dropColumn('residents');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('ChoreValue', function(t) {
    t.dropColumn('metadata');
    t.float('ranking');
    t.integer('residents');
  });
};
