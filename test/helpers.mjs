import randomstring from 'randomstring';
import { Admin } from '../src/core/index.js';
import { db } from '../src/core/db.js';

export function generateSlackId () {
  return randomstring.generate({
    charset: 'alphanumeric',
    capitalization: 'uppercase',
    length: 11,
  });
}

export async function createActiveUsers (houseId, num, now) {
  for (let i = 0; i < num; i++) {
    const residentId = generateSlackId();
    await Admin.activateResident(houseId, residentId, now);
  }
}

export async function resetDb () {
  await db('ThingProposal').del();
  await db('ThingBuy').del();
  await db('Thing').del();

  await db('ChoreProposal').del();
  await db('ChoreBreak').del();
  await db('ChoreClaim').del();
  await db('ChoreValue').del();
  await db('ChorePref').del();
  await db('Chore').del();

  await db('HeartKarma').del();
  await db('HeartChallenge').del();
  await db('Heart').del();

  await db('PollVote').del();
  await db('Poll').del();

  await db('Resident').del();
  await db('House').del();
}
