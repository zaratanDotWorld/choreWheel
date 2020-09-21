
exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('chore_act').del()
    .then(function () {
      const now = Date.now();
      // Inserts seed entries
      return knex('chore_act').insert([
        {id: 1, chore_name: 'dishes', value: 15, valued_at: now },
        {id: 2, chore_name: 'sweeping', value: 10, valued_at: now }
      ]);
    });
};
