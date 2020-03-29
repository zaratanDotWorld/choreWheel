exports.up = function(knex, Promise) {
    return knex.schema.createTable('clog', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.integer('chore_id').references('chore.id');
        t.integer('value');
        t.timestamp('valued_at');
        // t.integer('claimed_by').references('member.id');
        t.string('claimed_by'); // Use slack usercode for now
        t.timestamp('claimed_at');
        t.integer('claimed_value');
        // t.integer('done_by').references('member.id');
        t.string('done_by'); // Use slack usercode for now
        t.timestamp('done_at');
        t.integer('done_value');
        t.string('done_message');
        t.integer('votes_yay');
        t.integer('votes_nay');
        t.integer('voted_at');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('clog');
};
