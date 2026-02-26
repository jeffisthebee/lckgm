// src/components/StandingsTab.jsx
import React, { useState } from 'react';
import { sortGroupByStandings } from '../engine/BracketManager';

// [NEW] Import global data
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
    // League Switcher Memory
    const [currentLeague, setCurrentLeague] = useState('LCK');

    // Helper to build tables for foreign leagues (Added isCompact parameter for LPL)
    const renderForeignTable = (groupName, teamsArray, colorTheme, isCompact = false) => {
        // Sort teams by wins, then point differential
        const sortedTeams = [...teamsArray].sort((a, b) => {
            const recA = league.foreignStandings?.[currentLeague]?.[a.id] || { w: 0, l: 0, diff: 0 };
            const recB = league.foreignStandings?.[currentLeague]?.[b.id] || { w: 0, l: 0, diff: 0 };
            if (recB.w !== recA.w) return recB.w - recA.w;
            if (recB.diff !== recA.diff) return recB.diff - recA.diff;
            return 0;
        });

        // Dynamic padding to squeeze 3 tables side-by-side for LPL
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
                                const rec = league.foreignStandings?.[currentLeague]?.[t.id] || { w: 0, l: 0, diff: 0 };
                                const teamColor = t.colors?.primary || TEAM_COLORS[t.name] || TEAM_COLORS.DEFAULT;
                                return (
                                    <tr key={t.id || t.name} className="hover:bg-gray-50 transition">
                                        <td className={`py-2 ${pxClass} text-center font-bold text-gray-600`}>{idx + 1}</td>
                                        <td className={`py-2 ${pxClass} font-bold text-gray-800`}>
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <div className="w-4 h-4 sm:w-5 sm:h-5 rounded-full text-white text-[8px] sm:text-[10px] flex-shrink-0 flex items-center justify-center" style={{ backgroundColor: teamColor }}>{t.name.slice(0,3)}</div>
                                                <span className="truncate max-w-[60px] sm:max-w-full">{t.fullName || t.name}</span>
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

    // Render Logic for LPL specifically
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
            // [FIXED] Force 3 columns on lg screens and shrink the gap so they all fit nicely
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-2 sm:gap-4">
                {renderForeignTable('등봉조 (Top)', groupedTeams['등봉조'], 'red', true)}
                {renderForeignTable('인내조 (Mid)', groupedTeams['인내조'], 'blue', true)}
                {renderForeignTable('열반조 (Bot)', groupedTeams['열반조'], 'gray', true)}
            </div>
        );
    };

    return (
        <div className="flex flex-col gap-4 sm:gap-6">
            
            {/* The League Switcher Buttons */}
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

            {/* Display LCK (Original View) */}
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

                                                        if (poInfo) statusBadge = <span className="block sm:inline text-[10px] sm:text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded sm:ml-2 mt-1 sm:mt-0 font-bold w-fit">PO {poInfo.seed}시드</span>;
                                                        else if (piInfo) statusBadge = <span className="block sm:inline text-[10px] sm:text-xs bg-indigo-100 text-indigo-700 px-1.5 py-0.5 rounded sm:ml-2 mt-1 sm:mt-0 font-bold w-fit">PI {piInfo.seed}시드</span>;
                                                        else if (summary.eliminated === id) statusBadge = <span className="block sm:inline text-[10px] sm:text-xs bg-gray-200 text-gray-500 px-1.5 py-0.5 rounded sm:ml-2 mt-1 sm:mt-0 font-bold w-fit">탈락</span>;
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

            {/* Display LPL (Custom 3 Groups) */}
            {currentLeague === 'LPL' && renderLPL()}

            {/* Display Other Leagues (Single Group) */}
            {['LEC', 'LCS', 'LCP', 'CBLOL'].includes(currentLeague) && (
                <div className="grid grid-cols-1 gap-4 sm:gap-6">
                    {renderForeignTable(`${currentLeague} 정규 시즌`, FOREIGN_LEAGUES[currentLeague] || [], 'blue', false)}
                </div>
            )}
            
        </div>
    );
};

export default StandingsTab;