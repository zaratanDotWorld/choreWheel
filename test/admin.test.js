const { expect } = require('chai');
const chai = require('chai');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const chaiAsPromised = require('chai-as-promised');

chai.use(bnChai(BN));
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
    await db('resident').del();
    await db('house').del();
  });

  afterEach(async () => {
    await db('resident').del();
    await db('house').del();
  });

  describe('keeping track of houses', async () => {
    it('can add a house', async () => {
      let houses;
      houses = await Admin.getHouses();
      expect(houses.length).to.be.zero;

      await Admin.addHouse(HOUSE1);
      await sleep(1);

      houses = await Admin.getHouses();
      expect(houses.length).to.eq.BN(1);

      await Admin.addHouse(HOUSE2);
      await sleep(1);

      houses = await Admin.getHouses();
      expect(houses.length).to.eq.BN(2);
    });

    it('can add a house idempotently', async () => {
      let houses;
      houses = await Admin.getHouses();
      expect(houses.length).to.be.zero;

      await Admin.addHouse(HOUSE1);
      await Admin.addHouse(HOUSE2);
      await sleep(1);

      houses = await Admin.getHouses();
      expect(houses.length).to.eq.BN(2);

      await Admin.addHouse(HOUSE1);
      await Admin.addHouse(HOUSE2);
      await sleep(1);

      houses = await Admin.getHouses();
      expect(houses.length).to.eq.BN(2);
    });
  });

  describe('keeping track of residents', async () => {
    beforeEach(async () => {
      await Admin.addHouse(HOUSE1);
      await Admin.addHouse(HOUSE2);
    });

    it('can add a resident', async () => {
      let residents;
      residents = await Admin.getResidents(HOUSE1);
      expect(residents.length).to.be.zero;

      await Admin.addResident(HOUSE1, RESIDENT1);
      await sleep(1);

      residents = await Admin.getResidents(HOUSE1);
      expect(residents.length).to.eq.BN(1);

      await Admin.addResident(HOUSE1, RESIDENT2);
      await sleep(1);

      residents = await Admin.getResidents(HOUSE1);
      expect(residents.length).to.eq.BN(2);
    });

    it('can add a resident idempotently', async () => {
      let residents;
      residents = await Admin.getResidents(HOUSE1);
      expect(residents.length).to.be.zero;

      await Admin.addResident(HOUSE1, RESIDENT1);
      await Admin.addResident(HOUSE1, RESIDENT1);
      await sleep(1);

      residents = await Admin.getResidents(HOUSE1);
      expect(residents.length).to.eq.BN(1);
    });

    it('can delete a resident', async () => {
      await Admin.addResident(HOUSE1, RESIDENT1);
      await sleep(1);

      let residents;
      residents = await Admin.getResidents(HOUSE1);
      expect(residents.length).to.eq.BN(1);

      await Admin.deleteResident(RESIDENT1);
      await sleep(1);

      residents = await Admin.getResidents(HOUSE1);
      expect(residents.length).to.be.zero;
    });
  });
});
