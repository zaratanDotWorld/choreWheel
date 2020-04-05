
exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('act').del()
    .then(function () {
      // Inserts seed entries
      return knex('act').insert([
        {id: 1, chore_name: 'dishes', value: 10 },
        {id: 2, chore_name: 'sweeping', value: 10 }
      ]);
    });
};
