exports.up = function(knex, Promise) {
    return knex.schema.createTable('user', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('email').unique().notNull();
        t.string('slack_id').unique().notNull();
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('user');
};
