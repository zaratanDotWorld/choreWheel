exports.up = function(knex, Promise) {
    return knex.schema.createTable('PollVote', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.integer('pollId').references('Poll.id').notNull();
        t.string('encryptedResidentId').notNull();
        t.timestamp('submittedAt').notNull();
        t.boolean('vote');
        t.unique(['pollId', 'encryptedResidentId']);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('PollVote');
};
