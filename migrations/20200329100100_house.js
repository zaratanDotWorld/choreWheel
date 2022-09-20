exports.up = function(knex, Promise) {
    return knex.schema.createTable('house', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('name').unique();
        t.string('slack_id').unique().notNull(); // Slack Team Id
        t.string('chores_oauth');
        t.string('chores_channel');
        t.string('hearts_oauth');
        t.string('hearts_channel');
        t.string('things_oauth');
        t.string('things_channel');
        t.string('hangs_oauth');
        t.string('hangs_channel');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('house');
};
