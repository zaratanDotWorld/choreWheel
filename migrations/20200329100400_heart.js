exports.up = function(knex, Promise) {
    return knex.schema.createTable('heart', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('resident').references('resident.slack_id');
        t.float('value');
        t.enu('source', ['regeneration', 'challenge']);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('heart');
};
