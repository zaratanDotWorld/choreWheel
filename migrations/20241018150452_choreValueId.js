/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function(knex) {
  return knex.schema.table('ChoreClaim', function(t) {
    t.integer('choreValueId').references('ChoreValue.id');
  });
};

/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = function(knex) {
  return knex.schema.table('ChoreClaim', function(t) {
    t.dropColumn('choreValueId');
  });
};


// Add this manually

// ALTER TABLE "ChoreClaim"
// ADD CONSTRAINT "choreId_choreValueId_check"
// CHECK ("choreId" IS NULL OR "choreValueId" IS NULL);
