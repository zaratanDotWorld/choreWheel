const { expect } = require('chai');
const chai = require('chai');
const BN = require('bn.js');
const bnChai = require('bn-chai');

chai.use(bnChai(BN));

const { db } = require('./../src/db');
const chores = require('./../src/modules/chores/models');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Chores', async () => {
  const ABC = 'ABC';
  const XYZ = 'XYZ';

  const DISHES = 'dishes';
  const SWEEPING = 'sweeping';

  beforeEach(async () => {
    await db('chore_value').del();
    await db('chore_claim').del();
  });

  it('can list the existing chores', async () => {
    const allChores = await chores.getChores();

    expect(allChores.length).to.eq.BN(3);
  });

  it('can set and query for the latest chore values', async () => {
    await chores.setChoreValues([{ chore_name: DISHES, value: 10 }]);
    await chores.setChoreValues([{ chore_name: DISHES, value: 5 }]);
    await chores.setChoreValues([{ chore_name: 'sweeping', value: 20 }]);

    const now = new Date();
    const endTime = new Date(now.getTime() + 1000);
    const startTime = new Date(now.getTime() - 1000);

    const dishesValue = await chores.getChoreValue(DISHES, startTime, endTime);
    expect(dishesValue.sum).to.eq.BN(15);

    const sweepingValue = await chores.getChoreValue(SWEEPING, startTime, endTime);
    expect(sweepingValue.sum).to.eq.BN(20);
  });

  it('can claim a chore', async () => {
    await chores.setChoreValues([{ chore_name: DISHES, value: 10 }]);
    await chores.setChoreValues([{ chore_name: DISHES, value: 5 }]);

    await sleep(1);
    await chores.claimChore(DISHES, ABC, new Date(), "");

    const userChoreClaims = await chores.getUserChoreClaims(DISHES, ABC);
    expect(userChoreClaims[0].value).to.eq.BN(15);
  });

  it('can claim a chore incrementally', async () => {
    await chores.setChoreValues([{ chore_name: DISHES, value: 10 }]);
    await chores.setChoreValues([{ chore_name: DISHES, value: 5 }]);

    await sleep(1);
    await chores.claimChore(DISHES, ABC, new Date(), "");

    await sleep(1);
    await chores.setChoreValues([{ chore_name: DISHES, value: 20 }]);

    await sleep(1);
    await chores.claimChore(DISHES, XYZ, new Date(), "");

    const userChoreClaims = await chores.getUserChoreClaims(DISHES, XYZ);
    expect(userChoreClaims[0].value).to.eq.BN(20);
  });
});