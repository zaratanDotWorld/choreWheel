exports.up = function(knex, Promise) {
    return knex.schema.createTable('act', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('chore_name').references('chore.name');
        t.integer('value');
        t.timestamp('valued_at');
        t.string('claimed_by').references('member.userid');
        t.timestamp('claimed_at');
        t.integer('claimed_value');
        t.timestamp('unclaimed_at');
        t.string('done_by').references('member.userid');
        t.timestamp('done_at');
        t.string('message_id');
        t.integer('votes_yay');
        t.integer('votes_nay');
        t.integer('closed_at');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('act');
};
