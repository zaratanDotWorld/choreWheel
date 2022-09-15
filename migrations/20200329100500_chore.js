exports.up = function(knex, Promise) {
    return knex.schema.createTable('chore', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('house_id').references('house.slack_id').notNull();
        t.string('name').notNull();
        t.unique(['house_id', 'name']);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('chore');
};
