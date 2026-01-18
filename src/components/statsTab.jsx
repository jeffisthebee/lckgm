// src/components/StatsTab.jsx
import React, { useState, useMemo } from 'react';
import playerList from '../data/players.json';
import { championList } from '../data/constants';

// Utility: safe array
const safeArray = (v) => Array.isArray(v) ? v : [];

// Normalize position names so filter works with various strings in data
const normalizePos = (p) => {
  if (!p) return 'UNKNOWN';
  const up = String(p).toUpperCase();
  if (['JGL', '정글', 'JUNGLE'].includes(up)) return 'JGL';
  if (['SUP', '서포터', 'SUPP', 'SPT'].includes(up)) return 'SUP';
  if (['ADC', '원거리', 'BOT', 'BOTTOM', 'AD'].includes(up)) return 'ADC';
  if (['MID', '미드'].includes(up)) return 'MID';
  if (['TOP', '탑'].includes(up)) return 'TOP';
  return up;
};

const computeSetPlayerScore = (p) => {
  const kills = p.stats?.kills ?? p.k ?? 0;
  const deaths = (p.stats?.deaths ?? p.d);
  const safeD = (deaths === 0 ? 1 : (deaths || 1));
  const assists = p.stats?.assists ?? p.a ?? 0;
  const damage = p.stats?.damage ?? 0;
  const gold = p.currentGold ?? 0;
  const score = ((kills + assists) / safeD) * 3 + (damage / 3000) + (gold / 1000) + (assists * 1);
  return { score, kills, deaths, assists, damage, gold };
};

export default function StatsTab({ league }) {
  const [posFilter, setPosFilter] = useState('ALL');
  const [regularOnly, setRegularOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const stats = useMemo(() => {
    const players = {}; // playerName -> aggregated data
    const champions = {}; // champName -> { picks, wins, bans }
    let totalPicks = 0;
    let totalBans = 0;

    if (!league || !Array.isArray(league.matches)) {
      return { players, champions, totalPicks, totalBans };
    }

    // Iterate matches
    for (const match of league.matches) {
      if (!match || match.status !== 'finished') continue;
      if (regularOnly && match.type !== 'regular') continue;

      const history = safeArray(match.result?.history);
      // Count series-level POS as POG
      const seriesPos = match.result?.posPlayer?.playerName;
      if (seriesPos) {
        players[seriesPos] = players[seriesPos] || { games: 0, totalScore: 0, pog: 0, kills: 0, deaths: 0, assists: 0, champCounts: {} };
        players[seriesPos].pog += 1;
      }

      for (const set of history) {
        // Bans
        const bansA = safeArray(set.bans?.A);
        const bansB = safeArray(set.bans?.B);
        totalBans += bansA.length + bansB.length;
        bansA.forEach(b => { champions[b] = champions[b] || { picks: 0, wins: 0, bans: 0 }; champions[b].bans += 1; });
        bansB.forEach(b => { champions[b] = champions[b] || { picks: 0, wins: 0, bans: 0 }; champions[b].bans += 1; });

        // POG at set level
        const setPog = set.pogPlayer?.playerName;
        if (setPog) {
          players[setPog] = players[setPog] || { games: 0, totalScore: 0, pog: 0, kills: 0, deaths: 0, assists: 0, champCounts: {} };
          players[setPog].pog += 1;
        }

        const winnerName = set.winner;

        const picksA = safeArray(set.picks?.A);
        const picksB = safeArray(set.picks?.B);

        const processPick = (p, side) => {
          if (!p || !p.playerName) return;
          const playerName = p.playerName;
          players[playerName] = players[playerName] || { games: 0, totalScore: 0, pog: 0, kills: 0, deaths: 0, assists: 0, champCounts: {} };
          const { score, kills, deaths, assists } = computeSetPlayerScore(p);
          players[playerName].games += 1;
          players[playerName].totalScore += (score || 0);
          players[playerName].kills += (kills || 0);
          players[playerName].deaths += (deaths || 0);
          players[playerName].assists += (assists || 0);

          const champName = p.champName || p.champ || p.champName;
          if (champName) {
            champions[champName] = champions[champName] || { picks: 0, wins: 0, bans: 0 };
            champions[champName].picks += 1;
            totalPicks += 1;
            players[playerName].champCounts[champName] = (players[playerName].champCounts[champName] || 0) + 1;
            // If this pick was on the winning side, count champion wins
            if (winnerName) {
              // Heuristic: determine whether this pick belongs to winner side.
              // If side === 'A' and winnerName === set.teamA (?) we don't have team names here reliably,
              // but in engine picks A corresponds to Blue team. So we'll test using set.winner and members' playerData team.
              const playerTeam = p.playerData?.팀 || p.playerData?.team;
              if (playerTeam && winnerName && String(playerTeam) === String(winnerName)) {
                champions[champName].wins = (champions[champName].wins || 0) + 1;
              } else {
                // fallback: if the pick's side matches inferred winner (we cannot always infer), try side-based heuristic:
                if (set.winnerSide) { // if engine provided winnerSide
                  if ((side === 'A' && set.winnerSide === 'BLUE') || (side === 'B' && set.winnerSide === 'RED')) {
                    champions[champName].wins = (champions[champName].wins || 0) + 1;
                  }
                } else {
                  // Last resort: if winnerName equals team names passed elsewhere, skip aggressive counting.
                }
              }
            }
          }
        };

        // Process A picks as side A, B as side B
        picksA.forEach(p => processPick(p, 'A'));
        picksB.forEach(p => processPick(p, 'B'));
      } // end for each set
    } // end for matches

    return { players, champions, totalPicks, totalBans };
  }, [league, regularOnly]);

  // Derived leaderboards
  const pogLeaderboard = useMemo(() => {
    const arr = Object.entries(stats.players).map(([name, data]) => ({ name, pog: data.pog || 0 }));
    arr.sort((a, b) => b.pog - a.pog || a.name.localeCompare(b.name));
    return arr;
  }, [stats]);

  const playerRatings = useMemo(() => {
    const arr = Object.entries(stats.players).map(([name, data]) => {
      const avg = data.games > 0 ? (data.totalScore / data.games) : 0;
      return { name, avg, games: data.games, kills: data.kills, deaths: data.deaths, assists: data.assists };
    });
    arr.sort((a, b) => b.avg - a.avg);
    return arr;
  }, [stats]);

  const kdaLeaders = useMemo(() => {
    const arr = Object.entries(stats.players).map(([name, data]) => {
      const k = data.kills || 0;
      const d = data.deaths || 0;
      const a = data.assists || 0;
      const ratio = (k + a) / Math.max(1, d);
      return { name, k, d, a, ratio, games: data.games };
    });
    arr.sort((a, b) => b.ratio - a.ratio || b.k - a.k);
    return arr;
  }, [stats]);

  const championMeta = useMemo(() => {
    const champEntries = Object.entries(stats.champions).map(([name, data]) => {
      const picks = data.picks || 0;
      const wins = data.wins || 0;
      const bans = data.bans || 0;
      return {
        name,
        picks,
        wins,
        bans,
        winRate: picks > 0 ? (wins / picks) : 0,
        pickRate: stats.totalPicks > 0 ? (picks / stats.totalPicks) : 0,
        banRate: stats.totalBans > 0 ? (bans / stats.totalBans) : 0
      };
    });
    champEntries.sort((a, b) => b.picks - a.picks || b.winRate - a.winRate);
    return champEntries;
  }, [stats]);

  // Filters apply to player lists
  const filteredPlayerRatings = useMemo(() => {
    const query = (searchQuery || '').trim().toLowerCase();
    const pos = posFilter;
    return playerRatings.filter(item => {
      if (query && !item.name.toLowerCase().includes(query)) return false;
      if (pos === 'ALL') return true;
      // Check player's position by looking up in playerList (fallback)
      const pinfo = playerList.find(p => p.이름 === item.name) || {};
      const playerPos = normalizePos(pinfo.포지션 || (stats.players[item.name]?.playerData?.포지션));
      return playerPos === pos;
    });
  }, [playerRatings, posFilter, searchQuery, stats.players]);

  const filteredKda = useMemo(() => {
    const query = (searchQuery || '').trim().toLowerCase();
    const pos = posFilter;
    return kdaLeaders.filter(item => {
      if (query && !item.name.toLowerCase().includes(query)) return false;
      if (pos === 'ALL') return true;
      const pinfo = playerList.find(p => p.이름 === item.name) || {};
      const playerPos = normalizePos(pinfo.포지션 || (stats.players[item.name]?.playerData?.포지션));
      return playerPos === pos;
    });
  }, [kdaLeaders, posFilter, searchQuery, stats.players]);

  const filteredPOG = useMemo(() => {
    const pos = posFilter;
    return pogLeaderboard.filter(item => {
      if (pos === 'ALL') return true;
      const pinfo = playerList.find(p => p.이름 === item.name) || {};
      const playerPos = normalizePos(pinfo.포지션 || (stats.players[item.name]?.playerData?.포지션));
      return playerPos === pos;
    });
  }, [pogLeaderboard, posFilter]);

  // UI
  return (
    <div className="bg-white rounded-lg border shadow-sm p-6 min-h-[600px]">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-black">📊 통계 포털</h2>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={regularOnly} onChange={(e) => setRegularOnly(e.target.checked)} />
            <span>정규 시즌만</span>
          </label>
          <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="px-3 py-1 border rounded">
            <option value="ALL">All</option>
            <option value="TOP">TOP</option>
            <option value="JGL">JGL</option>
            <option value="MID">MID</option>
            <option value="ADC">ADC</option>
            <option value="SUP">SUP</option>
          </select>
          <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="검색 (선수명)" className="px-3 py-1 border rounded text-sm" />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* POG Leaderboard */}
        <div className="bg-gray-50 p-4 rounded border">
          <h3 className="font-bold mb-3">🏅 POG Leaderboard</h3>
          <div className="space-y-2 text-sm">
            {filteredPOG.slice(0, 20).map((p, i) => (
              <div key={p.name} className="flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold">{i + 1}</div>
                  <div>
                    <div className="font-bold">{p.name}</div>
                    <div className="text-xs text-gray-500">POG: {p.pog}</div>
                  </div>
                </div>
                <div className="text-sm font-mono text-gray-700">{p.pog}</div>
              </div>
            ))}
            {filteredPOG.length === 0 && <div className="text-gray-500">데이터가 없습니다.</div>}
          </div>
        </div>

        {/* Player Ratings */}
        <div className="bg-gray-50 p-4 rounded border col-span-2">
          <h3 className="font-bold mb-3">⭐ Player Ratings (평균 스코어)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-[420px] overflow-auto pr-2">
            {filteredPlayerRatings.slice(0, 50).map((p, i) => (
              <div key={p.name} className="flex justify-between items-center bg-white p-3 rounded border">
                <div>
                  <div className="font-bold">{p.name}</div>
                  <div className="text-xs text-gray-500">Games: {p.games}</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-lg">{p.avg.toFixed(2)}</div>
                  <div className="text-xs text-gray-500">K/D/A: {p.kills}/{p.deaths}/{p.assists}</div>
                </div>
              </div>
            ))}
            {filteredPlayerRatings.length === 0 && <div className="text-gray-500 p-4">데이터가 없습니다.</div>}
          </div>
        </div>

        {/* Champion Meta */}
        <div className="bg-gray-50 p-4 rounded border">
          <h3 className="font-bold mb-3">🧭 Champion Meta</h3>
          <div className="space-y-2 max-h-[420px] overflow-auto pr-2 text-sm">
            {championMeta.slice(0, 60).map(c => (
              <div key={c.name} className="flex justify-between items-center bg-white p-2 rounded border">
                <div className="flex items-center gap-3">
                  <div className="font-bold">{c.name}</div>
                  <div className="text-xs text-gray-400">Picks: {c.picks}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-gray-600">Win: {(c.winRate * 100).toFixed(1)}%</div>
                  <div className="text-xs text-gray-600">Pick: {(c.pickRate * 100).toFixed(1)}% Ban: {(c.banRate * 100).toFixed(1)}%</div>
                </div>
              </div>
            ))}
            {championMeta.length === 0 && <div className="text-gray-500">데이터가 없습니다.</div>}
          </div>
        </div>

        {/* KDA Leaders */}
        <div className="bg-gray-50 p-4 rounded border col-span-2">
          <h3 className="font-bold mb-3">⚔️ KDA Leaders</h3>
          <div className="space-y-2 max-h-[360px] overflow-auto pr-2 text-sm">
            {filteredKda.slice(0, 50).map((p, i) => (
              <div key={p.name} className="flex justify-between items-center bg-white p-2 rounded border">
                <div>
                  <div className="font-bold">{p.name}</div>
                  <div className="text-xs text-gray-500">Games: {p.games}</div>
                </div>
                <div className="text-right">
                  <div className="font-black">{p.ratio.toFixed(2)} KDA</div>
                  <div className="text-xs text-gray-600">{p.k}/{p.d}/{p.a}</div>
                </div>
              </div>
            ))}
            {filteredKda.length === 0 && <div className="text-gray-500">데이터가 없습니다.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}