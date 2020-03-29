exports.up = function(knex, Promise) {
    return knex.schema.createTable('member', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('username').unique().notNull();
        t.string('userid').unique().notNull();
        t.integer('balance');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('member');
};
