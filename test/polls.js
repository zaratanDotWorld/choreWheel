const { expect } = require('chai');
const chai = require('chai');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const chaiAsPromised = require("chai-as-promised");

chai.use(bnChai(BN));
chai.use(chaiAsPromised);

const { db } = require('./../src/db');
const polls = require('./../src/modules/polls/models');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Chores', async () => {
  const USER1 = 'USER1';
  const USER2 = 'USER2';
  const USER3 = 'USER3';

  const DAY = 60 * 60 * 24 * 1000;

  const NAY = 0;
  const YAY = 1;
  const CANCEL = undefined;

  beforeEach(async () => {
    await db('poll_vote').del();
    await db('poll').del();
  });

  it('can create a new poll', async () => {
    const poll = await polls.createPoll(3 * DAY);

    expect(poll[0]).to.eq.BN(1);
  });

  it('can vote in a poll', async () => {
    const poll = await polls.createPoll(3 * DAY);
    const pollId = poll[0];

    await polls.submitVote(pollId, USER1, YAY);

    const votes = await polls.getVotes(pollId);
    expect(votes.length).to.eq.BN(1);
    expect(votes[0].vote).to.be.true;
  });

  it('can update the vote in a poll', async () => {
    const poll = await polls.createPoll(3 * DAY);
    const pollId = poll[0];

    await polls.submitVote(pollId, USER1, YAY);

    let votes;

    await polls.submitVote(pollId, USER1, NAY);

    votes = await polls.getVotes(pollId);
    expect(votes.length).to.eq.BN(1);
    expect(votes[0].vote).to.be.false;

    await polls.submitVote(pollId, USER1, CANCEL);

    votes = await polls.getVotes(pollId);
    expect(votes.length).to.eq.BN(1);
    expect(votes[0].vote).to.be.null;
  });

  it('cannot update the vote in a poll if the poll is closed', async () => {
    const poll = await polls.createPoll(5);
    const pollId = poll[0];

    await sleep(10);

    await expect(polls.submitVote(pollId, USER1, YAY))
      .to.be.rejectedWith('Poll has closed');
  });

  it('can get the results of a vote', async () => {
    const poll = await polls.createPoll(10);
    const pollId = poll[0];

    await polls.submitVote(pollId, USER1, YAY);
    await polls.submitVote(pollId, USER2, YAY);
    await polls.submitVote(pollId, USER3, NAY);

    const results = await polls.getResults(pollId);
    expect(results.length).to.eq.BN(3);
  });

  it('can get the result of a vote', async () => {
    const poll = await polls.createPoll(10);
    const pollId = poll[0];

    await polls.submitVote(pollId, USER1, YAY);
    await polls.submitVote(pollId, USER2, YAY);
    await polls.submitVote(pollId, USER3, NAY);

    const result = await polls.getResult(pollId);
    expect(result).to.be.true;
  });
});
