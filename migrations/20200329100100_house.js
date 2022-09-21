exports.up = function(knex, Promise) {
    return knex.schema.createTable('House', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('name').unique();
        t.string('slackId').unique().notNull(); // Slack Team Id
        t.string('choresOauth');
        t.string('choresChannel');
        t.string('heartsOauth');
        t.string('heartsChannel');
        t.string('thingsOauth');
        t.string('thingsChannel');
        t.string('hangsOauth');
        t.string('hangsChannel');
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('House');
};
