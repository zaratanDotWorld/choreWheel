const { expect } = require('chai');
const chai = require('chai');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(bnChai(BN));
chai.use(chaiAsPromised);

const { YAY, NAY } = require('../src/constants');
const { sleep } = require('../src/utils');
const { db } = require('../src/db');

const Chores = require('../src/modules/chores');
const Polls = require('../src/modules/polls');
const Admin = require('../src/modules/admin');

const { PowerRanker } = require('../src/modules/power');

describe('Chores', async () => {
  const HOUSE = 'house123';

  const RESIDENT1 = 'RESIDENT1';
  const RESIDENT2 = 'RESIDENT2';
  const RESIDENT3 = 'RESIDENT3';
  const RESIDENT4 = 'RESIDENT4';

  let dishes;
  let sweeping;
  let restock;

  const POLL_LENGTH = 35;

  before(async () => {
    await db('chore').del();
    await db('resident').del();
    await db('house').del();

    await Admin.addHouse(HOUSE);
    await Admin.addResident(HOUSE, RESIDENT1);
    await Admin.addResident(HOUSE, RESIDENT2);
    await Admin.addResident(HOUSE, RESIDENT3);
    await Admin.addResident(HOUSE, RESIDENT4);

    await db('chore').del();
    [ dishes ] = await Chores.addChore(HOUSE, 'dishes');
    [ sweeping ] = await Chores.addChore(HOUSE, 'sweeping');
    [ restock ] = await Chores.addChore(HOUSE, 'restock');
  });

  afterEach(async () => {
    await db('chore_claim').del();
    await db('chore_value').del();
    await db('chore_pref').del();
    await db('poll_vote').del();
    await db('poll').del();
  });

  describe('managing chore preferences', async () => {
    it('can list the existing chores', async () => {
      const allChores = await Chores.getChores(HOUSE);

      expect(allChores.length).to.eq.BN(3);
    });

    it('can set and query for the latest chore values', async () => {
      await Chores.setChoreValues([
        { chore_id: dishes.id, value: 10 },
        { chore_id: dishes.id, value: 5 },
        { chore_id: sweeping.id, value: 20 }
      ]);

      const now = new Date();
      const endTime = new Date(now.getTime() + 1000);
      const startTime = new Date(now.getTime() - 1000);

      const dishesValue = await Chores.getChoreValue(dishes.id, startTime, endTime);
      expect(dishesValue.sum).to.eq.BN(15);

      const sweepingValue = await Chores.getChoreValue(sweeping.id, startTime, endTime);
      expect(sweepingValue.sum).to.eq.BN(20);
    });

    it('can set a chore preference', async () => {
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 1);
      await Chores.setChorePreference(HOUSE, RESIDENT2, dishes.id, sweeping.id, 0);

      const preferences = await Chores.getChorePreferences(HOUSE);
      expect(preferences[0].preference).to.equal(1);
      expect(preferences[1].preference).to.equal(0);
    });

    it('can update a chore preference', async () => {
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 1);
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 0);

      const preferences = await Chores.getChorePreferences(HOUSE);
      expect(preferences.length).to.eq.BN(1);
      expect(preferences[0].preference).to.equal(0);
    });

    it('can query for active chore preferences', async () => {
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 0.0);
      await Chores.setChorePreference(HOUSE, RESIDENT2, dishes.id, restock.id, 0.5);
      await Chores.setChorePreference(HOUSE, RESIDENT3, sweeping.id, restock.id, 1.0);

      let preferences;
      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.eq.BN(3);

      // Remove the third preference
      await Admin.deleteResident(RESIDENT3);
      await sleep(1);

      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.eq.BN(2);

      // Restore the third preference
      await Admin.addResident(HOUSE, RESIDENT3);
      await sleep(1);

      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.eq.BN(3);

      // Remove the last two preferences
      await Chores.deleteChore(HOUSE, restock.name);
      await sleep(1);

      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.eq.BN(1);

      // Restore the last two preferences
      await Chores.addChore(HOUSE, restock.name);
      await sleep(1);

      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.eq.BN(3);
    });
  });

  describe('managing chore values', async () => {
    it('can return uniform preferences implicitly', async () => {
      const chores = await Chores.getChores(HOUSE);

      const residents = await Admin.getResidents(HOUSE);
      const powerRanker = new PowerRanker(chores, [], residents.length);
      const labeledWeights = powerRanker.run(d = 0.8); // eslint-disable-line no-undef

      expect(labeledWeights.get(dishes.id)).to.equal(0.3333333333333333);
      expect(labeledWeights.get(sweeping.id)).to.equal(0.3333333333333333);
      expect(labeledWeights.get(restock.id)).to.equal(0.3333333333333333);
    });

    it('can use preferences to determine chore values', async () => {
      // Prefer dishes to sweeping, and sweeping to restock
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 1);
      await Chores.setChorePreference(HOUSE, RESIDENT2, sweeping.id, restock.id, 1);

      const chores = await Chores.getChores(HOUSE);
      const preferences = await Chores.getChorePreferences(HOUSE);
      const parsedPreferences = Chores.formatPreferencesForRanking(preferences);

      const powerRanker = new PowerRanker(chores, parsedPreferences, 2);
      const labeledWeights = powerRanker.run(d = 0.8); // eslint-disable-line no-undef

      expect(labeledWeights.get(dishes.id)).to.equal(0.42564666666666673);
      expect(labeledWeights.get(sweeping.id)).to.equal(0.31288000000000005);
      expect(labeledWeights.get(restock.id)).to.equal(0.2614733333333334);
    });

    it('can use preferences to determine mild chore values', async () => {
      // Slightly prefer dishes to sweeping, and sweeping to restock
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 0.7);
      await Chores.setChorePreference(HOUSE, RESIDENT2, sweeping.id, restock.id, 0.7);

      const chores = await Chores.getChores(HOUSE);
      const preferences = await Chores.getChorePreferences(HOUSE);
      const parsedPreferences = Chores.formatPreferencesForRanking(preferences);

      const powerRanker = new PowerRanker(chores, parsedPreferences, 2);
      const labeledWeights = powerRanker.run(d = 0.8); // eslint-disable-line no-undef

      expect(labeledWeights.get(dishes.id)).to.equal(0.36816469333333335);
      expect(labeledWeights.get(sweeping.id)).to.equal(0.33009407999999996);
      expect(labeledWeights.get(restock.id)).to.equal(0.3017412266666667);
    });

    it('can use preferences to determine complex chore values', async () => {
      // Prefer both dishes and restock to sweeping
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 1);
      await Chores.setChorePreference(HOUSE, RESIDENT2, sweeping.id, restock.id, 0);

      const chores = await Chores.getChores(HOUSE);
      const preferences = await Chores.getChorePreferences(HOUSE);
      const parsedPreferences = Chores.formatPreferencesForRanking(preferences);

      const powerRanker = new PowerRanker(chores, parsedPreferences, 2);
      const labeledWeights = powerRanker.run(d = 0.8); // eslint-disable-line no-undef

      expect(labeledWeights.get(dishes.id)).to.equal(0.40740000000000004);
      expect(labeledWeights.get(sweeping.id)).to.equal(0.1852);
      expect(labeledWeights.get(restock.id)).to.equal(0.4074);
    });
  });

  describe('claiming chores', async () => {
    it('can claim a chore', async () => {
      await Chores.setChoreValues([
        { chore_id: dishes.id, value: 10 },
        { chore_id: dishes.id, value: 5 }
      ]);
      await sleep(1);

      await Chores.claimChore(dishes.id, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      const choreClaims = await Chores.getValidChoreClaims(dishes.id);
      expect(choreClaims[0].claimed_by).to.equal(RESIDENT1);
      expect(choreClaims[0].value).to.eq.BN(15);
    });

    it('can get a chore claim by messageId', async () => {
      await Chores.setChoreValues([ { chore_id: dishes.id, value: 10 } ]);
      await sleep(1);

      const messageId = 'xyz';

      await Chores.claimChore(dishes.id, RESIDENT1, messageId, POLL_LENGTH);
      await sleep(1);

      const choreClaim = await Chores.getChoreClaimByMessageId(messageId);
      expect(choreClaim.claimed_by).to.equal(RESIDENT1);
      expect(choreClaim.value).to.eq.BN(10);
    });

    it('can claim a chore incrementally', async () => {
      // Two separate events
      await Chores.setChoreValues([ { chore_id: dishes.id, value: 10 } ]);
      await sleep(1);
      await Chores.setChoreValues([ { chore_id: dishes.id, value: 5 } ]);
      await sleep(1);

      await Chores.claimChore(dishes.id, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await Chores.setChoreValues([ { chore_id: dishes.id, value: 20 } ]);
      await sleep(1);

      await Chores.claimChore(dishes.id, RESIDENT2, '', POLL_LENGTH);
      await sleep(1);

      const choreClaims = await Chores.getValidChoreClaims(dishes.id);
      expect(choreClaims[0].claimed_by).to.equal(RESIDENT1);
      expect(choreClaims[0].value).to.eq.BN(15);
      expect(choreClaims[1].claimed_by).to.equal(RESIDENT2);
      expect(choreClaims[1].value).to.eq.BN(20);
    });

    it('can successfully resolve a claim', async () => {
      await Chores.setChoreValues([ { chore_id: dishes.id, value: 10 } ]);
      await sleep(1);

      const [ choreClaim ] = await Chores.claimChore(dishes.id, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await Polls.submitVote(choreClaim.poll_id, RESIDENT1, YAY);
      await Polls.submitVote(choreClaim.poll_id, RESIDENT2, YAY);

      await sleep(POLL_LENGTH);

      const [ resolvedClaim ] = await Chores.resolveChoreClaim(choreClaim.id);
      expect(resolvedClaim.result).to.equal('pass');
      expect(resolvedClaim.value).to.eq.BN(10);
    });

    it('cannot resolve a claim before the poll closes ', async () => {
      await Chores.setChoreValues([ { chore_id: dishes.id, value: 10 } ]);
      await sleep(1);

      const [ choreClaim ] = await Chores.claimChore(dishes.id, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await expect(Chores.resolveChoreClaim(choreClaim.id))
        .to.be.rejectedWith('Poll not closed!');
    });

    it('cannot resolve a claim twice', async () => {
      await Chores.setChoreValues([ { chore_id: dishes.id, value: 10 } ]);
      await sleep(1);

      const [ choreClaim ] = await Chores.claimChore(dishes.id, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await sleep(POLL_LENGTH);

      await Chores.resolveChoreClaim(choreClaim.id);
      await sleep(1);

      await expect(Chores.resolveChoreClaim(choreClaim.id))
        .to.be.rejectedWith('Claim already resolved!');
    });

    it('cannot successfully resolve a claim without two positive votes', async () => {
      await Chores.setChoreValues([ { chore_id: dishes.id, value: 10 } ]);
      await sleep(1);

      const [ choreClaim ] = await Chores.claimChore(dishes.id, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await Polls.submitVote(choreClaim.poll_id, RESIDENT1, YAY);

      await sleep(POLL_LENGTH);

      const [ resolvedClaim ] = await Chores.resolveChoreClaim(choreClaim.id);
      expect(resolvedClaim.result).to.equal('fail');
    });

    it('cannot successfully resolve a claim without a passing vote', async () => {
      await Chores.setChoreValues([ { chore_id: dishes.id, value: 10 } ]);
      await sleep(1);

      const [ choreClaim ] = await Chores.claimChore(dishes.id, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await Polls.submitVote(choreClaim.poll_id, RESIDENT1, YAY);
      await Polls.submitVote(choreClaim.poll_id, RESIDENT2, YAY);
      await Polls.submitVote(choreClaim.poll_id, RESIDENT3, NAY);
      await Polls.submitVote(choreClaim.poll_id, RESIDENT4, NAY);

      await sleep(POLL_LENGTH);

      const [ resolvedClaim ] = await Chores.resolveChoreClaim(choreClaim.id);
      expect(resolvedClaim.result).to.equal('fail');
    });

    it('can claim the incremental value if a prior claim is approved', async () => {
      await Chores.setChoreValues([ { chore_id: dishes.id, value: 10 } ]);
      await sleep(1);

      const [ choreClaim1 ] = await Chores.claimChore(dishes.id, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await Chores.setChoreValues([ { chore_id: dishes.id, value: 5 } ]);
      await sleep(1);

      const [ choreClaim2 ] = await Chores.claimChore(dishes.id, RESIDENT2, '', POLL_LENGTH);
      await sleep(1);

      // Both claims are approved
      await Polls.submitVote(choreClaim1.poll_id, RESIDENT1, YAY);
      await Polls.submitVote(choreClaim1.poll_id, RESIDENT2, YAY);

      await Polls.submitVote(choreClaim2.poll_id, RESIDENT1, YAY);
      await Polls.submitVote(choreClaim2.poll_id, RESIDENT2, YAY);

      await sleep(POLL_LENGTH);

      const [ resolvedClaim1 ] = await Chores.resolveChoreClaim(choreClaim1.id);
      expect(resolvedClaim1.result).to.equal('pass');
      expect(resolvedClaim1.value).to.eq.BN(10);

      const [ resolvedClaim2 ] = await Chores.resolveChoreClaim(choreClaim2.id);
      expect(resolvedClaim2.result).to.equal('pass');
      expect(resolvedClaim2.value).to.eq.BN(5);
    });

    it('can claim the entire value if a prior claim is denied', async () => {
      await Chores.setChoreValues([ { chore_id: dishes.id, value: 10 } ]);
      await sleep(1);

      const [ choreClaim1 ] = await Chores.claimChore(dishes.id, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await Chores.setChoreValues([ { chore_id: dishes.id, value: 5 } ]);
      await sleep(1);

      const [ choreClaim2 ] = await Chores.claimChore(dishes.id, RESIDENT2, '', POLL_LENGTH);
      await sleep(1);

      // First claim is rejected
      await Polls.submitVote(choreClaim1.poll_id, RESIDENT1, YAY);
      await Polls.submitVote(choreClaim1.poll_id, RESIDENT2, NAY);

      // Second claim is approved
      await Polls.submitVote(choreClaim2.poll_id, RESIDENT1, YAY);
      await Polls.submitVote(choreClaim2.poll_id, RESIDENT2, YAY);

      await sleep(POLL_LENGTH);

      const [ resolvedClaim1 ] = await Chores.resolveChoreClaim(choreClaim1.id);
      expect(resolvedClaim1.result).to.equal('fail');
      expect(resolvedClaim1.value).to.be.zero;

      const [ resolvedClaim2 ] = await Chores.resolveChoreClaim(choreClaim2.id);
      expect(resolvedClaim2.result).to.equal('pass');
      expect(resolvedClaim2.value).to.eq.BN(15);
    });
  });
});
