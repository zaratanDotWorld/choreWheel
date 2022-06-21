exports.up = function(knex, Promise) {
    return knex.schema.createTable('chore_act', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('chore_name').references('chore.name').notNull();
        t.string('claimed_by').references('resident.slack_id');
        t.timestamp('claimed_at');
        t.timestamp('unclaimed_at');
        t.string('done_by').references('resident.slack_id');
        t.timestamp('done_at');
        t.string('message_id');
        t.integer('poll_id');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('chore_act');
};
