exports.up = function(knex, Promise) {
    return knex.schema.createTable('Chore', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('houseId').references('House.slackId').notNull();
        t.string('name').notNull();
        t.boolean('active').notNull().defaultTo(true);
        t.json('metadata').notNull().defaultTo({});
        t.unique(['houseId', 'name']);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('Chore');
};
