exports.up = function(knex, Promise) {
    return knex.schema.createTable('HeartChallenge', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('houseId').references('House.slackId').notNull();
        t.string('challenger').references('Resident.slackId').notNull();
        t.string('challengee').references('Resident.slackId').notNull();
        t.integer('value').notNull();
        t.integer('pollId').references('Poll.id').notNull();
        t.timestamp('resolvedAt');
        t.integer('heartId').references('Heart.id');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('HeartChallenge');
};
