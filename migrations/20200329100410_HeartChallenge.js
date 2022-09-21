exports.up = function(knex, Promise) {
    return knex.schema.createTable('HeartChallenge', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('houseId').references('House.slackId').notNull();
        t.string('challenger').references('Resident.slackId');
        t.string('challengee').references('Resident.slackId');
        t.integer('value');
        t.integer('pollId').references('Poll.id');
        t.integer('heartId').references('Heart.id');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('HeartChallenge');
};
