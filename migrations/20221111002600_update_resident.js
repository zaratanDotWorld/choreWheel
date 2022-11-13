/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('Resident', function(t) {
    t.timestamp('activeAt');
    t.dropColumn('name');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('Resident', function(t) {
    t.dropColumn('activeAt');
    t.string('name');
  });
};
