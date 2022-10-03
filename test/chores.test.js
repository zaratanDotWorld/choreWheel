const { expect } = require('chai');
const chai = require('chai');
const chaiAlmost = require('chai-almost');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAlmost());
chai.use(chaiAsPromised);

const { YAY, NAY, DAY, HOUR, MINUTE } = require('../src/constants');
const { pointsPerResident } = require('../src/config');
const { sleep } = require('../src/utils');
const { db } = require('../src/db');

const Chores = require('../src/modules/chores');
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
  let tomorrow;

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
    tomorrow = new Date(now.getTime() + DAY);
  });

  afterEach(async () => {
    await db('ChoreBreak').del();
    await db('ChoreClaim').del();
    await db('ChoreValue').del();
    await db('ChorePref').del();
    await db('PollVote').del();
    await db('Poll').del();
    await db('Resident').del();
  });

  describe('managing chore preferences', async () => {
    beforeEach(async () => {
      await Admin.addResident(HOUSE, RESIDENT1);
      await Admin.addResident(HOUSE, RESIDENT2);
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

      const soon = new Date(now.getTime() + MINUTE);

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
      await Admin.addResident(HOUSE, RESIDENT3);
      await sleep(5);

      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 0.0);
      await Chores.setChorePreference(HOUSE, RESIDENT2, dishes.id, restock.id, 0.5);
      await Chores.setChorePreference(HOUSE, RESIDENT3, sweeping.id, restock.id, 1.0);

      let preferences;
      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.equal(3);

      // Remove the third preference
      await Admin.updateResident(HOUSE, RESIDENT3, false, '');
      await sleep(5);

      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.equal(2);

      // Restore the third preference
      await Admin.addResident(HOUSE, RESIDENT3);
      await sleep(5);

      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.equal(3);

      // Remove the last two preferences
      await Chores.deleteChore(HOUSE, restock.name);
      await sleep(5);

      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.equal(1);

      // Restore the last two preferences
      await Chores.addChore(HOUSE, restock.name);
      await sleep(5);

      preferences = await Chores.getActiveChorePreferences(HOUSE);
      expect(preferences.length).to.equal(3);
    });
  });

  describe('managing chore values', async () => {
    beforeEach(async () => {
      await Admin.addResident(HOUSE, RESIDENT1);
      await Admin.addResident(HOUSE, RESIDENT2);
    });

    it('can return uniform preferences implicitly', async () => {
      const choreRankings = await Chores.getCurrentChoreRankings(HOUSE);

      expect(choreRankings.find(x => x.id === dishes.id).ranking).to.almost.equal(0.3333333333333333);
      expect(choreRankings.find(x => x.id === sweeping.id).ranking).to.almost.equal(0.3333333333333333);
      expect(choreRankings.find(x => x.id === restock.id).ranking).to.almost.equal(0.3333333333333333);
    });

    it('can use preferences to determine chore values', async () => {
      // Prefer dishes to sweeping, and sweeping to restock
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 1);
      await Chores.setChorePreference(HOUSE, RESIDENT2, sweeping.id, restock.id, 1);

      const choreRankings = await Chores.getCurrentChoreRankings(HOUSE);

      expect(choreRankings.find(x => x.id === dishes.id).ranking).to.almost.equal(0.42564666666666673);
      expect(choreRankings.find(x => x.id === sweeping.id).ranking).to.almost.equal(0.31288000000000005);
      expect(choreRankings.find(x => x.id === restock.id).ranking).to.almost.equal(0.2614733333333334);
    });

    it('can use preferences to determine mild chore values', async () => {
      // Slightly prefer dishes to sweeping, and sweeping to restock
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 0.7);
      await Chores.setChorePreference(HOUSE, RESIDENT2, sweeping.id, restock.id, 0.7);

      const choreRankings = await Chores.getCurrentChoreRankings(HOUSE);

      expect(choreRankings.find(x => x.id === dishes.id).ranking).to.almost.equal(0.36816469333333335);
      expect(choreRankings.find(x => x.id === sweeping.id).ranking).to.almost.equal(0.33009407999999996);
      expect(choreRankings.find(x => x.id === restock.id).ranking).to.almost.equal(0.3017412266666667);
    });

    it('can use preferences to determine complex chore values', async () => {
      // Prefer both dishes and restock to sweeping
      await Chores.setChorePreference(HOUSE, RESIDENT1, dishes.id, sweeping.id, 1);
      await Chores.setChorePreference(HOUSE, RESIDENT2, sweeping.id, restock.id, 0);

      const choreRankings = await Chores.getCurrentChoreRankings(HOUSE);

      expect(choreRankings.find(x => x.id === dishes.id).ranking).to.almost.equal(0.40740000000000004);
      expect(choreRankings.find(x => x.id === sweeping.id).ranking).to.almost.equal(0.1852);
      expect(choreRankings.find(x => x.id === restock.id).ranking).to.almost.equal(0.4074);
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
      await sleep(5);

      const t0 = new Date(2000, 3, 10); // April 10 (30 day month), first update gives 72 hours of value
      const t1 = new Date(t0.getTime() + 48 * HOUR); // 48 hours later

      const intervalScalar1 = await Chores.getChoreValueIntervalScalar(HOUSE, t0);
      const choreValues1 = await Chores.updateChoreValues(HOUSE, t0);
      expect(choreValues1.length).to.equal(3);
      await sleep(5);

      const intervalScalar2 = await Chores.getChoreValueIntervalScalar(HOUSE, t1);
      const choreValues2 = await Chores.updateChoreValues(HOUSE, t1);
      expect(choreValues2.length).to.equal(3);

      expect(intervalScalar1 / 3 * 2).to.almost.equal(intervalScalar2); // 72 hours vs 48 hours
      expect(intervalScalar1 + intervalScalar2).to.almost.equal(1 / 6); // 120 hours = 1/6th of the monthly allocation

      const sumPoints1 = choreValues1.map(cv => cv.value).reduce((sum, val) => sum + val, 0);
      const sumPoints2 = choreValues2.map(cv => cv.value).reduce((sum, val) => sum + val, 0);
      expect(sumPoints1 + sumPoints2).to.almost.equal(pointsPerResident * 2 / 6);
    });

    it('can get the current, updated chore values ', async () => {
      const t0 = new Date(2000, 3, 10); // April 10 (30 day month), first update gives 72 hours of value
      const t1 = new Date(t0.getTime() + 48 * HOUR); // 48 hours later

      // Calculate the initial 72 hour update
      await Chores.updateChoreValues(HOUSE, t0);
      await sleep(5);

      // Calculate the 48 hour update and return the total value for 120 hours
      const choreValues = await Chores.getUpdatedChoreValues(HOUSE, t1);
      const sumPoints = choreValues.map(cv => cv.value).reduce((sum, val) => sum + val, 0);
      expect(sumPoints).to.almost.equal(pointsPerResident * 2 / 6);
    });
  });

  describe('claiming chores', async () => {
    beforeEach(async () => {
      await Admin.addResident(HOUSE, RESIDENT1);
      await Admin.addResident(HOUSE, RESIDENT2);
      await Admin.addResident(HOUSE, RESIDENT3);
      await Admin.addResident(HOUSE, RESIDENT4);
    });

    it('can claim a chore', async () => {
      await db('ChoreValue').insert([
        { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 },
        { choreId: dishes.id, valuedAt: now, value: 5, ranking: 0, residents: 0 }
      ]);
      await sleep(5);
      await Chores.claimChore(dishes.id, RESIDENT1, now, DAY);
      await sleep(5);

      const choreClaims = await Chores.getValidChoreClaims(dishes.id);
      expect(choreClaims[0].claimedBy).to.equal(RESIDENT1);
      expect(choreClaims[0].value).to.equal(15);
    });

    it('cannot claim a chore with a zero value', async () => {
      await expect(Chores.claimChore(dishes.id, RESIDENT1, now, DAY))
        .to.be.rejectedWith('Cannot claim a zero-value chore!');
    });

    it('can claim a chore incrementally', async () => {
      // Two separate events
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 5, ranking: 0, residents: 0 } ]);
      await sleep(5);
      await Chores.claimChore(dishes.id, RESIDENT1, now, DAY);
      await sleep(5);

      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: soon, value: 20, ranking: 0, residents: 0 } ]);
      await sleep(5);
      await Chores.claimChore(dishes.id, RESIDENT2, soon, DAY);
      await sleep(5);

      const choreClaims = await Chores.getValidChoreClaims(dishes.id);
      expect(choreClaims[0].claimedBy).to.equal(RESIDENT1);
      expect(choreClaims[0].value).to.equal(15);
      expect(choreClaims[1].claimedBy).to.equal(RESIDENT2);
      expect(choreClaims[1].value).to.equal(20);
    });

    it('can successfully resolve a claim', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      await sleep(5);
      const [ choreClaim ] = await Chores.claimChore(dishes.id, RESIDENT1, now, DAY);
      await sleep(5);

      await Polls.submitVote(choreClaim.pollId, RESIDENT1, soon, YAY);
      await Polls.submitVote(choreClaim.pollId, RESIDENT2, soon, YAY);
      await sleep(5);

      const [ resolvedClaim ] = await Chores.resolveChoreClaim(choreClaim.id, tomorrow);
      expect(resolvedClaim.valid).to.be.true;
      expect(resolvedClaim.value).to.equal(10);
    });

    it('cannot resolve a claim before the poll closes ', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      await sleep(5);
      const [ choreClaim ] = await Chores.claimChore(dishes.id, RESIDENT1, now, DAY);
      await sleep(5);

      await expect(Chores.resolveChoreClaim(choreClaim.id, soon))
        .to.be.rejectedWith('Poll not closed!');
    });

    it('cannot resolve a claim twice', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      await sleep(5);
      const [ choreClaim ] = await Chores.claimChore(dishes.id, RESIDENT1, now, DAY);
      await sleep(5);

      await Chores.resolveChoreClaim(choreClaim.id, tomorrow);
      await sleep(5);

      const [ claimResolution ] = await Chores.resolveChoreClaim(choreClaim.id, tomorrow);
      expect(claimResolution).to.be.undefined;
    });

    it('cannot successfully resolve a claim without two positive votes', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      await sleep(5);
      const [ choreClaim ] = await Chores.claimChore(dishes.id, RESIDENT1, now, DAY);
      await sleep(5);

      await Polls.submitVote(choreClaim.pollId, RESIDENT1, soon, YAY);
      await sleep(5);

      const [ resolvedClaim ] = await Chores.resolveChoreClaim(choreClaim.id, tomorrow);
      expect(resolvedClaim.valid).to.be.false;
    });

    it('cannot successfully resolve a claim without a passing vote', async () => {
      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 } ]);
      await sleep(5);
      const [ choreClaim ] = await Chores.claimChore(dishes.id, RESIDENT1, now, DAY);
      await sleep(5);

      await Polls.submitVote(choreClaim.pollId, RESIDENT1, soon, YAY);
      await Polls.submitVote(choreClaim.pollId, RESIDENT2, soon, YAY);
      await Polls.submitVote(choreClaim.pollId, RESIDENT3, soon, NAY);
      await Polls.submitVote(choreClaim.pollId, RESIDENT4, soon, NAY);
      await sleep(5);

      const [ resolvedClaim ] = await Chores.resolveChoreClaim(choreClaim.id, tomorrow);
      expect(resolvedClaim.valid).to.be.false;
    });

    it('can claim the incremental value if a prior claim is approved', async () => {
      const t0 = new Date();
      const t1 = new Date(t0.getTime() + MINUTE);
      const t2 = new Date(t1.getTime() + HOUR);
      const t3 = new Date(t0.getTime() + DAY);
      const t4 = new Date(t1.getTime() + DAY);

      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: t0, value: 10, ranking: 0, residents: 0 } ]);
      await sleep(5);
      const [ choreClaim1 ] = await Chores.claimChore(dishes.id, RESIDENT1, t0, DAY);
      await sleep(5);

      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: t1, value: 5, ranking: 0, residents: 0 } ]);
      await sleep(5);
      const [ choreClaim2 ] = await Chores.claimChore(dishes.id, RESIDENT2, t1, DAY);
      await sleep(5);

      // Both claims pass
      await Polls.submitVote(choreClaim1.pollId, RESIDENT1, t2, YAY);
      await Polls.submitVote(choreClaim1.pollId, RESIDENT2, t2, YAY);
      await Polls.submitVote(choreClaim2.pollId, RESIDENT1, t2, YAY);
      await Polls.submitVote(choreClaim2.pollId, RESIDENT2, t2, YAY);
      await sleep(5);

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
      const t3 = new Date(t0.getTime() + DAY);
      const t4 = new Date(t1.getTime() + DAY);

      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: t0, value: 10, ranking: 0, residents: 0 } ]);
      await sleep(5);
      const [ choreClaim1 ] = await Chores.claimChore(dishes.id, RESIDENT1, t0, DAY);
      await sleep(5);

      await db('ChoreValue').insert([ { choreId: dishes.id, valuedAt: t1, value: 5, ranking: 0, residents: 0 } ]);
      await sleep(5);
      const [ choreClaim2 ] = await Chores.claimChore(dishes.id, RESIDENT2, t1, DAY);
      await sleep(5);

      // First claim is rejected
      await Polls.submitVote(choreClaim1.pollId, RESIDENT1, t2, YAY);
      await Polls.submitVote(choreClaim1.pollId, RESIDENT2, t2, NAY);

      // Second claim is approved
      await Polls.submitVote(choreClaim2.pollId, RESIDENT1, t2, YAY);
      await Polls.submitVote(choreClaim2.pollId, RESIDENT2, t2, YAY);
      await sleep(5);

      const [ resolvedClaim1 ] = await Chores.resolveChoreClaim(choreClaim1.id, t3);
      expect(resolvedClaim1.valid).to.be.false;
      expect(resolvedClaim1.value).to.equal(0);

      const [ resolvedClaim2 ] = await Chores.resolveChoreClaim(choreClaim2.id, t4);
      expect(resolvedClaim2.valid).to.be.true;
      expect(resolvedClaim2.value).to.equal(15);
    });

    it('can query a users valid chore claims within a time range', async () => {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const y2k = new Date(2000, 1, 1);

      await db('ChoreValue').insert([
        { choreId: dishes.id, valuedAt: now, value: 10, ranking: 0, residents: 0 },
        { choreId: sweeping.id, valuedAt: now, value: 20, ranking: 0, residents: 0 }
      ]);
      await sleep(5);
      await Chores.claimChore(dishes.id, RESIDENT1, now, DAY);
      await Chores.claimChore(sweeping.id, RESIDENT1, now, DAY);
      await sleep(5);

      let choreClaimsValue;
      choreClaimsValue = await Chores.getUserChoreClaims(RESIDENT1, monthStart, now);
      expect(choreClaimsValue.sum).to.equal(30);

      choreClaimsValue = await Chores.getUserChoreClaims(RESIDENT1, y2k, monthStart);
      expect(choreClaimsValue.sum).to.equal(null);
    });
  });

  describe('managing chore breaks', async () => {
    beforeEach(async () => {
      await Admin.addResident(HOUSE, RESIDENT1);
      await Admin.addResident(HOUSE, RESIDENT2);
    });

    it('can add a chore break', async () => {
      let breakCount;
      [ breakCount ] = await db('ChoreBreak').count('*');
      expect(parseInt(breakCount.count)).to.equal(0);

      await Chores.addChoreBreak(RESIDENT1, now, tomorrow);

      [ breakCount ] = await db('ChoreBreak').count('*');
      expect(parseInt(breakCount.count)).to.equal(1);
    });

    it('can delete a chore break', async () => {
      let breakCount;
      [ breakCount ] = await db('ChoreBreak').count('*');
      expect(parseInt(breakCount.count)).to.equal(0);

      const [ choreBreak ] = await Chores.addChoreBreak(RESIDENT1, now, tomorrow);
      sleep(5);

      [ breakCount ] = await db('ChoreBreak').count('*');
      expect(parseInt(breakCount.count)).to.equal(1);

      await Chores.deleteChoreBreak(choreBreak.id);
      sleep(5);

      [ breakCount ] = await db('ChoreBreak').count('*');
      expect(parseInt(breakCount.count)).to.equal(0);
    });

    it('can exclude inactive residents from the chore valuing', async () => {
      await Admin.addResident(HOUSE, RESIDENT3);

      const later = new Date(now.getTime() + 2 * DAY);

      let residentCount;
      [ residentCount ] = await Chores.getActiveResidentCount(HOUSE, soon);
      expect(parseInt(residentCount.count)).to.equal(3);

      await Chores.addChoreBreak(RESIDENT1, now, tomorrow);
      await sleep(5);

      [ residentCount ] = await Chores.getActiveResidentCount(HOUSE, soon);
      expect(parseInt(residentCount.count)).to.equal(2);

      // After the break ends
      [ residentCount ] = await Chores.getActiveResidentCount(HOUSE, later);
      expect(parseInt(residentCount.count)).to.equal(3);

      // Will also exclude if inactive
      await Admin.updateResident(HOUSE, RESIDENT3, false, '');
      [ residentCount ] = await Chores.getActiveResidentCount(HOUSE, later);
      expect(parseInt(residentCount.count)).to.equal(2);
    });

    it('can return the percent of the period a resident is not on break', async () => {
      const feb1 = new Date(2001, 1, 1); // February, a 28 day month
      const feb7 = new Date(feb1.getTime() + 7 * DAY);
      const feb14 = new Date(feb1.getTime() + 14 * DAY);
      const feb21 = new Date(feb1.getTime() + 21 * DAY);
      const mar1 = new Date(feb1.getTime() + 28 * DAY);
      const mar7 = new Date(mar1.getTime() + 7 * DAY);
      const mar14 = new Date(mar1.getTime() + 14 * DAY);

      let activeDays;

      activeDays = await Chores.getActiveResidentPercentage(RESIDENT1, feb1);
      expect(activeDays).to.almost.equal(1.0);

      // Take the first week off
      await Chores.addChoreBreak(RESIDENT1, feb1, feb7);

      activeDays = await Chores.getActiveResidentPercentage(RESIDENT1, feb1);
      expect(activeDays).to.almost.equal(0.75);

      // Take the third week off
      await Chores.addChoreBreak(RESIDENT1, feb14, feb21);

      activeDays = await Chores.getActiveResidentPercentage(RESIDENT1, feb1);
      expect(activeDays).to.almost.equal(0.5);

      // Take time off next month, has no effect
      await Chores.addChoreBreak(RESIDENT1, mar1, mar14);

      activeDays = await Chores.getActiveResidentPercentage(RESIDENT1, feb1);
      expect(activeDays).to.almost.equal(0.5);

      // Take the first two weeks off, this break overlaps with the first break
      await Chores.addChoreBreak(RESIDENT1, feb1, feb14);

      activeDays = await Chores.getActiveResidentPercentage(RESIDENT1, feb1);
      expect(activeDays).to.almost.equal(0.25);

      // Take the last week off, this break stretches into the next month
      await Chores.addChoreBreak(RESIDENT1, feb21, mar7);

      activeDays = await Chores.getActiveResidentPercentage(RESIDENT1, feb1);
      expect(activeDays).to.almost.equal(0.0);
    });
  });
});
