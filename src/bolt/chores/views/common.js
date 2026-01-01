const {
  pointsPerResident,
  achievementBase,
  penaltyIncrement,
} = require('../../../config');

const common = require('../../common');

// Docs

exports.DOCS_URL = 'https://docs.chorewheel.zaratan.world/en/latest/tools/chores.html';

// Formatting functions

exports.formatStats = function (stats) {
  const { residentId, pointsEarned, pointsOwed, completionPct } = stats;

  let emoji = '';
  if (pointsEarned >= pointsOwed) {
    emoji = ':star:';
  } else if (pointsOwed - pointsEarned >= penaltyIncrement) {
    emoji = ':broken_heart:';
  }

  return `<@${residentId}> - ${pointsEarned} / ${pointsOwed} (${completionPct * 100}%) ${emoji}`;
};

exports.formatTotalStats = function (stats) {
  const pointsEarned = stats.reduce((sum, stat) => sum + stat.pointsEarned, 0);
  const pointsOwed = stats.reduce((sum, stat) => sum + stat.pointsOwed, 0);
  const completionPct = pointsEarned / pointsOwed;

  return `*Total - ${pointsEarned} / ${pointsOwed} (${completionPct * 100}%)*`;
};

exports.formatPointsPerDay = function (ranking, numResidents) {
  const pointsPerDay = ranking * (pointsPerResident / 30) * numResidents;
  return (pointsPerDay > 5) ? pointsPerDay.toFixed(0) : pointsPerDay.toFixed(1);
};

exports.getAchievement = function (totalPoints) {
  if (totalPoints >= achievementBase * 5 * 5) {
    return ':first_place_medal:';
  } else if (totalPoints >= achievementBase * 5) {
    return ':second_place_medal:';
  } else if (totalPoints >= achievementBase) {
    return ':third_place_medal:';
  } else {
    return '';
  }
};

exports.getSparkles = function (monthlyPoints) {
  const numSparkles = Math.floor(monthlyPoints / (pointsPerResident / 4));
  return ':sparkles:'.repeat(Math.max(numSparkles, 0)); // Handle negative points
};

// Mapping functions

exports.mapChores = function (chores) {
  return chores.map((chore) => {
    return {
      value: JSON.stringify({ id: chore.id }),
      text: common.blockPlaintext(chore.name.slice(0, 60)),
    };
  });
};

exports.mapChoresValues = function (chores) {
  return chores.map((chore) => {
    const name = chore.name || chore.metadata.name;
    return {
      value: JSON.stringify({ choreId: chore.choreId, choreValueId: chore.choreValueId }),
      text: common.blockPlaintext(`${name.slice(0, 60)} - ${chore.value.toFixed(0)} points`),
    };
  });
};

exports.mapChoreRankings = function (choreRankings) {
  return choreRankings.map((chore) => {
    const priority = Math.round(chore.ranking * 1000);
    return {
      value: JSON.stringify({ id: chore.id, name: chore.name, priority }),
      text: common.blockPlaintext(`${chore.name.slice(0, 60)} - ${priority} ppt`),
    };
  });
};
