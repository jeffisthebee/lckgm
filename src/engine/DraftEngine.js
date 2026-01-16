// src/engine/draftEngine.js
import { DRAFT_SEQUENCE } from '../data/constants';
import { MASTERY_MAP, calculateChampionScore } from './mechanics';

// --- DRAFT LOGIC ---
export function selectPickFromTop3(player, availableChampions) {
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

export function selectBanFromProbabilities(opponentTeam, availableChampions, targetRoles) {
  let candidates = [];
  
  const targetPlayers = opponentTeam.roster.filter(p => targetRoles.includes(p.포지션));

  targetPlayers.forEach(player => {
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
      const opponentSide = step.side === 'BLUE' ? 'RED' : 'BLUE';
      const opponentOpenRoles = remainingRoles[opponentSide];
      const banCandidate = selectBanFromProbabilities(opponentTeam, availableChamps, opponentOpenRoles);
      
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
    usedChamps: [...Object.values(picks.BLUE), ...Object.values(picks.RED)].map(c => c.name)
  };
}