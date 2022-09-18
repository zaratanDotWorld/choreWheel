exports.up = function(knex, Promise) {
    return knex.schema.createTable('resident', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('name');
        t.string('slack_id').unique().notNull(); // Slack User Id
        t.string('house_id').references('house.slack_id').notNull();
        t.boolean('active').notNull().defaultTo(true);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('resident');
};
