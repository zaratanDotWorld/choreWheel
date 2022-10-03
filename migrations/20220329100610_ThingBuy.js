exports.up = function(knex, Promise) {
    return knex.schema.createTable('ThingBuy', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('houseId').references('House.slackId');
        t.integer('thingId').references('Thing.id');
        t.string('boughtBy').references('Resident.slackId');
        t.timestamp('boughtAt').notNull();
        t.float('value').notNull();
        t.integer('pollId').references('Poll.id');
        t.timestamp('resolvedAt');
        t.boolean('valid').notNull().defaultTo(true);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('ThingBuy');
};
