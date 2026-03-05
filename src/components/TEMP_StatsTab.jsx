// src/components/TEMP_StatsTab.jsx
import React, { useState, useMemo } from 'react';

// [NEW] 1. Import all the global players for team/position lookups!
import playersLCK from '../data/players.json';
import playersLPL from '../data/players_lpl.json';
import playersLEC from '../data/players_lec.json';
import playersLCS from '../data/players_lcs.json';
import playersLCP from '../data/players_lcp.json';
import playersCBLOL from '../data/players_cblol.json';

const globalPlayerList = [
    ...playersLCK,
    ...playersLPL,
    ...playersLEC,
    ...playersLCS,
    ...playersLCP,
    ...playersCBLOL
];

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
  const deaths = p.stats?.deaths ?? p.d ?? 0;
  const assists = p.stats?.assists ?? p.a ?? 0;
  const gold = p.currentGold ?? 0;

  // Kills weighted 3x, assists 0.25x — stops support assist inflation
  // Deaths floored at 1.5 so 0-death games don't go infinite
  const kda = (kills * 3 + assists * 0.25) / Math.max(deaths, 1.5);
  let score = 65 + kda + (gold / 1500);

  // Additive role boosts — deaths reduce boost so feeders don't get free points
  const role = normalizePos(p.playerData?.포지션 || p.role || p.position);
  if (role === 'SUP') score += Math.max(10 - (deaths * 1.5), 2);
  if (role === 'JGL') score += Math.max(6 - deaths, 0);
  if (role === 'TOP') score += Math.max(4 - deaths, 0);
  // MID/ADC get no boost — formula naturally rewards their kill-heavy stats

  return { score, kills, deaths, assists, gold };
};

// Helper: robust type checks
const normalizeType = (t) => String(t || '').toLowerCase();
const isPlayoffType = (t) => normalizeType(t).includes('playoff') || normalizeType(t) === 'playoff';
const isRegularType = (t) => {
  const n = normalizeType(t);
  // treat 'regular' and any 'super' (superweek / super-week / super_week) as regular season
  return n === 'regular' || n.includes('super') || n === 'super' || n === 'superweek' || n === 'super-week' || n === 'super_week';
};
const isPlayinType = (t) => normalizeType(t).includes('playin') || normalizeType(t) === 'playin';

export default function StatsTab({ league }) {
  // League Switcher Memory
  const [currentLeague, setCurrentLeague] = useState('LCK');
  
  const [posFilter, setPosFilter] = useState('ALL');
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

    // Direct the logic to the correct matches array based on the selected league
    let activeMatches = [];
    if (currentLeague === 'LCK') activeMatches = league?.matches || [];
    else if (currentLeague === 'FST') activeMatches = league?.fst?.matches || [];
    else activeMatches = league?.foreignMatches?.[currentLeague] || [];

    if (!activeMatches || !Array.isArray(activeMatches)) {
      return { players, champions, championStats, totalPicks, totalBans, totalGames };
    }

    // Helper to init champ entry in buckets
    const initChampBucket = (bucket, name) => {
        if (!bucket[name]) bucket[name] = { picks: 0, wins: 0, bans: 0 };
    };

    // Iterate matches
    for (const match of activeMatches) {
      if (!match || match.status !== 'finished') continue;
      
      // === STAGE FILTER LOGIC ===
      if (stageFilter === 'REGULAR') {
        if (currentLeague === 'FST') {
            if (!match.fstRound?.startsWith('GG')) continue;
        } else if (!isRegularType(match.type)) continue;
      } else if (stageFilter === 'PLAYIN') {
        if (currentLeague === 'FST') continue; // FST doesn't have play-in
        if (!isPlayinType(match.type)) continue;
      } else if (stageFilter === 'PLAYOFF') {
        if (currentLeague === 'FST') {
            if (match.fstRound?.startsWith('GG')) continue;
        } else if (!isPlayoffType(match.type)) continue;
      }

      const history = safeArray(match.result?.history);

      // Series-level POS normalization (robust)
      const rawSeriesPos = match.result?.posPlayer ?? match.posPlayer ?? match.result?.posPlayerName ?? match.posPlayerName;
      let seriesPosName = null;
      if (rawSeriesPos) {
        if (typeof rawSeriesPos === 'string') {
          seriesPosName = rawSeriesPos.trim();
        } else if (typeof rawSeriesPos === 'object') {
          seriesPosName = (rawSeriesPos.playerName || rawSeriesPos.player || rawSeriesPos.name || rawSeriesPos.이름 || '').trim() || null;
        } else {
          seriesPosName = String(rawSeriesPos).trim();
        }
      }

      // Only add series POS if this match is a playoff series (explicit)
      const isPlayoffContext = currentLeague === 'FST' ? !match.fstRound?.startsWith('GG') : isPlayoffType(match.type);
      if (seriesPosName && isPlayoffContext) {
        players[seriesPosName] = players[seriesPosName] || { games: 0, totalScore: 0, pog: 0, kills: 0, deaths: 0, assists: 0, champCounts: {} };
        players[seriesPosName].pog += 1;
      }

      for (const set of history) {
        totalGames++;

        // Bans
        const bans = [...safeArray(set.bans?.A), ...safeArray(set.bans?.B), ...safeArray(set.fearlessBans)];
        totalBans += bans.length;
        
        bans.forEach(b => { 
            champions[b] = champions[b] || { picks: 0, wins: 0, bans: 0 }; 
            champions[b].bans += 1; 

            initChampBucket(championStats['ALL'], b);
            championStats['ALL'][b].bans += 1;
        });

        // POG at set level (robust extraction)
        const setPogRaw = set.pogPlayer ?? set.pog ?? set.posPlayer;
        const setPogName = typeof setPogRaw === 'string' ? setPogRaw.trim() : (setPogRaw?.playerName || setPogRaw?.player || '').trim();
        if (setPogName) {
          players[setPogName] = players[setPogName] || { games: 0, totalScore: 0, pog: 0, kills: 0, deaths: 0, assists: 0, champCounts: {} };
          players[setPogName].pog += 1;
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
          const champName = p.champName || p.champ || p.name;
          if (champName) {
            totalPicks += 1;
            
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

            champions[champName] = champions[champName] || { picks: 0, wins: 0, bans: 0 };
            champions[champName].picks += 1;
            if (isWin) champions[champName].wins += 1;
            
            players[playerName].champCounts[champName] = (players[playerName].champCounts[champName] || 0) + 1;

            const rawRole = p.role || p.playerData?.포지션;
            const role = normalizePos(rawRole);

            initChampBucket(championStats['ALL'], champName);
            championStats['ALL'][champName].picks += 1;
            if (isWin) championStats['ALL'][champName].wins += 1;

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
  }, [league, stageFilter, currentLeague]);

  // Derived leaderboards
  const pogLeaderboard = useMemo(() => {
    const arr = Object.entries(stats.players).map(([name, data]) => ({ name, pog: data.pog || 0 }));
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
    const targetBucket = stats.championStats[posFilter] || stats.championStats['ALL'];
    const globalBucket = stats.championStats['ALL'];

    const champEntries = Object.entries(targetBucket).map(([name, data]) => {
      const picks = data.picks || 0;
      const wins = data.wins || 0;
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

  // Filters apply to the combined globalPlayerList
  const applyFilters = (list) => {
    const query = (searchQuery || '').trim().toLowerCase();
    const pos = posFilter;
    return list.filter(item => {
      if (query && !item.name.toLowerCase().includes(query)) return false;
      if (pos === 'ALL') return true;
      const pinfo = globalPlayerList.find(p => p.이름 === item.name) || {};
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
    <div className="bg-white rounded-xl border shadow-sm flex flex-col h-[calc(100vh-100px)] sm:h-[700px]">
      
      {/* HEADER */}
      <div className="p-4 sm:p-6 border-b border-gray-100 flex-shrink-0">
        
        {/* The League Switcher Buttons */}
        <div className="flex gap-2 p-2 mb-4 bg-gray-100 overflow-x-auto shrink-0 rounded-lg">
            {['LCK', 'LPL', 'LEC', 'LCS', 'LCP', 'CBLOL', ...(league?.fst ? ['FST'] : [])].map(lg => (
                <button
                    key={lg}
                    onClick={() => setCurrentLeague(lg)}
                    className={`px-5 py-2 rounded-full font-bold text-xs lg:text-sm transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                        currentLeague === lg
                        ? lg === 'FST' 
                            ? 'bg-gradient-to-r from-blue-700 to-purple-700 text-white ring-2 ring-blue-300 transform scale-105'
                            : 'bg-blue-600 text-white ring-2 ring-blue-300 transform scale-105'
                        : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-300'
                    }`}
                >
                    {lg === 'FST' ? '🌍 FST' : lg}
                </button>
            ))}
        </div>

        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3 sm:gap-0">
          <h2 className="text-xl sm:text-2xl font-black text-gray-800 whitespace-nowrap">
              📊 2026 {currentLeague === 'FST' ? 'FST 월드 토너먼트' : currentLeague} 통계 센터
          </h2>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto">
            
            {/* STAGE FILTERS */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
                <button 
                  onClick={() => setStageFilter('ALL')}
                  className={`px-3 py-1 text-xs sm:text-sm font-bold rounded-md transition-all ${stageFilter === 'ALL' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  전체
                </button>
                {currentLeague !== 'FST' && (
                    <button 
                      onClick={() => setStageFilter('PLAYIN')}
                      className={`px-3 py-1 text-xs sm:text-sm font-bold rounded-md transition-all ${stageFilter === 'PLAYIN' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                      플레이인
                    </button>
                )}
                <button 
                  onClick={() => setStageFilter('REGULAR')}
                  className={`px-3 py-1 text-xs sm:text-sm font-bold rounded-md transition-all ${stageFilter === 'REGULAR' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  {currentLeague === 'FST' ? '그룹 스테이지' : '정규시즌'}
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

        {/* TABS */}
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
                            const pinfo = globalPlayerList.find(pl => pl.이름 === p.name);
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
              {applyFilters(pogLeaderboard).length === 0 && <div className="col-span-full py-12 text-center text-gray-400 font-bold">{currentLeague} 리그의 데이터가 부족합니다.</div>}
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
                    {applyFilters(playerRatings).map((p, i) => (
                    <tr key={p.name} className="hover:bg-blue-50/50 transition text-xs sm:text-sm">
                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-black text-gray-400">{i + 1}</td>
                        <td className="py-2 px-2 sm:py-3 sm:px-4">
                        <div className="font-bold text-gray-800">{p.name}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 font-medium">
                            {(() => {
                                const pinfo = globalPlayerList.find(pl => pl.이름 === p.name);
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
                {applyFilters(playerRatings).length === 0 && <div className="text-center py-12 text-gray-400 font-bold">{currentLeague} 리그의 데이터가 부족합니다.</div>}
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
                {championMeta.map((c, i) => (
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
            {championMeta.length === 0 && <div className="text-center py-12 text-gray-400 font-bold">{currentLeague} 리그의 데이터가 부족합니다.</div>}
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
                    {applyFilters(kdaLeaders).map((p, i) => (
                    <tr key={p.name} className="hover:bg-red-50/50 transition text-xs sm:text-sm">
                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-black text-gray-400">{i + 1}</td>
                        <td className="py-2 px-2 sm:py-3 sm:px-4">
                        <div className="font-bold text-gray-800">{p.name}</div>
                        <div className="text-[10px] sm:text-xs text-gray-500 font-medium">
                            {(() => {
                                const pinfo = globalPlayerList.find(pl => pl.이름 === p.name);
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
                {applyFilters(kdaLeaders).length === 0 && <div className="text-center py-12 text-gray-400 font-bold">{currentLeague} 리그의 데이터가 부족합니다.</div>}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}