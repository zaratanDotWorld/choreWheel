exports.up = function(knex, Promise) {
    return knex.schema.createTable('heart', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('house_id').references('house.slack_id').notNull();
        t.string('resident_id').references('resident.slack_id').notNull();
        t.float('value');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('heart');
};
