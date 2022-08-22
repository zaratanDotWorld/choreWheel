exports.up = function(knex, Promise) {
    return knex.schema.createTable('poll', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.integer('duration').notNull();
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('poll');
};
