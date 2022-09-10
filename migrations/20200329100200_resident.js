exports.up = function(knex, Promise) {
    return knex.schema.createTable('resident', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('email').unique();
        t.string('slack_id').unique().notNull();
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('resident');
};
