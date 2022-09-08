
exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('chore_value').del()
    .then(function () {
      // Inserts seed entries
      return knex('chore_value').insert([
        {id: 1, chore_name: 'restock', value: 10}
      ]);
    });
};
