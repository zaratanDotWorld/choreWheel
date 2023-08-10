const { db } = require('../src/core/db');
const { Things } = require('../src/core/index');

async function main () {
  try {
    const things = await db('Thing').returning('*');

    things.forEach((thing) => {
      const splitQuantity = thing.quantity.split(' x ');
      const unit = splitQuantity[splitQuantity.length - 1].trim();
      thing.metadata = { unit };
    });

    await Things.updateThing(things);

    console.log(`Migrated ${things.length} things`);
    process.exit(0);
  } catch (err) {
    console.error('An error occurred:', err);
  }
}

main();
