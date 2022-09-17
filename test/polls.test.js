const { expect } = require('chai');
const chai = require('chai');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(bnChai(BN));
chai.use(chaiAsPromised);

const { DAY, NAY, YAY, CANCEL } = require('../src/constants');
const { sleep } = require('../src/utils');
const { db } = require('../src/db');

const Polls = require('../src/modules/polls');
const Admin = require('../src/modules/admin');

describe('Polls', async () => {
  const HOUSE = 'house123';

  const RESIDENT1 = 'RESIDENT1';
  const RESIDENT2 = 'RESIDENT2';
  const RESIDENT3 = 'RESIDENT3';

  before(async () => {
    await db('chore').del();
    await db('resident').del();
    await db('house').del();

    await Admin.addHouse(HOUSE);
    await Admin.addResident(HOUSE, RESIDENT1);
    await Admin.addResident(HOUSE, RESIDENT2);
    await Admin.addResident(HOUSE, RESIDENT3);
  });

  afterEach(async () => {
    await db('poll_vote').del();
    await db('poll').del();
  });

  describe('using polls', async () => {
    it('can create a new poll', async () => {
      let pollCount;
      [ pollCount ] = await db('poll').count('*');
      expect(pollCount.count).to.be.zero;

      await Polls.createPoll(DAY);

      [ pollCount ] = await db('poll').count('*');
      expect(pollCount.count).to.eq.BN(1);
    });

    it('can vote in a poll', async () => {
      const [ poll ] = await Polls.createPoll(DAY);

      await Polls.submitVote(poll.id, RESIDENT1, YAY);

      const votes = await Polls.getPollVotes(poll.id);
      expect(votes.length).to.eq.BN(1);
      expect(votes[0].vote).to.be.true;
    });

    it('can update the vote in a poll', async () => {
      const [ poll ] = await Polls.createPoll(DAY);

      await Polls.submitVote(poll.id, RESIDENT1, YAY);

      let votes;

      await Polls.submitVote(poll.id, RESIDENT1, NAY);

      votes = await Polls.getPollVotes(poll.id);
      expect(votes.length).to.eq.BN(1);
      expect(votes[0].vote).to.be.false;

      await Polls.submitVote(poll.id, RESIDENT1, CANCEL);

      votes = await Polls.getPollVotes(poll.id);
      expect(votes.length).to.eq.BN(1);
      expect(votes[0].vote).to.be.null;
    });

    it('cannot update the vote in a poll if the poll is closed', async () => {
      const [ poll ] = await Polls.createPoll(5);

      await sleep(5);

      await expect(Polls.submitVote(poll.id, RESIDENT1, YAY))
        .to.be.rejectedWith('Poll has closed');
    });

    it('can get the results of a vote', async () => {
      const [ poll ] = await Polls.createPoll(10);

      await Polls.submitVote(poll.id, RESIDENT1, YAY);
      await Polls.submitVote(poll.id, RESIDENT2, YAY);
      await Polls.submitVote(poll.id, RESIDENT3, NAY);

      await sleep(1);

      const results = await Polls.getPollResults(poll.id);
      expect(results.length).to.eq.BN(3);
    });

    it('can get the result of a vote', async () => {
      const [ poll ] = await Polls.createPoll(10);

      await Polls.submitVote(poll.id, RESIDENT1, YAY);
      await Polls.submitVote(poll.id, RESIDENT2, YAY);
      await Polls.submitVote(poll.id, RESIDENT3, NAY);

      await sleep(1);

      const { yays, nays } = await Polls.getPollResultCounts(poll.id);
      expect(yays).to.eq.BN(2);
      expect(nays).to.eq.BN(1);
    });
  });
});
