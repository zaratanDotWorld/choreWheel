exports.up = function(knex, Promise) {
    return knex.schema.createTable('ChorePref', function(t) {
        t.increments('id').unsigned().primary();
        t.timestamps(useTimestamps = true, defaultToNow = true, useCamelCase = true);
        t.string('houseId').references('House.slackId').notNull();
        t.string('residentId').references('Resident.slackId').notNull();
        t.integer('alphaChoreId').references('Chore.id').notNull();
        t.integer('betaChoreId').references('Chore.id').notNull();
        t.float('preference').notNull().checkBetween([0, 1]);
        t.unique(['houseId', 'residentId', 'alphaChoreId', 'betaChoreId']);
        t.check('?? < ??', ['alphaChoreId', 'betaChoreId']);
    });
};

exports.down = function(knex, Promise) {
    return knex.schema.dropTable('ChorePref');
};
