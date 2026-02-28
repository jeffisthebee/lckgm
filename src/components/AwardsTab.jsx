// src/components/AwardsTab.jsx
import React, { useState, useMemo } from 'react';
import { computeAwards, computePlayoffAwards } from '../engine/statsManager';

// Import Global Leagues AND Global Players!
import { FOREIGN_LEAGUES, FOREIGN_PLAYERS } from '../data/foreignLeagues';
import { TEAM_COLORS } from '../data/constants'; 

const globalPlayerList = Object.values(FOREIGN_PLAYERS || {}).flat().filter(Boolean);

const getGlobalTeam = (teamIdentifier, lckTeams) => {
    if (!teamIdentifier) return null;
    let found = lckTeams.find(t => t.name === teamIdentifier || String(t.id) === String(teamIdentifier));
    if (found) return found;
    for (const lg in FOREIGN_LEAGUES) {
        found = (FOREIGN_LEAGUES[lg] || []).find(t => t.name === teamIdentifier || String(t.id) === String(teamIdentifier));
        if (found) return found;
    }
    return null;
};

// --- RoleBadge Component ---
const RoleBadge = ({ role }) => {
    const icons = { TOP: '⚔️', JGL: '🌲', MID: '🧙', ADC: '🏹', SUP: '🛡️' };
    const colors = {
        TOP: 'bg-red-100 text-red-700 border-red-200',
        JGL: 'bg-green-100 text-green-700 border-green-200',
        MID: 'bg-purple-100 text-purple-700 border-purple-200',
        ADC: 'bg-blue-100 text-blue-700 border-blue-200',
        SUP: 'bg-yellow-100 text-yellow-700 border-yellow-200'
    };
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${colors[role] || 'bg-gray-100'}`}>
            <span>{icons[role]}</span> {role}
        </span>
    );
};

// --- PlayerCard Component ---
const PlayerCard = ({ player, rank, lckTeams }) => {
    if (!player) return (
        <div className="w-full h-[220px] bg-gray-50 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
            N/A
        </div>
    );
    
    const playerData = globalPlayerList.find(p => p.이름 === player.playerName || p.playerName === player.playerName);
    const koreanName = playerData ? (playerData.한글명 || playerData.실명 || playerData.이름 || player.playerName) : player.playerName; 
    const ign = player.playerName;

    const teamNameRef = player.teamObj?.name || player.team || (player.teams && player.teams[0]);
    const globalTeam = getGlobalTeam(teamNameRef, lckTeams);
    const displayTeamName = globalTeam?.name || teamNameRef || 'FA';
    
    const bgColor = TEAM_COLORS[displayTeamName] || globalTeam?.colors?.primary || player.teamObj?.colors?.primary || '#333';

    const rankStyles = {
        1: 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-white ring-2 ring-yellow-200',
        2: 'border-gray-300 bg-gradient-to-br from-gray-50 to-white ring-1 ring-gray-200',
        3: 'border-orange-300 bg-gradient-to-br from-orange-50 to-white ring-1 ring-orange-200'
    };

    return (
        <div className={`relative w-full p-2 lg:p-3 rounded-xl border shadow-sm flex flex-col items-center gap-2 ${rankStyles[rank]}`}>
            <div className="absolute top-2 left-2 opacity-80 scale-90 origin-top-left z-10">
                <RoleBadge role={player.role} />
            </div>

            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md mt-4" 
                 style={{ backgroundColor: bgColor }}>
                {displayTeamName}
            </div>

            <div className="text-center mb-1">
                <div className="font-black text-gray-900 text-sm lg:text-base leading-tight break-keep">{koreanName}</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide truncate max-w-[100px]">{ign}</div>
            </div>

            <div className="w-full text-center mt-auto bg-white/50 rounded-lg p-2 border border-gray-100">
                <div className="text-xl lg:text-2xl font-black text-gray-800 leading-none mb-1">{player.finalScore?.toFixed(0) || 0}</div>
                <div className="text-[10px] text-gray-400 font-bold mb-2">총 점수</div>
                
                <div className="text-[9px] text-gray-500 border-t border-gray-200 pt-1 mt-1">
                    <span className="font-bold hidden lg:inline">(세부 점수)</span>
                    <div className="flex justify-center flex-wrap gap-1 mt-0.5 whitespace-nowrap leading-tight">
                        <span title="팀 성적 점수">팀 {player.rankPoints || 0}</span>
                        <span>+</span>
                        <span title="POG 포인트">POG {(player.pogCount || 0) * 10}</span>
                        <span>+</span>
                        <span title="스탯 평점">지표 {player.avgScore?.toFixed(0) || 0}</span>
                        
                        {player.mvpBonus > 0 && (
                             <><span>+</span><span className="text-yellow-600 font-bold">MVP {player.mvpBonus}</span></>
                        )}
                        {player.isFinalsMvp && (
                            <><span>+</span><span className="text-blue-600 font-bold">FMVP 20</span></>
                        )}
                        {player.isPogLeader && !player.isFinalsMvp && (
                             <><span>+</span><span className="text-green-600 font-bold">POG 20</span></>
                        )}
                         {player.isPogLeader && player.isFinalsMvp && (
                             <><span>+</span><span className="text-green-600 font-bold">POG 20</span></>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MvpShowcaseCard Component ---
const MvpShowcaseCard = ({ player, title, badgeColor, lckTeams, size = 'large' }) => {
    if (!player) return (
        <div className={`relative bg-gray-800 rounded-2xl border border-gray-700 p-8 flex items-center justify-center text-gray-500 font-bold ${size === 'large' ? 'w-full max-w-lg mx-auto' : 'w-full'}`}>
            데이터 없음
        </div>
    );

    const teamNameRef = player.teamObj?.name || player.team || (player.teams && player.teams[0]);
    const globalTeam = getGlobalTeam(teamNameRef, lckTeams);
    const displayTeamName = globalTeam?.name || teamNameRef || 'FA';
    
    const bgColor = TEAM_COLORS[displayTeamName] || globalTeam?.colors?.primary || player.teamObj?.colors?.primary || '#333';

    const pData = globalPlayerList.find(p => p.이름 === player.playerName || p.playerName === player.playerName);
    const realName = pData ? (pData.한글명 || pData.실명 || pData.이름 || player.playerName) : player.playerName;

    return (
        <div className={`relative bg-gradient-to-b from-gray-900 to-gray-800 text-white rounded-2xl shadow-2xl border border-gray-700 overflow-hidden group ${size === 'large' ? 'w-full max-w-lg mx-auto p-8' : 'w-full p-6'}`}>
            <div className="absolute top-0 right-0 p-6 opacity-5 text-[80px] lg:text-[120px] font-black leading-none pointer-events-none select-none">MVP</div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
                <div className={`inline-block text-black font-black text-xs px-3 py-1 rounded-full mb-4 shadow-lg ${badgeColor}`}>
                    {title}
                </div>

                <div className={`rounded-full border-4 flex items-center justify-center font-black shadow-2xl mb-4 relative ${badgeColor.replace('bg-', 'border-')}`}
                     style={{
                         backgroundColor: bgColor,
                         width: size === 'large' ? '7rem' : '5rem', 
                         height: size === 'large' ? '7rem' : '5rem',
                         fontSize: size === 'large' ? '1.875rem' : '1.5rem'
                     }}>
                    {displayTeamName}
                </div>
                
                <h1 className={`${size === 'large' ? 'text-4xl lg:text-5xl' : 'text-2xl lg:text-3xl'} font-black text-white mb-1 tracking-tight`}>{realName}</h1>
                <div className={`${size === 'large' ? 'text-xl' : 'text-sm'} text-gray-400 font-bold mb-2`}>{player.playerName}</div>
                {player.pogCount !== undefined && (
                    <div className="bg-yellow-500/10 text-yellow-300 font-bold px-3 py-1 rounded-full mb-4 text-sm">
                        POG Counts: {player.pogCount}
                    </div>
                )}
                
                <div className="w-full border-t border-gray-700 pt-3 mt-2">
                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Total Score</div>
                        <div className={`font-black ${badgeColor.replace('bg-', 'text-').replace('text-black', '')} ${size === 'large' ? 'text-4xl' : 'text-3xl'}`}>
                        {player.finalScore?.toFixed(0) || 0}
                        </div>
                </div>
            </div>
        </div>
    );
};

// --- TeamSection Component ---
const TeamSection = ({ title, rank, players, lckTeams }) => {
    const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    const headerStyles = {
        1: 'bg-yellow-500 text-white border-yellow-600',
        2: 'bg-gray-400 text-white border-gray-500',
        3: 'bg-orange-400 text-white border-orange-500'
    };
    
    const safePlayers = players || {};
    
    return (
        <div className="mb-8 last:mb-0">
            <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`px-3 py-1 rounded-lg font-black text-sm shadow-sm border-b-2 whitespace-nowrap ${headerStyles[rank]}`}>{title}</div>
                <div className="h-px bg-gray-200 flex-1"></div>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 lg:gap-3 px-1">
                {roles.map(role => ( <PlayerCard key={role} player={safePlayers[role]} rank={rank} lckTeams={lckTeams} /> ))}
            </div>
        </div>
    );
};

// --- Main Component ---
export default function AwardsTab({ league, teams }) {
    const [currentLeague, setCurrentLeague] = useState('LCK');
    const [viewMode, setViewMode] = useState('regular'); // 'regular' | 'playoff'

    const isLCK = currentLeague === 'LCK';
    const activeTeams = isLCK ? teams : (FOREIGN_LEAGUES[currentLeague] || []);
    
    // [THE FIX] Pre-calculate the exact Final Standings here so the Stats Engine uses the right Multipliers!
    const activeLeagueData = useMemo(() => {
        if (isLCK) return league;

        const foreignMatches = league.foreignMatches?.[currentLeague] || [];
        let customFinalStandingsNames = [];

        if (foreignMatches.length > 0) {
            const currentTeams = FOREIGN_LEAGUES[currentLeague] || [];
            const getLoser = (id) => {
                const m = foreignMatches.find(x => x.id === id);
                if (!m || !m.result?.winner) return null;
                const t1 = getGlobalTeam(m.t1, currentTeams)?.name || m.t1;
                const t2 = getGlobalTeam(m.t2, currentTeams)?.name || m.t2;
                return m.result.winner === t1 ? t2 : t1;
            };
            const getWinner = (id) => {
                const m = foreignMatches.find(x => x.id === id);
                return m?.result?.winner || null;
            };
            const getWinnerByRound = (r, mNum) => foreignMatches.find(x => x.round === r && x.match === mNum)?.result?.winner;
            const getLoserByRound = (r, mNum) => {
                const m = foreignMatches.find(x => x.round === r && x.match === mNum);
                if (!m || !m.result?.winner) return null;
                const t1 = getGlobalTeam(m.t1, currentTeams)?.name || m.t1;
                const t2 = getGlobalTeam(m.t2, currentTeams)?.name || m.t2;
                return m.result.winner === t1 ? t2 : t1;
            };

            const st = {};
            currentTeams.forEach(t => st[t.name] = { w: 0, l: 0, diff: 0, h2h: {}, defeatedOpponents: [], team: t });

            foreignMatches.filter(m => (m.type === 'regular' || m.type === 'super') && m.status === 'finished').forEach(m => {
                const winner = m.result?.winner;
                const t1 = getGlobalTeam(m.t1, currentTeams)?.name || m.t1;
                const t2 = getGlobalTeam(m.t2, currentTeams)?.name || m.t2;
                const loser = winner === t1 ? t2 : t1;
                let diff = 0;
                if (m.result?.score) {
                    const pts = String(m.result.score).split(/[-:]/).map(Number);
                    if (pts.length === 2 && !isNaN(pts[0]) && !isNaN(pts[1])) diff = Math.abs(pts[0] - pts[1]);
                }
                if (st[winner]) {
                    st[winner].w++; st[winner].diff += diff; st[winner].defeatedOpponents.push(loser);
                    if (!st[winner].h2h[loser]) st[winner].h2h[loser] = { w: 0, l: 0 };
                    st[winner].h2h[loser].w += 1;
                }
                if (st[loser]) {
                    st[loser].l++; st[loser].diff -= diff;
                    if (!st[loser].h2h[winner]) st[loser].h2h[winner] = { w: 0, l: 0 };
                    st[loser].h2h[winner].l += 1;
                }
            });

            const tiedGroups = {};
            Object.values(st).forEach(rec => {
                const key = `${rec.w}_${rec.diff}`;
                if (!tiedGroups[key]) tiedGroups[key] = [];
                tiedGroups[key].push(rec.team.name);
            });

            const regSorted = Object.values(st).sort((a,b) => {
                if (b.w !== a.w) return b.w - a.w; 
                if (b.diff !== a.diff) return b.diff - a.diff; 
                const tieKey = `${a.w}_${a.diff}`;
                const tiedCount = tiedGroups[tieKey]?.length || 0;
                if (tiedCount === 2) {
                    const aWinsVsB = a.h2h[b.team.name]?.w || 0;
                    const bWinsVsA = b.h2h[a.team.name]?.w || 0;
                    if (aWinsVsB !== bWinsVsA) return bWinsVsA - aWinsVsB;
                }
                let sovWinsA = 0, sovDiffA = 0;
                a.defeatedOpponents.forEach(opp => { sovWinsA += (st[opp]?.w || 0); sovDiffA += (st[opp]?.diff || 0); });
                let sovWinsB = 0, sovDiffB = 0;
                b.defeatedOpponents.forEach(opp => { sovWinsB += (st[opp]?.w || 0); sovDiffB += (st[opp]?.diff || 0); });
                if (sovWinsB !== sovWinsA) return sovWinsB - sovWinsA;
                if (sovDiffB !== sovDiffA) return sovDiffB - sovDiffA;
                return 0;
            });

            if (currentLeague === 'LCS') {
                const lcsRanks = [];
                const addRank = (tName) => { if (tName) lcsRanks.push(tName); };

                addRank(getWinner('lcs_po8'));
                addRank(getLoser('lcs_po8'));
                addRank(getLoser('lcs_po7'));
                addRank(getLoser('lcs_po6'));

                const r1L1 = getLoser('lcs_po4');
                const r1L2 = getLoser('lcs_po5');
                const fifthSixth = [r1L1, r1L2].filter(Boolean).sort((a, b) => {
                    return regSorted.findIndex(x => x.team.name === a) - regSorted.findIndex(x => x.team.name === b); 
                });
                fifthSixth.forEach(tName => addRank(tName));
                addRank(getLoser('lcs_pi1'));

                const alreadyPlaced = new Set(lcsRanks);
                regSorted.filter(x => x.team && !alreadyPlaced.has(x.team.name)).forEach(r => lcsRanks.push(r.team.name));
                customFinalStandingsNames = lcsRanks;
                
            } else if (currentLeague === 'CBLOL') {
                const cblolRanks = [];
                const addRank = (tName) => { if (tName) cblolRanks.push(tName); };
                
                addRank(getWinner('cblol_po10'));
                addRank(getLoser('cblol_po10'));
                addRank(getLoser('cblol_po9'));
                addRank(getLoser('cblol_po8'));
                addRank(getLoser('cblol_po7'));
                addRank(getLoser('cblol_po6'));

                const alreadyPlaced = new Set(cblolRanks);
                regSorted.filter(x => x.team && !alreadyPlaced.has(x.team.name)).forEach(r => cblolRanks.push(r.team.name));
                customFinalStandingsNames = cblolRanks;

            } else if (currentLeague === 'LCP') {
                const lcpRanks = [];
                const addRank = (tName) => { if (tName) lcpRanks.push(tName); };
                
                addRank(getWinnerByRound(4, 1));
                addRank(getLoserByRound(4, 1));
                addRank(getLoserByRound(3.1, 1));
                addRank(getLoserByRound(2.1, 1));

                const r1L1 = getLoserByRound(1, 1);
                const r1L2 = getLoserByRound(1, 2);
                const fifthSixth = [r1L1, r1L2].filter(Boolean).sort((a, b) => {
                    return regSorted.findIndex(x => x.team.name === a) - regSorted.findIndex(x => x.team.name === b); 
                });
                fifthSixth.forEach(tName => addRank(tName));

                const alreadyPlaced = new Set(lcpRanks);
                regSorted.filter(x => x.team && !alreadyPlaced.has(x.team.name)).forEach(r => lcpRanks.push(r.team.name));
                customFinalStandingsNames = lcpRanks;
            }
        }

        return {
            ...league,
            matches: foreignMatches,
            standings: league.foreignStandings?.[currentLeague] || {},
            finalStandings: customFinalStandingsNames.length > 0 ? customFinalStandingsNames : (league.finalStandings || []),
            seasonSummary: {
                ...league.seasonSummary,
                finalStandings: customFinalStandingsNames.length > 0 ? customFinalStandingsNames : league.seasonSummary?.finalStandings
            }
        };
    }, [league, currentLeague, isLCK, activeTeams]);

    const isPlayoffsFinished = useMemo(() => {
        if (!activeLeagueData.matches) return false;
        const playoffs = activeLeagueData.matches.filter(m => m.type === 'playoff');
        if (playoffs.length === 0) return false;

        const explicitFinal = playoffs.find(m => 
            m.round === 5 || 
            String(m.round) === "5" || 
            (currentLeague === 'LCP' && m.round === 4) ||
            (currentLeague === 'LCS' && m.id === 'lcs_po8') || // Explicitly ensure LCS finals detection!
            (m.label && (m.label.includes('결승') || m.label.toUpperCase().includes('FINAL')))
        );

        if (explicitFinal) {
            return explicitFinal.status === 'finished';
        }

        return playoffs.every(m => m.status === 'finished');
    }, [activeLeagueData, currentLeague]);

    const regularData = useMemo(() => computeAwards(activeLeagueData, activeTeams), [activeLeagueData, activeTeams]);
    const playoffData = useMemo(() => isPlayoffsFinished ? computePlayoffAwards(activeLeagueData, activeTeams) : null, [activeLeagueData, activeTeams, isPlayoffsFinished]);

    const activeData = (viewMode === 'playoff' && playoffData) ? playoffData : regularData;
    const titlePrefix = currentLeague === 'LCK' ? 'LCK' : currentLeague;

    return (
        <div className="p-2 lg:p-6 max-w-7xl mx-auto space-y-8">
            
            <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 rounded-lg mb-4">
                {['LCK', 'LPL', 'LEC', 'LCS', 'LCP', 'CBLOL'].map(lg => (
                    <button
                        key={lg}
                        onClick={() => {
                            setCurrentLeague(lg);
                            setViewMode('regular'); 
                        }}
                        className={`px-5 py-2 rounded-full font-bold text-xs lg:text-sm transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                            currentLeague === lg
                            ? 'bg-blue-600 text-white ring-2 ring-blue-300 transform scale-105'
                            : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-300'
                        }`}
                    >
                        {lg}
                    </button>
                ))}
            </div>

            <div className="flex flex-col items-center justify-center gap-4">
                <div className="text-center space-y-1">
                    <h2 className="text-3xl lg:text-4xl font-black text-gray-900 uppercase tracking-tighter">
                        <span className="text-blue-600">2026</span> {titlePrefix} Awards
                    </h2>
                    <p className="text-gray-500 text-sm font-medium">
                        {viewMode === 'playoff' ? 'Playoffs & Finals Performance' : 'Regular Season Performance'}
                    </p>
                </div>

                {isPlayoffsFinished && (
                    <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                        <button onClick={() => setViewMode('regular')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'regular' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>정규 시즌</button>
                        <button onClick={() => setViewMode('playoff')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'playoff' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>플레이오프</button>
                    </div>
                )}
            </div>

            {!activeData || (!activeData.seasonMvp && viewMode === 'regular') || (!activeData.pogLeader && viewMode === 'playoff') ? (
                <div className="flex flex-col items-center justify-center bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200 py-20 text-gray-400">
                    <div className="text-5xl mb-4 opacity-50">🏆</div>
                    <div className="text-xl font-bold">수상자 데이터 없음</div>
                    <p className="mt-2 text-sm">{currentLeague} {viewMode === 'playoff' ? '플레이오프' : '시즌'} 경기가 충분히 진행되지 않았습니다.</p>
                </div>
            ) : (
                <>
                    <div className="w-full">
                        {viewMode === 'regular' ? (
                            <MvpShowcaseCard 
                                player={activeData.seasonMvp} 
                                title="SEASON MVP" 
                                badgeColor="bg-yellow-500 text-black" 
                                lckTeams={teams} 
                                size="large"
                            />
                        ) : (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 max-w-5xl mx-auto">
                                <MvpShowcaseCard 
                                    player={activeData.pogLeader} 
                                    title="PLAYOFF MVP" 
                                    badgeColor="bg-green-400 text-black" 
                                    lckTeams={teams} 
                                    size="medium"
                                />
                                 <MvpShowcaseCard 
                                    player={activeData.finalsMvp} 
                                    title="FINALS MVP" 
                                    badgeColor="bg-blue-400 text-black" 
                                    lckTeams={teams} 
                                    size="medium"
                                />
                            </div>
                        )}
                    </div>

                    <div>
                        <TeamSection title={viewMode === 'playoff' ? `All-${titlePrefix} Playoff 1st Team` : `All-${titlePrefix} 1st Team`} rank={1} players={activeData.allProTeams?.[1]} lckTeams={teams} />
                        <TeamSection title={viewMode === 'playoff' ? `All-${titlePrefix} Playoff 2nd Team` : `All-${titlePrefix} 2nd Team`} rank={2} players={activeData.allProTeams?.[2]} lckTeams={teams} />
                        <TeamSection title={viewMode === 'playoff' ? `All-${titlePrefix} Playoff 3rd Team` : `All-${titlePrefix} 3rd Team`} rank={3} players={activeData.allProTeams?.[3]} lckTeams={teams} />
                    </div>
                </>
            )}
        </div>
    );
}