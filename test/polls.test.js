const { expect } = require('chai');
const chai = require('chai');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(bnChai(BN));
chai.use(chaiAsPromised);

const { DAY, NAY, YAY, CANCEL } = require('../src/constants');

const { db } = require('../src/db');
const Polls = require('../src/modules/polls/polls');
const Residents = require('../src/modules/residents/residents');

function sleep (ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Polls', async () => {
  const RESIDENT1 = 'RESIDENT1';
  const RESIDENT2 = 'RESIDENT2';
  const RESIDENT3 = 'RESIDENT3';

  before(async () => {
    await db('resident').del();
    await Residents.addResident(RESIDENT1);
    await Residents.addResident(RESIDENT2);
    await Residents.addResident(RESIDENT3);
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

      await Polls.createPoll(3 * DAY);

      [ pollCount ] = await db('poll').count('*');
      expect(pollCount.count).to.eq.BN(1);
    });

    it('can vote in a poll', async () => {
      const [ pollId ] = await Polls.createPoll(3 * DAY);

      await Polls.submitVote(pollId, RESIDENT1, YAY);

      const votes = await Polls.getVotes(pollId);
      expect(votes.length).to.eq.BN(1);
      expect(votes[0].vote).to.be.true;
    });

    it('can update the vote in a poll', async () => {
      const [ pollId ] = await Polls.createPoll(3 * DAY);

      await Polls.submitVote(pollId, RESIDENT1, YAY);

      let votes;

      await Polls.submitVote(pollId, RESIDENT1, NAY);

      votes = await Polls.getVotes(pollId);
      expect(votes.length).to.eq.BN(1);
      expect(votes[0].vote).to.be.false;

      await Polls.submitVote(pollId, RESIDENT1, CANCEL);

      votes = await Polls.getVotes(pollId);
      expect(votes.length).to.eq.BN(1);
      expect(votes[0].vote).to.be.null;
    });

    it('cannot update the vote in a poll if the poll is closed', async () => {
      const [ pollId ] = await Polls.createPoll(5);

      await sleep(5);

      await expect(Polls.submitVote(pollId, RESIDENT1, YAY))
        .to.be.rejectedWith('Poll has closed');
    });

    it('can get the results of a vote', async () => {
      const [ pollId ] = await Polls.createPoll(10);

      await Polls.submitVote(pollId, RESIDENT1, YAY);
      await Polls.submitVote(pollId, RESIDENT2, YAY);
      await Polls.submitVote(pollId, RESIDENT3, NAY);

      await sleep(1);

      const results = await Polls.getResults(pollId);
      expect(results.length).to.eq.BN(3);
    });

    it('can get the result of a vote', async () => {
      const [ pollId ] = await Polls.createPoll(10);

      await Polls.submitVote(pollId, RESIDENT1, YAY);
      await Polls.submitVote(pollId, RESIDENT2, YAY);
      await Polls.submitVote(pollId, RESIDENT3, NAY);

      await sleep(1);

      const { yays, nays } = await Polls.getResultCounts(pollId);
      expect(yays).to.eq.BN(2);
      expect(nays).to.eq.BN(1);
    });
  });
});
