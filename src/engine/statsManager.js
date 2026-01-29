

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
    // Common shapes: set.picks = { A: [...], B: [...] }
    // Some older objects may use lowercase; check both
    const picks = set.picks || set.PICKS || set.picksA || null;
    if (Array.isArray(set.picks?.A) || Array.isArray(set.picks?.B)) {
      return { A: set.picks.A || [], B: set.picks.B || [] };
    }
    if (Array.isArray(set.A) || Array.isArray(set.B)) {
      return { A: set.A || [], B: set.B || [] };
    }
    // Fallback: if picks is an array (unlikely), assume it's A
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
    // Prefer set.pogPlayer, fallback to set.pog or set.posPlayer
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
    // Priority 1: explicit numeric scores saved in set.scores (A/B)
    if (set.scores && (set.scores.A !== undefined || set.scores.B !== undefined)) {
      const a = safeNum(set.scores.A);
      const b = safeNum(set.scores.B);
      if (a > b) return 'A';
      if (b > a) return 'B';
      return null;
    }
    // Priority 2: set.winner string and matchContext mapping
    if (set.winner || set.winnerName) {
      const winnerName = set.winner || set.winnerName;
      // matchContext may have blueTeam/redTeam names
      if (matchContext) {
        const blueN = matchContext.blueTeamName || matchContext.teamAName || matchContext.t1Name;
        const redN = matchContext.redTeamName || matchContext.teamBName || matchContext.t2Name;
        if (blueN && blueN === winnerName) return 'A';
        if (redN && redN === winnerName) return 'B';
      }
      // fallback: check if picks include playerData.team that matches
      const picks = extractPicks(set);
      const aHasWinner = (picks.A || []).some(p => (p.playerData?.팀 || p.team || p.teamName) === winnerName);
      const bHasWinner = (picks.B || []).some(p => (p.playerData?.팀 || p.team || p.teamName) === winnerName);
      if (aHasWinner && !bHasWinner) return 'A';
      if (bHasWinner && !aHasWinner) return 'B';
    }
    // Priority 3: If set includes gameResult with winnerSide
    if (set.winnerSide) {
      const side = String(set.winnerSide).toUpperCase();
      if (side === 'BLUE' || side === 'A') return 'A';
      if (side === 'RED' || side === 'B') return 'B';
    }
    return null;
  };

  const getSetsFromMatch = (match) => {
    if (!match) return [];

    // If match.history is array use that
    if (Array.isArray(match.history) && match.history.length > 0) return match.history;

    // If match.result?.history exists
    if (match.result && Array.isArray(match.result.history) && match.result.history.length > 0) {
      return match.result.history;
    }

    // Some simulate functions return a 'history' top-level in their returned object (like simulateMatch)
    // If the match itself contains picks (single-set), convert to one-set object
    const singleSet = {};
    if (match.picks && (Array.isArray(match.picks.A) || Array.isArray(match.picks.B))) {
      singleSet.picks = match.picks;
      singleSet.bans = match.bans || { A: [], B: [] };
      singleSet.pogPlayer = match.pogPlayer || null;
      singleSet.winner = match.result?.winner || match.winner || null;
      singleSet.scores = match.result?.score ? (() => {
        // score may be "2:1" string for match-level; at set-level we can't derive, so skip
        return match.scores || match.result?.scores || null;
      })() : match.scores || match.result?.scores || null;
      return [singleSet];
    }

    // Another possible shape: match.history was saved under match.sets
    if (Array.isArray(match.sets) && match.sets.length > 0) return match.sets;

    // No usable set-level data
    return [];
  };

  // Iterate matches
  const matches = (league && Array.isArray(league.matches)) ? league.matches : [];

  matches.forEach((match) => {
    if (!match) return;
    if (regularOnly && match.type !== 'regular') return;

    const sets = getSetsFromMatch(match);
    if (!Array.isArray(sets) || sets.length === 0) return;

    // Build light match context for winner name mapping
    const matchContext = {
      blueTeamName: match.blueTeam?.name || match.teamA?.name || (typeof match.t1 === 'object' ? match.t1.name : undefined),
      redTeamName: match.redTeam?.name || match.teamB?.name || (typeof match.t2 === 'object' ? match.t2.name : undefined),
      teamAName: match.blueTeam?.name || undefined,
      teamBName: match.redTeam?.name || undefined,
      t1: match.t1, t2: match.t2
    };

    sets.forEach((set) => {
      // Only consider finished sets: many set objects don't include status, so we assume presence of picks indicates a finished simulated set.
      const picks = extractPicks(set);
      const bans = extractBans(set);

      // If there are no picks for both sides, skip
      if ((!picks.A || picks.A.length === 0) && (!picks.B || picks.B.length === 0)) return;

      totalSets += 1;

      // Process bans
      (bans.A || []).forEach(b => {
        const name = String(b || '').trim();
        if (!name) return;
        if (!championAgg.has(name)) championAgg.set(name, { pickCount: 0, banCount: 0, winCount: 0 });
        const c = championAgg.get(name);
        c.banCount = (c.banCount || 0) + 1;
      });
      (bans.B || []).forEach(b => {
        const name = String(b || '').trim();
        if (!name) return;
        if (!championAgg.has(name)) championAgg.set(name, { pickCount: 0, banCount: 0, winCount: 0 });
        const c = championAgg.get(name);
        c.banCount = (c.banCount || 0) + 1;
      });

      // Determine winner side for win attribution (A or B)
      const winnerSide = determineWinnerSide(set, matchContext);

      // Process picks for both sides
      ['A', 'B'].forEach((side) => {
        const teamPicks = picks[side] || [];
        teamPicks.forEach((p) => {
          // p can be either simple { champName } or detailed
          const champName = (p.champName || p.champ || p.name || p.champName === 0 ? String(p.champName) : null) || String(p.champ || p.name || '').trim();
          if (champName) {
            if (!championAgg.has(champName)) championAgg.set(champName, { pickCount: 0, banCount: 0, winCount: 0 });
            const c = championAgg.get(champName);
            c.pickCount = (c.pickCount || 0) + 1;
            if (winnerSide === side) {
              c.winCount = (c.winCount || 0) + 1;
            }
          }

          // Role filtering: only aggregate player/role stats if roleFilter is ALL or matches pick role
          const pickRole = normalizeRole(p.playerData?.포지션 || p.role || p.position);
          if (roleFilter !== 'ALL' && normalizeRole(roleFilter) !== pickRole) {
            // skip per-player and rating contributions for this pick
            return;
          }

          // PLAYER RATINGS - compute a numeric score when stats present
          const playerName = p.playerName || p.player || p.playerName === 0 ? String(p.playerName) : (p.player || p.playerName || '').trim();
          if (playerName) {
            const score = computePlayerScoreFromStats(p);
            if (score && !Number.isNaN(score)) {
              const entry = playerRatingAgg.get(playerName) || { sumScore: 0, games: 0, roles: {}, teams: new Set() };
              entry.sumScore += score;
              entry.games += 1;
              const rKey = pickRole || 'UNKNOWN';
              entry.roles[rKey] = (entry.roles[rKey] || 0) + 1;
              const teamNameFromPick = p.playerData?.팀 || p.team || p.teamName || (side === 'A' ? (matchContext.blueTeamName || matchContext.teamAName) : (matchContext.redTeamName || matchContext.teamBName));
              if (teamNameFromPick) entry.teams.add(teamNameFromPick);
              playerRatingAgg.set(playerName, entry);
            }

            // KDA Aggregation
            const k = safeNum(p.k ?? p.stats?.kills ?? 0);
            const d = safeNum(p.d ?? p.stats?.deaths ?? 0);
            const a = safeNum(p.a ?? p.stats?.assists ?? 0);
            const kEntry = kdaAgg.get(playerName) || { kills: 0, deaths: 0, assists: 0, games: 0, teams: new Set() };
            kEntry.kills += k;
            kEntry.deaths += d;
            kEntry.assists += a;
            kEntry.games += 1;
            const teamNameFromPick2 = p.playerData?.팀 || p.team || p.teamName || (side === 'A' ? (matchContext.blueTeamName || matchContext.teamAName) : (matchContext.redTeamName || matchContext.teamBName));
            if (teamNameFromPick2) kEntry.teams.add(teamNameFromPick2);
            kdaAgg.set(playerName, kEntry);
          }
        });
      });

      // POG
      const pog = extractPog(set);
      if (pog) {
        const pname = String(pog.playerName || pog.player || pog || '').trim();
        if (pname) {
          const prev = pogCounts.get(pname) || { count: 0, lastScore: null, teams: new Set() };
          prev.count += 1;
          // pogScore may be pog.pogScore or pog.score
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

  // POG Leaderboard
  const pogLeaderboard = Array.from(pogCounts.entries()).map(([playerName, data]) => ({
    playerName,
    pogs: data.count,
    lastScore: data.lastScore,
    teams: Array.from(data.teams)
  })).sort((a, b) => b.pogs - a.pogs || (b.lastScore || 0) - (a.lastScore || 0));

  // Player Ratings (average)
  const playerRatings = Array.from(playerRatingAgg.entries()).map(([playerName, data]) => ({
    playerName,
    avgScore: data.games > 0 ? (data.sumScore / data.games) : 0,
    games: data.games,
    roles: data.roles,
    teams: Array.from(data.teams)
  })).sort((a, b) => b.avgScore - a.avgScore);

  // Champion meta
  const championMeta = Array.from(championAgg.entries()).map(([champName, data]) => {
    const pickCount = data.pickCount || 0;
    const banCount = data.banCount || 0;
    const winCount = data.winCount || 0; // note: winCount only accumulates when set winner known (we incremented earlier only when we could)
    const pickRate = totalSets > 0 ? (pickCount / totalSets) : 0;
    const banRate = totalSets > 0 ? (banCount / totalSets) : 0;
    const winRate = pickCount > 0 ? (winCount / pickCount) : 0;
    return {
      champName,
      pickCount,
      banCount,
      winCount,
      pickRate,
      banRate,
      winRate
    };
  }).sort((a, b) => b.pickCount - a.pickCount);

  // KDA Leaders
  const kdaLeaders = Array.from(kdaAgg.entries()).map(([playerName, data]) => {
    const kills = data.kills || 0;
    const deaths = data.deaths || 0;
    const assists = data.assists || 0;
    const kda = (kills + assists) / Math.max(1, deaths);
    return { playerName, kills, deaths, assists, games: data.games, kda, teams: Array.from(data.teams) };
  });

  const kdaByKills = [...kdaLeaders].sort((a, b) => b.kills - a.kills);
  const kdaByKDA = [...kdaLeaders].sort((a, b) => b.kda - a.kda);
  const kdaByAssists = [...kdaLeaders].sort((a, b) => b.assists - a.assists);

  // Final aggregated object
  return {
    meta: {
      totalSets,
      championMeta
    },
    pogLeaderboard,
    playerRatings,
    kda: {
      byKills: kdaByKills,
      byKda: kdaByKDA,
      byAssists: kdaByAssists
    },
    optionsApplied: { regularOnly, roleFilter }
  };
}

export default computeStatsForLeague;


// --- Helper utilities used by award functions (kept local to this module) ---
function normalizePlayerNameMaybe(value) {
  if (!value && value !== 0) return null;
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'object') {
    return String(value.playerName || value.player || value.name || value.ign || value.이름 || '').trim() || null;
  }
  return String(value).trim() || null;
}

function findTeamObjectForPlayerTeams(playerTeams = [], teams = []) {
  if (!Array.isArray(playerTeams)) playerTeams = [playerTeams].filter(Boolean);
  for (const pt of playerTeams) {
    if (!pt && pt !== 0) continue;
    // try to match by team name or id (string/number)
    const asStr = String(pt);
    const byName = teams.find(t => String(t.name) === asStr);
    if (byName) return byName;
    const byId = teams.find(t => String(t.id) === asStr);
    if (byId) return byId;
  }
  // nothing matched
  return null;
}


// ---------- Awards Computation (regular season) ----------
export function computeAwards(league, teams) {
  const stats = computeStatsForLeague(league, { regularOnly: true });

  // 0. Identify Season MVP (Highest POG) beforehand
  const seasonMvp = stats.pogLeaderboard[0] || null;

  // 1. Calculate Regular Season Team Standings
  const teamStats = new Map();
  teams.forEach(t => teamStats.set(t.id, { id: t.id, wins: 0, diff: 0 }));

  if (league.matches) {
      league.matches.filter(m => m.type === 'regular' && m.status === 'finished').forEach(m => {
           const t1 = typeof m.t1 === 'object' ? m.t1.id : m.t1;
           const t2 = typeof m.t2 === 'object' ? m.t2.id : m.t2;
           
           // Check if score exists and is valid
           if (!m.result || !m.result.score) return;

           const parts = String(m.result.score).split(':');
           if (parts.length < 2) return;
           const s1 = parseInt(parts[0]) || 0;
           const s2 = parseInt(parts[1]) || 0;
           
           // Decide winner by result.winner matching team name if possible
           const winnerId = (m.result && m.result.winner)
             ? (teams.find(t => t.name === m.result.winner)?.id || (m.result.winner === String(t1) ? t1 : (m.result.winner === String(t2) ? t2 : null)))
             : null;

           // Fallback: choose t1 or t2 by score if winnerId not determined
           let resolvedWinner = winnerId;
           if (!resolvedWinner) {
             resolvedWinner = s1 > s2 ? t1 : (s2 > s1 ? t2 : null);
           }
           const loserId = resolvedWinner === t1 ? t2 : t1;

           const wStat = teamStats.get(resolvedWinner);
           const lStat = teamStats.get(loserId);

           if (wStat) { wStat.wins++; wStat.diff += Math.abs(s1 - s2); }
           if (lStat) { lStat.diff -= Math.abs(s1 - s2); }
      });
  }

  // Sort Teams
  const rankedTeams = Array.from(teamStats.values()).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.diff - a.diff;
  });

  // Points: 1st=100, 2nd=80, 3rd=70... 10th=0
  const teamRankPoints = new Map();
  const pointDistribution = [100, 80, 70, 60, 50, 40, 30, 20, 10, 0];
  rankedTeams.forEach((t, index) => {
      teamRankPoints.set(t.id, pointDistribution[index] || 0);
  });

  // 2. Score Players
  const allProCandidates = [];

  // Build a combined player list: include players with ratings AND players who appear only on POG board
  const playerByName = new Map();
  stats.playerRatings.forEach(player => playerByName.set(player.playerName, player));
  stats.pogLeaderboard.forEach(p => {
    if (!playerByName.has(p.playerName)) {
      playerByName.set(p.playerName, {
        playerName: p.playerName,
        avgScore: 0,
        games: 0,
        roles: {},
        teams: p.teams || []
      });
    }
  });

  // Now iterate combined players and compute finalScore and other fields
  Array.from(playerByName.values()).forEach(player => {
      // try robust team mapping: player's teams may be names or ids
      const teamObj = findTeamObjectForPlayerTeams(player.teams || [], teams);
      if (!teamObj) {
        // As a last resort, skip players who we cannot map to any team for ranking points,
        // but still include them (rankPoints 0). We don't return early here.
      }

      const rankPoints = teamObj ? (teamRankPoints.get(teamObj.id) || 0) : 0;
      const pogEntry = stats.pogLeaderboard.find(p => p.playerName === player.playerName);
      const pogCount = pogEntry ? pogEntry.pogs : 0;
      
      // [NEW] MVP Bonus: If this player is the Season MVP, add 20 points
      const isMvp = seasonMvp && (seasonMvp.playerName === player.playerName);
      const mvpBonus = isMvp ? 20 : 0;

      // Formula
      const finalScore = (player.avgScore || 0) + (pogCount * 10) + rankPoints + mvpBonus;

      // Determine Primary Role
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
          mvpBonus, // Store for UI
          finalScore,
          role: primaryRole,
          teamObj
      });
  });

  // Ensure the seasonMvp entry is enriched (if it wasn't part of player ratings)
  let enrichedSeasonMvp = allProCandidates.find(p => p.playerName === (seasonMvp?.playerName || '')) || null;
  if (!enrichedSeasonMvp && seasonMvp) {
    // build a fallback enriched object
    const pogCount = seasonMvp.pogs || 0;
    // try to find a matching rating record to get avgScore, roles and teams
    const ratingRecord = stats.playerRatings.find(r => r.playerName === seasonMvp.playerName);
    const avgScore = ratingRecord ? ratingRecord.avgScore : 0;
    const teamsArr = seasonMvp.teams || (ratingRecord ? ratingRecord.teams : []);
    const teamObj = findTeamObjectForPlayerTeams(teamsArr, teams);
    const rankPoints = teamObj ? (teamRankPoints.get(teamObj.id) || 0) : 0;
    const mvpBonus = 20;
    const finalScore = avgScore + (pogCount * 10) + rankPoints + mvpBonus;
    enrichedSeasonMvp = {
      playerName: seasonMvp.playerName,
      pogCount,
      avgScore,
      games: ratingRecord ? ratingRecord.games : 0,
      roles: ratingRecord ? ratingRecord.roles : {},
      teams: teamsArr,
      teamObj,
      mvpBonus,
      finalScore,
      role: ratingRecord ? (Object.keys(ratingRecord.roles || {})[0] || 'MID') : 'MID'
    };
  }

  // 3. Select Teams (1st, 2nd, 3rd)
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
      seasonMvp: enrichedSeasonMvp,
      allProTeams
  };
}


// ---------- Playoff Awards Computation ----------
export function computePlayoffAwards(league, teams) {
  // 1. Filter for Playoff Matches only
  const playoffMatches = (league.matches || []).filter(m => m.type === 'playoff' && m.status === 'finished');
  
  // Create a temporary league object for stats
  const playoffLeague = { ...league, matches: playoffMatches };
  
  // Compute stats for ALL playoff matches to get averages and totals
  const stats = computeStatsForLeague(playoffLeague, { regularOnly: false });

  // 2. Identify Key Players
  
  // A. Playoff MVP (POG Leader across all playoff games)
  const pogLeader = stats.pogLeaderboard[0] || null;
  const pogLeaderName = pogLeader?.playerName ? pogLeader.playerName : null;

  // B. Finals MVP Logic
  // Sort matches by round desc to find the "Grand Final"
  const sortedMatches = [...playoffMatches].sort((a, b) => (b.round || 0) - (a.round || 0));
  const finalMatch = sortedMatches[0]; // The match with the highest round number is the Final

  // Normalize whichever field might contain finals MVP (could be string or object)
  let finalsMvpName = normalizePlayerNameMaybe(finalMatch?.result?.posPlayer || finalMatch?.pogPlayer || finalMatch?.result?.posPlayerName || finalMatch?.result?.playerName || null);

  // [FALLBACK LOGIC]
  if (!finalsMvpName && finalMatch && finalMatch.result) {
      // If the file doesn't explicitly name a Finals MVP (posPlayer), 
      // we calculate the best performing player from the winning team in that specific match.
      
      // Prepare Helper Data
      const winnerName = finalMatch.result.winner; // e.g. "T1"
      
      // Hydrate Match with Team Objects to ensure we have IDs
      const t1Id = (typeof finalMatch.t1 === 'object') ? finalMatch.t1.id : finalMatch.t1;
      const t2Id = (typeof finalMatch.t2 === 'object') ? finalMatch.t2.id : finalMatch.t2;
      
      const t1Obj = teams.find(t => String(t.id) === String(t1Id));
      const t2Obj = teams.find(t => String(t.id) === String(t2Id));

      // Determine which team object is the winner
      // We match by name since result.winner is usually a name
      const winnerTeamObj = (t1Obj?.name === winnerName) ? t1Obj : ((t2Obj?.name === winnerName) ? t2Obj : null);

      // Compute stats strictly for this ONE final match
      const hydratedMatch = { ...finalMatch, t1: t1Obj || finalMatch.t1, t2: t2Obj || finalMatch.t2 };
      const finalMatchStats = computeStatsForLeague({ ...league, matches: [hydratedMatch] }, { regularOnly: false });
      
      let candidates = [];

      // Filter players who belong to the winning team
      if (winnerTeamObj) {
          candidates = finalMatchStats.playerRatings.filter(p => 
              (p.teams || []).includes(winnerTeamObj.name) || 
              (p.teams || []).includes(String(winnerTeamObj.id))
          );
      } else {
           // If we can't map the object, look for any player whose team matches the winner string
           candidates = finalMatchStats.playerRatings.filter(p => (p.teams || []).includes(winnerName));
      }

      // Also include POG-only players from the final match (in case the final MVP was only POG-ed)
      finalMatchStats.pogLeaderboard.forEach(pb => {
        if (!candidates.find(c => c.playerName === pb.playerName)) {
          candidates.push({
            playerName: pb.playerName,
            avgScore: 0,
            games: 0,
            roles: {},
            teams: pb.teams || []
          });
        }
      });

      // Sort by Score Descending
      candidates.sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));
      
      // Pick the top player
      if (candidates.length > 0) {
          finalsMvpName = candidates[0].playerName;
      } else if (finalMatchStats.playerRatings.length > 0) {
          // Absolute fallback: Just take the highest rated player in the game, regardless of team
          // (Only happens if team names are totally mismatched)
          finalsMvpName = finalMatchStats.playerRatings[0].playerName;
      }
  }

  // 3. Calculate Playoff Team Standings (Dynamic / Reverse Elimination)
  // Instead of hardcoded round numbers (which might vary), we use a "Reverse Elimination" approach.
  // The winner of the highest round is #1. The loser is #2.
  // Then we look at the next highest round, and so on.
  
  const teamRankPoints = new Map();
  teams.forEach(t => teamRankPoints.set(t.id, 0)); 
  
  const getWinnerId = (m) => teams.find(t => t.name === m.result.winner)?.id;
  const getLoserId = (m) => {
      const wId = getWinnerId(m);
      const t1 = typeof m.t1 === 'object' ? m.t1.id : m.t1;
      const t2 = typeof m.t2 === 'object' ? m.t2.id : m.t2;
      return wId === t1 ? t2 : t1;
  };

  // Group matches by round
  const matchesByRound = {};
  playoffMatches.forEach(m => {
      const r = m.round || 0;
      if (!matchesByRound[r]) matchesByRound[r] = [];
      matchesByRound[r].push(m);
  });

  // Sort rounds descending (Highest round = Final)
  const sortedRounds = Object.keys(matchesByRound).sort((a, b) => Number(b) - Number(a));

  const pointDistribution = [100, 80, 70, 60, 40, 20, 10]; // 1st, 2nd, 3rd...
  let currentRankIndex = 0;
  const processedTeams = new Set();

  // Process rounds from Final -> Start
  sortedRounds.forEach((round, idx) => {
      const roundMatches = matchesByRound[round];
      
      // If it's the very last round (The Grand Final), we award 1st and 2nd place
      if (idx === 0) {
          roundMatches.forEach(m => {
              const wId = getWinnerId(m);
              const lId = getLoserId(m);
              
              if (wId && !processedTeams.has(wId)) {
                  teamRankPoints.set(wId, pointDistribution[0]); // 1st Place (100)
                  processedTeams.add(wId);
                  currentRankIndex = 1; // Used 0, next is 1
              }
              if (lId && !processedTeams.has(lId)) {
                  teamRankPoints.set(lId, pointDistribution[1]); // 2nd Place (80)
                  processedTeams.add(lId);
                  currentRankIndex = 2; // Used 1, next is 2
              }
          });
      } else {
          // For all earlier rounds, the LOSERS are eliminating. 
          // The winners advanced (and are handled in higher rounds), so we only care about losers here.
          roundMatches.forEach(m => {
              const lId = getLoserId(m);
              if (lId && !processedTeams.has(lId)) {
                  // Assign next available point tier
                  const pts = pointDistribution[currentRankIndex] || 10;
                  teamRankPoints.set(lId, pts);
                  processedTeams.add(lId);
              }
          });
          // After processing a round of losers, increment rank index
           currentRankIndex++;
      }
  });


  // 4. Score Players & Apply Bonuses
  const allProCandidates = [];

  // Build a combined player list: include players with ratings AND players who appear only on POG board
  const playerByName = new Map();
  stats.playerRatings.forEach(player => playerByName.set(player.playerName, player));
  stats.pogLeaderboard.forEach(p => {
    if (!playerByName.has(p.playerName)) {
      playerByName.set(p.playerName, {
        playerName: p.playerName,
        avgScore: 0,
        games: 0,
        roles: {},
        teams: p.teams || []
      });
    }
  });

  Array.from(playerByName.values()).forEach(player => {
      const teamObj = findTeamObjectForPlayerTeams(player.teams || [], teams);
      const rankPoints = teamObj ? (teamRankPoints.get(teamObj.id) || 0) : 0;
      const pogEntry = stats.pogLeaderboard.find(p => p.playerName === player.playerName);
      const pogCount = pogEntry ? pogEntry.pogs : 0;
      
      // Bonuses
      let bonusScore = 0;
      const isFinalsMvp = finalsMvpName && (finalsMvpName === player.playerName);
      const isPogLeader = pogLeaderName && (pogLeaderName === player.playerName);

      if (isFinalsMvp) bonusScore += 20;
      if (isPogLeader) bonusScore += 20;

      const finalScore = (player.avgScore || 0) + (pogCount * 10) + rankPoints + bonusScore;

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

  // 5. Select Teams
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
      finalsMvp: allProCandidates.find(p => p.isFinalsMvp) || null,
      pogLeader: allProCandidates.find(p => p.isPogLeader) || null,
      allProTeams
  };
}