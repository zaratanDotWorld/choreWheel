const { expect } = require('chai');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const { NAY, YAY, HOUR } = require('../src/constants');
const { thingsPollLength } = require('../src/config');
const { sleep } = require('../src/utils');
const { db } = require('../src/db');

const Things = require('../src/modules/things');
const Polls = require('../src/modules/polls');
const Admin = require('../src/modules/admin');

describe('Things', async () => {
  const HOUSE = 'house123';

  const RESIDENT1 = 'RESIDENT1';
  const RESIDENT2 = 'RESIDENT2';
  const RESIDENT3 = 'RESIDENT3';

  const PANTRY = 'pantry';
  const SOAP = 'soap';
  const RICE = 'rice';

  let now;
  let soon;
  let challengeEnd;

  before(async () => {
    await db('Thing').del();
    await db('Resident').del();
    await db('House').del();

    now = new Date();
    soon = new Date(now.getTime() + HOUR);
    challengeEnd = new Date(now.getTime() + thingsPollLength);

    await Admin.updateHouse({ slackId: HOUSE });
    await Admin.addResident(HOUSE, RESIDENT1, now);
    await Admin.addResident(HOUSE, RESIDENT2, now);
    await Admin.addResident(HOUSE, RESIDENT3, now);
  });

  afterEach(async () => {
    await db('ThingBuy').del();
    await db('Thing').del();
    await db('PollVote').del();
    await db('Poll').del();
  });

  describe('managing the list', async () => {
    it('can manage items on the list', async () => {
      const [ soap ] = await Things.updateThing({ houseId: HOUSE, type: PANTRY, name: SOAP, value: 10 });
      await Things.updateThing({ houseId: HOUSE, type: PANTRY, name: RICE, value: 75 });
      await sleep(5);

      let things;
      things = await Things.getThings(HOUSE);
      expect(things.length).to.equal(2);

      await Things.deleteThing(soap.id);
      await Things.updateThing({ houseId: HOUSE, type: PANTRY, name: RICE, value: 20 });
      await sleep(5);

      things = await Things.getThings(HOUSE);
      expect(things.length).to.equal(1);
      expect(things.find(thing => thing.name === RICE).value).to.equal(20);
    });

    it('can get a thing by id', async () => {
      const [ soap ] = await Things.updateThing({ houseId: HOUSE, type: PANTRY, name: SOAP, value: 10 });
      await sleep(5);

      const thing = await Things.getThing(soap.id);
      expect(thing.name).to.equal(soap.name);
    });
  });

  describe('buying things from the list', async () => {
    let soap;
    let rice;

    beforeEach(async () => {
      [ soap ] = await Things.updateThing({ houseId: HOUSE, type: PANTRY, name: SOAP, value: 10 });
      [ rice ] = await Things.updateThing({ houseId: HOUSE, type: PANTRY, name: RICE, value: 75 });
    });

    it('can buy a thing from the list', async () => {
      await Things.loadHouseAccount(HOUSE, now, 100);

      let balance;
      balance = await Things.getHouseBalance(HOUSE, now);
      expect(balance.sum).to.equal(100);

      await Things.buyThing(HOUSE, soap.id, RESIDENT1, now, 10);
      balance = await Things.getHouseBalance(HOUSE, now);
      expect(balance.sum).to.equal(90);
    });

    it('cannot buy a thing with insufficient funds', async () => {
      await expect(Things.buyThing(HOUSE, soap.id, RESIDENT1, now, 10))
        .to.be.rejectedWith('Insufficient funds!');
    });

    it('can affirm a buy', async () => {
      await Things.loadHouseAccount(HOUSE, now, 100);
      await sleep(5);

      let [ buy ] = await Things.buyThing(HOUSE, soap.id, RESIDENT1, now, 10);

      await Polls.submitVote(buy.pollId, RESIDENT1, now, YAY);
      await sleep(5);

      await Things.resolveThingBuy(buy.id, challengeEnd);
      await sleep(5);

      const balance = await Things.getHouseBalance(HOUSE, challengeEnd);
      expect(balance.sum).to.equal(90);

      buy = await Things.getThingBuy(buy.id);
      expect(buy.valid).to.be.true;
      expect(buy.resolvedAt.getTime()).to.equal(challengeEnd.getTime());
    });

    it('can reject a buy', async () => {
      await Things.loadHouseAccount(HOUSE, now, 100);
      await sleep(5);

      let [ buy ] = await Things.buyThing(HOUSE, soap.id, RESIDENT1, now, 10);

      await Polls.submitVote(buy.pollId, RESIDENT1, now, YAY);
      await Polls.submitVote(buy.pollId, RESIDENT2, now, NAY);
      await sleep(5);

      await Things.resolveThingBuy(buy.id, challengeEnd);
      await sleep(5);

      const balance = await Things.getHouseBalance(HOUSE, challengeEnd);
      expect(balance.sum).to.equal(100);

      buy = await Things.getThingBuy(buy.id);
      expect(buy.valid).to.be.false;
      expect(buy.resolvedAt.getTime()).to.equal(challengeEnd.getTime());
    });

    it('can negate a buy if quorum is not reached', async () => {
      await Things.loadHouseAccount(HOUSE, now, 100);
      await sleep(5);

      // Need 1 affirmative vote per $50
      let [ buy ] = await Things.buyThing(HOUSE, rice.id, RESIDENT1, now, 75);

      await Polls.submitVote(buy.pollId, RESIDENT1, now, YAY);
      await sleep(5);

      await Things.resolveThingBuy(buy.id, challengeEnd);
      await sleep(5);

      buy = await Things.getThingBuy(buy.id);
      expect(buy.valid).to.be.false;
    });

    it('cannot resolve a buy before the poll is closed', async () => {
      await Things.loadHouseAccount(HOUSE, now, 100);
      await sleep(5);

      const [ buy ] = await Things.buyThing(HOUSE, soap.id, RESIDENT1, now, 10);

      await expect(Things.resolveThingBuy(buy.id, soon))
        .to.be.rejectedWith('Poll not closed!');
    });

    it('cannot resolve a buy twice', async () => {
      await Things.loadHouseAccount(HOUSE, now, 100);
      await sleep(5);

      let [ buy ] = await Things.buyThing(HOUSE, soap.id, RESIDENT1, now, 10);

      await Polls.submitVote(buy.pollId, RESIDENT1, now, YAY);
      await sleep(5);

      await Things.resolveThingBuy(buy.id, challengeEnd);
      await sleep(5);

      [ buy ] = await Things.resolveThingBuy(buy.id, challengeEnd);
      expect(buy).to.be.undefined;
    });

    it('can resolve buys in bulk', async () => {
      await Things.loadHouseAccount(HOUSE, now, 100);
      await sleep(5);

      const [ thingBuy1 ] = await Things.buyThing(HOUSE, rice.id, RESIDENT1, now, 10);
      const [ thingBuy2 ] = await Things.buyThing(HOUSE, soap.id, RESIDENT1, now, 10);
      const [ thingBuy3 ] = await Things.buyThing(HOUSE, rice.id, RESIDENT1, soon, 10);
      await sleep(5);

      await Polls.submitVote(thingBuy1.pollId, RESIDENT1, now, YAY);
      await sleep(5);

      await Things.resolveThingBuys(HOUSE, challengeEnd);

      const resolvedBuy1 = await Things.getThingBuy(thingBuy1.id);
      expect(resolvedBuy1.valid).to.be.true;
      expect(resolvedBuy1.resolvedAt.getTime()).to.equal(challengeEnd.getTime());

      const resolvedBuy2 = await Things.getThingBuy(thingBuy2.id);
      expect(resolvedBuy2.valid).to.be.false;
      expect(resolvedBuy2.resolvedAt.getTime()).to.equal(challengeEnd.getTime());

      // This buy was not resolved as poll is not yet closed
      const resolvedBuy3 = await Things.getThingBuy(thingBuy3.id);
      expect(resolvedBuy3.valid).to.be.true;
      expect(resolvedBuy3.resolvedAt).to.equal(null);
    });

    it('can get a list of fulfillable buys', async () => {
      await Things.loadHouseAccount(HOUSE, now, 100);
      await sleep(5);

      const [ buy ] = await Things.buyThing(HOUSE, soap.id, RESIDENT1, now, 10);

      await Polls.submitVote(buy.pollId, RESIDENT1, now, YAY);
      await sleep(5);

      let fulfillableBuys;
      fulfillableBuys = await Things.getFulfillableThingBuys(HOUSE, now, challengeEnd);
      expect(fulfillableBuys.length).to.equal(0);

      await Things.resolveThingBuy(buy.id, challengeEnd);
      await sleep(5);

      fulfillableBuys = await Things.getFulfillableThingBuys(HOUSE, now, challengeEnd);
      expect(fulfillableBuys.length).to.equal(1);
    });

    it('can fulfill a buy', async () => {
      await Things.loadHouseAccount(HOUSE, now, 100);
      await sleep(5);

      const [ buy ] = await Things.buyThing(HOUSE, soap.id, RESIDENT1, now, 10);

      await Polls.submitVote(buy.pollId, RESIDENT1, now, YAY);
      await sleep(5);
      await Things.resolveThingBuy(buy.id, challengeEnd);
      await sleep(5);

      const [ fulfilledBuy ] = await Things.fulfillThingBuy(buy.id, RESIDENT2, challengeEnd);
      expect(fulfilledBuy.fulfilledAt.getTime()).to.equal(challengeEnd.getTime());
      expect(fulfilledBuy.fulfilledBy).to.equal(RESIDENT2);
    });
  });
});
