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
const polls = require('./../src/modules/polls/models');
const users = require('./../src/modules/users/models');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Chores', async () => {
  const CHORES = await chores.getChores();
  const DISHES = CHORES[0].name;
  const SWEEPING = CHORES[1].name;
  const RESTOCK = CHORES[2].name;

  const FIRST = false;
  const SECOND = true;

  const YAY = 1;

  const USERS = await users.getUsers();
  const USER0 = USERS[0].slack_id;
  const USER1 = USERS[1].slack_id;

  beforeEach(async () => {
    await db('chore_claim').del();
    await db('chore_value').del();
    await db('chore_pref').del();
    await db('poll_vote').del();
    await db('poll').del();
  });

  describe('managing chore values', async () => {
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

    it('can set a chore preference', async () => {
      await chores.setChorePreference(USER0, DISHES, SWEEPING, FIRST);
      await chores.setChorePreference(USER1, DISHES, SWEEPING, SECOND);

      const preferences = await chores.getChorePreferences();
      expect(preferences[0].preference).to.equal(FIRST);
      expect(preferences[1].preference).to.equal(SECOND);
    });

    it('can update a chore preference', async () => {
      await chores.setChorePreference(USER0, DISHES, SWEEPING, FIRST);
      await chores.setChorePreference(USER0, DISHES, SWEEPING, SECOND);

      const preferences = await chores.getChorePreferences();
      expect(preferences.length).to.eq.BN(1);
      expect(preferences[0].preference).to.equal(SECOND);
    });

    it('cannot set a chore preference in a bad order', async () => {
      await expect(chores.setChorePreference(USER0, SWEEPING, DISHES, FIRST))
        .to.be.rejectedWith('Chores out of order');
    });

    it('can use preferences to determine chore values', async () => {
      // Prefer dishes to sweeping, and sweeping to restock
      await chores.setChorePreference(USER0, DISHES, SWEEPING, FIRST);
      await chores.setChorePreference(USER1, RESTOCK, SWEEPING, SECOND);

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

  describe('claiming chores', async () => {
    it('can claim a chore', async () => {
      await chores.setChoreValues([{ chore_name: DISHES, value: 10 }]);
      await chores.setChoreValues([{ chore_name: DISHES, value: 5 }]);
      await sleep(1);

      await chores.claimChore(DISHES, USER0, new Date(), "");

      const userChoreClaims = await chores.getUserChoreClaims(DISHES, USER0);
      expect(userChoreClaims[0].value).to.eq.BN(15);
    });

    it('can claim a chore incrementally', async () => {
      await chores.setChoreValues([{ chore_name: DISHES, value: 10 }]);
      await chores.setChoreValues([{ chore_name: DISHES, value: 5 }]);
      await sleep(1);

      await chores.claimChore(DISHES, USER0, new Date(), "");
      await sleep(1);

      await chores.setChoreValues([{ chore_name: DISHES, value: 20 }]);
      await sleep(1);

      await chores.claimChore(DISHES, USER1, new Date(), "");

      const userChoreClaims = await chores.getUserChoreClaims(DISHES, USER1);
      expect(userChoreClaims[0].value).to.eq.BN(20);
    });

    it('can create a poll to verify a chore claim', async () => {
      await chores.setChoreValues([{ chore_name: DISHES, value: 10 }]);
      await sleep(1);

      const pollIds = await chores.claimChore(DISHES, USER0, new Date(), "");
      const pollId = pollIds[0];

      await polls.submitVote(pollId, USER0, YAY);
    });
  });
});
