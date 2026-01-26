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

  // Create a quick lookup set for availability to speed up the loop
  const availableNames = new Set(availableChampions.map(c => c.name));
  
  // Extract names for synergy checking (since currentTeamPicks are now Objects)
  const currentTeamNames = currentTeamPicks.map(c => c.name);
  const enemyTeamNames = enemyTeamPicks.map(c => c.name);

  // [NEW] Calculate Team Damage Profile
  const currentAD = currentTeamPicks.filter(c => c.damageType === 'AD').length;
  const currentAP = currentTeamPicks.filter(c => c.damageType === 'AP').length;

  const scoredChamps = pool.map(champ => {
    const mastery = playerData?.pool?.find(m => m.name === champ.name);
    let score = calculateChampionScore(player, champ, mastery);

    // --- [STEP 1] Damage Profile Balance (5AP/5AD Prevention) ---
    // If we are late in the draft (3+ picks locked), start balancing damage
    if (currentTeamPicks.length >= 3) {
        let compMultiplier = 1.0;
        
        // Penalize stacking the same damage type
        if (currentAD >= 3 && champ.damageType === 'AD') compMultiplier = 0.6;
        if (currentAP >= 3 && champ.damageType === 'AP') compMultiplier = 0.6;

        // Boost if we are missing a damage type entirely
        if (currentAP === 0 && champ.damageType === 'AP') compMultiplier = 1.5;
        if (currentAD === 0 && champ.damageType === 'AD') compMultiplier = 1.5;
        
        score *= compMultiplier;
    }

    // --- [STEP 2] Existing Active Synergy Bonus ---
    let synergyBonus = 1.0;
    const hypotheticalTeam = [...currentTeamNames, champ.name];

    SYNERGIES.forEach(syn => {
      const involvesChamp = syn.champions.includes(champ.name);
      // Case A: Completes an existing synergy (Immediate Power)
      const isCompleted = syn.champions.every(c => hypotheticalTeam.includes(c));
      
      if (involvesChamp && isCompleted) {
        synergyBonus *= syn.multiplier; 
      }

      // --- [STRATEGY 2] Potential Synergy Bonus (Planning Ahead) ---
      // If I pick this champ, is their partner still available to be picked later?
      else if (involvesChamp) {
          // Find the partner(s) in this synergy that I don't have yet
          const partners = syn.champions.filter(c => c !== champ.name);
          // Check if ALL partners are currently available in the pool
          const partnersAvailable = partners.every(p => availableNames.has(p));
          
          if (partnersAvailable) {
              // Give a small "Potential" bonus
              const potentialBoost = 1 + ((syn.multiplier - 1) * 0.25);
              synergyBonus *= potentialBoost;
          }
      }
    });
    score *= synergyBonus; 

    // --- [STEP 3] Counter Logic ---
    let counterBonus = 1.0;
    // We iterate over enemyTeamPicks (which are now Objects)
    enemyTeamPicks.forEach(enemy => {
        if (champ.counters && champ.counters.includes(enemy.name)) {
            counterBonus *= 0.9; // Self is countered by enemy
        }
        if (enemy.counters && enemy.counters.includes(champ.name)) {
            counterBonus *= 1.1; // Self counters enemy
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

export function selectBanFromProbabilities(opponentTeam, availableChampions, targetRoles, opponentPicks = [], myTeamPicks = []) {
  let candidates = [];
  
  const targetPlayers = opponentTeam.roster.filter(p => targetRoles.includes(p.포지션));
  
  // Convert pick objects to names for easy comparison
  const opponentPickNames = opponentPicks.map(c => c.name);
  const myTeamPickNames = myTeamPicks.map(c => c.name);

  targetPlayers.forEach(player => {
      const playerData = MASTERY_MAP[player.이름];
      const roleChamps = availableChampions.filter(c => c.role === player.포지션);
      const scored = roleChamps.map(c => {
           const mastery = playerData?.pool?.find(m => m.name === c.name);
           let banScore = calculateChampionScore(player, c, mastery);

           // --- [STRATEGY 3] Denial Bans (Smart Counter-Synergy) ---
           let synergyMultiplier = 1.0;
           
           const hypotheticalEnemyTeam = [...opponentPickNames, c.name];

           SYNERGIES.forEach(syn => {
              const involvesChamp = syn.champions.includes(c.name);
              
              if (involvesChamp) {
                  const partners = syn.champions.filter(n => n !== c.name);
                  const enemyHasPartners = partners.every(p => opponentPickNames.includes(p));

                  if (enemyHasPartners) {
                      synergyMultiplier *= 2.0; 
                  } 
                  else if (syn.champions.every(n => hypotheticalEnemyTeam.includes(n))) {
                      synergyMultiplier *= syn.multiplier; 
                  }
              }
           });
           
           banScore *= synergyMultiplier;

           // --- [STEP 5] Ban Counter Logic ---
           let counterMultiplier = 1.0;
           myTeamPickNames.forEach(myPickName => {
               if (c.counters && c.counters.includes(myPickName)) {
                   counterMultiplier *= 1.1;
               }
           });
           
           banScore *= counterMultiplier;

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

    // Get current picks as FULL OBJECTS for pick logic
    const currentMySidePicks = Object.values(picks[mySide]);
    const opponentSide = step.side === 'BLUE' ? 'RED' : 'BLUE';
    const currentEnemyPicks = Object.values(picks[opponentSide]); 

    if (step.type === 'BAN') {
      const opponentOpenRoles = remainingRoles[opponentSide];
      
      const banCandidate = selectBanFromProbabilities(
        opponentTeam, 
        availableChamps, 
        opponentOpenRoles, 
        currentEnemyPicks, // Pass full objects
        currentMySidePicks // Pass full objects
      );
      
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
            // [UPDATE] We now pass full objects to check damage types
            const candidateChamp = selectPickFromTop3(
              player, 
              availableChamps, 
              currentMySidePicks, 
              currentEnemyPicks
            );
            
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