// src/components/StatsTab.jsx
import React, { useState, useMemo } from 'react';
import playerList from '../data/players.json';

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
  const [activeSection, setActiveSection] = useState('POG'); // 'POG', 'RATING', 'META', 'KDA'

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
            
            // Win count logic
            if (winnerName) {
              const playerTeam = p.playerData?.팀 || p.playerData?.team;
              if (playerTeam && winnerName && String(playerTeam) === String(winnerName)) {
                champions[champName].wins = (champions[champName].wins || 0) + 1;
              } else {
                if (set.winnerSide) { 
                  if ((side === 'A' && set.winnerSide === 'BLUE') || (side === 'B' && set.winnerSide === 'RED')) {
                    champions[champName].wins = (champions[champName].wins || 0) + 1;
                  }
                }
              }
            }
          }
        };

        picksA.forEach(p => processPick(p, 'A'));
        picksB.forEach(p => processPick(p, 'B'));
      } 
    }

    return { players, champions, totalPicks, totalBans };
  }, [league, regularOnly]);

  // Derived leaderboards
  const pogLeaderboard = useMemo(() => {
    const arr = Object.entries(stats.players).map(([name, data]) => ({ name, pog: data.pog || 0 }));
    // [FIX] Filter out players with 0 POGs
    return arr.filter(p => p.pog > 0).sort((a, b) => b.pog - a.pog || a.name.localeCompare(b.name));
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

  // Filters
  const applyFilters = (list) => {
    const query = (searchQuery || '').trim().toLowerCase();
    const pos = posFilter;
    return list.filter(item => {
      if (query && !item.name.toLowerCase().includes(query)) return false;
      if (pos === 'ALL') return true;
      const pinfo = playerList.find(p => p.이름 === item.name) || {};
      const playerPos = normalizePos(pinfo.포지션 || (stats.players[item.name]?.playerData?.포지션));
      return playerPos === pos;
    });
  };

  // Render Helpers
  const getRankStyle = (rank) => {
    if (rank === 1) return "bg-yellow-100 text-yellow-700 border-yellow-300";
    if (rank === 2) return "bg-gray-100 text-gray-700 border-gray-300";
    if (rank === 3) return "bg-orange-100 text-orange-700 border-orange-300";
    return "bg-white text-gray-600 border-gray-200";
  };

  return (
    <div className="bg-white rounded-xl border shadow-sm flex flex-col h-[700px]">
      {/* Header */}
      <div className="p-6 border-b border-gray-100">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black text-gray-800">📊 2026 시즌 통계 센터</h2>
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm font-bold text-gray-600 cursor-pointer select-none">
              <input type="checkbox" checked={regularOnly} onChange={(e) => setRegularOnly(e.target.checked)} className="rounded text-blue-600 focus:ring-blue-500" />
              <span>정규 시즌만</span>
            </label>
            <div className="h-4 w-px bg-gray-300 mx-2"></div>
            <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none">
              <option value="ALL">전체 포지션</option>
              <option value="TOP">TOP</option>
              <option value="JGL">JGL</option>
              <option value="MID">MID</option>
              <option value="ADC">ADC</option>
              <option value="SUP">SUP</option>
            </select>
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="선수/챔피언 검색" className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm w-48 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-2">
          {[
            { id: 'POG', label: '🏅 POG 순위', color: 'yellow' },
            { id: 'RATING', label: '⭐ 선수 평점', color: 'blue' },
            { id: 'META', label: '🧭 챔피언 메타', color: 'purple' },
            { id: 'KDA', label: '⚔️ KDA 순위', color: 'red' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`px-6 py-3 rounded-lg font-black text-sm transition-all duration-200 border-b-4 ${
                activeSection === tab.id 
                  ? `bg-${tab.color}-50 text-${tab.color}-700 border-${tab.color}-500 shadow-inner` 
                  : 'bg-white text-gray-500 border-transparent hover:bg-gray-50'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 overflow-y-auto p-6 bg-gray-50">
        
        {/* POG SECTION */}
        {activeSection === 'POG' && (
          <div className="space-y-4">
            <h3 className="font-bold text-lg text-gray-800 mb-4">🏆 Player of the Game 순위</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {applyFilters(pogLeaderboard).map((p, i) => (
                <div key={p.name} className={`flex items-center p-4 rounded-xl border-2 shadow-sm transition hover:-translate-y-1 ${getRankStyle(i + 1)}`}>
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-lg mr-4 ${i < 3 ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1">
                    <div className="font-black text-gray-900 text-lg">{p.name}</div>
                    <div className="text-xs font-bold text-gray-500">
                        {(() => {
                            const pinfo = playerList.find(pl => pl.이름 === p.name);
                            return pinfo ? `${pinfo.팀} · ${pinfo.포지션}` : 'Unknown';
                        })()}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-black text-yellow-600">{p.pog}</div>
                    <div className="text-[10px] font-bold text-gray-400 uppercase">Points</div>
                  </div>
                </div>
              ))}
              {applyFilters(pogLeaderboard).length === 0 && <div className="col-span-full py-12 text-center text-gray-400 font-bold">데이터가 없습니다.</div>}
            </div>
          </div>
        )}

        {/* RATING SECTION */}
        {activeSection === 'RATING' && (
          <div>
            <table className="w-full bg-white rounded-lg border shadow-sm overflow-hidden">
              <thead className="bg-gray-100 text-gray-500 text-xs font-bold uppercase">
                <tr>
                  <th className="py-3 px-4 text-center w-16">순위</th>
                  <th className="py-3 px-4 text-left">선수</th>
                  <th className="py-3 px-4 text-center">평균 평점</th>
                  <th className="py-3 px-4 text-center">KDA</th>
                  <th className="py-3 px-4 text-center">경기 수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applyFilters(playerRatings).slice(0, 50).map((p, i) => (
                  <tr key={p.name} className="hover:bg-blue-50/50 transition">
                    <td className="py-3 px-4 text-center font-black text-gray-400">{i + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-800">{p.name}</div>
                      <div className="text-xs text-gray-500 font-medium">
                        {(() => {
                            const pinfo = playerList.find(pl => pl.이름 === p.name);
                            return pinfo ? `${pinfo.팀} ${pinfo.포지션}` : '';
                        })()}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                        <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 font-black text-sm">
                            {p.avg.toFixed(1)}
                        </span>
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-mono text-gray-600">
                        {p.kills}/{p.deaths}/{p.assists}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-gray-700">{p.games}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* META SECTION */}
        {activeSection === 'META' && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {championMeta.slice(0, 60).map((c, i) => (
              <div key={c.name} className="bg-white p-4 rounded-xl border hover:shadow-md transition flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <span className="text-xl font-black text-gray-300 w-6">{i+1}</span>
                    <div>
                        <div className="font-black text-gray-800 text-lg">{c.name}</div>
                        <div className="text-xs font-bold text-gray-500">Pick {c.picks} · Ban {c.bans}</div>
                    </div>
                </div>
                <div className="text-right">
                    <div className={`text-sm font-black ${c.winRate >= 0.5 ? 'text-green-600' : 'text-red-500'}`}>
                        {(c.winRate * 100).toFixed(1)}% WR
                    </div>
                    <div className="text-xs text-gray-400 font-medium">
                        P/B {(c.pickRate * 100 + c.banRate * 100).toFixed(0)}%
                    </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* KDA SECTION */}
        {activeSection === 'KDA' && (
          <div>
            <table className="w-full bg-white rounded-lg border shadow-sm overflow-hidden">
              <thead className="bg-gray-100 text-gray-500 text-xs font-bold uppercase">
                <tr>
                  <th className="py-3 px-4 text-center w-16">순위</th>
                  <th className="py-3 px-4 text-left">선수</th>
                  <th className="py-3 px-4 text-center">KDA Ratio</th>
                  <th className="py-3 px-4 text-center">상세 기록 (K/D/A)</th>
                  <th className="py-3 px-4 text-center">경기 수</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applyFilters(kdaLeaders).slice(0, 50).map((p, i) => (
                  <tr key={p.name} className="hover:bg-red-50/50 transition">
                    <td className="py-3 px-4 text-center font-black text-gray-400">{i + 1}</td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-800">{p.name}</div>
                      <div className="text-xs text-gray-500 font-medium">
                        {(() => {
                            const pinfo = playerList.find(pl => pl.이름 === p.name);
                            return pinfo ? `${pinfo.팀} ${pinfo.포지션}` : '';
                        })()}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-center">
                        <span className="inline-block px-3 py-1 rounded-full bg-red-100 text-red-700 font-black text-sm">
                            {p.ratio.toFixed(2)}
                        </span>
                    </td>
                    <td className="py-3 px-4 text-center text-sm font-mono text-gray-700 font-bold">
                        {p.k} <span className="text-gray-300">/</span> <span className="text-red-500">{p.d}</span> <span className="text-gray-300">/</span> {p.a}
                    </td>
                    <td className="py-3 px-4 text-center font-bold text-gray-700">{p.games}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

      </div>
    </div>
  );
}