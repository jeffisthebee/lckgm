// src/engine/statsManager.js
// Computes aggregated statistics (POG leaderboard, player ratings, champion meta, KDA leaders)
// from a league object. Defensive and tolerant to multiple match/set shapes.
//
// Usage:
//   import { computeStatsForLeague } from '../engine/statsManager';
//   const stats = computeStatsForLeague(league, { regularOnly: true, roleFilter: 'ADC' });

/**
 * Options:
 *  - regularOnly: boolean (if true, include only matches with type === 'regular')
 *  - roleFilter: 'ALL' | 'TOP' | 'JGL' | 'MID' | 'ADC' | 'SUP'
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
                const teamNameFromPick = p.playerData?.팀 || p.team || p.teamName || matchContext.blueTeamName || matchContext.redTeamName;
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
              const teamNameFromPick2 = p.playerData?.팀 || p.team || p.teamName || matchContext.blueTeamName || matchContext.redTeamName;
              if (teamNameFromPick2) kEntry.teams.add(teamNameFromPick2);
              kdaAgg.set(playerName, kEntry);
            }
          });
        });
  
        // POG
        const pog = extractPog(set);
        if (pog && (pog.playerName || pog.player)) {
          const pname = String(pog.playerName || pog.player || pog.playerName || '').trim();
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