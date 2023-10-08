exports.up = function(knex, Promise) {
    return knex.schema.createTable('Poll', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('houseId').references('House.slackId').notNull();
        t.timestamp('startTime').notNull();
        t.timestamp('endTime').notNull();
        t.integer('minVotes').notNull();
        t.json('metadata').notNull().defaultTo({});
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('Poll');
};
