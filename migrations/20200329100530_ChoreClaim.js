exports.up = function(knex, Promise) {
    return knex.schema.createTable('ChoreClaim', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('houseId').references('House.slackId').notNull();;
        t.integer('choreId').references('Chore.id');
        t.string('claimedBy').references('Resident.slackId');
        t.timestamp('claimedAt');
        t.float('value');
        t.integer('pollId').references('Poll.id');
        t.timestamp('resolvedAt');
        t.boolean('valid').notNull().defaultTo(true);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('ChoreClaim');
};
