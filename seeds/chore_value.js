
exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('chore_value').del()
    .then(function () {
      // Inserts seed entries
      return knex('chore_value').insert([
        {id: 1, chore_name: 'dishes', value: 15 },
        {id: 2, chore_name: 'sweeping', value: 10 }
      ]);
    });
};
