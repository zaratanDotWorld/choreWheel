const { expect } = require('chai');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const { Admin } = require('../src/core/index');
const { HOUR, DAY } = require('../src/constants');
const { getMonthStart, getMonthEnd, getNextMonthStart, getPrevMonthEnd, getDateStart } = require('../src/utils');
const testHelpers = require('./helpers');
const { db } = require('../src/core/db');

describe('Admin', async () => {
  const HOUSE1 = testHelpers.generateSlackId();
  const HOUSE2 = testHelpers.generateSlackId();
  const RESIDENT1 = testHelpers.generateSlackId();
  const RESIDENT2 = testHelpers.generateSlackId();

  let now;
  let soon;

  beforeEach(async () => {
    now = new Date();
    soon = new Date(now.getTime() + HOUR);
  });

  afterEach(async () => {
    await testHelpers.resetDb();
  });

  describe('keeping track of houses', async () => {
    it('can add a house', async () => {
      let numHouses;

      [ numHouses ] = await db('House').count('*');
      expect(parseInt(numHouses.count)).to.equal(0);

      await Admin.addHouse(HOUSE1);

      [ numHouses ] = await db('House').count('*');
      expect(parseInt(numHouses.count)).to.equal(1);

      await Admin.addHouse(HOUSE2);

      [ numHouses ] = await db('House').count('*');
      expect(parseInt(numHouses.count)).to.equal(2);
    });

    it('can add a house idempotently', async () => {
      let numHouses;
      [ numHouses ] = await db('House').count('*');
      expect(parseInt(numHouses.count)).to.equal(0);

      await Admin.addHouse(HOUSE1);
      await Admin.addHouse(HOUSE2);

      [ numHouses ] = await db('House').count('*');
      expect(parseInt(numHouses.count)).to.equal(2);

      await Admin.addHouse(HOUSE1);
      await Admin.addHouse(HOUSE2);

      [ numHouses ] = await db('House').count('*');
      expect(parseInt(numHouses.count)).to.equal(2);
    });

    it('can update house info', async () => {
      await Admin.addHouse(HOUSE1);

      const choresChannel = 'choresChannel';
      const thingsChannel = 'thingsChannel';

      await Admin.updateHouse(HOUSE1, { choresChannel });
      await Admin.updateHouse(HOUSE1, { thingsChannel });

      let metadata;

      ({ metadata } = await Admin.getHouse(HOUSE1));
      expect(metadata.choresChannel).to.equal(choresChannel);
      expect(metadata.thingsChannel).to.equal(thingsChannel);

      await Admin.updateHouse(HOUSE1, { thingsChannel: null });

      ({ metadata } = await Admin.getHouse(HOUSE1));
      expect(metadata.choresChannel).to.equal(choresChannel);
      expect(metadata.thingsChannel).to.be.null;
    });
  });

  describe('keeping track of residents', async () => {
    beforeEach(async () => {
      await Admin.addHouse(HOUSE1);
      await Admin.addHouse(HOUSE2);
    });

    it('can activate a resident', async () => {
      let residents;
      residents = await Admin.getResidents(HOUSE1, now);
      expect(residents.length).to.equal(0);

      await Admin.activateResident(HOUSE1, RESIDENT1, now);

      residents = await Admin.getResidents(HOUSE1, now);
      expect(residents.length).to.equal(1);

      await Admin.activateResident(HOUSE1, RESIDENT2, now);

      residents = await Admin.getResidents(HOUSE1, now);
      expect(residents.length).to.equal(2);

      const resident1 = await Admin.getResident(RESIDENT1);
      expect(resident1.activeAt.getTime()).to.equal(now.getTime());
    });

    it('can activate a resident idempotently', async () => {
      let residents;
      residents = await Admin.getResidents(HOUSE1, now);
      expect(residents.length).to.equal(0);

      await Admin.activateResident(HOUSE1, RESIDENT1, now);
      await Admin.activateResident(HOUSE1, RESIDENT1, soon);

      residents = await Admin.getResidents(HOUSE1, now);
      expect(residents.length).to.equal(1);
      expect(residents[0].activeAt.getTime()).to.equal(now.getTime());
    });

    it('can deactivate a resident', async () => {
      await Admin.activateResident(HOUSE1, RESIDENT1, now);

      let residents;
      residents = await Admin.getResidents(HOUSE1, now);
      expect(residents.length).to.equal(1);

      await Admin.deactivateResident(HOUSE1, RESIDENT1);

      residents = await Admin.getResidents(HOUSE1, now);
      expect(residents.length).to.equal(0);

      const resident = await Admin.getResident(RESIDENT1);
      expect(resident.activeAt).to.equal(null);
    });

    it('can exempt a resident', async () => {
      await Admin.activateResident(HOUSE1, RESIDENT1, now);

      let resident;
      resident = await Admin.getResident(RESIDENT1);
      expect(resident.activeAt.getTime()).to.equal(now.getTime());
      expect(resident.exemptAt).to.equal(null);

      await Admin.exemptResident(HOUSE1, RESIDENT1, soon);

      resident = await Admin.getResident(RESIDENT1);
      expect(resident.activeAt.getTime()).to.equal(now.getTime());
      expect(resident.exemptAt.getTime()).to.equal(soon.getTime());

      await Admin.unexemptResident(HOUSE1, RESIDENT1, soon);

      resident = await Admin.getResident(RESIDENT1);
      expect(resident.activeAt.getTime()).to.equal(soon.getTime());
      expect(resident.exemptAt).to.equal(null);
    });

    it('cannot activate a resident if exempt', async () => {
      await Admin.activateResident(HOUSE1, RESIDENT1, now);
      await Admin.exemptResident(HOUSE1, RESIDENT1, soon);
      await Admin.activateResident(HOUSE1, RESIDENT1, soon);

      const resident = await Admin.getResident(RESIDENT1);
      expect(resident.activeAt.getTime()).to.equal(now.getTime());
      expect(resident.exemptAt.getTime()).to.equal(soon.getTime());
    });

    it('can exempt a resident idempotently if prior exemption exists', async () => {
      await Admin.activateResident(HOUSE1, RESIDENT1, now);
      await Admin.exemptResident(HOUSE1, RESIDENT1, now);

      let resident;
      resident = await Admin.getResident(RESIDENT1);
      expect(resident.exemptAt.getTime()).to.equal(now.getTime());

      // Later exemption has no effect
      await Admin.exemptResident(HOUSE1, RESIDENT1, soon);

      resident = await Admin.getResident(RESIDENT1);
      expect(resident.exemptAt.getTime()).to.equal(now.getTime());

      // Earlier exemption overwrites current exemption
      const yesterday = new Date(now.getTime() - DAY);
      await Admin.exemptResident(HOUSE1, RESIDENT1, yesterday);

      resident = await Admin.getResident(RESIDENT1);
      expect(resident.exemptAt.getTime()).to.equal(yesterday.getTime());
    });

    it('can get voting residents', async () => {
      await Admin.activateResident(HOUSE1, RESIDENT1, now);
      await Admin.activateResident(HOUSE1, RESIDENT2, now);

      let votingResidents;
      votingResidents = await Admin.getVotingResidents(HOUSE1, now);
      expect(votingResidents.length).to.equal(2);

      await Admin.exemptResident(HOUSE1, RESIDENT2, soon);

      // Exemption takes effect after exemptAt
      votingResidents = await Admin.getVotingResidents(HOUSE1, now);
      expect(votingResidents.length).to.equal(2);
      votingResidents = await Admin.getVotingResidents(HOUSE1, soon);
      expect(votingResidents.length).to.equal(1);
    });

    it('can handle many exempt users', async () => {
      await Admin.activateResident(HOUSE1, RESIDENT1, now);
      await Admin.activateResident(HOUSE1, RESIDENT2, now);

      let residents;
      let votingResidents;

      residents = await Admin.getResidents(HOUSE1, now);
      votingResidents = await Admin.getVotingResidents(HOUSE1, now);
      expect(residents.length).to.equal(2);
      expect(votingResidents.length).to.equal(2);

      await testHelpers.createExemptUsers(HOUSE1, 10, now);

      residents = await Admin.getResidents(HOUSE1, now);
      votingResidents = await Admin.getVotingResidents(HOUSE1, now);
      expect(residents.length).to.equal(12);
      expect(votingResidents.length).to.equal(2);
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

      expect(getMonthEnd(feb1).getTime()).to.equal(feb28.getTime() + DAY - 1);
      expect(getMonthEnd(feb14).getTime()).to.equal(feb28.getTime() + DAY - 1);
      expect(getMonthEnd(feb28).getTime()).to.equal(feb28.getTime() + DAY - 1);
      expect(getMonthEnd(mar1).getTime()).to.equal(mar31.getTime() + DAY - 1);
      expect(getMonthEnd(mar15).getTime()).to.equal(mar31.getTime() + DAY - 1);
      expect(getMonthEnd(mar31).getTime()).to.equal(mar31.getTime() + DAY - 1);

      expect(getPrevMonthEnd(mar1).getTime()).to.equal(feb28.getTime() + DAY - 1);
      expect(getPrevMonthEnd(mar15).getTime()).to.equal(feb28.getTime() + DAY - 1);
      expect(getPrevMonthEnd(mar31).getTime()).to.equal(feb28.getTime() + DAY - 1);

      expect(getNextMonthStart(feb1).getTime()).to.equal(mar1.getTime());
      expect(getNextMonthStart(feb14).getTime()).to.equal(mar1.getTime());
      expect(getNextMonthStart(feb28).getTime()).to.equal(mar1.getTime());

      expect(getDateStart(now).getHours()).to.equal(0);
      expect(getDateStart(now).getMinutes()).to.equal(0);
      expect(getDateStart(now).getSeconds()).to.equal(0);
    });
  });
});
