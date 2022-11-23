/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
 exports.up = function(knex) {
  return knex.schema.alterTable('ThingBuy', function(t) {
    t.string('fulfilledBy').references('Resident.slackId');
    t.timestamp('fulfilledAt');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('ThingBuy', function(t) {
    t.dropColumn('fulfilledBy');
    t.dropColumn('fulfilledAt');
  });
};
