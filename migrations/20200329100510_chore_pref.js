exports.up = function(knex, Promise) {
    return knex.schema.createTable('chore_pref', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('preferred_by').references('resident.slack_id').notNull();
        t.string('alpha_chore').references('chore.name').notNull();
        t.string('beta_chore').references('chore.name').notNull();
        t.boolean('preference').notNull();
        t.unique(['preferred_by', 'alpha_chore', 'beta_chore']);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('chore_pref');
};
