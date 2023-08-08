/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('Heart', function(t) {
    t.tinyint('type').notNull().defaultTo(0);
    t.json('metadata');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('Heart', function(t) {
    t.dropColumn('type');
    t.dropColumn('metadata');
  });
};
