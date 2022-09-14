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
const Residents = require('../src/modules/residents');

const { PowerRanker } = require('../src/modules/power');

describe('Chores', async () => {
  const DISHES = 'dishes';
  const SWEEPING = 'sweeping';
  const RESTOCK = 'restock';

  const RESIDENT1 = 'RESIDENT1';
  const RESIDENT2 = 'RESIDENT2';
  const RESIDENT3 = 'RESIDENT3';
  const RESIDENT4 = 'RESIDENT4';

  const POLL_LENGTH = 35;

  before(async () => {
    await db('chore').del();
    await Chores.addChore(DISHES);
    await Chores.addChore(SWEEPING);
    await Chores.addChore(RESTOCK);

    await db('resident').del();
    await Residents.addResident(RESIDENT1);
    await Residents.addResident(RESIDENT2);
    await Residents.addResident(RESIDENT3);
    await Residents.addResident(RESIDENT4);
  });

  afterEach(async () => {
    await db('chore_claim').del();
    await db('chore_value').del();
    await db('chore_pref').del();
    await db('poll_vote').del();
    await db('poll').del();
  });

  describe('managing chore values', async () => {
    it('can list the existing chores', async () => {
      const allChores = await Chores.getChores();

      expect(allChores.length).to.eq.BN(3);
    });

    it('can set and query for the latest chore values', async () => {
      await Chores.setChoreValues([ { chore_name: DISHES, value: 10 } ]);
      await Chores.setChoreValues([ { chore_name: DISHES, value: 5 } ]);
      await Chores.setChoreValues([ { chore_name: SWEEPING, value: 20 } ]);

      const now = new Date();
      const endTime = new Date(now.getTime() + 1000);
      const startTime = new Date(now.getTime() - 1000);

      const dishesValue = await Chores.getChoreValue(DISHES, startTime, endTime);
      expect(dishesValue.sum).to.eq.BN(15);

      const sweepingValue = await Chores.getChoreValue(SWEEPING, startTime, endTime);
      expect(sweepingValue.sum).to.eq.BN(20);
    });

    it('can set a chore preference', async () => {
      await Chores.setChorePreference(RESIDENT1, DISHES, SWEEPING, 1);
      await Chores.setChorePreference(RESIDENT2, DISHES, SWEEPING, 0);

      const preferences = await Chores.getChorePreferences();
      expect(preferences[0].preference).to.equal(1);
      expect(preferences[1].preference).to.equal(0);
    });

    it('can update a chore preference', async () => {
      await Chores.setChorePreference(RESIDENT1, DISHES, SWEEPING, 1);
      await Chores.setChorePreference(RESIDENT1, DISHES, SWEEPING, 0);

      const preferences = await Chores.getChorePreferences();
      expect(preferences.length).to.eq.BN(1);
      expect(preferences[0].preference).to.equal(0);
    });

    it('can return uniform preferences implicitly', async () => {
      const chores = await Chores.getChores();

      const powerRanker = new PowerRanker(chores, [], 2);
      const labeledWeights = powerRanker.run(d = 0.8); // eslint-disable-line no-undef

      expect(labeledWeights.get('dishes')).to.equal(0.3333333333333333);
      expect(labeledWeights.get('sweeping')).to.equal(0.3333333333333333);
      expect(labeledWeights.get('restock')).to.equal(0.3333333333333333);
    });

    it('can use preferences to determine chore values', async () => {
      // Prefer dishes to sweeping, and sweeping to restock
      await Chores.setChorePreference(RESIDENT1, DISHES, SWEEPING, 1);
      await Chores.setChorePreference(RESIDENT2, RESTOCK, SWEEPING, 0);

      const chores = await Chores.getChores();
      const preferences = await Chores.getChorePreferences();
      const parsedPreferences = Chores.formatPreferencesForRanking(preferences);

      const powerRanker = new PowerRanker(chores, parsedPreferences, 2);
      const labeledWeights = powerRanker.run(d = 0.8); // eslint-disable-line no-undef

      expect(labeledWeights.get('dishes')).to.equal(0.42564666666666673);
      expect(labeledWeights.get('sweeping')).to.equal(0.31288000000000005);
      expect(labeledWeights.get('restock')).to.equal(0.2614733333333334);
    });
  });

  describe('claiming chores', async () => {
    it('can claim a chore', async () => {
      await Chores.setChoreValues([ { chore_name: DISHES, value: 10 } ]);
      await Chores.setChoreValues([ { chore_name: DISHES, value: 5 } ]);
      await sleep(1);

      await Chores.claimChore(DISHES, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      const choreClaims = await Chores.getValidChoreClaims(DISHES);
      expect(choreClaims[0].claimed_by).to.equal(RESIDENT1);
      expect(choreClaims[0].value).to.eq.BN(15);
    });

    it('can get a chore claim by messageId', async () => {
      await Chores.setChoreValues([ { chore_name: DISHES, value: 10 } ]);
      await sleep(1);

      const messageId = 'xyz';

      await Chores.claimChore(DISHES, RESIDENT1, messageId, POLL_LENGTH);
      await sleep(1);

      const choreClaim = await Chores.getChoreClaimByMessageId(messageId);
      expect(choreClaim.claimed_by).to.equal(RESIDENT1);
      expect(choreClaim.value).to.eq.BN(10);
    });

    it('can claim a chore incrementally', async () => {
      await Chores.setChoreValues([ { chore_name: DISHES, value: 10 } ]);
      await Chores.setChoreValues([ { chore_name: DISHES, value: 5 } ]);
      await sleep(1);

      await Chores.claimChore(DISHES, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await Chores.setChoreValues([ { chore_name: DISHES, value: 20 } ]);
      await sleep(1);

      await Chores.claimChore(DISHES, RESIDENT2, '', POLL_LENGTH);
      await sleep(1);

      const choreClaims = await Chores.getValidChoreClaims(DISHES);
      expect(choreClaims[0].claimed_by).to.equal(RESIDENT1);
      expect(choreClaims[0].value).to.eq.BN(15);
      expect(choreClaims[1].claimed_by).to.equal(RESIDENT2);
      expect(choreClaims[1].value).to.eq.BN(20);
    });

    it('can successfully resolve a claim', async () => {
      await Chores.setChoreValues([ { chore_name: DISHES, value: 10 } ]);
      await sleep(1);

      const [ choreClaim ] = await Chores.claimChore(DISHES, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await Polls.submitVote(choreClaim.poll_id, RESIDENT1, YAY);
      await Polls.submitVote(choreClaim.poll_id, RESIDENT2, YAY);

      await sleep(POLL_LENGTH);

      const [ resolvedClaim ] = await Chores.resolveChoreClaim(choreClaim.id);
      expect(resolvedClaim.result).to.equal('pass');
      expect(resolvedClaim.value).to.eq.BN(10);
    });

    it('cannot resolve a claim before the poll closes ', async () => {
      await Chores.setChoreValues([ { chore_name: DISHES, value: 10 } ]);
      await sleep(1);

      const [ choreClaim ] = await Chores.claimChore(DISHES, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await expect(Chores.resolveChoreClaim(choreClaim.id))
        .to.be.rejectedWith('Poll not closed!');
    });

    it('cannot resolve a claim twice', async () => {
      await Chores.setChoreValues([ { chore_name: DISHES, value: 10 } ]);
      await sleep(1);

      const [ choreClaim ] = await Chores.claimChore(DISHES, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await sleep(POLL_LENGTH);

      await Chores.resolveChoreClaim(choreClaim.id);
      await sleep(1);

      await expect(Chores.resolveChoreClaim(choreClaim.id))
        .to.be.rejectedWith('Claim already resolved!');
    });

    it('cannot successfully resolve a claim without two positive votes', async () => {
      await Chores.setChoreValues([ { chore_name: DISHES, value: 10 } ]);
      await sleep(1);

      const [ choreClaim ] = await Chores.claimChore(DISHES, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await Polls.submitVote(choreClaim.poll_id, RESIDENT1, YAY);

      await sleep(POLL_LENGTH);

      const [ resolvedClaim ] = await Chores.resolveChoreClaim(choreClaim.id);
      expect(resolvedClaim.result).to.equal('fail');
    });

    it('cannot successfully resolve a claim without a passing vote', async () => {
      await Chores.setChoreValues([ { chore_name: DISHES, value: 10 } ]);
      await sleep(1);

      const [ choreClaim ] = await Chores.claimChore(DISHES, RESIDENT1, '', POLL_LENGTH);
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
      await Chores.setChoreValues([ { chore_name: DISHES, value: 10 } ]);
      await sleep(1);

      const [ choreClaim1 ] = await Chores.claimChore(DISHES, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await Chores.setChoreValues([ { chore_name: DISHES, value: 5 } ]);
      await sleep(1);

      const [ choreClaim2 ] = await Chores.claimChore(DISHES, RESIDENT2, '', POLL_LENGTH);
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
      await Chores.setChoreValues([ { chore_name: DISHES, value: 10 } ]);
      await sleep(1);

      const [ choreClaim1 ] = await Chores.claimChore(DISHES, RESIDENT1, '', POLL_LENGTH);
      await sleep(1);

      await Chores.setChoreValues([ { chore_name: DISHES, value: 5 } ]);
      await sleep(1);

      const [ choreClaim2 ] = await Chores.claimChore(DISHES, RESIDENT2, '', POLL_LENGTH);
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
