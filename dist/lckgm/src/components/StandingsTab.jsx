// src/components/StandingsTab.jsx
import React, { useState, useMemo, useEffect } from 'react';
import { sortGroupByStandings } from '../engine/BracketManager';

// Import global data
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';
import { TEAM_COLORS } from '../data/constants';

const LEAGUE_TITLES = {
    'LCK': '컵',
    'LPL': '스플릿 1',
    'LCP': '스플릿 1',
    'LEC': '버서스',
    'LCS': '락 인',
    'CBLOL': '레전드 컵'
};

const StandingsTab = ({ 
    league, 
    teams, 
    myTeam, 
    myLeague: myLeagueProp,
    computedStandings, 
    setViewingTeamId, 
    hasDrafted, 
    baronTotalWins, 
    elderTotalWins 
}) => {
    const myLeague = myLeagueProp || 'LCK';
    const isMyLeagueForeign = myLeague !== 'LCK';
    const [currentLeague, setCurrentLeague] = useState(myLeague);

    // Detect LCK Split 1 matches
    const hasLCKSplit1 = useMemo(() =>
        !!(league?.matches?.some(m => m.type === 'lck_split1_regular')),
    [league?.matches]);

    // Sub-view toggle for LCK: 'cup' | 'split1'
    // Default to split1 when it exists
    const [lckSubView, setLckSubView] = useState(() => hasLCKSplit1 ? 'split1' : 'cup');

    // Sync lckSubView default when split1 is first created
    useEffect(() => {
        if (hasLCKSplit1 && lckSubView === 'cup') {
            setLckSubView('split1');
        }
    }, [hasLCKSplit1]);

    // ── LCK Split 1 standings computation ──────────────────────────────────
    const split1Standings = useMemo(() => {
        const split1Matches = (league?.matches || []).filter(
            m => m.type === 'lck_split1_regular' && m.status === 'finished'
        );
        const st = {};
        teams.forEach(t => {
            st[t.id] = { w: 0, l: 0, diff: 0, h2h: {}, defeatedOpponents: [] };
        });

        split1Matches.forEach(m => {
            if (!m.result?.winner || !m.result?.score) return;
            const getId = v => (typeof v === 'object' ? v.id : Number(v));
            const t1Id = getId(m.t1);
            const t2Id = getId(m.t2);
            const t1 = teams.find(t => t.id === t1Id);
            const t2 = teams.find(t => t.id === t2Id);
            if (!t1 || !t2) return;

            const wName = m.result.winner;
            const winnerId  = t1.name === wName ? t1Id : t2Id;
            const loserId   = t1.name === wName ? t2Id : t1Id;

            let diffVal = 0;
            const parts = String(m.result.score).split(/[-:]/).map(Number);
            if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
                diffVal = Math.abs(parts[0] - parts[1]);
            }

            if (st[winnerId]) {
                st[winnerId].w++;
                st[winnerId].diff += diffVal;
                st[winnerId].defeatedOpponents.push(loserId);
                if (!st[winnerId].h2h[loserId]) st[winnerId].h2h[loserId] = { w: 0, l: 0 };
                st[winnerId].h2h[loserId].w++;
            }
            if (st[loserId]) {
                st[loserId].l++;
                st[loserId].diff -= diffVal;
                if (!st[loserId].h2h[winnerId]) st[loserId].h2h[winnerId] = { w: 0, l: 0 };
                st[loserId].h2h[winnerId].l++;
            }
        });

        return st;
    }, [league?.matches, teams]);

    // ── Sorted Split 1 standings (all 10 teams) ─────────────────────────────
    const split1Sorted = useMemo(() => {
        if (!hasLCKSplit1) return [];
        return [...teams].sort((a, b) => {
            const recA = split1Standings[a.id] || { w: 0, l: 0, diff: 0, h2h: {}, defeatedOpponents: [] };
            const recB = split1Standings[b.id] || { w: 0, l: 0, diff: 0, h2h: {}, defeatedOpponents: [] };

            if (recB.w !== recA.w) return recB.w - recA.w;
            if (recB.diff !== recA.diff) return recB.diff - recA.diff;

            // Head-to-head tiebreaker (2-team ties only)
            const aWvsB = recA.h2h[b.id]?.w || 0;
            const bWvsA = recB.h2h[a.id]?.w || 0;
            if (aWvsB !== bWvsA) return bWvsA - aWvsB;

            // Strength of victory
            let sovA = 0, sovB = 0;
            (recA.defeatedOpponents || []).forEach(id => { sovA += (split1Standings[id]?.w || 0); });
            (recB.defeatedOpponents || []).forEach(id => { sovB += (split1Standings[id]?.w || 0); });
            return sovB - sovA;
        });
    }, [hasLCKSplit1, split1Standings, teams]);

    const getScoreDiff = (scoreStr) => {
        if (!scoreStr || typeof scoreStr !== 'string') return 0;
        const parts = scoreStr.split(/[-:]/).map(s => parseInt(s.trim()));
        if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return 0;
        return Math.abs(parts[0] - parts[1]);
    };

    const foreignStandings = useMemo(() => {
        if (currentLeague === 'LCK') return {};
        
        const matches = league.foreignMatches?.[currentLeague] || [];
        const tArray = FOREIGN_LEAGUES[currentLeague] || [];
        const st = {};
        
        tArray.forEach(t => { 
            st[t.name] = { w: 0, l: 0, diff: 0, h2h: {}, defeatedOpponents: [], ...t }; 
        });

        const regularMatches = matches.filter(m => (m.type === 'regular' || m.type === 'super') && m.status === 'finished');
        
        regularMatches.forEach(m => {
            if (!m.result || !m.result.winner || !m.result.score) return;
            const winnerName = m.result.winner;
            const team1 = tArray.find(t => t.id === m.t1 || t.name === m.t1);
            const team2 = tArray.find(t => t.id === m.t2 || t.name === m.t2);
            if (!team1 || !team2) return;
            
            const t1Name = team1.name;
            const t2Name = team2.name;
            const loserName = winnerName === t1Name ? t2Name : t1Name;
            const diffValue = getScoreDiff(m.result.score);

            if (st[winnerName]) { 
                st[winnerName].w += 1; 
                st[winnerName].diff += diffValue; 
                st[winnerName].defeatedOpponents.push(loserName);
                if (!st[winnerName].h2h[loserName]) st[winnerName].h2h[loserName] = { w: 0, l: 0 };
                st[winnerName].h2h[loserName].w += 1;
            }
            if (st[loserName]) { 
                st[loserName].l += 1; 
                st[loserName].diff -= diffValue; 
                if (!st[loserName].h2h[winnerName]) st[loserName].h2h[winnerName] = { w: 0, l: 0 };
                st[loserName].h2h[winnerName].l += 1;
            }
        });
        
        return st;
    }, [currentLeague, league.foreignMatches]);

    const renderForeignTable = (groupName, teamsArray, colorTheme, isCompact = false) => {
        const tiedGroups = {};
        teamsArray.forEach(t => {
            const rec = foreignStandings[t.name] || { w: 0, l: 0, diff: 0 };
            const key = `${rec.w}_${rec.diff}`;
            if (!tiedGroups[key]) tiedGroups[key] = [];
            tiedGroups[key].push(t.name);
        });

        const sortedTeams = [...teamsArray].sort((a, b) => {
            const recA = foreignStandings[a.name] || { w: 0, l: 0, diff: 0, h2h: {}, defeatedOpponents: [] };
            const recB = foreignStandings[b.name] || { w: 0, l: 0, diff: 0, h2h: {}, defeatedOpponents: [] };
            
            if (recB.w !== recA.w) return recB.w - recA.w;
            if (recB.diff !== recA.diff) return recB.diff - recA.diff;
            
            const tieKey = `${recA.w}_${recA.diff}`;
            const tiedCount = tiedGroups[tieKey]?.length || 0;

            if (tiedCount === 2) {
                const aWinsVsB = recA.h2h[b.name]?.w || 0;
                const bWinsVsA = recB.h2h[a.name]?.w || 0;
                if (aWinsVsB !== bWinsVsA) return bWinsVsA - aWinsVsB;
            }

            let sovWinsA = 0, sovDiffA = 0;
            (recA.defeatedOpponents || []).forEach(opp => {
                sovWinsA += (foreignStandings[opp]?.w || 0);
                sovDiffA += (foreignStandings[opp]?.diff || 0);
            });

            let sovWinsB = 0, sovDiffB = 0;
            (recB.defeatedOpponents || []).forEach(opp => {
                sovWinsB += (foreignStandings[opp]?.w || 0);
                sovDiffB += (foreignStandings[opp]?.diff || 0);
            });

            if (sovWinsB !== sovWinsA) return sovWinsB - sovWinsA;
            if (sovDiffB !== sovDiffA) return sovDiffB - sovDiffA;
            return 0;
        });

        const pxClass = isCompact ? "px-1 sm:px-2" : "px-2 sm:px-4";

        return (
            <div className="bg-white rounded-lg border shadow-sm overflow-hidden mb-4 sm:mb-6">
                <div className={`p-2 sm:p-3 bg-${colorTheme}-50 border-b border-${colorTheme}-100 flex items-center gap-2`}>
                    <h3 className={`font-black text-sm sm:text-base text-${colorTheme}-900`}>{groupName}</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-[10px] sm:text-xs">
                        <thead className="bg-gray-50 text-gray-500 font-bold border-b">
                            <tr>
                                <th className={`py-2 ${pxClass} text-center whitespace-nowrap`}>순위</th>
                                <th className={`py-2 ${pxClass} text-left w-full`}>팀</th>
                                <th className={`py-2 ${pxClass} text-center whitespace-nowrap`}>승</th>
                                <th className={`py-2 ${pxClass} text-center whitespace-nowrap`}>패</th>
                                <th className={`py-2 ${pxClass} text-center whitespace-nowrap`}>득실</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {sortedTeams.map((t, idx) => {
                                const rec = foreignStandings[t.name] || { w: 0, l: 0, diff: 0 };
                                const teamColor = TEAM_COLORS[t.name] || t.colors?.primary || '#333';
                                
                                let statusBadge = null;
                                const matches = league.foreignMatches?.[currentLeague] || [];

                                if (['LPL', 'LCP', 'CBLOL', 'LCS', 'LEC'].includes(currentLeague)) {
                                    const finalMatchId = {
                                        'LPL':   'lpl_po14',
                                        'LCP':   'lcp_po8',
                                        'CBLOL': 'cblol_po10',
                                        'LCS':   'lcs_po8',
                                        'LEC':   'lec_po_final',
                                    }[currentLeague];
                                    const finalMatch = matches.find(m => m.id === finalMatchId);
                                    
                                    let isChampion = false;
                                    let isRunnerUp = false;
                                    
                                    if (finalMatch && finalMatch.status === 'finished' && finalMatch.result?.winner) {
                                        const currentTeams = FOREIGN_LEAGUES[currentLeague] || [];
                                        const t1Obj = currentTeams.find(x => x.id === finalMatch.t1 || x.name === finalMatch.t1);
                                        const t2Obj = currentTeams.find(x => x.id === finalMatch.t2 || x.name === finalMatch.t2);
                                        const t1Name = t1Obj ? t1Obj.name : finalMatch.t1;
                                        const t2Name = t2Obj ? t2Obj.name : finalMatch.t2;
                                        
                                        isChampion = finalMatch.result.winner === t.name || finalMatch.result.winner === t.id;
                                        
                                        const runnerUpName = (finalMatch.result.winner === t1Name || finalMatch.result.winner === t1Obj?.id) ? t2Name : t1Name;
                                        isRunnerUp = runnerUpName === t.name || runnerUpName === t.id;
                                    }

                                    const isFST = (currentLeague === 'LPL') ? (isChampion || isRunnerUp) : isChampion;
                                    const fstBadge = isFST ? <span className="text-[10px] sm:text-xs bg-purple-100 text-purple-700 border border-purple-300 px-1.5 py-0.5 rounded font-black whitespace-nowrap shadow-sm">FST 진출</span> : null;

                                    const totalRegular = matches.filter(m => (m.type === 'regular' || m.type === 'super')).length;
                                    const finishedRegular = matches.filter(m => (m.type === 'regular' || m.type === 'super') && m.status === 'finished').length;
                                    const isRegFinished = totalRegular > 0 && totalRegular === finishedRegular;

                                    const wrapBadge = (seedBadge) => {
                                        if (!seedBadge && !fstBadge) return null;
                                        return (
                                            <div className="flex items-center gap-1 sm:ml-2 mt-1 sm:mt-0">
                                                {seedBadge}
                                                {fstBadge}
                                            </div>
                                        );
                                    };

                                    if (currentLeague === 'LPL') {
                                        if (groupName.includes('등봉조')) {
                                            if (idx < 4) statusBadge = wrapBadge(<span className="text-[10px] sm:text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">PO {idx + 1}시드</span>);
                                            else statusBadge = wrapBadge(<span className="text-[10px] sm:text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">PI {idx - 3}시드</span>);
                                        } else if (groupName.includes('인내조')) {
                                            statusBadge = wrapBadge(<span className="text-[10px] sm:text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">PI {idx + 3}시드</span>);
                                        } else if (groupName.includes('열반조')) {
                                            if (idx < 2) statusBadge = wrapBadge(<span className="text-[10px] sm:text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">PI {idx + 7}시드</span>);
                                            else {
                                                const elimBadge = isRegFinished ? <span className="text-[10px] sm:text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">탈락</span> : null;
                                                statusBadge = wrapBadge(elimBadge);
                                            }
                                        }
                                    } else if (currentLeague === 'LCP') {
                                        if (idx < 6) statusBadge = wrapBadge(<span className="text-[10px] sm:text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">PO {idx + 1}시드</span>);
                                        else {
                                            const elimBadge = isRegFinished ? <span className="text-[10px] sm:text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">탈락</span> : null;
                                            statusBadge = wrapBadge(elimBadge);
                                        }
                                    } else if (currentLeague === 'CBLOL') {
                                        if (idx < 4) statusBadge = wrapBadge(<span className="text-[10px] sm:text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">PO {idx + 1}시드</span>);
                                        else if (idx < 8) statusBadge = wrapBadge(<span className="text-[10px] sm:text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">PI {idx + 1}시드</span>);
                                        else {
                                            const elimBadge = isRegFinished ? <span className="text-[10px] sm:text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">탈락</span> : null;
                                            statusBadge = wrapBadge(elimBadge);
                                        }
                                    } else if (currentLeague === 'LCS') {
                                        if (idx < 5) statusBadge = wrapBadge(<span className="text-[10px] sm:text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">PO {idx + 1}시드</span>);
                                        else if (idx < 7) statusBadge = wrapBadge(<span className="text-[10px] sm:text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">PI {idx + 1}시드</span>);
                                        else {
                                            const elimBadge = isRegFinished ? <span className="text-[10px] sm:text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">탈락</span> : null;
                                            statusBadge = wrapBadge(elimBadge);
                                        }
                                    } else if (currentLeague === 'LEC') {
                                        if (idx < 8) statusBadge = wrapBadge(<span className="text-[10px] sm:text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">PO {idx + 1}시드</span>);
                                        else {
                                            const elimBadge = isRegFinished ? <span className="text-[10px] sm:text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded font-bold whitespace-nowrap">탈락</span> : null;
                                            statusBadge = wrapBadge(elimBadge);
                                        }
                                    }
                                }

                                return (
                                    <tr key={t.id || t.name} className={`transition ${t.name === myTeam?.name ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`}>
                                        <td className={`py-2 ${pxClass} text-center font-bold text-gray-600`}>{idx + 1}</td>
                                        <td className={`py-2 ${pxClass} font-bold ${t.name === myTeam?.name ? 'text-blue-700' : 'text-gray-800'}`}>
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full text-white text-[8px] sm:text-[10px] flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: teamColor }}>{t.name.slice(0,3)}</div>
                                                <span className="truncate max-w-[60px] sm:max-w-full">{t.fullName || t.name}</span>
                                                {t.name === myTeam?.name && <span className="text-[9px] font-black text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">나의 팀</span>}
                                                {statusBadge}
                                            </div>
                                        </td>
                                        <td className={`py-2 ${pxClass} text-center font-bold text-blue-600`}>{rec.w}</td>
                                        <td className={`py-2 ${pxClass} text-center font-bold text-red-600`}>{rec.l}</td>
                                        <td className={`py-2 ${pxClass} text-center text-gray-500`}>{rec.diff > 0 ? `+${rec.diff}` : rec.diff}</td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    const renderLPL = () => {
        const lplTeams = FOREIGN_LEAGUES['LPL'] || [];
        const groups = {
            '등봉조': ['AL', 'BLG', 'WBG', 'JDG', 'TES', 'IG'],
            '인내조': ['NIP', 'WE', 'EDG', 'TT'],
            '열반조': ['LNG', 'OMG', 'LGD', 'UP']
        };

        const groupedTeams = { '등봉조': [], '인내조': [], '열반조': [] };
        lplTeams.forEach(t => {
            if (groups['등봉조'].includes(t.name)) groupedTeams['등봉조'].push(t);
            else if (groups['인내조'].includes(t.name)) groupedTeams['인내조'].push(t);
            else if (groups['열반조'].includes(t.name)) groupedTeams['열반조'].push(t);
            else groupedTeams['열반조'].push(t); 
        });

        return (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-4">
                {renderForeignTable('등봉조 (Top)', groupedTeams['등봉조'], 'red', true)}
                {renderForeignTable('인내조 (Mid)', groupedTeams['인내조'], 'blue', true)}
                {renderForeignTable('열반조 (Bot)', groupedTeams['열반조'], 'gray', true)}
            </div>
        );
    };

    // ── LCK Split 1 두 그룹 렌더링 ───────────────────────────────────────────
    const renderSplit1Group = (groupName, groupColor, groupTeams, globalOffset) => {
        const headerStyles = {
            legend: 'bg-gradient-to-r from-yellow-500 to-amber-400 text-white',
            rise:   'bg-gradient-to-r from-blue-600 to-indigo-500 text-white',
        };
        const headerCls = groupColor === 'legend' ? headerStyles.legend : headerStyles.rise;

        const split1MatchCount = (league?.matches || []).filter(m => m.type === 'lck_split1_regular').length;
        const split1FinishedCount = (league?.matches || []).filter(m => m.type === 'lck_split1_regular' && m.status === 'finished').length;
        const split1AllDone = split1MatchCount > 0 && split1MatchCount === split1FinishedCount;

        return (
            <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
                {/* Group header */}
                <div className={`px-4 py-3 ${headerCls} flex items-center gap-3`}>
                    <span className="text-xl">{groupColor === 'legend' ? '👑' : '⚡'}</span>
                    <div>
                        <h3 className="font-black text-base sm:text-lg leading-tight">{groupName}</h3>
                        <p className="text-[10px] sm:text-xs opacity-80 font-medium">
                            {groupColor === 'legend' ? '1~5위 — 플레이오프 직행' : '6~10위 — 강등 위기'}
                        </p>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-xs sm:text-sm">
                        <thead className="bg-gray-50 text-gray-500 font-bold border-b">
                            <tr>
                                <th className="py-2 px-2 sm:py-3 sm:px-4 text-center whitespace-nowrap">순위</th>
                                <th className="py-2 px-2 sm:py-3 sm:px-4 text-left w-full">팀</th>
                                <th className="py-2 px-2 sm:py-3 sm:px-4 text-center whitespace-nowrap">승</th>
                                <th className="py-2 px-2 sm:py-3 sm:px-4 text-center whitespace-nowrap">패</th>
                                <th className="py-2 px-2 sm:py-3 sm:px-4 text-center whitespace-nowrap">득실</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {groupTeams.map((t, localIdx) => {
                                const globalRank = globalOffset + localIdx + 1;
                                const isMyTeam = myTeam?.id === t.id;
                                const rec = split1Standings[t.id] || { w: 0, l: 0, diff: 0 };

                                // Badge: top 5 = PO 직행, 6-10 = 강등
                                let badge = null;
                                if (split1AllDone) {
                                    if (globalRank <= 5) {
                                        badge = (
                                            <span className="text-[9px] sm:text-[10px] bg-yellow-100 text-yellow-700 border border-yellow-300 px-1.5 py-0.5 rounded font-black whitespace-nowrap ml-1">
                                                PO {globalRank}시드
                                            </span>
                                        );
                                    } else {
                                        badge = (
                                            <span className="text-[9px] sm:text-[10px] bg-red-100 text-red-600 border border-red-200 px-1.5 py-0.5 rounded font-bold whitespace-nowrap ml-1">
                                                강등권
                                            </span>
                                        );
                                    }
                                }

                                return (
                                    <tr
                                        key={t.id}
                                        onClick={() => setViewingTeamId(t.id)}
                                        className={`cursor-pointer transition ${
                                            isMyTeam
                                                ? groupColor === 'legend' ? 'bg-yellow-50 hover:bg-yellow-100' : 'bg-blue-50 hover:bg-blue-100'
                                                : 'hover:bg-gray-50'
                                        }`}
                                    >
                                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center">
                                            <span className={`inline-flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 rounded-full font-black text-xs ${
                                                globalRank === 1 ? 'bg-yellow-400 text-white' :
                                                globalRank === 2 ? 'bg-gray-300 text-gray-700' :
                                                globalRank === 3 ? 'bg-orange-300 text-white' :
                                                'bg-gray-100 text-gray-500'
                                            }`}>
                                                {globalRank}
                                            </span>
                                        </td>
                                        <td className="py-2 px-2 sm:py-3 sm:px-4">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <div
                                                    className="w-6 h-6 sm:w-7 sm:h-7 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[9px] sm:text-[10px] font-bold shadow-sm"
                                                    style={{ backgroundColor: t.colors?.primary || '#333' }}
                                                >
                                                    {t.name}
                                                </div>
                                                <span className={`font-bold truncate ${isMyTeam ? 'text-blue-700' : 'text-gray-800'}`}>
                                                    {t.fullName}
                                                </span>
                                                {isMyTeam && (
                                                    <span className="text-[9px] font-black text-blue-500 bg-blue-100 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                                                        나의 팀
                                                    </span>
                                                )}
                                                {badge}
                                            </div>
                                        </td>
                                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-bold text-blue-600">{rec.w}</td>
                                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-bold text-red-600">{rec.l}</td>
                                        <td className="py-2 px-2 sm:py-3 sm:px-4 text-center text-gray-500">
                                            {rec.diff > 0 ? `+${rec.diff}` : rec.diff}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        );
    };

    // ── LCK Split 1 전체 뷰 ─────────────────────────────────────────────────
    const renderSplit1Standings = () => {
        if (!hasLCKSplit1) {
            return (
                <div className="bg-white rounded-lg border shadow-sm p-8 text-center text-gray-400">
                    <div className="text-4xl mb-3">🏆</div>
                    <p className="font-bold text-base">LCK 정규 시즌 스플릿 1이 아직 시작되지 않았습니다.</p>
                    <p className="text-sm mt-1">FST 토너먼트 종료 후 개막됩니다.</p>
                </div>
            );
        }

        const legendTeams = split1Sorted.slice(0, 5);
        const riseTeams   = split1Sorted.slice(5, 10);

        const split1Total    = (league?.matches || []).filter(m => m.type === 'lck_split1_regular').length;
        const split1Finished = (league?.matches || []).filter(m => m.type === 'lck_split1_regular' && m.status === 'finished').length;

        return (
            <div className="flex flex-col gap-4 sm:gap-6">
                {/* Progress bar */}
                {split1Total > 0 && (
                    <div className="bg-white rounded-lg border shadow-sm p-3 sm:p-4">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-xs sm:text-sm font-bold text-gray-600">시즌 진행 현황</span>
                            <span className="text-xs font-bold text-blue-600">{split1Finished} / {split1Total} 경기</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full transition-all duration-700"
                                style={{ width: `${(split1Finished / split1Total) * 100}%` }}
                            />
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {renderSplit1Group('🏅 레전드 (Legend)', 'legend', legendTeams, 0)}
                    {renderSplit1Group('⚡ 라이즈 (Rise)',   'rise',   riseTeams,   5)}
                </div>
            </div>
        );
    };

    // ── LCK sub-view toggle header ───────────────────────────────────────────
    const renderLCKSubViewToggle = () => {
        if (!hasLCKSplit1) return null;
        const hasCupMatches = (league?.matches || []).some(m => m.type === 'regular' || m.type === 'super' || m.type === 'playoff' || m.type === 'playin');
        if (!hasCupMatches) return null;

        return (
            <div className="flex items-center gap-2 mb-1">
                <button
                    onClick={() => setLckSubView(v => v === 'cup' ? 'split1' : 'cup')}
                    className="p-1 rounded hover:bg-gray-100 text-gray-500 transition"
                    title="이전"
                >
                    ‹
                </button>
                <span className="text-[10px] font-bold text-gray-400 whitespace-nowrap">
                    {lckSubView === 'cup' ? '1 / 2 (LCK 컵)' : '2 / 2 (정규시즌)'}
                </span>
                <button
                    onClick={() => setLckSubView(v => v === 'cup' ? 'split1' : 'cup')}
                    className="p-1 rounded hover:bg-gray-100 text-gray-500 transition"
                    title="다음"
                >
                    ›
                </button>
            </div>
        );
    };

    // ── LCK 컵 view (existing baron/elder logic) ─────────────────────────────
    const renderLCKCup = () => {
        if (!hasDrafted) {
            return (
                <div className="bg-white rounded-lg border shadow-sm p-4 sm:p-8 text-center text-gray-500 text-sm sm:text-base">
                    {isMyLeagueForeign
                        ? 'LCK 일정이 아직 생성되지 않았습니다. 잠시 후 자동으로 생성됩니다.'
                        : '아직 시즌이 시작되지 않았습니다. 조 추첨을 완료해주세요.'}
                </div>
            );
        }

        return (
            <div className="flex flex-col gap-3 sm:gap-4">
                <div className="bg-gray-800 text-white rounded-lg p-3 sm:p-4 text-center font-bold text-sm sm:text-lg shadow-sm">
                    🔥 그룹 대항전 스코어: <span className="text-purple-400 text-lg sm:text-2xl mx-1 sm:mx-2">{baronTotalWins}</span> (Baron) vs <span className="text-red-400 text-lg sm:text-2xl mx-1 sm:mx-2">{elderTotalWins}</span> (Elder)
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                    {[
                        { id: 'baron', name: 'Baron Group', color: 'purple' },
                        { id: 'elder', name: 'Elder Group', color: 'red' }
                    ].map(group => (
                        <div key={group.id} className="bg-white rounded-lg border shadow-sm overflow-hidden">
                            <div className={`p-3 sm:p-4 bg-${group.color}-50 border-b border-${group.color}-100 flex items-center gap-2`}>
                                <h3 className={`font-black text-base sm:text-lg text-${group.color}-900`}>{group.name}</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs sm:text-sm">
                                    <thead className="bg-gray-50 text-gray-500 font-bold border-b">
                                        <tr>
                                            <th className="py-2 px-2 sm:py-3 sm:px-4 text-center whitespace-nowrap">순위</th>
                                            <th className="py-2 px-2 sm:py-3 sm:px-4 text-left w-full">팀</th>
                                            <th className="py-2 px-2 sm:py-3 sm:px-4 text-center whitespace-nowrap">승</th>
                                            <th className="py-2 px-2 sm:py-3 sm:px-4 text-center whitespace-nowrap">패</th>
                                            <th className="py-2 px-2 sm:py-3 sm:px-4 text-center whitespace-nowrap">득실</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {sortGroupByStandings(league.groups[group.id] || [], computedStandings).map((id, idx) => {
                                            const t = teams.find(team => team.id === id);
                                            const isMyTeam = myTeam.id === id;
                                            const rec = computedStandings[id] || { w: 0, l: 0, diff: 0 };

                                            let statusBadge = null;
                                            if (league.seasonSummary) {
                                                const summary = league.seasonSummary;
                                                const poInfo = summary.poTeams?.find(pt => pt.id === id);
                                                const piInfo = summary.playInTeams?.find(pit => pit.id === id);

                                                if (poInfo) statusBadge = <span className="block sm:inline text-[10px] sm:text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded sm:ml-2 mt-1 sm:mt-0 font-bold w-fit whitespace-nowrap">PO {poInfo.seed}시드</span>;
                                                else if (piInfo) statusBadge = <span className="block sm:inline text-[10px] sm:text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded sm:ml-2 mt-1 sm:mt-0 font-bold w-fit whitespace-nowrap">PI {piInfo.seed}시드</span>;
                                                else if (summary.eliminated === id) statusBadge = <span className="block sm:inline text-[10px] sm:text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded sm:ml-2 mt-1 sm:mt-0 font-bold w-fit whitespace-nowrap">탈락</span>;
                                            }

                                            return (
                                                <tr key={id} onClick={() => setViewingTeamId(id)} className={`cursor-pointer hover:bg-gray-50 transition ${isMyTeam ? `bg-${group.color}-50` : ''}`}>
                                                    <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-bold text-gray-600">{idx + 1}</td>
                                                    <td className="py-2 px-2 sm:py-3 sm:px-4 font-bold text-gray-800">
                                                        <div className="flex items-center gap-2">
                                                            <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-full text-white text-[10px] flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: t.colors.primary }}>{t.name}</div>
                                                            <span className="truncate">{t.fullName}</span>
                                                        </div>
                                                        {statusBadge}
                                                    </td>
                                                    <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-bold text-blue-600">{rec.w}</td>
                                                    <td className="py-2 px-2 sm:py-3 sm:px-4 text-center font-bold text-red-600">{rec.l}</td>
                                                    <td className="py-2 px-2 sm:py-3 sm:px-4 text-center text-gray-500">{rec.diff > 0 ? `+${rec.diff}` : rec.diff}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    // ── Title text per LCK sub-view ──────────────────────────────────────────
    const lckTitle = currentLeague === 'LCK'
        ? (lckSubView === 'split1' ? 'LCK 정규시즌 순위표' : 'LCK 컵 순위표')
        : `${currentLeague} ${LEAGUE_TITLES[currentLeague]} 순위표`;

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            {/* League switcher */}
            <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 sticky top-0 z-50 rounded-lg">
                {['LCK', 'LPL', 'LEC', 'LCS', 'LCP', 'CBLOL'].map(lg => (
                    <button
                        key={lg}
                        onClick={() => setCurrentLeague(lg)}
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

            {/* Title row with LCK sub-view toggle */}
            <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                    🏆 2026 {lckTitle}
                </h2>
                {currentLeague === 'LCK' && renderLCKSubViewToggle()}
            </div>

            {/* Content */}
            {currentLeague === 'LCK' && (
                lckSubView === 'split1'
                    ? renderSplit1Standings()
                    : renderLCKCup()
            )}

            {currentLeague === 'LPL' && renderLPL()}

            {['LEC', 'LCS', 'LCP', 'CBLOL'].includes(currentLeague) && (
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                    {renderForeignTable(`${currentLeague} 정규 시즌`, FOREIGN_LEAGUES[currentLeague] || [], 'blue', false)}
                </div>
            )}
        </div>
    );
};

export default StandingsTab;