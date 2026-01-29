// src/engine/statsManager.js
// Computes aggregated statistics (POG leaderboard, player ratings, champion meta, KDA leaders)
// from a league object. Defensive and tolerant to multiple match/set shapes.

/**
 * Options:
 * - regularOnly: boolean (if true, include only matches with type === 'regular')
 * - roleFilter: 'ALL' | 'TOP' | 'JGL' | 'MID' | 'ADC' | 'SUP'
 */
export function computeStatsForLeague(league, options = {}) {
  const { regularOnly = false, roleFilter = 'ALL' } = options || {};

  // Aggregators
  const pogCounts = new Map(); // playerName -> { count, lastScore, teams:Set }
  const playerRatingAgg = new Map(); // playerName -> { sumScore, games, roles: {TOP: n...}, teams:Set }
  const championAgg = new Map(); // champName -> { pickCount, banCount, winCount }
  const kdaAgg = new Map(); // playerName -> { kills, deaths, assists, games, teams:Set }

  let totalSets = 0;

  // Helpers
  const safeNum = (v) => {
    const n = Number(v);
    return Number.isNaN(n) ? 0 : n;
  };

  // Global name cleaner to fix "Missing 10 points" due to whitespace mismatches
  const cleanName = (n) => {
      if (!n) return null;
      return String(n).trim();
  };

  const normalizeRole = (r) => {
    if (!r) return null;
    const up = String(r).toUpperCase();
    if (['TOP','JGL','MID','ADC','SUP','SUPP','SPT'].includes(up)) {
      if (up === 'SPT' || up === 'SUPP') return 'SUP';
      return up === 'SPT' ? 'SUP' : (up === 'SUPP' ? 'SUP' : up);
    }
    return up;
  };

  const extractPicks = (set) => {
    if (!set) return { A: [], B: [] };
    const picks = set.picks || set.PICKS || set.picksA || null;
    if (Array.isArray(set.picks?.A) || Array.isArray(set.picks?.B)) {
      return { A: set.picks.A || [], B: set.picks.B || [] };
    }
    if (Array.isArray(set.A) || Array.isArray(set.B)) {
      return { A: set.A || [], B: set.B || [] };
    }
    if (Array.isArray(set.picks)) return { A: set.picks, B: [] };
    return { A: [], B: [] };
  };

  const extractBans = (set) => {
    if (!set) return { A: [], B: [] };
    if (set.bans && (Array.isArray(set.bans.A) || Array.isArray(set.bans.B))) {
      return { A: set.bans.A || [], B: set.bans.B || [] };
    }
    if (Array.isArray(set.bans)) return { A: set.bans, B: [] };
    return { A: [], B: [] };
  };

  const extractPog = (set) => {
    if (!set) return null;
    return set.pogPlayer || set.pog || set.posPlayer || null;
  };

  const computePlayerScoreFromStats = (p) => {
    if (!p) return 0;
    const k = safeNum(p.k ?? p.stats?.kills ?? p.stats?.kill ?? 0);
    const d = safeNum(p.d ?? p.stats?.deaths ?? p.stats?.death ?? 0);
    const a = safeNum(p.a ?? p.stats?.assists ?? p.stats?.assist ?? 0);
    const damage = safeNum(p.stats?.damage ?? p.damage ?? 0);
    const gold = safeNum(p.currentGold ?? p.gold ?? 0);
    const safeD = d === 0 ? 1 : d;
    let score = ((k + a) / safeD) * 3 + (damage / 3000) + (gold / 1000) + (a * 0.65);
    const role = normalizeRole(p.playerData?.포지션 || p.role || p.position);
    if (['TOP', '탑'].includes(role)) score *= 1.05;
    if (['JGL', '정글'].includes(role)) score *= 1.07;
    if (['SUP', '서포터'].includes(role)) score *= 1.10;
    return score;
  };

  const determineWinnerSide = (set, matchContext) => {
    if (set.scores && (set.scores.A !== undefined || set.scores.B !== undefined)) {
      const a = safeNum(set.scores.A);
      const b = safeNum(set.scores.B);
      if (a > b) return 'A';
      if (b > a) return 'B';
      return null;
    }
    if (set.winner || set.winnerName) {
      const winnerName = set.winner || set.winnerName;
      if (matchContext) {
        const blueN = matchContext.blueTeamName || matchContext.teamAName || matchContext.t1Name;
        const redN = matchContext.redTeamName || matchContext.teamBName || matchContext.t2Name;
        if (blueN && blueN === winnerName) return 'A';
        if (redN && redN === winnerName) return 'B';
      }
      const picks = extractPicks(set);
      const aHasWinner = (picks.A || []).some(p => (p.playerData?.팀 || p.team || p.teamName) === winnerName);
      const bHasWinner = (picks.B || []).some(p => (p.playerData?.팀 || p.team || p.teamName) === winnerName);
      if (aHasWinner && !bHasWinner) return 'A';
      if (bHasWinner && !aHasWinner) return 'B';
    }
    if (set.winnerSide) {
      const side = String(set.winnerSide).toUpperCase();
      if (side === 'BLUE' || side === 'A') return 'A';
      if (side === 'RED' || side === 'B') return 'B';
    }
    return null;
  };

  const getSetsFromMatch = (match) => {
    if (!match) return [];
    if (Array.isArray(match.history) && match.history.length > 0) return match.history;
    if (match.result && Array.isArray(match.result.history) && match.result.history.length > 0) return match.result.history;

    const singleSet = {};
    if (match.picks && (Array.isArray(match.picks.A) || Array.isArray(match.picks.B))) {
      singleSet.picks = match.picks;
      singleSet.bans = match.bans || { A: [], B: [] };
      singleSet.pogPlayer = match.pogPlayer || null;
      singleSet.winner = match.result?.winner || match.winner || null;
      singleSet.scores = match.result?.score ? (() => {
        return match.scores || match.result?.scores || null;
      })() : match.scores || match.result?.scores || null;
      return [singleSet];
    }
    if (Array.isArray(match.sets) && match.sets.length > 0) return match.sets;
    return [];
  };

  // Iterate matches
  const matches = (league && Array.isArray(league.matches)) ? league.matches : [];

  matches.forEach((match) => {
    if (!match) return;
    if (regularOnly && match.type !== 'regular') return;

    const sets = getSetsFromMatch(match);
    if (!Array.isArray(sets) || sets.length === 0) return;

    const matchContext = {
      blueTeamName: match.blueTeam?.name || match.teamA?.name || (typeof match.t1 === 'object' ? match.t1.name : undefined),
      redTeamName: match.redTeam?.name || match.teamB?.name || (typeof match.t2 === 'object' ? match.t2.name : undefined),
      teamAName: match.blueTeam?.name || undefined,
      teamBName: match.redTeam?.name || undefined,
      t1: match.t1, t2: match.t2
    };

    sets.forEach((set) => {
      const picks = extractPicks(set);
      const bans = extractBans(set);

      if ((!picks.A || picks.A.length === 0) && (!picks.B || picks.B.length === 0)) return;

      totalSets += 1;

      // Process bans
      (bans.A || []).forEach(b => {
        const name = cleanName(b);
        if (!name) return;
        if (!championAgg.has(name)) championAgg.set(name, { pickCount: 0, banCount: 0, winCount: 0 });
        const c = championAgg.get(name);
        c.banCount = (c.banCount || 0) + 1;
      });
      (bans.B || []).forEach(b => {
        const name = cleanName(b);
        if (!name) return;
        if (!championAgg.has(name)) championAgg.set(name, { pickCount: 0, banCount: 0, winCount: 0 });
        const c = championAgg.get(name);
        c.banCount = (c.banCount || 0) + 1;
      });

      // Determine winner side
      const winnerSide = determineWinnerSide(set, matchContext);

      // Process picks
      ['A', 'B'].forEach((side) => {
        const teamPicks = picks[side] || [];
        teamPicks.forEach((p) => {
          const champName = (p.champName || p.champ || p.name || p.champName === 0 ? String(p.champName) : null) || String(p.champ || p.name || '').trim();
          if (champName) {
            if (!championAgg.has(champName)) championAgg.set(champName, { pickCount: 0, banCount: 0, winCount: 0 });
            const c = championAgg.get(champName);
            c.pickCount = (c.pickCount || 0) + 1;
          }

          const pickRole = normalizeRole(p.playerData?.포지션 || p.role || p.position);
          if (roleFilter !== 'ALL' && normalizeRole(roleFilter) !== pickRole) return;

          const playerName = cleanName(p.playerName || p.player);
          if (playerName) {
            const score = computePlayerScoreFromStats(p);
            if (score && !Number.isNaN(score)) {
              const entry = playerRatingAgg.get(playerName) || { sumScore: 0, games: 0, roles: {}, teams: new Set() };
              entry.sumScore += score;
              entry.games += 1;
              const rKey = pickRole || 'UNKNOWN';
              entry.roles[rKey] = (entry.roles[rKey] || 0) + 1;
              const teamNameFromPick = p.playerData?.팀 || p.team || p.teamName || matchContext.blueTeamName || matchContext.redTeamName;
              if (teamNameFromPick) entry.teams.add(teamNameFromPick);
              playerRatingAgg.set(playerName, entry);
            }

            const k = safeNum(p.k ?? p.stats?.kills ?? 0);
            const d = safeNum(p.d ?? p.stats?.deaths ?? 0);
            const a = safeNum(p.a ?? p.stats?.assists ?? 0);
            const kEntry = kdaAgg.get(playerName) || { kills: 0, deaths: 0, assists: 0, games: 0, teams: new Set() };
            kEntry.kills += k;
            kEntry.deaths += d;
            kEntry.assists += a;
            kEntry.games += 1;
            const teamNameFromPick2 = p.playerData?.팀 || p.team || p.teamName || matchContext.blueTeamName || matchContext.redTeamName;
            if (teamNameFromPick2) kEntry.teams.add(teamNameFromPick2);
            kdaAgg.set(playerName, kEntry);
          }
        });
      });

      // POG - Normalized
      const pog = extractPog(set);
      if (pog && (pog.playerName || pog.player)) {
        const pname = cleanName(pog.playerName || pog.player);
        if (pname) {
          const prev = pogCounts.get(pname) || { count: 0, lastScore: null, teams: new Set() };
          prev.count += 1;
          const pscore = safeNum(pog.pogScore ?? pog.score ?? pog.pogScore ?? null);
          if (pscore) prev.lastScore = pscore;
          const teamName = pog.playerData?.팀 || pog.team || pog.teamName || null;
          if (teamName) prev.teams.add(teamName);
          pogCounts.set(pname, prev);
        }
      }
    });
  });

  // Build outputs
  const pogLeaderboard = Array.from(pogCounts.entries()).map(([playerName, data]) => ({
    playerName,
    pogs: data.count,
    lastScore: data.lastScore,
    teams: Array.from(data.teams)
  })).sort((a, b) => b.pogs - a.pogs || (b.lastScore || 0) - (a.lastScore || 0));

  const playerRatings = Array.from(playerRatingAgg.entries()).map(([playerName, data]) => ({
    playerName,
    avgScore: data.games > 0 ? (data.sumScore / data.games) : 0,
    games: data.games,
    roles: data.roles,
    teams: Array.from(data.teams)
  })).sort((a, b) => b.avgScore - a.avgScore);

  const championMeta = Array.from(championAgg.entries()).map(([champName, data]) => {
    const pickCount = data.pickCount || 0;
    const banCount = data.banCount || 0;
    const winCount = data.winCount || 0;
    const pickRate = totalSets > 0 ? (pickCount / totalSets) : 0;
    const banRate = totalSets > 0 ? (banCount / totalSets) : 0;
    const winRate = pickCount > 0 ? (winCount / pickCount) : 0;
    return { champName, pickCount, banCount, winCount, pickRate, banRate, winRate };
  }).sort((a, b) => b.pickCount - a.pickCount);

  const kdaLeaders = Array.from(kdaAgg.entries()).map(([playerName, data]) => {
    const kills = data.kills || 0;
    const deaths = data.deaths || 0;
    const assists = data.assists || 0;
    const kda = (kills + assists) / Math.max(1, deaths);
    return { playerName, kills, deaths, assists, games: data.games, kda, teams: Array.from(data.teams) };
  });

  return {
    meta: { totalSets, championMeta },
    pogLeaderboard,
    playerRatings,
    kda: { byKills: [...kdaLeaders].sort((a, b) => b.kills - a.kills), byKda: [...kdaLeaders].sort((a, b) => b.kda - a.kda), byAssists: [...kdaLeaders].sort((a, b) => b.assists - a.assists) },
    optionsApplied: { regularOnly, roleFilter }
  };
}

export function computeAwards(league, teams) {
  const stats = computeStatsForLeague(league, { regularOnly: true });
  
  // 0. Identify Season MVP (Highest POG) beforehand
  // This is the RAW stats entry (just name/count). We need to match it to the Enriched entry later.
  const rawSeasonMvp = stats.pogLeaderboard[0] || null;

  // 1. Calculate Regular Season Team Standings
  const teamStats = new Map();
  teams.forEach(t => teamStats.set(t.id, { id: t.id, wins: 0, diff: 0 }));

  if (league.matches) {
      league.matches.filter(m => m.type === 'regular' && m.status === 'finished').forEach(m => {
           const t1 = typeof m.t1 === 'object' ? m.t1.id : m.t1;
           const t2 = typeof m.t2 === 'object' ? m.t2.id : m.t2;
           
           if (!m.result || !m.result.score) return;

           const parts = m.result.score.split(':');
           const s1 = parseInt(parts[0]);
           const s2 = parseInt(parts[1]);
           
           const winnerId = m.result.winner === teams.find(t => t.id === t1)?.name ? t1 : t2;
           const loserId = winnerId === t1 ? t2 : t1;

           const wStat = teamStats.get(winnerId);
           const lStat = teamStats.get(loserId);

           if (wStat) { wStat.wins++; wStat.diff += (Math.max(s1, s2) - Math.min(s1, s2)); }
           if (lStat) { lStat.diff -= (Math.max(s1, s2) - Math.min(s1, s2)); }
      });
  }

  const rankedTeams = Array.from(teamStats.values()).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.diff - a.diff;
  });

  const teamRankPoints = new Map();
  const pointDistribution = [100, 80, 70, 60, 50, 40, 30, 20, 10, 0];
  rankedTeams.forEach((t, index) => {
      teamRankPoints.set(t.id, pointDistribution[index] || 0);
  });

  // 2. Score Players
  const allProCandidates = [];

  stats.playerRatings.forEach(player => {
      const teamName = player.teams[0]; 
      const teamObj = teams.find(t => t.name === teamName);
      if (!teamObj) return;

      const rankPoints = teamRankPoints.get(teamObj.id) || 0;
      // Strict name matching for POGs
      const pogEntry = stats.pogLeaderboard.find(p => p.playerName === player.playerName);
      const pogCount = pogEntry ? pogEntry.pogs : 0;
      
      // MVP Bonus
      const isMvp = rawSeasonMvp && rawSeasonMvp.playerName === player.playerName;
      const mvpBonus = isMvp ? 20 : 0;

      const finalScore = player.avgScore + (pogCount * 10) + rankPoints + mvpBonus;

      let primaryRole = 'MID';
      let maxGames = 0;
      if (player.roles) {
          Object.entries(player.roles).forEach(([r, count]) => {
              if (count > maxGames) { maxGames = count; primaryRole = r; }
          });
      }

      allProCandidates.push({
          ...player,
          pogCount,
          rankPoints,
          mvpBonus,
          finalScore,
          role: primaryRole,
          teamObj
      });
  });

  // 3. Select Teams
  const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
  const allProTeams = { 1: {}, 2: {}, 3: {} }; 

  roles.forEach(role => {
      const rolePlayers = allProCandidates
          .filter(p => p.role === role)
          .sort((a, b) => b.finalScore - a.finalScore);
      
      if (rolePlayers[0]) allProTeams[1][role] = rolePlayers[0];
      if (rolePlayers[1]) allProTeams[2][role] = rolePlayers[1];
      if (rolePlayers[2]) allProTeams[3][role] = rolePlayers[2];
  });

  // FIX: Return the Enriched MVP Object, not the raw stats one
  const enrichedSeasonMvp = rawSeasonMvp 
      ? allProCandidates.find(p => p.playerName === rawSeasonMvp.playerName) 
      : null;

  return {
      seasonMvp: enrichedSeasonMvp, // Pass the one with finalScore/mvpBonus
      allProTeams
  };
}

export function computePlayoffAwards(league, teams) {
  const playoffMatches = (league.matches || []).filter(m => m.type === 'playoff' && m.status === 'finished');
  const playoffLeague = { ...league, matches: playoffMatches };
  const stats = computeStatsForLeague(playoffLeague, { regularOnly: false });

  const rawPogLeader = stats.pogLeaderboard[0] || null;
  const pogLeaderName = rawPogLeader?.playerName;

  // Finals MVP Logic (Robust)
  const sortedMatches = [...playoffMatches].sort((a, b) => (b.round || 0) - (a.round || 0));
  const finalMatch = sortedMatches[0];

  // Priority 1: Explicit field in result or top level
  let finalsMvpName = finalMatch?.result?.posPlayer || finalMatch?.pogPlayer || finalMatch?.result?.mvp || null;

  // Priority 2: Fallback Calculation (Winner Team -> Best Player)
  if (!finalsMvpName && finalMatch && finalMatch.result) {
      const winnerName = finalMatch.result.winner; // e.g., "T1" or "A" or "Blue"
      const winnerSide = finalMatch.result.winnerSide || (finalMatch.result.winner === 'Blue' ? 'BLUE' : (finalMatch.result.winner === 'Red' ? 'RED' : null));

      // Hydrate team objects
      const t1Id = (typeof finalMatch.t1 === 'object') ? finalMatch.t1.id : finalMatch.t1;
      const t2Id = (typeof finalMatch.t2 === 'object') ? finalMatch.t2.id : finalMatch.t2;
      const t1Obj = teams.find(t => String(t.id) === String(t1Id));
      const t2Obj = teams.find(t => String(t.id) === String(t2Id));

      // Determine Winning Team Object
      let winnerTeamObj = null;
      if (t1Obj && t1Obj.name === winnerName) winnerTeamObj = t1Obj;
      else if (t2Obj && t2Obj.name === winnerName) winnerTeamObj = t2Obj;
      
      // If winner is "Blue" or "Red" (not a name), map it
      if (!winnerTeamObj && winnerSide) {
           if (winnerSide === 'BLUE') winnerTeamObj = t1Obj; // Assuming T1 is Blue/Left
           if (winnerSide === 'RED') winnerTeamObj = t2Obj;
      }

      // Calculate stats JUST for this match to find performance
      const hydratedMatch = { ...finalMatch, t1: t1Obj || finalMatch.t1, t2: t2Obj || finalMatch.t2 };
      const finalMatchStats = computeStatsForLeague({ ...league, matches: [hydratedMatch] }, { regularOnly: false });
      
      let candidates = [];
      
      if (winnerTeamObj) {
          candidates = finalMatchStats.playerRatings.filter(p => 
              p.teams.includes(winnerTeamObj.name) || 
              p.teams.includes(winnerName)
          );
      } else {
          // Loose filter if no team object (check if team name matches string)
          candidates = finalMatchStats.playerRatings.filter(p => p.teams.includes(winnerName));
      }

      candidates.sort((a, b) => b.avgScore - a.avgScore);
      
      if (candidates.length > 0) {
          finalsMvpName = candidates[0].playerName;
      } else if (finalMatchStats.playerRatings.length > 0) {
          // Absolute fallback: Best player in the server
          finalsMvpName = finalMatchStats.playerRatings[0].playerName;
      }
  }

  // Bracket Standings (Reverse Elimination)
  const teamRankPoints = new Map();
  teams.forEach(t => teamRankPoints.set(t.id, 0)); 
  
  const getWinnerId = (m) => {
      const wName = m.result.winner;
      const wSide = m.result.winnerSide;
      const t1 = typeof m.t1 === 'object' ? m.t1.id : m.t1;
      const t2 = typeof m.t2 === 'object' ? m.t2.id : m.t2;
      // Try Name Match
      let wObj = teams.find(t => t.name === wName);
      if (wObj) return wObj.id;
      // Try Side Match (assuming T1=Blue, T2=Red for simplicty in sim, or check context)
      // Usually simulator sets m.t1 as Blue.
      if (wSide === 'BLUE' || wName === 'Blue') return t1;
      if (wSide === 'RED' || wName === 'Red') return t2;
      return null; 
  };

  const getLoserId = (m) => {
      const wId = getWinnerId(m);
      const t1 = typeof m.t1 === 'object' ? m.t1.id : m.t1;
      const t2 = typeof m.t2 === 'object' ? m.t2.id : m.t2;
      if (!wId) return null;
      return wId === t1 ? t2 : t1;
  };

  const matchesByRound = {};
  playoffMatches.forEach(m => {
      const r = m.round || 0;
      if (!matchesByRound[r]) matchesByRound[r] = [];
      matchesByRound[r].push(m);
  });

  const sortedRounds = Object.keys(matchesByRound).sort((a, b) => Number(b) - Number(a));
  const pointDistribution = [100, 80, 70, 60, 40, 20, 10]; 
  let currentRankIndex = 0;
  const processedTeams = new Set();

  sortedRounds.forEach((round, idx) => {
      const roundMatches = matchesByRound[round];
      if (idx === 0) {
          // Finals
          roundMatches.forEach(m => {
              const wId = getWinnerId(m);
              const lId = getLoserId(m);
              if (wId && !processedTeams.has(wId)) {
                  teamRankPoints.set(wId, pointDistribution[0]);
                  processedTeams.add(wId);
                  currentRankIndex = 1; 
              }
              if (lId && !processedTeams.has(lId)) {
                  teamRankPoints.set(lId, pointDistribution[1]);
                  processedTeams.add(lId);
                  currentRankIndex = 2; 
              }
          });
      } else {
          // Lower rounds
          roundMatches.forEach(m => {
              const lId = getLoserId(m);
              if (lId && !processedTeams.has(lId)) {
                  const pts = pointDistribution[currentRankIndex] || 10;
                  teamRankPoints.set(lId, pts);
                  processedTeams.add(lId);
              }
          });
          currentRankIndex++;
      }
  });

  // Score Players
  const allProCandidates = [];

  stats.playerRatings.forEach(player => {
      const teamName = player.teams[0]; 
      const teamObj = teams.find(t => t.name === teamName);
      if (!teamObj) return;

      const rankPoints = teamRankPoints.get(teamObj.id) || 0;
      const pogEntry = stats.pogLeaderboard.find(p => p.playerName === player.playerName);
      const pogCount = pogEntry ? pogEntry.pogs : 0;
      
      let bonusScore = 0;
      const isFinalsMvp = finalsMvpName === player.playerName;
      const isPogLeader = pogLeaderName === player.playerName;

      if (isFinalsMvp) bonusScore += 20;
      if (isPogLeader) bonusScore += 20;

      const finalScore = player.avgScore + (pogCount * 10) + rankPoints + bonusScore;

      let primaryRole = 'MID';
      let maxGames = 0;
      if (player.roles) {
          Object.entries(player.roles).forEach(([r, count]) => {
              if (count > maxGames) { maxGames = count; primaryRole = r; }
          });
      }

      allProCandidates.push({
          ...player,
          pogCount,
          rankPoints,
          bonusScore,
          isFinalsMvp,
          isPogLeader,
          finalScore,
          role: primaryRole,
          teamObj
      });
  });

  const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
  const allProTeams = { 1: {}, 2: {}, 3: {} }; 

  roles.forEach(role => {
      const rolePlayers = allProCandidates
          .filter(p => p.role === role)
          .sort((a, b) => b.finalScore - a.finalScore);
      
      if (rolePlayers[0]) allProTeams[1][role] = rolePlayers[0];
      if (rolePlayers[1]) allProTeams[2][role] = rolePlayers[1];
      if (rolePlayers[2]) allProTeams[3][role] = rolePlayers[2];
  });

  return {
      finalsMvp: allProCandidates.find(p => p.isFinalsMvp),
      pogLeader: allProCandidates.find(p => p.isPogLeader),
      allProTeams
  };
}