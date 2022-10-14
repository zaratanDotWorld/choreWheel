exports.up = function(knex, Promise) {
    return knex.schema.createTable('Thing', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('houseId').references('House.slackId').notNull();
        t.string('type').notNull();
        t.string('name').notNull();
        t.string('quantity');
        t.float('value').notNull().defaultTo(0);
        t.boolean('active').notNull().defaultTo(true);
        t.unique(['houseId', 'type', 'name']);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('Thing');
};
