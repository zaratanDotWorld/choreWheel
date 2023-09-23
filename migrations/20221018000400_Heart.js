/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
    return knex.schema.createTable('Heart', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('houseId').references('House.slackId').notNull();
        t.string('residentId').references('Resident.slackId').notNull();
        t.tinyint('type').notNull().defaultTo(0);
        t.timestamp('generatedAt').notNull();
        t.float('value').notNull();
        t.json('metadata').notNull().defaultTo({});
    });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
    return knex.schema.dropTable('Heart');
};
