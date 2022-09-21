exports.up = function(knex, Promise) {
    return knex.schema.createTable('House', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('name').unique();
        t.string('slackId').unique().notNull(); // Slack Team Id
        t.jsonb('choresOauth');
        t.string('choresChannel');
        t.jsonb('heartsOauth');
        t.string('heartsChannel');
        t.jsonb('thingsOauth');
        t.string('thingsChannel');
        t.jsonb('hangsOauth');
        t.string('hangsChannel');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('House');
};
