exports.up = function(knex, Promise) {
    return knex.schema.createTable('chore_pref', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('alpha_chore_name').references('chore.name').notNull();
        t.string('beta_chore_name').references('chore.name').notNull();
        t.string('preferred_by').references('user.slack_id').notNull();
        t.boolean('preference').notNull();
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('chore_pref');
};
