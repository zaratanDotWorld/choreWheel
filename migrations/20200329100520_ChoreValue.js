exports.up = function(knex, Promise) {
    return knex.schema.createTable('ChoreValue', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('houseId').references('House.slackId').notNull();
        t.integer('choreId').references('Chore.id').notNull();
        t.timestamp('valuedAt').notNull();
        t.float('value').notNull();
        t.jsonb('metadata').notNull().defaultTo({});
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('ChoreValue');
};
