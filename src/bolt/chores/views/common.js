const { penaltyIncrement } = require('../../../config');

// Formatting functions

function formatStats (choreStats) {
  const { name, pointsEarned, pointsOwed } = choreStats;
  const status = (pointsOwed - pointsEarned < penaltyIncrement) ? ':white_check_mark:' : ':fire:';
  return `<@${choreStats.slackId}> - ${name} - ${pointsEarned} / ${pointsOwed} ${status}`;
}

function formatTotalStats (choreStats) {
  const totalEarned = choreStats.reduce((acc, cs) => acc + cs.pointsEarned, 0);
  const totalOwed = choreStats.reduce((acc, cs) => acc + cs.pointsOwed, 0);
  const status = (totalOwed - totalEarned < penaltyIncrement) ? ':white_check_mark:' : ':fire:';
  return `*Total - ${totalEarned.toFixed(0)} / ${totalOwed.toFixed(0)} ${status}*`;
}

function formatPointsPerDay (pointsPerDay) {
  const prefix = (pointsPerDay > 0) ? '+' : '';
  return `${prefix}${pointsPerDay.toFixed(1)} pts/day`;
}

function getAchievement (achivementPoints) {
  if (achivementPoints >= 30) {
    return ':fire::fire::fire: ';
  } else if (achivementPoints >= 20) {
    return ':fire::fire: ';
  } else if (achivementPoints >= 10) {
    return ':fire: ';
  } else {
    return '';
  }
}

function getSparkles (monthlyPoints) {
  if (monthlyPoints >= 100) {
    return ':sparkles:';
  } else if (monthlyPoints >= 90) {
    return ':muscle::skin-tone-4:';
  } else {
    return '';
  }
}

// Mapping functions

function mapChores (chores) {
  return chores.map((chore) => {
    return {
      value: JSON.stringify({ id: chore.id, name: chore.name }),
      text: { type: 'plain_text', text: chore.name },
    };
  });
}

function mapChoresValues (chores) {
  return chores.map((chore) => {
    const isSpecial = !chore.name;
    const label = (isSpecial)
      ? `${chore.metadata.name} - ${chore.value} points (special)`
      : `${chore.name} - ${chore.value.toFixed(0)} points`;

    const value = (isSpecial)
      ? JSON.stringify({ choreValueId: chore.id })
      : JSON.stringify({ choreId: chore.id });

    return {
      value,
      text: { type: 'plain_text', text: label },
    };
  });
}

function mapChoreRankings (choreRankings) {
  return choreRankings.map((choreRanking) => {
    return {
      value: JSON.stringify({ choreId: choreRanking.id }),
      text: { type: 'plain_text', text: choreRanking.name },
    };
  });
}

module.exports = {
  formatStats,
  formatTotalStats,
  formatPointsPerDay,
  getAchievement,
  getSparkles,
  mapChores,
  mapChoresValues,
  mapChoreRankings,
};
