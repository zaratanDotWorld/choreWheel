const { expect } = require('chai');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const { HOUR, DAY, NAY, YAY, CANCEL } = require('../src/constants');
const { db } = require('../src/modules/db');

const Polls = require('../src/modules/polls');
const Admin = require('../src/modules/admin');

describe('Polls', async () => {
  const HOUSE = 'house123';

  const RESIDENT1 = 'RESIDENT1';
  const RESIDENT2 = 'RESIDENT2';
  const RESIDENT3 = 'RESIDENT3';

  let now;
  let soon;

  before(async () => {
    await db('Chore').del();
    await db('Resident').del();
    await db('House').del();

    now = new Date();
    soon = new Date(now.getTime() + HOUR);

    await Admin.updateHouse({ slackId: HOUSE });
    await Admin.addResident(HOUSE, RESIDENT1, now);
    await Admin.addResident(HOUSE, RESIDENT2, now);
    await Admin.addResident(HOUSE, RESIDENT3, now);
  });

  afterEach(async () => {
    await db('PollVote').del();
    await db('Poll').del();
  });

  describe('using polls', async () => {
    it('can create a new poll', async () => {
      let pollCount;
      [ pollCount ] = await db('Poll').count('*');
      expect(parseInt(pollCount.count)).to.equal(0);

      await Polls.createPoll(now, DAY);

      [ pollCount ] = await db('Poll').count('*');
      expect(parseInt(pollCount.count)).to.equal(1);
    });

    it('can vote in a poll', async () => {
      const [ poll ] = await Polls.createPoll(now, DAY);

      await Polls.submitVote(poll.id, RESIDENT1, soon, YAY);

      const votes = await Polls.getPollVotes(poll.id);
      expect(votes.length).to.equal(1);
      expect(votes[0].vote).to.be.true;
    });

    it('can update the vote in a poll', async () => {
      const [ poll ] = await Polls.createPoll(now, DAY);

      await Polls.submitVote(poll.id, RESIDENT1, soon, YAY);

      let votes;

      await Polls.submitVote(poll.id, RESIDENT1, soon, NAY);

      votes = await Polls.getPollVotes(poll.id);
      expect(votes.length).to.equal(1);
      expect(votes[0].vote).to.be.false;

      await Polls.submitVote(poll.id, RESIDENT1, soon, CANCEL);

      votes = await Polls.getPollVotes(poll.id);
      expect(votes.length).to.equal(1);
      expect(votes[0].vote).to.be.null;
    });

    it('cannot update the vote in a poll if the poll is closed', async () => {
      const [ poll ] = await Polls.createPoll(now, DAY);

      await expect(Polls.submitVote(poll.id, RESIDENT1, new Date(now.getTime() + DAY + 1), YAY))
        .to.be.rejectedWith('Poll has closed');
    });

    it('can get the results of a vote', async () => {
      const [ poll ] = await Polls.createPoll(now, DAY);

      await Polls.submitVote(poll.id, RESIDENT1, soon, YAY);
      await Polls.submitVote(poll.id, RESIDENT2, soon, YAY);
      await Polls.submitVote(poll.id, RESIDENT3, soon, NAY);

      const results = await Polls.getPollResults(poll.id);
      expect(results.length).to.equal(3);
    });

    it('can get the result of a vote', async () => {
      const [ poll ] = await Polls.createPoll(now, DAY);

      await Polls.submitVote(poll.id, RESIDENT1, soon, YAY);
      await Polls.submitVote(poll.id, RESIDENT2, soon, YAY);
      await Polls.submitVote(poll.id, RESIDENT3, soon, NAY);

      const { yays, nays } = await Polls.getPollResultCounts(poll.id);
      expect(yays).to.equal(2);
      expect(nays).to.equal(1);
    });
  });
});
