// src/engine/simEngine.js
import { SIM_CONSTANTS, GAME_RULES, SIDES, DRAFT_SEQUENCE, MAP_LANES, championList } from '../data/constants';
import playerList from '../data/players.json';

// --- ROSTER LOGIC ---
export const getTeamRoster = (teamName) => {
  const positions = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];

  if (!Array.isArray(playerList) || playerList.length === 0) {
    return positions.map(pos => ({ 이름: 'Unknown', 포지션: pos, 종합: 70 }));
  }

  let players = playerList.filter(p => p.팀 === teamName);

  if (players.length === 0) {
      const aliases = {
          'GEN': '젠지', 'HLE': '한화', 'T1': '티원', 'KT': '케이티', 
          'DK': '디플러스', 'BNK': '피어엑스', 'NS': '농심', 
          'DRX': '디알엑스', 'BRO': '브리온', 'DNS': '수퍼스'
      };
      const krName = aliases[teamName];
      if (krName) {
         players = playerList.filter(p => p.팀.includes(krName) || (p.팀 === teamName));
      }
  }

  if (!players || players.length === 0) {
    console.warn(`Warning: No players found for team ${teamName}. Using placeholders.`);
    return positions.map(pos => ({
      이름: `${teamName} ${pos}`,
      포지션: pos,
      종합: 75, 
      상세: { 라인전: 75, 무력: 75, 한타: 75, 성장: 75, 안정성: 75, 운영: 75 }
    }));
  }

  return positions.map(pos => {
      const found = players.find(p => p.포지션 === pos || p.포지션 === (pos === 'SUP' ? 'SPT' : pos));
      return found || players[0] || { 이름: 'Unknown', 포지션: pos, 종합: 70 }; 
  });
};

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

const MASTERY_MAP = playerList.reduce((acc, player) => {
    acc[player.이름] = { id: player.이름, pool: [] };
    return acc;
}, {});

function calculateMasteryScore(player, masteryData) {
  if (!masteryData) return player.종합 * 0.8;
  const { games, winRate, kda } = masteryData;
  let baseScore = (winRate * 0.5) + (kda * 10) + 20;
  const volumeBonus = Math.log10(games + 1) * 5;
  return Math.min(100, baseScore + volumeBonus);
}

function getMetaScore(position, tier, masteryScore) {
  let finalTier = tier;
  if (masteryScore >= SIM_CONSTANTS.OTP_SCORE_THRESHOLD) {
    finalTier = Math.max(1, tier - SIM_CONSTANTS.OTP_TIER_BOOST);
  }
  const t = Math.max(1, Math.min(5, finalTier));
  const coeff = SIM_CONSTANTS.META_COEFF.STANDARD[t];
  return 100 * coeff;
}

function calculateChampionScore(player, champion, masteryData) {
  const playerStat = player.종합 || 85; 
  const masteryScore = calculateMasteryScore(player, masteryData);
  const metaScore = getMetaScore(player.포지션, champion.tier, masteryScore);
  return (playerStat * SIM_CONSTANTS.WEIGHTS.STATS) + 
         (metaScore * SIM_CONSTANTS.WEIGHTS.META) + 
         (masteryScore * SIM_CONSTANTS.WEIGHTS.MASTERY);
}

// --- DRAFT LOGIC ---
function selectPickFromTop3(player, availableChampions) {
  const playerData = MASTERY_MAP[player.이름];
  const roleChamps = availableChampions.filter(c => c.role === player.포지션);
  const pool = roleChamps.length > 0 ? roleChamps : availableChampions;

  if (pool.length === 0) return null;

  const scoredChamps = pool.map(champ => {
    const mastery = playerData?.pool?.find(m => m.name === champ.name);
    const score = calculateChampionScore(player, champ, mastery);
    return { ...champ, mastery, score };
  });

  scoredChamps.sort((a, b) => b.score - a.score);
  const top3 = scoredChamps.slice(0, 3);
   
  if (top3.length === 0) return null;

  const totalScore = top3.reduce((sum, c) => sum + c.score, 0);
  let r = Math.random() * totalScore;
   
  for (const champ of top3) {
      if (r < champ.score) return champ;
      r -= champ.score;
  }
  return top3[0];
}

function selectBanFromProbabilities(opponentTeam, availableChampions) {
    let candidates = [];
    opponentTeam.roster.forEach(player => {
        const playerData = MASTERY_MAP[player.이름];
        const roleChamps = availableChampions.filter(c => c.role === player.포지션);
        const scored = roleChamps.map(c => {
             const mastery = playerData?.pool?.find(m => m.name === c.name);
             return { 
                 champ: c, 
                 score: calculateChampionScore(player, c, mastery),
                 player: player
             };
        });
        scored.sort((a,b) => b.score - a.score);
        const top3 = scored.slice(0, 3);
        candidates.push(...top3);
    });

    if (candidates.length === 0) return null;

    const totalChampScore = candidates.reduce((acc, c) => acc + c.score, 0);
    const totalTeamOvr = opponentTeam.roster.reduce((acc, p) => acc + p.종합, 0);

    let weightedCandidates = candidates.map(item => {
        const champRatio = item.score / totalChampScore;
        const playerRatio = item.player.종합 / totalTeamOvr;
        const weight = champRatio + playerRatio;
        return { ...item, weight: weight };
    });

    const totalWeight = weightedCandidates.reduce((acc, c) => acc + c.weight, 0);
    let r = Math.random() * totalWeight;

    for (const item of weightedCandidates) {
        if (r < item.weight) return item.champ;
        r -= item.weight;
    }
    return weightedCandidates[0].champ;
}

export function runDraftSimulation(blueTeam, redTeam, fearlessBans, currentChampionList) {
  let localBans = new Set([...fearlessBans]);
  let picks = { BLUE: {}, RED: {} }; 
  let logs = []; 
  let blueBans = []; 
  let redBans = [];
  let remainingRoles = {
    BLUE: ['TOP', 'JGL', 'MID', 'ADC', 'SUP'],
    RED: ['TOP', 'JGL', 'MID', 'ADC', 'SUP']
  };

  DRAFT_SEQUENCE.forEach(step => {
    const actingTeam = step.side === 'BLUE' ? blueTeam : redTeam;
    const opponentTeam = step.side === 'BLUE' ? redTeam : blueTeam;
    const mySide = step.side;
    const availableChamps = currentChampionList.filter(c => !localBans.has(c.name));

    if (step.type === 'BAN') {
      const banCandidate = selectBanFromProbabilities(opponentTeam, availableChamps);
      
      if (banCandidate) {
        localBans.add(banCandidate.name);
        if (step.side === 'BLUE') blueBans.push(banCandidate.name);
        else redBans.push(banCandidate.name);
        logs.push(`[${step.order}] ${step.label}: 🚫 ${banCandidate.name}`);
      } else {
        logs.push(`[${step.order}] ${step.label}: (없음)`);
      }
    } else { 
      let bestPick = null;
      let bestPickRole = '';
      let roleCandidates = [];
      remainingRoles[mySide].forEach(role => {
          const player = actingTeam.roster.find(p => p.포지션 === role);
          if (player) {
            const candidateChamp = selectPickFromTop3(player, availableChamps);
            if (candidateChamp) {
               roleCandidates.push({ role, champ: candidateChamp, score: candidateChamp.score });
            }
          }
      });
      roleCandidates.sort((a, b) => b.score - a.score);
      const selected = roleCandidates[0];

      if (selected) {
        bestPick = selected.champ;
        bestPickRole = selected.role;
        localBans.add(bestPick.name);
        picks[mySide][bestPickRole] = bestPick;
        remainingRoles[mySide] = remainingRoles[mySide].filter(r => r !== bestPickRole);
        const playerObj = actingTeam.roster.find(p => p.포지션 === bestPickRole);
        const pName = playerObj ? playerObj.이름 : 'Unknown';
        logs.push(`[${step.order}] ${step.label}: ✅ ${bestPick.name} (${pName})`);
      } else {
        logs.push(`[${step.order}] ${step.label}: (랜덤 픽)`);
      }
    }
  });

  const mapPicks = (side, teamRoster) => {
    return ['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(pos => {
      const c = picks[side][pos];
      if (!c) return null;
      const p = teamRoster.find(pl => pl.포지션 === pos);
      return { 
        champName: c.name, tier: c.tier, mastery: c.mastery, 
        playerName: p ? p.이름 : 'Unknown Player', playerOvr: p ? p.종합 : 70
      };
    }).filter(Boolean);
  };

  return {
    picks: { A: mapPicks('BLUE', blueTeam.roster), B: mapPicks('RED', redTeam.roster) },
    bans: { A: blueBans, B: redBans },
    draftLogs: logs,
    fearlessBans: Array.isArray(fearlessBans) ? [...fearlessBans] : (fearlessBans ? [fearlessBans] : []),
    usedChamps: Array.from(localBans).filter(c => !fearlessBans.includes(c))
  };
}

// --- GAME LOGIC ---
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
      ((stats.라인전 || 50) * weights.laning + (stats.무력 || 50) * weights.mechanics +
       (stats.성장 || 50) * weights.growth + (stats.운영 || 50) * weights.macro +
       (stats.한타 || 50) * weights.teamfight + effectiveStability * weights.stability) * condition;

    const masteryScore = calculateMasteryScore(player, pick.mastery);
    const metaScore = getMetaScore(player.포지션, pick.tier, masteryScore);
    
    let combatPower = (rawStat * SIM_CONSTANTS.WEIGHTS.STATS) + (metaScore * SIM_CONSTANTS.WEIGHTS.META) + (masteryScore * SIM_CONSTANTS.WEIGHTS.MASTERY);
    
    // Level & Gold Scaling
    let levelBonus = 0;
    for (let i = 1; i <= pick.level; i++) {
        if (i <= 5) levelBonus += 0.0015; else if (i === 6) levelBonus += 0.0030;
        else if (i <= 10) levelBonus += 0.0015; else if (i === 11) levelBonus += 0.00225;
        else if (i <= 15) levelBonus += 0.0015; else if (i === 16) levelBonus += 0.0030;
        else levelBonus += 0.0015;
    }
    combatPower *= (1 + levelBonus);

    const currentGold = pick.currentGold || 500;
    let goldMultiplier = 1 + (currentGold * 0.0000025); 
    if (currentGold >= 3500) goldMultiplier += 0.03; if (currentGold >= 6500) goldMultiplier += 0.06;  
    if (currentGold >= 9500) goldMultiplier += 0.10; if (currentGold >= 12500) goldMultiplier += 0.15; 
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

  if (adCount >= 4 || apCount >= 4) totalPower *= (time < 15 ? 1.0 : (time < 28 ? 0.95 : 0.75));
  return totalPower;
}

export function resolveCombat(powerA, powerB) {
  const avgPowerA = powerA / 5;
  const avgPowerB = powerB / 5;
  const totalAvgPower = avgPowerA + avgPowerB;
  if (totalAvgPower === 0) return Math.random() < 0.5 ? SIDES.BLUE : SIDES.RED;
  
  let winChanceA = avgPowerA / totalAvgPower;
  const diff = avgPowerA - avgPowerB;
  winChanceA += (diff * 0.02); 
  if (winChanceA < 0) winChanceA = 0;
  if (winChanceA > 1) winChanceA = 1;

  return Math.random() < winChanceA ? SIDES.BLUE : SIDES.RED;
}

export function calculateIndividualIncome(pick, time, aliveRatio = 1.0) {
  if (!pick || !pick.playerData) return { gold: 0, xp: 0 };
  let role = pick.playerData.포지션 || 'TOP';
  if (['원거리', 'BOT', 'ADC'].includes(role)) role = 'ADC';
  else if (['서포터', 'SPT', 'SUP'].includes(role)) role = 'SUP';
  else if (['정글', 'JGL'].includes(role)) role = 'JGL';
  else if (['미드', 'MID'].includes(role)) role = 'MID';
  else role = 'TOP';

  const stats = pick.playerData.상세 || { 라인전: 50, 무력: 50, 안정성: 50, 성장: 50, 운영: 50, 한타: 50 };
  const BASE_GOLD = SIM_CONSTANTS.BASE_INCOME.GOLD;
  const BASE_XP = SIM_CONSTANTS.BASE_INCOME.XP;
  let goldIncome = 0, xpIncome = 0;

  if (time < 14) {
      const gBonus = (stats.라인전 * 0.5 + stats.무력 * 0.3 + stats.안정성 * 0.2) / 5;
      goldIncome = BASE_GOLD[role] + gBonus;
      xpIncome = BASE_XP[role] + gBonus;
  } else if (time <= 25) {
      const gBonus = (stats.성장 * 0.4 + stats.운영 * 0.4 + stats.무력 * 0.2) / 5; 
      goldIncome = BASE_GOLD[role] + gBonus;
      xpIncome = BASE_XP[role] + gBonus;
  } else {
      const gBonus = (stats.한타 * 0.3 + stats.운영 * 0.3 + stats.안정성 * 0.3) / 5;
      goldIncome = BASE_GOLD[role] + gBonus;
      xpIncome = BASE_XP[role] + gBonus;
  }
  const variance = 0.95 + (Math.random() * 0.1); 
  return { gold: Math.floor(goldIncome * variance * aliveRatio), xp: Math.floor(xpIncome * variance * aliveRatio) };
}

function calculateDeathTimer(level, time) {
    let timer = 8 + (level * 1.5);
    if (time > 15) timer += (time - 15) * 0.15;
    if (time > 25) timer += (time - 25) * 0.3;
    if (time > 30) timer += (time - 30) * 0.4; 
    if (time > 35) timer += (time - 35) * 0.5; 
    return Math.min(150, timer);
}
export function runGameTickEngine(teamBlue, teamRed, picksBlue, picksRed, simOptions) {
    let time = 0; 
    let logs = [];
    const { difficulty, playerTeamName } = simOptions;
    let gameOver = false;
    let endAbsSecond = 0;
  
    // 1. Initialize Players with Explicit SIDE property (Using String Literals for Safety)
    picksBlue.forEach(p => {
        p.side = 'BLUE'; 
        p.currentGold = GAME_RULES.GOLD.START;
        p.level = 1;
        p.xp = 0;
        p.deadUntil = 0;
        p.stats = { kills: 0, deaths: 0, assists: 0, damage: 0, takenDamage: 0 };
        p.flashEndTime = 0;
    });
  
    picksRed.forEach(p => {
        p.side = 'RED'; 
        p.currentGold = GAME_RULES.GOLD.START;
        p.level = 1;
        p.xp = 0;
        p.deadUntil = 0;
        p.stats = { kills: 0, deaths: 0, assists: 0, damage: 0, takenDamage: 0 };
        p.flashEndTime = 0;
    });
  
    const simulateDamage = (winnerSide, powerA, powerB, currentAbsTime) => {
        const winningPicks = winnerSide === 'BLUE' ? picksBlue : picksRed;
        const losingPicks = winnerSide === 'BLUE' ? picksRed : picksBlue;
        
        winningPicks.forEach(p => {
           if (p.deadUntil > currentAbsTime) return;
           const dmg = (p.currentGold / 10) + (Math.random() * 500);
           p.stats.damage += dmg;
           const target = losingPicks[Math.floor(Math.random() * losingPicks.length)];
           if (target) target.stats.takenDamage += dmg;
        });
        losingPicks.forEach(p => {
           if (p.deadUntil > currentAbsTime) return;
           const dmg = (p.currentGold / 15) + (Math.random() * 300);
           p.stats.damage += dmg;
           const target = winningPicks[Math.floor(Math.random() * winningPicks.length)];
           if (target) target.stats.takenDamage += dmg;
        });
    };
  
    const getWeightedPlayer = (candidates, type) => {
        if (!candidates || candidates.length === 0) return null;
        
        const weightedCandidates = candidates.map(p => {
            let role = p.playerData.포지션;
            if (['원거리', 'BOT', 'ADC'].includes(role)) role = 'ADC';
            else if (['서포터', 'SPT', 'SUP'].includes(role)) role = 'SUP';
            else if (['정글', 'JGL'].includes(role)) role = 'JGL';
            else if (['미드', 'MID'].includes(role)) role = 'MID';
            else role = 'TOP';
  
            let weight = 10; 
  
            if (type === 'KILL') {
                if (role === 'ADC') weight = 40;
                else if (role === 'MID') weight = 35;
                else if (role === 'TOP') weight = 20;
                else if (role === 'JGL') weight = 15;
                else if (role === 'SUP') weight = 2; 
                weight += ((p.playerData.상세?.무력 || 50) / 10);
            } 
            else if (type === 'ASSIST') {
                if (role === 'SUP') weight = 50;
                else if (role === 'JGL') weight = 30;
                else if (role === 'MID') weight = 15;
                else if (role === 'TOP') weight = 10;
                else if (role === 'ADC') weight = 5;
            }
  
            return { p, weight };
        });
  
        const totalWeight = weightedCandidates.reduce((acc, c) => acc + c.weight, 0);
        let r = Math.random() * totalWeight;
        
        for (const item of weightedCandidates) {
            if (r < item.weight) return item.p;
            r -= item.weight;
        }
        return candidates[0];
    };
  
    const VAR_RANGE_LOCAL = Math.min(SIM_CONSTANTS.VAR_RANGE, 0.06);
  
    // Difficulty Multipliers
    const PLAYER_DIFFICULTY_MULTIPLIERS = {
      easy: 1.1, normal: 1.0, hard: 0.95, insane: 0.90  
    };
  
    const dragonTypes = ['화염', '대지', '바람', '바다', '마법공학', '화학공학'];
    const shuffledDragons = dragonTypes.sort(() => Math.random() - 0.5);
    const firstDragonType = shuffledDragons[0];
    const secondDragonType = shuffledDragons[1];
    const mapElementType = shuffledDragons[2];
    let dragonSpawnCount = 0;
  
    const initLane = () => ({
        tier1: { hp: 100, plates: 6, destroyed: false },
        tier2: { hp: 100, destroyed: false },
        tier3: { hp: 100, destroyed: false },
        inhib: { respawnTime: 0, destroyed: false }
    });
  
    let state = {
      gold: { 'BLUE': GAME_RULES.GOLD.START * 5, 'RED': GAME_RULES.GOLD.START * 5 },
      kills: { 'BLUE': 0, 'RED': 0 },
      structures: {
          'BLUE': { TOP: initLane(), MID: initLane(), BOT: initLane() },
          'RED': { TOP: initLane(), MID: initLane(), BOT: initLane() }
      },
      nexusHealth: { 'BLUE': 100, 'RED': 100 },
      dragons: { 'BLUE': [], 'RED': [] }, 
      grubs: { 'BLUE': 0, 'RED': 0 },
      soul: null,
      baronBuff: { side: null, endTime: 0 },
      elderBuff: { side: null, endTime: 0 },
      nextDragonTimeAbs: GAME_RULES.OBJECTIVES.DRAGON.initial_spawn * 60, 
      nextBaronTimeAbs: GAME_RULES.OBJECTIVES.BARON.spawn * 60,        
      nextElderTimeAbs: Infinity,
    };
  
    const formatTime = (m, s) => `[${m}:${s < 10 ? '0' + s : s}]`;
     
    const grantGoldToPlayer = (teamSide, playerIdx, amount) => {
        let finalAmount = amount;
        const myTeamGold = state.gold[teamSide];
        const enemyTeamGold = state.gold[teamSide === 'BLUE' ? 'RED' : 'BLUE'];
  
        if (enemyTeamGold - myTeamGold >= 5000) {
          finalAmount = Math.floor(amount * 1.15);
        }
  
        const picks = teamSide === 'BLUE' ? picksBlue : picksRed;
        picks[playerIdx].currentGold += finalAmount;
        state.gold[teamSide] += finalAmount;
    };
  
    const grantTeamGold = (teamSide, amountPerPlayer) => {
        let finalAmount = amountPerPlayer;
        const myTeamGold = state.gold[teamSide];
        const enemyTeamGold = state.gold[teamSide === 'BLUE' ? 'RED' : 'BLUE'];
  
        if (enemyTeamGold - myTeamGold >= 5000) {
          finalAmount = Math.floor(amountPerPlayer * 1.15);
        }
  
        const targetPicks = teamSide === 'BLUE' ? picksBlue : picksRed;
        targetPicks.forEach(p => p.currentGold += finalAmount);
        state.gold[teamSide] += (finalAmount * 5);
    };
  
    while (state.nexusHealth['BLUE'] > 0 && state.nexusHealth['RED'] > 0 && time < 70) {
      time++;
      const minuteStartAbs = (time - 1) * 60;
      let minuteEvents = [];
      const addEvent = (second, msg) => {
          const abs = minuteStartAbs + second;
          const mm = Math.floor(abs / 60);
          const ss = abs % 60;
          minuteEvents.push({ sec: second, abs, message: `${formatTime(mm, ss)} ${msg}` });
      };
  
      const processIncome = (picks, teamSide) => {
        picks.forEach(p => {
            const currentAbs = (time - 1) * 60;
            const aliveRatio = p.deadUntil > currentAbs ? 0 : 1.0;
            const income = calculateIndividualIncome(p, time, aliveRatio);
            
            if (time > 0) {
               p.currentGold += income.gold;
               state.gold[teamSide] += income.gold;
            }
            if (p.level < 18) {
              p.xp += income.xp;
              while (p.level < 18) {
                  const requiredXP = 180 + (p.level * 100);
                  if (p.xp >= requiredXP) { p.xp -= requiredXP; p.level++; } else { break; }
              }
          }
        });
      };
  
      processIncome(picksBlue, 'BLUE');
      processIncome(picksRed, 'RED');
  
      // Inhibitor Respawn
      ['BLUE', 'RED'].forEach(side => {
          MAP_LANES.forEach(lane => {
              const inhib = state.structures[side][lane].inhib;
              if (inhib.destroyed && inhib.respawnTime <= time) {
                  inhib.destroyed = false;
                  addEvent(0, `${side === 'BLUE' ? teamBlue.name : teamRed.name}의 ${lane} 억제기가 재생되었습니다.`);
              }
          });
      });
  
      const getActiveBuffs = (side) => ({
        dragonStacks: state.dragons[side].reduce((acc, d) => ({ ...acc, [d]: (acc[d] || 0) + 1 }), {}),
        soul: state.soul?.side === side ? { type: state.soul.type } : null,
        baron: state.baronBuff.side === side && state.baronBuff.endTime >= time,
        elder: state.elderBuff.side === side && state.elderBuff.endTime >= time,
        grubs: state.grubs[side]
      });
  
      let powerBlue = calculateTeamPower(picksBlue, time, getActiveBuffs('BLUE'), 0, picksRed, minuteStartAbs);
      let powerRed = calculateTeamPower(picksRed, time, getActiveBuffs('RED'), 0, picksBlue, minuteStartAbs);
      
      // Penalties & Bonuses
      const applyDeadPenalty = (picks) => {
          const deadCount = picks.filter(p => p.deadUntil > minuteStartAbs).length;
          if (deadCount === 1) return 0.95; 
          if (deadCount === 2) return 0.90; 
          if (deadCount === 3) return 0.75; 
          if (deadCount >= 4) return 0.50;  
          return 1.0;
      };
      powerBlue *= applyDeadPenalty(picksBlue);
      powerRed *= applyDeadPenalty(picksRed);
  
      if (playerTeamName && difficulty) {
          const playerMult = PLAYER_DIFFICULTY_MULTIPLIERS[difficulty] || 1.0;
          if (teamBlue.name === playerTeamName) powerBlue *= playerMult;
          else if (teamRed.name === playerTeamName) powerRed *= playerMult;
      }
      
      powerBlue *= (1 + (Math.random() * VAR_RANGE_LOCAL * 2 - VAR_RANGE_LOCAL));
      powerRed *= (1 + (Math.random() * VAR_RANGE_LOCAL * 2 - VAR_RANGE_LOCAL));
  
      // --- Objectives ---
      if (time === GAME_RULES.OBJECTIVES.GRUBS.time) {
        const winner = resolveCombat(powerBlue, powerRed);
        state.grubs[winner] += GAME_RULES.OBJECTIVES.GRUBS.count;
        grantTeamGold(winner, GAME_RULES.OBJECTIVES.GRUBS.gold / 5); 
        simulateDamage(winner, powerBlue, powerRed, minuteStartAbs + 5);
        addEvent(5, `🐛 ${winner === 'BLUE' ? teamBlue.name : teamRed.name} 공허 유충 처치`);
      }
  
      if (time === GAME_RULES.OBJECTIVES.HERALD.time) {
        const winner = resolveCombat(powerBlue, powerRed);
        grantTeamGold(winner, GAME_RULES.OBJECTIVES.HERALD.gold / 5);
        simulateDamage(winner, powerBlue, powerRed, minuteStartAbs + 0);
        addEvent(0, `👁️ ${winner === 'BLUE' ? teamBlue.name : teamRed.name} 전령 획득`);
      }
  
      // Dragon Spawn Logic
      if ((minuteStartAbs + 59) >= state.nextDragonTimeAbs && !state.soul && state.nextDragonTimeAbs !== Infinity) {
          const minValidSec = (minuteStartAbs < state.nextDragonTimeAbs) ? (state.nextDragonTimeAbs - minuteStartAbs) : 0;
          const eventSec = Math.floor(Math.random() * (60 - minValidSec)) + minValidSec;
          const eventAbsTime = minuteStartAbs + eventSec;
  
          const pBlueObj = calculateTeamPower(picksBlue, time, getActiveBuffs('BLUE'), 0, picksRed, eventAbsTime);
          const pRedObj = calculateTeamPower(picksRed, time, getActiveBuffs('RED'), 0, picksBlue, eventAbsTime);
  
          const winner = resolveCombat(pBlueObj, pRedObj);
          simulateDamage(winner, pBlueObj, pRedObj, eventAbsTime);
  
          let currentDragonName;
          if (dragonSpawnCount === 0) currentDragonName = firstDragonType;
          else if (dragonSpawnCount === 1) currentDragonName = secondDragonType;
          else currentDragonName = mapElementType;
  
          state.dragons[winner].push(currentDragonName);
          grantTeamGold(winner, GAME_RULES.OBJECTIVES.DRAGON.gold / 5);
          dragonSpawnCount++;
  
          let msg = `🐉 ${winner === 'BLUE' ? teamBlue.name : teamRed.name}, ${currentDragonName} 용 처치`;
          if (state.dragons[winner].length === 4) {
              state.soul = { side: winner, type: mapElementType };
              state.nextDragonTimeAbs = Infinity;
              state.nextElderTimeAbs = eventAbsTime + (GAME_RULES.OBJECTIVES.ELDER.spawn_after_soul * 60);
              msg += ` (👑 ${mapElementType} 영혼 획득!)`;
          } else {
              state.nextDragonTimeAbs = eventAbsTime + (GAME_RULES.OBJECTIVES.DRAGON.respawn * 60);
          }
          addEvent(eventSec, msg);
      }
  
      // Baron Spawn Logic
      if ((minuteStartAbs + 59) >= state.nextBaronTimeAbs && !(state.baronBuff.side && state.baronBuff.endTime >= time)) {
        if (Math.random() > 0.6 || time > 30) { 
          const minValidSec = (minuteStartAbs < state.nextBaronTimeAbs) ? (state.nextBaronTimeAbs - minuteStartAbs) : 0;
          const eventSec = Math.floor(Math.random() * (60 - minValidSec)) + minValidSec;
          const eventAbsTime = minuteStartAbs + eventSec;
          const pBlueObj = calculateTeamPower(picksBlue, time, getActiveBuffs('BLUE'), 0, picksRed, eventAbsTime);
          const pRedObj = calculateTeamPower(picksRed, time, getActiveBuffs('RED'), 0, picksBlue, eventAbsTime);
  
          const winner = resolveCombat(pBlueObj * 0.9, pRedObj * 0.9);
          simulateDamage(winner, pBlueObj, pRedObj, eventAbsTime);
          state.baronBuff = { side: winner, endTime: time + GAME_RULES.OBJECTIVES.BARON.duration };
          grantTeamGold(winner, GAME_RULES.OBJECTIVES.BARON.gold / 5);
          state.nextBaronTimeAbs = eventAbsTime + (GAME_RULES.OBJECTIVES.DRAGON.respawn * 60); 
          addEvent(eventSec, `🟣 ${winner === 'BLUE' ? teamBlue.name : teamRed.name} 내셔 남작 처치!`);
        }
      }
  
      // Elder Dragon Logic
      if ((minuteStartAbs + 59) >= state.nextElderTimeAbs && !(state.elderBuff.side && state.elderBuff.endTime >= time)) {
          const minValidSec = (minuteStartAbs < state.nextElderTimeAbs) ? (state.nextElderTimeAbs - minuteStartAbs) : 0;
          const eventSec = Math.floor(Math.random() * (60 - minValidSec)) + minValidSec;
          const eventAbsTime = minuteStartAbs + eventSec;
          const pBlueObj = calculateTeamPower(picksBlue, time, getActiveBuffs('BLUE'), 0, picksRed, eventAbsTime);
          const pRedObj = calculateTeamPower(picksRed, time, getActiveBuffs('RED'), 0, picksBlue, eventAbsTime);
  
          const winner = resolveCombat(pBlueObj, pRedObj);
          simulateDamage(winner, pBlueObj, pRedObj, eventAbsTime);
          state.elderBuff = { side: winner, endTime: time + GAME_RULES.OBJECTIVES.ELDER.duration };
          state.nextElderTimeAbs = eventAbsTime + (GAME_RULES.OBJECTIVES.ELDER.spawn_after_soul * 60); 
          addEvent(eventSec, `🐲 ${winner === 'BLUE' ? teamBlue.name : teamRed.name} 장로 드래곤 처치!`);
      }
  
      // --- Combat Logic ---
      const powerDiffRatio = Math.abs(powerBlue - powerRed) / ((powerBlue + powerRed) / 2);
      let combatChance = 0;
      if (time <= 4) combatChance = 0.05;
      else if (time <= 7) combatChance = 0.40;
      else if (time <= 13) combatChance = 0.20;
      else if (time === 14) combatChance = 0.50;
      else if (time <= 19) combatChance = 0.30;
      else combatChance = 0.25; 
  
      const isBaronActive = (state.baronBuff.side === 'BLUE' || state.baronBuff.side === 'RED') && state.baronBuff.endTime >= time;
      const isElderActive = (state.elderBuff.side === 'BLUE' || state.elderBuff.side === 'RED') && state.elderBuff.endTime >= time;
      const isDragonSpawning = (minuteStartAbs + 59) >= state.nextDragonTimeAbs;
  
      if (isBaronActive) combatChance = 0.70;
      if (state.soul) combatChance = 0.75;
      if (isElderActive) combatChance = 1.0; 
      if (isDragonSpawning) combatChance = 0.40;
  
      if (Math.random() < combatChance) {
        const combatSec = Math.floor(Math.random() * 45);
        const combatAbsTime = minuteStartAbs + combatSec;
  
        const pBlueCombat = calculateTeamPower(picksBlue, time, getActiveBuffs('BLUE'), 0, picksRed, combatAbsTime);
        const pRedCombat = calculateTeamPower(picksRed, time, getActiveBuffs('RED'), 0, picksBlue, combatAbsTime);
        
        const winner = resolveCombat(pBlueCombat, pRedCombat);
        const loser = winner === 'BLUE' ? 'RED' : 'BLUE';
        const winnerName = winner === 'BLUE' ? teamBlue.name : teamRed.name;
        
        let combatOccurred = true;
        simulateDamage(winner, pBlueCombat, pRedCombat, combatAbsTime);
        
        const winningTeamPicks = winner === 'BLUE' ? picksBlue : picksRed;
        
        // [FIX] Correctly select the Losing Team's picks (Previously selected the same team as winner)
        const losingTeamPicks = winner === 'BLUE' ? picksRed : picksBlue;
        
        let maxKills = 1;
        const roll = Math.random(); 
        if (roll > 0.99) maxKills = 5;      
        else if (roll > 0.96) maxKills = 4; 
        else if (roll > 0.91) maxKills = 3; 
        else if (roll > 0.71) maxKills = 2; 
        else maxKills = 1;
        
        const getAlivePlayers = (picks) => picks.filter(p => p.deadUntil <= combatAbsTime);
        let killCount = 0;
        
        // Pick ONE main killer for the sequence
        let aliveWinners = getAlivePlayers(winningTeamPicks);
        const killer = getWeightedPlayer(aliveWinners, 'KILL');
  
        for(let k=0; k<maxKills; k++) {
            const aliveLosers = getAlivePlayers(losingTeamPicks);
            
            // [CRITICAL FIX] Ensure strict side filtering for victim using String literals
            const validVictims = aliveLosers.filter(v => v.side && killer && v.side !== killer.side);
            
            if (!killer || validVictims.length === 0) break;
  
            const victim = validVictims[Math.floor(Math.random() * validVictims.length)];
            
            if (victim) {
                killCount++;
                state.kills[winner]++;
                killer.stats.kills++;
                victim.stats.deaths++;
                
                const deathTime = calculateDeathTimer(victim.level, time);
                victim.deadUntil = combatAbsTime + deathTime;
  
                grantGoldToPlayer(winner, winningTeamPicks.indexOf(killer), GAME_RULES.GOLD.KILL);
  
                // Assists (Strictly from winning team AND same side as killer)
                let assistCount = Math.floor(Math.random() * 3) + 1; 
                const assistCandidates = getAlivePlayers(winningTeamPicks)
                    .filter(p => p.playerName !== killer.playerName && p.side === killer.side); // Strict Side Check
                
                const assistNames = [];
                for (let a = 0; a < assistCount && assistCandidates.length > 0; a++) {
                    const assister = getWeightedPlayer(assistCandidates, 'ASSIST');
                    if (assister && !assistNames.includes(assister.playerName)) {
                        assister.stats.assists++;
                        grantGoldToPlayer(winner, (winningTeamPicks.indexOf(assister)), GAME_RULES.GOLD.ASSIST);
                        assistNames.push(assister.playerName);
                    }
                }
  
                let flashMsg = '';
                if (Math.random() < 0.35 && killer.flashEndTime <= time) { killer.flashEndTime = time + 5; flashMsg = ' (⚡점멸 소모)'; }
                if (Math.random() < 0.35 && victim.flashEndTime <= time) { victim.flashEndTime = time + 5; }
  
                const killerChamp = killer.champName || 'Unknown';
                const victimChamp = victim.champName || 'Unknown';
                const assistText = assistNames.length > 0 ? ` | assists: ${assistNames.join(', ')}` : '';
                
                let multiKillLabel = '';
                if (killCount === 2) multiKillLabel = ' [더블 킬!]';
                if (killCount === 3) multiKillLabel = ' [트리플 킬!]';
                if (killCount === 4) multiKillLabel = ' [쿼드라 킬!]';
                if (killCount === 5) multiKillLabel = ' [펜타 킬!]';
  
                const killMsg = `⚔️ [${killer.playerData.포지션}] ${killer.playerName} (${killerChamp}) ➜ ☠️ [${victim.playerData.포지션}] ${victim.playerName} (${victimChamp})${assistText}${flashMsg}${multiKillLabel}`;
                addEvent(combatSec + k, killMsg);
            }
        }
        
        // Counter Kill Chance (Only if not a wipe)
        if (killCount < 3 && Math.random() < 0.35) {
            const aliveLosers = getAlivePlayers(losingTeamPicks);
            const aliveWinners = getAlivePlayers(winningTeamPicks);
            
            if (aliveLosers.length > 0 && aliveWinners.length > 0) {
                const counterKiller = getWeightedPlayer(aliveLosers, 'KILL');
                
                // [CRITICAL FIX] Counter victim must be from winning team & OPPOSITE side
                const validCounterVictims = aliveWinners.filter(v => v.side && counterKiller && v.side !== counterKiller.side);
                const counterVictim = validCounterVictims[Math.floor(Math.random() * validCounterVictims.length)];
                
                if (counterKiller && counterVictim) {
                    state.kills[loser] += 1; // Update score
                    counterKiller.stats.kills += 1;
                    counterVictim.stats.deaths += 1;
                    const cDeathTime = calculateDeathTimer(counterVictim.level, time);
                    counterVictim.deadUntil = combatAbsTime + cDeathTime;
  
                    grantGoldToPlayer(loser, losingTeamPicks.indexOf(counterKiller), GAME_RULES.GOLD.KILL + GAME_RULES.GOLD.ASSIST);
                    const ckillerChamp = counterKiller.champName || 'Unknown';
                    const cvictimChamp = counterVictim.champName || 'Unknown';
                    const counterMsg = `🛡️ [${counterKiller.playerData.포지션}] ${counterKiller.playerName} (${ckillerChamp}) ➜ ☠️ [${counterVictim.playerData.포지션}] ${counterVictim.playerName} (${cvictimChamp}) (반격)`;
                    addEvent(combatSec + 2, counterMsg);
                }
            }
        }
  
          let pushBaseSec = combatOccurred ? combatSec + 5 : Math.floor(Math.random() * 50);
          if (pushBaseSec > 59) pushBaseSec = 59;
  
          let targetLanes = [MAP_LANES[Math.floor(Math.random() * MAP_LANES.length)]];
          if (state.baronBuff.side === winner) targetLanes = MAP_LANES;
  
          targetLanes.forEach((lane, idx) => {
              let currentPushSec = pushBaseSec + (idx * 3); 
              if (currentPushSec > 59) currentPushSec = 59;
  
              const pushAbsTime = minuteStartAbs + currentPushSec;
              const enemyLane = state.structures[loser][lane];
              let pushPower = 1.0 + (powerDiffRatio * 2); 
              if (state.baronBuff.side === winner) pushPower += 1.0;
              if (state.elderBuff.side === winner) pushPower += 2.0;
              
              let lanerIdx = 0; 
              if (lane === 'MID') lanerIdx = 2;
              if (lane === 'BOT') lanerIdx = 3; 
  
              if (!enemyLane.tier1.destroyed) {
                  if (time >= GAME_RULES.OBJECTIVES.PLATES.start_time && time < GAME_RULES.OBJECTIVES.PLATES.end_time) {
                      if (Math.random() < 0.4 * pushPower) {
                           if (enemyLane.tier1.plates > 0) {
                               enemyLane.tier1.plates--;
                               grantGoldToPlayer(winner, lanerIdx, GAME_RULES.GOLD.TURRET.OUTER_PLATE.local);
                               grantTeamGold(winner, GAME_RULES.GOLD.TURRET.OUTER_PLATE.team);
                               
                               const plateCount = 6 - enemyLane.tier1.plates;
                               let plateMsg = `💰 ${winnerName}, ${lane} 포탑 방패 채굴 (${plateCount}/6)`;
                               if (enemyLane.tier1.plates === 0) {
                                   enemyLane.tier1.destroyed = true;
                                   plateMsg = `💥 ${winnerName}, ${lane} 1차 포탑 파괴 (모든 방패 파괴)`;
                               }
                               addEvent(currentPushSec, plateMsg);
                           }
                      }
                  } else if (time >= GAME_RULES.OBJECTIVES.PLATES.end_time) {
                      if (Math.random() < 0.3 * pushPower) {
                          enemyLane.tier1.destroyed = true;
                          grantGoldToPlayer(winner, lanerIdx, 300); 
                          grantTeamGold(winner, 50);
                          addEvent(currentPushSec, `💥 ${winnerName}, ${lane} 1차 포탑 파괴`);
                      }
                  }
              } else if (!enemyLane.tier2.destroyed) {
                  if (Math.random() < 0.25 * pushPower) {
                      enemyLane.tier2.destroyed = true;
                      let localG = lane === 'MID' ? GAME_RULES.GOLD.TURRET.INNER_MID.local : GAME_RULES.GOLD.TURRET.INNER_SIDE.local;
                      let teamG = lane === 'MID' ? GAME_RULES.GOLD.TURRET.INNER_MID.team : GAME_RULES.GOLD.TURRET.INNER_SIDE.team;
                      grantGoldToPlayer(winner, lanerIdx, localG);
                      grantTeamGold(winner, teamG);
                      addEvent(currentPushSec, `💥 ${winnerName}, ${lane} 2차 포탑 파괴`);
                  }
              } else if (!enemyLane.tier3.destroyed) {
                  if (Math.random() < 0.2 * pushPower) {
                      enemyLane.tier3.destroyed = true;
                      grantGoldToPlayer(winner, lanerIdx, GAME_RULES.GOLD.TURRET.INHIB_TURRET.local);
                      grantTeamGold(winner, GAME_RULES.GOLD.TURRET.INHIB_TURRET.team);
                      addEvent(currentPushSec, `🚨 ${winnerName}, ${lane} 3차(억제기) 포탑 파괴`);
                  }
              } else if (!enemyLane.inhib.destroyed) {
                  if (Math.random() < 0.3 * pushPower) {
                      enemyLane.inhib.destroyed = true;
                      enemyLane.inhib.respawnTime = time + 5;
                      grantTeamGold(winner, 10);
                      addEvent(currentPushSec, `🚧 ${winnerName}, ${lane} 억제기 파괴! 슈퍼 미니언 생성`);
                  }
              } else {
                  if (Math.random() < 0.2 * pushPower) {
                      let dmg = 10 + (powerDiffRatio * 100);
                      if (state.baronBuff.side === winner) dmg *= 1.5;
                      if (state.elderBuff.side === winner) dmg *= 2.0;
                      
                      state.nexusHealth[loser] -= dmg;
                       if (state.nexusHealth[loser] <= 0) {
                           const nexusAbs = pushAbsTime;
                           addEvent(currentPushSec, `👑 ${winnerName}이(가) 넥서스를 파괴합니다! GG`);
                           gameOver = true;
                           endAbsSecond = nexusAbs;
                       } else if (Math.random() < 0.5) {
                           addEvent(currentPushSec, `${winnerName}, 쌍둥이 포탑 및 넥서스 타격 중...`);
                       }
                  }
              }
          });
      }
  
      minuteEvents.sort((a, b) => a.abs - b.abs);
      
      if (gameOver) {
          minuteEvents = minuteEvents.filter(e => e.abs <= endAbsSecond);
          minuteEvents.forEach(evt => logs.push(evt));
          break;
      }
  
      minuteEvents.forEach(evt => logs.push(evt));
    }
  
    const winnerSide = state.nexusHealth['BLUE'] > state.nexusHealth['RED'] ? 'BLUE' : 'RED';
    const winnerName = winnerSide === 'BLUE' ? teamBlue.name : teamRed.name;
  
    const totalSeconds = gameOver ? endAbsSecond : (time * 60);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const finalTimeStr = formatTime(totalMinutes, totalSeconds % 60);
  
    logs.sort((a, b) => a.abs - b.abs);
    const finalLogStrings = logs.map(l => l.message);
  
    return {
      winnerName: winnerName,
      winnerSide: winnerSide,
      gameTime: `${totalMinutes}분 ${totalSeconds % 60}초`,
      totalMinutes: totalMinutes,
      totalSeconds,
      endSecond: totalSeconds % 60,
      gameOver,
      finalTimeStr,
      logs: finalLogStrings,
      finalKills: state.kills,
    };
  }

  export function simulateSet(teamBlue, teamRed, setNumber, fearlessBans, simOptions) {
    const { currentChampionList } = simOptions;
    
    // 1. Run Draft
    const draftResult = runDraftSimulation(teamBlue, teamRed, fearlessBans || [], currentChampionList || championList);
  
    // 2. Validate Draft Result (Safety Check)
    if (!draftResult || !draftResult.picks || !Array.isArray(draftResult.picks.A) || !Array.isArray(draftResult.picks.B) ||
        draftResult.picks.A.length < 5 || draftResult.picks.B.length < 5) {
      console.warn('simulateSet: incomplete or invalid draftResult — returning safe fallback', { draftResult });
      return {
        winnerName: null,
        resultSummary: 'Draft incomplete — set aborted',
        picks: { A: draftResult?.picks?.A || [], B: draftResult?.picks?.B || [] },
        bans: draftResult?.bans || { A: [], B: [] },
        logs: draftResult?.draftLogs || [],
        usedChamps: draftResult?.usedChamps || [],
        score: { [teamBlue?.name || 'A']: '0', [teamRed?.name || 'B']: '0' },
        gameResult: null,
        totalMinutes: 0,
        totalSeconds: 0,
        endSecond: 0,
        gameOver: true,
        finalTimeStr: '0:00',
        playersLevelProgress: [],
        fearlessBans: draftResult?.fearlessBans || (Array.isArray(fearlessBans) ? [...fearlessBans] : (fearlessBans ? [fearlessBans] : []))
      };
    }
  
    const getConditionModifier = (player) => {
        if (!player) return 1.0;
        const stability = player.상세?.안정성 || 50;
        const variancePercent = ((100 - stability) / stability) * 10; 
        const fluctuation = (Math.random() * variancePercent * 2) - variancePercent;
        return 1 + (fluctuation / 100);
    };
  
    // 3. Enrich Picks with Data (CRITICAL FIX: Safety Checks Added)
    const addPlayerData = (picks, roster) => {
        return picks.map(p => {
            // Safe lookup
            const playerData = roster.find(player => player && player.이름 === p.playerName);
            const champData = (currentChampionList || championList).find(c => c.name === p.champName);
  
            // Fallback if data is missing (Prevents White Screen Crash)
            if (!playerData || !champData) {
              console.warn(`Missing data for player/champ: ${p.playerName} / ${p.champName}`);
              return {
                ...p,
                dmgType: 'AD',
                classType: '전사',
                playerData: playerData || { 이름: p.playerName, 포지션: 'TOP', 상세: { 안정성: 50 }, 종합: 70 },
                conditionModifier: 1.0,
                stats: { kills: 0, deaths: 0, assists: 0, damage: 0, takenDamage: 0 },
                currentGold: 500,
                level: 1
              };
            }
  
            return {
                ...p,
                ...champData,
                dmgType: champData.dmg_type || 'AD', 
                classType: getChampionClass(champData, playerData.포지션),
                playerData: playerData,
                conditionModifier: getConditionModifier(playerData)
            };
        });
    };
  
    const picksBlue_detailed = addPlayerData(draftResult.picks.A, teamBlue.roster);
    const picksRed_detailed = addPlayerData(draftResult.picks.B, teamRed.roster);
  
    // 4. Run Game Engine
    const gameResult = runGameTickEngine(teamBlue, teamRed, picksBlue_detailed, picksRed_detailed, simOptions);
  
    const usedChamps = [...draftResult.picks.A.map(p => p.champName), ...draftResult.picks.B.map(p => p.champName)];
    const scoreBlue = gameResult.finalKills[SIDES.BLUE];
    const scoreRed = gameResult.finalKills[SIDES.RED];
     
    const winningPicks = gameResult.winnerSide === SIDES.BLUE ? picksBlue_detailed : picksRed_detailed;
     
    // Calculate POG
    const candidates = winningPicks.map(p => {
        const k = p.stats.kills;
        const d = p.stats.deaths === 0 ? 1 : p.stats.deaths;
        const a = p.stats.assists;
        const kda = (k + a) / d;
        
        const gold = p.currentGold;
        const role = p.playerData.포지션;
        
        const dpm = p.stats.damage / (gameResult.totalMinutes || 1); // Avoid division by zero
  
        let pogScore = (kda * 3) + (dpm / 100) + (gold / 1000) + (a * 1);
        
        if (role === 'JGL' || role === '정글') pogScore *= 1.15;
        if (role === 'SUP' || role === '서포터') pogScore *= 1.05;
  
        return { ...p, kdaVal: kda, pogScore: pogScore, dpm: dpm };
    });
  
    candidates.sort((a, b) => b.pogScore - a.pogScore);
    const pogPlayer = candidates[0];
  
    const resultSummary = `⏱️ ${gameResult.gameTime} | ⚔️ ${teamBlue.name} ${scoreBlue} : ${scoreRed} ${teamRed.name} | 🏆 승리: ${gameResult.winnerName}`;
    const pogText = pogPlayer ? `🏅 POG: [${pogPlayer.playerData.포지션}] ${pogPlayer.playerName} (${pogPlayer.champName}) - Score: ${pogPlayer.pogScore.toFixed(1)}` : 'POG 선정 실패';
  
    const finalLogs = [
      `========== [ 밴픽 단계 ] ==========`,
      ...draftResult.draftLogs,
      `========== [ 경기 결과 ] ==========`,
      resultSummary,
      pogText,
      pogPlayer ? `KDA: ${pogPlayer.stats.kills}/${pogPlayer.stats.deaths}/${pogPlayer.stats.assists} | DPM: ${Math.floor(pogPlayer.dpm)} | LV: ${pogPlayer.level}` : '',
      `===================================`,
      ...gameResult.logs
    ];
  
    const playersLevelProgress = [...picksBlue_detailed, ...picksRed_detailed].map(p => ({
      playerName: p.playerName,
      startLevel: 1,
      endLevel: p.level || 1
    }));
  
    return {
      winnerName: gameResult.winnerName,
      resultSummary: resultSummary + ' ' + pogText,
      picks: draftResult.picks,
      bans: draftResult.bans,
      logs: finalLogs,
      usedChamps: usedChamps,
      score: { 
          [teamBlue.name]: String(scoreBlue), 
          [teamRed.name]: String(scoreRed) 
      },
      gameResult,
      totalMinutes: gameResult.totalMinutes,
      totalSeconds: gameResult.totalSeconds,
      endSecond: gameResult.endSecond,
      gameOver: gameResult.gameOver,
      finalTimeStr: gameResult.finalTimeStr,
      playersLevelProgress,
      fearlessBans: draftResult.fearlessBans || (Array.isArray(fearlessBans) ? [...fearlessBans] : (fearlessBans ? [fearlessBans] : []))
    };
  }

  export function simulateMatch(teamA, teamB, format = 'BO3', simOptions) {
    const targetWins = format === 'BO5' ? 3 : 2;
    let winsA = 0;
    let winsB = 0;
    let currentSet = 1;
    let globalBanList = [];
    let matchHistory = [];
  
    while (winsA < targetWins && winsB < targetWins) {
      const currentFearlessBans = [...globalBanList];
      const blueTeam = currentSet % 2 !== 0 ? teamA : teamB;
      const redTeam = currentSet % 2 !== 0 ? teamB : teamA;
  
      const setResult = simulateSet(blueTeam, redTeam, currentSet, currentFearlessBans, simOptions);
      
      if (setResult.winnerName === teamA.name) winsA++;
      else winsB++;
  
      const scoreA = setResult.score[teamA.name];
      const scoreB = setResult.score[teamB.name];
  
      matchHistory.push({
        setNumber: currentSet,
        winner: setResult.winnerName,
        picks: blueTeam.name === teamA.name ? setResult.picks : { A: setResult.picks.B, B: setResult.picks.A },
        bans: blueTeam.name === teamA.name ? setResult.bans : { A: setResult.bans.B, B: setResult.bans.A },
        fearlessBans: currentFearlessBans,
        logs: setResult.logs,
        resultSummary: setResult.resultSummary,
        scores: { A: scoreA, B: scoreB }
      });
  
      globalBanList = [...globalBanList, ...setResult.usedChamps];
      currentSet++;
    }
  
    const finalWinner = winsA > winsB ? teamA : teamB;
    const finalLoser = winsA > winsB ? teamB : teamA;
  
    return {
      winner: finalWinner.name,
      loser: finalLoser.name,
      scoreA: winsA,
      scoreB: winsB,
      scoreString: `${winsA}:${winsB}`,
      history: matchHistory 
    };
  }

  export const generateSchedule = (baronIds, elderIds) => {
    const week1Days = ['1.14 (수)', '1.15 (목)', '1.16 (금)', '1.17 (토)', '1.18 (일)'];
    const week2Days = ['1.21 (수)', '1.22 (목)', '1.23 (금)', '1.24 (토)', '1.25 (일)'];
    
    const shuffledElder = [...elderIds].sort(() => Math.random() - 0.5);
    let allMatches = [];
     
    for (let i = 0; i < 5; i++) {
      const baronTeam = baronIds[i];
      const skipElderTeam = shuffledElder[i]; 
      for (let j = 0; j < 5; j++) {
        const elderTeam = elderIds[j];
        if (elderTeam !== skipElderTeam) {
          allMatches.push({ id: Date.now() + Math.random(), t1: baronTeam, t2: elderTeam, type: 'regular', status: 'pending', format: 'BO3' });
        }
      }
    }
  
    const attemptFullSchedule = () => {
      const pool = [...allMatches].sort(() => Math.random() - 0.5);
      let week1Matches = [], week2Matches = [];
      const counts = {};
       
      for (const m of pool) {
        const c1 = counts[m.t1] || 0;
        const c2 = counts[m.t2] || 0;
        if (week1Matches.length < 10 && c1 < 2 && c2 < 2) {
          week1Matches.push(m);
          counts[m.t1] = c1 + 1;
          counts[m.t2] = c2 + 1;
        } else {
          week2Matches.push(m);
        }
      }
       
      if (week1Matches.length !== 10) return null;
      const w2Counts = {};
      week2Matches.forEach(m => { w2Counts[m.t1] = (w2Counts[m.t1] || 0) + 1; w2Counts[m.t2] = (w2Counts[m.t2] || 0) + 1; });
      if (Object.values(w2Counts).some(c => c !== 2)) return null;
  
      const assignDays = (matches, days) => {
        let schedule = [];
        let dayIdx = 0;
        let lastPlayed = {};
        let dailyPool = [...matches];
  
        while (dayIdx < 5) {
          let todays = [];
          for (let k = 0; k < 2; k++) {
            const matchIdx = dailyPool.findIndex(m => {
              if (todays.some(tm => tm.t1 === m.t1 || tm.t1 === m.t2 || tm.t2 === m.t1 || tm.t2 === m.t2)) return false;
              const p1 = lastPlayed[m.t1];
              const p2 = lastPlayed[m.t2];
              if (p1 !== undefined && dayIdx - p1 <= 1) return false;
              if (p2 !== undefined && dayIdx - p2 <= 1) return false;
              return true;
            });
  
            if (matchIdx !== -1) {
              const m = dailyPool.splice(matchIdx, 1)[0];
              todays.push(m);
              lastPlayed[m.t1] = dayIdx;
              lastPlayed[m.t2] = dayIdx;
            } else {
              return null;
            }
          }
          schedule.push({ ...todays[0], date: days[dayIdx], time: '17:00' });
          schedule.push({ ...todays[1], date: days[dayIdx], time: '19:30' });
          dayIdx++;
        }
        return schedule;
      };
  
      const s1 = assignDays(week1Matches, week1Days);
      if (!s1) return null;
      const s2 = assignDays(week2Matches, week2Days);
      if (!s2) return null;
  
      return [...s1, ...s2];
    };
  
    let finalSchedule = null;
    let attempts = 0;
    while (!finalSchedule && attempts < 100) {
      finalSchedule = attemptFullSchedule();
      attempts++;
    }
     
    if (!finalSchedule) {
        finalSchedule = [];
        const days = [...week1Days, ...week2Days];
        allMatches.forEach((m, i) => {
            if(i < days.length * 2) {
               finalSchedule.push({...m, date: days[Math.floor(i/2)], time: i%2===0?'17:00':'19:30'});
            }
        });
    }
  
    finalSchedule.sort((a, b) => {
      const dayA = parseFloat(a.date.split(' ')[0]);
      const dayB = parseFloat(b.date.split(' ')[0]);
      if (dayA !== dayB) return dayA - dayB;
      return a.time === '17:00' ? -1 : 1;
    });
  
    return finalSchedule;
  };