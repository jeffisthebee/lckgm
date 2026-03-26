// src/engine/statsManager.js

export function computeStatsForLeague(league, options = {}) {
  const { regularOnly = false, roleFilter = 'ALL' } = options || {};

  // Helper: robust type checks for season classification
  const normalizeType = (t) => String(t || '').toLowerCase();
  const isPlayoffType = (t) => normalizeType(t).includes('playoff') || normalizeType(t) === 'playoff';
  const isPlayinType = (t) => normalizeType(t).includes('playin') || normalizeType(t) === 'playin';
  
  const isRegularType = (t) => {
    const n = normalizeType(t);
    // BULLETPROOF FALLBACK: Accept everything except explicitly marked playoff/playin games.
    if (!n || n === 'undefined' || n === 'null' || n === '') return true;
    if (n.includes('playoff') || n.includes('playin') || n === 'playoffs') return false;
    return true; 
  };

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
    const gold = safeNum(p.currentGold ?? p.gold ?? 0);

    // Kills weighted 3x, assists 0.25x — stops support assist inflation
    // Deaths floored at 1.5 so 0-death games don't go infinite
    const kda = (k * 3 + a * 0.25) / Math.max(d, 1.5);
    let score = 65 + kda + (gold / 1500);

    // Additive role boosts — deaths reduce the boost so feeders don't get free points
    const role = normalizeRole(p.playerData?.포지션 || p.role || p.position);
    if (['SUP', '서포터'].includes(role)) score += Math.max(10 - (d * 1.5), 2);
    if (['JGL', '정글'].includes(role))   score += Math.max(6 - d, 0);
    if (['TOP', '탑'].includes(role))     score += Math.max(4 - d, 0);
    // MID/ADC get no boost — formula naturally rewards their kill-heavy stats

    return score;
  };

  const determineWinnerSide = (set, matchContext, matchWinner) => {
    if (set.scores && (set.scores.A !== undefined || set.scores.B !== undefined)) {
      const a = safeNum(set.scores.A);
      const b = safeNum(set.scores.B);
      if (a > b) return 'A';
      if (b > a) return 'B';
      return null;
    }
    
    let winnerName = set.winner || set.winnerName || matchWinner;
    if (winnerName) {
      if (matchContext) {
        // Bulletproof check against t1/t2 IDs and Names
        const blueN = matchContext.blueTeamName || matchContext.teamAName || matchContext.t1Name || matchContext.t1;
        const redN = matchContext.redTeamName || matchContext.teamBName || matchContext.t2Name || matchContext.t2;
        
        const bName = typeof blueN === 'object' ? (blueN.name || blueN.id) : blueN;
        const rName = typeof redN === 'object' ? (redN.name || redN.id) : redN;

        if (bName && String(bName) === String(winnerName)) return 'A';
        if (rName && String(rName) === String(winnerName)) return 'B';
      }
      
      const picks = extractPicks(set);
      const aHasWinner = (picks.A || []).some(p => String(p.playerData?.팀 || p.team || p.teamName) === String(winnerName));
      const bHasWinner = (picks.B || []).some(p => String(p.playerData?.팀 || p.team || p.teamName) === String(winnerName));
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
    if (match.result && Array.isArray(match.result.history) && match.result.history.length > 0) {
      return match.result.history;
    }
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

  const matches = (league && Array.isArray(league.matches)) ? league.matches : [];

  matches.forEach((match) => {
    if (!match) return;
    // Safely accept all non-playoff games as regular season
    if (regularOnly && !isRegularType(match.type)) return;

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

      const matchWinnerFallback = match.result?.winner || match.winner;
      const winnerSide = determineWinnerSide(set, matchContext, matchWinnerFallback);

      ['A', 'B'].forEach((side) => {
        const teamPicks = picks[side] || [];
        teamPicks.forEach((p) => {
          const champName = (p.champName || p.champ || p.name || p.champName === 0 ? String(p.champName) : null) || String(p.champ || p.name || '').trim();
          if (champName) {
            if (!championAgg.has(champName)) championAgg.set(champName, { pickCount: 0, banCount: 0, winCount: 0 });
            const c = championAgg.get(champName);
            c.pickCount = (c.pickCount || 0) + 1;
            if (winnerSide === side) {
              c.winCount = (c.winCount || 0) + 1;
            }
          }

          const pickRole = normalizeRole(p.playerData?.포지션 || p.role || p.position);
          if (roleFilter !== 'ALL' && normalizeRole(roleFilter) !== pickRole) {
            return;
          }

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

      // Recalculate POG strictly using winnerSide (bypasses missing team names on players)
      let pogBestScore = -Infinity;
      let pogBestPlayer = null;

      let actualWinnerSide = winnerSide;
        
      // ULTIMATE FALLBACK 1: If the individual set is missing a winner tag, use the match winner
      if (!actualWinnerSide && matchWinnerFallback) {
          const mWin = String(matchWinnerFallback);
          const bName = String(typeof matchContext.t1 === 'object' ? (matchContext.t1.name || matchContext.t1.id) : matchContext.t1);
          const rName = String(typeof matchContext.t2 === 'object' ? (matchContext.t2.name || matchContext.t2.id) : matchContext.t2);
          
          if (mWin === bName) actualWinnerSide = 'A';
          else if (mWin === rName) actualWinnerSide = 'B';
          else if (mWin === String(matchContext.blueTeamName)) actualWinnerSide = 'A';
          else if (mWin === String(matchContext.redTeamName)) actualWinnerSide = 'B';
      }

      // ULTIMATE FALLBACK 2: If we STILL don't know the winner, evaluate ALL 10 PLAYERS so the board doesn't break
      const winningPicks = actualWinnerSide === 'A' ? (picks.A || []) : 
                           (actualWinnerSide === 'B' ? (picks.B || []) : 
                           [...(picks.A || []), ...(picks.B || [])]);
      
      winningPicks.forEach(p => {
        if (!p) return;
        const score = computePlayerScoreFromStats(p);
        if (score > pogBestScore) {
          pogBestScore = score;
          pogBestPlayer = p;
        }
      });

      if (pogBestPlayer) {
        const pname = String(pogBestPlayer.playerName || '').trim();
        if (pname) {
          const prev = pogCounts.get(pname) || { count: 0, lastScore: null, teams: new Set() };
          prev.count += 1;
          prev.lastScore = pogBestScore;
          
          // Fallback team naming so the player card displays correctly
          const tNameRaw = pogBestPlayer.playerData?.팀 || pogBestPlayer.team || pogBestPlayer.teamName || 
                           (actualWinnerSide === 'A' ? matchContext.t1 : matchContext.t2) || null;
          const resolvedTeamName = typeof tNameRaw === 'object' ? (tNameRaw.name || tNameRaw.id) : tNameRaw;
          
          if (resolvedTeamName) prev.teams.add(String(resolvedTeamName));
          pogCounts.set(pname, prev);
        }
      }
    });
  });

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
    const asStr = String(pt);
    const byName = teams.find(t => String(t.name) === asStr);
    if (byName) return byName;
    const byId = teams.find(t => String(t.id) === asStr);
    if (byId) return byId;
  }
  return null;
}


// ---------- Awards Computation (regular season) ----------
export function computeAwards(league, teams) {
  const normalizeType = (t) => String(t || '').toLowerCase();
  
  const isRegularType = (t) => {
    const n = normalizeType(t);
    // BULLETPROOF FALLBACK: Accept everything except explicitly marked playoff/playin games.
    if (!n || n === 'undefined' || n === 'null' || n === '') return true;
    if (n.includes('playoff') || n.includes('playin') || n === 'playoffs') return false;
    return true; 
  };

  const stats = computeStatsForLeague(league, { regularOnly: true });

  const seasonMvp = stats.pogLeaderboard[0] || null;

  const teamStats = new Map();
  teams.forEach(t => teamStats.set(t.id, { id: t.id, wins: 0, diff: 0 }));

  if (league.matches) {
      league.matches.filter(m => isRegularType(m.type) && m.status === 'finished').forEach(m => {
           const t1 = typeof m.t1 === 'object' ? m.t1.id : m.t1;
           const t2 = typeof m.t2 === 'object' ? m.t2.id : m.t2;
           
           if (!m.result || !m.result.score) return;

           const parts = String(m.result.score).split(':');
           if (parts.length < 2) return;
           const s1 = parseInt(parts[0]) || 0;
           const s2 = parseInt(parts[1]) || 0;
           
           const winnerId = (m.result && m.result.winner)
             ? (teams.find(t => t.name === m.result.winner)?.id || (m.result.winner === String(t1) ? t1 : (m.result.winner === String(t2) ? t2 : null)))
             : null;

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

  const rankedTeams = Array.from(teamStats.values()).sort((a, b) => {
      if (b.wins !== a.wins) return b.wins - a.wins;
      return b.diff - a.diff;
  });

  const teamRankPoints = new Map();
  const pointDistribution = [100, 80, 70, 60, 50, 40, 30, 20, 10, 0];
  rankedTeams.forEach((t, index) => {
      teamRankPoints.set(t.id, pointDistribution[index] || 0);
  });

  const allProCandidates = [];
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
      const isMvp = seasonMvp && (seasonMvp.playerName === player.playerName);
      const mvpBonus = isMvp ? 20 : 0;
      const finalScore = (player.avgScore || 0) + (pogCount * 10) + rankPoints + mvpBonus;

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

  let enrichedSeasonMvp = allProCandidates.find(p => p.playerName === (seasonMvp?.playerName || '')) || null;
  if (!enrichedSeasonMvp && seasonMvp) {
    const pogCount = seasonMvp.pogs || 0;
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
  const playoffMatches = (league.matches || []).filter(m => {
    const t = String(m.type || '').toLowerCase();
    return (t.includes('playoff') || t === 'playoff') && m.status === 'finished';
  });
  
  // Create a temporary league object for stats
  const playoffLeague = { ...league, matches: playoffMatches };
  
  // Compute stats for ALL playoff matches to get averages and totals
  const stats = computeStatsForLeague(playoffLeague, { regularOnly: false });

  // 2. Identify Key Players
  
  // A. Playoff MVP (POG Leader across all playoff games)
  const pogLeader = stats.pogLeaderboard[0] || null;
  const pogLeaderName = pogLeader?.playerName ? pogLeader.playerName : null;

  // B. Finals MVP Logic
  const isExplicitFinalMatch = (m) => {
    if (!m) return false;
    const id = String(m.id || '');
    const rawLabel = String(m.label || m.roundName || '').trim();
    const label = rawLabel.toUpperCase();
    const round = Number(m.round || 0);

    if (round === 5) return true; // LCK/LEC/LPL style
    if (id === 'lec_po_final' || id === 'lpl_po14' || id === 'lcs_po8' || id === 'cblol_po10') return true;
    // LCP uses round 4 as its Final
    if (id.startsWith('lcp_') && round === 4) return true;

    if (!label) return false;
    if (label.includes('GRAND FINAL')) return true;
    if (label === 'FINAL' || label === 'FINALS' || label === 'GRAND FINAL') return true;
    if (rawLabel === '결승전' || rawLabel === '결승') return true;
    return false;
  };

  const explicitFinal = playoffMatches.find(m => isExplicitFinalMatch(m));
  const finalMatch = explicitFinal || null;

  let finalsMvpName = null;
  if (finalMatch) {
    finalsMvpName = normalizePlayerNameMaybe(finalMatch?.result?.posPlayer || finalMatch?.result?.posPlayerName || null);
  }

  // [FALLBACK LOGIC]
  if (!finalsMvpName && finalMatch && finalMatch.result) {
      const winnerName = finalMatch.result.winner; // e.g. "T1"
      
      const t1Id = (typeof finalMatch.t1 === 'object') ? finalMatch.t1.id : finalMatch.t1;
      const t2Id = (typeof finalMatch.t2 === 'object') ? finalMatch.t2.id : finalMatch.t2;
      
      const t1Obj = teams.find(t => String(t.id) === String(t1Id));
      const t2Obj = teams.find(t => String(t.id) === String(t2Id));

      const winnerTeamObj = (t1Obj?.name === winnerName) ? t1Obj : ((t2Obj?.name === winnerName) ? t2Obj : null);

      const hydratedMatch = { ...finalMatch, t1: t1Obj || finalMatch.t1, t2: t2Obj || finalMatch.t2 };
      const finalMatchStats = computeStatsForLeague({ ...league, matches: [hydratedMatch] }, { regularOnly: false });
      
      let candidates = [];

      if (winnerTeamObj) {
          candidates = finalMatchStats.playerRatings.filter(p => 
              (p.teams || []).includes(winnerTeamObj.name) || 
              (p.teams || []).includes(String(winnerTeamObj.id))
          );
      } else {
           candidates = finalMatchStats.playerRatings.filter(p => (p.teams || []).includes(winnerName));
      }

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

      candidates.sort((a, b) => (b.avgScore || 0) - (a.avgScore || 0));
      
      if (candidates.length > 0) {
          finalsMvpName = candidates[0].playerName;
      } else if (finalMatchStats.playerRatings.length > 0) {
          finalsMvpName = finalMatchStats.playerRatings[0].playerName;
      }
  }

  // 3. Calculate Playoff Team Standings
  const teamRankPoints = new Map();
  teams.forEach(t => teamRankPoints.set(t.id, 0)); 
  
  const getWinnerId = (m) => teams.find(t => t.name === m.result.winner)?.id;
  const getLoserId = (m) => {
      const wId = getWinnerId(m);
      const t1 = typeof m.t1 === 'object' ? m.t1.id : m.t1;
      const t2 = typeof m.t2 === 'object' ? m.t2.id : m.t2;
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

  // 4. Score Players & Apply Bonuses
  const allProCandidates = [];
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
      finalsMvp: finalMatch ? (allProCandidates.find(p => p.isFinalsMvp) || null) : null,
      pogLeader: allProCandidates.find(p => p.isPogLeader) || null,
      allProTeams
  };
}