/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('HeartKarma', function(t) {
    t.increments('id').unsigned().primary();
    t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
    t.string('houseId').references('House.slackId').notNull();
    t.string('giverId').references('Resident.slackId').notNull();
    t.string('receiverId').references('Resident.slackId').notNull();
    t.timestamp('givenAt').notNull();
    t.check('?? != ??', ['giverId', 'receiverId']);
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('HeartKarma');
};
