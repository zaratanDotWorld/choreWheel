const { expect } = require('chai');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const { NAY, YAY } = require('../src/constants');
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
    await Admin.addResident(HOUSE, RESIDENT5);
  });

  afterEach(async () => {
    await db('heart_challenge').del();
    await db('heart').del();
    await db('poll_vote').del();
    await db('poll').del();
  });

  describe('using hearts', async () => {
    it('can generate hearts for residents', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 1);
      await Hearts.generateHearts(HOUSE, RESIDENT1, 1);
      await Hearts.generateHearts(HOUSE, RESIDENT2, 1);
      await sleep(1);

      const hearts1 = await Hearts.getResidentHearts(HOUSE, RESIDENT1);
      const hearts2 = await Hearts.getResidentHearts(HOUSE, RESIDENT2);
      const hearts3 = await Hearts.getResidentHearts(HOUSE, RESIDENT3);

      expect(hearts1.sum).to.equal(2);
      expect(hearts2.sum).to.equal(1);
      expect(hearts3.sum).to.equal(null);
    });

    it('can aggregate positive and negative hearts', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 2);
      await Hearts.generateHearts(HOUSE, RESIDENT1, 1);
      await Hearts.generateHearts(HOUSE, RESIDENT1, -2);
      await sleep(1);

      const hearts = await Hearts.getResidentHearts(HOUSE, RESIDENT1);

      expect(hearts.sum).to.equal(1);
    });

    it('can handle fractional hearts', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 2.5);
      await Hearts.generateHearts(HOUSE, RESIDENT1, -0.75);
      await sleep(1);

      const hearts = await Hearts.getResidentHearts(HOUSE, RESIDENT1);

      expect(hearts.sum).to.equal(1.75);
    });

    it('can resolve a challenge where the challenger wins', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 5);
      await Hearts.generateHearts(HOUSE, RESIDENT2, 5);

      const [ challenge ] = await Hearts.initiateChallenge(HOUSE, RESIDENT1, RESIDENT2, 1, POLL_LENGTH);

      await Polls.submitVote(challenge.poll_id, RESIDENT1, new Date(), YAY);
      await Polls.submitVote(challenge.poll_id, RESIDENT2, new Date(), NAY);
      await Polls.submitVote(challenge.poll_id, RESIDENT3, new Date(), YAY);
      await Polls.submitVote(challenge.poll_id, RESIDENT4, new Date(), YAY);
      await Polls.submitVote(challenge.poll_id, RESIDENT5, new Date(), YAY);

      await sleep(POLL_LENGTH);

      await Hearts.resolveChallenge(challenge.id);
      await sleep(1);

      const hearts1 = await Hearts.getResidentHearts(HOUSE, RESIDENT1);
      const hearts2 = await Hearts.getResidentHearts(HOUSE, RESIDENT2);
      expect(hearts1.sum).to.equal(5);
      expect(hearts2.sum).to.equal(4);
    });

    it('can resolve a challenge where the challenger loses', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 5);
      await Hearts.generateHearts(HOUSE, RESIDENT2, 5);

      const [ challenge ] = await Hearts.initiateChallenge(HOUSE, RESIDENT1, RESIDENT2, 1, POLL_LENGTH);

      await Polls.submitVote(challenge.poll_id, RESIDENT1, new Date(), YAY);
      await Polls.submitVote(challenge.poll_id, RESIDENT2, new Date(), NAY);
      await Polls.submitVote(challenge.poll_id, RESIDENT3, new Date(), NAY);

      await sleep(POLL_LENGTH);

      await Hearts.resolveChallenge(challenge.id);
      await sleep(1);

      const hearts1 = await Hearts.getResidentHearts(HOUSE, RESIDENT1);
      const hearts2 = await Hearts.getResidentHearts(HOUSE, RESIDENT2);
      expect(hearts1.sum).to.equal(4);
      expect(hearts2.sum).to.equal(5);
    });

    it('can resolve a challenge where the quorum is not reached', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 5);
      await Hearts.generateHearts(HOUSE, RESIDENT2, 5);

      const [ challenge ] = await Hearts.initiateChallenge(HOUSE, RESIDENT1, RESIDENT2, 1, POLL_LENGTH);

      await Polls.submitVote(challenge.poll_id, RESIDENT1, new Date(), YAY);
      await Polls.submitVote(challenge.poll_id, RESIDENT2, new Date(), NAY);
      await Polls.submitVote(challenge.poll_id, RESIDENT3, new Date(), YAY);

      await sleep(POLL_LENGTH);

      await Hearts.resolveChallenge(challenge.id);
      await sleep(1);

      const hearts1 = await Hearts.getResidentHearts(HOUSE, RESIDENT1);
      const hearts2 = await Hearts.getResidentHearts(HOUSE, RESIDENT2);
      expect(hearts1.sum).to.equal(4);
      expect(hearts2.sum).to.equal(5);
    });

    it('cannot resolve a challenge before the poll is closed', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 5);
      await Hearts.generateHearts(HOUSE, RESIDENT2, 5);

      const [ challenge ] = await Hearts.initiateChallenge(HOUSE, RESIDENT1, RESIDENT2, 1, POLL_LENGTH);

      await Polls.submitVote(challenge.poll_id, RESIDENT1, new Date(), YAY);
      await Polls.submitVote(challenge.poll_id, RESIDENT2, new Date(), NAY);
      await Polls.submitVote(challenge.poll_id, RESIDENT3, new Date(), YAY);
      await sleep(1);

      await expect(Hearts.resolveChallenge(challenge.id))
        .to.be.rejectedWith('Poll not closed!');
    });

    it('cannot resolve a challenge twice', async () => {
      await Hearts.generateHearts(HOUSE, RESIDENT1, 5);
      await Hearts.generateHearts(HOUSE, RESIDENT2, 5);

      const [ challenge ] = await Hearts.initiateChallenge(HOUSE, RESIDENT1, RESIDENT2, 1, POLL_LENGTH);

      await Polls.submitVote(challenge.poll_id, RESIDENT1, new Date(), YAY);
      await Polls.submitVote(challenge.poll_id, RESIDENT2, new Date(), NAY);
      await Polls.submitVote(challenge.poll_id, RESIDENT3, new Date(), YAY);

      await sleep(POLL_LENGTH);

      await Hearts.resolveChallenge(challenge.id);
      await sleep(1);

      await expect(Hearts.resolveChallenge(challenge.id))
        .to.be.rejectedWith('Challenge already resolved!');
    });
  });
});
