/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('HeartChallenge', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('houseId').references('House.slackId').notNull();
        t.string('challengerId').references('Resident.slackId').notNull();
        t.string('challengeeId').references('Resident.slackId').notNull();
        t.timestamp('challengedAt').notNull();
        t.integer('value').notNull();
        t.integer('pollId').references('Poll.id').notNull();
        t.timestamp('resolvedAt');
        t.integer('heartId').references('Heart.id');
        t.jsonb('metadata').notNull().defaultTo({});
        t.check('?? != ??', ['challengerId', 'challengeeId']);
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTable('HeartChallenge');
};
