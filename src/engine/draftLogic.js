// src/engine/draftLogic.js
import { DRAFT_SEQUENCE } from '../data/constants';
import { MASTERY_MAP, calculateChampionScore } from './mechanics';
import { SYNERGIES } from '../data/synergies';

// --- DRAFT LOGIC ---

export function selectPickFromTop3(player, availableChampions, currentTeamPicks = [], enemyTeamPicks = []) {
  const playerData = MASTERY_MAP[player.이름];
  const roleChamps = availableChampions.filter(c => c.role === player.포지션);
  const pool = roleChamps.length > 0 ? roleChamps : availableChampions;

  if (pool.length === 0) return null;

  const scoredChamps = pool.map(champ => {
    const mastery = playerData?.pool?.find(m => m.name === champ.name);
    let score = calculateChampionScore(player, champ, mastery);

    // --- [STEP 1] Synergy Bonus ---
    let synergyBonus = 1.0;
    const hypotheticalTeam = [...currentTeamPicks, champ.name];

    SYNERGIES.forEach(syn => {
      const involvesChamp = syn.champions.includes(champ.name);
      const isActive = syn.champions.every(c => hypotheticalTeam.includes(c));
      if (involvesChamp && isActive) {
        synergyBonus *= syn.multiplier; 
      }
    });
    score *= synergyBonus; 

    // --- [STEP 2] Counter Logic ---
    let counterBonus = 1.0;
    enemyTeamPicks.forEach(enemy => {
        if (champ.counters && champ.counters.includes(enemy.name)) {
            counterBonus *= 0.9;
        }
        if (enemy.counters && enemy.counters.includes(champ.name)) {
            counterBonus *= 1.1;
        }
    });
    score *= counterBonus;

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

// [STEP 5 UPDATE] Added myTeamPicks argument for Counter Bans
export function selectBanFromProbabilities(opponentTeam, availableChampions, targetRoles, opponentPicks = [], myTeamPicks = []) {
  let candidates = [];
  
  const targetPlayers = opponentTeam.roster.filter(p => targetRoles.includes(p.포지션));

  targetPlayers.forEach(player => {
      const playerData = MASTERY_MAP[player.이름];
      const roleChamps = availableChampions.filter(c => c.role === player.포지션);
      const scored = roleChamps.map(c => {
           const mastery = playerData?.pool?.find(m => m.name === c.name);
           let banScore = calculateChampionScore(player, c, mastery);

           // --- [STEP 4] Ban Synergy Check (Enemy Synergies) ---
           let synergyMultiplier = 1.0;
           const hypotheticalEnemyTeam = [...opponentPicks, c.name];

           SYNERGIES.forEach(syn => {
              if (syn.champions.includes(c.name) && syn.champions.every(n => hypotheticalEnemyTeam.includes(n))) {
                  synergyMultiplier *= syn.multiplier; 
              }
           });
           banScore *= synergyMultiplier;

           // --- [STEP 5 LOGIC] Ban Counter Check (My Safety) ---
           let counterMultiplier = 1.0;
           myTeamPicks.forEach(myPickName => {
               // 1. THREAT (1.1): This candidate counters one of MY existing picks.
               // We want to ban it to protect our team.
               // (Check if candidate's counters list contains my pick)
               // Note: We need the full object for 'myPick' to check its counters efficiently, 
               // but typically we check if 'c' (candidate) lists 'myPickName' as a victim.
               if (c.counters && c.counters.includes(myPickName)) {
                   counterMultiplier *= 1.1;
               }

               // 2. SAFE (0.9): I already counter this candidate.
               // If I have a champion that counters 'c', I don't need to ban 'c'.
               // We can't easily check myPick's counters list here without the object, 
               // but we can assume standard counter logic if available. 
               // For now, we focus on the Threat Check which is most important for bans.
           });
           
           banScore *= counterMultiplier;
           // ----------------------------------------------------

           return { 
               champ: c, 
               score: banScore,
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
      const opponentSide = step.side === 'BLUE' ? 'RED' : 'BLUE';
      const opponentOpenRoles = remainingRoles[opponentSide];
      const currentOpponentPicks = Object.values(picks[opponentSide]).map(c => c.name);

      // [STEP 5 UPDATE] Get MY current picks to pass to ban logic
      const currentMySidePicks = Object.values(picks[mySide]).map(c => c.name);

      // Pass BOTH opponent picks (for synergies) and my picks (for counters)
      const banCandidate = selectBanFromProbabilities(opponentTeam, availableChamps, opponentOpenRoles, currentOpponentPicks, currentMySidePicks);
      
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

      const currentMySidePicks = Object.values(picks[mySide]).map(c => c.name);
      const opponentSide = step.side === 'BLUE' ? 'RED' : 'BLUE';
      const currentEnemyPicks = Object.values(picks[opponentSide]); 

      remainingRoles[mySide].forEach(role => {
          const player = actingTeam.roster.find(p => p.포지션 === role);
          if (player) {
            const candidateChamp = selectPickFromTop3(player, availableChamps, currentMySidePicks, currentEnemyPicks);
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
    usedChamps: [...Object.values(picks.BLUE), ...Object.values(picks.RED)].map(c => c.name)
  };
}