exports.up = function(knex, Promise) {
    return knex.schema.createTable('ChoreClaim', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.integer('choreId').references('Chore.id');
        t.string('claimedBy').references('Resident.slackId').notNull();
        t.timestamp('claimedAt');
        t.float('value');
        t.integer('pollId').references('Poll.id').notNull();
        t.timestamp('resolvedAt');
        t.boolean('valid').notNull().defaultTo(true);
        t.check('?? >= 0', 'value');

    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('ChoreClaim');
};
