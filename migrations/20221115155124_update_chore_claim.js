/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
 exports.up = function(knex) {
  return knex.schema.alterTable('ChoreClaim', function(t) {
    t.string('houseId').references('House.slackId');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('ChoreClaim', function(t) {
    t.dropColumn('houseId');
  });
};
