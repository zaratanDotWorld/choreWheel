const { expect } = require('chai');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const { NAY, YAY, HOUR, DAY } = require('../src/constants');
const { heartsPollLength, heartsBaseline } = require('../src/config');
const { sleep } = require('../src/utils');
const { db } = require('../src/db');

const Hearts = require('../src/modules/hearts');
const Polls = require('../src/modules/polls');
const Admin = require('../src/modules/admin');

describe('Hearts', async () => {
  const HOUSE = 'house123';

  const RESIDENT1 = 'RESIDENT1';
  const RESIDENT2 = 'RESIDENT2';
  const RESIDENT3 = 'RESIDENT3';
  const RESIDENT4 = 'RESIDENT4';
  const RESIDENT5 = 'RESIDENT5';

  let now;
  let challengeEnd;

  before(async () => {
    await db('Chore').del();
    await db('Resident').del();
    await db('House').del();

    await Admin.updateHouse({ slackId: HOUSE });
    await Admin.addResident(HOUSE, RESIDENT1);
    await Admin.addResident(HOUSE, RESIDENT2);
    await Admin.addResident(HOUSE, RESIDENT3);
    await Admin.addResident(HOUSE, RESIDENT4);
    await Admin.addResident(HOUSE, RESIDENT5);

    now = new Date();
    challengeEnd = new Date(now.getTime() + heartsPollLength);
  });

  afterEach(async () => {
    await db('HeartChallenge').del();
    await db('Heart').del();
    await db('PollVote').del();
    await db('Poll').del();
  });

  describe('using hearts', async () => {
    it('can generate hearts for residents', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 1, now);
      await Hearts.generateHearts(HOUSE, RESIDENT1, 1, now);
      await Hearts.generateHearts(HOUSE, RESIDENT2, 1, now);
      await sleep(5);

      const hearts1 = await Hearts.getResidentHearts(RESIDENT1, now);
      const hearts2 = await Hearts.getResidentHearts(RESIDENT2, now);
      const hearts3 = await Hearts.getResidentHearts(RESIDENT3, now);

      expect(hearts1.sum).to.equal(2);
      expect(hearts2.sum).to.equal(1);
      expect(hearts3.sum).to.equal(null);
    });

    it('can aggregate positive and negative hearts', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 2, now);
      await Hearts.generateHearts(HOUSE, RESIDENT1, 1, now);
      await Hearts.generateHearts(HOUSE, RESIDENT1, -2, now);
      await sleep(5);

      const hearts = await Hearts.getResidentHearts(RESIDENT1, now);

      expect(hearts.sum).to.equal(1);
    });

    it('can handle fractional hearts', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 2.5, now);
      await Hearts.generateHearts(HOUSE, RESIDENT1, -0.75, now);
      await sleep(5);

      const hearts = await Hearts.getResidentHearts(RESIDENT1, now);

      expect(hearts.sum).to.equal(1.75);
    });

    it('can initialise a resident', async () => {
      await Hearts.initialiseResident(HOUSE, RESIDENT1, now);
      await sleep(5);

      let hearts;
      hearts = await Hearts.getResidentHearts(RESIDENT1, now);
      expect(hearts.sum).to.equal(heartsBaseline);

      // But only once
      await Hearts.initialiseResident(HOUSE, RESIDENT1, now);
      await sleep(5);

      hearts = await Hearts.getResidentHearts(RESIDENT1, now);
      expect(hearts.sum).to.equal(heartsBaseline);

      // Even if they go back to zero
      await Hearts.generateHearts(HOUSE, RESIDENT1, -heartsBaseline, now);
      await sleep(5);

      await Hearts.initialiseResident(HOUSE, RESIDENT1, now);
      await sleep(5);

      hearts = await Hearts.getResidentHearts(RESIDENT1, now);
      expect(hearts.sum).to.equal(0);
    });

    it('can regenerate hearts', async () => {
      await Hearts.regenerateHearts(HOUSE, RESIDENT1, now);
      await sleep(5);

      let hearts;
      hearts = await Hearts.getResidentHearts(RESIDENT1, now);
      expect(hearts.sum).to.equal(1);

      // But not in the same month
      await Hearts.regenerateHearts(HOUSE, RESIDENT1, now);
      await sleep(5);

      hearts = await Hearts.getResidentHearts(RESIDENT1, now);
      expect(hearts.sum).to.equal(1);

      // But yes next month
      const oneMonthLater = new Date(now.getTime() + 35 * DAY);
      await Hearts.regenerateHearts(HOUSE, RESIDENT1, oneMonthLater);
      await sleep(5);

      hearts = await Hearts.getResidentHearts(RESIDENT1, oneMonthLater);
      expect(hearts.sum).to.equal(2);

      // But not if they're full
      await Hearts.generateHearts(HOUSE, RESIDENT1, 3, oneMonthLater);
      await sleep(5);

      const twoMonthsLater = new Date(now.getTime() + 70 * DAY);
      await Hearts.regenerateHearts(HOUSE, RESIDENT1, twoMonthsLater);
      await sleep(5);

      hearts = await Hearts.getResidentHearts(RESIDENT1, twoMonthsLater);
      expect(hearts.sum).to.equal(5);

      // Or overloaded
      await Hearts.generateHearts(HOUSE, RESIDENT1, 1, twoMonthsLater);
      await sleep(5);
      await Hearts.regenerateHearts(HOUSE, RESIDENT1, twoMonthsLater);
      await sleep(5);

      hearts = await Hearts.getResidentHearts(RESIDENT1, twoMonthsLater);
      expect(hearts.sum).to.equal(6);
    });

    it('can resolve a challenge where the challenger wins', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 5, now);
      await Hearts.generateHearts(HOUSE, RESIDENT2, 5, now);

      const [ challenge ] = await Hearts.issueChallenge(HOUSE, RESIDENT1, RESIDENT2, 1, now);
      await sleep(5);

      await Polls.submitVote(challenge.pollId, RESIDENT1, now, YAY);
      await Polls.submitVote(challenge.pollId, RESIDENT2, now, NAY);
      await Polls.submitVote(challenge.pollId, RESIDENT3, now, YAY);
      await Polls.submitVote(challenge.pollId, RESIDENT4, now, YAY);
      await Polls.submitVote(challenge.pollId, RESIDENT5, now, YAY);
      await sleep(5);

      await Hearts.resolveChallenge(challenge.id, challengeEnd);
      await sleep(5);

      const hearts1 = await Hearts.getResidentHearts(RESIDENT1, challengeEnd);
      const hearts2 = await Hearts.getResidentHearts(RESIDENT2, challengeEnd);
      expect(hearts1.sum).to.equal(5);
      expect(hearts2.sum).to.equal(4);
    });

    it('can resolve a challenge where the challenger loses', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 5, now);
      await Hearts.generateHearts(HOUSE, RESIDENT2, 5, now);

      const [ challenge ] = await Hearts.issueChallenge(HOUSE, RESIDENT1, RESIDENT2, 1, now);
      await sleep(5);

      await Polls.submitVote(challenge.pollId, RESIDENT1, now, YAY);
      await Polls.submitVote(challenge.pollId, RESIDENT2, now, NAY);
      await Polls.submitVote(challenge.pollId, RESIDENT3, now, NAY);
      await sleep(5);

      await Hearts.resolveChallenge(challenge.id, challengeEnd);
      await sleep(5);

      const hearts1 = await Hearts.getResidentHearts(RESIDENT1, challengeEnd);
      const hearts2 = await Hearts.getResidentHearts(RESIDENT2, challengeEnd);
      expect(hearts1.sum).to.equal(4);
      expect(hearts2.sum).to.equal(5);
    });

    it('can resolve a challenge where the quorum is not reached', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 5, now);
      await Hearts.generateHearts(HOUSE, RESIDENT2, 5, now);

      const [ challenge ] = await Hearts.issueChallenge(HOUSE, RESIDENT1, RESIDENT2, 1, now);
      await sleep(5);

      await Polls.submitVote(challenge.pollId, RESIDENT1, now, YAY);
      await Polls.submitVote(challenge.pollId, RESIDENT2, now, NAY);
      await Polls.submitVote(challenge.pollId, RESIDENT3, now, YAY);
      await sleep(5);

      await Hearts.resolveChallenge(challenge.id, challengeEnd);
      await sleep(5);

      const hearts1 = await Hearts.getResidentHearts(RESIDENT1, challengeEnd);
      const hearts2 = await Hearts.getResidentHearts(RESIDENT2, challengeEnd);
      expect(hearts1.sum).to.equal(4);
      expect(hearts2.sum).to.equal(5);
    });

    it('cannot resolve a challenge before the poll is closed', async () => {
      const soon = new Date(now.getTime() + HOUR);

      await Hearts.generateHearts(HOUSE, RESIDENT1, 5, now);
      await Hearts.generateHearts(HOUSE, RESIDENT2, 5, now);

      const [ challenge ] = await Hearts.issueChallenge(HOUSE, RESIDENT1, RESIDENT2, 1, now);
      await sleep(5);

      await Polls.submitVote(challenge.pollId, RESIDENT1, now, YAY);
      await Polls.submitVote(challenge.pollId, RESIDENT2, now, NAY);
      await Polls.submitVote(challenge.pollId, RESIDENT3, now, YAY);
      await sleep(5);

      await expect(Hearts.resolveChallenge(challenge.id, soon))
        .to.be.rejectedWith('Poll not closed!');
    });

    it('cannot resolve a challenge twice', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 5, now);
      await Hearts.generateHearts(HOUSE, RESIDENT2, 5, now);

      const [ challenge ] = await Hearts.issueChallenge(HOUSE, RESIDENT1, RESIDENT2, 1, now);
      await sleep(5);

      await Polls.submitVote(challenge.pollId, RESIDENT1, now, YAY);
      await Polls.submitVote(challenge.pollId, RESIDENT2, now, NAY);
      await Polls.submitVote(challenge.pollId, RESIDENT3, now, YAY);
      await sleep(5);

      await Hearts.resolveChallenge(challenge.id, challengeEnd);
      await sleep(5);

      await expect(Hearts.resolveChallenge(challenge.id))
        .to.be.rejectedWith('Challenge already resolved!');
    });
  });
});
