import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useNavigate, useParams, Navigate } from 'react-router-dom';
import playerList from './data/players.json';
import rawChampionList from './data/champions.json';

// ==========================================
// [통합] LoL eSports 시뮬레이션 엔진 (v9.0)
// - [MOD] 데스 타이머 후반 페널티 강화 (30분/35분 구간)
// - [FIX] 로그 타임스탬프 정렬 (넥서스 파괴 시점 동기화)
// - [KEEP] 레벨/경험치, POG, 밴픽, 골드 시스템 유지
// ==========================================
// ==========================================
// [1단계] 파일 맨 위쪽 (import 밑, 상수들 근처)에 두세요.
// ==========================================
const getTeamRoster = (teamName) => {
  // playerList가 없으면 빈 배열 반환하여 에러 방지
  if (!playerList) {
      console.error("playerList 데이터가 없습니다.");
      return [];
  }
  const positions = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
  const players = playerList.filter(p => p.팀 === teamName);
  
  if (players.length === 0) {
      console.warn(`[주의] ${teamName} 팀의 선수를 찾을 수 없습니다.`);
      // 선수가 없으면 가짜 데이터라도 만들어서 반환 (흰 화면 방지)
      return positions.map(pos => ({ 
          이름: 'Unknown', 포지션: pos, 종합: 70, 
          상세: { 라인전: 70, 무력: 70, 한타: 70, 성장: 70, 안정성: 70, 운영: 70 } 
      }));
  }
  // 포지션별 선수가 없으면 첫 번째 선수로 채움
  return positions.map(pos => players.find(p => p.포지션 === pos) || players[0]); 
};

const SIDES = { BLUE: 'BLUE', RED: 'RED' };
const LANES = ['TOP', 'JGL', 'MID', 'ADC', 'SUP']; 
const MAP_LANES = ['TOP', 'MID', 'BOT']; 

// 1. 게임 상수 및 규칙
const GAME_CONSTANTS = {
  DRAGONS: {
    TYPES: ['화학공학', '바람', '대지', '화염', '바다', '마법공학'],
  }
};

const SIM_CONSTANTS = {
  WEIGHTS: { STATS: 0.55, META: 0.25, MASTERY: 0.20 },
  META_COEFF: {
    STANDARD: { 1: 1.0, 2: 0.95, 3: 0.90, 4: 0.85, 5: 0.80 },
    ADC: { 1: 1.0, 2: 0.95, 3: 0.90, 4: 0.85, 5: 0.80 }
  },
  OTP_SCORE_THRESHOLD: 80,
  OTP_TIER_BOOST: 2,
  VAR_RANGE: 0.12,
   
  DIFFICULTY_MULTIPLIERS: {
    easy: 0.8, normal: 1.0, hard: 1.05, insane: 1.1    
  },

  POSITION_WEIGHTS: {
      EARLY: { TOP: 0.25, JGL: 0.30, MID: 0.30, ADC: 0.10, SUP: 0.05 },
      MID:   { TOP: 0.20, JGL: 0.25, MID: 0.25, ADC: 0.20, SUP: 0.10 },
      LATE:  { TOP: 0.15, JGL: 0.20, MID: 0.25, ADC: 0.30, SUP: 0.10 }
  },

  BASE_INCOME: {
      XP:   { TOP: 500, JGL: 500, MID: 500, ADC: 475, SUP: 400 },
      GOLD: { TOP: 375, JGL: 325, MID: 425, ADC: 455, SUP: 260 }
  }
};

const GAME_RULES = {
  CHAMPION_CLASSES: {
    ASSASSIN: '암살자', FIGHTER: '전사', MAGE: '마법사',
    MARKSMAN: '원거리', TANK: '탱커', SUPPORT: '서포터',
  },
  DRAGON_BUFFS: {
    '화염': { '원거리': 0.03, '마법사': 0.03, '전사': 0.05, '탱커': 0.01, '서포터': 0.01, '암살자': 0.01 },
    '대지': { '탱커': 0.03, '전사': 0.02, '서포터': 0.02, '원거리': 0.01, '마법사': 0.01, '암살자': 0.01 },
    '바람': { '암살자': 0.04, '탱커': 0.02, '서포터': 0.02, '전사': 0.01, '원거리': 0.05, '마법사': 0.05 },
    '바다': { '탱커': 0.03, '전사': 0.03, '마법사': 0.015, '서포터': 0.015, '암살자': 0.01, '원거리': 0.01 },
    '마법공학': { '원거리': 0.03, '마법사': 0.02, '암살자': 0.015, '전사': 0.015, '탱커': 0.01, '서포터': 0.01 },
    '화학공학': { '전사': 0.04, '탱커': 0.03, '서포터': 0.02, '암살자': 0.01, '원거리': 0.01, '마법사': 0.01 },
  },
  DRAGON_SOULS: {
    '화염': { '원거리': 0.25, '마법사': 0.25, '암살자': 0.22, '전사': 0.15, '탱커': 0.08, '서포터': 0.08 },
    '대지': { '탱커': 0.25, '전사': 0.22, '원거리': 0.15, '마법사': 0.15, '암살자': 0.12, '서포터': 0.10 },
    '바람': { '전사': 0.22, '탱커': 0.22, '암살자': 0.20, '서포터': 0.15, '원거리': 0.12, '마법사': 0.12 },
    '바다': { '전사': 0.25, '탱커': 0.25, '마법사': 0.18, '원거리': 0.15, '서포터': 0.10, '암살자': 0.05 },
    '마법공학': { '원거리': 0.24, '마법사': 0.20, '전사': 0.20, '탱커': 0.15, '암살자': 0.15, '서포터': 0.10 },
    '화학공학': { '전사': 0.28, '탱커': 0.22, '암살자': 0.15, '원거리': 0.10, '마법사': 0.10, '서포터': 0.10 },
  },
  COUNTERS: {
    '마법사': ['탱커', '전사'], '원거리': ['탱커', '전사'],
    '탱커': ['암살자'], '전사': ['암살자'], '암살자': ['마법사', '원거리'],
  },
  DEFAULT_ROLES: {
    TOP: '전사', JGL: '전사', MID: '마법사', ADC: '원거리', SUP: '서포터',
  },
  WEIGHTS: {
    PHASE: {
      EARLY: { laning: 0.45, mechanics: 0.30, growth: 0.15, stability: 0.10, macro: 0, teamfight: 0 },
      MID: { macro: 0.35, growth: 0.25, mechanics: 0.20, stability: 0.10, teamfight: 0.10, laning: 0 },
      LATE: { teamfight: 0.45, stability: 0.25, mechanics: 0.20, macro: 0.10, laning: 0, growth: 0 },
    },
  },
  OBJECTIVES: {
    GRUBS: { time: 6, count: 3, gold: 300 }, 
    HERALD: { time: 14, gold: 300 },
    BARON: { spawn: 20, duration: 3, gold: 1500, combat_bonus: 1.3 }, 
    ELDER: { spawn_after_soul: 6, duration: 3, combat_bonus: 1.6 },
    DRAGON: { initial_spawn: 5, respawn: 5, gold: 100 },
    PLATES: { start_time: 4, end_time: 14, count: 6 }
  },
  GOLD: {
    START: 500, KILL: 300, ASSIST: 150, 
    TURRET: { 
        OUTER_PLATE: { local: 250, team: 50 },
        INNER_MID: { local: 425, team: 25 },
        INNER_SIDE: { local: 675, team: 25 }, 
        INHIB_TURRET: { local: 375, team: 25 }
    },
  },
};

const DRAFT_SEQUENCE = [
  { type: 'BAN', side: 'BLUE', label: '블루 1밴', order: 1 },
  { type: 'BAN', side: 'RED', label: '레드 1밴', order: 2 },
  { type: 'BAN', side: 'BLUE', label: '블루 2밴', order: 3 },
  { type: 'BAN', side: 'RED', label: '레드 2밴', order: 4 },
  { type: 'BAN', side: 'BLUE', label: '블루 3밴', order: 5 },
  { type: 'BAN', side: 'RED', label: '레드 3밴', order: 6 },
  { type: 'PICK', side: 'BLUE', label: '블루 1픽', order: 7 },
  { type: 'PICK', side: 'RED', label: '레드 1픽', order: 8 },
  { type: 'PICK', side: 'RED', label: '레드 2픽', order: 9 },
  { type: 'PICK', side: 'BLUE', label: '블루 2픽', order: 10 },
  { type: 'PICK', side: 'BLUE', label: '블루 3픽', order: 11 },
  { type: 'PICK', side: 'RED', label: '레드 3픽', order: 12 },
  { type: 'BAN', side: 'RED', label: '레드 4밴', order: 13 },
  { type: 'BAN', side: 'BLUE', label: '블루 4밴', order: 14 },
  { type: 'BAN', side: 'RED', label: '레드 5밴', order: 15 },
  { type: 'BAN', side: 'BLUE', label: '블루 5밴', order: 16 },
  { type: 'PICK', side: 'RED', label: '레드 4픽', order: 17 },
  { type: 'PICK', side: 'BLUE', label: '블루 4픽', order: 18 },
  { type: 'PICK', side: 'BLUE', label: '블루 5픽', order: 19 },
  { type: 'PICK', side: 'RED', label: '레드 5픽', order: 20 }
];

const MASTERY_MAP = playerList.reduce((acc, player) => {
  acc[player.이름] = { id: player.이름, pool: [] };
  return acc;
}, {});

const championList = rawChampionList;

const getChampionClass = (champ, position) => {
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

function runDraftSimulation(blueTeam, redTeam, fearlessBans, currentChampionList) {
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
          const candidateChamp = selectPickFromTop3(player, availableChamps);
          
          if (candidateChamp) {
             roleCandidates.push({ role, champ: candidateChamp, score: candidateChamp.score });
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

        const pName = actingTeam.roster.find(p => p.포지션 === bestPickRole).이름;
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
        champName: c.name, 
        tier: c.tier, 
        mastery: c.mastery, 
        playerName: p.이름, 
        playerOvr: p.종합
      };
    }).filter(Boolean);
  };

  return {
    picks: { A: mapPicks('BLUE', blueTeam.roster), B: mapPicks('RED', redTeam.roster) },
    bans: { A: blueBans, B: redBans },
    draftLogs: logs,
    // expose the incoming global/fearless bans so callers (simulateSet / UI) can display them
    fearlessBans: Array.isArray(fearlessBans) ? [...fearlessBans] : (fearlessBans ? [fearlessBans] : [])
  };
}


function calculateTeamPower(teamPicks, time, activeBuffs, goldDiff, enemyPicks, currentAbsSecond) {
  let totalPower = 0;
   
  const phaseKey = time >= 30 ? 'LATE' : (time >= 15 ? 'MID' : 'EARLY');
  const weights = GAME_RULES.WEIGHTS.PHASE[phaseKey];
  const positionWeights = SIM_CONSTANTS.POSITION_WEIGHTS[phaseKey]; 

  let adCount = 0;
  let apCount = 0;

  teamPicks.forEach((pick, idx) => {
    if (!pick || !pick.playerData) return;
    
    // [KEEP] 사망자는 전투력에서 제외
    if (pick.deadUntil > currentAbsSecond) return;

    const laneKeys = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    const roleKey = laneKeys[idx] || pick.playerData.포지션; 
    
    const dmgType = pick.dmgType || 'AD'; 
    if (dmgType === 'AD') adCount++;
    else if (dmgType === 'AP') apCount++;

    const player = pick.playerData;
    const condition = pick.conditionModifier || 1.0;

    let stabilityPenalty = 1.0;
    if (pick.flashEndTime > time) {
        stabilityPenalty = (roleKey === 'ADC' || roleKey === '원거리') ? 0.75 : 0.8;
    }

    const stats = player.상세 || { 라인전: 80, 무력: 80, 운영: 80, 성장: 80, 한타: 80, 안정성: 80 };
    
    let effectiveStability = (stats.안정성 || 50) * stabilityPenalty;

    let rawStat = 
      ((stats.라인전 || 50) * weights.laning + 
       (stats.무력 || 50) * weights.mechanics +
       (stats.성장 || 50) * weights.growth + 
       (stats.운영 || 50) * weights.macro +
       (stats.한타 || 50) * weights.teamfight + 
       effectiveStability * weights.stability) * condition;

    const masteryScore = calculateMasteryScore(player, pick.mastery);
    const metaScore = getMetaScore(player.포지션, pick.tier, masteryScore);
    
    let combatPower = (rawStat * SIM_CONSTANTS.WEIGHTS.STATS) + (metaScore * SIM_CONSTANTS.WEIGHTS.META) + (masteryScore * SIM_CONSTANTS.WEIGHTS.MASTERY);

    combatPower *= (1 + (pick.level * 0.05));

    const currentGold = pick.currentGold || 500;
    let goldMultiplier = 1 + (currentGold * 0.0000025); 
    
    let spikeBonus = 0;
    if (currentGold >= 3500) spikeBonus += 0.03;  
    if (currentGold >= 6500) spikeBonus += 0.06;  
    if (currentGold >= 9500) spikeBonus += 0.10;  
    if (currentGold >= 12500) spikeBonus += 0.15; 
    goldMultiplier += spikeBonus; 

    combatPower *= goldMultiplier;

    const enemyLaner = enemyPicks[idx];
    if (enemyLaner) {
        const myClass = pick.classType;
        const enemyClass = enemyLaner.classType;
        if (GAME_RULES.COUNTERS[myClass]?.includes(enemyClass)) combatPower *= 1.05;
    }

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

  const isUnbalanced = adCount >= 4 || apCount >= 4;
  let balanceMultiplier = 1.0;

  if (isUnbalanced) {
      if (time < 15) balanceMultiplier = 1.0; 
      else if (time < 28) balanceMultiplier = 0.95; 
      else balanceMultiplier = 0.75; 
  }
  totalPower *= balanceMultiplier;
   
  return totalPower;
}

function resolveCombat(powerA, powerB) {
    const totalPower = powerA + powerB;
    if (totalPower === 0) return Math.random() < 0.5 ? SIDES.BLUE : SIDES.RED;
    const winChanceA = powerA / totalPower;
    return Math.random() < winChanceA ? SIDES.BLUE : SIDES.RED;
}

// Replace the existing calculateIndividualIncome(...) implementation with this.
// Implements the XP rules you requested and keeps gold calculation unchanged.
function calculateIndividualIncome(pick, time, aliveRatio = 1.0) {
  const role = pick.playerData.포지션;
  const stats = pick.playerData.상세 || { 라인전: 80, 무력: 80, 안정성: 80, 성장: 80, 운영: 80, 한타: 80 };
  
  // Base gold / XP values (XP as you specified)
  const baseGold = SIM_CONSTANTS.BASE_INCOME.GOLD[role] || 350;
  const BASE_XP_BY_ROLE = { TOP: 490, JGL: 490, MID: 490, ADC: 470, SUP: 385 };
  const baseXP = BASE_XP_BY_ROLE[role] || 450;

  // Gold multipliers (unchanged logic)
  let multiplierGold = 0;
  if (time < 15) {
      const factor = (stats.라인전 * 0.5 + stats.무력 * 0.3 + stats.안정성 * 0.2) / 90;
      multiplierGold = factor;
  } else if (time < 30) {
      const factor = (stats.성장 * 0.4 + stats.운영 * 0.4 + stats.무력 * 0.2) / 90;
      multiplierGold = factor;
  } else {
      const factor = (stats.한타 * 0.3 + stats.운영 * 0.3 + stats.안정성 * 0.3) / 90;
      multiplierGold = factor;
  }

  const finalGold = Math.floor(baseGold * multiplierGold * aliveRatio);

  // XP calculation following your phases and formula precisely:
  // - Early: baseXP * (라인전*0.5 + 무력*0.3 + 안정성*0.2) / 90
  // - Mid:   baseXP * (성장*0.4 + 운영*0.4 + 무력*0.2) / 90
  // - Late:  baseXP * (한타*0.3 + 운영*0.3 + 안정성*0.3) / 90
  let xpFactor = 0;
  if (time < 15) {
      xpFactor = ( (stats.라인전 || 50) * 0.5 + (stats.무력 || 50) * 0.3 + (stats.안정성 || 50) * 0.2 ) / 90;
  } else if (time < 30) {
      xpFactor = ( (stats.성장 || 50) * 0.4 + (stats.운영 || 50) * 0.4 + (stats.무력 || 50) * 0.2 ) / 90;
  } else {
      xpFactor = ( (stats.한타 || 50) * 0.3 + (stats.운영 || 50) * 0.3 + (stats.안정성 || 50) * 0.3 ) / 90;
  }

  const finalXP = Math.max(0, Math.floor(baseXP * xpFactor * aliveRatio));

  return { gold: finalGold, xp: finalXP };
}

// [MOD] 데스 타이머 공식 업데이트 (30분, 35분 구간 추가)
function calculateDeathTimer(level, time) {
    // 1. 기본 + 레벨 비례
    let timer = 8 + (level * 1.5);

    // 2. 시간대별 추가 페널티 (누적)
    if (time > 15) timer += (time - 15) * 0.15;
    if (time > 25) timer += (time - 25) * 0.3;
    if (time > 30) timer += (time - 30) * 0.4; // [NEW] 30분 이후 +0.4/분
    if (time > 35) timer += (time - 35) * 0.5; // [NEW] 35분 이후 +0.5/분

    // 최대 150초 제한 (안전장치)
    return Math.min(150, timer);
}

// Replace the existing runGameTickEngine implementation with this improved version
// Replaces: function runGameTickEngine(teamBlue, teamRed, picksBlue, picksRed, simOptions) { ... }
// NOTE: This version tightens random variance, applies difficulty as a player-advantage multiplier (so 'easy' helps the player),
// and produces consistent kill/counter-kill log messages so the UI parser can pick them up reliably.
function runGameTickEngine(teamBlue, teamRed, picksBlue, picksRed, simOptions) {
  let time = 0; 
  let logs = [];
  const { difficulty, playerTeamName } = simOptions;
  let gameOver = false;
  let endAbsSecond = 0;

  [...picksBlue, ...picksRed].forEach(p => {
      p.currentGold = GAME_RULES.GOLD.START;
      p.level = 1;
      p.xp = 0;
      p.deadUntil = 0;
      p.stats = { kills: 0, deaths: 0, assists: 0, damage: 0, takenDamage: 0 };
      p.flashEndTime = 0;
  });

  const simulateDamage = (winnerSide, powerA, powerB, currentAbsTime) => {
      const winningPicks = winnerSide === SIDES.BLUE ? picksBlue : picksRed;
      const losingPicks = winnerSide === SIDES.BLUE ? picksRed : picksBlue;
      
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

  // local tweak: reduce upper bound of variance to make outcomes more deterministic
  const VAR_RANGE_LOCAL = Math.min(SIM_CONSTANTS.VAR_RANGE, 0.06);

  // difficulty multipliers expressed as player-side advantage
  const PLAYER_DIFFICULTY_MULTIPLIERS = {
    easy: 1.15,   // player's team gets +15% power
    normal: 1.0,
    hard: 0.95,   // player's team gets -5% power
    insane: 0.90  // player's team gets -10% power
  };

  // ... (keep other local init code identical) ...
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
    gold: { [SIDES.BLUE]: GAME_RULES.GOLD.START * 5, [SIDES.RED]: GAME_RULES.GOLD.START * 5 },
    kills: { [SIDES.BLUE]: 0, [SIDES.RED]: 0 },
    structures: {
        [SIDES.BLUE]: { TOP: initLane(), MID: initLane(), BOT: initLane() },
        [SIDES.RED]: { TOP: initLane(), MID: initLane(), BOT: initLane() }
    },
    nexusHealth: { [SIDES.BLUE]: 100, [SIDES.RED]: 100 },
    dragons: { [SIDES.BLUE]: [], [SIDES.RED]: [] }, 
    grubs: { [SIDES.BLUE]: 0, [SIDES.RED]: 0 },
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
      const enemyTeamGold = state.gold[teamSide === SIDES.BLUE ? SIDES.RED : SIDES.BLUE];

      if (enemyTeamGold - myTeamGold >= 5000) {
        finalAmount = Math.floor(amount * 1.15);
      }

      const picks = teamSide === SIDES.BLUE ? picksBlue : picksRed;
      picks[playerIdx].currentGold += finalAmount;
      state.gold[teamSide] += finalAmount;
  };

  const grantTeamGold = (teamSide, amountPerPlayer) => {
      let finalAmount = amountPerPlayer;
      const myTeamGold = state.gold[teamSide];
      const enemyTeamGold = state.gold[teamSide === SIDES.BLUE ? SIDES.RED : SIDES.BLUE];

      if (enemyTeamGold - myTeamGold >= 5000) {
        finalAmount = Math.floor(amountPerPlayer * 1.15);
      }

      const targetPicks = teamSide === SIDES.BLUE ? picksBlue : picksRed;
      targetPicks.forEach(p => p.currentGold += finalAmount);
      state.gold[teamSide] += (finalAmount * 5);
  };

  // main minute loop
  while (state.nexusHealth[SIDES.BLUE] > 0 && state.nexusHealth[SIDES.RED] > 0 && time < 70) {
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
          const startMinAbs = minuteStartAbs;
          const endMinAbs = minuteStartAbs + 60;
          let deadDuration = 0;
          
          if (p.deadUntil > startMinAbs) {
              const endOfDeath = Math.min(endMinAbs, p.deadUntil);
              deadDuration = Math.max(0, endOfDeath - startMinAbs);
          }
          const aliveRatio = (60 - deadDuration) / 60;
  
          const income = calculateIndividualIncome(p, time, aliveRatio);
          
          p.currentGold += income.gold;
          state.gold[teamSide] += income.gold;
          
          if (p.level < 18) {
            // Add XP from this minute
            p.xp += income.xp;

            // Required XP for next level is exactly: 180 + (현재 레벨 * 100)
            // Allow multiple level-ups in the same minute if xp allows
            while (p.level < 18) {
                const requiredXP = 180 + (p.level * 100);
                if (p.xp >= requiredXP) {
                    p.xp -= requiredXP;
                    p.level++;
                } else {
                    break;
                }
            }
        }
      });
  };
  
    processIncome(picksBlue, SIDES.BLUE);
    processIncome(picksRed, SIDES.RED);

    [SIDES.BLUE, SIDES.RED].forEach(side => {
        MAP_LANES.forEach(lane => {
            const inhib = state.structures[side][lane].inhib;
            if (inhib.destroyed && inhib.respawnTime <= time) {
                inhib.destroyed = false;
                addEvent(0, `${side === SIDES.BLUE ? teamBlue.name : teamRed.name}의 ${lane} 억제기가 재생되었습니다.`);
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

    // calculate team power: pass minute integer 'time' and absolute second 'minuteStartAbs'
    let powerBlue = calculateTeamPower(picksBlue, time, getActiveBuffs(SIDES.BLUE), 0, picksRed, minuteStartAbs);
    let powerRed = calculateTeamPower(picksRed, time, getActiveBuffs(SIDES.RED), 0, picksBlue, minuteStartAbs);
    
    // Apply difficulty as a direct multiplier to the player's team (makes outcomes more consistent)
    if (playerTeamName && difficulty) {
        const playerMult = PLAYER_DIFFICULTY_MULTIPLIERS[difficulty] || 1.0;
        if (teamBlue.name === playerTeamName) powerBlue *= playerMult;
        else if (teamRed.name === playerTeamName) powerRed *= playerMult;
    }
    
    // Reduce randomness slightly for more consistent results
    powerBlue *= (1 + (Math.random() * VAR_RANGE_LOCAL * 2 - VAR_RANGE_LOCAL));
    powerRed *= (1 + (Math.random() * VAR_RANGE_LOCAL * 2 - VAR_RANGE_LOCAL));

    // GRUBS
    if (time === GAME_RULES.OBJECTIVES.GRUBS.time) {
      const winner = resolveCombat(powerBlue, powerRed);
      state.grubs[winner] += GAME_RULES.OBJECTIVES.GRUBS.count;
      grantTeamGold(winner, GAME_RULES.OBJECTIVES.GRUBS.gold / 5); 
      simulateDamage(winner, powerBlue, powerRed, minuteStartAbs + 5);
      addEvent(5, `🐛 ${winner === SIDES.BLUE ? teamBlue.name : teamRed.name} 공허 유충 처치`);
    }

    // HERALD
    if (time === GAME_RULES.OBJECTIVES.HERALD.time) {
      const winner = resolveCombat(powerBlue, powerRed);
      grantTeamGold(winner, GAME_RULES.OBJECTIVES.HERALD.gold / 5);
      // event at exact minute start (14:00)
      simulateDamage(winner, powerBlue, powerRed, minuteStartAbs + 0);
      addEvent(0, `👁️ ${winner === SIDES.BLUE ? teamBlue.name : teamRed.name} 전령 획득`);
    }

    // DRAGONS
    if ((minuteStartAbs + 59) >= state.nextDragonTimeAbs && !state.soul && state.nextDragonTimeAbs !== Infinity) {
        const minValidSec = (minuteStartAbs < state.nextDragonTimeAbs) ? (state.nextDragonTimeAbs - minuteStartAbs) : 0;
        const eventSec = Math.floor(Math.random() * (60 - minValidSec)) + minValidSec;
        const eventAbsTime = minuteStartAbs + eventSec;

        const pBlueObj = calculateTeamPower(picksBlue, time, getActiveBuffs(SIDES.BLUE), 0, picksRed, eventAbsTime);
        const pRedObj = calculateTeamPower(picksRed, time, getActiveBuffs(SIDES.RED), 0, picksBlue, eventAbsTime);

        const winner = resolveCombat(pBlueObj, pRedObj);
        simulateDamage(winner, pBlueObj, pRedObj, eventAbsTime);

        let currentDragonName;
        if (dragonSpawnCount === 0) currentDragonName = firstDragonType;
        else if (dragonSpawnCount === 1) currentDragonName = secondDragonType;
        else currentDragonName = mapElementType;

        state.dragons[winner].push(currentDragonName);
        grantTeamGold(winner, GAME_RULES.OBJECTIVES.DRAGON.gold / 5);
        dragonSpawnCount++;

        let msg = `🐉 ${winner === SIDES.BLUE ? teamBlue.name : teamRed.name}, ${currentDragonName} 용 처치`;
        
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

    // BARON
    if ((minuteStartAbs + 59) >= state.nextBaronTimeAbs && !(state.baronBuff.side && state.baronBuff.endTime >= time)) {
      if (Math.random() > 0.6 || time > 30) { 
        const minValidSec = (minuteStartAbs < state.nextBaronTimeAbs) ? (state.nextBaronTimeAbs - minuteStartAbs) : 0;
        const eventSec = Math.floor(Math.random() * (60 - minValidSec)) + minValidSec;
        const eventAbsTime = minuteStartAbs + eventSec;

        const pBlueObj = calculateTeamPower(picksBlue, time, getActiveBuffs(SIDES.BLUE), 0, picksRed, eventAbsTime);
        const pRedObj = calculateTeamPower(picksRed, time, getActiveBuffs(SIDES.RED), 0, picksBlue, eventAbsTime);

        const winner = resolveCombat(pBlueObj * 0.9, pRedObj * 0.9);
        simulateDamage(winner, pBlueObj, pRedObj, eventAbsTime);
        state.baronBuff = { side: winner, endTime: time + GAME_RULES.OBJECTIVES.BARON.duration };
        grantTeamGold(winner, GAME_RULES.OBJECTIVES.BARON.gold / 5);
        state.nextBaronTimeAbs = eventAbsTime + (GAME_RULES.OBJECTIVES.DRAGON.respawn * 60); 
        addEvent(eventSec, `🟣 ${winner === SIDES.BLUE ? teamBlue.name : teamRed.name} 내셔 남작 처치!`);
      }
    }

    // ELDER
    if ((minuteStartAbs + 59) >= state.nextElderTimeAbs && !(state.elderBuff.side && state.elderBuff.endTime >= time)) {
        const minValidSec = (minuteStartAbs < state.nextElderTimeAbs) ? (state.nextElderTimeAbs - minuteStartAbs) : 0;
        const eventSec = Math.floor(Math.random() * (60 - minValidSec)) + minValidSec;
        const eventAbsTime = minuteStartAbs + eventSec;

        const pBlueObj = calculateTeamPower(picksBlue, time, getActiveBuffs(SIDES.BLUE), 0, picksRed, eventAbsTime);
        const pRedObj = calculateTeamPower(picksRed, time, getActiveBuffs(SIDES.RED), 0, picksBlue, eventAbsTime);

        const winner = resolveCombat(pBlueObj, pRedObj);
        simulateDamage(winner, pBlueObj, pRedObj, eventAbsTime);
        state.elderBuff = { side: winner, endTime: time + GAME_RULES.OBJECTIVES.ELDER.duration };
        state.nextElderTimeAbs = eventAbsTime + (GAME_RULES.OBJECTIVES.ELDER.spawn_after_soul * 60); 
        addEvent(eventSec, `🐲 ${winner === SIDES.BLUE ? teamBlue.name : teamRed.name} 장로 드래곤 처치!`);
    }

    // COMBAT TRIGGERS
    const powerDiffRatio = Math.abs(powerBlue - powerRed) / ((powerBlue + powerRed) / 2);
    
    if (powerDiffRatio > 0.05 || Math.random() < (0.3 + (time * 0.005))) {
        const combatSec = Math.floor(Math.random() * 45);
        const combatAbsTime = minuteStartAbs + combatSec;

        const pBlueCombat = calculateTeamPower(picksBlue, time, getActiveBuffs(SIDES.BLUE), 0, picksRed, combatAbsTime);
        const pRedCombat = calculateTeamPower(picksRed, time, getActiveBuffs(SIDES.RED), 0, picksBlue, combatAbsTime);
        
        const winner = resolveCombat(pBlueCombat, pRedCombat);
        const loser = winner === SIDES.BLUE ? SIDES.RED : SIDES.BLUE;
        const winnerName = winner === SIDES.BLUE ? teamBlue.name : teamRed.name;
        
        let combatOccurred = false;

        if (Math.random() < 0.6) {
            combatOccurred = true;
            simulateDamage(winner, pBlueCombat, pRedCombat, combatAbsTime);

            const winnerKills = 1 + Math.floor(Math.random() * 2);
            state.kills[winner] += winnerKills;
            
            const winningTeamPicks = winner === SIDES.BLUE ? picksBlue : picksRed;
            const losingTeamPicks = loser === SIDES.BLUE ? picksBlue : picksRed;
            
            const getAlivePlayers = (picks) => picks.filter(p => p.deadUntil <= combatAbsTime);

            for(let k=0; k<winnerKills; k++) {
                const aliveWinners = getAlivePlayers(winningTeamPicks);
                const aliveLosers = getAlivePlayers(losingTeamPicks);

                if (aliveWinners.length === 0 || aliveLosers.length === 0) break;

                const killer = aliveWinners[Math.floor(Math.random() * aliveWinners.length)];
                const victim = aliveLosers[Math.floor(Math.random() * aliveLosers.length)];
                
                killer.stats.kills += 1;
                victim.stats.deaths += 1;
                
                const deathTime = calculateDeathTimer(victim.level, time);
                victim.deadUntil = combatAbsTime + deathTime;

                grantGoldToPlayer(winner, winningTeamPicks.indexOf(killer), GAME_RULES.GOLD.KILL);

                // assist count grows with game time (late game -> more assists)
                let assistCount = Math.floor(Math.random() * 2) + 1; // default 1-2
                if (time >= 30) assistCount = Math.floor(Math.random() * 3) + 2; // 2-4 in late
                else if (time >= 20) assistCount = Math.floor(Math.random() * 3) + 1; // 1-3 in mid

                const assistCandidates = aliveWinners.filter(p => p !== killer);
                const assistIdxs = [];
                const assistNames = [];
                for (let a = 0; a < assistCount && assistCandidates.length > 0; a++) {
                  const idx = Math.floor(Math.random() * assistCandidates.length);
                  const assister = assistCandidates.splice(idx, 1)[0];
                  assister.stats.assists += 1;
                  grantGoldToPlayer(winner, (winningTeamPicks.indexOf(assister)), GAME_RULES.GOLD.ASSIST);
                  assistIdxs.push(winningTeamPicks.indexOf(assister));
                  assistNames.push(assister.playerName);
                }

                let flashMsg = '';
                if (Math.random() < 0.35) {
                    killer.flashEndTime = time + 5; 
                    flashMsg = ' (⚡점멸 소모)';
                }
                if (Math.random() < 0.35) {
                    victim.flashEndTime = time + 5; 
                }

                // Consistent kill message format:
                // ⚔️ [POS] KillerName (Champ) ➜ ☠️ [POS] VictimName (Champ) [Assists: A,B]
                const killerChamp = killer.champName || killer.playerData?.선호챔프 || 'Unknown';
                const victimChamp = victim.champName || victim.playerData?.선호챔프 || 'Unknown';
                const assistText = assistNames.length > 0 ? ` | assists: ${assistNames.join(', ')}` : '';
                const killMsg = `⚔️ [${killer.playerData.포지션}] ${killer.playerName} (${killerChamp}) ➜ ☠️ [${victim.playerData.포지션}] ${victim.playerName} (${victimChamp})${assistText}${flashMsg}`;
                addEvent(combatSec + k, killMsg);
            }
            
            // possible counter-kill (counter-attack)
            if (Math.random() < 0.35) {
                const aliveLosers = getAlivePlayers(losingTeamPicks);
                const aliveWinners = getAlivePlayers(winningTeamPicks);
                
                if (aliveLosers.length > 0 && aliveWinners.length > 0) {
                    state.kills[loser] += 1;
                    const counterKiller = aliveLosers[Math.floor(Math.random() * aliveLosers.length)];
                    const counterVictim = aliveWinners[Math.floor(Math.random() * aliveWinners.length)];
                    
                    counterKiller.stats.kills += 1;
                    counterVictim.stats.deaths += 1;
                    
                    const cDeathTime = calculateDeathTimer(counterVictim.level, time);
                    counterVictim.deadUntil = combatAbsTime + cDeathTime;

                    if (Math.random() < 0.35) counterKiller.flashEndTime = time + 5;

                    // gold to counter killer (kill + assist equivalent)
                    grantGoldToPlayer(loser, losingTeamPicks.indexOf(counterKiller), GAME_RULES.GOLD.KILL + GAME_RULES.GOLD.ASSIST);

                    // Consistent counter-kill message using 🛡️ but same victim & killer format as regular kill messages
                    const ckillerChamp = counterKiller.champName || counterKiller.playerData?.선호챔프 || 'Unknown';
                    const cvictimChamp = counterVictim.champName || counterVictim.playerData?.선호챔프 || 'Unknown';
                    const counterMsg = `🛡️ [${counterKiller.playerData.포지션}] ${counterKiller.playerName} (${ckillerChamp}) ➜ ☠️ [${counterVictim.playerData.포지션}] ${counterVictim.playerName} (${cvictimChamp}) (반격)`;
                    addEvent(combatSec + 2, counterMsg);
                }
            }
        }

        // push / structure damage & nexus logic...
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

  const winnerSide = state.nexusHealth[SIDES.BLUE] > state.nexusHealth[SIDES.RED] ? SIDES.BLUE : SIDES.RED;
  const winnerName = winnerSide === SIDES.BLUE ? teamBlue.name : teamRed.name;

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

function simulateSet(teamBlue, teamRed, setNumber, fearlessBans, simOptions) {
  const { currentChampionList } = simOptions;
  // --- Insert / replace this block right after: const { currentChampionList } = simOptions;
const draftResult = runDraftSimulation(teamBlue, teamRed, fearlessBans || [], currentChampionList || championList);

// Validate draftResult safely before using it everywhere else
if (!draftResult || !draftResult.picks || !Array.isArray(draftResult.picks.A) || !Array.isArray(draftResult.picks.B) ||
    draftResult.picks.A.length < 5 || draftResult.picks.B.length < 5) {
  console.warn('simulateSet: incomplete or invalid draftResult — returning safe fallback', { draftResult, teamBlue: teamBlue?.name, teamRed: teamRed?.name });
  return {
    // Minimal safe fallback so callers (Live UI / simulateMatch) won't crash
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

 // Replace this block (inside function simulateSet(...) right after runDraftSimulation(...))
if (draftResult.picks.A.length < 5 || draftResult.picks.B.length < 5) {
  console.warn('simulateSet: incomplete draftResult.picks — aborting set and returning safe fallback', { draftResult, teamBlue: teamBlue?.name, teamRed: teamRed?.name });
  return {
    // Minimal, safe fallback result when draft failed — avoids referencing undefined vars
    winnerName: null,
    resultSummary: 'Draft incomplete — set aborted',
    picks: draftResult.picks || { A: [], B: [] },
    bans: draftResult.bans || { A: [], B: [] },
    logs: draftResult.draftLogs || [],
    usedChamps: draftResult.usedChamps || [],
    score: { [teamBlue.name]: '0', [teamRed.name]: '0' },
    // engine metadata (safe defaults)
    gameResult: null,
    totalMinutes: 0,
    totalSeconds: 0,
    endSecond: 0,
    gameOver: true,
    finalTimeStr: '0:00',
    playersLevelProgress: [],
    // include fearlessBans so callers / UI can still display them
    fearlessBans: draftResult.fearlessBans || fearlessBans || []
  };
}
  

  const getConditionModifier = (player) => {
      const stability = player.상세?.안정성 || 50;
      const variancePercent = ((100 - stability) / stability) * 10; 
      const fluctuation = (Math.random() * variancePercent * 2) - variancePercent;
      return 1 + (fluctuation / 100);
  };

  const addPlayerData = (picks, roster) => {
      return picks.map(p => {
          const playerData = roster.find(player => player.이름 === p.playerName);
          const champData = currentChampionList.find(c => c.name === p.champName);
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

  const gameResult = runGameTickEngine(teamBlue, teamRed, picksBlue_detailed, picksRed_detailed, simOptions);

  const usedChamps = [...draftResult.picks.A.map(p => p.champName), ...draftResult.picks.B.map(p => p.champName)];
  const scoreBlue = gameResult.finalKills[SIDES.BLUE];
  const scoreRed = gameResult.finalKills[SIDES.RED];
   
  const winningPicks = gameResult.winnerSide === SIDES.BLUE ? picksBlue_detailed : picksRed_detailed;
   
  const candidates = winningPicks.map(p => {
      const k = p.stats.kills;
      const d = p.stats.deaths === 0 ? 1 : p.stats.deaths;
      const a = p.stats.assists;
      const kda = (k + a) / d;
      
      const gold = p.currentGold;
      const role = p.playerData.포지션;
      
      const dpm = p.stats.damage / gameResult.totalMinutes;

      let pogScore = (kda * 3) + (dpm / 100) + (gold / 1000) + (a * 1);
      
      if (role === 'JGL' || role === '정글') pogScore *= 1.15;
      if (role === 'SUP' || role === '서포터') pogScore *= 1.05;

      return { ...p, kdaVal: kda, pogScore: pogScore, dpm: dpm };
  });

  candidates.sort((a, b) => b.pogScore - a.pogScore);
  const pogPlayer = candidates[0];

  const resultSummary = `⏱️ ${gameResult.gameTime} | ⚔️ ${teamBlue.name} ${scoreBlue} : ${scoreRed} ${teamRed.name} | 🏆 승리: ${gameResult.winnerName}`;
  const pogText = `🏅 POG: [${pogPlayer.playerData.포지션}] ${pogPlayer.playerName} (${pogPlayer.champName}) - Score: ${pogPlayer.pogScore.toFixed(1)}`;

  const finalLogs = [
    `========== [ 밴픽 단계 ] ==========`,
    ...draftResult.draftLogs,
    `========== [ 경기 결과 ] ==========`,
    resultSummary,
    pogText,
    `KDA: ${pogPlayer.stats.kills}/${pogPlayer.stats.deaths}/${pogPlayer.stats.assists} | DPM: ${Math.floor(pogPlayer.dpm)} | LV: ${pogPlayer.level}`,
    `===================================`,
    ...gameResult.logs
  ];

  const playersLevelProgress = [...picksBlue_detailed, ...picksRed_detailed].map(p => ({
    playerName: p.playerName,
    startLevel: 1,
    endLevel: p.level || 1
  }));

  // include the runGameTickEngine data into the result so Live UI can stop exactly
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
    // expose engine-level metadata for playback control & animations:
    gameResult,                   // full game result object from engine
    totalMinutes: gameResult.totalMinutes,
    totalSeconds: gameResult.totalSeconds,
    endSecond: gameResult.endSecond,
    gameOver: gameResult.gameOver,
    finalTimeStr: gameResult.finalTimeStr,
    playersLevelProgress          // to animate leveling on the frontend
  };
}

function simulateMatch(teamA, teamB, format = 'BO3', simOptions) {
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

// ==========================================
// 1. 데이터 및 유틸리티
// ==========================================

const teams = [
  { id: 1, name: 'GEN', fullName: '젠지 (Gen.G)', power: 94, description: '안정적인 운영과 강력한 라인전', colors: { primary: '#D4AF37', secondary: '#000000' } },
  { id: 2, name: 'HLE', fullName: '한화생명 (HLE)', power: 93, description: '성장 가능성이 높은 팀', colors: { primary: '#FF6B00', secondary: '#FFFFFF' } },
  { id: 3, name: 'KT', fullName: '케이티 (KT)', power: 87, description: '공격적인 플레이 스타일', colors: { primary: '#FF4444', secondary: '#FFFFFF' } },
  { id: 4, name: 'T1', fullName: '티원 (T1)', power: 93, description: 'LCK의 최강팀', colors: { primary: '#E2012E', secondary: '#000000' } },
  { id: 5, name: 'DK', fullName: '디플러스 기아 (DK)', power: 84, description: '전략적 플레이와 팀워크', colors: { primary: '#00D9C4', secondary: '#FFFFFF' } },
  { id: 6, name: 'BNK', fullName: 'BNK 피어엑스 (BNK)', power: 82, description: '젊은 선수들의 잠재력', colors: { primary: '#FFB800', secondary: '#000000' } },
  { id: 7, name: 'NS', fullName: '농심 레드포스 (NS)', power: 85, description: '재건 중인 팀', colors: { primary: '#DC143C', secondary: '#FFFFFF' } },
  { id: 8, name: 'BRO', fullName: '브리온 (BRO)', power: 79, description: '기본기에 충실한 팀', colors: { primary: '#166534', secondary: '#FFFFFF' } },
  { id: 9, name: 'DRX', fullName: '디알엑스 (DRX)', power: 80, description: '변화를 추구하는 팀', colors: { primary: '#3848A2', secondary: '#000000' } },
  { id: 10, name: 'DNS', fullName: 'DN 수퍼스 (DNS)', power: 82, description: '신생 팀, 도전 정신', colors: { primary: '#1E3A8A', secondary: '#FFFFFF' } },
];

const teamFinanceData = {
  "T1": { "total_expenditure": 135.0, "cap_expenditure": 76.0, "luxury_tax": 9.0 },
  "GEN": { "total_expenditure": 110.0, "cap_expenditure": 64.5, "luxury_tax": 6.125 },
  "HLE": { "total_expenditure": 102.0, "cap_expenditure": 94.5, "luxury_tax": 17.25 },
  "KT": { "total_expenditure": 48.0, "cap_expenditure": 40.4, "luxury_tax": 0.1 },
  "DK": { "total_expenditure": 35.5, "cap_expenditure": 26.5, "luxury_tax": 0.0 },
  "NS": { "total_expenditure": 51.0, "cap_expenditure": 50.0, "luxury_tax": 2.5 },
  "BNK": { "total_expenditure": 15.5, "cap_expenditure": 14.15, "luxury_tax": 0.0 },
  "BRO": { "total_expenditure": 16.0, "cap_expenditure": 16.0, "luxury_tax": 0.0 },
  "DRX": { "total_expenditure": 19.0, "cap_expenditure": 19.0, "luxury_tax": 0.0 },
  "DNS": { "total_expenditure": 29.5, "cap_expenditure": 25.5, "luxury_tax": 0.0 }
};


const difficulties = [
  { value: 'easy', label: '쉬움', color: 'green' },
  { value: 'normal', label: '보통', color: 'blue' },
  { value: 'hard', label: '어려움', color: 'orange' },
  { value: 'insane', label: '극악', color: 'red' },
];

const getLeagues = () => { const s = localStorage.getItem('lckgm_leagues'); return s ? JSON.parse(s) : []; };
const saveLeagues = (l) => localStorage.setItem('lckgm_leagues', JSON.stringify(l));
const addLeague = (l) => { const list = getLeagues(); list.push(l); saveLeagues(list); return list; };
const updateLeague = (id, u) => { 
  const leagues = getLeagues(); 
  const index = leagues.findIndex(l => l.id === id); 
  if (index !== -1) { 
    leagues[index] = { ...leagues[index], ...u }; 
    saveLeagues(leagues); 
    return leagues[index];
  }
  return null;
};
const deleteLeague = (id) => { const l = getLeagues().filter(x => x.id !== id); saveLeagues(l); return l; };
const getLeagueById = (id) => getLeagues().find(l => l.id === id);
function getTextColor(hex) { const r=parseInt(hex.slice(1,3),16),g=parseInt(hex.slice(3,5),16),b=parseInt(hex.slice(5,7),16); return (r*299+g*587+b*114)/1000>128?'#000000':'#FFFFFF'; }

const getOvrBadgeStyle = (ovr) => {
  if (ovr >= 95) return 'bg-red-100 text-red-700 border-red-300 ring-red-200';
  if (ovr >= 90) return 'bg-orange-100 text-orange-700 border-orange-300 ring-orange-200';
  if (ovr >= 85) return 'bg-purple-100 text-purple-700 border-purple-300 ring-purple-200';
  if (ovr >= 80) return 'bg-blue-100 text-blue-700 border-blue-300 ring-blue-200';
  return 'bg-green-100 text-green-700 border-green-300 ring-green-200';
};

const getPotBadgeStyle = (pot) => {
  if (pot >= 95) return 'text-purple-600 font-black'; 
  if (pot >= 90) return 'text-blue-600 font-bold'; 
  return 'text-gray-500 font-medium';
};

const generateSchedule = (baronIds, elderIds) => {
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


// ==========================================
// 2. 리액트 컴포넌트
// ==========================================

function LeagueManager() {
  const [leagues, setLeagues] = useState(getLeagues());
  const navigate = useNavigate();
  useEffect(() => setLeagues(getLeagues()), []);
   
  const handleClearData = () => {
    if(window.confirm('저장된 모든 데이터를 초기화하시겠습니까? 실행 후 접속 오류가 해결됩니다.')){
        localStorage.removeItem('lckgm_leagues');
        window.location.reload();
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-black text-gray-800 tracking-tight">LCK 매니저 2026</h1>
            <button onClick={handleClearData} className="text-xs text-red-500 underline hover:text-red-700">데이터 초기화 (오류 해결)</button>
        </div>
        <div className="grid gap-4">
          {leagues.map(l => {
            const t = teams.find(x => x.id === l.team.id);
            if (!t) return null;
            return (
              <div key={l.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:border-blue-500 hover:shadow-md transition flex justify-between items-center group">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-full flex items-center justify-center font-bold text-white shadow-md text-lg" style={{backgroundColor:t.colors.primary}}>{t.name}</div>
                  <div><h2 className="text-xl font-bold group-hover:text-blue-600 transition">{t.fullName}</h2><p className="text-gray-500 font-medium text-sm">{l.leagueName} · {l.difficulty.toUpperCase()}</p></div>
                </div>
                <div className="flex gap-3">
                  <button onClick={()=>{updateLeague(l.id,{lastPlayed:new Date().toISOString()});navigate(`/league/${l.id}`)}} className="bg-blue-600 text-white px-5 py-2.5 rounded-lg font-bold hover:bg-blue-700 shadow-sm transition">접속하기</button>
                  <button onClick={()=>{if(window.confirm('삭제하시겠습니까?')){deleteLeague(l.id);setLeagues(getLeagues())}}} className="bg-gray-100 text-gray-600 px-4 py-2.5 rounded-lg font-bold hover:bg-gray-200 transition">삭제</button>
                </div>
              </div>
            );
          })}
        </div>
        <button onClick={() => navigate('/new-league')} className="w-full mt-6 bg-white border-2 border-dashed border-gray-300 py-6 rounded-xl text-gray-400 hover:border-blue-500 hover:text-blue-500 font-bold text-xl transition flex items-center justify-center gap-2"><span>+</span> 새로운 시즌 시작하기</button>
      </div>
    </div>
  );
}

function TeamSelection() {
  const [idx, setIdx] = useState(0);
  const [diff, setDiff] = useState('normal');
  const navigate = useNavigate();
  const current = teams[idx];

  const handleStart = () => {
    const newId = Date.now().toString();
    addLeague({
      id: newId,
      leagueName: `2026 LCK 컵 - ${current.name}`,
      team: current,
      difficulty: diff,
      createdAt: new Date().toISOString(),
      lastPlayed: new Date().toISOString(),
      groups: { baron: [], elder: [] },
      matches: [],
      standings: {},
      // 시즌 시작 시 초기 챔피언 리스트와 메타 버전 저장
      currentChampionList: championList,
      metaVersion: '16.01'
    });
    setTimeout(() => navigate(`/league/${newId}`), 50);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 transition-colors duration-500" style={{backgroundColor:`${current.colors.primary}10`}}>
      <div className="bg-white p-10 rounded-3xl shadow-2xl max-w-2xl w-full text-center border-t-8" style={{borderColor:current.colors.primary}}>
        <h2 className="text-3xl font-black mb-2">팀 선택</h2>
        <div className="flex items-center justify-between mb-8 mt-8">
          <button onClick={()=>setIdx(i=>i===0?teams.length-1:i-1)} className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition">◀</button>
          <div className="flex flex-col items-center transform transition duration-300">
            <div className="w-40 h-40 rounded-full flex items-center justify-center text-5xl font-black text-white shadow-xl mb-6 ring-4 ring-white" style={{backgroundColor:current.colors.primary}}>{current.name}</div>
            <h3 className="text-3xl font-bold text-gray-800">{current.fullName}</h3>
            <div className="mt-3 inline-block bg-gray-100 px-4 py-1.5 rounded-full text-sm font-bold border border-gray-200">종합 전력: <span className="text-blue-600 text-lg">{current.power}</span></div>
          </div>
          <button onClick={()=>setIdx(i=>i===teams.length-1?0:i+1)} className="p-3 bg-gray-100 rounded-full hover:bg-gray-200 transition">▶</button>
        </div>
        <div className="grid grid-cols-4 gap-3 mb-4">{difficulties.map(d=><button key={d.value} onClick={()=>setDiff(d.value)} className={`py-3 rounded-xl border-2 font-bold transition ${diff===d.value?'bg-gray-800 text-white border-gray-800':'bg-white text-gray-400 border-gray-200 hover:border-gray-300'}`}>{d.label}</button>)}</div>
        <div className="bg-gray-50 rounded-lg p-4 mb-8 text-sm leading-relaxed border border-gray-100">
          <p className="text-gray-600 font-medium">ℹ️ 난이도가 상승할수록 승리 확률 감소, 재계약 확률 감소, 선수의 기복이 증가하여 전체적으로 운영이 어려워집니다.</p>
          {diff === 'insane' && <p className="text-red-600 font-bold mt-2 animate-pulse">⚠️ 극악 난이도는 운과 실력이 모두 필요한 최악의 시나리오입니다.</p>}
        </div>
        <button onClick={handleStart} className="w-full py-5 rounded-2xl font-black text-xl text-white shadow-lg hover:shadow-xl hover:opacity-90 transition transform hover:-translate-y-1" style={{backgroundColor:current.colors.primary,color:getTextColor(current.colors.primary)}}>2026 시즌 시작하기</button>
      </div>
    </div>
  );
}

// --- Detailed Match Result Modal (New for My Games) ---
function DetailedMatchResultModal({ result, onClose, teamA, teamB }) {
  const [activeSet, setActiveSet] = useState(0); 
  
  const currentSetData = result.history[activeSet];
  const picksBlue = currentSetData.picks.A;
  const picksRed = currentSetData.picks.B;
  const bansBlue = currentSetData.bans.A;
  const bansRed = currentSetData.bans.B;
  const fearlessBans = currentSetData.fearlessBans || [];

  return (
    <div className="fixed inset-0 z-[100] bg-gray-900 bg-opacity-95 flex items-center justify-center p-4">
      <div className="bg-gray-100 rounded-2xl w-full max-w-6xl h-[90vh] flex flex-col shadow-2xl overflow-hidden relative">
        {/* Header */}
        <div className="bg-black text-white p-6 flex justify-between items-center shrink-0">
          <div className="flex items-center gap-4">
            <span className="text-3xl font-black text-blue-500">{result.scoreA}</span>
            <div className="flex flex-col items-center">
              <span className="text-xs text-gray-400 font-bold tracking-widest">FINAL SCORE</span>
              <span className="text-2xl font-bold">VS</span>
            </div>
            <span className="text-3xl font-black text-red-500">{result.scoreB}</span>
          </div>
          <div>
            <h2 className="text-2xl font-bold text-center">{result.winner} WIN!</h2>
          </div>
          <button onClick={onClose} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded text-sm font-bold">닫기</button>
        </div>

        {/* Tabs */}
        <div className="flex bg-gray-200 border-b border-gray-300 shrink-0">
          {result.history.map((set, idx) => (
            <button 
              key={idx} 
              onClick={() => setActiveSet(idx)}
              className={`flex-1 py-4 font-bold text-lg transition ${activeSet === idx ? 'bg-white text-black border-b-4 border-black' : 'text-gray-500 hover:bg-gray-300'}`}
            >
              SET {set.setNumber} <span className="text-sm font-normal text-gray-400 ml-2">({set.winner} 승)</span>
            </button>
          ))}
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Bans Section with improved layout & Full Names */}
          <div className="mb-6 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
             <div className="flex justify-between items-start">
               {/* Blue Team Bans */}
               <div className="flex flex-col gap-2">
                 <div className="text-blue-600 font-black text-sm uppercase tracking-wider mb-1">Blue Phase Bans</div>
                 <div className="flex gap-2">
                   {bansBlue.map((b, i) => (
                     <div key={i} className="group relative">
                        <div className="w-16 h-10 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-300 text-gray-600 font-bold text-[10px] shadow-sm p-1 text-center leading-tight">
                           {b}
                        </div>
                     </div>
                   ))}
                 </div>
               </div>

               {/* Global (Fearless) Bans - Center */}
               {fearlessBans.length > 0 && (
                   <div className="flex flex-col gap-2 items-center mx-4">
                     <div className="text-purple-600 font-black text-sm uppercase tracking-wider mb-1 flex items-center gap-1">
                        <span>🚫</span> Fearless (Locked)
                     </div>
                     <div className="flex gap-1 flex-wrap justify-center max-w-lg bg-purple-50 p-2 rounded-lg border border-purple-100">
                       {fearlessBans.map((b, i) => (
                         <span key={i} className="text-[10px] font-bold text-purple-700 bg-white px-2 py-1 rounded border border-purple-200 shadow-sm">{b}</span>
                       ))}
                     </div>
                   </div>
               )}

               {/* Red Team Bans */}
               <div className="flex flex-col gap-2 items-end">
                 <div className="text-red-600 font-black text-sm uppercase tracking-wider mb-1">Red Phase Bans</div>
                 <div className="flex gap-2">
                    {bansRed.map((b, i) => (
                     <div key={i} className="group relative">
                        <div className="w-16 h-10 bg-gray-100 rounded-lg flex items-center justify-center border border-gray-300 text-gray-600 font-bold text-[10px] shadow-sm p-1 text-center leading-tight">
                           {b}
                        </div>
                     </div>
                   ))}
                 </div>
               </div>
             </div>
          </div>

          {/* Rosters & Picks */}
          <div className="grid grid-cols-2 gap-8 h-full">
            {/* Blue Team */}
            <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-blue-500">
               <h3 className="text-xl font-black text-blue-700 mb-4 text-center">{teamA.name} <span className="text-sm text-gray-400 font-normal">BLUE SIDE</span></h3>
               <div className="space-y-3">
                 {picksBlue.map((p, i) => (
                   <div key={i} className="flex items-center bg-blue-50 p-3 rounded-lg border border-blue-100 relative overflow-hidden">
                      <div className="w-8 text-center font-bold text-gray-400 text-xs mr-2">{['TOP','JGL','MID','ADC','SUP'][i]}</div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-800 text-lg">{p.champName}</div>
                        <div className="text-xs text-blue-600 font-bold">{p.tier}티어 챔피언</div>
                      </div>
                      <div className="text-right z-10">
                        <div className="font-bold text-gray-900">{p.playerName}</div>
                        <div className="text-xs text-gray-500 font-medium">OVR {p.playerOvr}</div>
                      </div>
                      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-blue-200 to-transparent opacity-30 pointer-events-none"></div>
                   </div>
                 ))}
               </div>
            </div>

            {/* Red Team */}
            <div className="bg-white rounded-xl shadow-sm p-4 border-t-4 border-red-500">
               <h3 className="text-xl font-black text-red-700 mb-4 text-center">{teamB.name} <span className="text-sm text-gray-400 font-normal">RED SIDE</span></h3>
               <div className="space-y-3">
                 {picksRed.map((p, i) => (
                   <div key={i} className="flex items-center bg-red-50 p-3 rounded-lg border border-red-100 relative overflow-hidden">
                      <div className="w-8 text-center font-bold text-gray-400 text-xs mr-2">{['TOP','JGL','MID','ADC','SUP'][i]}</div>
                      <div className="flex-1">
                        <div className="font-bold text-gray-800 text-lg">{p.champName}</div>
                        <div className="text-xs text-red-600 font-bold">{p.tier}티어 챔피언</div>
                      </div>
                      <div className="text-right z-10">
                        <div className="font-bold text-gray-900">{p.playerName}</div>
                        <div className="text-xs text-gray-500 font-medium">OVR {p.playerOvr}</div>
                      </div>
                      <div className="absolute right-0 top-0 bottom-0 w-24 bg-gradient-to-l from-red-200 to-transparent opacity-30 pointer-events-none"></div>
                   </div>
                 ))}
               </div>
            </div>
          </div>

          {/* Logs */}
          <div className="mt-6 bg-gray-50 rounded-xl p-4 border border-gray-200">
             <h4 className="font-bold text-gray-500 mb-2 text-sm uppercase">Game Logs</h4>
             <div className="space-y-1 font-mono text-sm h-32 overflow-y-auto">
               {currentSetData.logs.map((l, i) => <div key={i} className="border-b border-gray-200 last:border-0 pb-1 text-gray-700">{l}</div>)}
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// [3단계] Dashboard 컴포넌트 바로 위에 붙여넣기
// ==========================================
// ==========================================
// [3단계] Dashboard 컴포넌트 바로 위에 붙여넣기
// ==========================================
// Replace the existing `function LiveGamePlayer(...) { ... }` in src/App.jsx with the code below.
// Search for "function LiveGamePlayer" and replace that entire function body.

// Replaces: function LiveGamePlayer({ match, teamA, teamB, simOptions, onMatchComplete, onClose }) { ... }
// NOTE: changes:
//  - shows global (fearless) bans alongside blue/red bans in GAME view player lists
//  - improved log regex to detect both regular kills (⚔️) and counter-kills (🛡️) and parse killer/victim reliably
//  - when parsing counter-kill logs, K/D/A are updated properly
function LiveGamePlayer({ match, teamA, teamB, simOptions, onMatchComplete, onClose, externalGlobalBans = [] }) {
  const [currentSet, setCurrentSet] = useState(1);
  const [winsA, setWinsA] = useState(0);
  const [winsB, setWinsB] = useState(0);
  const [phase, setPhase] = useState('READY');
  const [simulationData, setSimulationData] = useState(null);
  const [displayLogs, setDisplayLogs] = useState([]);
  const [liveStats, setLiveStats] = useState({
    kills: { BLUE: 0, RED: 0 },
    gold: { BLUE: 2500, RED: 2500 },
    towers: { BLUE: 0, RED: 0 },
    drakes: { BLUE: 0, RED: 0 },
    grubs: { BLUE: 0, RED: 0 },
    players: []
  });
  const [gameTime, setGameTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [draftStep, setDraftStep] = useState(0);
  const [globalBanList, setGlobalBanList] = useState([]);
  const [matchHistory, setMatchHistory] = useState([]);

  const [draftBans, setDraftBans] = useState({ A: [], B: [], fearless: [] });

  if (!teamA || !teamB || !match) {
    return (
      <div className="fixed inset-0 bg-black text-red-500 z-[200] flex items-center justify-center">
        <div>
          치명적 오류: 매치 데이터가 누락되었습니다.
          <div className="mt-3">
            <button onClick={onClose} className="bg-white text-black px-4 py-2 mt-2 rounded">닫기</button>
          </div>
        </div>
      </div>
    );
  }

  const startSet = useCallback(() => {
    try {
      const blueTeam = currentSet % 2 !== 0 ? teamA : teamB;
      const redTeam = currentSet % 2 !== 0 ? teamB : teamA;

      const result = simulateSet(blueTeam, redTeam, currentSet, globalBanList, simOptions);

      if (!result || !result.picks) throw new Error("시뮬레이션 결과가 비어있습니다.");

            setDraftBans({
        A: result.bans?.A || [],
        B: result.bans?.B || [],
        // prefer result's fearless for this set, but always include external/global bans (dedupe)
        fearless: Array.from(new Set([...(externalGlobalBans || []), ...(result.fearlessBans || result.fearless || [])]))
      });

      const players = [
        ...result.picks.A.map(p => ({ ...p, side: 'BLUE', k:0, d:0, a:0, currentGold: 500, lvl: 1 })),
        ...result.picks.B.map(p => ({ ...p, side: 'RED', k:0, d:0, a:0, currentGold: 500, lvl: 1 }))
      ];

      setLiveStats({
        kills: { BLUE: 0, RED: 0 },
        gold: { BLUE: 2500, RED: 2500 },
        towers: { BLUE: 0, RED: 0 },
        drakes: { BLUE: 0, RED: 0 },
        grubs: { BLUE: 0, RED: 0 },
        players
      });

      setSimulationData({ ...result, blueTeam, redTeam });
      setGameTime(0);
      setDisplayLogs([]);
      setPhase('DRAFT');
      setDraftStep(0);

    } catch (e) {
      console.error(e);
      alert("시뮬레이션 중 오류 발생: " + (e?.message || e));
      if (onClose) onClose();
    }
  }, [currentSet, teamA, teamB, globalBanList, simOptions, onClose]);

  useEffect(() => {
    if (phase === 'READY') startSet();
  }, [phase, startSet]);

  useEffect(() => {
    if (phase !== 'DRAFT' || !simulationData) return;

    const draftLogs = simulationData.draftLogs || [];
    setDisplayLogs([]);
    setDraftStep(0);

    setDraftBans({
      A: simulationData.bans?.A || [],
      B: simulationData.bans?.B || [],
      fearless: simulationData.fearlessBans || simulationData.fearless || []
    });

    let idx = 0;
    const intervalMs = 1600;
    const interval = setInterval(() => {
      const nextLog = draftLogs[idx];
      if (nextLog) {
        setDisplayLogs(prev => {
          const merged = [...prev, nextLog].slice(-200);
          return merged;
        });
        idx++;
        setDraftStep(idx);
      }

      if (idx >= draftLogs.length) {
        clearInterval(interval);
        const startDelay = 900;
        setTimeout(() => {
          setPhase('GAME');
          setGameTime(0);
        }, startDelay);
      }
    }, intervalMs);

    return () => clearInterval(interval);
  }, [phase, simulationData]);

  useEffect(() => {
    if (phase !== 'GAME' || !simulationData) return;

    const finalSec = Number(simulationData.totalSeconds) || (Number(simulationData.totalMinutes) || 30) * 60;
    const intervalMs = 1000 / Math.max(1, playbackSpeed);

    const timer = setInterval(() => {
      setGameTime(prev => {
        const next = prev + 1;

        const logsForThisSecond = (simulationData.logs || []).filter(log => {
          const m = log.match(/^\s*\[(\d+):(\d{1,2})\]/);
          if (!m) return false;
          const min = parseInt(m[1], 10);
          const sec = parseInt(m[2], 10);
          const abs = (min * 60) + sec;
          return abs === next;
        });

        if (logsForThisSecond.length > 0) {
          setDisplayLogs(prevLogs => {
            const merged = [...prevLogs, ...logsForThisSecond].slice(-200);
            return merged;
          });

          setLiveStats(prevStats => {
            const newStats = JSON.parse(JSON.stringify(prevStats));

            logsForThisSecond.forEach(log => {
              try {
                // Accept both normal kills (⚔️) and counter-kills (🛡️)
                const killerMatch = log.match(/(?:⚔️|🛡️)[\s\S]*?\]\s*([^\(]+?)\s*\(/);
                const victimMatch = log.match(/☠️[\s\S]*?\]\s*([^\(]+?)\s*\(/);

                const killerName = killerMatch?.[1]?.trim();
                const victimName = victimMatch?.[1]?.trim();

                if (victimName) {
                  newStats.players = newStats.players.map(p => {
                    if (p.playerName === victimName) {
                      p.d = (p.d || 0) + 1;
                    }
                    return p;
                  });
                }

                if (killerName) {
                  let killerSide = null;
                  newStats.players = newStats.players.map(p => {
                    if (p.playerName === killerName) {
                      killerSide = p.side;
                      p.k = (p.k || 0) + 1;
                      p.currentGold = (p.currentGold || 500) + GAME_RULES.GOLD.KILL;
                    }
                    return p;
                  });
                  if (killerSide) newStats.kills[killerSide] = (newStats.kills[killerSide] || 0) + 1;
                }

                if (/assist|assist\(|도움|어시스트/.test(log)) {
                  newStats.players = newStats.players.map(p => {
                    if (log.includes(p.playerName) && !killerName?.includes(p.playerName) && !victimName?.includes(p.playerName)) {
                      p.a = (p.a || 0) + 1;
                      p.currentGold = (p.currentGold || 500) + GAME_RULES.GOLD.ASSIST;
                    }
                    return p;
                  });
                }

                if (/포탑|포탑 방패|억제기|1차 포탑|2차 포탑|3차/.test(log)) {
                  if (simulationData.blueTeam && log.includes(simulationData.blueTeam.name)) newStats.towers.BLUE++;
                  else if (simulationData.redTeam && log.includes(simulationData.redTeam.name)) newStats.towers.RED++;
                }

              } catch (err) {
                console.warn('log parse error', err, log);
              }
            });

            const progress = finalSec > 0 ? Math.min(1, next / finalSec) : 1;
            if (simulationData.playersLevelProgress) {
              newStats.players = newStats.players.map(pl => {
                const prog = (simulationData.playersLevelProgress || []).find(pp => pp.playerName === pl.playerName);
                if (!prog) return pl;
                const startL = Number(prog.startLevel || 1);
                const endL = Number(prog.endLevel || startL);
                const delta = endL - startL;
                const newLevel = startL + Math.floor(delta * progress);
                pl.lvl = Math.max(1, newLevel);
                return pl;
              });
            }

            return newStats;
          });
        }

        if (next >= finalSec) {
          setGameTime(finalSec);
          const postDelayMs = Math.max(500, 1500 / Math.max(1, playbackSpeed));
          setTimeout(() => setPhase('SET_RESULT'), postDelayMs);
          return finalSec;
        }

        return next;
      });
    }, intervalMs);

    return () => clearInterval(timer);
  }, [phase, simulationData, playbackSpeed]);

  if (!simulationData) return (
    <div className="fixed inset-0 bg-black text-white flex items-center justify-center z-[200]">로딩 중...</div>
  );

  const { blueTeam, redTeam, picks, bans } = simulationData;
  const leftTeamName = blueTeam?.name || teamA.name;
  const rightTeamName = redTeam?.name || teamB.name;
  const leftWins = (leftTeamName === teamA.name) ? winsA : winsB;
  const rightWins = (rightTeamName === teamB.name) ? winsB : winsA;
  const leftKills = liveStats.kills.BLUE || 0;
  const rightKills = liveStats.kills.RED || 0;

  const renderLogLine = (l) => {
    const m = l.match(/^\s*(\[\d+:\d{2}\])\s*(.*)$/);
    const timePart = m ? m[1] : '';
    const msgPart = m ? m[2] : l;
    return (
      <div className="flex items-center gap-2">
        {timePart && <span className="text-white font-mono text-xs">{timePart}</span>}
        <span className="text-white text-sm">{msgPart}</span>
      </div>
    );
  };

  // Skip draft to game
  const skipDraftToGame = () => {
    if (!simulationData) return;
    setDisplayLogs(simulationData.draftLogs || []);
    setDraftBans({
      A: simulationData.bans?.A || [],
      B: simulationData.bans?.B || [],
      fearless: simulationData.fearlessBans || simulationData.fearless || []
    });
    setPhase('GAME');
    setGameTime(0);
  };

  return (
    <div className="fixed inset-0 bg-black z-[200] flex flex-col font-mono text-white">
      {/* top bar */}
      <div className="h-16 bg-gray-900 border-b border-gray-800 flex items-center justify-between px-6 z-10">
        <div className="w-1/3 flex items-center gap-4">
          <div>
            <div className="text-sm font-bold text-blue-400">{leftTeamName}</div>
            <div className="flex items-center gap-2">
              <div className="text-2xl font-extrabold text-white">{leftKills}</div>
              <div className="text-sm text-gray-400">({leftWins} sets)</div>
            </div>
          </div>
        </div>

        <div className="text-yellow-400 font-black text-2xl">
          {phase === 'DRAFT' ? phase : `${Math.floor(gameTime/60)}:${String(gameTime%60).padStart(2,'0')}`}
        </div>

        <div className="w-1/3 flex items-center justify-end gap-4">
          <div className="text-right">
            <div className="text-sm font-bold text-red-400">{rightTeamName}</div>
            <div className="flex items-center gap-2 justify-end">
              <div className="text-sm text-gray-400">({rightWins} sets)</div>
              <div className="text-2xl font-extrabold text-white">{rightKills}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 bg-black relative flex">
      {phase === 'DRAFT' && (
  <div className="w-full flex flex-col p-6 text-white">
    <div className="mb-4 flex justify-between items-center">
      <div className="text-lg font-black">DRAFT / BAN PHASE</div>
      <div className="flex items-center gap-3">
        <div className="text-xs text-purple-300 font-bold">Global fearless bans</div>
        <div className="flex gap-1">
          {(draftBans.fearless || externalGlobalBans || simulationData?.fearlessBans || []).map((b, i) => (
            <span key={i} className="px-2 py-0.5 bg-purple-700 text-white text-xs rounded">{b}</span>
          ))}
        </div>
      </div>
    </div>

    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-1 bg-gray-800 p-3 rounded">
        <div className="text-sm font-bold text-blue-300 mb-2">Blue Bans</div>
        <div className="flex flex-col gap-2">
          {(draftBans.A || simulationData?.bans?.A || []).map((b, i) => (
            <div key={i} className="px-2 py-1 bg-gray-700 rounded text-xs">{b}</div>
          ))}
        </div>
      </div>

      <div className="col-span-1 bg-gray-900 p-3 rounded flex flex-col">
        <div className="text-sm font-bold text-white mb-2">Ban / Pick Order</div>
        <div className="flex-1 overflow-y-auto max-h-64 font-mono text-sm">
          {(simulationData?.draftLogs || []).map((log, idx) => (
            <div
              key={idx}
              className={`py-1 px-2 rounded mb-1 ${idx === (draftStep - 1) ? 'bg-yellow-500 text-black font-bold' : 'bg-gray-800 text-gray-300'}`}
            >
              {log}
            </div>
          ))}
        </div>
        <div className="mt-3 flex justify-between">
          <button onClick={skipDraftToGame} className="px-3 py-1 bg-red-600 rounded text-xs font-bold">Skip Draft → Game</button>
          <div className="text-xs text-gray-400">Step: {Math.max(0, draftStep)} / {(simulationData?.draftLogs || []).length}</div>
        </div>
      </div>

      <div className="col-span-1 bg-gray-800 p-3 rounded">
        <div className="text-sm font-bold text-red-300 mb-2">Red Bans</div>
        <div className="flex flex-col gap-2">
          {(draftBans.B || simulationData?.bans?.B || []).map((b, i) => (
            <div key={i} className="px-2 py-1 bg-gray-700 rounded text-xs text-right">{b}</div>
          ))}
        </div>
      </div>
    </div>

    <div className="mt-4 text-xs text-gray-300">
      Draft logs play automatically. You can click "Skip Draft → Game" to progress immediately.
    </div>
  </div>
)}

        {phase === 'GAME' && (
          <>
            <div className="w-64 bg-gray-900 p-2 space-y-1">
              {/* show global fearless bans at top of side column for visibility next to player list */}
              <div className="text-xs text-purple-300 font-bold mb-2 text-center">Global bans</div>
              <div className="flex flex-wrap gap-1 justify-center mb-3">
                {(draftBans.fearless || simulationData.fearlessBans || []).map((b, i) => (
                  <div key={`side-f-${i}`} className="px-2 py-0.5 bg-purple-700 text-white text-xs rounded">{b}</div>
                ))}
              </div>

              {liveStats.players.filter(p=>p.side==='BLUE').map((p,i) => (
                <div key={i} className="text-xs bg-black p-2 border-l-2 border-blue-500 flex items-center justify-between">
                  <div>
                    <div className="font-bold text-sm">
                      {p.champName} <span className="text-[11px] text-gray-300 font-medium ml-2">Lv {p.lvl || 1}</span>
                    </div>
                    <div className="text-[11px] text-gray-300">{p.playerName}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-mono">{(p.k||0)}/{(p.d||0)}/{(p.a||0)}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex-1 relative flex flex-col justify-end items-center pb-10">
              <div className="absolute inset-0 bg-gray-800 opacity-20"></div>
              <div className="z-10 text-center space-y-2 mb-4 w-full max-w-2xl">
                <div className="absolute top-6 left-1/2 transform -translate-x-1/2 z-20 w-full max-w-2xl">
                  <div className="flex justify-between items-center gap-4 px-4">
                    <div className="flex items-center gap-2">
                      <div className="text-xs font-bold text-blue-300 uppercase">Blue bans</div>
                      <div className="flex gap-1">
                        {(draftBans.A || simulationData.bans?.A || []).map((b, i) => (
                          <div key={`b-ban-${i}`} className="px-2 py-0.5 bg-gray-800 text-white text-xs rounded">{b}</div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-xs font-bold text-purple-300 uppercase">Global bans</div>
                      <div className="flex gap-1">
                        {(draftBans.fearless || simulationData.fearlessBans || simulationData.fearless || []).map((b, i) => (
                          <div key={`f-ban-${i}`} className="px-2 py-0.5 bg-purple-700 text-white text-xs rounded">{b}</div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="text-xs font-bold text-red-300 uppercase">Red bans</div>
                      <div className="flex gap-1">
                        {(draftBans.B || simulationData.bans?.B || []).map((b, i) => (
                          <div key={`r-ban-${i}`} className="px-2 py-0.5 bg-gray-800 text-white text-xs rounded">{b}</div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {displayLogs.slice(-6).map((l, i) => (
                  <div key={i} className="text-sm font-bold text-white bg-black/60 px-3 py-1 rounded whitespace-pre-wrap break-words">
                    {renderLogLine(l)}
                  </div>
                ))}
              </div>

              <div className="z-10 flex gap-2">
                {[1,4,16].map(s => (
                  <button key={s} onClick={()=>setPlaybackSpeed(s)} className={`px-3 py-1 rounded text-xs ${playbackSpeed === s ? 'bg-yellow-500 text-black' : 'bg-gray-700'}`}>{s}x</button>
                ))}
                <button onClick={()=>{
                  const gm = parseInt((simulationData.totalMinutes || 30), 10) * 60;
                  setGameTime(gm);
                }} className="bg-red-600 px-3 py-1 rounded text-xs">SKIP</button>
              </div>
            </div>

            <div className="w-64 bg-gray-900 p-2 space-y-1">
              <div className="text-xs text-purple-300 font-bold mb-2 text-center">Global bans</div>
              <div className="flex flex-wrap gap-1 justify-center mb-3">
                {(draftBans.fearless || simulationData.fearlessBans || []).map((b, i) => (
                  <div key={`side-fr-${i}`} className="px-2 py-0.5 bg-purple-700 text-white text-xs rounded">{b}</div>
                ))}
              </div>

              {liveStats.players.filter(p=>p.side==='RED').map((p,i) => (
                <div key={i} className="text-xs bg-black p-2 border-r-2 border-red-500 text-right flex items-center justify-between">
                  <div className="text-left">
                    <div className="font-bold text-sm">{p.champName} <span className="text-[11px] text-gray-300 font-medium ml-2">Lv {p.lvl || 1}</span></div>
                    <div className="text-[11px] text-gray-300">{p.playerName}</div>
                  </div>
                  <div className="pl-2">
                    <div className="text-[11px] font-mono">{(p.k||0)}/{(p.d||0)}/{(p.a||0)}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {phase === 'SET_RESULT' && (
          <div className="w-full flex flex-col items-center justify-center">
            <h1 className="text-6xl font-black text-white mb-8">{simulationData.winnerName} WIN!</h1>
            <button onClick={() => {
              const winnerIsTeamA = simulationData.winnerName === teamA.name;
              const nA = winsA + (winnerIsTeamA ? 1 : 0);
              const nB = winsB + (!winnerIsTeamA ? 1 : 0);
              setWinsA(nA); setWinsB(nB);

              const newHistoryEntry = {
                setNumber: currentSet,
                winner: simulationData.winnerName,
                picks: simulationData.picks,
                bans: simulationData.bans,
                fearlessBans: globalBanList,
                logs: simulationData.logs,
                resultSummary: simulationData.resultSummary,
                scores: simulationData.score
              };

              const updatedHistory = [...matchHistory, newHistoryEntry];
              setMatchHistory(updatedHistory);
              setGlobalBanList(b => [...b, ...(simulationData.usedChamps || [])]);

              const target = match.format === 'BO5' ? 3 : 2;
              if (nA >= target || nB >= target) {
                if (onMatchComplete) {
                  onMatchComplete(match, {
                    winner: nA > nB ? teamA.name : teamB.name,
                    scoreA: nA,
                    scoreB: nB,
                    scoreString: `${nA}:${nB}`,
                    history: updatedHistory
                  });
                }
              } else {
                setCurrentSet(s => s + 1);
                setPhase('READY');
              }
            }} className="text-2xl font-bold bg-blue-600 px-8 py-3 rounded hover:bg-blue-500">NEXT</button>
          </div>
        )}
      </div>
    </div>
  );
}


// --- Dashboard ---
function Dashboard() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const [league, setLeague] = useState(null);
  const [viewingTeamId, setViewingTeamId] = useState(null);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [prizeMoney, setPrizeMoney] = useState(0.0);
  const [showPlayInBracket, setShowPlayInBracket] = useState(false);
  const [isLiveGameMode, setIsLiveGameMode] = useState(false);
  const [liveMatchData, setLiveMatchData] = useState(null);

  // 드래프트 상태
  const [isDrafting, setIsDrafting] = useState(false);
  const [draftPool, setDraftPool] = useState([]);
  const [draftGroups, setDraftGroups] = useState({ baron: [], elder: [] });
  const [draftTurn, setDraftTurn] = useState('user');
  const draftTimeoutRef = useRef(null);

  // 메타 분석 탭 상태
  const [metaRole, setMetaRole] = useState('TOP');

  // 시뮬레이션 결과 모달 상태 (내 경기용 상세 모달)
  const [myMatchResult, setMyMatchResult] = useState(null);

  // 로컬 순위표 상태 (버그 수정용: API 호출 대신 계산된 값 사용)
  const [computedStandings, setComputedStandings] = useState({});

  // 플레이-인/플레이오프 상대 선택 모달 상태
  const [opponentChoice, setOpponentChoice] = useState(null); // { type: 'playin' | 'playoff', ...data }

  useEffect(() => {
    const loadData = () => {
      const found = getLeagueById(leagueId);
      if (found) {
        // 데이터 무결성 검사 및 초기화
        const sanitizedLeague = {
            ...found,
            metaVersion: found.metaVersion || '16.01',
            currentChampionList: found.currentChampionList || championList
        };
        setLeague(sanitizedLeague);
        updateLeague(leagueId, { lastPlayed: new Date().toISOString() });
        setViewingTeamId(sanitizedLeague.team.id);
        recalculateStandings(sanitizedLeague);
      }
    };
    loadData();
  }, [leagueId]);

  // Fix 1: 순위표 재계산 함수 (전체 매치 기록 기반)
  // [수정 1] 순위표 계산 함수 (플레이오프/플레이인 제외 로직 강화)
  const recalculateStandings = (lg) => {
    const newStandings = {};
    teams.forEach(t => { newStandings[t.id] = { w: 0, l: 0, diff: 0 }; });

    lg.matches.forEach(m => {
        // [중요] 플레이인, 플레이오프, TBD 경기는 순위표 계산에서 절대적으로 제외
        if (m.type === 'playin' || m.type === 'playoff' || m.type === 'tbd') return;

        if (m.status === 'finished' && (m.type === 'regular' || m.type === 'super')) {
            const winner = teams.find(t => t.name === m.result.winner);
            // m.t1, m.t2가 ID일 수도 있고 객체일 수도 있으므로 안전하게 처리
            const t1Id = typeof m.t1 === 'object' ? m.t1.id : m.t1;
            const t2Id = typeof m.t2 === 'object' ? m.t2.id : m.t2;
            
            const actualLoserId = (t1Id === winner.id) ? t2Id : t1Id;
            
            if(winner && actualLoserId) {
                newStandings[winner.id].w += 1;
                newStandings[actualLoserId].l += 1;
                
                const scores = m.result.score.split(':').map(Number);
                const diff = Math.abs(scores[0] - scores[1]);
                newStandings[winner.id].diff += diff;
                newStandings[actualLoserId].diff -= diff;
            }
        }
    });
    setComputedStandings(newStandings);
};

  const handleMenuClick = (tabId) => {
    setActiveTab(tabId);
    if (tabId === 'dashboard' && league) {
      setViewingTeamId(league.team.id);
    }
  };

  if (!league) return <div className="flex h-screen items-center justify-center font-bold text-gray-500">데이터 로딩 중... (응답이 없으면 메인에서 초기화해주세요)</div>;
   
  const myTeam = teams.find(t => String(t.id) === String(league.team.id)) || league.team;
  const viewingTeam = teams.find(t => String(t.id) === String(viewingTeamId)) || myTeam;
  const currentRoster = (playerList || []).filter(p => p.팀 === viewingTeam.name);
   
  const isCaptain = myTeam.id === 1 || myTeam.id === 2; 
  const hasDrafted = league.groups && league.groups.baron && league.groups.baron.length > 0;
  
  const nextGlobalMatch = league.matches ? league.matches.find(m => m.status === 'pending') : null;

  const isMyNextMatch = nextGlobalMatch ? (nextGlobalMatch.t1 === myTeam.id || nextGlobalMatch.t2 === myTeam.id) : false;

  const t1 = nextGlobalMatch ? teams.find(t => t.id === nextGlobalMatch.t1) : null;
  const t2 = nextGlobalMatch ? teams.find(t => t.id === nextGlobalMatch.t2) : null;

  const getTeamRoster = (teamName) => {
    const positions = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    const players = playerList.filter(p => p.팀 === teamName);
    return positions.map(pos => players.find(p => p.포지션 === pos) || players[0]); 
  };

  const applyMatchResult = (targetMatch, result) => {
    const updatedMatches = league.matches.map(m => {
        if (m.id === targetMatch.id) {
            return { ...m, status: 'finished', result: { winner: result.winner, score: result.scoreString } };
        }
        return m;
    });

    const updatedLeague = { ...league, matches: updatedMatches };
    updateLeague(league.id, { matches: updatedMatches });
    setLeague(updatedLeague);
    recalculateStandings(updatedLeague); // 순위표 즉시 갱신
    
    checkAndGenerateNextPlayInRound(updatedMatches);
    checkAndGenerateNextPlayoffRound(updatedMatches);
  };

  const generatePlayInRound2 = (matches, seed1, seed2, pickedTeam, remainingTeam) => {
      const r2Matches = [
          { id: Date.now() + 100, t1: seed1.id, t2: pickedTeam.id, date: '2.7 (토)', time: '17:00', type: 'playin', format: 'BO3', status: 'pending', round: 2, label: '플레이-인 2라운드' },
          { id: Date.now() + 101, t1: seed2.id, t2: remainingTeam.id, date: '2.7 (토)', time: '19:30', type: 'playin', format: 'BO3', status: 'pending', round: 2, label: '플레이-인 2라운드' }
      ];
      
      const newMatches = [...matches, ...r2Matches].sort((a,b) => parseFloat(a.date.split(' ')[0]) - parseFloat(b.date.split(' ')[0]));
      updateLeague(league.id, { matches: newMatches });
      setLeague(prev => ({ ...prev, matches: newMatches }));
      alert("플레이-인 2라운드 대진이 완성되었습니다!");
      setOpponentChoice(null);
  };

  const checkAndGenerateNextPlayInRound = (matches) => {
      // 1라운드(2.6)가 모두 끝났는지 확인
      const r1Matches = matches.filter(m => m.type === 'playin' && m.date.includes('2.6'));
      const r1Finished = r1Matches.length > 0 && r1Matches.every(m => m.status === 'finished');
      const r2Exists = matches.some(m => m.type === 'playin' && m.date.includes('2.7'));

      if (r1Finished && !r2Exists) {
          const r1Winners = r1Matches.map(m => teams.find(t => t.name === m.result.winner));
          const playInSeeds = league.playInSeeds || []; 
          const seed1 = teams.find(t => t.id === playInSeeds[0].id);
          const seed2 = teams.find(t => t.id === playInSeeds[1].id);
          
          const winnersWithSeed = r1Winners.map(w => ({ ...w, seedIndex: playInSeeds.findIndex(s => s.id === w.id) }));
          winnersWithSeed.sort((a, b) => a.seedIndex - b.seedIndex);
          
          if (seed1.id === myTeam.id) {
              setOpponentChoice({
                  type: 'playin',
                  title: '플레이-인 2라운드 상대 선택',
                  description: '1라운드 승리팀 중 한 팀을 2라운드 상대로 지명할 수 있습니다.',
                  picker: seed1,
                  opponents: winnersWithSeed,
                  onConfirm: (pickedTeam) => {
                      const remainingTeam = winnersWithSeed.find(w => w.id !== pickedTeam.id);
                      generatePlayInRound2(matches, seed1, seed2, pickedTeam, remainingTeam);
                  }
              });
              return;
          } else {
              const lowerSeedWinner = winnersWithSeed[1]; 
              const higherSeedWinner = winnersWithSeed[0];
              
              let pickedTeam;
              if (Math.random() < 0.65) {
                  pickedTeam = lowerSeedWinner; 
              } else {
                  pickedTeam = higherSeedWinner;
              }
              const remainingTeam = (pickedTeam.id === lowerSeedWinner.id) ? higherSeedWinner : lowerSeedWinner;
              
              generatePlayInRound2(matches, seed1, seed2, pickedTeam, remainingTeam);
          }
      }

      // 2라운드(2.7)가 모두 끝났는지 확인 -> 최종전 생성
      const r2Matches = matches.filter(m => m.type === 'playin' && m.date.includes('2.7'));
      const r2Finished = r2Matches.length > 0 && r2Matches.every(m => m.status === 'finished');
      const finalExists = matches.some(m => m.type === 'playin' && m.date.includes('2.8'));

      if (r2Finished && !finalExists) {
          const losers = r2Matches.map(m => {
             const winnerName = m.result.winner;
             return m.t1 === teams.find(t=>t.name===winnerName).id ? teams.find(t=>t.id===m.t2) : teams.find(t=>t.id===m.t1);
          });

          const finalMatch = { 
              id: Date.now() + 200, t1: losers[0].id, t2: losers[1].id, date: '2.8 (일)', time: '17:00', type: 'playin', format: 'BO5', status: 'pending', round: 3, label: '플레이-인 최종전'
          };
          
          const newMatches = [...matches, finalMatch].sort((a,b) => parseFloat(a.date.split(' ')[0]) - parseFloat(b.date.split(' ')[0]));
          updateLeague(league.id, { matches: newMatches });
          setLeague(prev => ({ ...prev, matches: newMatches }));
          alert("플레이-인 최종전 대진이 완성되었습니다!");
      }
  };

  const checkAndGenerateNextPlayoffRound = (currentMatches) => {
    if (!league.playoffSeeds) return;

    const getWinner = m => teams.find(t => t.name === m.result.winner).id;
    const getLoser = m => (m.t1 === getWinner(m) ? m.t2 : m.t1);

    // --- R1 -> R2 (Winners/Losers) ---
    const r1Matches = currentMatches.filter(m => m.type === 'playoff' && m.round === 1);
    const r1Finished = r1Matches.length === 2 && r1Matches.every(m => m.status === 'finished');
    const r2Exists = currentMatches.some(m => m.type === 'playoff' && m.round === 2);

    if (r1Finished && !r2Exists) {
        const r1Winners = r1Matches.map(m => ({ id: getWinner(m), fromMatch: m.match }));
        const r1Losers = r1Matches.map(m => ({ id: getLoser(m), fromMatch: m.match }));
        
        const seed1 = league.playoffSeeds.find(s => s.seed === 1).id;
        const seed2 = league.playoffSeeds.find(s => s.seed === 2).id;

        const generateR2Matches = (pickedWinner) => {
            const remainingWinner = r1Winners.find(w => w.id !== pickedWinner.id).id;
            
            const newPlayoffMatches = [
                // R2 Winners
                { id: Date.now() + 400, round: 2, match: 1, label: '승자조 2R', t1: seed1, t2: pickedWinner.id, date: '2.13 (금)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: seed1 },
                { id: Date.now() + 401, round: 2, match: 2, label: '승자조 2R', t1: seed2, t2: remainingWinner, date: '2.13 (금)', time: '19:30', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: seed2 },
                // R2 Losers
                { id: Date.now() + 402, round: 2.1, match: 1, label: '패자조 1R', t1: r1Losers[0].id, t2: r1Losers[1].id, date: '2.14 (토)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: 'coin' },
            ];
            
            const allMatches = [...currentMatches, ...newPlayoffMatches];
            updateLeague(league.id, { matches: allMatches });
            setLeague(prev => ({ ...prev, matches: allMatches }));
            alert("👑 플레이오프 2라운드 대진이 완성되었습니다!");
            setOpponentChoice(null);
        };

        if (seed1 === myTeam.id) {
            setOpponentChoice({
                type: 'playoff_r2',
                title: '플레이오프 2라운드 상대 선택',
                description: '1라운드 승리팀 중 한 팀을 2라운드 상대로 지명할 수 있습니다.',
                picker: teams.find(t => t.id === seed1),
                opponents: r1Winners.map(w => teams.find(t => t.id === w.id)),
                onConfirm: (pickedTeam) => generateR2Matches(pickedTeam)
            });
            return;
        } else {
            // AI Logic: Pick the winner from the higher-seeded R1 match (3-seed's match) if they win, otherwise pick the other winner.
            const r1m1Winner = getWinner(r1Matches.find(m => m.match === 1));
            const r1m2Winner = getWinner(r1Matches.find(m => m.match === 2));
            const r1m1Seed3 = r1Matches.find(m => m.match === 1).t1;
            
            let pickedId;
            if (r1m1Winner === r1m1Seed3) { // If seed 3 won their match
                pickedId = r1m2Winner; // Pick the other winner
            } else {
                pickedId = r1m1Winner; // Pick the team that beat seed 3
            }
            generateR2Matches(teams.find(t => t.id === pickedId));
        }
        return; // Stop further checks
    }

    // --- R2 -> R3 (Winners/Losers) ---
    const r2wMatches = currentMatches.filter(m => m.type === 'playoff' && m.round === 2);
    const r2lMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 2.1);
    const r2Finished = r2wMatches.length === 2 && r2wMatches.every(m => m.status === 'finished') && r2lMatch?.status === 'finished';
    const r3Exists = currentMatches.some(m => m.type === 'playoff' && m.round === 3);

    if (r2Finished && !r3Exists) {
        const r2wWinners = r2wMatches.map(m => getWinner(m));
        const r2wLosers = r2wMatches.map(m => ({ id: getLoser(m), seed: (league.playoffSeeds.find(s => s.id === getLoser(m)) || {seed: 99}).seed }));
        r2wLosers.sort((a,b) => a.seed - b.seed); // Sort by seed, lower is better
        
        const r2lWinner = getWinner(r2lMatch);

        const newPlayoffMatches = [
            // R3 Winners
            { id: Date.now() + 500, round: 3, match: 1, label: '승자조 결승', t1: r2wWinners[0], t2: r2wWinners[1], date: '2.18 (수)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: 'coin' },
            // R2 Losers R2
            { id: Date.now() + 501, round: 2.2, match: 1, label: '패자조 2R', t1: r2wLosers[1].id, t2: r2lWinner, date: '2.15 (일)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: r2wLosers[1].id },
        ];

        const allMatches = [...currentMatches, ...newPlayoffMatches];
        updateLeague(league.id, { matches: allMatches });
        setLeague(prev => ({ ...prev, matches: allMatches }));
        alert("👑 플레이오프 3라운드 승자조 및 2라운드 패자조 경기가 생성되었습니다!");
        return;
    }
    
    // --- R2.2 & R3 Winners -> R3 Losers ---
    const r2_2Match = currentMatches.find(m => m.type === 'playoff' && m.round === 2.2);
    const r3wMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 3);
    const r3lExists = currentMatches.some(m => m.type === 'playoff' && m.round === 3.1);

    if (r2_2Match?.status === 'finished' && r3wMatch?.status === 'finished' && !r3lExists) {
        // BUG FIX: The loser from the WINNERS bracket (r2wMatches) should drop down, not the loser from the losers bracket.
        const r2wMatchesFinished = currentMatches.filter(m => m.round === 2 && m.status === 'finished');
        const r2wLosers = r2wMatchesFinished.map(m => ({ id: getLoser(m), seed: (league.playoffSeeds.find(s => s.id === getLoser(m)) || {seed: 99}).seed }));
        r2wLosers.sort((a,b) => a.seed - b.seed); // Higher seed is r2wLosers[0]
        
        const r2_2Winner = getWinner(r2_2Match);

        const newMatch = { id: Date.now() + 600, round: 3.1, match: 1, label: '패자조 3R', t1: r2wLosers[0].id, t2: r2_2Winner, date: '2.19 (목)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: r2wLosers[0].id };
        
        const allMatches = [...currentMatches, newMatch];
        updateLeague(league.id, { matches: allMatches });
        setLeague(prev => ({ ...prev, matches: allMatches }));
        alert("👑 플레이오프 3라운드 패자조 경기가 생성되었습니다!");
        return;
    }

    // --- R3 Losers & R3 Winners -> R4 (Finals Qualifier) ---
    const r3lMatch = currentMatches.find(m => m.type === 'playoff' && m.round === 3.1);
    const r4Exists = currentMatches.some(m => m.type === 'playoff' && m.round === 4);

    if (r3lMatch?.status === 'finished' && r3wMatch?.status === 'finished' && !r4Exists) {
        const r3wLoser = getLoser(r3wMatch);
        const r3lWinner = getWinner(r3lMatch);

        const newMatch = { id: Date.now() + 700, round: 4, match: 1, label: '결승 진출전', t1: r3wLoser, t2: r3lWinner, date: '2.21 (토)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: r3wLoser };
        
        const allMatches = [...currentMatches, newMatch];
        updateLeague(league.id, { matches: allMatches });
        setLeague(prev => ({ ...prev, matches: allMatches }));
        alert("👑 플레이오프 결승 진출전이 생성되었습니다!");
        return;
    }

    // --- R4 & R3 Winners -> Grand Final ---
    const r4Match = currentMatches.find(m => m.type === 'playoff' && m.round === 4);
    const finalExists = currentMatches.some(m => m.type === 'playoff' && m.round === 5);

    if (r4Match?.status === 'finished' && r3wMatch?.status === 'finished' && !finalExists) {
        const r3wWinner = getWinner(r3wMatch);
        const r4Winner = getWinner(r4Match);

        const newMatch = { id: Date.now() + 800, round: 5, match: 1, label: '결승전', t1: r3wWinner, t2: r4Winner, date: '2.22 (일)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: r3wWinner };
        
        const allMatches = [...currentMatches, newMatch];
        updateLeague(league.id, { matches: allMatches });
        setLeague(prev => ({ ...prev, matches: allMatches }));
        alert("🏆 대망의 결승전이 생성되었습니다!");
        return;
    }
  };

  const runSimulationForMatch = (match, isPlayerMatch) => {
    const t1Obj = teams.find(t => t.id === match.t1);
    const t2Obj = teams.find(t => t.id === match.t2);

    const simOptions = {
        currentChampionList: league.currentChampionList,
        difficulty: isPlayerMatch ? league.difficulty : undefined,
        playerTeamName: isPlayerMatch ? myTeam.name : undefined,
    };

    const result = simulateMatch(
      { name: t1Obj.name, roster: getTeamRoster(t1Obj.name) },
      { name: t2Obj.name, roster: getTeamRoster(t2Obj.name) },
      match.format,
      simOptions
    );

    if (isPlayerMatch) {
        setMyMatchResult({
            resultData: result,
            teamA: t1Obj,
            teamB: t2Obj
        });
    }
    
    applyMatchResult(match, result);
  };

  const handleProceedNextMatch = () => {
    if (!nextGlobalMatch || isMyNextMatch) return;
    runSimulationForMatch(nextGlobalMatch, false);
  };

// ==========================================
  // [수정됨] Dashboard 내부 로직 통합 (여기서부터 복사하세요)
  // ==========================================

  // [1] 내 경기 시작하기 (안전장치 추가됨)
  const handleStartMyMatch = () => {
  try {
    // 1. 경기 데이터 확인
    if (!nextGlobalMatch) {
      alert("진행할 경기가 없습니다.");
      return;
    }

    // 2. 팀 ID 정규화 (숫자로 변환)
    const t1Id = typeof nextGlobalMatch.t1 === 'object' ? nextGlobalMatch.t1.id : parseInt(nextGlobalMatch.t1);
    const t2Id = typeof nextGlobalMatch.t2 === 'object' ? nextGlobalMatch.t2.id : parseInt(nextGlobalMatch.t2);

    // 3. 팀 객체 찾기
    const t1Obj = teams.find(t => t.id === t1Id);
    const t2Obj = teams.find(t => t.id === t2Id);

    if (!t1Obj || !t2Obj) {
      console.error("팀 찾기 실패:", { t1Id, t2Id, nextGlobalMatch });
      alert(`팀 데이터 오류! T1 ID: ${t1Id}, T2 ID: ${t2Id}`);
      return;
    }

    // 4. 로스터 가져오기 (안전 장치 추가)
    const t1Roster = getTeamRoster(t1Obj.name);
    const t2Roster = getTeamRoster(t2Obj.name);

    if (!t1Roster || t1Roster.length < 5) {
      alert(`${t1Obj.name} 로스터가 부족합니다. (현재: ${t1Roster?.length || 0}명)`);
      return;
    }
    if (!t2Roster || t2Roster.length < 5) {
      alert(`${t2Obj.name} 로스터가 부족합니다. (현재: ${t2Roster?.length || 0}명)`);
      return;
    }

    // 5. 라이브 매치 데이터 설정
    console.log("경기 시작:", {
      match: nextGlobalMatch,
      teamA: t1Obj.name,
      teamB: t2Obj.name,
      rosterA: t1Roster.length,
      rosterB: t2Roster.length
    });

    setLiveMatchData({
      match: nextGlobalMatch,
      teamA: { ...t1Obj, roster: t1Roster },
      teamB: { ...t2Obj, roster: t2Roster }
    });
    
    setIsLiveGameMode(true);

  } catch (error) {
    console.error("경기 시작 오류:", error);
    alert(`경기 시작 실패: ${error.message}`);
  }
};

  // [2] 경기 종료 처리 (이 함수가 없으면 흰 화면 뜸)
  const handleLiveMatchComplete = (match, resultData) => {
    // 1. 매치 결과 업데이트
    const updatedMatches = league.matches.map(m => {
        if (m.id === match.id) {
            return {
                ...m,
                status: 'finished',
                result: {
                    winner: resultData.winner,
                    score: resultData.scoreString
                }
            };
        }
        return m;
    });

    // 2. 리그 데이터 저장 및 상태 갱신
    const updatedLeague = { ...league, matches: updatedMatches };
    updateLeague(league.id, updatedLeague);
    setLeague(updatedLeague);
    recalculateStandings(updatedLeague);

    // 3. 다음 라운드 생성 체크 (플레이인/플레이오프)
    checkAndGenerateNextPlayInRound(updatedMatches);
    checkAndGenerateNextPlayoffRound(updatedMatches);

    // 4. 모달 닫기 및 데이터 초기화
    setIsLiveGameMode(false);
    setLiveMatchData(null);
    
    // 5. 알림
    setTimeout(() => alert(`경기 종료! 승리: ${resultData.winner}`), 100);
  };

  // [3] 드래프트 시작 핸들러
  const handleDraftStart = () => {
    if (hasDrafted) return;
    setIsDrafting(true);
    const pool = teams.filter(t => t.id !== 1 && t.id !== 2);
    setDraftPool(pool);
    setDraftGroups({ baron: [1], elder: [2] }); 

    if (isCaptain) {
        if (myTeam.id === 1) { setDraftTurn('user'); } 
        else { setDraftTurn('cpu'); triggerCpuPick(pool, { baron: [1], elder: [2] }, 'cpu'); }
    } else {
        handleAutoDraft(pool);
    }
  };

  const pickComputerTeam = (available) => {
    const sorted = [...available].sort((a, b) => b.power - a.power);
    const topTeam = sorted[0];
    const topPower = topTeam.power;
    let chance = 0.5;
    if (topPower >= 84) chance = 0.90; else if (topPower >= 80) chance = 0.70;
    if (Math.random() < chance) return topTeam;
    if (available.length > 1) {
        const others = available.filter(t => t.id !== topTeam.id);
        return others[Math.floor(Math.random() * others.length)];
    }
    return topTeam;
  };

  const triggerCpuPick = (currentPool, currentGroups, turn) => {
    draftTimeoutRef.current = setTimeout(() => {
        if (currentPool.length === 0) { finalizeDraft(currentGroups); return; }
        const picked = pickComputerTeam(currentPool);
        const newPool = currentPool.filter(t => t.id !== picked.id);
        let newGroups = { ...currentGroups };
        if (myTeam.id === 1) newGroups.elder.push(picked.id); else newGroups.baron.push(picked.id);
        setDraftPool(newPool); setDraftGroups(newGroups); setDraftTurn('user');
        if (newPool.length === 0) finalizeDraft(newGroups);
    }, 800);
  };

  const handleUserPick = (teamId) => {
    if (draftTurn !== 'user') return;
    const picked = teams.find(t => t.id === teamId);
    const newPool = draftPool.filter(t => t.id !== teamId);
    let newGroups = { ...draftGroups };
    if (myTeam.id === 1) newGroups.baron.push(picked.id); else newGroups.elder.push(picked.id);
    setDraftPool(newPool); setDraftGroups(newGroups); setDraftTurn('cpu'); 
    if (newPool.length === 0) finalizeDraft(newGroups); else triggerCpuPick(newPool, newGroups, 'cpu');
  };

  const handleAutoDraft = (pool) => {
    let currentPool = [...pool];
    let baron = [1]; let elder = [2];
    let turn = 0; 
    while (currentPool.length > 0) {
        const picked = pickComputerTeam(currentPool);
        currentPool = currentPool.filter(t => t.id !== picked.id);
        if (turn === 0) baron.push(picked.id); else elder.push(picked.id);
        turn = 1 - turn;
    }
    finalizeDraft({ baron, elder });
  };

  const finalizeDraft = (groups) => {
    const matches = generateSchedule(groups.baron, groups.elder);
    const updated = updateLeague(league.id, { groups, matches });
    if (updated) {
      setLeague(prev => ({...prev, ...updated}));
      setTimeout(() => { setIsDrafting(false); setActiveTab('standings'); alert("팀 구성 및 일정이 완료되었습니다!"); }, 500);
    }
  };

  const handlePrevTeam = () => { const idx = teams.findIndex(t => t.id === viewingTeam.id); setViewingTeamId(teams[(idx - 1 + teams.length) % teams.length].id); };
  const handleNextTeam = () => { const idx = teams.findIndex(t => t.id === viewingTeam.id); setViewingTeamId(teams[(idx + 1) % teams.length].id); };

  const menuItems = [
    { id: 'dashboard', name: '대시보드', icon: '📊' },
    { id: 'roster', name: '로스터', icon: '👥' },
    { id: 'standings', name: '순위표', icon: '🏆' },
    { id: 'playoffs', name: '플레이오프', icon: '👑' },
    { id: 'finance', name: '재정', icon: '💰' }, 
    { id: 'schedule', name: '일정', icon: '📅' },
    { id: 'team_schedule', name: '팀 일정', icon: '📅' },
    { id: 'meta', name: '메타', icon: '📈' }, 
  ];
  
  const myRecord = computedStandings[myTeam.id] || { w: 0, l: 0, diff: 0 };
  const finance = teamFinanceData[viewingTeam.name] || { total_expenditure: 0, cap_expenditure: 0, luxury_tax: 0 };

  const getSortedGroup = (groupIds) => {
    return groupIds.sort((a, b) => {
      const recA = computedStandings[a] || { w: 0, diff: 0 };
      const recB = computedStandings[b] || { w: 0, diff: 0 };
      if (recA.w !== recB.w) return recB.w - recA.w;
      return recB.diff - recA.diff;
    });
  };

  const calculateGroupScore = (groupType) => {
    if (!league.groups || !league.groups[groupType]) return 0;
    const groupIds = league.groups[groupType];
    return league.matches.filter(m => {
        if (m.status !== 'finished') return false;
        // IMPORTANT: exclude playin / playoff / tbd (group score only from regular / super)
        if (m.type === 'playin' || m.type === 'playoff' || m.type === 'tbd') return false;
        const winnerTeam = teams.find(t => t.name === m.result.winner);
        if (!winnerTeam) return false;
        return groupIds.includes(winnerTeam.id);
    }).reduce((acc, m) => acc + (m.type === 'super' ? 2 : 1), 0);
  };

  const baronTotalWins = calculateGroupScore('baron');
  const elderTotalWins = calculateGroupScore('elder');

  const updateChampionMeta = (currentChamps) => {
    const probabilities = {
        1: { 1: 0.40, 2: 0.40, 3: 0.15, 4: 0.04, 5: 0.01 },
        2: { 1: 0.25, 2: 0.40, 3: 0.25, 4: 0.08, 5: 0.02 },
        3: { 1: 0.07, 2: 0.23, 3: 0.40, 4: 0.23, 5: 0.07 },
        4: { 1: 0.02, 2: 0.08, 3: 0.25, 4: 0.40, 5: 0.25 },
        5: { 1: 0.01, 2: 0.04, 3: 0.15, 4: 0.25, 5: 0.40 },
    };

    const getNewTier = (currentTier) => {
        const rand = Math.random();
        let cumulative = 0;
        const chances = probabilities[currentTier];
        for (const tier in chances) {
            cumulative += chances[tier];
            if (rand < cumulative) {
                return parseInt(tier, 10);
            }
        }
        return currentTier; 
    };

    const newChampionList = currentChamps.map(champ => {
        let newTier = getNewTier(champ.tier);
        return { ...champ, tier: newTier };
    });

    return newChampionList;
  };

  const handleGenerateSuperWeek = () => {
    const newChampionList = updateChampionMeta(league.currentChampionList);
    const newMetaVersion = '16.02';

    const baronSorted = getSortedGroup([...league.groups.baron]);
    const elderSorted = getSortedGroup([...league.groups.elder]);
    let newMatches = [];
    const days = ['1.28 (수)', '1.29 (목)', '1.30 (금)', '1.31 (토)', '2.1 (일)']; 

    let pairs = [];
    for(let i=0; i<5; i++) {
        pairs.push({ t1: baronSorted[i], t2: elderSorted[i], rank: i+1 });
    }
    pairs.sort(() => Math.random() - 0.5);

    const cleanMatches = league.matches.filter(m => m.type !== 'tbd');

    pairs.forEach((pair, idx) => {
        newMatches.push({
            id: Date.now() + idx,
            t1: pair.t1,
            t2: pair.t2,
            date: days[idx] || '2.1 (일)', 
            time: '17:00',
            type: 'super', 
            format: 'BO5', 
            status: 'pending'
        });
    });

    const updatedMatches = [...cleanMatches, ...newMatches];
    updatedMatches.sort((a, b) => {
        const dayA = parseFloat(a.date.split(' ')[0]);
        const dayB = parseFloat(b.date.split(' ')[0]);
        return dayA - dayB;
    });

    updateLeague(league.id, { 
        matches: updatedMatches,
        currentChampionList: newChampionList,
        metaVersion: newMetaVersion
    });
    setLeague(prev => ({ 
        ...prev, 
        matches: updatedMatches,
        currentChampionList: newChampionList,
        metaVersion: newMetaVersion
    }));
    alert(`🔥 슈퍼위크 일정이 생성되고, 메타가 16.02 패치로 변경되었습니다!`);
  };

  const handleGeneratePlayIn = () => {
      let isBaronWinner;
      if (baronTotalWins > elderTotalWins) {
        isBaronWinner = true;
      } else if (baronTotalWins < elderTotalWins) {
        isBaronWinner = false;
      } else {
        const baronDiffTotal = (league.groups?.baron || []).reduce((s, id) => s + ((computedStandings[id]?.diff) || 0), 0);
        const elderDiffTotal = (league.groups?.elder || []).reduce((s, id) => s + ((computedStandings[id]?.diff) || 0), 0);

        if (baronDiffTotal > elderDiffTotal) isBaronWinner = true;
        else if (baronDiffTotal < elderDiffTotal) isBaronWinner = false;
        else {
          const baronPower = (league.groups?.baron || []).reduce((s, id) => s + ((teams.find(t => t.id === id)?.power) || 0), 0);
          const elderPower = (league.groups?.elder || []).reduce((s, id) => s + ((teams.find(t => t.id === id)?.power) || 0), 0);
          if (baronPower > elderPower) isBaronWinner = true;
          else if (baronPower < elderPower) isBaronWinner = false;
          else isBaronWinner = Math.random() < 0.5;
        }
      }
      
      const baronSorted = getSortedGroup([...league.groups.baron]);
      const elderSorted = getSortedGroup([...league.groups.elder]);

      const seasonSummary = {
          winnerGroup: isBaronWinner ? 'Baron' : 'Elder',
          poTeams: [],
          playInTeams: [],
          eliminated: null
      };

      let playInTeams = [];
      
      if (isBaronWinner) {
          seasonSummary.poTeams.push({ id: baronSorted[0], seed: 1 });
          seasonSummary.poTeams.push({ id: baronSorted[1], seed: 2 });
          playInTeams.push(baronSorted[2], baronSorted[3], baronSorted[4]);

          seasonSummary.poTeams.push({ id: elderSorted[0], seed: 3 });
          playInTeams.push(elderSorted[1], elderSorted[2], elderSorted[3]);
          seasonSummary.eliminated = elderSorted[4];
      } else {
          seasonSummary.poTeams.push({ id: elderSorted[0], seed: 1 });
          seasonSummary.poTeams.push({ id: elderSorted[1], seed: 2 });
          playInTeams.push(elderSorted[2], elderSorted[3], elderSorted[4]);

          seasonSummary.poTeams.push({ id: baronSorted[0], seed: 3 });
          playInTeams.push(baronSorted[1], baronSorted[2], baronSorted[3]);
          seasonSummary.eliminated = baronSorted[4];
      }

      playInTeams.sort((a, b) => {
          const recA = computedStandings[a];
          const recB = computedStandings[b];
          if (recA.w !== recB.w) return recB.w - recA.w;
          if (recA.diff !== recB.diff) return recB.diff - recA.diff;
          return Math.random() - 0.5;
      });

      const seededTeams = playInTeams.map((tid, idx) => ({ id: tid, seed: idx + 1 }));
      seasonSummary.playInTeams = seededTeams;
      
      const seed3 = seededTeams[2].id;
      const seed6 = seededTeams[5].id;
      const seed4 = seededTeams[3].id;
      const seed5 = seededTeams[4].id;

      const newMatches = [
          { id: Date.now() + 1, t1: seed3, t2: seed6, date: '2.6 (금)', time: '17:00', type: 'playin', format: 'BO3', status: 'pending', round: 1, label: '플레이-인 1라운드' },
          { id: Date.now() + 2, t1: seed4, t2: seed5, date: '2.6 (금)', time: '19:30', type: 'playin', format: 'BO3', status: 'pending', round: 1, label: '플레이-인 1라운드' }
      ];

      const updatedMatches = [...league.matches, ...newMatches];
      
      updateLeague(league.id, { matches: updatedMatches, playInSeeds: seededTeams, seasonSummary }); 
      setLeague(prev => ({ ...prev, matches: updatedMatches, playInSeeds: seededTeams, seasonSummary }));
      setShowPlayInBracket(true);
      alert('🛡️ 플레이-인 대진이 생성되었습니다! (1,2시드 2라운드 직행)');
  };
  
  const isRegularSeasonFinished = league.matches 
    ? league.matches.filter(m => m.type === 'regular').every(m => m.status === 'finished') 
    : false;
  
  const hasSuperWeekGenerated = league.matches
    ? league.matches.some(m => m.type === 'super')
    : false;

  const isSuperWeekFinished = league.matches
    ? league.matches.filter(m => m.type === 'super').length > 0 && league.matches.filter(m => m.type === 'super').every(m => m.status === 'finished')
    : false;

  const hasPlayInGenerated = league.matches
    ? league.matches.some(m => m.type === 'playin')
    : false;
    
  const isPlayInFinished = hasPlayInGenerated && league.matches.filter(m => m.type === 'playin').every(m => m.status === 'finished');
    
  const hasPlayoffsGenerated = league.matches
    ? league.matches.some(m => m.type === 'playoff')
    : false;

  const handleGeneratePlayoffs = () => {
    if (!isPlayInFinished || hasPlayoffsGenerated) return;

    const directPO = league.seasonSummary.poTeams;
    const playInR2Winners = league.matches
        .filter(m => m.type === 'playin' && m.date.includes('2.7') && m.status === 'finished')
        .map(m => teams.find(t => t.name === m.result.winner).id);
    const playInFinalWinner = league.matches
        .filter(m => m.type === 'playin' && m.date.includes('2.8') && m.status === 'finished')
        .map(m => teams.find(t => t.name === m.result.winner).id);
    
    const playInQualifiers = [...playInR2Winners, ...playInFinalWinner];

    const playInQualifiersWithOriginalSeed = playInQualifiers.map(id => {
        const originalSeed = league.playInSeeds.find(s => s.id === id);
        return { id, originalSeed: originalSeed ? originalSeed.seed : 99 };
    }).sort((a, b) => a.originalSeed - b.originalSeed);

    const playoffSeeds = [
        ...directPO,
        { id: playInQualifiersWithOriginalSeed[0].id, seed: 4 },
        { id: playInQualifiersWithOriginalSeed[1].id, seed: 5 },
        { id: playInQualifiersWithOriginalSeed[2].id, seed: 6 },
    ].sort((a, b) => a.seed - b.seed);

    const seed3Team = playoffSeeds.find(s => s.seed === 3);
    const playInTeamsForSelection = playoffSeeds.filter(s => s.seed >= 4);

    const generateR1Matches = (pickedTeam) => {
        const remainingTeams = playInTeamsForSelection.filter(t => t.id !== pickedTeam.id);
        const r1m1 = { id: Date.now() + 300, round: 1, match: 1, label: '1라운드', t1: seed3Team.id, t2: pickedTeam.id, date: '2.11 (수)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: seed3Team.id };
        const r1m2 = { id: Date.now() + 301, round: 1, match: 2, label: '1라운드', t1: remainingTeams[0].id, t2: remainingTeams[1].id, date: '2.12 (목)', time: '17:00', type: 'playoff', format: 'BO5', status: 'pending', blueSidePriority: 'coin' };
        
        if (Math.random() < 0.5) {
            [r1m1.date, r1m2.date] = [r1m2.date, r1m1.date];
        }

        const newMatches = [...league.matches, r1m1, r1m2];
        updateLeague(league.id, { matches: newMatches, playoffSeeds });
        setLeague(prev => ({ ...prev, matches: newMatches, playoffSeeds }));
        alert("👑 플레이오프 1라운드 대진이 완성되었습니다!");
        setOpponentChoice(null);
        setActiveTab('playoffs');
    };

    if (seed3Team.id === myTeam.id) {
        setOpponentChoice({
            type: 'playoff_r1',
            title: '플레이오프 1라운드 상대 선택',
            description: '플레이-인에서 올라온 팀 중 한 팀을 상대로 지명할 수 있습니다.',
            picker: teams.find(t => t.id === seed3Team.id),
            opponents: playInTeamsForSelection.map(s => teams.find(t => t.id === s.id)),
            onConfirm: (pickedTeam) => generateR1Matches(pickedTeam)
        });
    } else {
        const picked = playInTeamsForSelection.find(s => s.seed === 6);
        generateR1Matches(teams.find(t => t.id === picked.id));
    }
  };

  const grandFinal = league.matches.find(m => m.type === 'playoff' && m.round === 5);
  const isSeasonOver = grandFinal && grandFinal.status === 'finished';

  const parseDate = (dateStr) => {
    if (!dateStr || typeof dateStr !== 'string') return 0;
    const parts = dateStr.split(' ')[0].split('.');
    if (parts.length < 2) return 0;
    return parseFloat(parts[0]) * 100 + parseFloat(parts[1]);
  };

  let effectiveDate;
  if (isSeasonOver) {
    effectiveDate = '시즌 종료';
  } else if (nextGlobalMatch) {
    effectiveDate = nextGlobalMatch.date;
  } else if (hasDrafted) {
    const lastMatch = league.matches.filter(m => m.status === 'finished').sort((a,b) => parseDate(b.date) - parseDate(a.date))[0];
    if (isPlayInFinished) effectiveDate = "2.9 (월) 이후";
    else if (isSuperWeekFinished) effectiveDate = "2.2 (월) 이후";
    else if (isRegularSeasonFinished) effectiveDate = "1.26 (월) 이후";
    else effectiveDate = lastMatch ? `${lastMatch.date} 이후` : '대진 생성 대기 중';
  } else {
    effectiveDate = '2026 프리시즌';
  }

  const getTeamSeed = (teamId, matchType) => {
    const seedData = matchType === 'playin' ? league.playInSeeds : league.playoffSeeds;
    return seedData?.find(s => s.id === teamId)?.seed;
  };
  const formatTeamName = (teamId, matchType) => {
    const t = teams.find(x => x.id === teamId);
    if (!t) return 'TBD';
    
    let name = t.name;
    if ((matchType === 'playin' || matchType === 'playoff') && (league.playInSeeds || league.playoffSeeds)) {
      const s = getTeamSeed(teamId, matchType);
      if (s) {
        name = `${t.name} (${s}시드)`;
      }
    }
    return name;
  };

  const MatchupBox = ({ match, showScore = true }) => {
    if (!match || (!match.t1 && !match.t2)) {
        return <div className="h-16 border-2 border-dashed rounded-lg flex items-center justify-center text-gray-400 text-sm w-full">TBD</div>;
    }
    const t1 = teams.find(t => t.id === match.t1);
    const t2 = teams.find(t => t.id === match.t2);
    const winnerId = match.status === 'finished' ? teams.find(t => t.name === match.result.winner)?.id : null;

    const team1Name = t1 ? formatTeamName(t1.id, match.type) : 'TBD';
    const team2Name = t2 ? formatTeamName(t2.id, match.type) : 'TBD';

    return (
        <div className={`bg-white border-2 rounded-lg shadow-sm w-full ${match.status === 'pending' ? 'border-gray-300' : 'border-gray-400'}`}>
            <div className={`flex justify-between items-center p-2 rounded-t-md ${winnerId === t1?.id ? 'bg-blue-100' : 'bg-gray-50'}`}>
                <span className={`font-bold text-sm ${winnerId === t1?.id ? 'text-blue-700' : 'text-gray-800'}`}>{team1Name}</span>
                {showScore && <span className={`font-black text-sm ${winnerId === t1?.id ? 'text-blue-700' : 'text-gray-500'}`}>{match.status === 'finished' ? match.result.score.split(':')[0] : ''}</span>}
            </div>
            <div className={`flex justify-between items-center p-2 rounded-b-md ${winnerId === t2?.id ? 'bg-blue-100' : 'bg-gray-50'}`}>
                <span className={`font-bold text-sm ${winnerId === t2?.id ? 'text-blue-700' : 'text-gray-800'}`}>{team2Name}</span>
                {showScore && <span className={`font-black text-sm ${winnerId === t2?.id ? 'text-blue-700' : 'text-gray-500'}`}>{match.status === 'finished' ? match.result.score.split(':')[1] : ''}</span>}
            </div>
        </div>
    );
  };

  // ==========================================

  

  return (
    <div className="flex h-screen bg-gray-100 overflow-hidden font-sans relative">
      
      {myMatchResult && (
        <DetailedMatchResultModal 
          result={myMatchResult.resultData} 
          teamA={myMatchResult.teamA}
          teamB={myMatchResult.teamB}
          onClose={() => setMyMatchResult(null)} 
        />
      )}

      {opponentChoice && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl p-8 max-w-lg w-full text-center shadow-2xl">
                <h2 className="text-2xl font-black mb-2">{opponentChoice.title}</h2>
                <p className="text-gray-600 mb-6">{opponentChoice.description}</p>
                <div className="grid grid-cols-2 gap-4">
                    {opponentChoice.opponents.map(opp => (
                        <button 
                            key={opp.id}
                            onClick={() => opponentChoice.onConfirm(opp)}
                            className="p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 bg-white border-gray-200 hover:border-blue-500 hover:shadow-md cursor-pointer"
                        >
                            <div className="w-16 h-16 rounded-full flex items-center justify-center text-white font-bold shadow-sm text-lg" style={{backgroundColor:opp.colors.primary}}>{opp.name}</div>
                            <div className="font-bold text-lg">{opp.fullName}</div>
                            <div className="text-sm bg-gray-100 px-3 py-1 rounded-full font-bold">
                                {getTeamSeed(opp.id, opponentChoice.type.startsWith('playoff') ? 'playoff' : 'playin')} 시드
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
      )}

{isLiveGameMode && liveMatchData && (
  <LiveGamePlayer 
      match={liveMatchData.match}
      teamA={liveMatchData.teamA}
      teamB={liveMatchData.teamB}
      simOptions={{
          currentChampionList: league.currentChampionList,
          difficulty: league.difficulty,
          playerTeamName: myTeam.name
      }}
      // pass the Dashboard-level global bans so the live UI can display them
      externalGlobalBans={globalBanList}
      onMatchComplete={handleLiveMatchComplete}
      onClose={() => setIsLiveGameMode(false)}
  />
)}

      {isDrafting && (
        <div className="absolute inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-8 max-w-4xl w-full text-center shadow-2xl overflow-hidden relative min-h-[500px] flex flex-col">
            <h2 className="text-3xl font-black mb-2">{isCaptain ? "팀 드래프트 진행" : "조 추첨 진행 중..."}</h2>
            {!isCaptain ? (
                <div className="flex-1 flex flex-col items-center justify-center">
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
                    <p className="text-gray-500">젠지와 한화생명이 팀을 고르고 있습니다...</p>
                </div>
            ) : (
                <div className="flex-1 flex flex-col">
                    <div className="flex justify-between items-center bg-gray-100 p-4 rounded-lg mb-6">
                        <div className={`w-1/3 p-3 rounded-lg ${draftTurn === (myTeam.id===1?'user':'cpu') ? 'bg-yellow-100 ring-2 ring-yellow-400' : 'bg-white'}`}>
                            <span className="font-bold text-lg block mb-1">GEN (Baron)</span>
                            <div className="flex flex-wrap gap-1 justify-center">{draftGroups.baron.map(id => <span key={id} className="text-xs bg-gray-800 text-white px-2 py-1 rounded">{teams.find(t=>t.id===id)?.name}</span>)}</div>
                        </div>
                        <div className="w-1/3 text-xl font-bold text-gray-400">VS</div>
                        <div className={`w-1/3 p-3 rounded-lg ${draftTurn === (myTeam.id===2?'user':'cpu') ? 'bg-yellow-100 ring-2 ring-yellow-400' : 'bg-white'}`}>
                            <span className="font-bold text-lg block mb-1">HLE (Elder)</span>
                            <div className="flex flex-wrap gap-1 justify-center">{draftGroups.elder.map(id => <span key={id} className="text-xs bg-gray-800 text-white px-2 py-1 rounded">{teams.find(t=>t.id===id)?.name}</span>)}</div>
                        </div>
                    </div>
                    <div className="text-left mb-2 font-bold text-gray-700">{draftTurn === 'user' ? "👉 영입할 팀을 선택하세요!" : "🤖 상대가 고민 중입니다..."}</div>
                    <div className="grid grid-cols-4 gap-3 overflow-y-auto max-h-[300px] p-2">
                        {draftPool.map(t => (
                            <button key={t.id} onClick={() => handleUserPick(t.id)} disabled={draftTurn !== 'user'}
                                className={`p-4 rounded-xl border-2 transition flex flex-col items-center gap-2 hover:shadow-md ${draftTurn === 'user' ? 'bg-white border-gray-200 hover:border-blue-500 cursor-pointer' : 'bg-gray-50 border-gray-100 opacity-50 cursor-not-allowed'}`}>
                                <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold shadow-sm" style={{backgroundColor:t.colors.primary}}>{t.name}</div>
                                <div className="font-bold text-sm">{t.fullName}</div>
                                <div className="text-xs bg-gray-100 px-2 py-1 rounded">전력 {t.power}</div>
                            </button>
                        ))}
                    </div>
                </div>
            )}
          </div>
        </div>
      )}

      <aside className="w-64 bg-gray-900 text-gray-300 flex-shrink-0 flex flex-col shadow-xl z-20">
        <div className="p-5 bg-gray-800 border-b border-gray-700 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white text-xs shadow-lg" style={{backgroundColor: myTeam.colors.primary}}>{myTeam.name}</div>
          <div><div className="text-white font-bold text-sm leading-tight">{myTeam.fullName}</div><div className="text-xs text-gray-400">GM 모드</div></div>
        </div>
        <div className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {menuItems.map(item => (
            <button key={item.id} onClick={() => handleMenuClick(item.id)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-all duration-200 ${activeTab === item.id ? 'bg-blue-600 text-white shadow-md translate-x-1' : 'hover:bg-gray-800 hover:text-white hover:translate-x-1'}`}><span>{item.icon}</span> {item.name}</button>
          ))}
        </div>
        <div className="p-4 border-t border-gray-700 bg-gray-800"><button onClick={() => navigate('/')} className="w-full flex items-center justify-center gap-2 text-xs font-bold text-gray-400 hover:text-white transition"><span>🚪</span> 메인으로 나가기</button></div>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        <header className="bg-white border-b h-14 flex items-center justify-between px-6 shadow-sm z-10 flex-shrink-0">
          <div className="flex items-center gap-6 text-sm">
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">📅</span> {effectiveDate}</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">🏆</span> {myRecord.w}승 {myRecord.l}패 ({myRecord.diff > 0 ? `+${myRecord.diff}` : myRecord.diff})</div>
            <div className="h-4 w-px bg-gray-300"></div>
            <div className="flex items-center gap-2 font-bold text-gray-700"><span className="text-gray-400">💰</span> 상금: {prizeMoney.toFixed(1)}억</div>
          </div>
          
          <div className="flex items-center gap-3">
            {hasDrafted && isRegularSeasonFinished && !hasSuperWeekGenerated && (
                 <button 
                 onClick={handleGenerateSuperWeek} 
                 className="px-5 py-1.5 rounded-full font-bold text-sm bg-purple-600 hover:bg-purple-700 text-white shadow-sm flex items-center gap-2 animate-bounce transition"
               >
                   <span>🔥</span> 슈퍼위크 및 16.02 패치 확인
               </button>
            )}

            {isSuperWeekFinished && !hasPlayInGenerated && (
                <button 
                onClick={handleGeneratePlayIn} 
                className="px-5 py-1.5 rounded-full font-bold text-sm bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-2 animate-bounce transition"
              >
                  <span>🛡️</span> 플레이-인 진출팀 확정
              </button>
            )}

            {isPlayInFinished && !hasPlayoffsGenerated && (
                <button 
                onClick={handleGeneratePlayoffs} 
                className="px-5 py-1.5 rounded-full font-bold text-sm bg-yellow-500 hover:bg-yellow-600 text-white shadow-sm flex items-center gap-2 animate-bounce transition"
              >
                  <span>👑</span> 플레이오프 대진 생성
              </button>
            )}

            {hasDrafted && nextGlobalMatch && !isMyNextMatch && (
                <button 
                  onClick={handleProceedNextMatch} 
                  className="px-5 py-1.5 rounded-full font-bold text-sm bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-2 animate-pulse transition"
                >
                    <span>⏩</span> 다음 경기 진행 ({t1?.name} vs {t2?.name})
                </button>
            )}

            <button onClick={handleDraftStart} disabled={hasDrafted} className={`px-6 py-1.5 rounded-full font-bold text-sm shadow-sm transition flex items-center gap-2 ${hasDrafted ? 'bg-gray-100 text-gray-400 cursor-not-allowed hidden' : 'bg-green-600 hover:bg-green-700 text-white animate-pulse'}`}>
                <span>▶</span> {hasDrafted ? "" : (isCaptain ? "LCK 컵 팀 선정하기" : "LCK 컵 조 확인하기")}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 scroll-smooth">
          <div className="max-w-7xl mx-auto">
              
            {activeTab === 'dashboard' && (
              <div className="grid grid-cols-12 gap-6">
                {/* 대시보드 메인 카드 */}
                <div className="col-span-12 lg:col-span-8 bg-white rounded-lg border shadow-sm p-5 relative overflow-hidden">
                   <div className="absolute top-0 right-0 p-4 opacity-10 text-9xl">📅</div>
                   <h3 className="text-lg font-bold text-gray-800 mb-2">다음 경기 일정</h3>
                   <div className="flex items-center justify-between bg-gray-50 rounded-xl p-6 border">
                      <div className="text-center w-1/3"><div className="text-4xl font-black text-gray-800 mb-2">{t1 ? t1.name : '?'}</div></div>
                      <div className="text-center w-1/3 flex flex-col items-center">
                        <div className="text-xs font-bold text-gray-400 uppercase">VS</div><div className="text-3xl font-bold text-gray-300 my-2">@</div>
                        {nextGlobalMatch ? (
                          <div className="mt-1 flex flex-col items-center">
                            <span className="text-base font-black text-blue-600">{nextGlobalMatch.date}</span>
                            <span className="text-sm font-bold text-gray-600">{nextGlobalMatch.time}</span>
                            <span className="mt-2 text-xs font-bold text-white bg-blue-600 px-3 py-1 rounded-full shadow-sm">
                                {nextGlobalMatch.label || nextGlobalMatch.format}
                            </span>
                            
                            {isMyNextMatch ? (
                                <button onClick={handleStartMyMatch} className="mt-3 px-6 py-3 bg-green-500 hover:bg-green-600 text-white font-bold rounded-lg shadow-lg transform transition hover:scale-105 animate-bounce">
                                    ⚔️ 경기 시작 (직접 플레이)
                                </button>
                            ) : (
                                <div className="mt-3 text-sm font-bold text-gray-400 bg-white px-3 py-1 rounded border">
                                    상단바의 [⏩ 다음 경기 진행]을 눌러주세요
                                </div>
                            )}

                          </div>
                        ) : <div className="text-xs font-bold text-blue-600">{isSeasonOver ? '시즌 종료' : '대진 생성 대기 중'}</div>}
                      </div>
                      <div className="text-center w-1/3">
                          <div className="text-4xl font-black text-gray-800 mb-2">{t2 ? t2.name : '?'}</div>
                      </div>
                   </div>
                </div>
                
                {/* --- 대시보드 우측 (순위표 또는 대진표) --- */}
                <div className="col-span-12 lg:col-span-4 flex flex-col h-full max-h-[500px]">
                   {hasDrafted ? (
                     <div className="bg-white rounded-lg border shadow-sm p-4 h-full overflow-y-auto flex flex-col">
                        
                        <div className="flex justify-between items-center mb-4">
                            <h3 className="font-bold text-gray-800 text-sm">
                                {hasPlayoffsGenerated ? '👑 플레이오프' : (hasPlayInGenerated ? '🛡️ 플레이-인' : '순위표')}
                            </h3>
                            {(hasPlayInGenerated && !hasPlayoffsGenerated) && (
                                <button onClick={() => setShowPlayInBracket(!showPlayInBracket)} className="text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded hover:bg-indigo-200 font-bold">
                                    {showPlayInBracket ? '순위표 보기' : '대진표 보기'}
                                </button>
                            )}
                        </div>

                        {(hasPlayoffsGenerated || (hasPlayInGenerated && showPlayInBracket)) ? (
                            <div className="flex-1 space-y-3">
                                {[...league.matches]
                                    .filter(m => m.type === (hasPlayoffsGenerated ? 'playoff' : 'playin'))
                                    .sort((a,b) => a.id - b.id)
                                    .map(m => (
                                    <div key={m.id} className="bg-gray-50 border rounded p-2 text-xs">
                                        <div className="font-bold text-gray-400 mb-1">{m.label || m.date}</div>
                                        <div className="flex justify-between items-center">
                                            <div className={`font-bold ${m.result?.winner === teams.find(t=>t.id===m.t1)?.name ? 'text-green-600' : 'text-gray-700'}`}>{formatTeamName(m.t1, m.type)}</div>
                                            <div className="text-gray-400 font-bold">{m.status === 'finished' ? m.result.score : 'vs'}</div>
                                            <div className={`font-bold ${m.result?.winner === teams.find(t=>t.id===m.t2)?.name ? 'text-green-600' : 'text-gray-700'}`}>{formatTeamName(m.t2, m.type)}</div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <>
                                <div className="mb-2 text-center text-xs font-bold text-gray-500 bg-gray-100 py-1 rounded">
                                그룹 대항전 총점: <span className="text-purple-600">Baron {baronTotalWins}</span> vs <span className="text-red-600">Elder {elderTotalWins}</span>
                                </div>
                                <div className="space-y-6">
                                    {[
                                        { id: 'baron', name: 'Baron Group', color: 'purple', icon: '🟣' },
                                        { id: 'elder', name: 'Elder Group', color: 'red', icon: '🔴' }
                                    ].map(group => (
                                        <div key={group.id}>
                                            <div className={`flex items-center gap-2 mb-2 border-b border-${group.color}-100 pb-2`}>
                                                <span className="text-lg">{group.icon}</span>
                                                <span className={`font-black text-sm text-${group.color}-700`}>{group.name}</span>
                                            </div>
                                            <table className="w-full text-xs">
                                                <thead className="bg-gray-50 text-gray-400">
                                                    <tr><th className="p-2 text-center w-8">#</th><th className="p-2 text-left">팀</th><th className="p-2 text-center w-12">W-L</th><th className="p-2 text-center w-10">득실</th></tr>
                                                </thead>
                                                <tbody>
                                                    {getSortedGroup(league.groups[group.id] || []).map((id, idx) => {
                                                        const t = teams.find(team => team.id === id);
                                                        const isMyTeam = myTeam.id === id;
                                                        const rec = computedStandings[id] || {w:0, l:0, diff:0};
                                                        
                                                        let statusBadge = null;
                                                        if (league.seasonSummary) {
                                                            const summary = league.seasonSummary;
                                                            const poInfo = summary.poTeams.find(pt => pt.id === id);
                                                            const piInfo = summary.playInTeams.find(pit => pit.id === id);

                                                            if (poInfo) statusBadge = <span className="text-[10px] bg-yellow-100 text-yellow-700 px-1 rounded ml-1 font-bold">PO {poInfo.seed}시드</span>;
                                                            else if (piInfo) statusBadge = <span className="text-[10px] bg-indigo-100 text-indigo-700 px-1 rounded ml-1 font-bold">PI {piInfo.seed}시드</span>;
                                                            else if (summary.eliminated === id) statusBadge = <span className="text-[10px] bg-gray-200 text-gray-500 px-1 rounded ml-1 font-bold">OUT</span>;
                                                        }

                                                        return (
                                                            <tr key={id} onClick={() => setViewingTeamId(id)} className={`cursor-pointer border-b last:border-0 transition-colors ${isMyTeam ? `bg-${group.color}-50` : 'hover:bg-gray-50'}`}>
                                                                <td className="p-2 text-center font-bold text-gray-500">{idx+1}</td>
                                                                <td className="p-2 font-bold flex items-center">
                                                                    <span className={`${isMyTeam ? 'text-blue-700' : 'text-gray-800'} hover:underline`}>{t.fullName}</span>
                                                                    {statusBadge}
                                                                </td>
                                                                <td className="p-2 text-center">{rec.w} - {rec.l}</td><td className="p-2 text-center text-gray-400">{rec.diff > 0 ? `+${rec.diff}` : rec.diff}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}
                     </div>
                   ) : (
                     <div className="bg-white rounded-lg border shadow-sm p-0 flex-1 flex flex-col">
                       <div className="p-3 border-b bg-gray-50 font-bold text-sm text-gray-700 flex justify-between"><span >순위표 (프리시즌)</span><span onClick={()=>setActiveTab('standings')} className="text-xs text-blue-600 cursor-pointer hover:underline">전체 보기</span></div>
                       <div className="flex-1 overflow-y-auto p-0">
                         <div className="p-4 text-center text-gray-400 text-xs">시즌 시작 전입니다.</div>
                       </div>
                     </div>
                   )}
                </div>

                <div className="col-span-12 bg-white rounded-lg border shadow-sm flex flex-col min-h-[500px]">
                  <div className="p-5 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                    <div className="flex items-center gap-4"><div className="w-12 h-12 rounded-full flex items-center justify-center font-bold text-white shadow-sm" style={{backgroundColor: viewingTeam.colors.primary}}>{viewingTeam.name}</div><div><h2 className="text-2xl font-black text-gray-800">{viewingTeam.fullName}</h2><p className="text-xs font-bold text-gray-500 uppercase tracking-wide">로스터 요약</p></div></div>
                    <button onClick={()=>setActiveTab('roster')} className="text-sm font-bold text-blue-600 hover:underline">상세 정보 보기 →</button>
                  </div>
                  <div className="p-0 overflow-x-auto">
                    <table className="w-full text-xs table-fixed text-left">
                        <thead className="bg-white text-gray-400 uppercase font-bold border-b">
                            <tr>
                                <th className="py-2 px-1 w-[8%] text-center">라인</th>
                                <th className="py-2 px-1 w-[20%]">이름</th>
                                <th className="py-2 px-1 w-[8%] text-center">OVR</th>
                                <th className="py-2 px-1 w-[6%] text-center">나이</th>
                                <th className="py-2 px-1 w-[8%] text-center">경력</th>
                                <th className="py-2 px-1 w-[10%] text-center">소속</th>
                                <th className="py-2 px-1 w-[12%] text-center">연봉</th>
                                <th className="py-2 px-1 w-[10%] text-center">POT</th>
                                <th className="py-2 px-1 w-[18%] text-left">계약</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {currentRoster.length > 0 ? currentRoster.map((p, i) => (
                                <tr key={i} className="hover:bg-gray-50 transition">
                                    <td className="py-2 px-1 font-bold text-gray-400 text-center">{p.포지션}</td>
                                    <td className="py-2 px-1 font-bold text-gray-800 truncate">{p.이름} <span className="text-gray-400 font-normal text-[10px] hidden lg:inline">({p.실명})</span> {p.주장 && <span className="text-yellow-500" title="주장">👑</span>}</td>
                                    <td className="py-2 px-1 text-center"><span className={`inline-flex items-center justify-center w-8 h-6 rounded font-black text-xs shadow-sm border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                                    <td className="py-2 px-1 text-center text-gray-600">{p.나이 || '-'}</td>
                                    <td className="py-2 px-1 text-center text-gray-600">{p.경력 || '-'}</td>
                                    <td className="py-2 px-1 text-center text-gray-700">{p['팀 소속기간'] || '-'}</td>
                                    <td className="py-2 px-1 text-center text-gray-700 font-bold truncate">{p.연봉 || '-'}</td>
                                    <td className="py-2 px-1 text-center"><span className={`text-[10px] ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span></td>
                                    <td className="py-2 px-1 text-gray-500 font-medium truncate">{p.계약}</td>
                                </tr>
                            )) : <tr><td colSpan="9" className="py-10 text-center text-gray-300">데이터 없음</td></tr>}
                        </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'standings' && (
               <div className="flex flex-col gap-6">
                 <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">🏆 2026 LCK 컵 순위표</h2>
                 {hasDrafted ? (
                    <div className="flex flex-col gap-4">
                        <div className="bg-gray-800 text-white rounded-lg p-4 text-center font-bold text-lg shadow-sm">
                           🔥 그룹 대항전 스코어: <span className="text-purple-400 text-2xl mx-2">{baronTotalWins}</span> (Baron) vs <span className="text-red-400 text-2xl mx-2">{elderTotalWins}</span> (Elder)
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            {[
                                { id: 'baron', name: 'Baron Group', color: 'purple' },
                                { id: 'elder', name: 'Elder Group', color: 'red' }
                            ].map(group => (
                                <div key={group.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                                    <div className={`p-4 bg-${group.color}-50 border-b border-${group.color}-100 flex items-center gap-2`}>
                                        <h3 className={`font-black text-lg text-${group.color}-900`}>{group.name}</h3>
                                    </div>
                                    <table className="w-full text-sm">
                                        <thead className="bg-gray-50 text-gray-500 font-bold border-b">
                                        <tr>
                                            <th className="py-3 px-4 text-center">순위</th>
                                            <th className="py-3 px-4 text-left">팀</th>
                                            <th className="py-3 px-4 text-center">승</th>
                                            <th className="py-3 px-4 text-center">패</th>
                                            <th className="py-3 px-4 text-center">득실</th>
                                        </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                        {getSortedGroup(league.groups[group.id]).map((id, idx) => {
                                            const t = teams.find(team => team.id === id);
                                            const isMyTeam = myTeam.id === id;
                                            const rec = computedStandings[id] || {w:0, l:0, diff:0};
                                            
                                            let statusBadge = null;
                                            if (league.seasonSummary) {
                                                const summary = league.seasonSummary;
                                                const poInfo = summary.poTeams.find(pt => pt.id === id);
                                                const piInfo = summary.playInTeams.find(pit => pit.id === id);

                                                if (poInfo) statusBadge = <span className="text-xs bg-yellow-100 text-yellow-700 px-2 rounded ml-2 font-bold">PO {poInfo.seed}시드</span>;
                                                else if (piInfo) statusBadge = <span className="text-xs bg-indigo-100 text-indigo-700 px-2 rounded ml-2 font-bold">PI {piInfo.seed}시드</span>;
                                                else if (summary.eliminated === id) statusBadge = <span className="text-xs bg-gray-200 text-gray-500 px-2 rounded ml-2 font-bold">탈락</span>;
                                            }

                                            return (
                                            <tr key={id} onClick={() => setViewingTeamId(id)} className={`cursor-pointer hover:bg-gray-50 transition ${isMyTeam ? `bg-${group.color}-50` : ''}`}>
                                                <td className="py-3 px-4 text-center font-bold text-gray-600">{idx + 1}</td>
                                                <td className="py-3 px-4 font-bold text-gray-800 flex items-center gap-2">
                                                    <div className="w-6 h-6 rounded-full text-white text-[10px] flex items-center justify-center" style={{backgroundColor: t.colors.primary}}>{t.name}</div>
                                                    {t.fullName}
                                                    {statusBadge}
                                                </td>
                                                <td className="py-3 px-4 text-center font-bold text-blue-600">{rec.w}</td>
                                                <td className="py-3 px-4 text-center font-bold text-red-600">{rec.l}</td>
                                                <td className="py-3 px-4 text-center text-gray-500">{rec.diff > 0 ? `+${rec.diff}` : rec.diff}</td>
                                            </tr>
                                            )
                                        })}
                                        </tbody>
                                    </table>
                                </div>
                            ))}
                        </div>
                    </div>
                 ) : (
                    <div className="bg-white rounded-lg border shadow-sm p-8 text-center text-gray-500">
                        아직 시즌이 시작되지 않았습니다. 조 추첨을 완료해주세요.
                    </div>
                 )}
               </div>
            )}
            
            {activeTab === 'playoffs' && (
                <div className="bg-white rounded-lg border shadow-sm p-6 min-h-[800px] flex flex-col">
                    <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">👑 2026 LCK 컵 플레이오프</h2>
                    {hasPlayoffsGenerated ? (() => {
                        const poMatches = league.matches.filter(m => m.type === 'playoff');
                        const getWinner = m => m && m.status === 'finished' ? teams.find(t => t.name === m.result.winner)?.id : null;
                        const getLoser = m => {
                            if (!m || m.status !== 'finished') return null;
                            const winnerId = getWinner(m);
                            return m.t1 === winnerId ? m.t2 : m.t1;
                        };

                        const findMatch = (round, match) => poMatches.find(m => m.round === round && m.match === match);
                        
                        const r1m1 = findMatch(1, 1);
                        const r1m2 = findMatch(1, 2);
                        
                        const r2m1_actual = findMatch(2, 1);
                        const r2m2_actual = findMatch(2, 2);
                        
                        const r2lm1_actual = findMatch(2.1, 1);
                        const r2lm2_actual = findMatch(2.2, 1);
                        
                        const r3m1_actual = findMatch(3, 1);
                        const r3lm1_actual = findMatch(3.1, 1);

                        const r4m1_actual = findMatch(4, 1);
                        const final_actual = findMatch(5, 1);

                        const BracketColumn = ({ title, children, className }) => (
                          <div className={`flex flex-col items-center justify-start w-52 space-y-6 ${className}`}>
                            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{title}</h4>
                            <div className="w-full flex flex-col items-center">
                              {children}
                            </div>
                          </div>
                        );
                        
                        return (
                            <div className="flex-1 overflow-x-auto pb-8">
                                <div className="flex flex-col space-y-24 min-w-[1400px] relative pt-12">
                                    {/* --- 승자조 --- */}
                                    <div className="relative border-b-2 border-dashed pb-16">
                                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Winner's Bracket)</h3>
                                        <div className="flex justify-between items-center mt-8">
                                            <BracketColumn title="1라운드">
                                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                                    <MatchupBox match={r1m1} />
                                                    <MatchupBox match={r1m2} />
                                                </div>
                                            </BracketColumn>
                                            <BracketColumn title="승자조 2R">
                                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                                    <MatchupBox match={r2m1_actual || { t1: league.playoffSeeds.find(s => s.seed === 1)?.id, t2: getWinner(r1m1), status: 'pending', type: 'playoff' }} />
                                                    <MatchupBox match={r2m2_actual || { t1: league.playoffSeeds.find(s => s.seed === 2)?.id, t2: getWinner(r1m2), status: 'pending', type: 'playoff' }} />
                                                </div>
                                            </BracketColumn>
                                            <BracketColumn title="승자조 결승">
                                                <MatchupBox match={r3m1_actual || { t1: getWinner(r2m1_actual), t2: getWinner(r2m2_actual), status: 'pending', type: 'playoff' }} />
                                            </BracketColumn>
                                            <BracketColumn title="결승전">
                                                <MatchupBox match={final_actual || { t1: getWinner(r3m1_actual), t2: getWinner(r4m1_actual), status: 'pending', type: 'playoff' }} />
                                            </BracketColumn>
                                        </div>
                                    </div>

                                    {/* --- 패자조 --- */}
                                    <div className="relative pt-8">
                                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Loser's Bracket)</h3>
                                        <div className="flex justify-start items-center space-x-24 mt-8">
                                            <BracketColumn title="패자조 1R">
                                                <MatchupBox match={r2lm1_actual || { t1: getLoser(r1m1), t2: getLoser(r1m2), status: 'pending', type: 'playoff' }} />
                                            </BracketColumn>
                                            <BracketColumn title="패자조 2R">
                                                <MatchupBox match={r2lm2_actual || { t1: [getLoser(r2m1_actual), getLoser(r2m2_actual)].sort((a,b) => (league.playoffSeeds.find(s=>s.id===b)?.seed || 99) - (league.playoffSeeds.find(s=>s.id===a)?.seed || 99))[0], t2: getWinner(r2lm1_actual), status: 'pending', type: 'playoff' }} />
                                            </BracketColumn>
                                            <BracketColumn title="패자조 3R">
                                                <MatchupBox match={r3lm1_actual || { t1: [getLoser(r2m1_actual), getLoser(r2m2_actual)].sort((a,b) => (league.playoffSeeds.find(s=>s.id===a)?.seed || 99) - (league.playoffSeeds.find(s=>s.id===b)?.seed || 99))[0], t2: getWinner(r2lm2_actual), status: 'pending', type: 'playoff' }} />
                                            </BracketColumn>
                                            <BracketColumn title="결승 진출전">
                                                <MatchupBox match={r4m1_actual || { t1: getLoser(r3m1_actual), t2: getWinner(r3lm1_actual), status: 'pending', type: 'playoff' }} />
                                            </BracketColumn>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })() : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <div className="text-4xl mb-4">🛡️</div>
                            <div className="text-xl font-bold">플레이오프가 아직 시작되지 않았습니다</div>
                            <p className="mt-2">정규 시즌과 플레이-인을 모두 마친 후 대진이 생성됩니다.</p>
                        </div>
                    )}
                </div>
            )}

            {/* 재정 탭 */}
            {activeTab === 'finance' && (
              <div className="bg-white rounded-lg border shadow-sm flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                  <div className="flex items-center gap-4">
                    <button onClick={handlePrevTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">◀</button>
                    <div className="flex items-center gap-4"><div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-white shadow-lg text-xl" style={{backgroundColor: viewingTeam.colors.primary}}>{viewingTeam.name}</div><div><h2 className="text-3xl font-black text-gray-900">{viewingTeam.fullName}</h2><p className="text-sm font-bold text-gray-500 mt-1">2026 시즌 재정 현황</p></div></div>
                    <button onClick={handleNextTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">▶</button>
                  </div>
                </div>
                <div className="p-8">
                    <div className="grid grid-cols-2 gap-8 mb-8">
                        <div className="bg-gray-50 p-6 rounded-xl border">
                            <h3 className="text-lg font-bold text-gray-700 mb-4">💰 지출 현황 (단위: 억)</h3>
                            <div className="flex items-end gap-8 h-48">
                                <div className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                                    <span className="font-bold text-blue-600 text-xl">{finance.total_expenditure}억</span>
                                    <div className="w-full bg-blue-500 rounded-t-lg transition-all duration-500" style={{height: `${Math.min(finance.total_expenditure / 1.5, 100)}%`}}></div>
                                    <span className="font-bold text-gray-600">총 지출 (추정)</span>
                                </div>
                                <div className="flex flex-col items-center gap-2 flex-1 h-full justify-end">
                                    <span className="font-bold text-purple-600 text-xl">{finance.cap_expenditure}억</span>
                                    <div className="w-full bg-purple-500 rounded-t-lg transition-all duration-500" style={{height: `${Math.min(finance.cap_expenditure / 1.5, 100)}%`}}></div>
                                    <span className="font-bold text-gray-600">샐러리캡 반영</span>
                                </div>
                                <div className="flex flex-col items-center gap-2 flex-1 h-full justify-end relative">
                                    <div className="absolute top-10 border-b-2 border-dashed border-red-400 w-full text-center text-xs text-red-400 font-bold">상한선 80억</div>
                                    <span className="font-bold text-gray-400 text-xl">80억</span>
                                    <div className="w-full bg-gray-200 rounded-t-lg" style={{height: '53%'}}></div>
                                    <span className="font-bold text-gray-400">규정 상한선</span>
                                </div>
                            </div>
                        </div>
                        <div className="bg-gray-50 p-6 rounded-xl border flex flex-col justify-center items-center">
                            <h3 className="text-lg font-bold text-gray-700 mb-2">💸 사치세 (Luxury Tax)</h3>
                            <div className="text-5xl font-black text-red-600 my-4">{finance.luxury_tax > 0 ? `${finance.luxury_tax}억` : '없음'}</div>
                            <div className="text-sm text-gray-500 text-center">
                                {finance.luxury_tax > 0 ? (
                                    finance.cap_expenditure >= 80 
                                    ? <span>상한선(80억) 초과!<br/>기본 10억 + 초과분({(finance.cap_expenditure - 80).toFixed(1)}억)의 50% 부과</span>
                                    : <span>균형 지출 구간(40~80억) 초과<br/>초과분({(finance.cap_expenditure - 40).toFixed(1)}억)의 25% 부과</span>
                                ) : (
                                    <span className="text-green-600 font-bold">건전한 재정 상태입니다.</span>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
              </div>
            )}

            {activeTab === 'roster' && (
              <div className="bg-white rounded-lg border shadow-sm flex flex-col">
                <div className="p-6 border-b flex justify-between items-center bg-gray-50 rounded-t-lg">
                  <div className="flex items-center gap-4">
                    <button onClick={handlePrevTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">◀</button>
                    <div className="flex items-center gap-4"><div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-white shadow-lg text-xl" style={{backgroundColor: viewingTeam.colors.primary}}>{viewingTeam.name}</div><div><h2 className="text-3xl font-black text-gray-900">{viewingTeam.fullName}</h2><p className="text-sm font-bold text-gray-500 mt-1">상세 로스터 및 계약 현황</p></div></div>
                    <button onClick={handleNextTeam} className="p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition">▶</button>
                  </div>
                  <div className="text-right"><div className="text-2xl font-black text-blue-600">{viewingTeam.power} <span className="text-sm text-gray-400 font-normal">TEAM OVR</span></div></div>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left table-fixed">
                        <thead className="bg-white text-gray-500 uppercase font-bold border-b">
                            <tr>
                                <th className="py-2 px-2 bg-gray-50 w-[12%]">정보</th>
                                <th className="py-2 px-1 text-center w-[5%]">OVR</th>
                                <th className="py-2 px-1 text-center w-[5%]">나이</th>
                                <th className="py-2 px-1 text-center w-[5%]">경력</th>
                                <th className="py-2 px-1 text-center w-[6%]">소속</th>
                                <th className="py-2 px-1 text-center w-[8%]">연봉</th>
                                <th className="py-2 px-1 text-center bg-gray-50 border-l w-[6%]">라인</th>
                                <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">무력</th>
                                <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">한타</th>
                                <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">성장</th>
                                <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">안정</th>
                                <th className="py-2 px-1 text-center bg-gray-50 w-[6%]">운영</th>
                                <th className="py-2 px-1 text-center bg-gray-50 border-l text-purple-600 w-[6%]">POT</th>
                                <th className="py-2 px-2 text-left bg-gray-50 border-l w-[12%]">계약 정보</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {currentRoster.map((p, i) => (
                                <tr key={i} className="hover:bg-blue-50/30 transition group">
                                    <td className="py-2 px-2 bg-white group-hover:bg-blue-50/30">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-400 w-6">{p.포지션}</span>
                                            <div className="overflow-hidden">
                                                <div className="font-bold text-gray-900 truncate">{p.이름} {p.주장 && <span className="text-yellow-500" title="주장">👑</span>}</div>
                                                <div className="text-[10px] text-gray-400 truncate">{p.특성}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="py-2 px-1 text-center"><span className={`inline-flex items-center justify-center w-8 h-6 rounded font-black text-xs shadow-sm border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                                    <td className="py-2 px-1 text-center text-gray-600">{p.나이 || '-'}</td>
                                    <td className="py-2 px-1 text-center text-gray-600">{p.경력 || '-'}</td>
                                    <td className="py-2 px-1 text-center text-gray-700">{p['팀 소속기간'] || '-'}</td>
                                    <td className="py-2 px-1 text-center text-gray-700 font-bold truncate">{p.연봉 || '-'}</td>
                                    <td className="py-2 px-1 text-center border-l font-medium text-gray-600">{p.상세?.라인전 || '-'}</td>
                                    <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.무력 || '-'}</td>
                                    <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.한타 || '-'}</td>
                                    <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.성장 || '-'}</td>
                                    <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.안정성 || '-'}</td>
                                    <td className="py-2 px-1 text-center font-medium text-gray-600">{p.상세?.운영 || '-'}</td>
                                    <td className="py-2 px-1 text-center border-l"><span className={`font-bold ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span></td>
                                    <td className="py-2 px-2 border-l"><span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px] font-bold block truncate">{p.계약}</span></td>
                                </tr>
                            ))} 
                        </tbody>
                    </table>
                </div>
              </div>
            )}

            {activeTab === 'meta' && (
              <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px] flex flex-col">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2">
                    <span className="text-purple-600">📈</span> {league.metaVersion || '16.01'} 패치 메타
                  </h2>
                  <div className="flex bg-gray-100 p-1 rounded-lg">
                    {['TOP', 'JGL', 'MID', 'ADC', 'SUP'].map(role => (
                      <button
                        key={role}
                        onClick={() => setMetaRole(role)}
                        className={`px-4 py-2 rounded-md text-sm font-bold transition ${metaRole === role ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                      >
                        {role}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4">
                  {(league.currentChampionList || championList)
                    .filter(c => c.role === metaRole)
                    .sort((a, b) => a.tier - b.tier) // 티어 순으로 정렬
                    .map((champ, idx) => (
                      <div key={champ.id} className="border rounded-xl p-4 flex items-center justify-between hover:bg-gray-50 transition group">
                        <div className="flex items-center gap-4 w-1/4">
                          <span className={`text-2xl font-black w-10 text-center ${champ.tier === 1 ? 'text-yellow-500' : 'text-gray-300'}`}>{idx + 1}</span>
                          <div>
                            <div className="font-bold text-lg text-gray-800">{champ.name}</div>
                            <span className={`text-xs font-bold px-2 py-0.5 rounded ${champ.tier === 1 ? 'bg-purple-100 text-purple-600' : champ.tier === 2 ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500'}`}>
                              {champ.tier} 티어
                            </span>
                          </div>
                        </div>
                          
                        <div className="flex-1 px-8">
                          <div className="flex justify-between text-xs text-gray-500 mb-1 font-medium">
                            <span>초반 {champ.stats.early}</span>
                            <span>중반 {champ.stats.mid}</span>
                            <span>후반 {champ.stats.late}</span>
                          </div>
                          <div className="h-2.5 bg-gray-100 rounded-full flex overflow-hidden">
                            <div className="bg-green-400 h-full" style={{width: `${champ.stats.early * 10}%`}} />
                            <div className="bg-yellow-400 h-full" style={{width: `${champ.stats.mid * 10}%`}} />
                            <div className="bg-red-400 h-full" style={{width: `${champ.stats.late * 10}%`}} />
                          </div>
                        </div>

                        <div className="w-1/3 text-right">
                          <div className="text-xs font-bold text-gray-400 mb-1 uppercase tracking-wide">Counter Picks</div>
                          <div className="text-sm font-medium text-gray-700">{champ.counters.join(', ')}</div>
                        </div>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {(activeTab === 'schedule' || activeTab === 'team_schedule') && (
              <div className="bg-white rounded-lg border shadow-sm p-8 min-h-[600px] flex flex-col">
                <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">
                  📅 {activeTab === 'team_schedule' ? `${myTeam.name} 경기 일정` : '2026 LCK 컵 전체 일정'}
                </h2>
                {hasDrafted ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto">
                    {league.matches
                      .filter(m => activeTab === 'schedule' || (m.t1 === myTeam.id || m.t2 === myTeam.id))
                      .map((m, i) => {
                      const t1 = m.t1 ? teams.find(t => t.id === m.t1) : { name: 'TBD' };
                      const t2 = m.t2 ? teams.find(t => t.id === m.t2) : { name: 'TBD' };
                      const isMyMatch = myTeam.id === m.t1 || myTeam.id === m.t2;
                      const isFinished = m.status === 'finished';
                      
                      const t1Name = formatTeamName(m.t1, m.type);
                      const t2Name = formatTeamName(m.t2, m.type);

                      return (
                        <div key={i} className={`p-4 rounded-lg border flex flex-col gap-2 ${isMyMatch ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-gray-200'}`}>
                          <div className="flex justify-between text-xs font-bold text-gray-500">
                            <span>{m.date} {m.time}</span>
                            <span className={`font-bold ${m.type === 'playoff' ? 'text-yellow-600' : (m.type === 'super' ? 'text-purple-600' : (m.type === 'playin' ? 'text-indigo-600' : 'text-gray-500'))}`}>
                                {m.label || (m.type === 'super' ? '🔥 슈퍼위크' : '정규시즌')}
                            </span>
                          </div>
                          <div className="flex justify-between items-center mt-2">
                            <div className="flex flex-col items-center w-1/3">
                                <span className={`font-bold ${isMyMatch && myTeam.id === m.t1 ? 'text-blue-600' : 'text-gray-800'}`}>{t1Name}</span>
                                {isFinished && m.result.winner === t1.name && <span className="text-xs text-blue-500 font-bold">WIN</span>}
                            </div>
                            <div className="text-center font-bold">
                                {isFinished ? (
                                    <span className="text-xl text-gray-800">{m.result.score}</span>
                                ) : (
                                    <span className="text-gray-400">VS</span>
                                )}
                            </div>
                            <div className="flex flex-col items-center w-1/3">
                                <span className={`font-bold ${isMyMatch && myTeam.id === m.t2 ? 'text-blue-600' : 'text-gray-800'}`}>{t2Name}</span>
                                {isFinished && m.result.winner === t2.name && <span className="text-xs text-blue-500 font-bold">WIN</span>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-400"><div className="text-4xl mb-4">🗳️</div><div className="text-xl font-bold">일정이 생성되지 않았습니다</div><p className="mt-2">먼저 조 추첨을 진행해주세요.</p></div>
                )}
              </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LeagueManager />} />
      <Route path="/new-league" element={<TeamSelection />} />
      <Route path="/league/:leagueId" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );

}