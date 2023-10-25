const { expect } = require('chai');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const { Polls, Admin } = require('../src/core/index');
const { HOUR, DAY, NAY, YAY, CANCEL } = require('../src/constants');
const { db } = require('../src/core/db');
const testHelpers = require('./helpers');

describe('Polls', async () => {
  const HOUSE = testHelpers.generateSlackId();
  const RESIDENT1 = testHelpers.generateSlackId();
  const RESIDENT2 = testHelpers.generateSlackId();
  const RESIDENT3 = testHelpers.generateSlackId();

  let now;
  let soon;
  let tomorrow;

  beforeEach(async () => {
    now = new Date();
    soon = new Date(now.getTime() + HOUR);
    tomorrow = new Date(now.getTime() + DAY);

    await Admin.addHouse(HOUSE);
    await Admin.activateResident(HOUSE, RESIDENT1, now);
    await Admin.activateResident(HOUSE, RESIDENT2, now);
    await Admin.activateResident(HOUSE, RESIDENT3, now);
  });

  afterEach(async () => {
    await testHelpers.resetDb();
  });

  describe('using polls', async () => {
    it('can create a new poll', async () => {
      let pollCount;
      [ pollCount ] = await db('Poll').count('*');
      expect(parseInt(pollCount.count)).to.equal(0);

      await Polls.createPoll(HOUSE, now, DAY, 1);

      [ pollCount ] = await db('Poll').count('*');
      expect(parseInt(pollCount.count)).to.equal(1);
    });

    it('can vote in a poll', async () => {
      const [ poll ] = await Polls.createPoll(HOUSE, now, DAY, 1);

      await Polls.submitVote(poll.id, RESIDENT1, soon, YAY);

      const votes = await Polls.getPollResults(poll.id);
      expect(votes.length).to.equal(1);
      expect(votes[0].vote).to.be.true;
    });

    it('can update the vote in a poll', async () => {
      const [ poll ] = await Polls.createPoll(HOUSE, now, DAY, 1);

      await Polls.submitVote(poll.id, RESIDENT1, soon, YAY);

      let votes;

      await Polls.submitVote(poll.id, RESIDENT1, soon, NAY);

      votes = await Polls.getPollResults(poll.id);
      expect(votes.length).to.equal(1);
      expect(votes[0].vote).to.be.false;

      await Polls.submitVote(poll.id, RESIDENT1, soon, CANCEL);

      votes = await Polls.getPollResults(poll.id);
      expect(votes.length).to.equal(1);
      expect(votes[0].vote).to.be.null;
    });

    it('cannot vote in a poll if not a member of the house', async () => {
      const house2 = 'house456';
      await Admin.addHouse(house2);

      const [ poll ] = await Polls.createPoll(house2, now, DAY, 1);

      await expect(Polls.submitVote(poll.id, RESIDENT1, soon, YAY))
        .to.be.rejectedWith('Invalid user for poll!');
    });

    it('cannot update the vote in a poll if the poll is closed', async () => {
      const [ poll ] = await Polls.createPoll(HOUSE, now, DAY, 1);

      await expect(Polls.submitVote(poll.id, RESIDENT1, tomorrow, YAY))
        .to.be.rejectedWith('Poll has closed');
    });

    it('can get the results of a vote', async () => {
      const [ poll ] = await Polls.createPoll(HOUSE, now, DAY, 1);

      await Polls.submitVote(poll.id, RESIDENT1, soon, YAY);
      await Polls.submitVote(poll.id, RESIDENT2, soon, YAY);
      await Polls.submitVote(poll.id, RESIDENT3, soon, NAY);

      const results = await Polls.getPollResults(poll.id);
      expect(results.length).to.equal(3);

      const { yays, nays } = await Polls.getPollResultCounts(poll.id);
      expect(yays).to.equal(2);
      expect(nays).to.equal(1);
    });

    it('can close a poll once everyone has voted', async () => {
      const [ poll ] = await Polls.createPoll(HOUSE, now, DAY, 1);

      let endTime;

      await Polls.submitVote(poll.id, RESIDENT1, soon, YAY);

      ({ endTime } = await Polls.getPoll(poll.id));
      expect(endTime.getTime()).to.equal(tomorrow.getTime());

      await Polls.submitVote(poll.id, RESIDENT2, soon, YAY);

      ({ endTime } = await Polls.getPoll(poll.id));
      expect(endTime.getTime()).to.equal(tomorrow.getTime());

      await Polls.submitVote(poll.id, RESIDENT3, soon, YAY);

      ({ endTime } = await Polls.getPoll(poll.id));
      expect(endTime.getTime()).to.equal(soon.getTime());

      const pollResults = await Polls.getPollResults(poll.id);
      expect(pollResults.length).to.equal(3);
    });

    it('can determine if a poll is valid', async () => {
      let poll;

      // Scenario 1: 2 YAY votes required, 2 observed - valid
      [ poll ] = await Polls.createPoll(HOUSE, now, DAY, 2);

      await Polls.submitVote(poll.id, RESIDENT1, soon, YAY);
      await Polls.submitVote(poll.id, RESIDENT3, soon, YAY);

      expect(await Polls.isPollValid(poll.id, tomorrow)).to.be.true;

      // Scenario 2: 3 YAY votes required, 2 observed - invalid
      [ poll ] = await Polls.createPoll(HOUSE, now, DAY, 3);

      await Polls.submitVote(poll.id, RESIDENT1, soon, YAY);
      await Polls.submitVote(poll.id, RESIDENT3, soon, YAY);

      expect(await Polls.isPollValid(poll.id, tomorrow)).to.be.false;

      // Scenario 3: 1 YAY vote required, 1 YAY 1 NAY - invalid
      [ poll ] = await Polls.createPoll(HOUSE, now, DAY, 1);

      await Polls.submitVote(poll.id, RESIDENT1, soon, YAY);
      await Polls.submitVote(poll.id, RESIDENT3, soon, NAY);

      expect(await Polls.isPollValid(poll.id, tomorrow)).to.be.false;
    });

    it('cannot determine if a poll is valid before the poll closes', async () => {
      const [ poll ] = await Polls.createPoll(HOUSE, now, DAY, 2);

      await expect(Polls.isPollValid(poll.id, soon))
        .to.be.rejectedWith('Poll not closed!');
    });

    it('can update a poll metadata', async () => {
      let poll;
      [ poll ] = await Polls.createPoll(HOUSE, now, DAY, 1);
      expect(poll.metadata).to.deep.equal({});

      [ poll ] = await Polls.updateMetadata(poll.id, { foo: 1 });
      expect(poll.metadata.foo).to.equal(1);

      [ poll ] = await Polls.updateMetadata(poll.id, { bar: 2 });
      expect(poll.metadata.foo).to.equal(1);
      expect(poll.metadata.bar).to.equal(2);

      [ poll ] = await Polls.updateMetadata(poll.id, { foo: 3 });
      expect(poll.metadata.foo).to.equal(3);
      expect(poll.metadata.bar).to.equal(2);
    });
  });
});
