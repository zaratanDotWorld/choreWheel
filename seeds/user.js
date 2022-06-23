
exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('user').del()
    .then(function () {
      // Inserts seed entries
      return knex('user').insert([
        {id: 1, slack_id: 'ABC', username: 'Keiko'},
        {id: 2, slack_id: 'XYZ', username: 'Amber'},
      ]);
    });
};
