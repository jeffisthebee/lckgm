// src/engine/mechanics.js
import { SIM_CONSTANTS, GAME_RULES, SIDES } from '../data/constants';
import { SYNERGIES } from '../data/synergies';
import allMastery from '../data/player_mastery/index';

// --- HELPER LOGIC ---
export const getChampionClass = (champ, position) => {
  if (!champ) return GAME_RULES.DEFAULT_ROLES[position] || '전사';
  const classMapping = {
    'Assassin': '암살자', 'Fighter': '전사', 'Marksman': '원거리',
    'Mage': '마법사', 'Tank': '탱커', 'Support': '서포터',
    '암살자': '암살자', '전사': '전사', '원거리': '원거리',
    '마법사': '마법사', '탱커': '탱커', '서포터': '서포터'
  };
  if (champ.role_detail && classMapping[champ.role_detail]) return classMapping[champ.role_detail];
  if (champ.tags && champ.tags[0] && classMapping[champ.tags[0]]) return classMapping[champ.tags[0]];
  return GAME_RULES.DEFAULT_ROLES[position] || '전사';
};

// --- MASTERY MAP ---
// Built from allMastery which covers LCK + all foreign leagues.
// Each entry: { team, role, name (Korean), id (English), pool: [...] }
// Pool entries: { name (champion), games, winRate, kda, category }
// Strategy: "Season 2025" data overwrites "Career" data for the same champion,
// so recent form is always preferred over historical averages.
export const MASTERY_MAP = (() => {
  const map = {};

  allMastery.forEach(playerEntry => {
    const playerName = playerEntry.name;
    if (!playerName) return;

    const seasonPool = (playerEntry.pool || []).filter(e => e.category === 'Season 2025');
    const careerPool  = (playerEntry.pool || []).filter(e => e.category === 'Career');

    // Build lookup maps by champion name
    const seasonMap = {};
    const careerMap = {};
    seasonPool.forEach(e => { seasonMap[e.name] = e; });
    careerPool.forEach(e => { careerMap[e.name] = e; });

    // Blend Season 2025 (70%) + Career (30%) for champs in both; single-source champs use as-is
    const allChampNames = new Set([...Object.keys(seasonMap), ...Object.keys(careerMap)]);
    const merged = {};
    allChampNames.forEach(champName => {
      const s = seasonMap[champName];
      const c = careerMap[champName];
      if (s && c) {
        merged[champName] = {
          name:     champName,
          games:    Math.round(s.games   * 0.7 + c.games   * 0.3),
          winRate:  parseFloat((s.winRate * 0.7 + c.winRate * 0.3).toFixed(1)),
          kda:      parseFloat((s.kda     * 0.7 + c.kda     * 0.3).toFixed(2)),
          category: 'blended',
          source:   'blended',
        };
      } else if (s) {
        merged[champName] = { ...s, source: 'season' };
      } else {
        merged[champName] = { ...c, source: 'career' };
      }
    });

    map[playerName] = {
      id:   playerEntry.id || playerName,
      team: playerEntry.team,
      role: playerEntry.role,
      pool: Object.values(merged),
    };
  });

  return map;
})();

export function calculateMasteryScore(player, masteryData) {
  if (!masteryData) return player.종합 * 0.8;
  const { games, winRate, kda } = masteryData;
  let baseScore = (winRate * 0.5) + (kda * 10) + 20;
  const volumeBonus = Math.log10(games + 1) * 5;
  return Math.min(100, baseScore + volumeBonus);
}

export function getMetaScore(position, tier, masteryScore) {
  let finalTier = tier;
  if (masteryScore >= SIM_CONSTANTS.OTP_SCORE_THRESHOLD) {
    finalTier = Math.max(1, tier - SIM_CONSTANTS.OTP_TIER_BOOST);
  }
  const t = Math.max(1, Math.min(5, finalTier));
  const coeff = SIM_CONSTANTS.META_COEFF.STANDARD[t];
  return 100 * coeff;
}

export function calculateChampionScore(player, champion, masteryData, fallbackMultiplier = 1.0) {
  const playerStat = player.종합 || 85;
  const rawMasteryScore = calculateMasteryScore(player, masteryData);
  const masteryScore = masteryData ? rawMasteryScore : rawMasteryScore * fallbackMultiplier;
  const metaScore = getMetaScore(player.포지션, champion.tier, masteryScore);
  return (playerStat * SIM_CONSTANTS.WEIGHTS.STATS) +
         (metaScore  * SIM_CONSTANTS.WEIGHTS.META)  +
         (masteryScore * SIM_CONSTANTS.WEIGHTS.MASTERY);
}

export function resolveCombat(powerA, powerB) {
  const avgPowerA = powerA / 5;
  const avgPowerB = powerB / 5;
  const totalAvgPower = avgPowerA + avgPowerB;
  if (totalAvgPower === 0) return Math.random() < 0.5 ? SIDES.BLUE : SIDES.RED;

  let winChanceA = avgPowerA / totalAvgPower;
  const diff = avgPowerA - avgPowerB;
  winChanceA += (diff * 0.020);
  if (winChanceA < 0) winChanceA = 0;
  if (winChanceA > 1) winChanceA = 1;

  return Math.random() < winChanceA ? SIDES.BLUE : SIDES.RED;
}

export function calculateDeathTimer(level, time) {
  let timer = 8 + (level * 1.5);
  if (time > 15) timer += (time - 15) * 0.15;
  if (time > 25) timer += (time - 25) * 0.3;
  if (time > 30) timer += (time - 30) * 0.5;
  if (time > 35) timer += (time - 35) * 0.7;
  return Math.min(150, timer);
}

export function calculateTeamPower(teamPicks, time, activeBuffs, goldDiff, enemyPicks, currentAbsSecond) {
  let totalPower = 0;
  const phaseKey = time >= 26 ? 'LATE' : (time >= 15 ? 'MID' : 'EARLY');
  const weights = GAME_RULES.WEIGHTS.PHASE[phaseKey] || GAME_RULES.WEIGHTS.PHASE.EARLY;
  const positionWeights = SIM_CONSTANTS.POSITION_WEIGHTS[phaseKey];
  let adCount = 0, apCount = 0;

  teamPicks.forEach((pick, idx) => {
    if (!pick || !pick.playerData || pick.deadUntil > currentAbsSecond) return;
    const roleKey = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'][idx] || pick.playerData.포지션;
    const dmgType = pick.dmgType || 'AD';
    if (dmgType === 'AD') adCount++; else if (dmgType === 'AP') apCount++;

    const player = pick.playerData;
    const condition = pick.conditionModifier || 1.0;
    let stabilityPenalty = 1.0;
    if (pick.flashEndTime > time) stabilityPenalty = (roleKey === 'ADC' || roleKey === '원거리') ? 0.75 : 0.8;

    const stats = player.상세 || { 라인전: 80, 무력: 80, 운영: 80, 성장: 80, 한타: 80, 안정성: 80 };
    let effectiveStability = (stats.안정성 || 50) * stabilityPenalty;

    let rawStat =
      ((stats.라인전 || 50) * weights.laning   + (stats.무력 || 50) * weights.mechanics +
       (stats.성장  || 50) * weights.growth    + (stats.운영 || 50) * weights.macro     +
       (stats.한타  || 50) * weights.teamfight + effectiveStability  * weights.stability) * condition;

    const masteryScore = calculateMasteryScore(player, pick.mastery);
    const metaScore    = getMetaScore(player.포지션, pick.tier, masteryScore);

    let combatPower =
      (rawStat      * SIM_CONSTANTS.WEIGHTS.STATS)  +
      (metaScore    * SIM_CONSTANTS.WEIGHTS.META)   +
      (masteryScore * SIM_CONSTANTS.WEIGHTS.MASTERY);

    // Level bonus
    let levelBonus = 0;
    const maxLevelCalc = (pick.role === 'TOP') ? 20 : 18;
    const effectiveLevel = Math.min(pick.level, maxLevelCalc);
    for (let i = 1; i <= effectiveLevel; i++) {
      if      (i <= 5)   levelBonus += 0.0015;
      else if (i === 6)  levelBonus += 0.0030;
      else if (i <= 10)  levelBonus += 0.0015;
      else if (i === 11) levelBonus += 0.00225;
      else if (i <= 15)  levelBonus += 0.0015;
      else if (i === 16) levelBonus += 0.0030;
      else               levelBonus += 0.0015;
    }
    combatPower *= (1 + levelBonus);

    // Gold multiplier
    const currentGold  = pick.currentGold || 500;
    const goldCap      = (pick.role === 'ADC') ? 19000 : 16000;
    const effectiveGold = Math.min(currentGold, goldCap);
    let goldMultiplier  = 1 + (effectiveGold * 0.0000025);
    if (currentGold >= 3500)  goldMultiplier += 0.03;
    if (currentGold >= 6500)  goldMultiplier += 0.06;
    if (currentGold >= 10000) goldMultiplier += 0.10;
    if (currentGold >= 13000) goldMultiplier += 0.15;
    if (currentGold >= 15000) goldMultiplier += 0.20;
    combatPower *= goldMultiplier;

    // Buffs
    Object.entries(activeBuffs.dragonStacks).forEach(([dType, count]) => {
      const buffTable = GAME_RULES.DRAGON_BUFFS[dType];
      if (buffTable && buffTable[pick.classType]) combatPower *= (1 + (buffTable[pick.classType] * count));
    });
    if (activeBuffs.soul) {
      const soulTable = GAME_RULES.DRAGON_SOULS[activeBuffs.soul.type];
      if (soulTable && soulTable[pick.classType]) combatPower *= (1 + soulTable[pick.classType]);
    }
    if (activeBuffs.elder) combatPower *= GAME_RULES.OBJECTIVES.ELDER.combat_bonus;
    if (activeBuffs.baron) combatPower *= GAME_RULES.OBJECTIVES.BARON.combat_bonus;
    if (activeBuffs.grubs > 0) combatPower *= (1 + (0.01 * activeBuffs.grubs));

    const posWeight = positionWeights[roleKey] || 0.2;
    totalPower += (combatPower * posWeight * 5);
  });

  // Synergy bonus
  const activeChampNames = teamPicks.map(p => p.champName || p.name);
  let synergyMultiplier = 1.0;
  SYNERGIES.forEach(syn => {
    if (syn.champions.every(n => activeChampNames.includes(n))) synergyMultiplier *= syn.multiplier;
  });
  totalPower *= synergyMultiplier;

  if (adCount >= 4 || apCount >= 4) totalPower *= (time < 15 ? 1.0 : (time < 28 ? 0.95 : 0.75));
  return totalPower;
}

export function calculateIndividualIncome(pick, time, aliveRatio = 1.0) {
  if (!pick || !pick.playerData) return { gold: 0, xp: 0 };

  let role = pick.playerData.포지션 || 'TOP';
  if      (['원거리', 'BOT', 'ADC'].includes(role)) role = 'ADC';
  else if (['서포터', 'SPT', 'SUP'].includes(role)) role = 'SUP';
  else if (['정글', 'JGL'].includes(role))          role = 'JGL';
  else if (['미드', 'MID'].includes(role))           role = 'MID';
  else                                               role = 'TOP';

  const stats    = pick.playerData.상세 || { 라인전: 50, 무력: 50, 안정성: 50, 성장: 50, 운영: 50, 한타: 50 };
  const BASE_XPM = { TOP: 400, JGL: 360, MID: 400, ADC: 360, SUP: 240 };
  const BASE_GPM = { TOP: 320, JGL: 280, MID: 330, ADC: 360, SUP: 200 };

  let weightedStat = 50;
  if (time < 14) {
    weightedStat = (stats.라인전 * 0.5) + (stats.무력 * 0.3) + (stats.안정성 * 0.2);
  } else if (time <= 25) {
    weightedStat = (stats.성장 * 0.4) + (stats.운영 * 0.4) + (stats.무력 * 0.2);
  } else {
    weightedStat = (stats.한타 * 0.35) + (stats.운영 * 0.35) + (stats.안정성 * 0.3);
  }

  let skillMultiplier = Math.pow(weightedStat / 85, 1.025);
  skillMultiplier = Math.max(0.6, Math.min(1.35, skillMultiplier));

  const goldIncome = BASE_GPM[role] * skillMultiplier;
  const xpIncome   = BASE_XPM[role] * skillMultiplier;
  const variance   = 0.85 + (Math.random() * 0.30);

  return {
    gold: Math.floor(goldIncome * variance * aliveRatio),
    xp:   Math.floor(xpIncome   * variance * aliveRatio)
  };
}