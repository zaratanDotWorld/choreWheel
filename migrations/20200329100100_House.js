exports.up = function(knex, Promise) {
    return knex.schema.createTable('House', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('name').unique();
        t.string('slackId').unique().notNull(); // Slack Team Id
        t.jsonb('metadata').notNull().defaultTo({});
        t.jsonb('choresConf').notNull().defaultTo({});
        t.jsonb('heartsConf').notNull().defaultTo({});
        t.jsonb('thingsConf').notNull().defaultTo({});
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('House');
};
