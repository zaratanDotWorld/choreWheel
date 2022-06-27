const { expect } = require('chai');
const chai = require('chai');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const chaiAsPromised = require("chai-as-promised");

chai.use(bnChai(BN));
chai.use(chaiAsPromised);

const { db } = require('./../src/db');
const chores = require('./../src/modules/chores/models');
const power = require('./../src/modules/chores/power');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Chores', async () => {
  const USER1 = 'USER1';
  const USER2 = 'USER2';

  const DISHES = 'dishes';
  const SWEEPING = 'sweeping';
  const RESTOCK = 'restock';

  const FIRST = false;
  const SECOND = true;

  beforeEach(async () => {
    await db('chore_value').del();
    await db('chore_claim').del();
    await db('chore_pref').del();
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
    await chores.claimChore(DISHES, USER1, new Date(), "");

    const userChoreClaims = await chores.getUserChoreClaims(DISHES, USER1);
    expect(userChoreClaims[0].value).to.eq.BN(15);
  });

  it('can claim a chore incrementally', async () => {
    await chores.setChoreValues([{ chore_name: DISHES, value: 10 }]);
    await chores.setChoreValues([{ chore_name: DISHES, value: 5 }]);

    await sleep(1);
    await chores.claimChore(DISHES, USER1, new Date(), "");

    await sleep(1);
    await chores.setChoreValues([{ chore_name: DISHES, value: 20 }]);

    await sleep(1);
    await chores.claimChore(DISHES, USER2, new Date(), "");

    const userChoreClaims = await chores.getUserChoreClaims(DISHES, USER2);
    expect(userChoreClaims[0].value).to.eq.BN(20);
  });

  it('can set a chore preference', async () => {
    await chores.setChorePreference(USER1, DISHES, SWEEPING, FIRST);
    await chores.setChorePreference(USER2, DISHES, SWEEPING, SECOND);

    const preferences = await chores.getChorePreferences();
    expect(preferences[0].preference).to.equal(FIRST);
    expect(preferences[1].preference).to.equal(SECOND);
  });

  it('can update a chore preference', async () => {
    await chores.setChorePreference(USER1, DISHES, SWEEPING, FIRST);
    await chores.setChorePreference(USER1, DISHES, SWEEPING, SECOND);

    const preferences = await chores.getChorePreferences();
    expect(preferences.length).to.eq.BN(1);
    expect(preferences[0].preference).to.equal(SECOND);
  });

  it('cannot set a chore in a bad order', async () => {
    await expect(chores.setChorePreference(USER1, SWEEPING, DISHES, FIRST))
      .to.be.rejectedWith('Chores out of order');
  });

  it('can use preferences to determine chore values', async () => {
    // Prefer dishes to sweeping, and sweeping to restock
    await chores.setChorePreference(USER1, DISHES, SWEEPING, FIRST);
    await chores.setChorePreference(USER2, RESTOCK, SWEEPING, SECOND);

    const preferences = await chores.getChorePreferences();

    const directedPreferences = power.convertPreferences(preferences);
    const matrix = power.toMatrix(directedPreferences);
    const weights = power.powerMethod(matrix, d = .8);
    const labeledWeights = power.applyLabels(directedPreferences, weights);

    expect(labeledWeights.get('dishes')).to.equal(0.7328964266666669);
    expect(labeledWeights.get('sweeping')).to.equal(0.2004369066666667);
    expect(labeledWeights.get('restock')).to.equal(0.06666666666666667);
  });
});
