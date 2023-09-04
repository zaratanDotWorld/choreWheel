exports.up = function(knex, Promise) {
    return knex.schema.createTable('Resident', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('slackId').unique().notNull(); // Slack User Id
        t.string('houseId').references('House.slackId').notNull();
        t.boolean('active').notNull().defaultTo(true);
        t.timestamp('activeAt');
        t.timestamp('exemptAt');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('Resident');
};
