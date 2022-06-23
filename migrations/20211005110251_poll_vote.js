exports.up = function(knex, Promise) {
    return knex.schema.createTable('poll_vote', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.integer('poll_id').references('poll.id').notNull();
        t.string('user').references('user.slack_id').notNull();
        t.boolean('value');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('poll_vote');
};
