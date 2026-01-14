exports.up = function(knex) {
  return knex.schema.alterTable('Resident', function(t) {
    t.jsonb('metadata').notNull().defaultTo({});
  });
};

exports.down = function(knex) {
  return knex.schema.alterTable('Resident', function(t) {
    t.dropColumn('metadata');
  });
};
