// src/components/RosterTab.jsx
import React, { useState } from 'react';
import PlayerProfileModal from './PlayerProfileModal';
import allMastery from '../data/player_mastery/index';

// [NEW] 1. Import all the global teams and player intel!
import { teams as lckTeams } from '../data/teams';
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';

import { TEAM_COLORS } from '../data/constants';
// Import all player JSON files (Make sure these file names match exactly what you have!)
import playersLCK from '../data/players.json';
import playersLPL from '../data/players_lpl.json';
import playersLEC from '../data/players_lec.json';
import playersLCS from '../data/players_lcs.json';
import playersLCP from '../data/players_lcp.json';
import playersCBLOL from '../data/players_cblol.json';

const getOvrBadgeStyle = (ovr) => {
    if (ovr >= 95) return 'bg-red-100 text-red-700 border-red-300 ring-red-200';
    if (ovr >= 90) return 'bg-orange-100 text-orange-700 border-orange-300 ring-orange-200';
    if (ovr >= 85) return 'bg-purple-100 text-purple-700 border-purple-300 ring-purple-200';
    if (ovr >= 80) return 'bg-blue-100 text-blue-700 border-blue-300 ring-blue-200';
    return 'bg-green-100 text-green-700 border-green-300 ring-green-200';
};

const getPotBadgeStyle = (pot) => {
    if (pot >= 95) return 'text-purple-600 font-black'; 
    if (pot >= 90) return 'text-blue-600 font-bold'; 
    return 'text-gray-500 font-medium';
};

const RosterTab = ({ viewingTeam, roster, onPrevTeam, onNextTeam }) => {
    // [NEW] 2. The Memory Boxes (State)
    const [currentLeague, setCurrentLeague] = useState('LCK');
    const [foreignTeamIndex, setForeignTeamIndex] = useState(0);
    const [selectedPlayer, setSelectedPlayer] = useState(null);

    // [NEW] 3. Gather the right teams and players based on the clicked button
    const isLCK = currentLeague === 'LCK';

    const currentTeamsList = isLCK ? lckTeams : (FOREIGN_LEAGUES[currentLeague] || []);
    
    // Safety check so the index doesn't crash if one league has fewer teams
    const safeIndex = foreignTeamIndex >= currentTeamsList.length ? 0 : foreignTeamIndex;
    
    // Decide which team to show (Dashboard's team for LCK, or our local team for foreign)
    const displayTeam = isLCK ? viewingTeam : currentTeamsList[safeIndex];

    const playerMap = {
        LCK: playersLCK,
        LPL: playersLPL,
        LEC: playersLEC,
        LCS: playersLCS,
        LCP: playersLCP,
        CBLOL: playersCBLOL
    };
    
    const currentLeaguePlayers = playerMap[currentLeague] || [];
    
    // Decide which roster to show
    const displayRoster = isLCK ? roster : currentLeaguePlayers.filter(p => p.팀 === displayTeam?.name);

    // [NEW] 4. Smart Navigation Buttons
    const handlePrev = () => {
        if (isLCK) {
            onPrevTeam();
        } else {
            setForeignTeamIndex((prev) => (prev === 0 ? currentTeamsList.length - 1 : prev - 1));
        }
    };

    const handleNext = () => {
        if (isLCK) {
            onNextTeam();
        } else {
            setForeignTeamIndex((prev) => (prev === currentTeamsList.length - 1 ? 0 : prev + 1));
        }
    };

    const handleLeagueSwitch = (leagueName) => {
        setCurrentLeague(leagueName);
        setForeignTeamIndex(0); // Always start at the first team when switching leagues
    };

    // Fallback if team is somehow missing
    if (!displayTeam) return <div className="p-10 text-center font-bold text-gray-500">팀 데이터를 불러오는 중...</div>;

    return (
        <>
        <div className="relative bg-white rounded-lg border shadow-sm flex flex-col h-full lg:h-auto overflow-hidden">
            
            {/* [NEW] 5. The League Switcher Buttons UI */}
            <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 sticky top-0 z-50">
                {['LCK', 'LPL', 'LEC', 'LCS', 'LCP', 'CBLOL'].map(league => (
                    <button
                        key={league}
                        onClick={() => handleLeagueSwitch(league)}
                        className={`px-5 py-2 rounded-full font-bold text-xs lg:text-sm transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                            currentLeague === league
                            ? 'bg-blue-600 text-white ring-2 ring-blue-300 transform scale-105'
                            : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-300'
                        }`}
                    >
                        {league}
                    </button>
                ))}
            </div>

            {/* Header Section */}
            <div className="p-3 lg:p-6 border-b flex justify-between items-center bg-gray-50 shrink-0">
                <div className="flex items-center gap-2 lg:gap-4 w-full justify-between lg:justify-start">
                    <button 
                        onClick={handlePrev} 
                        className="p-2 lg:p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition active:scale-95"
                    >
                        ◀
                    </button>
                    
                    <div className="flex items-center gap-3 lg:gap-4">
                        <div className="w-10 h-10 lg:w-16 lg:h-16 rounded-full flex items-center justify-center font-bold text-white shadow-lg text-xs lg:text-xl shrink-0" style={{backgroundColor: displayTeam.colors?.primary || TEAM_COLORS[displayTeam.name] || TEAM_COLORS.DEFAULT}}>
                            {displayTeam.name}
                        </div>
                        <div>
                            <h2 className="text-lg lg:text-3xl font-black text-gray-900 leading-tight">{displayTeam.fullName}</h2>
                            <p className="text-xs lg:text-sm font-bold text-gray-500 mt-0.5 lg:mt-1">상세 로스터 및 계약 현황</p>
                        </div>
                    </div>
                    
                    <button 
                        onClick={handleNext} 
                        className="p-2 lg:p-2 bg-white rounded-full border hover:bg-gray-100 shadow-sm transition active:scale-95"
                    >
                        ▶
                    </button>
                </div>
                
                <div className="hidden lg:block text-right whitespace-nowrap ml-4">
                    <div className="text-2xl font-black text-blue-600">{displayTeam.power} <span className="text-sm text-gray-400 font-normal">TEAM OVR</span></div>
                </div>
            </div>

            {/* Content Section */}
            <div className="flex-1 overflow-auto">
                <table className="min-w-max w-full text-xs text-left border-collapse">
                    <thead className="bg-white text-gray-500 uppercase font-bold border-b sticky top-0 z-30 shadow-sm">
                        <tr>
                            <th className="py-3 px-4 bg-gray-50 sticky left-0 z-40 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">정보</th>
                            
                            <th className="py-3 px-4 text-center whitespace-nowrap">OVR</th>
                            <th className="py-3 px-4 text-center whitespace-nowrap">나이</th>
                            <th className="py-3 px-4 text-center whitespace-nowrap">경력</th>
                            <th className="py-3 px-4 text-center whitespace-nowrap">소속</th>
                            <th className="py-3 px-4 text-center whitespace-nowrap">연봉</th>
                            
                            {/* Stats Group */}
                            <th className="py-3 px-4 text-center bg-gray-50 border-l whitespace-nowrap">라인</th>
                            <th className="py-3 px-4 text-center bg-gray-50 whitespace-nowrap">무력</th>
                            <th className="py-3 px-4 text-center bg-gray-50 whitespace-nowrap">한타</th>
                            <th className="py-3 px-4 text-center bg-gray-50 whitespace-nowrap">성장</th>
                            <th className="py-3 px-4 text-center bg-gray-50 whitespace-nowrap">안정</th>
                            <th className="py-3 px-4 text-center bg-gray-50 whitespace-nowrap">운영</th>
                            
                            <th className="py-3 px-4 text-center bg-gray-50 border-l text-purple-600 whitespace-nowrap">POT</th>
                            <th className="py-3 px-4 text-left bg-gray-50 border-l whitespace-nowrap">계약 정보</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {displayRoster.length > 0 ? displayRoster.map((p, i) => (
                            <tr key={i} className="hover:bg-blue-50/30 transition group">
                                <td className="py-3 px-4 bg-white group-hover:bg-blue-50/30 sticky left-0 z-20 border-r shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                    <div className="flex items-center gap-3">
                                        <span className="font-bold text-gray-400 w-8 text-center shrink-0">{p.포지션}</span>
                                        <div className="flex flex-col min-w-0">
                                            <div
                                                className="font-bold text-blue-700 text-xs lg:text-sm whitespace-nowrap cursor-pointer hover:underline"
                                                onClick={() => setSelectedPlayer(p)}
                                            >
                                                {p.이름} {p.주장 && <span className="text-yellow-500" title="주장">👑</span>}
                                            </div>
                                            <div className="text-[10px] text-gray-400 whitespace-nowrap">{p.특성}</div>
                                        </div>
                                    </div>
                                </td>
                                
                                <td className="py-3 px-4 text-center"><span className={`inline-flex items-center justify-center w-8 h-6 rounded font-black text-xs shadow-sm border ${getOvrBadgeStyle(p.종합)}`}>{p.종합}</span></td>
                                <td className="py-3 px-4 text-center text-gray-600 whitespace-nowrap">{p.나이 || '-'}</td>
                                <td className="py-3 px-4 text-center text-gray-600 whitespace-nowrap">{p.경력 || '-'}</td>
                                <td className="py-3 px-4 text-center text-gray-700 whitespace-nowrap">{p['팀 소속기간'] || '-'}</td>
                                <td className="py-3 px-4 text-center text-gray-700 font-bold whitespace-nowrap">{p.연봉 || '-'}</td>
                                
                                <td className="py-3 px-4 text-center border-l font-medium text-gray-600 whitespace-nowrap">{p.상세?.라인전 || '-'}</td>
                                <td className="py-3 px-4 text-center font-medium text-gray-600 whitespace-nowrap">{p.상세?.무력 || '-'}</td>
                                <td className="py-3 px-4 text-center font-medium text-gray-600 whitespace-nowrap">{p.상세?.한타 || '-'}</td>
                                <td className="py-3 px-4 text-center font-medium text-gray-600 whitespace-nowrap">{p.상세?.성장 || '-'}</td>
                                <td className="py-3 px-4 text-center font-medium text-gray-600 whitespace-nowrap">{p.상세?.안정성 || '-'}</td>
                                <td className="py-3 px-4 text-center font-medium text-gray-600 whitespace-nowrap">{p.상세?.운영 || '-'}</td>
                                
                                <td className="py-3 px-4 text-center border-l"><span className={`font-bold ${getPotBadgeStyle(p.잠재력)}`}>{p.잠재력}</span></td>
                                <td className="py-3 px-4 border-l"><span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold block text-center whitespace-nowrap">{p.계약}</span></td>
                            </tr>
                        )) : (
                            <tr><td colSpan="14" className="py-10 text-center text-gray-400 font-bold">로스터 데이터가 없습니다. (JSON 파일을 확인해주세요)</td></tr>
                        )} 
                    </tbody>
                </table>
            </div>

            {/* Player Profile Modal — scoped to RosterTab */}
            {selectedPlayer && (
                <PlayerProfileModal
                    player={selectedPlayer}
                    league={null}
                    masteryData={allMastery}
                    onClose={() => setSelectedPlayer(null)}
                />
            )}
        </div>
    );
};

export default RosterTab;