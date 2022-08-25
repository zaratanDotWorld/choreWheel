const { expect } = require('chai');
const chai = require('chai');
const BN = require('bn.js');
const bnChai = require('bn-chai');
const chaiAsPromised = require("chai-as-promised");

chai.use(bnChai(BN));
chai.use(chaiAsPromised);

const { USER1, USER2, USER3, DAY, NAY, YAY, CANCEL } = require('./../src/constants');

const { db } = require('./../src/db');
const Hearts = require('./../src/modules/hearts/models');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

describe('Hearts', async () => {

  afterEach(async () => {
    await db('heart_challenge').del();
    await db('heart').del();
  });

  describe('using hearts', async () => {
    it('can generate hearts for users', async () => {
      await Hearts.generateHearts([USER1, USER2], 1);
      await Hearts.generateHearts([USER1], 1);
      await sleep(1);

      const hearts1 = await Hearts.getUserHearts(USER1);
      const hearts2 = await Hearts.getUserHearts(USER2);
      const hearts3 = await Hearts.getUserHearts(USER3);

      expect(hearts1.sum).to.eq.BN(2);
      expect(hearts2.sum).to.eq.BN(1);
      expect(hearts3.sum).to.equal(null)
    });

    it('can aggregate positive and negative hearts', async () => {
      await Hearts.generateHearts([USER1], 2);
      await Hearts.generateHearts([USER1], 1);
      await Hearts.generateHearts([USER1], -2);
      await sleep(1);

      const hearts = await Hearts.getUserHearts(USER1);

      expect(hearts.sum).to.eq.BN(1);
    });

    it('can handle fractional hearts', async () => {
      await Hearts.generateHearts([USER1], 2.5);
      await Hearts.generateHearts([USER1], -.75);
      await sleep(1);

      const hearts = await Hearts.getUserHearts(USER1);

      expect(hearts.sum).to.eq.BN(1.75);
    });
  });

});
