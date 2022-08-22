
exports.seed = function(knex) {
  // Deletes ALL existing entries
  return knex('user').del()
    .then(function () {
      // Inserts seed entries
      return knex('user').insert([
        {id: 1, email: 'keiko@gmail.com', slack_id: 'USER1'},
        {id: 2, email: 'amber@gmail.com', slack_id: 'USER2'},
      ]);
    });
};
