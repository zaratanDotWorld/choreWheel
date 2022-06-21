const { expect } = require('chai');
const chai = require('chai');
const BN = require('bn.js');
const bnChai = require('bn-chai');

chai.use(bnChai(BN));

const chores = require('./../src/modules/chores/models');

describe('Chores', async () => {
  it('can list the existing chores', async () => {
    const allChores = await chores.getChores();

    expect(allChores.length).to.eq.BN(3);
  });

  it('can set and query for the latest chore values', async () => {
    await chores.setChoreValues([{ chore_name: 'dishes', value: 10 }]);
    await chores.setChoreValues([{ chore_name: 'dishes', value: 5 }]);
    await chores.setChoreValues([{ chore_name: 'sweeping', value: 20 }]);

    const now = new Date();
    const endTime = new Date(now.getTime() + 1000);
    const startTime = new Date(now.getTime() - 1000);

    const dishesValue = await chores.getChoreValue('dishes', startTime, endTime);
    expect(dishesValue.sum).to.eq.BN(15);

    const sweepingValue = await chores.getChoreValue('sweeping', startTime, endTime);
    expect(sweepingValue.sum).to.eq.BN(20);
  });
});