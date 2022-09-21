exports.up = function(knex, Promise) {
    return knex.schema.createTable('ChoreValue', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.integer('choreId').references('Chore.id').notNull();
        t.timestamp('valuedAt').notNull();
        t.float('value').notNull();
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('ChoreValue');
};
