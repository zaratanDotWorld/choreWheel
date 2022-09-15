exports.up = function(knex, Promise) {
    return knex.schema.createTable('heart_challenge', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('house_id').references('house.slack_id').notNull();
        t.string('challenger').references('resident.slack_id');
        t.string('challengee').references('resident.slack_id');
        t.integer('value');
        t.integer('poll_id').references('poll.id');
        t.integer('heart_id').references('heart.id');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('heart_challenge');
};
