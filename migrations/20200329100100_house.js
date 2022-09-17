exports.up = function(knex, Promise) {
    return knex.schema.createTable('house', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('name').unique();
        t.string('slack_id').unique().notNull(); // Slack Team Id
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('house');
};
