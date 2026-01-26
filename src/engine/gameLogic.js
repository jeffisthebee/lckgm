// src/engine/gameLogic.js
import { GAME_RULES, SIDES, MAP_LANES, championList, SIM_CONSTANTS } from '../data/constants';
import { SYNERGIES } from '../data/synergies'; // <--- [NEW] Import Synergies

// [FIX] Import Draft Helpers so we can re-export them
import { 
    runDraftSimulation, 
    selectPickFromTop3,        
    selectBanFromProbabilities 
} from './draftLogic';

// [FIX] Import Mechanics Helpers so we can re-export them
import { 
  calculateTeamPower, 
  resolveCombat, 
  calculateIndividualIncome, 
  calculateDeathTimer, 
  getChampionClass 
} from './mechanics';

// [FIX] CRITICAL: Re-export these so LiveGamePlayer.jsx can use them!
export { 
    calculateIndividualIncome, 
    selectPickFromTop3, 
    selectBanFromProbabilities,
    runDraftSimulation,
    getChampionClass 
};

// --- HELPER: POG Calculation ---
function calculatePog(winningPicks, gameMinutes) {
    const candidates = (winningPicks || []).map(p => {
        const stats = p.stats || {};
        const k = stats.kills || 0;
        const d = stats.deaths || 0;
        const a = stats.assists || 0;
        const dmg = stats.damage || 0;
        
        const safeD = d === 0 ? 1 : d;
        const kda = (k + a) / safeD;
        const dpm = dmg / (Math.max(1, gameMinutes)); // Prevent divide by zero
        
        let pogScore = (kda * 3) + (dpm / 100) + ((p.currentGold || 0) / 1000) + (a * 1);
        
        const role = p.playerData?.포지션 || 'MID';
        if (['JGL', '정글'].includes(role)) {
            pogScore *= 1.07;
        }
        if (['SUP', '서포터'].includes(role)) {
            pogScore *= 1.10;
        }

        return { ...p, kdaVal: kda, pogScore: pogScore, dpm: dpm };
    });

    candidates.sort((a, b) => (b.pogScore || 0) - (a.pogScore || 0));
    return candidates[0] || null; 
}

// --- HELPER: Distribute Totals to Players (Top-Down) ---
const distributeTeamStats = (team, picks, totalKills, totalDeaths, totalAssists, gameTime, isWinner) => {
    const ROLE_WEIGHTS = {
        KILLS: { 'TOP': 20, 'JGL': 15, 'MID': 30, 'ADC': 32, 'SUP': 3 },
        DEATHS: { 'TOP': 20, 'JGL': 20, 'MID': 15, 'ADC': 15, 'SUP': 30 },
        ASSISTS: { 'TOP': 15, 'JGL': 25, 'MID': 15, 'ADC': 10, 'SUP': 35 }
    };

    const players = (picks || []).map(p => {
        const playerObj = (team?.roster || []).find(r => r.이름 === p.playerName) || { 포지션: 'MID', 상세: {} };
        const role = ['MID', 'ADC', 'TOP', 'JGL', 'SUP'].includes(playerObj.포지션) ? playerObj.포지션 : 'MID';
        
        const incomeMod = isWinner ? 1.05 : 0.95;
        const resources = calculateIndividualIncome({ playerData: playerObj }, gameTime, incomeMod);
        
        return {
            ...p,
            playerData: playerObj,
            role: role,
            k: 0, d: 0, a: 0, damage: 0,
            currentGold: Math.floor((resources.gold || 0) * gameTime) + 500,
            lvl: Math.min(18, Math.floor((resources.xp || 0) / 1000) + 6),
            roleWeights: {
                k: ROLE_WEIGHTS.KILLS[role] || 10,
                d: ROLE_WEIGHTS.DEATHS[role] || 10,
                a: ROLE_WEIGHTS.ASSISTS[role] || 10
            }
        };
    });

    for (let i = 0; i < totalKills; i++) {
        const lottery = [];
        players.forEach((p, idx) => { for(let w=0; w<p.roleWeights.k; w++) lottery.push(idx); });
        const winnerIdx = lottery[Math.floor(Math.random() * lottery.length)];
        players[winnerIdx].k++;
        players[winnerIdx].currentGold += 300; 
    }

    for (let i = 0; i < totalDeaths; i++) {
        const lottery = [];
        players.forEach((p, idx) => { for(let w=0; w<p.roleWeights.d; w++) lottery.push(idx); });
        const victimIdx = lottery[Math.floor(Math.random() * lottery.length)];
        players[victimIdx].d++;
    }

    for (let i = 0; i < totalAssists; i++) {
        const lottery = [];
        players.forEach((p, idx) => { for(let w=0; w<p.roleWeights.a; w++) lottery.push(idx); });
        const assistIdx = lottery[Math.floor(Math.random() * lottery.length)];
        players[assistIdx].a++;
        players[assistIdx].currentGold += 100;
    }

    return players.map(p => {
        const isCarry = ['MID', 'ADC', 'TOP'].includes(p.role);
        let dmg = isCarry ? (Math.random() * 15000 + 10000) : (Math.random() * 8000 + 4000);
        dmg *= (gameTime / 25);
        if (totalKills > 25) dmg *= 1.3; 

        return {
            ...p,
            damage: Math.floor(dmg),
            stats: { kills: p.k, deaths: p.d, assists: p.a, damage: Math.floor(dmg) }
        };
    });
};

export function runGameTickEngine(teamBlue, teamRed, picksBlue, picksRed, simOptions = {}) {
    let time = 0; 
    let logs = [];
    const { difficulty = 'normal', playerTeamName = '' } = simOptions || {};
    let gameOver = false;
    let endAbsSecond = 0;
  
    // Defensive defaults
    picksBlue = picksBlue || [];
    picksRed = picksRed || [];

    // Initialize Players
    picksBlue.forEach(p => {
        p.side = 'BLUE'; p.currentGold = GAME_RULES.GOLD.START; p.level = p.level || 1; p.xp = p.xp || 0; p.deadUntil = 0;
        p.stats = p.stats || { kills: 0, deaths: 0, assists: 0, damage: 0, takenDamage: 0 }; p.flashEndTime = p.flashEndTime || 0;
    });
    picksRed.forEach(p => {
        p.side = 'RED'; p.currentGold = GAME_RULES.GOLD.START; p.level = p.level || 1; p.xp = p.xp || 0; p.deadUntil = 0;
        p.stats = p.stats || { kills: 0, deaths: 0, assists: 0, damage: 0, takenDamage: 0 }; p.flashEndTime = p.flashEndTime || 0;
    });

    // --- [NEW] SYNERGY CHECK LOGGING ---
    const checkAndLogSynergies = (teamSide, teamName, picks) => {
        const activeNames = picks.map(p => p.champName || p.name);
        
        SYNERGIES.forEach(syn => {
            // Check if every champion in the synergy exists in this team
            const isActive = syn.champions.every(c => activeNames.includes(c));
            
            if (isActive) {
                // Add a special log event at 0:00 (Korean)
                logs.push({
                    sec: 0,
                    abs: 0,
                    message: `✨ [${teamName}] 시너지 발동! : ${syn.champions.join(' + ')} (전투력 ${Math.round((syn.multiplier - 1) * 100)}% 상승)`
                });
            }
        });
    };

    checkAndLogSynergies('BLUE', teamBlue?.name || 'BLUE', picksBlue);
    checkAndLogSynergies('RED', teamRed?.name || 'RED', picksRed);
    // -----------------------------------
  
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
            let role = p.playerData?.포지션;
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
                weight += ((p.playerData?.상세?.무력 || 50) / 10);
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
  
    const VAR_RANGE_LOCAL = Math.min(SIM_CONSTANTS.VAR_RANGE || 0.03, 0.06);
    const PLAYER_DIFFICULTY_MULTIPLIERS = { easy: 1.1, normal: 1.0, hard: 0.95, insane: 0.90 };
  
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
      nextDragonTimeAbs: (GAME_RULES.OBJECTIVES?.DRAGON?.initial_spawn || 4) * 60, 
      nextBaronTimeAbs: (GAME_RULES.OBJECTIVES?.BARON?.spawn || 20) * 60,        
      nextElderTimeAbs: Infinity,
    };

    function initLane() {
        return {
            tier1: { hp: 100, plates: 6, destroyed: false },
            tier2: { hp: 100, destroyed: false },
            tier3: { hp: 100, destroyed: false },
            inhib: { respawnTime: 0, destroyed: false }
        };
    }

    const dragonTypes = ['화염', '대지', '바람', '바다', '마법공학', '화학공학'];
    const shuffledDragons = dragonTypes.sort(() => Math.random() - 0.5);
    const firstDragonType = shuffledDragons[0];
    const secondDragonType = shuffledDragons[1];
    const mapElementType = shuffledDragons[2];
    let dragonSpawnCount = 0;
  
    const formatTime = (m, s) => `[${m}:${s < 10 ? '0' + s : s}]`;
     
    const grantGoldToPlayer = (teamSide, playerIdx, amount) => {
        let finalAmount = amount;
        const myTeamGold = state.gold[teamSide] || 0;
        const enemyTeamGold = state.gold[teamSide === 'BLUE' ? 'RED' : 'BLUE'] || 0;
        if (enemyTeamGold - myTeamGold >= 5000) finalAmount = Math.floor(amount * 1.15);
        const picks = teamSide === 'BLUE' ? picksBlue : picksRed;
        if (picks[playerIdx]) picks[playerIdx].currentGold = (picks[playerIdx].currentGold || 0) + finalAmount;
        state.gold[teamSide] = (state.gold[teamSide] || 0) + finalAmount;
    };
  
    const grantTeamGold = (teamSide, amountPerPlayer) => {
        let finalAmount = amountPerPlayer;
        const myTeamGold = state.gold[teamSide] || 0;
        const enemyTeamGold = state.gold[teamSide === 'BLUE' ? 'RED' : 'BLUE'] || 0;
        if (enemyTeamGold - myTeamGold >= 5000) finalAmount = Math.floor(amountPerPlayer * 1.15);
        const targetPicks = teamSide === 'BLUE' ? picksBlue : picksRed;
        targetPicks.forEach(p => p.currentGold = (p.currentGold || 0) + finalAmount);
        state.gold[teamSide] = (state.gold[teamSide] || 0) + (finalAmount * 5);
    };
  
    while ((state.nexusHealth?.['BLUE'] ?? 100) > 0 && (state.nexusHealth?.['RED'] ?? 100) > 0 && time < 70) {
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
        (picks || []).forEach(p => {
            const currentAbs = (time - 1) * 60;
            const aliveRatio = p.deadUntil > currentAbs ? 0 : 1.0;
            const income = calculateIndividualIncome(p, time, aliveRatio) || { gold: 0, xp: 0 };
            if (time > 0) { p.currentGold = (p.currentGold || 0) + (income.gold || 0); state.gold[teamSide] = (state.gold[teamSide] || 0) + (income.gold || 0); }
            if ((p.level || 1) < 18) {
              p.xp = (p.xp || 0) + (income.xp || 0);
              while ((p.level || 1) < 18) {
                  const requiredXP = 180 + ((p.level || 1) * 100);
                  if (p.xp >= requiredXP) { p.xp -= requiredXP; p.level = (p.level || 1) + 1; } else { break; }
              }
          }
        });
      };
      processIncome(picksBlue, 'BLUE'); processIncome(picksRed, 'RED');
  
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
        dragonStacks: (state.dragons[side] || []).reduce((acc, d) => ({ ...acc, [d]: (acc[d] || 0) + 1 }), {}),
        soul: state.soul?.side === side ? { type: state.soul.type } : null,
        baron: state.baronBuff.side === side && state.baronBuff.endTime >= time,
        elder: state.elderBuff.side === side && state.elderBuff.endTime >= time,
        grubs: state.grubs[side] || 0
      });
  
      let powerBlue = calculateTeamPower(picksBlue, time, getActiveBuffs('BLUE'), 0, picksRed, minuteStartAbs);
      let powerRed = calculateTeamPower(picksRed, time, getActiveBuffs('RED'), 0, picksBlue, minuteStartAbs);
      
      const applyDeadPenalty = (picks) => {
          const deadCount = (picks || []).filter(p => p.deadUntil > minuteStartAbs).length;
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
          if (teamBlue?.name === playerTeamName) powerBlue *= playerMult;
          else if (teamRed?.name === playerTeamName) powerRed *= playerMult;
      }
      powerBlue *= (1 + (Math.random() * VAR_RANGE_LOCAL * 2 - VAR_RANGE_LOCAL));
      powerRed *= (1 + (Math.random() * VAR_RANGE_LOCAL * 2 - VAR_RANGE_LOCAL));
  
      // --- Objectives ---
      if (time === GAME_RULES.OBJECTIVES.GRUBS.time) {
        const winner = resolveCombat(powerBlue, powerRed);
        state.grubs[winner] = (state.grubs[winner] || 0) + (GAME_RULES.OBJECTIVES.GRUBS.count || 1);
        grantTeamGold(winner, (GAME_RULES.OBJECTIVES.GRUBS.gold || 100) / 5); 
        simulateDamage(winner, powerBlue, powerRed, minuteStartAbs + 5);
        addEvent(5, `🐛 ${winner === 'BLUE' ? teamBlue.name : teamRed.name} 공허 유충 처치`);
      }
      if (time === GAME_RULES.OBJECTIVES.HERALD.time) {
        const winner = resolveCombat(powerBlue, powerRed);
        grantTeamGold(winner, (GAME_RULES.OBJECTIVES.HERALD.gold || 300) / 5);
        simulateDamage(winner, powerBlue, powerRed, minuteStartAbs + 0);
        addEvent(0, `👁️ ${winner === 'BLUE' ? teamBlue.name : teamRed.name} 전령 획득`);
      }
  
      // Dragon
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
  
          state.dragons[winner] = state.dragons[winner] || [];
          state.dragons[winner].push(currentDragonName);
          grantTeamGold(winner, (GAME_RULES.OBJECTIVES.DRAGON.gold || 150) / 5);
          dragonSpawnCount++;
          let msg = `🐉 ${winner === 'BLUE' ? teamBlue.name : teamRed.name}, ${currentDragonName} 용 처치`;
          if ((state.dragons[winner] || []).length === 4) {
              state.soul = { side: winner, type: mapElementType };
              state.nextDragonTimeAbs = Infinity;
              state.nextElderTimeAbs = eventAbsTime + ((GAME_RULES.OBJECTIVES?.ELDER?.spawn_after_soul || 8) * 60);
              msg += ` (👑 ${mapElementType} 영혼 획득!)`;
          } else {
              state.nextDragonTimeAbs = eventAbsTime + ((GAME_RULES.OBJECTIVES.DRAGON.respawn || 6) * 60);
          }
          addEvent(eventSec, msg);
      }
  
      // Baron
      if ((minuteStartAbs + 59) >= state.nextBaronTimeAbs && !(state.baronBuff.side && state.baronBuff.endTime >= time)) {
        if (Math.random() > 0.6 || time > 30) { 
          const minValidSec = (minuteStartAbs < state.nextBaronTimeAbs) ? (state.nextBaronTimeAbs - minuteStartAbs) : 0;
          const eventSec = Math.floor(Math.random() * (60 - minValidSec)) + minValidSec;
          const eventAbsTime = minuteStartAbs + eventSec;
          const pBlueObj = calculateTeamPower(picksBlue, time, getActiveBuffs('BLUE'), 0, picksRed, eventAbsTime);
          const pRedObj = calculateTeamPower(picksRed, time, getActiveBuffs('RED'), 0, picksBlue, eventAbsTime);
          const winner = resolveCombat(pBlueObj * 0.9, pRedObj * 0.9);
          simulateDamage(winner, pBlueObj, pRedObj, eventAbsTime);
          state.baronBuff = { side: winner, endTime: time + (GAME_RULES.OBJECTIVES?.BARON?.duration || 3) };
          grantTeamGold(winner, (GAME_RULES.OBJECTIVES.BARON.gold || 1500) / 5);
          state.nextBaronTimeAbs = eventAbsTime + ((GAME_RULES.OBJECTIVES.DRAGON.respawn || 6) * 60); 
          addEvent(eventSec, `🟣 ${winner === 'BLUE' ? teamBlue.name : teamRed.name} 내셔 남작 처치!`);
        }
      }
      // Elder
      if ((minuteStartAbs + 59) >= state.nextElderTimeAbs && !(state.elderBuff.side && state.elderBuff.endTime >= time)) {
          const minValidSec = (minuteStartAbs < state.nextElderTimeAbs) ? (state.nextElderTimeAbs - minuteStartAbs) : 0;
          const eventSec = Math.floor(Math.random() * (60 - minValidSec)) + minValidSec;
          const eventAbsTime = minuteStartAbs + eventSec;
          const pBlueObj = calculateTeamPower(picksBlue, time, getActiveBuffs('BLUE'), 0, picksRed, eventAbsTime);
          const pRedObj = calculateTeamPower(picksRed, time, getActiveBuffs('RED'), 0, picksBlue, eventAbsTime);
          const winner = resolveCombat(pBlueObj, pRedObj);
          simulateDamage(winner, pBlueObj, pRedObj, eventAbsTime);
          state.elderBuff = { side: winner, endTime: time + (GAME_RULES.OBJECTIVES?.ELDER?.duration || 2) };
          state.nextElderTimeAbs = eventAbsTime + ((GAME_RULES.OBJECTIVES?.ELDER?.spawn_after_soul || 8) * 60); 
          addEvent(eventSec, `🐲 ${winner === 'BLUE' ? teamBlue.name : teamRed.name} 장로 드래곤 처치!`);
      }
  
      // --- Combat ---
      const powerDiffRatio = Math.abs(powerBlue - powerRed) / ((powerBlue + powerRed) / 2 || 1);
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
        const winnerName = winner === 'BLUE' ? teamBlue?.name : teamRed?.name;
        
        let combatOccurred = true;
        simulateDamage(winner, pBlueCombat, pRedCombat, combatAbsTime);
        
        const winningTeamPicks = winner === 'BLUE' ? picksBlue : picksRed;
        const losingTeamPicks = winner === 'BLUE' ? picksRed : picksBlue;
        let maxKills = 1;
        const roll = Math.random();
        if (roll > 0.99) maxKills = 5; else if (roll > 0.96) maxKills = 4; else if (roll > 0.91) maxKills = 3; else if (roll > 0.71) maxKills = 2; else maxKills = 1;

        const getAlivePlayers = (picks) => (picks || []).filter(p => p.deadUntil <= combatAbsTime);
        let killCount = 0;
        let aliveWinners = getAlivePlayers(winningTeamPicks);
        const killer = getWeightedPlayer(aliveWinners, 'KILL');

        for(let k=0; k<maxKills; k++) {
            const aliveLosers = getAlivePlayers(losingTeamPicks);
            const validVictims = aliveLosers.filter(v => v.side && killer && v.side !== killer.side);
            if (!killer || validVictims.length === 0) break;
            const victim = validVictims[Math.floor(Math.random() * validVictims.length)];
            
            if (victim) {
                killCount++; state.kills[winner] = (state.kills[winner] || 0) + 1; killer.stats.kills = (killer.stats.kills || 0) + 1; victim.stats.deaths = (victim.stats.deaths || 0) + 1;
                victim.deadUntil = combatAbsTime + calculateDeathTimer(victim.level || 1, time);
                grantGoldToPlayer(winner, (winningTeamPicks.indexOf(killer) || 0), GAME_RULES.GOLD.KILL || 300);
                let assistCount = Math.floor(Math.random() * 3) + 1; 
                const assistCandidates = getAlivePlayers(winningTeamPicks).filter(p => p.playerName !== killer.playerName && p.side === killer.side);
                const assistNames = [];
                for (let a = 0; a < assistCount && assistCandidates.length > 0; a++) {
                    const assister = getWeightedPlayer(assistCandidates, 'ASSIST');
                    if (assister && !assistNames.includes(assister.playerName)) {
                        assister.stats.assists = (assister.stats.assists || 0) + 1;
                        grantGoldToPlayer(winner, (winningTeamPicks.indexOf(assister) || 0), GAME_RULES.GOLD.ASSIST || 150);
                        assistNames.push(assister.playerName);
                    }
                }
                let flashMsg = '';
                if (Math.random() < 0.35 && (killer.flashEndTime || 0) <= time) { killer.flashEndTime = time + 5; flashMsg = ' (⚡점멸 소모)'; }
                if (Math.random() < 0.35 && (victim.flashEndTime || 0) <= time) { victim.flashEndTime = time + 5; }
                const killerChamp = killer.champName || 'Unknown';
                const victimChamp = victim.champName || 'Unknown';
                const assistText = assistNames.length > 0 ? ` | assists: ${assistNames.join(', ')}` : '';
                let multiKillLabel = '';
                if (killCount === 2) multiKillLabel = ' [더블 킬!]'; if (killCount === 3) multiKillLabel = ' [트리플 킬!]'; if (killCount === 4) multiKillLabel = ' [쿼드라 킬!]'; if (killCount === 5) multiKillLabel = ' [펜타 킬!]';
                const killMsg = `⚔️ [${killer.playerData?.포지션 || '?'}] ${killer.playerName} (${killerChamp}) ➜ ☠️ [${victim.playerData?.포지션 || '?'}] ${victim.playerName} (${victimChamp})${assistText}${flashMsg}${multiKillLabel}`;
                addEvent(combatSec + k, killMsg);
            }
        }

        // Counter Kill
        if (killCount < 3 && Math.random() < 0.35) {
            const aliveLosers = getAlivePlayers(losingTeamPicks);
            const aliveWinners = getAlivePlayers(winningTeamPicks);
            if (aliveLosers.length > 0 && aliveWinners.length > 0) {
                const counterKiller = getWeightedPlayer(aliveLosers, 'KILL');
                const validCounterVictims = aliveWinners.filter(v => v.side && counterKiller && v.side !== counterKiller.side);
                const counterVictim = validCounterVictims[Math.floor(Math.random() * validCounterVictims.length)];
                if (counterKiller && counterVictim) {
                    state.kills[loser] = (state.kills[loser] || 0) + 1; counterKiller.stats.kills = (counterKiller.stats.kills || 0) + 1; counterVictim.stats.deaths = (counterVictim.stats.deaths || 0) + 1;
                    counterVictim.deadUntil = combatAbsTime + calculateDeathTimer(counterVictim.level || 1, time);
                    grantGoldToPlayer(loser, (losingTeamPicks.indexOf(counterKiller) || 0), (GAME_RULES.GOLD.KILL || 300) + (GAME_RULES.GOLD.ASSIST || 150));
                    const ckillerChamp = counterKiller.champName || 'Unknown';
                    const cvictimChamp = counterVictim.champName || 'Unknown';
                    const counterMsg = `🛡️ [${counterKiller.playerData?.포지션 || '?'}] ${counterKiller.playerName} (${ckillerChamp}) ➜ ☠️ [${counterVictim.playerData?.포지션 || '?'}] ${counterVictim.playerName} (${cvictimChamp}) (반격)`;
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
              let lanerIdx = 0; if (lane === 'MID') lanerIdx = 2; if (lane === 'BOT') lanerIdx = 3; 
  
              if (!enemyLane.tier1.destroyed) {
                  if (time >= GAME_RULES.OBJECTIVES.PLATES.start_time && time < GAME_RULES.OBJECTIVES.PLATES.end_time) {
                      if (Math.random() < 0.4 * pushPower) {
                           if (enemyLane.tier1.plates > 0) {
                               enemyLane.tier1.plates--;
                               grantGoldToPlayer(winner, lanerIdx, (GAME_RULES.GOLD.TURRET.OUTER_PLATE?.local || 40));
                               grantTeamGold(winner, (GAME_RULES.GOLD.TURRET.OUTER_PLATE?.team || 50));
                               const plateCount = 6 - enemyLane.tier1.plates;
                               let plateMsg = `💰 ${winnerName}, ${lane} 포탑 방패 채굴 (${plateCount}/6)`;
                               if (enemyLane.tier1.plates === 0) { enemyLane.tier1.destroyed = true; plateMsg = `💥 ${winnerName}, ${lane} 1차 포탑 파괴 (모든 방패 파괴)`; }
                               addEvent(currentPushSec, plateMsg);
                           }
                      }
                  } else if (time >= GAME_RULES.OBJECTIVES.PLATES.end_time) {
                      if (Math.random() < 0.3 * pushPower) {
                          enemyLane.tier1.destroyed = true; grantGoldToPlayer(winner, lanerIdx, 300); grantTeamGold(winner, 50);
                          addEvent(currentPushSec, `💥 ${winnerName}, ${lane} 1차 포탑 파괴`);
                      }
                  }
              } else if (!enemyLane.tier2.destroyed) {
                  if (Math.random() < 0.25 * pushPower) {
                      enemyLane.tier2.destroyed = true;
                      let localG = lane === 'MID' ? (GAME_RULES.GOLD.TURRET.INNER_MID?.local || 150) : (GAME_RULES.GOLD.TURRET.INNER_SIDE?.local || 100);
                      let teamG = lane === 'MID' ? (GAME_RULES.GOLD.TURRET.INNER_MID?.team || 100) : (GAME_RULES.GOLD.TURRET.INNER_SIDE?.team || 75);
                      grantGoldToPlayer(winner, lanerIdx, localG); grantTeamGold(winner, teamG);
                      addEvent(currentPushSec, `💥 ${winnerName}, ${lane} 2차 포탑 파괴`);
                  }
              } else if (!enemyLane.tier3.destroyed) {
                  if (Math.random() < 0.2 * pushPower) {
                      enemyLane.tier3.destroyed = true;
                      grantGoldToPlayer(winner, lanerIdx, (GAME_RULES.GOLD.TURRET.INHIB_TURRET?.local || 200)); grantTeamGold(winner, (GAME_RULES.GOLD.TURRET.INHIB_TURRET?.team || 150));
                      addEvent(currentPushSec, `🚨 ${winnerName}, ${lane} 3차(억제기) 포탑 파괴`);
                  }
              } else if (!enemyLane.inhib.destroyed) {
                  if (Math.random() < 0.3 * pushPower) {
                      enemyLane.inhib.destroyed = true; enemyLane.inhib.respawnTime = time + 5; grantTeamGold(winner, 10);
                      addEvent(currentPushSec, `🚧 ${winnerName}, ${lane} 억제기 파괴! 슈퍼 미니언 생성`);
                  }
              } else {
                  if (Math.random() < 0.2 * pushPower) {
                      let dmg = 10 + (powerDiffRatio * 100);
                      if (state.baronBuff.side === winner) dmg *= 1.5;
                      if (state.elderBuff.side === winner) dmg *= 2.0;
                      state.nexusHealth[loser] -= dmg;
                       if (state.nexusHealth[loser] <= 0) {
                           addEvent(currentPushSec, `👑 ${winnerName}이(가) 넥서스를 파괴합니다! GG`);
                           gameOver = true; endAbsSecond = pushAbsTime;
                       } else if (Math.random() < 0.5) {
                           addEvent(currentPushSec, `${winnerName}, 쌍둥이 포탑 및 넥서스 타격 중...`);
                       }
                  }
              }
          });
      }
      minuteEvents.sort((a, b) => a.abs - b.abs);
      if (gameOver) { minuteEvents = minuteEvents.filter(e => e.abs <= endAbsSecond); minuteEvents.forEach(evt => logs.push(evt)); break; }
      minuteEvents.forEach(evt => logs.push(evt));
    }
  
    const winnerSide = state.nexusHealth['BLUE'] > state.nexusHealth['RED'] ? 'BLUE' : 'RED';
    const winnerName = winnerSide === 'BLUE' ? teamBlue?.name : teamRed?.name;
    const totalSeconds = gameOver ? endAbsSecond : (time * 60);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const finalTimeStr = formatTime(totalMinutes, totalSeconds % 60);
    // Sort logs by absolute time and convert to messages
    logs.sort((a, b) => (a.abs || 0) - (b.abs || 0));
    const logMessages = logs.map(l => l.message || String(l));

    // Build a consistent gameResult object so callers can rely on fields
    const gameResultObj = {
      winnerName,
      winnerSide,
      finalKills: state.kills,
      totalMinutes,
      totalSeconds,
      endSecond: totalSeconds % 60,
      gameTime: finalTimeStr,
      finalTimeStr,
      logs: logMessages
    };

    return {
      // Top-level convenience fields
      winnerName,
      winnerSide,
      resultSummary: `Winner: ${winnerName}`,
      // [EXPOSE POG] We explicitly return the POG object now (may be null)
      pogPlayer: null,
      picks: { A: picksBlue, B: picksRed },
      bans: { A: [], B: [] },
      logs: logMessages,
      usedChamps: [],
      score: { [teamBlue?.name || 'A']: String(state.kills.BLUE || 0), [teamRed?.name || 'B']: String(state.kills.RED || 0) },
      gameResult: gameResultObj,
      totalMinutes,
      totalSeconds,
      endSecond: totalSeconds % 60,
      gameOver,
      finalTimeStr,
      // [FIX] Ensure gameTime is passed up for consistency
      gameTime: finalTimeStr,
      playersLevelProgress: [],
      fearlessBans: []
    };
}

export function simulateSet(teamBlue, teamRed, setNumber, fearlessBans, simOptions = {}) {
    const { currentChampionList } = simOptions || {};
    const draftResult = runDraftSimulation(teamBlue, teamRed, fearlessBans || [], currentChampionList || championList);
  
    if (!draftResult || !draftResult.picks || (draftResult.picks.A || []).length < 5) {
      return { gameOver: true, winnerName: null, resultSummary: 'Draft incomplete', picks: { A: [], B: [] }, bans: { A: [], B: [] }, logs: [] };
    }
  
    const getConditionModifier = (player) => {
        const stability = player?.상세?.안정성 || 50;
        const variancePercent = ((100 - stability) / stability) * 10; 
        const fluctuation = (Math.random() * variancePercent * 2) - variancePercent;
        return 1 + (fluctuation / 100);
    };
  
    const addPlayerData = (picks, roster) => {
        return (picks || []).map(p => {
            const playerData = (roster || []).find(player => player && player.이름 === p.playerName);
            const champData = (currentChampionList || championList).find(c => c.name === p.champName);
            if (!playerData || !champData) {
              return { ...p, dmgType: 'AD', classType: '전사', playerData: playerData || { 이름: p.playerName, 포지션: 'TOP', 상세: { 안정성: 50 }, 종합: 70 }, conditionModifier: 1.0, stats: { kills: 0, deaths: 0, assists: 0, damage: 0, takenDamage: 0 }, currentGold: 500, level: 1 };
            }
            return {
                ...p, ...champData, dmgType: champData.dmg_type || 'AD', 
                classType: getChampionClass(champData, playerData.포지션),
                playerData: playerData, conditionModifier: getConditionModifier(playerData)
            };
        });
    };
  
    const picksBlue_detailed = addPlayerData(draftResult.picks.A, teamBlue?.roster || []);
    const picksRed_detailed = addPlayerData(draftResult.picks.B, teamRed?.roster || []);
    const gameResult = runGameTickEngine(teamBlue, teamRed, picksBlue_detailed, picksRed_detailed, simOptions);
  
    const usedChamps = [...(draftResult.picks.A || []).map(p => p.champName), ...(draftResult.picks.B || []).map(p => p.champName)];
    const scoreBlue = (gameResult?.gameResult?.finalKills?.BLUE) ?? ((gameResult?.score?.[teamBlue?.name]) ? Number(gameResult.score[teamBlue.name]) : 0);
    const scoreRed = (gameResult?.gameResult?.finalKills?.RED) ?? ((gameResult?.score?.[teamRed?.name]) ? Number(gameResult.score[teamRed.name]) : 0);
    
    // [POG UPDATE] Calculate POG using the helper
    const winningPicks = (gameResult?.winnerSide === 'BLUE') ? picksBlue_detailed : picksRed_detailed;
    const pogPlayer = calculatePog(winningPicks, gameResult?.totalMinutes || 30);
  
    const resultSummary = `⏱️ ${gameResult?.gameTime || gameResult?.finalTimeStr} | ⚔️ ${teamBlue?.name} ${scoreBlue} : ${scoreRed} ${teamRed?.name} | 🏆 승리: ${gameResult?.winnerName || gameResult?.gameResult?.winnerName}`;
    const pogText = pogPlayer ? `🏅 POG: [${pogPlayer.playerData?.포지션 || '?'}] ${pogPlayer.playerName} (${pogPlayer.champName}) - Score: ${pogPlayer.pogScore?.toFixed(1)}` : 'POG 선정 실패';
  
    const finalLogs = [
      `========== [ 밴픽 단계 ] ==========`,
      ...(draftResult.draftLogs || []),
      `========== [ 경기 결과 ] ==========`,
      resultSummary,
      pogText,
      pogPlayer ? `KDA: ${pogPlayer.stats?.kills || 0}/${pogPlayer.stats?.deaths || 0}/${pogPlayer.stats?.assists || 0} | DPM: ${Math.floor(pogPlayer.dpm || 0)} | LV: ${pogPlayer.level || 1}` : '',
      `===================================`,
      ...(gameResult?.logs || [])
    ];
    const playersLevelProgress = [...picksBlue_detailed, ...picksRed_detailed].map(p => ({ playerName: p.playerName, startLevel: 1, endLevel: p.level || 1 }));
  
    return {
      winnerName: gameResult?.winnerName || gameResult?.gameResult?.winnerName || null,
      resultSummary: resultSummary + ' ' + pogText,
      // [EXPOSE POG] We explicitly return the POG object now
      pogPlayer: pogPlayer, 
      picks: draftResult.picks || { A: [], B: [] },
      bans: draftResult.bans || { A: [], B: [] },
      logs: finalLogs,
      usedChamps: usedChamps,
      score: { [teamBlue?.name || 'A']: String(scoreBlue), [teamRed?.name || 'B']: String(scoreRed) },
      gameResult,
      totalMinutes: gameResult?.totalMinutes,
      totalSeconds: gameResult?.totalSeconds,
      endSecond: gameResult?.endSecond,
      gameOver: gameResult?.gameOver,
      finalTimeStr: gameResult?.finalTimeStr,
      // [FIX] Ensure gameTime is passed up for consistency
      gameTime: gameResult?.gameTime,
      playersLevelProgress,
      fearlessBans: draftResult.fearlessBans || (Array.isArray(fearlessBans) ? [...fearlessBans] : (fearlessBans ? [fearlessBans] : []))
    };
}

export function simulateMatch(teamA, teamB, format = 'BO3', simOptions) {
    const targetWins = format === 'BO5' ? 3 : 2;
    let winsA = 0; let winsB = 0; let currentSet = 1;
    let globalBanList = [];
    let matchHistory = [];
    let previousLoser = null;
  
    while (winsA < targetWins && winsB < targetWins) {
      const currentFearlessBans = [...globalBanList];
      let blueTeam, redTeam;
      if (currentSet === 1) { blueTeam = teamA; redTeam = teamB; } 
      else {
          const loserPicksBlue = Math.random() < 0.90;
          if (loserPicksBlue) { blueTeam = previousLoser; redTeam = (previousLoser?.name === teamA?.name) ? teamB : teamA; } 
          else { redTeam = previousLoser; blueTeam = (previousLoser?.name === teamA?.name) ? teamB : teamA; }
      }
  
      const setResult = simulateSet(blueTeam, redTeam, currentSet, currentFearlessBans, simOptions);
      const setWinner = setResult?.winnerName || setResult?.winner || null;
      if (setWinner === teamA?.name) { winsA++; previousLoser = teamB; } else { winsB++; previousLoser = teamA; }
  
      matchHistory.push({
        setNumber: currentSet, winner: setWinner,
        picks: blueTeam?.name === teamA?.name ? setResult.picks : { A: setResult.picks?.B, B: setResult.picks?.A },
        bans: blueTeam?.name === teamA?.name ? setResult.bans : { A: setResult.bans?.B, B: setResult.bans?.A },
        // [EXPOSE POG] Pass the POG up to the match history
        pogPlayer: setResult.pogPlayer,
        // [FIX] Save Game Time
        gameTime: setResult.gameTime,
        totalMinutes: setResult.totalMinutes,
        fearlessBans: currentFearlessBans, logs: setResult.logs, resultSummary: setResult.resultSummary,
        scores: { A: setResult.score?.[teamA?.name] ?? 0, B: setResult.score?.[teamB?.name] ?? 0 }
      });
      globalBanList = [...globalBanList, ...(setResult.usedChamps || [])];
      currentSet++;
    }
  
    return { winner: winsA > winsB ? teamA?.name : teamB?.name, loser: winsA > winsB ? teamB?.name : teamA?.name, scoreA: winsA, scoreB: winsB, scoreString: `${winsA}:${winsB}`, history: matchHistory };
}

// --- HELPERS ---
const picksToFullObj = (simplePicks, team) => {
  return (simplePicks || []).map(p => {
      const player = (team?.roster || []).find(r => r.이름 === p.playerName);
      return { playerData: player, role: player ? player.포지션 : 'MID', tier: p.tier, mastery: p.mastery, currentGold: 5000, level: p.level || 9, classType: '전사', dmgType: 'AD' };
  });
};

export const quickSimulateMatch = (teamA, teamB, format = 'BO3', currentChampionList = []) => {
    const safeChampList = (currentChampionList && currentChampionList.length > 0) ? currentChampionList : championList; 
    const targetWins = format === 'BO5' ? 3 : 2;
    let winsA = 0; let winsB = 0; let matchHistory = []; let currentSet = 1;
    let globalBanList = []; 
  
    while (winsA < targetWins && winsB < targetWins) {
        const currentFearlessBans = [...globalBanList];
        const draftResult = runDraftSimulation(teamA, teamB, currentFearlessBans, safeChampList);
        
        const picksA = draftResult.picks.A || []; const picksB = draftResult.picks.B || [];
        const fullPicksA = picksToFullObj(picksA, teamA);
        const fullPicksB = picksToFullObj(picksB, teamB);
  
        // --- PHASE 1: LANING PHASE (14 Minutes) ---
        // Checks raw laning stats. Winner gets small gold lead.
        const pA_14 = calculateTeamPower(fullPicksA, 14, { dragonStacks: {}, grubs: 0 }, 0, [], 840);
        const pB_14 = calculateTeamPower(fullPicksB, 14, { dragonStacks: {}, grubs: 0 }, 0, [], 840);
        
        const phase1Diff = (pA_14 - pB_14);
        const phase1WinChance = 0.5 + (phase1Diff * 0.02); // 2% per point
        const winPhase1 = Math.random() < phase1WinChance; // True = A wins, False = B wins
        
        const goldLead1 = winPhase1 ? 2000 : -2000; // 2k Gold Lead for winner
  
        // --- PHASE 2: MID GAME (25 Minutes) ---
        // Includes Gold Lead from Phase 1. Winner gets Map Control (Soul point/Baron setup).
        const pA_25 = calculateTeamPower(fullPicksA, 25, { dragonStacks: {}, grubs: 0 }, goldLead1, [], 1500);
        const pB_25 = calculateTeamPower(fullPicksB, 25, { dragonStacks: {}, grubs: 0 }, -goldLead1, [], 1500);
  
        const phase2Diff = (pA_25 - pB_25);
        const phase2WinChance = 0.5 + (phase2Diff * 0.025); // Slightly higher weight in mid game
        const winPhase2 = Math.random() < phase2WinChance;
        
        const snowballLead = winPhase2 ? (goldLead1 + 4000) : (goldLead1 - 4000); // Snowball grows
  
        // --- PHASE 3: LATE GAME / ENDING (30+ Minutes) ---
        // This is the Decider. It includes all previous snowballs.
        const pA_End = calculateTeamPower(fullPicksA, 35, { dragonStacks: {}, grubs: 0 }, snowballLead, [], 2100);
        const pB_End = calculateTeamPower(fullPicksB, 35, { dragonStacks: {}, grubs: 0 }, -snowballLead, [], 2100);
  
        // [FIX] Hybrid Win Calculation for Final Check
        const avgPowerA = pA_End / Math.max(1, (picksA.length || 5)); 
        const avgPowerB = pB_End / Math.max(1, (picksB.length || 5));
        const baseRatio = avgPowerA / (avgPowerA + avgPowerB || 1);
        const finalDiff = avgPowerA - avgPowerB;
        const linearBonus = finalDiff * 0.03; // Heavy weight on stats at the end
  
        let winChanceA = baseRatio + linearBonus;
  
        // Variance Damping (If snowballed hard, reduce randomness)
        let varianceRange = 0.10; 
        if (Math.abs(finalDiff) > 10 || (winPhase1 === winPhase2 && winPhase2 === (finalDiff > 0))) {
            // If stats are huge OR one team won both previous phases -> Low Variance
            varianceRange = 0.02; 
        }
        
        winChanceA += (Math.random() * varianceRange) - (varianceRange / 2);
        if (winChanceA > 0.99) winChanceA = 0.99;
        if (winChanceA < 0.01) winChanceA = 0.01;
  
        const isWinA = Math.random() < winChanceA;
        const winner = isWinA ? teamA : teamB;
        if (isWinA) winsA++; else winsB++;
  
        // --- RESULT NARRATIVE GENERATION ---
        let varianceType = 'CLOSE';
        
        // If winner won all 3 phases (Laning, Mid, End) -> STOMP
        const winnerWonP1 = isWinA ? winPhase1 : !winPhase1;
        const winnerWonP2 = isWinA ? winPhase2 : !winPhase2;
        
        if (winnerWonP1 && winnerWonP2) {
            varianceType = 'STOMP';
        } else if (!winnerWonP1 && !winnerWonP2) {
            // Winner lost early and mid but won late -> COMEBACK/FIESTA
            varianceType = 'FIESTA';
        } else {
            varianceType = 'CLOSE';
        }
  
        // Randomize Time based on Narrative
        let baseTime = 30;
        if (varianceType === 'STOMP') baseTime = 23 + Math.random() * 5; // Fast game
        else if (varianceType === 'FIESTA') baseTime = 35 + Math.random() * 12; // Long game
        else baseTime = 28 + Math.random() * 8; // Normal
        
        const gameTime = baseTime; 
        
        // [FIX] Adjusted Score Generation (Lower Kill Counts & Smaller Gaps)
        let winnerKills = 0;
        let loserKills = 0;
  
        if (varianceType === 'STOMP') {
            // Previously: Winner ~22, Loser ~5 (Gap 17)
            // New: Winner ~19, Loser ~6 (Gap 13)
            winnerKills = 16 + Math.floor(Math.random() * 7); // Range: 16-22
            loserKills = 4 + Math.floor(Math.random() * 5);   // Range: 4-8
        } else if (varianceType === 'FIESTA') {
            // Previously: Winner ~30, Loser ~23 (Total ~53)
            // New: Winner ~24, Loser ~18 (Total ~42)
            winnerKills = 20 + Math.floor(Math.random() * 8); // Range: 20-27
            loserKills = 15 + Math.floor(Math.random() * 8);  // Range: 15-22
        } else { // CLOSE
            // Previously: Winner ~17, Loser ~14
            // New: Winner ~14, Loser ~11
            winnerKills = 10 + Math.floor(Math.random() * 8); // Range: 10-17
            loserKills = winnerKills - (1 + Math.floor(Math.random() * 4)); // Gap: 1-4 kills
            if (loserKills < 0) loserKills = 0;
        }
        
        // Safety Cap (Lowered from 36 to 32 to prevent outliers)
        if (winnerKills > 32) winnerKills = 32;
        if (loserKills > 32) loserKills = 32;
  
        // Distribute Stats
        const winnerAssists = Math.floor(winnerKills * (1.5 + Math.random()));
        const loserAssists = Math.floor(loserKills * (1.5 + Math.random()));
  
        const statsA = isWinA 
            ? distributeTeamStats(teamA, picksA, winnerKills, loserKills, winnerAssists, gameTime, true)
            : distributeTeamStats(teamA, picksA, loserKills, winnerKills, loserAssists, gameTime, false);
        
        const statsB = !isWinA 
            ? distributeTeamStats(teamB, picksB, winnerKills, loserKills, winnerAssists, gameTime, true)
            : distributeTeamStats(teamB, picksB, loserKills, winnerKills, loserAssists, gameTime, false);
  
        const winningPicks = isWinA ? statsA : statsB;
        
        if (draftResult.usedChamps) {
            globalBanList = [...globalBanList, ...draftResult.usedChamps];
        }
        
        const pogPlayer = calculatePog(winningPicks, gameTime);
        const pogText = pogPlayer ? `🏅 POG: ${pogPlayer.playerName} (${pogPlayer.champName})` : '';
  
        // [PRESERVED Fix] Calculate Total Kills for Scoreboard
        const totalKillsA = isWinA ? winnerKills : loserKills;
        const totalKillsB = !isWinA ? winnerKills : loserKills;
  
        matchHistory.push({
            setNumber: currentSet, winner: winner?.name,
            picks: { A: statsA, B: statsB },
            bans: draftResult.bans, 
            pogPlayer: pogPlayer,
            gameTime: `${Math.floor(gameTime)}분 ${Math.floor((gameTime % 1) * 60)}초`,
            totalMinutes: Math.floor(gameTime),
            scores: { A: totalKillsA, B: totalKillsB },
            fearlessBans: currentFearlessBans,
            logs: [`[SIM] Set ${currentSet} - Winner: ${winner?.name}`, `Type: ${varianceType}`, pogText], 
            resultSummary: `Winner: ${winner?.name}`
        });
        currentSet++;
    }
    return { winner: winsA > winsB ? teamA?.name : teamB?.name, scoreString: `${winsA}:${winsB}`, scoreA: winsA, scoreB: winsB, history: matchHistory };
  };