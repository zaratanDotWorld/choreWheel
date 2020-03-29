
exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('chore').del()
    .then(function () {
      // Inserts seed entries
      return knex('chore').insert([
        {id: 1, name: 'dishes'},
        {id: 2, name: 'sweeping'},
        {id: 3, name: 'restock'}
      ]);
    });
};
