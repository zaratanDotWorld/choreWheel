exports.up = function(knex, Promise) {
    return knex.schema.createTable('Heart', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('houseId').references('House.slackId').notNull();
        t.string('residentId').references('Resident.slackId').notNull();
        t.timestamp('generatedAt').notNull();
        t.float('value').notNull();
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('Heart');
};
