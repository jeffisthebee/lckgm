// src/components/StandingsTab.jsx
import React, { useState, useMemo } from 'react';
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
    computedStandings, 
    setViewingTeamId, 
    hasDrafted, 
    baronTotalWins, 
    elderTotalWins 
}) => {
    const [currentLeague, setCurrentLeague] = useState('LCK');

    // [FIX 2] Robust Score Parser - Handles "-", ":", and spaces to ensure Schedule & Standings match!
    const getScoreDiff = (scoreStr) => {
        if (!scoreStr || typeof scoreStr !== 'string') return 0;
        // Split by either hyphen or colon and trim whitespace
        const parts = scoreStr.split(/[-:]/).map(s => parseInt(s.trim()));
        if (parts.length !== 2 || isNaN(parts[0]) || isNaN(parts[1])) return 0;
        
        // Differential is (Winner Score - Loser Score)
        // Since the winner is already identified, we just need the magnitude of the victory
        return Math.abs(parts[0] - parts[1]);
    };

    // Live Dynamic Standings Calculator for Foreign Leagues
    const foreignStandings = useMemo(() => {
        if (currentLeague === 'LCK') return {};
        
        const matches = league.foreignMatches?.[currentLeague] || [];
        const tArray = FOREIGN_LEAGUES[currentLeague] || [];
        const st = {};
        
        // Initialize all teams in the league
        tArray.forEach(t => {
            st[t.name] = { w: 0, l: 0, diff: 0, ...t };
        });

        // Compute from regular season matches that are actually finished
        const regularMatches = matches.filter(m => (m.type === 'regular' || m.type === 'super') && m.status === 'finished');
        
        regularMatches.forEach(m => {
            if (!m.result || !m.result.winner || !m.result.score) return;
            
            const winnerName = m.result.winner;
            // Standardize identification of Team 1 and Team 2 names
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
            }
            if (st[loserName]) {
                st[loserName].l += 1;
                st[loserName].diff -= diffValue;
            }
        });
        
        return st;
    }, [currentLeague, league.foreignMatches]);

    const renderForeignTable = (groupName, teamsArray, colorTheme, isCompact = false) => {
        // Sort by Match Wins, then by Game Differential
        const sortedTeams = [...teamsArray].sort((a, b) => {
            const recA = foreignStandings[a.name] || { w: 0, l: 0, diff: 0 };
            const recB = foreignStandings[b.name] || { w: 0, l: 0, diff: 0 };
            if (recB.w !== recA.w) return recB.w - recA.w;
            if (recB.diff !== recA.diff) return recB.diff - recA.diff;
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
                                
                                // [FIX 1] Seeding badges are now STRICTLY for LCP only
                                let statusBadge = null;
                                if (currentLeague === 'LCP') {
                                    if (idx < 6) {
                                        statusBadge = <span className="block sm:inline text-[10px] sm:text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded sm:ml-2 mt-1 sm:mt-0 font-bold w-fit whitespace-nowrap">PO {idx + 1}시드</span>;
                                    } else {
                                        const matches = league.foreignMatches?.[currentLeague] || [];
                                        const totalRegular = matches.filter(m => (m.type === 'regular' || m.type === 'super')).length;
                                        const finishedRegular = matches.filter(m => (m.type === 'regular' || m.type === 'super') && m.status === 'finished').length;
                                        if (totalRegular > 0 && totalRegular === finishedRegular) {
                                             statusBadge = <span className="block sm:inline text-[10px] sm:text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded sm:ml-2 mt-1 sm:mt-0 font-bold w-fit whitespace-nowrap">탈락</span>;
                                        }
                                    }
                                }

                                return (
                                    <tr key={t.id || t.name} className="hover:bg-gray-50 transition">
                                        <td className={`py-2 ${pxClass} text-center font-bold text-gray-600`}>{idx + 1}</td>
                                        <td className={`py-2 ${pxClass} font-bold text-gray-800`}>
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full text-white text-[8px] sm:text-[10px] flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: teamColor }}>{t.name.slice(0,3)}</div>
                                                <span className="truncate max-w-[60px] sm:max-w-full">{t.fullName || t.name}</span>
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

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
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

            <h2 className="text-xl sm:text-2xl font-black text-gray-900 flex items-center gap-2">
                🏆 2026 {currentLeague} {LEAGUE_TITLES[currentLeague]} 순위표
            </h2>

            {currentLeague === 'LCK' && (
                hasDrafted ? (
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
                                                    )
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-lg border shadow-sm p-4 sm:p-8 text-center text-gray-500 text-sm sm:text-base">
                        아직 시즌이 시작되지 않았습니다. 조 추첨을 완료해주세요.
                    </div>
                )
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