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
  // Changed from regularOnly boolean to a stage string filter
  const [stageFilter, setStageFilter] = useState('ALL'); // 'ALL', 'PLAYIN', 'REGULAR', 'PLAYOFF'
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSection, setActiveSection] = useState('POG'); // 'POG', 'RATING', 'META', 'KDA'

  const stats = useMemo(() => {
    const players = {}; // playerName -> aggregated data
    const champions = {}; // champName -> { picks, wins, bans }
    // Bucket champions by role: { ALL: {}, TOP: {}, ... }
    const championStats = { ALL: {}, TOP: {}, JGL: {}, MID: {}, ADC: {}, SUP: {}, UNKNOWN: {} };
    
    let totalPicks = 0;
    let totalBans = 0;
    let totalGames = 0;

    if (!league || !Array.isArray(league.matches)) {
      return { players, champions, championStats, totalPicks, totalBans, totalGames };
    }

    // Helper to init champ entry in buckets
    const initChampBucket = (bucket, name) => {
        if (!bucket[name]) bucket[name] = { picks: 0, wins: 0, bans: 0 };
    };

    // Iterate matches
    for (const match of league.matches) {
      if (!match || match.status !== 'finished') continue;
      
      // === STAGE FILTER LOGIC ===
      // Match types are assumed to be: 'playin', 'regular', 'super', 'playoff'
      if (stageFilter === 'REGULAR') {
        if (match.type !== 'regular' && match.type !== 'super') continue;
      } else if (stageFilter === 'PLAYIN') {
        if (match.type !== 'playin') continue;
      } else if (stageFilter === 'PLAYOFF') {
        if (match.type !== 'playoff') continue;
      }
      // If 'ALL', we don't skip anything

      const history = safeArray(match.result?.history);
      // Count series-level POS as POG
      const seriesPos = match.result?.posPlayer?.playerName;
      if (seriesPos) {
        players[seriesPos] = players[seriesPos] || { games: 0, totalScore: 0, pog: 0, kills: 0, deaths: 0, assists: 0, champCounts: {} };
        players[seriesPos].pog += 1;
      }

      for (const set of history) {
        totalGames++;

        // Bans
        const bans = [...safeArray(set.bans?.A), ...safeArray(set.bans?.B), ...safeArray(set.fearlessBans)];
        totalBans += bans.length;
        
        bans.forEach(b => { 
            // Old flat structure
            champions[b] = champions[b] || { picks: 0, wins: 0, bans: 0 }; 
            champions[b].bans += 1; 

            // New Bucket structure (Bans are global/ALL)
            initChampBucket(championStats['ALL'], b);
            championStats['ALL'][b].bans += 1;
        });

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
          
          // 1. Player Stats
          const playerName = p.playerName;
          players[playerName] = players[playerName] || { games: 0, totalScore: 0, pog: 0, kills: 0, deaths: 0, assists: 0, champCounts: {} };
          const { score, kills, deaths, assists } = computeSetPlayerScore(p);
          players[playerName].games += 1;
          players[playerName].totalScore += (score || 0);
          players[playerName].kills += (kills || 0);
          players[playerName].deaths += (deaths || 0);
          players[playerName].assists += (assists || 0);

          // 2. Champion Stats
          const champName = p.champName || p.champ || p.champName;
          if (champName) {
            totalPicks += 1;
            
            // Determine Win
            let isWin = false;
            if (winnerName) {
              const playerTeam = p.playerData?.팀 || p.playerData?.team;
              if (playerTeam && winnerName && String(playerTeam) === String(winnerName)) {
                isWin = true;
              } else if (set.winnerSide) { 
                  if ((side === 'A' && set.winnerSide === 'BLUE') || (side === 'B' && set.winnerSide === 'RED')) {
                    isWin = true;
                  }
              }
            }

            // Old Structure
            champions[champName] = champions[champName] || { picks: 0, wins: 0, bans: 0 };
            champions[champName].picks += 1;
            if (isWin) champions[champName].wins += 1;
            
            players[playerName].champCounts[champName] = (players[playerName].champCounts[champName] || 0) + 1;

            // New Bucket Structure
            const rawRole = p.role || p.playerData?.포지션;
            const role = normalizePos(rawRole);

            // Global Bucket
            initChampBucket(championStats['ALL'], champName);
            championStats['ALL'][champName].picks += 1;
            if (isWin) championStats['ALL'][champName].wins += 1;

            // Role Bucket
            if (championStats[role]) {
                initChampBucket(championStats[role], champName);
                championStats[role][champName].picks += 1;
                if (isWin) championStats[role][champName].wins += 1;
            }
          }
        };

        picksA.forEach(p => processPick(p, 'A'));
        picksB.forEach(p => processPick(p, 'B'));
      } 
    }

    return { players, champions, championStats, totalPicks, totalBans, totalGames };
  }, [league, stageFilter]);

  // Derived leaderboards
  const pogLeaderboard = useMemo(() => {
    const arr = Object.entries(stats.players).map(([name, data]) => ({ name, pog: data.pog || 0 }));
    // Filter out 0 POGs
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
    // Select bucket based on filter
    const targetBucket = stats.championStats[posFilter] || stats.championStats['ALL'];
    const globalBucket = stats.championStats['ALL'];

    const champEntries = Object.entries(targetBucket).map(([name, data]) => {
      const picks = data.picks || 0;
      const wins = data.wins || 0;
      // Bans are global
      const bans = globalBucket[name]?.bans || 0; 
      
      return {
        name,
        picks,
        wins,
        bans,
        winRate: picks > 0 ? (wins / picks) : 0,
        pickRate: stats.totalGames > 0 ? (picks / stats.totalGames) : 0,
        banRate: stats.totalGames > 0 ? (bans / stats.totalGames) : 0
      };
    });
    champEntries.sort((a, b) => b.picks - a.picks || b.winRate - a.winRate);
    return champEntries;
  }, [stats, posFilter]);

  // Filters apply to player lists
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

  const getRankStyle = (rank) => {
    if (rank === 1) return "bg-yellow-100 text-yellow-700 border-yellow-300";
    if (rank === 2) return "bg-gray-100 text-gray-700 border-gray-300";
    if (rank === 3) return "bg-orange-100 text-orange-700 border-orange-300";
    return "bg-white text-gray-600 border-gray-200";
  };

  return (
    // Responsive container height: adapts to screen size, excellent for landscape phones
    <div className="bg-white rounded-xl border shadow-sm flex flex-col h-[calc(100vh-100px)] sm:h-[700px]">
      
      {/* HEADER: Flex wrap allows controls to stack on small/narrow screens */}
      <div className="p-4 sm:p-6 border-b border-gray-100 flex-shrink-0">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
          <h2 className="text-xl sm:text-2xl font-black text-gray-800 whitespace-nowrap">📊 통계 센터</h2>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            
            {/* STAGE FILTERS */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                  onClick={() => setStageFilter('ALL')}
                  className={`px-3 py-1 text-xs sm:text-sm font-bold rounded-md transition-all ${stageFilter === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  전체
                </button>
                <button 
                  onClick={() => setStageFilter('PLAYIN')}
                  className={`px-3 py-1 text-xs sm:text-sm font-bold rounded-md transition-all ${stageFilter === 'PLAYIN' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  플레이인
                </button>
                <button 
                  onClick={() => setStageFilter('REGULAR')}
                  className={`px-3 py-1 text-xs sm:text-sm font-bold rounded-md transition-all ${stageFilter === 'REGULAR' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  정규시즌
                </button>
                <button 
                  onClick={() => setStageFilter('PLAYOFF')}
                  className={`px-3 py-1 text-xs sm:text-sm font-bold rounded-md transition-all ${stageFilter === 'PLAYOFF' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  플레이오프
                </button>
            </div>
            
            <div className="h-4 w-px bg-gray-300 hidden sm:block"></div>
            
            <select value={posFilter} onChange={(e) => setPosFilter(e.target.value)} className="px-2 py-1.5 sm:px-3 border border-gray-300 rounded-lg text-xs sm:text-sm font-bold text-gray-700 focus:ring-2 focus:ring-blue-500 outline-none flex-1 sm:flex-none">
              <option value="ALL">전체 포지션</option>
              <option value="TOP">TOP</option>
              <option value="JGL">JGL</option>
              <option value="MID">MID</option>
              <option value="ADC">ADC</option>
              <option value="SUP">SUP</option>
            </select>
            
            <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="검색" className="px-2 py-1.5 sm:px-3 border border-gray-300 rounded-lg text-xs sm:text-sm w-full sm:w-48 focus:ring-2 focus:ring-blue-500 outline-none" />
          </div>
        </div>

        {/* TABS: Horizontal scroll for small screens */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
          {[
            { id: 'POG', label: '🏅 POG 순위', color: 'yellow' },
            { id: 'RATING', label: '⭐ 평점', color: 'blue' },
            { id: 'META', label: '🧭 메타', color: 'purple' },
            { id: 'KDA', label: '⚔️ KDA', color: 'red' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveSection(tab.id)}
              className={`px-4 sm:px-6 py-2 sm:py-3 rounded-lg font-black text-xs sm:text-sm whitespace-nowrap transition-all duration-200 border-b-4 ${
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

      {/* CONTENT AREA: Scrollable */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 bg-gray-50">
        
        {/* === POG SECTION === */}
        {activeSection === 'POG' && (
          <div className="space-y-4">
            <h3 className="font-bold text-base sm:text-lg text-gray-800 mb-2 flex items-center gap-2">
                <span>🏆</span> POG 순위
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {applyFilters(pogLeaderboard).map((p, i) => (
                <div key={p.name} className={`flex items-center p-3 sm:p-4 rounded-xl border-2 shadow-sm transition hover:-translate-y-1 ${getRankStyle(i + 1)}`}>
                  <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center font-black text-base sm:text-lg mr-3 sm:mr-4 flex-shrink-0 ${i < 3 ? 'bg-black text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-black text-gray-900 text-base sm:text-lg truncate">{p.name}</div>
                    <div className="text-[10px] sm:text-xs font-bold text-gray-500 truncate">
                        {(() => {
                            const pinfo = playerList.find(pl => pl.이름 === p.name);
                            return pinfo ? `${pinfo.팀} · ${pinfo.포지션}` : 'Unknown';
                        })()}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="text-xl sm:text-2xl font-black text-yellow-600">{p.pog}</div>
                    <div className="text-[9px] sm:text-[10px] font-bold text-gray-400 uppercase">Points</div>
                  </div>
                </div>
              ))}
              {applyFilters(pogLeaderboard).length === 0 && <div className="col-span-full py-12 text-center text-gray-400 font-bold">데이터가 없습니다.</div>}
            </div>
          </div>
        )}

        {/* === RATING SECTION === */}
        {activeSection === 'RATING' && (
          <div>
            <h3 className="font-bold text-base sm:text-lg text-gray-800 mb-2 sm:mb-4">⭐ 시뮬레이션 평점</h3>
            <div className="overflow-x-auto bg-white rounded-lg border shadow-sm">
                <table className="w-full min-w-[500px] sm:min-w-full">
                <thead className="bg-gray-100 text-gray-500 text-[10px] sm:text-xs font-bold uppercase">
                    <tr>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-center w-10 sm:w-16">순위</th>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-left">선수</th>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-center">평균 평점</th>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-center">KDA</th>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-center">Games</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {applyFilters(playerRatings).slice(0, 50).map((p, i) => (
                    <tr key={p.name} className="hover:bg-blue-50/50 transition text-xs sm:text-sm">
                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-black text-gray-400">{i + 1}</td>
                        <td className="py-2 px-2 sm:py-3 sm:px-4">
                        <div className="font-bold text-gray-800">{p.name}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 font-medium">
                            {(() => {
                                const pinfo = playerList.find(pl => pl.이름 === p.name);
                                return pinfo ? `${pinfo.팀} ${pinfo.포지션}` : '';
                            })()}
                        </div>
                        </td>
                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center">
                            <span className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-blue-100 text-blue-700 font-black text-xs sm:text-sm">
                                {p.avg.toFixed(1)}
                            </span>
                        </td>
                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-mono text-gray-600">
                            {p.kills}/{p.deaths}/{p.assists}
                        </td>
                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-bold text-gray-700">{p.games}</td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
          </div>
        )}

        {/* === META SECTION === */}
        {activeSection === 'META' && (
          <div>
            <div className="flex justify-between items-center mb-2 sm:mb-4">
                <h3 className="font-bold text-base sm:text-lg text-gray-800 flex items-center gap-2">
                    <span>🧭</span> 메타 분석
                </h3>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {championMeta.slice(0, 60).map((c, i) => (
                <div key={c.name} className="bg-white p-3 sm:p-4 rounded-xl border hover:shadow-md transition flex items-center justify-between">
                    <div className="flex items-center gap-3 sm:gap-4">
                        <span className={`text-lg sm:text-xl font-black w-5 sm:w-6 ${i<3 ? 'text-purple-600' : 'text-gray-300'}`}>{i+1}</span>
                        <div>
                            <div className="font-black text-gray-800 text-base sm:text-lg">{c.name}</div>
                            <div className="text-[10px] sm:text-xs font-bold text-gray-500">Pick {c.picks} · Ban {c.bans}</div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className={`text-xs sm:text-sm font-black ${c.winRate >= 0.5 ? 'text-green-600' : 'text-red-500'}`}>
                            {(c.winRate * 100).toFixed(1)}% WR
                        </div>
                        <div className="text-[10px] sm:text-xs text-gray-400 font-medium">
                            P/B {((c.pickRate + c.banRate) * 100).toFixed(0)}%
                        </div>
                    </div>
                </div>
                ))}
            </div>
            {championMeta.length === 0 && <div className="text-center py-12 text-gray-400 font-bold">해당 조건의 데이터가 없습니다.</div>}
          </div>
        )}

        {/* === KDA SECTION === */}
        {activeSection === 'KDA' && (
          <div>
            <h3 className="font-bold text-base sm:text-lg text-gray-800 mb-2 sm:mb-4">⚔️ KDA 리더보드</h3>
            <div className="overflow-x-auto bg-white rounded-lg border shadow-sm">
                <table className="w-full min-w-[500px] sm:min-w-full">
                <thead className="bg-gray-100 text-gray-500 text-[10px] sm:text-xs font-bold uppercase">
                    <tr>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-center w-10 sm:w-16">순위</th>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-left">선수</th>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-center">KDA Ratio</th>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-center">K/D/A</th>
                    <th className="py-2 px-2 sm:py-3 sm:px-4 text-center">Games</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                    {applyFilters(kdaLeaders).slice(0, 50).map((p, i) => (
                    <tr key={p.name} className="hover:bg-red-50/50 transition text-xs sm:text-sm">
                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-black text-gray-400">{i + 1}</td>
                        <td className="py-2 px-2 sm:py-3 sm:px-4">
                        <div className="font-bold text-gray-800">{p.name}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 font-medium">
                            {(() => {
                                const pinfo = playerList.find(pl => pl.이름 === p.name);
                                return pinfo ? `${pinfo.팀} ${pinfo.포지션}` : '';
                            })()}
                        </div>
                        </td>
                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center">
                            <span className="inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-red-100 text-red-700 font-black text-xs sm:text-sm">
                                {p.ratio.toFixed(2)}
                            </span>
                        </td>
                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-mono text-gray-700 font-bold">
                            {p.k} <span className="text-gray-300">/</span> <span className="text-red-500">{p.d}</span> <span className="text-gray-300">/</span> {p.a}
                        </td>
                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-bold text-gray-700">{p.games}</td>
                    </tr>
                    ))}
                </tbody>
                </table>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}