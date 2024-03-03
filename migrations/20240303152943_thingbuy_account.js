/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.alterTable('ThingBuy', function(t) {
    t.string('account').notNull().defaultTo('General');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('ThingBuy', function(t) {
    t.dropColumn('account');
  });
};
