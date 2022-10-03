const { expect } = require('chai');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const { NAY, YAY, DAY, HOUR } = require('../src/constants');
const { sleep } = require('../src/utils');
const { db } = require('../src/db');

const Things = require('../src/modules/things');
const Polls = require('../src/modules/polls');
const Admin = require('../src/modules/admin');

describe.only('Things', async () => {
  const HOUSE = 'house123';

  const RESIDENT1 = 'RESIDENT1';
  const RESIDENT2 = 'RESIDENT2';
  const RESIDENT3 = 'RESIDENT3';

  const PANTRY = 'pantry';
  const SOAP = 'soap';
  const RICE = 'rice';

  let now;
  let soon;
  let tomorrow;

  before(async () => {
    await db('Thing').del();
    await db('Resident').del();
    await db('House').del();

    await Admin.updateHouse({ slackId: HOUSE });
    await Admin.addResident(HOUSE, RESIDENT1);
    await Admin.addResident(HOUSE, RESIDENT2);
    await Admin.addResident(HOUSE, RESIDENT3);

    now = new Date();
    soon = new Date(now.getTime() + HOUR);
    tomorrow = new Date(now.getTime() + DAY);
  });

  afterEach(async () => {
    await db('ThingBuy').del();
    await db('Thing').del();
    await db('PollVote').del();
    await db('Poll').del();
  });

  describe('managing the list', async () => {
    it('can manage items on the list', async () => {
      await Things.updateThing({ houseId: HOUSE, type: PANTRY, name: SOAP, price: 10 });
      await Things.updateThing({ houseId: HOUSE, type: PANTRY, name: RICE, price: 75 });
      await sleep(5);

      let things;
      things = await Things.getThings(HOUSE);
      expect(things.length).to.equal(2);

      await Things.updateThing({ houseId: HOUSE, type: PANTRY, name: SOAP, active: false });
      await Things.updateThing({ houseId: HOUSE, type: PANTRY, name: RICE, price: 20 });
      await sleep(5);

      things = await Things.getThings(HOUSE);
      expect(things.length).to.equal(1);
      expect(things.find(thing => thing.name === RICE).price).to.equal(20);
    });
  });

  describe('buying things from the list', async () => {
    let soap;
    let rice;

    beforeEach(async () => {
      [ soap ] = await Things.updateThing({ houseId: HOUSE, type: PANTRY, name: SOAP, price: 10 });
      [ rice ] = await Things.updateThing({ houseId: HOUSE, type: PANTRY, name: RICE, price: 75 });
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

      await Things.resolveThingBuy(buy.id, tomorrow);
      await sleep(5);

      const balance = await Things.getHouseBalance(HOUSE, tomorrow);
      expect(balance.sum).to.equal(90);

      buy = await Things.getThingBuy(buy.id);
      expect(buy.valid).to.be.true;
      expect(buy.resolvedAt.getTime()).to.equal(tomorrow.getTime());
    });

    it('can reject a buy', async () => {
      await Things.loadHouseAccount(HOUSE, now, 100);
      await sleep(5);

      let [ buy ] = await Things.buyThing(HOUSE, soap.id, RESIDENT1, now, 10);

      await Polls.submitVote(buy.pollId, RESIDENT1, now, YAY);
      await Polls.submitVote(buy.pollId, RESIDENT2, now, NAY);
      await sleep(5);

      await Things.resolveThingBuy(buy.id, tomorrow);
      await sleep(5);

      const balance = await Things.getHouseBalance(HOUSE, tomorrow);
      expect(balance.sum).to.equal(100);

      buy = await Things.getThingBuy(buy.id);
      expect(buy.valid).to.be.false;
      expect(buy.resolvedAt.getTime()).to.equal(tomorrow.getTime());
    });

    it('can negate a buy if quorum is not reached', async () => {
      await Things.loadHouseAccount(HOUSE, now, 100);
      await sleep(5);

      // Need 1 affirmative vote per $50
      let [ buy ] = await Things.buyThing(HOUSE, rice.id, RESIDENT1, now, 75);

      await Polls.submitVote(buy.pollId, RESIDENT1, now, YAY);
      await sleep(5);

      await Things.resolveThingBuy(buy.id, tomorrow);
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

      await Things.resolveThingBuy(buy.id, tomorrow);
      await sleep(5);

      [ buy ] = await Things.resolveThingBuy(buy.id, tomorrow);
      expect(buy).to.be.undefined;
    });
  });
});
