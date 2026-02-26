// src/components/ScheduleTab.jsx
import React, { useState } from 'react';

// [NEW] Imports for the Retroactive Time Machine!
import { generateLCPRegularSchedule } from '../engine/scheduleLogic';
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';
import { updateLeague } from '../engine/storage';

const compareDates = (a, b) => {
    if (!a.date || !b.date) return 0;
    const [monthA, dayA] = a.date.split(' ')[0].split('.').map(Number);
    const [monthB, dayB] = b.date.split(' ')[0].split('.').map(Number);
    
    if (monthA !== monthB) return monthA - monthB;
    if (dayA !== dayB) return dayA - dayB;
    if (a.time && b.time) return a.time.localeCompare(b.time);
    return 0;
};

const ScheduleTab = ({ activeTab, league, teams, myTeam, hasDrafted, formatTeamName, onMatchClick }) => {
    const [currentLeague, setCurrentLeague] = useState('LCK');
    const displayLeague = activeTab === 'team_schedule' ? 'LCK' : currentLeague;

    // [NEW] Determine which match array to pull from based on the buttons
    const activeMatches = displayLeague === 'LCK' 
        ? (league.matches || [])
        : (league.foreignMatches?.[displayLeague] || []);

    // [NEW] Determine global teams to display names correctly
    const activeTeams = displayLeague === 'LCK' ? teams : (FOREIGN_LEAGUES[displayLeague] || []);

    // [NEW] The Time Machine Engine
    // [NEW] The Upgraded Time Machine Engine
    const handleRetroactiveGenerate = () => {
        if (displayLeague !== 'LCP') return;
        
        const lcpTeams = FOREIGN_LEAGUES['LCP'];
        let lcpSchedule = generateLCPRegularSchedule(lcpTeams);
        
        // Fast-forward simulate all games randomly so you can see results immediately
        lcpSchedule = lcpSchedule.map(m => {
            const winnerId = Math.random() > 0.5 ? m.t1 : m.t2;
            const winnerName = lcpTeams.find(t => t.id === winnerId)?.name;
            return {
                ...m,
                status: 'finished',
                result: { winner: winnerName, score: '2-1' }
            };
        });

        const updatedLeague = { ...league };
        
        // [THE FIX] Inject the missing storage bins if it's an old save file!
        if (!updatedLeague.foreignMatches) {
            updatedLeague.foreignMatches = { LPL: [], LEC: [], LCS: [], LCP: [], CBLOL: [] };
        }
        if (!updatedLeague.foreignStandings) {
            updatedLeague.foreignStandings = { LPL: {}, LEC: {}, LCS: {}, LCP: {}, CBLOL: {} };
        }
        if (!updatedLeague.foreignHistory) {
            updatedLeague.foreignHistory = { LPL: [], LEC: [], LCS: [], LCP: [], CBLOL: [] };
        }

        // Save to game memory and reload!
        updatedLeague.foreignMatches['LCP'] = lcpSchedule;
        updateLeague(league.id, updatedLeague);
        window.location.reload();
    };

    return (
        <div className="bg-white rounded-lg border shadow-sm p-4 lg:p-8 min-h-[300px] lg:min-h-[600px] flex flex-col h-full lg:h-auto overflow-y-auto">
            
            {activeTab === 'schedule' && (
                <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 sticky top-0 z-50 rounded-lg mb-4 sm:mb-6">
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
            )}

            <h2 className="text-lg lg:text-2xl font-black text-gray-900 mb-4 lg:mb-6 flex items-center gap-2 shrink-0">
                📅 {activeTab === 'team_schedule' ? `${myTeam.name} 경기 일정` : `2026 ${displayLeague} 전체 일정`}
            </h2>
            
            {/* LCK and LCP are now "Unlocked", others show the placeholder */}
            {displayLeague === 'LCK' || displayLeague === 'LCP' ? (
                activeMatches.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 pb-4">
                        {activeMatches
                            .filter(m => activeTab === 'schedule' || (m.t1 === myTeam.id || m.t2 === myTeam.id))
                            .sort(compareDates) 
                            .map((m, i) => {
                                const t1 = m.t1 ? activeTeams.find(t => t.id === m.t1) : { name: 'TBD' };
                                const t2 = m.t2 ? activeTeams.find(t => t.id === m.t2) : { name: 'TBD' };
                                const isMyMatch = myTeam.id === m.t1 || myTeam.id === m.t2;
                                const isFinished = m.status === 'finished';
                                
                                const t1Name = formatTeamName ? formatTeamName(m.t1, m.type) : t1.name;
                                const t2Name = formatTeamName ? formatTeamName(m.t2, m.type) : t2.name;

                                let badgeColor = 'text-gray-500';
                                let badgeText = '정규시즌';
                                if (m.type === 'super') { badgeColor = 'text-purple-600'; badgeText = '🔥 슈퍼위크'; }
                                else if (m.type === 'playin') { badgeColor = 'text-indigo-600'; badgeText = m.label || '플레이-인'; }
                                else if (m.type === 'playoff') { badgeColor = 'text-yellow-600'; badgeText = m.label || '플레이오프'; }

                                return (
                                    <div key={i} className={`p-3 lg:p-4 rounded-lg border flex flex-col gap-1 lg:gap-2 ${isMyMatch && displayLeague === 'LCK' ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-gray-200'}`}>
                                        <div className="flex justify-between text-[10px] lg:text-xs font-bold text-gray-500">
                                            <span>{m.date} {m.time}</span>
                                            <span className={`font-bold ${badgeColor}`}>
                                                {badgeText}
                                            </span>
                                        </div>
                                        <div className="flex justify-between items-center mt-1 lg:mt-2">
                                            <div className="flex flex-col items-center w-1/3">
                                                <span className={`font-bold text-xs lg:text-base text-center break-keep leading-tight ${isMyMatch && myTeam.id === m.t1 && displayLeague === 'LCK' ? 'text-blue-600' : 'text-gray-800'}`}>{t1Name}</span>
                                                {isFinished && m.result.winner === t1.name && <span className="text-[10px] lg:text-xs text-blue-500 font-bold mt-1">WIN</span>}
                                            </div>
                                            <div className="text-center font-bold flex flex-col items-center shrink-0 w-1/4">
                                            {isFinished ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-lg lg:text-xl text-gray-800">{m.result.score}</span>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-sm lg:text-base">VS</span>
                                            )}
                                            </div>
                                            <div className="flex flex-col items-center w-1/3">
                                                <span className={`font-bold text-xs lg:text-base text-center break-keep leading-tight ${isMyMatch && myTeam.id === m.t2 && displayLeague === 'LCK' ? 'text-blue-600' : 'text-gray-800'}`}>{t2Name}</span>
                                                {isFinished && m.result.winner === t2.name && <span className="text-[10px] lg:text-xs text-blue-500 font-bold mt-1">WIN</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                ) : (
                    // [NEW] The Time Machine Display!
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10">
                        <div className="text-2xl lg:text-4xl mb-2 lg:mb-4">⏳</div>
                        <div className="text-lg lg:text-xl font-bold">LCP 일정이 비어있습니다</div>
                        {displayLeague === 'LCP' && (
                            <button 
                                onClick={handleRetroactiveGenerate}
                                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-black shadow-lg transition transform hover:-translate-y-1"
                            >
                                ✨ LCP 소급 스케줄 및 결과 생성하기 ✨
                            </button>
                        )}
                    </div>
                )
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <div className="text-4xl lg:text-6xl mb-3 lg:mb-4 animate-bounce">🌍</div>
                    <div className="text-xl lg:text-2xl font-black text-gray-600">{currentLeague} 일정 준비 중</div>
                    <p className="mt-2 text-sm lg:text-base font-bold text-gray-500">해외 리그 스케줄링 시스템은 다음 작전 단계에서 가동됩니다!</p>
                </div>
            )}
        </div>
    );
};

export default ScheduleTab;