/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
 exports.up = function(knex) {
  return knex.schema.alterTable('HeartChallenge', function(t) {
    t.timestamp('challengedAt').notNull();
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.alterTable('HeartChallenge', function(t) {
    t.dropNullable('challengedAt');
    t.dropColumn('challengedAt');
  });
};
