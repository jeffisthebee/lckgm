// src/engine/gameLogic.js
import { GAME_RULES, SIDES, MAP_LANES, championList, SIM_CONSTANTS } from '../data/constants';
import { runDraftSimulation } from './draftLogic';
import { 
  calculateTeamPower, resolveCombat, calculateIndividualIncome, 
  calculateDeathTimer, getChampionClass 
} from './mechanics';

// --- HELPER: Standardized POG Calculation ---
function calculatePog(winningPicks, gameMinutes) {
    const candidates = winningPicks.map(p => {
        const stats = p.stats || {};
        const k = stats.kills !== undefined ? stats.kills : (p.k || 0);
        const d = stats.deaths !== undefined ? stats.deaths : (p.d || 0);
        const a = stats.assists !== undefined ? stats.assists : (p.a || 0);
        const dmg = stats.damage !== undefined ? stats.damage : (p.damage || 0);
        
        const safeD = d === 0 ? 1 : d;
        const kda = (k + a) / safeD;
        const dpm = dmg / (gameMinutes || 1); 
        
        let pogScore = (kda * 3) + (dpm / 100) + (p.currentGold / 1000) + (a * 1);
        
        const role = p.playerData?.포지션 || 'MID';
        if (['JGL', '정글', 'SUP', '서포터'].includes(role)) {
            pogScore *= 1.15;
        }

        return { ...p, kdaVal: kda, pogScore: pogScore, dpm: dpm };
    });

    candidates.sort((a, b) => b.pogScore - a.pogScore);
    return candidates[0]; 
}

// --- GAME LOGIC ---
export function runGameTickEngine(teamBlue, teamRed, picksBlue, picksRed, simOptions = {}) {
    let time = 0; 
    let logs = [];
    const { difficulty = 'normal', playerTeamName = '' } = simOptions;
    let gameOver = false;
    let endAbsSecond = 0;
  
    // Initialize Players
    picksBlue.forEach(p => {
        p.side = 'BLUE'; p.currentGold = GAME_RULES.GOLD.START; p.level = 1; p.xp = 0; p.deadUntil = 0;
        p.stats = { kills: 0, deaths: 0, assists: 0, damage: 0, takenDamage: 0 }; p.flashEndTime = 0;
    });
    picksRed.forEach(p => {
        p.side = 'RED'; p.currentGold = GAME_RULES.GOLD.START; p.level = 1; p.xp = 0; p.deadUntil = 0;
        p.stats = { kills: 0, deaths: 0, assists: 0, damage: 0, takenDamage: 0 }; p.flashEndTime = 0;
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
      nextDragonTimeAbs: GAME_RULES.OBJECTIVES.DRAGON.initial_spawn * 60, 
      nextBaronTimeAbs: GAME_RULES.OBJECTIVES.BARON.spawn * 60,        
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
        const myTeamGold = state.gold[teamSide];
        const enemyTeamGold = state.gold[teamSide === 'BLUE' ? 'RED' : 'BLUE'];
        if (enemyTeamGold - myTeamGold >= 5000) finalAmount = Math.floor(amount * 1.15);
        const picks = teamSide === 'BLUE' ? picksBlue : picksRed;
        picks[playerIdx].currentGold += finalAmount;
        state.gold[teamSide] += finalAmount;
    };
  
    const grantTeamGold = (teamSide, amountPerPlayer) => {
        let finalAmount = amountPerPlayer;
        const myTeamGold = state.gold[teamSide];
        const enemyTeamGold = state.gold[teamSide === 'BLUE' ? 'RED' : 'BLUE'];
        if (enemyTeamGold - myTeamGold >= 5000) finalAmount = Math.floor(amountPerPlayer * 1.15);
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
            if (time > 0) { p.currentGold += income.gold; state.gold[teamSide] += income.gold; }
            if (p.level < 18) {
              p.xp += income.xp;
              while (p.level < 18) {
                  const requiredXP = 180 + (p.level * 100);
                  if (p.xp >= requiredXP) { p.xp -= requiredXP; p.level++; } else { break; }
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
        dragonStacks: state.dragons[side].reduce((acc, d) => ({ ...acc, [d]: (acc[d] || 0) + 1 }), {}),
        soul: state.soul?.side === side ? { type: state.soul.type } : null,
        baron: state.baronBuff.side === side && state.baronBuff.endTime >= time,
        elder: state.elderBuff.side === side && state.elderBuff.endTime >= time,
        grubs: state.grubs[side]
      });
  
      let powerBlue = calculateTeamPower(picksBlue, time, getActiveBuffs('BLUE'), 0, picksRed, minuteStartAbs);
      let powerRed = calculateTeamPower(picksRed, time, getActiveBuffs('RED'), 0, picksBlue, minuteStartAbs);
      
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
          state.baronBuff = { side: winner, endTime: time + GAME_RULES.OBJECTIVES.BARON.duration };
          grantTeamGold(winner, GAME_RULES.OBJECTIVES.BARON.gold / 5);
          state.nextBaronTimeAbs = eventAbsTime + (GAME_RULES.OBJECTIVES.DRAGON.respawn * 60); 
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
          state.elderBuff = { side: winner, endTime: time + GAME_RULES.OBJECTIVES.ELDER.duration };
          state.nextElderTimeAbs = eventAbsTime + (GAME_RULES.OBJECTIVES.ELDER.spawn_after_soul * 60); 
          addEvent(eventSec, `🐲 ${winner === 'BLUE' ? teamBlue.name : teamRed.name} 장로 드래곤 처치!`);
      }
  
      // --- Combat ---
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
        const losingTeamPicks = winner === 'BLUE' ? picksRed : picksBlue;
        let maxKills = 1;
        const roll = Math.random(); 
        if (roll > 0.99) maxKills = 5; else if (roll > 0.96) maxKills = 4; else if (roll > 0.91) maxKills = 3; else if (roll > 0.71) maxKills = 2; else maxKills = 1;
        
        const getAlivePlayers = (picks) => picks.filter(p => p.deadUntil <= combatAbsTime);
        let killCount = 0;
        let aliveWinners = getAlivePlayers(winningTeamPicks);
        const killer = getWeightedPlayer(aliveWinners, 'KILL');
  
        for(let k=0; k<maxKills; k++) {
            const aliveLosers = getAlivePlayers(losingTeamPicks);
            const validVictims = aliveLosers.filter(v => v.side && killer && v.side !== killer.side);
            if (!killer || validVictims.length === 0) break;
            const victim = validVictims[Math.floor(Math.random() * validVictims.length)];
            
            if (victim) {
                killCount++; state.kills[winner]++; killer.stats.kills++; victim.stats.deaths++;
                victim.deadUntil = combatAbsTime + calculateDeathTimer(victim.level, time);
                grantGoldToPlayer(winner, winningTeamPicks.indexOf(killer), GAME_RULES.GOLD.KILL);
                let assistCount = Math.floor(Math.random() * 3) + 1; 
                const assistCandidates = getAlivePlayers(winningTeamPicks).filter(p => p.playerName !== killer.playerName && p.side === killer.side);
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
                if (killCount === 2) multiKillLabel = ' [더블 킬!]'; if (killCount === 3) multiKillLabel = ' [트리플 킬!]'; if (killCount === 4) multiKillLabel = ' [쿼드라 킬!]'; if (killCount === 5) multiKillLabel = ' [펜타 킬!]';
                const killMsg = `⚔️ [${killer.playerData.포지션}] ${killer.playerName} (${killerChamp}) ➜ ☠️ [${victim.playerData.포지션}] ${victim.playerName} (${victimChamp})${assistText}${flashMsg}${multiKillLabel}`;
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
                    state.kills[loser] += 1; counterKiller.stats.kills += 1; counterVictim.stats.deaths += 1;
                    counterVictim.deadUntil = combatAbsTime + calculateDeathTimer(counterVictim.level, time);
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
              let lanerIdx = 0; if (lane === 'MID') lanerIdx = 2; if (lane === 'BOT') lanerIdx = 3; 
  
              if (!enemyLane.tier1.destroyed) {
                  if (time >= GAME_RULES.OBJECTIVES.PLATES.start_time && time < GAME_RULES.OBJECTIVES.PLATES.end_time) {
                      if (Math.random() < 0.4 * pushPower) {
                           if (enemyLane.tier1.plates > 0) {
                               enemyLane.tier1.plates--;
                               grantGoldToPlayer(winner, lanerIdx, GAME_RULES.GOLD.TURRET.OUTER_PLATE.local);
                               grantTeamGold(winner, GAME_RULES.GOLD.TURRET.OUTER_PLATE.team);
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
                      let localG = lane === 'MID' ? GAME_RULES.GOLD.TURRET.INNER_MID.local : GAME_RULES.GOLD.TURRET.INNER_SIDE.local;
                      let teamG = lane === 'MID' ? GAME_RULES.GOLD.TURRET.INNER_MID.team : GAME_RULES.GOLD.TURRET.INNER_SIDE.team;
                      grantGoldToPlayer(winner, lanerIdx, localG); grantTeamGold(winner, teamG);
                      addEvent(currentPushSec, `💥 ${winnerName}, ${lane} 2차 포탑 파괴`);
                  }
              } else if (!enemyLane.tier3.destroyed) {
                  if (Math.random() < 0.2 * pushPower) {
                      enemyLane.tier3.destroyed = true;
                      grantGoldToPlayer(winner, lanerIdx, GAME_RULES.GOLD.TURRET.INHIB_TURRET.local); grantTeamGold(winner, GAME_RULES.GOLD.TURRET.INHIB_TURRET.team);
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
    const winnerName = winnerSide === 'BLUE' ? teamBlue.name : teamRed.name;
    const totalSeconds = gameOver ? endAbsSecond : (time * 60);
    const totalMinutes = Math.floor(totalSeconds / 60);
    const finalTimeStr = formatTime(totalMinutes, totalSeconds % 60);
    logs.sort((a, b) => a.abs - b.abs);
  
    return {
      winnerName: winnerName, winnerSide: winnerSide, gameTime: `${totalMinutes}분 ${totalSeconds % 60}초`,
      totalMinutes: totalMinutes, totalSeconds, endSecond: totalSeconds % 60, gameOver, finalTimeStr,
      logs: logs.map(l => l.message), finalKills: state.kills,
    };
}

export function simulateSet(teamBlue, teamRed, setNumber, fearlessBans, simOptions) {
    const { currentChampionList } = simOptions;
    const draftResult = runDraftSimulation(teamBlue, teamRed, fearlessBans || [], currentChampionList || championList);
  
    if (!draftResult || !draftResult.picks || draftResult.picks.A.length < 5) {
      return { gameOver: true, winnerName: null, resultSummary: 'Draft incomplete', picks: { A: [], B: [] }, bans: { A: [], B: [] }, logs: [] };
    }
  
    const getConditionModifier = (player) => {
        const stability = player?.상세?.안정성 || 50;
        const variancePercent = ((100 - stability) / stability) * 10; 
        const fluctuation = (Math.random() * variancePercent * 2) - variancePercent;
        return 1 + (fluctuation / 100);
    };
  
    const addPlayerData = (picks, roster) => {
        return picks.map(p => {
            const playerData = roster.find(player => player && player.이름 === p.playerName);
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
  
    const picksBlue_detailed = addPlayerData(draftResult.picks.A, teamBlue.roster);
    const picksRed_detailed = addPlayerData(draftResult.picks.B, teamRed.roster);
    const gameResult = runGameTickEngine(teamBlue, teamRed, picksBlue_detailed, picksRed_detailed, simOptions);
  
    const usedChamps = [...draftResult.picks.A.map(p => p.champName), ...draftResult.picks.B.map(p => p.champName)];
    const scoreBlue = gameResult.finalKills[SIDES.BLUE];
    const scoreRed = gameResult.finalKills[SIDES.RED];
    
    // [POG UPDATE] Calculate POG using the helper
    const winningPicks = gameResult.winnerSide === SIDES.BLUE ? picksBlue_detailed : picksRed_detailed;
    const pogPlayer = calculatePog(winningPicks, gameResult.totalMinutes);
  
    const resultSummary = `⏱️ ${gameResult.gameTime} | ⚔️ ${teamBlue.name} ${scoreBlue} : ${scoreRed} ${teamRed.name} | 🏆 승리: ${gameResult.winnerName}`;
    const pogText = pogPlayer ? `🏅 POG: [${pogPlayer.playerData.포지션}] ${pogPlayer.playerName} (${pogPlayer.champName}) - Score: ${pogPlayer.pogScore.toFixed(1)}` : 'POG 선정 실패';
  
    const finalLogs = [`========== [ 밴픽 단계 ] ==========`, ...draftResult.draftLogs, `========== [ 경기 결과 ] ==========`, resultSummary, pogText, pogPlayer ? `KDA: ${pogPlayer.stats.kills}/${pogPlayer.stats.deaths}/${pogPlayer.stats.assists} | DPM: ${Math.floor(pogPlayer.dpm)} | LV: ${pogPlayer.level}` : '', `===================================`, ...gameResult.logs];
    const playersLevelProgress = [...picksBlue_detailed, ...picksRed_detailed].map(p => ({ playerName: p.playerName, startLevel: 1, endLevel: p.level || 1 }));
  
    return {
      winnerName: gameResult.winnerName, resultSummary: resultSummary + ' ' + pogText,
      // [EXPOSE POG] We explicitly return the POG object now
      pogPlayer: pogPlayer, 
      picks: draftResult.picks, bans: draftResult.bans, logs: finalLogs, usedChamps: usedChamps,
      score: { [teamBlue.name]: String(scoreBlue), [teamRed.name]: String(scoreRed) },
      gameResult, totalMinutes: gameResult.totalMinutes, totalSeconds: gameResult.totalSeconds,
      endSecond: gameResult.endSecond, gameOver: gameResult.gameOver, finalTimeStr: gameResult.finalTimeStr,
      // [FIX] Ensure gameTime is passed up for consistency
      gameTime: gameResult.gameTime,
      playersLevelProgress, fearlessBans: draftResult.fearlessBans || (Array.isArray(fearlessBans) ? [...fearlessBans] : (fearlessBans ? [fearlessBans] : []))
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
          if (loserPicksBlue) { blueTeam = previousLoser; redTeam = (previousLoser.name === teamA.name) ? teamB : teamA; } 
          else { redTeam = previousLoser; blueTeam = (previousLoser.name === teamA.name) ? teamB : teamA; }
      }
  
      const setResult = simulateSet(blueTeam, redTeam, currentSet, currentFearlessBans, simOptions);
      if (setResult.winnerName === teamA.name) { winsA++; previousLoser = teamB; } else { winsB++; previousLoser = teamA; }
  
      matchHistory.push({
        setNumber: currentSet, winner: setResult.winnerName,
        picks: blueTeam.name === teamA.name ? setResult.picks : { A: setResult.picks.B, B: setResult.picks.A },
        bans: blueTeam.name === teamA.name ? setResult.bans : { A: setResult.bans.B, B: setResult.bans.A },
        // [EXPOSE POG] Pass the POG up to the match history
        pogPlayer: setResult.pogPlayer,
        // [FIX] Save Game Time
        gameTime: setResult.gameTime,
        totalMinutes: setResult.totalMinutes,
        fearlessBans: currentFearlessBans, logs: setResult.logs, resultSummary: setResult.resultSummary,
        scores: { A: setResult.score[teamA.name], B: setResult.score[teamB.name] }
      });
      globalBanList = [...globalBanList, ...setResult.usedChamps];
      currentSet++;
    }
  
    return { winner: winsA > winsB ? teamA.name : teamB.name, loser: winsA > winsB ? teamB.name : teamA.name, scoreA: winsA, scoreB: winsB, scoreString: `${winsA}:${winsB}`, history: matchHistory };
}

// --- HELPERS ---
const picksToFullObj = (simplePicks, team) => {
  return simplePicks.map(p => {
      const player = team.roster.find(r => r.이름 === p.playerName);
      return { playerData: player, role: player ? player.포지션 : 'MID', tier: p.tier, mastery: p.mastery, currentGold: 5000, level: 9, classType: '전사', dmgType: 'AD' };
  });
};

// src/engine/gameLogic.js (Update this function)

const distributeKillsToPlayers = (totalKills, picks) => {
    const roleWeights = { 'ADC': 35, 'MID': 30, 'TOP': 20, 'JGL': 15, 'SUP': 5 };
    const playerKills = new Array(5).fill(0);
    
    for (let i = 0; i < totalKills; i++) {
        // Create a weighted lottery pool
        let pool = [];
        picks.forEach((p, idx) => {
            const role = p.playerData?.포지션 || 'MID';
            // Increase weight slightly if player has high offensive stats
            const aggression = (p.playerData?.상세?.무력 || 50) / 10;
            const weight = (roleWeights[role] || 10) + aggression;
            
            // Add index to pool 'weight' times (simple weighted random)
            for(let w=0; w < weight; w++) pool.push(idx);
        });
        
        // Pick a winner for this kill
        if (pool.length > 0) {
            const winnerIdx = pool[Math.floor(Math.random() * pool.length)];
            playerKills[winnerIdx]++;
        }
    }
    return playerKills;
};

// [FIXED] Updated Stats Generator using "Top-Down" distribution
const generatePostGameStats = (team, isWinner, picks, gameTime, varianceType, teamTotalKills) => {
    // 1. Distribute the pre-calculated total kills
    const distributedKills = distributeKillsToPlayers(teamTotalKills, picks);

    return picks.map((p, idx) => {
        const playerObj = team.roster.find(r => r.이름 === p.playerName) || { 포지션: 'MID', 상세: {} };
        const pickObj = { playerData: playerObj, currentGold: 0 }; 
        
        const incomeMod = isWinner ? 1.05 : 0.95;
        const resources = calculateIndividualIncome(pickObj, gameTime, incomeMod);
        const isCarry = ['MID', 'ADC', 'TOP'].includes(playerObj.포지션);
        
        // 2. Assign Kills from distribution
        let k = distributedKills[idx];
        
        // 3. Generate Deaths (Logic: Losers die more, but capped to be realistic)
        let d = 0;
        if (!isWinner) {
            // Loser deaths roughly correlate to enemy kills, but spread out
            // Stomp loser: high deaths. Close loser: moderate deaths.
            const baseDeath = varianceType === 'STOMP' ? 5 : 3;
            d = Math.floor(Math.random() * 4) + baseDeath; 
            if (['SUP', 'JGL'].includes(playerObj.포지션)) d += 1; // Sup/Jgl sacrifice more
        } else {
            // Winner deaths
            d = Math.floor(Math.random() * 3); // 0 to 2 deaths usually
            if (varianceType === 'FIESTA') d += 2; // More deaths in fiesta
        }

        // 4. Generate Assists (Correlates to Team Kills)
        // A player participates in 40-80% of team kills
        const killParticipation = 0.4 + (Math.random() * 0.4);
        let a = Math.floor(teamTotalKills * killParticipation);
        if (a > teamTotalKills) a = teamTotalKills; // Can't assist more than total kills
        if (a < 0) a = 0;
        // Self-correction: Can't assist your own kills? Actually in LoL stats you can't, but simple logic is fine. 
        // Let's refine: assists = (Total Team Kills - My Kills) * Participation
        const teammatesKills = Math.max(0, teamTotalKills - k);
        a = Math.floor(teammatesKills * killParticipation);

        // 5. Damage Calculation
        let damage = isCarry ? (Math.random() * 15000 + 10000) : (Math.random() * 8000 + 4000);
        damage *= (gameTime / 25); 
        if (varianceType === 'FIESTA') damage *= 1.4;

        return { 
            ...p, k, d, a, damage,
            // Gold = Farm + (Kills * 300) + (Assists * 150)
            currentGold: Math.floor(resources.gold * gameTime) + 500 + (k * 300) + (a * 150), 
            lvl: Math.min(18, Math.floor(resources.xp / 1000) + 6),
            stats: { kills: k, deaths: d, assists: a, damage: Math.floor(damage) }
        };
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
      
      const picksA = draftResult.picks.A; const picksB = draftResult.picks.B;
      const mockBuffs = { dragonStacks: { infernal: 0 }, grubs: 0, herald: false, baron: false, elder: false, soul: null };
      
      // Calculate Power to decide winner
      const pA = calculateTeamPower(picksToFullObj(picksA, teamA), 25, mockBuffs, 0, [], 1500);
      const pB = calculateTeamPower(picksToFullObj(picksB, teamB), 25, mockBuffs, 0, [], 1500);
      
      const avgPowerA = pA / 5; 
      const avgPowerB = pB / 5;
      let winChanceA = avgPowerA / (avgPowerA + avgPowerB);
      winChanceA += (Math.random() * 0.10 - 0.05); // Upset chance
      
      const isWinA = Math.random() < winChanceA;
      const winner = isWinA ? teamA : teamB;
      if (isWinA) winsA++; else winsB++;

      // [FIX 1] Determine Game Variance & TOTAL KILLS First (Capped at 35)
      const powerDiff = Math.abs(avgPowerA - avgPowerB);
      let varianceType = 'CLOSE';
      let scoreWinner = 0;
      let scoreLoser = 0;

      const roll = Math.random();
      if (powerDiff > 15 && roll > 0.3) varianceType = 'STOMP'; 
      else if (roll > 0.85) varianceType = 'FIESTA'; 
      else varianceType = 'CLOSE';

      if (varianceType === 'STOMP') {
          scoreWinner = 18 + Math.floor(Math.random() * 12); // 18 - 30
          scoreLoser = 1 + Math.floor(Math.random() * 6);    // 1 - 7
      } else if (varianceType === 'FIESTA') {
          scoreWinner = 20 + Math.floor(Math.random() * 15); // 20 - 35
          scoreLoser = 15 + Math.floor(Math.random() * 15);  // 15 - 30
      } else { // CLOSE
          scoreWinner = 10 + Math.floor(Math.random() * 12); // 10 - 22
          scoreLoser = scoreWinner - (2 + Math.floor(Math.random() * 5)); // Close gap
      }

      // [FIX 2] Apply Hard Cap (35 +- 1)
      scoreWinner = Math.min(36, Math.max(5, scoreWinner));
      scoreLoser = Math.min(scoreWinner - 1, Math.max(0, scoreLoser));

      // Randomize Time
      let gameTime = 30;
      if (varianceType === 'STOMP') gameTime = 23 + Math.random() * 5;
      else if (varianceType === 'FIESTA') gameTime = 32 + Math.random() * 10;
      else gameTime = 28 + Math.random() * 8;

      // [FIX 3] Pass total kills to generator
      const totalKillsA = isWinA ? scoreWinner : scoreLoser;
      const totalKillsB = isWinA ? scoreLoser : scoreWinner;

      const statsA = generatePostGameStats(teamA, isWinA, picksA, gameTime, varianceType, totalKillsA);
      const statsB = generatePostGameStats(teamB, !isWinA, picksB, gameTime, varianceType, totalKillsB);
      const winningPicks = isWinA ? statsA : statsB;
      
      if (draftResult.usedChamps) {
          globalBanList = [...globalBanList, ...draftResult.usedChamps];
      }
      
      const pogPlayer = calculatePog(winningPicks, gameTime);
      const pogText = pogPlayer ? `🏅 POG: ${pogPlayer.playerName} (${pogPlayer.champName})` : '';

      matchHistory.push({
          setNumber: currentSet, winner: winner.name,
          picks: { A: statsA, B: statsB },
          bans: draftResult.bans, 
          pogPlayer: pogPlayer,
          gameTime: `${Math.floor(gameTime)}분 ${Math.floor((gameTime % 1) * 60)}초`,
          totalMinutes: Math.floor(gameTime),
          
          // These now perfectly match the sum of stats because we distributed them!
          scores: { A: totalKillsA, B: totalKillsB },
          
          fearlessBans: currentFearlessBans,
          logs: [`[SIM] Set ${currentSet} - Winner: ${winner.name}`, `Game Pace: ${varianceType}`, pogText], 
          resultSummary: `Winner: ${winner.name}`
      });
      currentSet++;
  }
  return { winner: winsA > winsB ? teamA.name : teamB.name, scoreString: `${winsA}:${winsB}`, scoreA: winsA, scoreB: winsB, history: matchHistory };
};