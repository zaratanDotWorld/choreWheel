exports.up = function(knex, Promise) {
    return knex.schema.createTable('chore_pref', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true);
        t.string('house_id').references('house.slack_id').notNull();
        t.string('preferred_by').references('resident.slack_id').notNull();
        t.integer('alpha_chore_id').references('chore.id').notNull();
        t.integer('beta_chore_id').references('chore.id').notNull();
        t.float('preference').notNull().checkBetween([0, 1]);
        t.unique(['house_id', 'preferred_by', 'alpha_chore_id', 'beta_chore_id']);
        t.check('?? < ??', ['alpha_chore_id', 'beta_chore_id']);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('chore_pref');
};
