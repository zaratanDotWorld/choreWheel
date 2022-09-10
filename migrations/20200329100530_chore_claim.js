exports.up = function(knex, Promise) {
    return knex.schema.createTable('chore_claim', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('chore_name').references('chore.name').notNull();
        t.string('reserved_by').references('resident.slack_id');
        t.timestamp('reserved_at');
        t.timestamp('unreserved_at');
        t.string('claimed_by').references('resident.slack_id');
        t.timestamp('claimed_at');
        t.integer('value');
        t.string('message_id');
        t.integer('poll_id').references('poll.id');
        t.enu('result', ['unknown', 'fail', 'pass']).defaultTo('unknown');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('chore_claim');
};
