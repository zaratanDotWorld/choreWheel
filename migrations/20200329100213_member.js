exports.up = function(knex, Promise) {
    return knex.schema.createTable('resident', function(t) {
        t.increments('id').unsigned().primary();
        t.string('slack_id').unique().notNull();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('username').unique().notNull();
        t.integer('balance');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('resident');
};
