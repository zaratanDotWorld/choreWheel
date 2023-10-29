/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.createTable('ThingProposal', function(t) {
    t.increments('id').unsigned().primary();
    t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
    t.string('houseId').references('House.slackId').notNull();
    t.string('proposedBy').references('Resident.slackId').notNull();
    t.integer('thingId').references('Thing.id');
    t.string('type').notNull();
    t.string('name').notNull();
    t.float('value').notNull().defaultTo(0);
    t.boolean('active').notNull().defaultTo(true);
    t.jsonb('metadata').notNull().defaultTo({});
    t.integer('pollId').references('Poll.id').notNull();
    t.timestamp('resolvedAt');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.dropTable('ThingProposal');
};
