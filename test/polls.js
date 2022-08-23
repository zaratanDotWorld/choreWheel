const { expect } = require('chai');
const chai = require('chai');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const chaiAsPromised = require("chai-as-promised");

chai.use(bnChai(BN));
chai.use(chaiAsPromised);

const { db } = require('./../src/db');
const Polls = require('./../src/modules/polls/models');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Polls', async () => {
  const USER1 = 'USER1';
  const USER2 = 'USER2';
  const USER3 = 'USER3';

  const DAY = 60 * 60 * 24 * 1000;

  const NAY = 0;
  const YAY = 1;
  const CANCEL = undefined;

  afterEach(async () => {
    await db('poll_vote').del();
    await db('poll').del();
  });

  describe('using polls', async () => {
    it('can create a new poll', async () => {
      let pollCount;
      pollCount = await db('poll').count('*');
      expect(pollCount[0].count).to.be.zero;

      await Polls.createPoll(3 * DAY);

      pollCount = await db('poll').count('*');
      expect(pollCount[0].count).to.eq.BN(1);
    });

    it('can vote in a poll', async () => {
      const pollIds = await Polls.createPoll(3 * DAY);
      const pollId = pollIds[0];

      await Polls.submitVote(pollId, USER1, YAY);

      const votes = await Polls.getVotes(pollId);
      expect(votes.length).to.eq.BN(1);
      expect(votes[0].vote).to.be.true;
    });

    it('can update the vote in a poll', async () => {
      const pollIds = await Polls.createPoll(3 * DAY);
      const pollId = pollIds[0];

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
      const pollIds = await Polls.createPoll(5);
      const pollId = pollIds[0];

      await sleep(5);

      await expect(Polls.submitVote(pollId, USER1, YAY))
        .to.be.rejectedWith('Poll has closed');
    });

    it('can get the results of a vote', async () => {
      const pollIds = await Polls.createPoll(10);
      const pollId = pollIds[0];

      await Polls.submitVote(pollId, USER1, YAY);
      await Polls.submitVote(pollId, USER2, YAY);
      await Polls.submitVote(pollId, USER3, NAY);

      await sleep(1);

      const results = await Polls.getResults(pollId);
      expect(results.length).to.eq.BN(3);
    });

    it('can get the result of a vote', async () => {
      const pollIds = await Polls.createPoll(10);
      const pollId = pollIds[0];

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
