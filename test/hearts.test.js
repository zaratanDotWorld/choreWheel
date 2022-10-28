const { expect } = require('chai');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const { NAY, YAY, HOUR } = require('../src/constants');
const { heartsPollLength, heartsBaseline, karmaMaxHearts, karmaDelay } = require('../src/config');
const { sleep, getNextMonthStart } = require('../src/utils');
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
  let nextMonth;
  let twoMonths;

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
    nextMonth = getNextMonthStart(now);
    twoMonths = getNextMonthStart(nextMonth);
  });

  afterEach(async () => {
    await db('HeartKarma').del();
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

      const hearts1 = await Hearts.getHearts(HOUSE, RESIDENT1, now);
      const hearts2 = await Hearts.getHearts(HOUSE, RESIDENT2, now);
      const hearts3 = await Hearts.getHearts(HOUSE, RESIDENT3, now);

      expect(hearts1.sum).to.equal(2);
      expect(hearts2.sum).to.equal(1);
      expect(hearts3.sum).to.equal(null);
    });

    it('can get hearts for the house at once', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 2, now);
      await Hearts.generateHearts(HOUSE, RESIDENT2, 1, now);
      await sleep(5);

      const hearts = await Hearts.getHouseHearts(HOUSE, now);

      expect(hearts[0].sum).to.equal(2);
      expect(hearts[1].sum).to.equal(1);
    });

    it('can aggregate positive and negative hearts', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 2, now);
      await Hearts.generateHearts(HOUSE, RESIDENT1, 1, now);
      await Hearts.generateHearts(HOUSE, RESIDENT1, -2, now);
      await sleep(5);

      const hearts = await Hearts.getHearts(HOUSE, RESIDENT1, now);

      expect(hearts.sum).to.equal(1);
    });

    it('can handle fractional hearts', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 2.5, now);
      await Hearts.generateHearts(HOUSE, RESIDENT1, -0.75, now);
      await sleep(5);

      const hearts = await Hearts.getHearts(HOUSE, RESIDENT1, now);

      expect(hearts.sum).to.equal(1.75);
    });

    it('can initialise a resident', async () => {
      await Hearts.initialiseResident(HOUSE, RESIDENT1, now);
      await sleep(5);

      let hearts;
      hearts = await Hearts.getHearts(HOUSE, RESIDENT1, now);
      expect(hearts.sum).to.equal(heartsBaseline);

      // But only once
      await Hearts.initialiseResident(HOUSE, RESIDENT1, now);
      await sleep(5);

      hearts = await Hearts.getHearts(HOUSE, RESIDENT1, now);
      expect(hearts.sum).to.equal(heartsBaseline);

      // Even if they go back to zero
      await Hearts.generateHearts(HOUSE, RESIDENT1, -heartsBaseline, now);
      await sleep(5);

      await Hearts.initialiseResident(HOUSE, RESIDENT1, now);
      await sleep(5);

      hearts = await Hearts.getHearts(HOUSE, RESIDENT1, now);
      expect(hearts.sum).to.equal(0);
    });

    it('can regenerate hearts', async () => {
      let hearts;

      // Won't regenerate if not initialised
      await Hearts.regenerateHearts(HOUSE, RESIDENT1, nextMonth);
      await sleep(5);

      hearts = await Hearts.getHearts(HOUSE, RESIDENT1, nextMonth);
      expect(hearts.sum).to.equal(null);

      // Generate a heart, now regeneration works
      await Hearts.generateHearts(HOUSE, RESIDENT1, 1, now);
      await sleep(5);

      await Hearts.regenerateHearts(HOUSE, RESIDENT1, nextMonth);
      await sleep(5);

      hearts = await Hearts.getHearts(HOUSE, RESIDENT1, nextMonth);
      expect(hearts.sum).to.equal(2);

      // But not in the same month
      await Hearts.regenerateHearts(HOUSE, RESIDENT1, nextMonth);
      await sleep(5);

      hearts = await Hearts.getHearts(HOUSE, RESIDENT1, nextMonth);
      expect(hearts.sum).to.equal(2);

      // But yes in another month
      await Hearts.regenerateHearts(HOUSE, RESIDENT1, twoMonths);
      await sleep(5);

      hearts = await Hearts.getHearts(HOUSE, RESIDENT1, twoMonths);
      expect(hearts.sum).to.equal(3);
    });

    it('cannot regenerate hearts if full', async () => {
      let hearts;

      await Hearts.initialiseResident(HOUSE, RESIDENT1, now);
      await sleep(5);

      hearts = await Hearts.getHearts(HOUSE, RESIDENT1, now);
      expect(hearts.sum).to.equal(5);

      await Hearts.regenerateHearts(HOUSE, RESIDENT1, now);
      await sleep(5);

      hearts = await Hearts.getHearts(HOUSE, RESIDENT1, now);
      expect(hearts.sum).to.equal(5);

      // Or overloaded
      await Hearts.generateHearts(HOUSE, RESIDENT1, 1, nextMonth);
      await sleep(5);

      hearts = await Hearts.getHearts(HOUSE, RESIDENT1, nextMonth);
      expect(hearts.sum).to.equal(6);

      await Hearts.regenerateHearts(HOUSE, RESIDENT1, nextMonth);
      await sleep(5);

      hearts = await Hearts.getHearts(HOUSE, RESIDENT1, nextMonth);
      expect(hearts.sum).to.equal(6);
    });
  });

  describe('making challenges', async () => {
    it('can resolve a challenge where the challenger wins', async () => {
      await Hearts.initialiseResident(HOUSE, RESIDENT1, now);
      await Hearts.initialiseResident(HOUSE, RESIDENT2, now);

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

      const hearts1 = await Hearts.getHearts(HOUSE, RESIDENT1, challengeEnd);
      const hearts2 = await Hearts.getHearts(HOUSE, RESIDENT2, challengeEnd);
      expect(hearts1.sum).to.equal(5);
      expect(hearts2.sum).to.equal(4);
    });

    it('can resolve a challenge where the challenger loses', async () => {
      await Hearts.initialiseResident(HOUSE, RESIDENT1, now);
      await Hearts.initialiseResident(HOUSE, RESIDENT2, now);

      const [ challenge ] = await Hearts.issueChallenge(HOUSE, RESIDENT1, RESIDENT2, 1, now);
      await sleep(5);

      await Polls.submitVote(challenge.pollId, RESIDENT1, now, YAY);
      await Polls.submitVote(challenge.pollId, RESIDENT2, now, NAY);
      await Polls.submitVote(challenge.pollId, RESIDENT3, now, NAY);
      await sleep(5);

      await Hearts.resolveChallenge(challenge.id, challengeEnd);
      await sleep(5);

      const hearts1 = await Hearts.getHearts(HOUSE, RESIDENT1, challengeEnd);
      const hearts2 = await Hearts.getHearts(HOUSE, RESIDENT2, challengeEnd);
      expect(hearts1.sum).to.equal(4);
      expect(hearts2.sum).to.equal(5);
    });

    it('can resolve a challenge where the quorum is not reached', async () => {
      await Hearts.initialiseResident(HOUSE, RESIDENT1, now);
      await Hearts.initialiseResident(HOUSE, RESIDENT2, now);

      const [ challenge ] = await Hearts.issueChallenge(HOUSE, RESIDENT1, RESIDENT2, 1, now);
      await sleep(5);

      await Polls.submitVote(challenge.pollId, RESIDENT1, now, YAY);
      await Polls.submitVote(challenge.pollId, RESIDENT2, now, NAY);
      await Polls.submitVote(challenge.pollId, RESIDENT3, now, YAY);
      await sleep(5);

      await Hearts.resolveChallenge(challenge.id, challengeEnd);
      await sleep(5);

      const hearts1 = await Hearts.getHearts(HOUSE, RESIDENT1, challengeEnd);
      const hearts2 = await Hearts.getHearts(HOUSE, RESIDENT2, challengeEnd);
      expect(hearts1.sum).to.equal(4);
      expect(hearts2.sum).to.equal(5);
    });

    it('cannot resolve a challenge before the poll is closed', async () => {
      const soon = new Date(now.getTime() + HOUR);

      await Hearts.initialiseResident(HOUSE, RESIDENT1, now);
      await Hearts.initialiseResident(HOUSE, RESIDENT2, now);

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
      await Hearts.initialiseResident(HOUSE, RESIDENT1, now);
      await Hearts.initialiseResident(HOUSE, RESIDENT2, now);

      const [ challenge ] = await Hearts.issueChallenge(HOUSE, RESIDENT1, RESIDENT2, 1, now);
      await sleep(5);

      await Polls.submitVote(challenge.pollId, RESIDENT1, now, YAY);
      await Polls.submitVote(challenge.pollId, RESIDENT2, now, NAY);
      await Polls.submitVote(challenge.pollId, RESIDENT3, now, YAY);
      await sleep(5);

      await Hearts.resolveChallenge(challenge.id, challengeEnd);
      await sleep(5);

      await expect(Hearts.resolveChallenge(challenge.id, challengeEnd))
        .to.be.rejectedWith('Challenge already resolved!');
    });

    it('cannot challenge oneself', async () => {
      const dbError = 'HeartChallenge" ("challengeeId", "challengerId", "houseId", "pollId", "value") values ($1, $2, $3, $4, $5) returning * - ' +
        'new row for relation "HeartChallenge" violates check constraint "HeartChallenge_check';

      await expect(Hearts.issueChallenge(HOUSE, RESIDENT1, RESIDENT1, 1, now))
        .to.be.rejectedWith(dbError);
    });
  });

  describe('using karma', async () => {
    let nextMonthKarma;
    let twoMonthsKarma;

    before(async () => {
      nextMonthKarma = new Date(nextMonth.getTime() + karmaDelay);
      twoMonthsKarma = new Date(twoMonths.getTime() + karmaDelay);
    });

    it('can give karma to a resident', async () => {
      await Hearts.giveKarma(HOUSE, RESIDENT1, RESIDENT2, now);
      await Hearts.giveKarma(HOUSE, RESIDENT2, RESIDENT3, now);
      await sleep(5);

      const karma = await Hearts.getKarma(HOUSE, now, challengeEnd);
      expect(karma.length).to.equal(2);
    });

    it('cannot give karma to oneself', async () => {
      const dbError = 'insert into "HeartKarma" ("givenAt", "giverId", "houseId", "receiverId") values ($1, $2, $3, $4) returning * - ' +
        'new row for relation "HeartKarma" violates check constraint "HeartKarma_check"';

      await expect(Hearts.giveKarma(HOUSE, RESIDENT1, RESIDENT1, now))
        .to.be.rejectedWith(dbError);
    });

    it('can calculate ranks based on karma', async () => {
      await Hearts.giveKarma(HOUSE, RESIDENT1, RESIDENT2, now);
      await Hearts.giveKarma(HOUSE, RESIDENT2, RESIDENT3, now);
      await sleep(5);

      const rankings = await Hearts.getKarmaRankings(HOUSE, now, challengeEnd);
      expect(rankings[0].slackId).to.equal(RESIDENT3);
    });

    it('can generate karma hearts', async () => {
      await Hearts.giveKarma(HOUSE, RESIDENT1, RESIDENT2, now);
      await Hearts.giveKarma(HOUSE, RESIDENT2, RESIDENT3, now);
      await sleep(5);

      let karmaHeart;

      // Nothing last month, there was no karma then
      [ karmaHeart ] = await Hearts.generateKarmaHeart(HOUSE, now);
      expect(karmaHeart).to.be.undefined;

      // This month we give a karma heart
      [ karmaHeart ] = await Hearts.generateKarmaHeart(HOUSE, nextMonthKarma);
      expect(karmaHeart.residentId).to.equal(RESIDENT3);
      expect(karmaHeart.value).to.equal(1);

      // But not twice
      [ karmaHeart ] = await Hearts.generateKarmaHeart(HOUSE, nextMonthKarma);
      expect(karmaHeart).to.be.undefined;

      // If they're at the limit, they get less
      await Hearts.generateHearts(HOUSE, RESIDENT4, karmaMaxHearts - 0.5, nextMonthKarma);
      await Hearts.giveKarma(HOUSE, RESIDENT1, RESIDENT4, nextMonthKarma);
      await sleep(5);

      [ karmaHeart ] = await Hearts.generateKarmaHeart(HOUSE, twoMonthsKarma);
      expect(karmaHeart.residentId).to.equal(RESIDENT4);
      expect(karmaHeart.value).to.equal(0.5);
    });
  });
});
