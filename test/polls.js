const { expect } = require('chai');
const chai = require('chai');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const chaiAsPromised = require("chai-as-promised");

chai.use(bnChai(BN));
chai.use(chaiAsPromised);

const { USER1, USER2, USER3, DAY, NAY, YAY, CANCEL } = require('./../src/constants');

const { db } = require('./../src/db');
const Polls = require('./../src/modules/polls/models');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Polls', async () => {

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

      await Polls.submitVote(pollId, USER1, YAY);

      const votes = await Polls.getVotes(pollId);
      expect(votes.length).to.eq.BN(1);
      expect(votes[0].vote).to.be.true;
    });

    it('can update the vote in a poll', async () => {
      const [ pollId ] = await Polls.createPoll(3 * DAY);

      await Polls.submitVote(pollId, USER1, YAY);

      let votes;

      await Polls.submitVote(pollId, USER1, NAY);

      votes = await Polls.getVotes(pollId);
      expect(votes.length).to.eq.BN(1);
      expect(votes[0].vote).to.be.false;

      await Polls.submitVote(pollId, USER1, CANCEL);

      votes = await Polls.getVotes(pollId);
      expect(votes.length).to.eq.BN(1);
      expect(votes[0].vote).to.be.null;
    });

    it('cannot update the vote in a poll if the poll is closed', async () => {
      const [ pollId ] = await Polls.createPoll(5);

      await sleep(5);

      await expect(Polls.submitVote(pollId, USER1, YAY))
        .to.be.rejectedWith('Poll has closed');
    });

    it('can get the results of a vote', async () => {
      const [ pollId ] = await Polls.createPoll(10);

      await Polls.submitVote(pollId, USER1, YAY);
      await Polls.submitVote(pollId, USER2, YAY);
      await Polls.submitVote(pollId, USER3, NAY);

      await sleep(1);

      const results = await Polls.getResults(pollId);
      expect(results.length).to.eq.BN(3);
    });

    it('can get the result of a vote', async () => {
      const [ pollId ] = await Polls.createPoll(10);

      await Polls.submitVote(pollId, USER1, YAY);
      await Polls.submitVote(pollId, USER2, YAY);
      await Polls.submitVote(pollId, USER3, NAY);

      await sleep(1);

      const { yays, nays } = await Polls.getResultCounts(pollId);
      expect(yays).to.eq.BN(2);
      expect(nays).to.eq.BN(1);
    });
  });
});
