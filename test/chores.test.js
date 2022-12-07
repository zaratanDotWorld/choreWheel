const { expect } = require('chai');
const chai = require('chai');
const chaiAlmost = require('chai-almost');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAlmost());
chai.use(chaiAsPromised);

const { YAY, NAY, DAY, HOUR, MINUTE } = require('../src/constants');
const { pointsPerResident, inflationFactor, penaltyDelay, choresPollLength } = require('../src/config');
const { getMonthStart, getNextMonthStart, getPrevMonthEnd } = require('../src/utils');
const { db } = require('../src/db');

const Chores = require('../src/modules/chores');
const Hearts = require('../src/modules/hearts');
const Polls = require('../src/modules/polls');
const Admin = require('../src/modules/admin');

describe('Chores', async () => {
  const HOUSE = 'house123';

  const RESIDENT1 = 'RESIDENT1';
  const RESIDENT2 = 'RESIDENT2';
  const RESIDENT3 = 'RESIDENT3';
  const RESIDENT4 = 'RESIDENT4';

  let dishes;
  let sweeping;
  let restock;

  let now;
  let soon;
  let challengeEnd;

  before(async () => {
    await db('Chore').del();
    await db('Resident').del();
    await db('House').del();

    await Admin.updateHouse({ slackId: HOUSE });

    [ dishes ] = await Chores.addChore(HOUSE, 'dishes');
    [ sweeping ] = await Chores.addChore(HOUSE, 'sweeping');
    [ restock ] = await Chores.addChore(HOUSE, 'restock');

    now = new Date();
    soon = new Date(now.getTime() + MINUTE);
    challengeEnd = new Date(now.getTime() + choresPollLength);
  });

  afterEach(async () => {
    await db('ChoreBreak').del();
    await db('ChoreClaim').del();
    await db('ChoreValue').del();
    await db('ChorePref').del();
    await db('PollVote').del();
    await db('Heart').del();
    await db('Poll').del();
    await db('Resident').del();
  });

  describe('managing chore preferences', async () => {
    beforeEach(async () => {
      await Admin.addResident(HOUSE, RESIDENT1, now);
      await Admin.addResident(HOUSE, RESIDENT2, now);
    });

    it('can list the existing chores', async () => {
      const allChores = await Chores.getChores(HOUSE);

      expect(allChores.length).to.equal(3);
    });

    it('can set and query for chore values in a time range', async () => {
      await db('ChoreValue').insert([
        { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 },
        { choreId: dishes.id, valuedAt: now, value: 5, ranking: 0, residents: 0 },
        { choreId: sweeping.id, valuedAt: now, value: 20, ranking: 0, residents: 0 }
      ]);

      const endTime = new Date(now.getTime() + MINUTE);
      const startTime = new Date(now.getTime() - MINUTE);

      const dishesValue = await Chores.getChoreValue(dishes.id, startTime, endTime);
      expect(dishesValue.sum).to.equal(15);

      const sweepingValue = await Chores.getChoreValue(sweeping.id, startTime, endTime);
      expect(sweepingValue.sum).to.equal(20);
    });

    it('can set and query for all current chore values', async () => {
      await db('ChoreValue').insert([
        { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 },
        { choreId: dishes.id, valuedAt: now, value: 5, ranking: 0, residents: 0 },
        { choreId: sweeping.id, valuedAt: now, value: 20, ranking: 0, residents: 0 }
      ]);

      const soon = new Date(now.getTime() + HOUR);

      const choreValues = await Chores.getCurrentChoreValues(HOUSE, soon);
      expect(choreValues.find(x => x.id === dishes.id).value).to.equal(15);
      expect(choreValues.find(x => x.id === sweeping.id).value).to.equal(20);
      expect(choreValues.find(x => x.id === restock.id).value).to.equal(0);
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
      expect(preferences.length).to.equal(1);
      expect(preferences[0].preference).to.equal(0);
    });

    it('can query for active chore preferences', async () => {
      await Admin.addResident(HOUSE, RESIDENT3, now);

      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 0.0);
      await Chores.setChorePreference(HOUSE, RESIDENT2, dishes.id, restock.id, 0.5);
      await Chores.setChorePreference(HOUSE, RESIDENT3, sweeping.id, restock.id, 1.0);

      let preferences;
      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.equal(3);

      // Remove the third preference
      await Admin.deleteResident(HOUSE, RESIDENT3);

      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.equal(2);

      // Restore the third preference
      await Admin.addResident(HOUSE, RESIDENT3, now);

      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.equal(3);

      // Remove the last two preferences
      await Chores.deleteChore(HOUSE, restock.name);

      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.equal(1);

      // Restore the last two preferences
      await Chores.addChore(HOUSE, restock.name);

      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.equal(3);
    });
  });

  describe('managing chore values', async () => {
    beforeEach(async () => {
      await Admin.addResident(HOUSE, RESIDENT1, now);
      await Admin.addResident(HOUSE, RESIDENT2, now);
    });

    it('can return uniform preferences implicitly', async () => {
      const choreRankings = await Chores.getCurrentChoreRankings(HOUSE);

      expect(choreRankings[0].ranking).to.almost.equal(0.3333333333333333);
      expect(choreRankings[1].ranking).to.almost.equal(0.3333333333333333);
      expect(choreRankings[2].ranking).to.almost.equal(0.3333333333333333);
    });

    it('can use preferences to determine chore values', async () => {
      // Prefer dishes to sweeping, and sweeping to restock
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 1);
      await Chores.setChorePreference(HOUSE, RESIDENT2, sweeping.id, restock.id, 1);

      const choreRankings = await Chores.getCurrentChoreRankings(HOUSE);

      expect(choreRankings[0].ranking).to.almost.equal(0.49601230302233323);
      expect(choreRankings[1].ranking).to.almost.equal(0.3047593359453333);
      expect(choreRankings[2].ranking).to.almost.equal(0.19922836103233332);
    });

    it('can use preferences to determine mild chore values', async () => {
      // Slightly prefer dishes to sweeping, and sweeping to restock
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 0.7);
      await Chores.setChorePreference(HOUSE, RESIDENT2, sweeping.id, restock.id, 0.7);

      const choreRankings = await Chores.getCurrentChoreRankings(HOUSE);

      expect(choreRankings[0].ranking).to.almost.equal(0.38141044732507734);
      expect(choreRankings[1].ranking).to.almost.equal(0.35929449533781344);
      expect(choreRankings[2].ranking).to.almost.equal(0.2592950573371094);
    });

    it('can use preferences to determine complex chore values', async () => {
      // Prefer both dishes and restock to sweeping
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 1);
      await Chores.setChorePreference(HOUSE, RESIDENT2, sweeping.id, restock.id, 0);

      const choreRankings = await Chores.getCurrentChoreRankings(HOUSE);

      expect(choreRankings.find(x => x.id === dishes.id).ranking).to.almost.equal(0.43437533333333334);
      expect(choreRankings.find(x => x.id === sweeping.id).ranking).to.almost.equal(0.13124933333333333);
      expect(choreRankings.find(x => x.id === restock.id).ranking).to.almost.equal(0.4343753333333333);
    });

    it('can handle circular chore values', async () => {
      // A cycle of preferences
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 1);
      await Chores.setChorePreference(HOUSE, RESIDENT1, sweeping.id, restock.id, 1);
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, restock.id, 0);

      const choreRankings = await Chores.getCurrentChoreRankings(HOUSE);

      expect(choreRankings[0].ranking).to.almost.equal(0.3333333333333333);
      expect(choreRankings[1].ranking).to.almost.equal(0.3333333333333333);
      expect(choreRankings[2].ranking).to.almost.equal(0.3333333333333333);
    });

    it('can calculate the interval since the last chore valuation', async () => {
      const t0 = new Date(2000, 0, 1); // January 1
      const t1 = new Date(2000, 0, 2); // January 2

      await db('ChoreValue').insert([
        { choreId: dishes.id, valuedAt: t0, value: 10, ranking: 0, residents: 0 },
        { choreId: dishes.id, valuedAt: t1, value: 10, ranking: 0, residents: 0 }
      ]);

      const t2 = new Date(t1.getTime() + HOUR); // 1 hour
      const intervalScalar = await Chores.getChoreValueIntervalScalar(HOUSE, t2);
      expect(intervalScalar).to.almost.equal(0.0013440860215053765);
    });

    it('can calculate the interval on an hourly basis', async () => {
      const t0 = new Date(2000, 0, 1);

      await db('ChoreValue').insert([
        { choreId: dishes.id, valuedAt: t0, value: 10, ranking: 0, residents: 0 }
      ]);

      const t1 = new Date(t0.getTime() + (HOUR + 10 * MINUTE));
      const t2 = new Date(t0.getTime() + (HOUR + 45 * MINUTE));
      const t3 = new Date(t0.getTime() + (HOUR + 60 * MINUTE));

      let intervalScalar;
      intervalScalar = await Chores.getChoreValueIntervalScalar(HOUSE, t1);
      expect(intervalScalar).to.almost.equal(0.0013440860215053765);

      intervalScalar = await Chores.getChoreValueIntervalScalar(HOUSE, t2);
      expect(intervalScalar).to.almost.equal(0.0013440860215053765);

      intervalScalar = await Chores.getChoreValueIntervalScalar(HOUSE, t3);
      expect(intervalScalar).to.almost.equal(0.002688172043010753);
    });

    it('can update chore values, storing useful contextual data', async () => {
      const choreValues = await Chores.updateChoreValues(HOUSE, now);

      expect(choreValues[0].ranking).to.almost.equal(0.3333333333333333);
      expect(choreValues[0].residents).to.equal(2);
    });

    it('can do an end-to-end update of chore values', async () => {
      // Prefer dishes to sweeping, and sweeping to restock
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 1);
      await Chores.setChorePreference(HOUSE, RESIDENT2, sweeping.id, restock.id, 1);

      const t0 = new Date(2000, 3, 10); // April 10 (30 day month), first update gives 72 hours of value
      const t1 = new Date(t0.getTime() + 48 * HOUR); // 48 hours later

      const intervalScalar1 = await Chores.getChoreValueIntervalScalar(HOUSE, t0);
      const choreValues1 = await Chores.updateChoreValues(HOUSE, t0);
      expect(choreValues1.length).to.equal(3);

      const intervalScalar2 = await Chores.getChoreValueIntervalScalar(HOUSE, t1);
      const choreValues2 = await Chores.updateChoreValues(HOUSE, t1);
      expect(choreValues2.length).to.equal(3);

      expect(intervalScalar1 / 3 * 2).to.almost.equal(intervalScalar2); // 72 hours vs 48 hours
      expect(intervalScalar1 + intervalScalar2).to.almost.equal(1 / 6); // 120 hours = 1/6th of the monthly allocation

      const sumPoints1 = choreValues1.map(cv => cv.value).reduce((sum, val) => sum + val, 0);
      const sumPoints2 = choreValues2.map(cv => cv.value).reduce((sum, val) => sum + val, 0);
      expect(sumPoints1 + sumPoints2).to.almost.equal(pointsPerResident * 2 / 6 * inflationFactor);
    });

    it('can get the current, updated chore values ', async () => {
      const t0 = new Date(2000, 3, 10); // April 10 (30 day month), first update gives 72 hours of value
      const t1 = new Date(t0.getTime() + 48 * HOUR); // 48 hours later

      // Calculate the initial 72 hour update
      await Chores.updateChoreValues(HOUSE, t0);

      // Calculate the 48 hour update and return the total value for 120 hours
      const choreValues = await Chores.getUpdatedChoreValues(HOUSE, t1);
      const sumPoints = choreValues.map(cv => cv.value).reduce((sum, val) => sum + val, 0);
      expect(sumPoints).to.almost.equal(pointsPerResident * 2 / 6 * inflationFactor);
    });
  });

  describe('claiming chores', async () => {
    beforeEach(async () => {
      await Admin.addResident(HOUSE, RESIDENT1, getPrevMonthEnd(now));
      await Admin.addResident(HOUSE, RESIDENT2, getPrevMonthEnd(now));
      await Admin.addResident(HOUSE, RESIDENT3, getPrevMonthEnd(now));
      await Admin.addResident(HOUSE, RESIDENT4, getPrevMonthEnd(now));
    });

    it('can claim a chore', async () => {
      await db('ChoreValue').insert([
        { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 },
        { choreId: dishes.id, valuedAt: now, value: 5, ranking: 0, residents: 0 }
      ]);
      await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);

      const choreClaim = await Chores.getLatestChoreClaim(dishes.id, soon);
      expect(choreClaim.claimedBy).to.equal(RESIDENT1);
      expect(choreClaim.value).to.equal(15);
    });

    it('cannot claim a chore with a zero value', async () => {
      await expect(Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now))
        .to.be.rejectedWith('Cannot claim a zero-value chore!');
    });

    it('can claim a chore incrementally', async () => {
      // Two separate events
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 5, ranking: 0, residents: 0 } ]);
      const [ choreClaim1 ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);

      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: soon, value: 20, ranking: 0, residents: 0 } ]);
      const [ choreClaim2 ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT2, soon);

      expect(choreClaim1.claimedBy).to.equal(RESIDENT1);
      expect(choreClaim1.value).to.equal(15);
      expect(choreClaim2.claimedBy).to.equal(RESIDENT2);
      expect(choreClaim2.value).to.equal(20);
    });

    it('can successfully resolve a claim', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      const [ choreClaim ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);

      await Polls.submitVote(choreClaim.pollId, RESIDENT1, soon, YAY);
      await Polls.submitVote(choreClaim.pollId, RESIDENT2, soon, YAY);

      const [ resolvedClaim ] = await Chores.resolveChoreClaim(choreClaim.id, challengeEnd);
      expect(resolvedClaim.valid).to.be.true;
      expect(resolvedClaim.value).to.equal(10);
      expect(resolvedClaim.resolvedAt.getTime()).to.equal(challengeEnd.getTime());
    });

    it('can successfully resolve many claims at once', async () => {
      await db('ChoreValue').insert([
        { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 },
        { choreId: sweeping.id, valuedAt: now, value: 10, ranking: 0, residents: 0 },
        { choreId: restock.id, valuedAt: soon, value: 10, ranking: 0, residents: 0 }
      ]);
      const [ choreClaim1 ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);
      const [ choreClaim2 ] = await Chores.claimChore(HOUSE, sweeping.id, RESIDENT1, now);
      const [ choreClaim3 ] = await Chores.claimChore(HOUSE, restock.id, RESIDENT1, soon);

      // First poll passes, second fails
      await Polls.submitVote(choreClaim1.pollId, RESIDENT1, soon, YAY);
      await Polls.submitVote(choreClaim1.pollId, RESIDENT2, soon, YAY);
      await Polls.submitVote(choreClaim2.pollId, RESIDENT1, soon, YAY);
      await Polls.submitVote(choreClaim2.pollId, RESIDENT2, soon, NAY);

      await Chores.resolveChoreClaims(HOUSE, challengeEnd);

      const resolvedClaim1 = await Chores.getChoreClaim(choreClaim1.id);
      expect(resolvedClaim1.valid).to.be.true;
      expect(resolvedClaim1.value).to.equal(10);
      expect(resolvedClaim1.resolvedAt.getTime()).to.equal(challengeEnd.getTime());

      const resolvedClaim2 = await Chores.getChoreClaim(choreClaim2.id);
      expect(resolvedClaim2.valid).to.be.false;
      expect(resolvedClaim2.value).to.equal(0);
      expect(resolvedClaim2.resolvedAt.getTime()).to.equal(challengeEnd.getTime());

      // This claim was not resolved as poll is not yet closed
      const resolvedClaim3 = await Chores.getChoreClaim(choreClaim3.id);
      expect(resolvedClaim3.valid).to.be.true;
      expect(resolvedClaim3.value).to.equal(10);
      expect(resolvedClaim3.resolvedAt).to.equal(null);
    });

    it('cannot resolve a claim before the poll closes ', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      const [ choreClaim ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);

      await expect(Chores.resolveChoreClaim(choreClaim.id, soon))
        .to.be.rejectedWith('Poll not closed!');
    });

    it('cannot resolve a claim twice', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      const [ choreClaim ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);

      await Chores.resolveChoreClaim(choreClaim.id, challengeEnd);

      const [ claimResolution ] = await Chores.resolveChoreClaim(choreClaim.id, challengeEnd);
      expect(claimResolution).to.be.undefined;
    });

    it('cannot successfully resolve a claim without two positive votes', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      const [ choreClaim ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);

      await Polls.submitVote(choreClaim.pollId, RESIDENT1, soon, YAY);

      const [ resolvedClaim ] = await Chores.resolveChoreClaim(choreClaim.id, challengeEnd);
      expect(resolvedClaim.valid).to.be.false;
    });

    it('cannot successfully resolve a claim without a passing vote', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      const [ choreClaim ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);

      await Polls.submitVote(choreClaim.pollId, RESIDENT1, soon, YAY);
      await Polls.submitVote(choreClaim.pollId, RESIDENT2, soon, YAY);
      await Polls.submitVote(choreClaim.pollId, RESIDENT3, soon, NAY);
      await Polls.submitVote(choreClaim.pollId, RESIDENT4, soon, NAY);

      const [ resolvedClaim ] = await Chores.resolveChoreClaim(choreClaim.id, challengeEnd);
      expect(resolvedClaim.valid).to.be.false;
    });

    it('can claim the incremental value if a prior claim is approved', async () => {
      const t0 = new Date();
      const t1 = new Date(t0.getTime() + MINUTE);
      const t2 = new Date(t1.getTime() + HOUR);
      const t3 = new Date(t0.getTime() + choresPollLength);
      const t4 = new Date(t1.getTime() + choresPollLength);

      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: t0, value: 10, ranking: 0, residents: 0 } ]);
      const [ choreClaim1 ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, t0);

      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: t1, value: 5, ranking: 0, residents: 0 } ]);
      const [ choreClaim2 ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT2, t1);

      // Both claims pass
      await Polls.submitVote(choreClaim1.pollId, RESIDENT1, t2, YAY);
      await Polls.submitVote(choreClaim1.pollId, RESIDENT2, t2, YAY);
      await Polls.submitVote(choreClaim2.pollId, RESIDENT1, t2, YAY);
      await Polls.submitVote(choreClaim2.pollId, RESIDENT2, t2, YAY);

      const [ resolvedClaim1 ] = await Chores.resolveChoreClaim(choreClaim1.id, t3);
      expect(resolvedClaim1.valid).to.be.true;
      expect(resolvedClaim1.value).to.equal(10);

      const [ resolvedClaim2 ] = await Chores.resolveChoreClaim(choreClaim2.id, t4);
      expect(resolvedClaim2.valid).to.be.true;
      expect(resolvedClaim2.value).to.equal(5);
    });

    it('can claim the entire value if a prior claim is denied', async () => {
      const t0 = new Date();
      const t1 = new Date(t0.getTime() + MINUTE);
      const t2 = new Date(t1.getTime() + HOUR);
      const t3 = new Date(t0.getTime() + choresPollLength);
      const t4 = new Date(t1.getTime() + choresPollLength);

      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: t0, value: 10, ranking: 0, residents: 0 } ]);
      const [ choreClaim1 ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, t0);

      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: t1, value: 5, ranking: 0, residents: 0 } ]);
      const [ choreClaim2 ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT2, t1);

      // First claim is rejected
      await Polls.submitVote(choreClaim1.pollId, RESIDENT1, t2, YAY);
      await Polls.submitVote(choreClaim1.pollId, RESIDENT2, t2, NAY);

      // Second claim is approved
      await Polls.submitVote(choreClaim2.pollId, RESIDENT1, t2, YAY);
      await Polls.submitVote(choreClaim2.pollId, RESIDENT2, t2, YAY);

      const [ resolvedClaim1 ] = await Chores.resolveChoreClaim(choreClaim1.id, t3);
      expect(resolvedClaim1.valid).to.be.false;
      expect(resolvedClaim1.value).to.equal(0);

      const [ resolvedClaim2 ] = await Chores.resolveChoreClaim(choreClaim2.id, t4);
      expect(resolvedClaim2.valid).to.be.true;
      expect(resolvedClaim2.value).to.equal(15);
    });

    it('can query a users valid chore claims within a time range', async () => {
      const monthStart = getMonthStart(now);
      const y2k = new Date(2000, 1, 1);

      await db('ChoreValue').insert([
        { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 },
        { choreId: sweeping.id, valuedAt: now, value: 20, ranking: 0, residents: 0 }
      ]);
      await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);
      await Chores.claimChore(HOUSE, sweeping.id, RESIDENT1, now);

      let chorePoints;
      // Can get all chore points this month
      chorePoints = await Chores.getAllChorePoints(RESIDENT1, monthStart, now);
      expect(chorePoints.sum).to.equal(30);

      // Can get chore-specific points this month
      chorePoints = await Chores.getChorePoints(RESIDENT1, dishes.id, monthStart, now);
      expect(chorePoints.sum).to.equal(10);

      // But nothing next month
      chorePoints = await Chores.getAllChorePoints(RESIDENT1, y2k, monthStart);
      expect(chorePoints.sum).to.equal(null);
    });

    it('can calculate chore penalties', async () => {
      await db('ChoreValue').insert([
        { choreId: dishes.id, valuedAt: now, value: 91, ranking: 0, residents: 0 },
        { choreId: sweeping.id, valuedAt: now, value: 80, ranking: 0, residents: 0 },
        { choreId: restock.id, valuedAt: now, value: 69, ranking: 0, residents: 0 }
      ]);
      await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);
      await Chores.claimChore(HOUSE, sweeping.id, RESIDENT2, now);
      await Chores.claimChore(HOUSE, restock.id, RESIDENT3, now);

      let penalty;
      const penaltyTime = new Date(getNextMonthStart(now).getTime() + penaltyDelay);
      penalty = await Chores.calculatePenalty(RESIDENT1, penaltyTime);
      expect(penalty).to.equal(0);
      penalty = await Chores.calculatePenalty(RESIDENT2, penaltyTime);
      expect(penalty).to.equal(1);
      penalty = await Chores.calculatePenalty(RESIDENT3, penaltyTime);
      expect(penalty).to.equal(1.5);
    });

    it('can calculate chore penalties, taking into account chore breaks', async () => {
      const feb1 = new Date(3000, 1, 1); // February, a 28 day month
      const feb15 = new Date(feb1.getTime() + 14 * DAY);

      await db('ChoreValue').insert([
        { choreId: dishes.id, valuedAt: feb1, value: 60, ranking: 0, residents: 0 },
        { choreId: sweeping.id, valuedAt: feb1, value: 50, ranking: 0, residents: 0 },
        { choreId: restock.id, valuedAt: feb1, value: 40, ranking: 0, residents: 0 }
      ]);
      await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, feb1);
      await Chores.claimChore(HOUSE, sweeping.id, RESIDENT2, feb1);
      await Chores.claimChore(HOUSE, restock.id, RESIDENT3, feb1);

      // Everyone takes half the month off
      await Chores.addChoreBreak(RESIDENT1, feb1, feb15);
      await Chores.addChoreBreak(RESIDENT2, feb1, feb15);
      await Chores.addChoreBreak(RESIDENT3, feb1, feb15);

      let penalty;
      const penaltyTime = new Date(getNextMonthStart(feb1).getTime() + penaltyDelay);
      penalty = await Chores.calculatePenalty(RESIDENT1, penaltyTime);
      expect(penalty).to.equal(0);
      penalty = await Chores.calculatePenalty(RESIDENT2, penaltyTime);
      expect(penalty).to.equal(0);
      penalty = await Chores.calculatePenalty(RESIDENT3, penaltyTime);
      expect(penalty).to.equal(0.5);
    });

    it('can add a penalty at the right time', async () => {
      await Hearts.initialiseResident(HOUSE, RESIDENT1, now);

      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 50, ranking: 0, residents: 0 } ]);
      await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);

      let penaltyHeart;
      const penaltyTime = new Date(getNextMonthStart(now).getTime() + penaltyDelay);
      const beforeTime = new Date(penaltyTime.getTime() - 1);
      [ penaltyHeart ] = await Chores.addChorePenalty(HOUSE, RESIDENT1, beforeTime);
      expect(penaltyHeart).to.be.undefined;
      [ penaltyHeart ] = await Chores.addChorePenalty(HOUSE, RESIDENT1, penaltyTime);
      expect(penaltyHeart.value).to.equal(-2.5);
      [ penaltyHeart ] = await Chores.addChorePenalty(HOUSE, RESIDENT1, penaltyTime);
      expect(penaltyHeart).to.be.undefined;
    });

    it('cannot penalize before initialized', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 50, ranking: 0, residents: 0 } ]);
      await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);

      let penaltyHeart;
      const penaltyTime = new Date(getNextMonthStart(now).getTime() + penaltyDelay);

      // No penalty before initialized
      [ penaltyHeart ] = await Chores.addChorePenalty(HOUSE, RESIDENT1, penaltyTime);
      expect(penaltyHeart).to.be.undefined;

      await Hearts.initialiseResident(HOUSE, RESIDENT1, now);

      [ penaltyHeart ] = await Chores.addChorePenalty(HOUSE, RESIDENT1, penaltyTime);
      expect(penaltyHeart.value).to.equal(-2.5);
    });
  });

  describe('managing chore breaks', async () => {
    beforeEach(async () => {
      await Admin.addResident(HOUSE, RESIDENT1, now);
      await Admin.addResident(HOUSE, RESIDENT2, now);
    });

    it('can add a chore break', async () => {
      let breakCount;
      [ breakCount ] = await db('ChoreBreak').count('*');
      expect(parseInt(breakCount.count)).to.equal(0);

      await Chores.addChoreBreak(RESIDENT1, now, challengeEnd);

      [ breakCount ] = await db('ChoreBreak').count('*');
      expect(parseInt(breakCount.count)).to.equal(1);
    });

    it('can delete a chore break', async () => {
      let breakCount;
      [ breakCount ] = await db('ChoreBreak').count('*');
      expect(parseInt(breakCount.count)).to.equal(0);

      const [ choreBreak ] = await Chores.addChoreBreak(RESIDENT1, now, challengeEnd);

      [ breakCount ] = await db('ChoreBreak').count('*');
      expect(parseInt(breakCount.count)).to.equal(1);

      await Chores.deleteChoreBreak(choreBreak.id);

      [ breakCount ] = await db('ChoreBreak').count('*');
      expect(parseInt(breakCount.count)).to.equal(0);
    });

    it('can exclude inactive residents from the chore valuing', async () => {
      await Admin.addResident(HOUSE, RESIDENT3, now);

      const later = new Date(now.getTime() + 2 * DAY);

      let residentCount;
      [ residentCount ] = await Chores.getActiveResidentCount(HOUSE, soon);
      expect(parseInt(residentCount.count)).to.equal(3);

      await Chores.addChoreBreak(RESIDENT1, now, challengeEnd);

      [ residentCount ] = await Chores.getActiveResidentCount(HOUSE, soon);
      expect(parseInt(residentCount.count)).to.equal(2);

      // After the break ends
      [ residentCount ] = await Chores.getActiveResidentCount(HOUSE, later);
      expect(parseInt(residentCount.count)).to.equal(3);

      // Will also exclude if inactive
      await Admin.deleteResident(HOUSE, RESIDENT3);
      [ residentCount ] = await Chores.getActiveResidentCount(HOUSE, later);
      expect(parseInt(residentCount.count)).to.equal(2);
    });

    it('can return the percent of the period a resident is not on break', async () => {
      const feb1 = new Date(3000, 1, 1); // February, a 28 day month
      const feb8 = new Date(feb1.getTime() + 7 * DAY);
      const feb15 = new Date(feb1.getTime() + 14 * DAY);
      const feb22 = new Date(feb1.getTime() + 21 * DAY);
      const mar1 = new Date(feb1.getTime() + 28 * DAY);
      const mar8 = new Date(mar1.getTime() + 7 * DAY);
      const mar15 = new Date(mar1.getTime() + 14 * DAY);

      let activeDays;

      activeDays = await Chores.getActiveResidentPercentage(RESIDENT1, feb1);
      expect(activeDays).to.equal(1);

      // Take the first week off
      await Chores.addChoreBreak(RESIDENT1, feb1, feb8);
      activeDays = await Chores.getActiveResidentPercentage(RESIDENT1, feb1);
      expect(activeDays).to.equal(0.75);

      // Take the third week off
      await Chores.addChoreBreak(RESIDENT1, feb15, feb22);
      activeDays = await Chores.getActiveResidentPercentage(RESIDENT1, feb1);
      expect(activeDays).to.equal(0.5);

      // Take time off next month, has no effect
      await Chores.addChoreBreak(RESIDENT1, mar1, mar15);
      activeDays = await Chores.getActiveResidentPercentage(RESIDENT1, feb1);
      expect(activeDays).to.equal(0.5);

      // Take the first two weeks off, this break overlaps with the first break
      await Chores.addChoreBreak(RESIDENT1, feb1, feb15);
      activeDays = await Chores.getActiveResidentPercentage(RESIDENT1, feb1);
      expect(activeDays).to.equal(0.25);

      // Take the last week off, this break stretches into the next month
      await Chores.addChoreBreak(RESIDENT1, feb22, mar8);
      activeDays = await Chores.getActiveResidentPercentage(RESIDENT1, feb1);
      expect(activeDays).to.equal(0.0);
    });

    it('can consider only the parts of breaks in the current month', async () => {
      const feb1 = new Date(3000, 1, 1); // February, a 28 day month
      const feb8 = new Date(feb1.getTime() + 7 * DAY);
      const feb22 = new Date(feb1.getTime() + 21 * DAY);
      const mar8 = new Date(feb1.getTime() + 35 * DAY);
      const jan25 = new Date(feb1.getTime() - 7 * DAY);

      let activeDays;

      // Overlap last and first weeks
      await Chores.addChoreBreak(RESIDENT1, jan25, feb8);
      activeDays = await Chores.getActiveResidentPercentage(RESIDENT1, feb1);
      expect(activeDays).to.equal(0.75);

      // Overlap last and first weeks
      await Chores.addChoreBreak(RESIDENT1, feb22, mar8);
      activeDays = await Chores.getActiveResidentPercentage(RESIDENT1, feb1);
      expect(activeDays).to.equal(0.5);
    });

    it('can consider the resident activeAt when calculating active percentage', async () => {
      const feb1 = new Date(3000, 1, 1); // February, a 28 day month
      const feb8 = new Date(feb1.getTime() + 7 * DAY);
      const feb22 = new Date(feb1.getTime() + 21 * DAY);
      const mar1 = new Date(feb1.getTime() + 28 * DAY);

      let activeDays;

      await Admin.addResident(HOUSE, RESIDENT3, feb8);

      // activeAt used to create implicit break
      activeDays = await Chores.getActiveResidentPercentage(RESIDENT3, feb1);
      expect(activeDays).to.equal(0.75);

      // Can combine with regular breaks
      await Chores.addChoreBreak(RESIDENT3, feb22, mar1);
      activeDays = await Chores.getActiveResidentPercentage(RESIDENT3, feb1);
      expect(activeDays).to.equal(0.5);
    });
  });

  describe('managing chore point gifts', async () => {
    beforeEach(async () => {
      await Admin.addResident(HOUSE, RESIDENT1, now);
      await Admin.addResident(HOUSE, RESIDENT2, now);
    });

    it('can get the largest valid chore claim', async () => {
      await db('ChoreValue').insert([
        { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 },
        { choreId: restock.id, valuedAt: now, value: 30, ranking: 0, residents: 0 },
        { choreId: sweeping.id, valuedAt: now, value: 20, ranking: 0, residents: 0 }
      ]);
      await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);
      await Chores.claimChore(HOUSE, restock.id, RESIDENT1, now);
      await Chores.claimChore(HOUSE, sweeping.id, RESIDENT1, now);

      const choreClaim = await Chores.getLargestChoreClaim(RESIDENT1, now, now);
      expect(choreClaim.value).to.equal(30);
    });

    it('can gift chore points', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      const [ choreClaim ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);

      await Chores.giftChorePoints(choreClaim.id, RESIDENT2, now, 6);

      const monthStart = getMonthStart(now);
      const chorePoints1 = await Chores.getAllChorePoints(RESIDENT1, monthStart, now);
      const chorePoints2 = await Chores.getAllChorePoints(RESIDENT2, monthStart, now);
      expect(chorePoints1.sum).to.equal(4);
      expect(chorePoints2.sum).to.equal(6);
    });

    it('can correctly account for gifts when resolving claims', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      const [ choreClaim ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);
      await Chores.giftChorePoints(choreClaim.id, RESIDENT2, now, 6);

      await Polls.submitVote(choreClaim.pollId, RESIDENT1, soon, YAY);
      await Polls.submitVote(choreClaim.pollId, RESIDENT2, soon, YAY);
      await Chores.resolveChoreClaim(choreClaim.id, challengeEnd);

      const monthStart = getMonthStart(now);
      const chorePoints1 = await Chores.getAllChorePoints(RESIDENT1, monthStart, challengeEnd);
      const chorePoints2 = await Chores.getAllChorePoints(RESIDENT2, monthStart, challengeEnd);
      expect(chorePoints1.sum).to.equal(4);
      expect(chorePoints2.sum).to.equal(6);
    });

    it('can negate a gift if the source claim is negated', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      const [ choreClaim ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);
      await Chores.giftChorePoints(choreClaim.id, RESIDENT2, now, 6);

      await Polls.submitVote(choreClaim.pollId, RESIDENT1, soon, NAY);
      await Polls.submitVote(choreClaim.pollId, RESIDENT2, soon, NAY);
      await Chores.resolveChoreClaims(HOUSE, challengeEnd);

      const monthStart = getMonthStart(now);
      const chorePoints1 = await Chores.getAllChorePoints(RESIDENT1, monthStart, challengeEnd);
      const chorePoints2 = await Chores.getAllChorePoints(RESIDENT2, monthStart, challengeEnd);
      expect(chorePoints1.sum).to.equal(null);
      expect(chorePoints2.sum).to.equal(null);
    });

    it('cannot gift more than the value of the claim', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      const [ choreClaim ] = await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);

      const dbError = 'update "ChoreClaim" set "value" = $1 where "id" = $2 - ' +
        'new row for relation "ChoreClaim" violates check constraint "ChoreClaim_value_check"';

      await expect(Chores.giftChorePoints(choreClaim.id, RESIDENT2, soon, 20))
        .to.be.rejectedWith(dbError);
    });

    it('can regift a chore gift', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 40, ranking: 0, residents: 0 } ]);
      await Chores.claimChore(HOUSE, dishes.id, RESIDENT1, now);

      let choreClaim;
      choreClaim = await Chores.getLargestChoreClaim(RESIDENT1, now, now);
      expect(choreClaim.value).to.equal(40);

      await Chores.giftChorePoints(choreClaim.id, RESIDENT2, now, 30);

      choreClaim = await Chores.getLargestChoreClaim(RESIDENT1, now, now);
      expect(choreClaim.value).to.equal(10);

      choreClaim = await Chores.getLargestChoreClaim(RESIDENT2, now, now);
      expect(choreClaim.value).to.equal(30);

      await Chores.giftChorePoints(choreClaim.id, RESIDENT1, now, 20);

      choreClaim = await Chores.getLargestChoreClaim(RESIDENT1, now, now);
      expect(choreClaim.value).to.equal(20);
    });
  });
});
