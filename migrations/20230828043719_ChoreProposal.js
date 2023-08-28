/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('ChoreProposal', function(t) {
    t.increments('id').unsigned().primary();
    t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
    t.string('houseId').references('House.slackId').notNull();
    t.string('proposedBy').references('Resident.slackId').notNull();
    t.integer('choreId').references('Chore.id');
    t.string('name').notNull();
    t.boolean('active').notNull().defaultTo(true);
    t.json('metadata');
    t.integer('pollId').references('Poll.id').notNull();
    t.timestamp('resolvedAt');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('ChoreProposal');
};
