exports.up = function(knex, Promise) {
    return knex.schema.createTable('chore', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('name').unique().notNull();
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('chore');
};
