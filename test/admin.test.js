const { expect } = require('chai');
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(chaiAsPromised);

const { sleep } = require('../src/utils');
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

    it('can get house auth info', async () => {
      const authInfo = { token: 'value' };
      await Admin.updateHouse({ slackId: HOUSE1, choresOauth: authInfo });
      await sleep(5);

      const { choresOauth } = await Admin.getHouse(HOUSE1);
      expect(choresOauth.token).to.equal('value');
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
});
