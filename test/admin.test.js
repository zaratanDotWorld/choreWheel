const { expect } = require('chai');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const { sleep, getMonthStart, getMonthEnd, getNextMonthStart, getPrevMonthEnd } = require('../src/utils');
const { db } = require('../src/db');

const Admin = require('../src/modules/admin');

describe('Admin', async () => {
  const HOUSE1 = 'HOUSE1';
  const HOUSE2 = 'HOUSE2';

  const RESIDENT1 = 'RESIDENT1';
  const RESIDENT2 = 'RESIDENT2';

  before(async () => {
    await db('Resident').del();
    await db('House').del();
  });

  afterEach(async () => {
    await db('Resident').del();
    await db('House').del();
  });

  describe('keeping track of houses', async () => {
    it('can add a house', async () => {
      let numHouses;
      numHouses = await Admin.getNumHouses();
      expect(parseInt(numHouses.count)).to.equal(0);

      await Admin.updateHouse({ slackId: HOUSE1 });
      await sleep(5);

      numHouses = await Admin.getNumHouses();
      expect(parseInt(numHouses.count)).to.equal(1);

      await Admin.updateHouse({ slackId: HOUSE2 });
      await sleep(5);

      numHouses = await Admin.getNumHouses();
      expect(parseInt(numHouses.count)).to.equal(2);
    });

    it('can add a house idempotently', async () => {
      let numHouses;
      numHouses = await Admin.getNumHouses();
      expect(parseInt(numHouses.count)).to.equal(0);

      await Admin.updateHouse({ slackId: HOUSE1 });
      await Admin.updateHouse({ slackId: HOUSE2 });
      await sleep(5);

      numHouses = await Admin.getNumHouses();
      expect(parseInt(numHouses.count)).to.equal(2);

      await Admin.updateHouse({ slackId: HOUSE1 });
      await Admin.updateHouse({ slackId: HOUSE2 });
      await sleep(5);

      numHouses = await Admin.getNumHouses();
      expect(parseInt(numHouses.count)).to.equal(2);
    });

    it('can update house info', async () => {
      const choresChannel = 'choresChannel';
      const thingsChannel = 'thingsChannel';

      await Admin.updateHouse({ slackId: HOUSE1, choresChannel: choresChannel });
      await sleep(5);
      await Admin.updateHouse({ slackId: HOUSE1, thingsChannel: thingsChannel });
      await sleep(5);

      const house = await Admin.getHouse(HOUSE1);
      expect(house.choresChannel).to.equal(choresChannel);
      expect(house.thingsChannel).to.equal(thingsChannel);
    });
  });

  describe('keeping track of residents', async () => {
    beforeEach(async () => {
      await Admin.updateHouse({ slackId: HOUSE1 });
      await Admin.updateHouse({ slackId: HOUSE2 });
    });

    it('can add a resident', async () => {
      let residents;
      residents = await Admin.getResidents(HOUSE1);
      expect(residents.length).to.equal(0);

      await Admin.addResident(HOUSE1, RESIDENT1);
      await sleep(5);

      residents = await Admin.getResidents(HOUSE1);
      expect(residents.length).to.equal(1);

      await Admin.addResident(HOUSE1, RESIDENT2);
      await sleep(5);

      residents = await Admin.getResidents(HOUSE1);
      expect(residents.length).to.equal(2);
    });

    it('can add a resident idempotently', async () => {
      let residents;
      residents = await Admin.getResidents(HOUSE1);
      expect(residents.length).to.equal(0);

      await Admin.addResident(HOUSE1, RESIDENT1);
      await Admin.addResident(HOUSE1, RESIDENT1);
      await sleep(5);

      residents = await Admin.getResidents(HOUSE1);
      expect(residents.length).to.equal(1);
    });

    it('can delete a resident', async () => {
      await Admin.addResident(HOUSE1, RESIDENT1);
      await sleep(5);

      let residents;
      residents = await Admin.getResidents(HOUSE1);
      expect(residents.length).to.equal(1);

      await Admin.updateResident(HOUSE1, RESIDENT1, false, '');
      await sleep(5);

      residents = await Admin.getResidents(HOUSE1);
      expect(residents.length).to.equal(0);
    });
  });

  describe('utility functions', async () => {
    it('can manipulate timestamps correctly', async () => {
      const feb1 = new Date(2022, 1, 1);
      const feb14 = new Date(2022, 1, 14);
      const feb28 = new Date(2022, 1, 28);
      const mar1 = new Date(2022, 2, 1);
      const mar15 = new Date(2022, 2, 15);
      const mar31 = new Date(2022, 2, 31);

      expect(getMonthStart(feb1).getTime()).to.equal(feb1.getTime());
      expect(getMonthStart(feb14).getTime()).to.equal(feb1.getTime());
      expect(getMonthStart(feb28).getTime()).to.equal(feb1.getTime());
      expect(getMonthStart(mar1).getTime()).to.equal(mar1.getTime());
      expect(getMonthStart(mar15).getTime()).to.equal(mar1.getTime());
      expect(getMonthStart(mar31).getTime()).to.equal(mar1.getTime());

      expect(getMonthEnd(feb1).getTime()).to.equal(feb28.getTime());
      expect(getMonthEnd(feb14).getTime()).to.equal(feb28.getTime());
      expect(getMonthEnd(feb28).getTime()).to.equal(feb28.getTime());
      expect(getMonthEnd(mar1).getTime()).to.equal(mar31.getTime());
      expect(getMonthEnd(mar15).getTime()).to.equal(mar31.getTime());
      expect(getMonthEnd(mar31).getTime()).to.equal(mar31.getTime());

      expect(getPrevMonthEnd(mar1).getTime()).to.equal(feb28.getTime());
      expect(getPrevMonthEnd(mar15).getTime()).to.equal(feb28.getTime());
      expect(getPrevMonthEnd(mar31).getTime()).to.equal(feb28.getTime());

      expect(getNextMonthStart(feb1).getTime()).to.equal(mar1.getTime());
      expect(getNextMonthStart(feb14).getTime()).to.equal(mar1.getTime());
      expect(getNextMonthStart(feb28).getTime()).to.equal(mar1.getTime());
    });
  });
});
