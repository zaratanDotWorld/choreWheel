exports.up = function(knex, Promise) {
    return knex.schema.createTable('poll_vote', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.integer('poll_id').references('poll.id').notNull();
        t.string('encrypted_resident_id').notNull();
        t.boolean('vote');
        t.unique(['poll_id', 'encrypted_resident_id']);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('poll_vote');
};
