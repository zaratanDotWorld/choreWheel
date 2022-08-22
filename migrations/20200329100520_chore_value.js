exports.up = function(knex, Promise) {
    return knex.schema.createTable('chore_value', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('chore_name').references('chore.name').notNull();
        t.integer('value');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('chore_value');
};
