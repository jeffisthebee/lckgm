// src/components/ScheduleTab.jsx
import React, { useState } from 'react';

// [NEW] Import the REAL Simulation Engine!
import { quickSimulateMatch } from '../engine/simEngine';
import { generateLCPRegularSchedule, generateLCPPlayoffs } from '../engine/scheduleLogic';
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';
import { updateLeague } from '../engine/storage';

// [FIX 2] Upgraded Time Checker to calculate hours and minutes!
const compareDates = (a, b) => {
    if (!a || !b || !a.date || !b.date) return 0;
    const [monthA, dayA] = a.date.split(' ')[0].split('.').map(Number);
    const [monthB, dayB] = b.date.split(' ')[0].split('.').map(Number);
    
    if (monthA !== monthB) return monthA - monthB;
    if (dayA !== dayB) return dayA - dayB;
    
    // If it's the exact same day, check the time! (e.g., 15:00 vs 17:00)
    if (a.time && b.time) {
        const [hA, mA] = a.time.split(':').map(Number);
        const [hB, mB] = b.time.split(':').map(Number);
        if (hA !== hB) return hA - hB;
        return mA - mB;
    }
    return 0;
};

const ScheduleTab = ({ activeTab, league, teams, myTeam, hasDrafted, formatTeamName, onMatchClick }) => {
    const [currentLeague, setCurrentLeague] = useState('LCK');
    const displayLeague = activeTab === 'team_schedule' ? 'LCK' : currentLeague;

    const activeMatches = displayLeague === 'LCK' 
        ? (league.matches || [])
        : (league.foreignMatches?.[displayLeague] || []);

    const activeTeams = displayLeague === 'LCK' ? teams : (FOREIGN_LEAGUES[displayLeague] || []);

    // --- CHECK CURRENT GLOBAL TIME BASED ON LCK ---
    const pendingLCK = league.matches ? league.matches.filter(m => m.status === 'pending').sort(compareDates) : [];
    const currentPendingLCK = pendingLCK.length > 0 ? pendingLCK[0] : { date: '99.99 (완료)', time: '23:59' };
    
    // [NEW] Smart tracker that lights up the Sync Button if games are behind schedule!
    const needsSync = displayLeague === 'LCP' && (
        activeMatches.length === 0 || 
        activeMatches.some(m => m.status === 'pending' && currentPendingLCK.date !== '99.99 (완료)' && compareDates(m, currentPendingLCK) < 0) ||
        (currentPendingLCK.date === '99.99 (완료)' && activeMatches.some(m => m.status === 'pending'))
    );

    // --- THE REAL SIMULATION ENGINE HOOKUP ---
    const handleRetroactiveGenerate = () => {
        if (displayLeague !== 'LCP') return;
        
        const lcpTeams = FOREIGN_LEAGUES['LCP'];
        
        // 1. GENERATE REGULAR SEASON (OR LOAD EXISTING)
        let lcpSchedule = activeMatches.length > 0 ? [...activeMatches.filter(m => m.type !== 'playoff')] : generateLCPRegularSchedule(lcpTeams);
        
        // 2. PROGRESSIVELY SIMULATE PAST MATCHES
        const simMatchIfPast = (matchObj) => {
            if (matchObj.status === 'finished') return matchObj; // Skip if already played

            // [FIX 2] Keep pending if strictly in the future compared to LCK!
            if (currentPendingLCK.date !== '99.99 (완료)' && compareDates(matchObj, currentPendingLCK) > 0) {
                return matchObj;
            }

            const t1 = lcpTeams.find(t => t.id === matchObj.t1 || t.name === matchObj.t1);
            const t2 = lcpTeams.find(t => t.id === matchObj.t2 || t.name === matchObj.t2);
            if (!t1 || !t2) return matchObj; 

            try {
                // [FIX 1 & 3] Run the REAL simulation so history, picks, bans, and stats are generated!
                const simResult = quickSimulateMatch(t1, t2, matchObj.format, matchObj.type, league);
                return {
                    ...matchObj,
                    status: 'finished',
                    result: {
                        winner: simResult.winner?.name || simResult.winner,
                        score: simResult.score,
                        history: simResult.history || []
                    }
                };
            } catch (e) {
                console.error("Simulation error", e);
                return matchObj;
            }
        };

        lcpSchedule = lcpSchedule.map(simMatchIfPast);

        // 3. GENERATE & SIMULATE PLAYOFFS (IF REGULAR IS DONE)
        let lcpPlayoffs = activeMatches.filter(m => m.type === 'playoff');
        let seeds = league.foreignPlayoffSeeds?.['LCP'] || [];
        
        const isRegularSeasonDone = lcpSchedule.every(m => m.status === 'finished');

        if (isRegularSeasonDone) {
            if (seeds.length === 0) {
                const standings = {};
                lcpTeams.forEach(t => standings[t.name] = { w: 0, l: 0, id: t.id || t.name, name: t.name });
                
                lcpSchedule.forEach(m => {
                    if (m.status === 'finished' && m.result) {
                        const winnerName = m.result.winner;
                        const t1Name = lcpTeams.find(t => t.id === m.t1 || t.name === m.t1)?.name;
                        const t2Name = lcpTeams.find(t => t.id === m.t2 || t.name === m.t2)?.name;
                        const loserName = winnerName === t1Name ? t2Name : t1Name;
                        
                        if (standings[winnerName]) standings[winnerName].w += 1;
                        if (standings[loserName]) standings[loserName].l += 1;
                    }
                });
                
                const sortedTeams = Object.values(standings).sort((a,b) => b.w - a.w);
                seeds = sortedTeams.slice(0, 6).map((t, idx) => ({ ...t, seed: idx + 1 }));
            }

            if (lcpPlayoffs.length === 0) {
                lcpPlayoffs = generateLCPPlayoffs(seeds);
            }

            const simPlayoffMatch = (id) => {
                const matchObj = lcpPlayoffs.find(m => m.id === id);
                if (!matchObj || !matchObj.t1 || !matchObj.t2) return { winnerId: null, loserId: null };
                
                if (matchObj.status === 'finished') {
                    const winnerId = lcpTeams.find(t => t.name === matchObj.result.winner)?.id || matchObj.result.winner;
                    const loserId = winnerId === matchObj.t1 ? matchObj.t2 : matchObj.t1;
                    return { winnerId, loserId };
                }

                // Time check for playoffs
                if (currentPendingLCK.date !== '99.99 (완료)' && compareDates(matchObj, currentPendingLCK) > 0) {
                    return { winnerId: null, loserId: null };
                }

                const simulatedMatch = simMatchIfPast(matchObj);
                Object.assign(matchObj, simulatedMatch); 

                if (simulatedMatch.status === 'finished') {
                    const winnerId = lcpTeams.find(t => t.name === simulatedMatch.result.winner)?.id || simulatedMatch.result.winner;
                    const loserId = winnerId === matchObj.t1 ? matchObj.t2 : matchObj.t1;
                    return { winnerId, loserId };
                }
                return { winnerId: null, loserId: null };
            };

            // Sequential Playoff resolution
            const r1m1 = simPlayoffMatch('lcp_po1');
            const r1m2 = simPlayoffMatch('lcp_po2');

            const po3 = lcpPlayoffs.find(m => m.id === 'lcp_po3');
            if (po3 && r1m1.winnerId) po3.t2 = r1m1.winnerId;
            const r2m1 = simPlayoffMatch('lcp_po3');

            const po4 = lcpPlayoffs.find(m => m.id === 'lcp_po4');
            if (po4 && r1m2.winnerId) po4.t2 = r1m2.winnerId;
            const r2m2 = simPlayoffMatch('lcp_po4');

            const po5 = lcpPlayoffs.find(m => m.id === 'lcp_po5');
            if (po5 && r2m1.winnerId && r2m2.winnerId) { po5.t1 = r2m1.winnerId; po5.t2 = r2m2.winnerId; }
            const r3m1 = simPlayoffMatch('lcp_po5');

            const po6 = lcpPlayoffs.find(m => m.id === 'lcp_po6');
            if (po6 && r2m1.loserId && r2m2.loserId) { po6.t1 = r2m1.loserId; po6.t2 = r2m2.loserId; }
            const r2lm1 = simPlayoffMatch('lcp_po6');

            const po7 = lcpPlayoffs.find(m => m.id === 'lcp_po7');
            if (po7 && r2lm1.winnerId && r3m1.loserId) { po7.t1 = r2lm1.winnerId; po7.t2 = r3m1.loserId; }
            const r3lm1 = simPlayoffMatch('lcp_po7');

            const po8 = lcpPlayoffs.find(m => m.id === 'lcp_po8');
            if (po8 && r3m1.winnerId && r3lm1.winnerId) { po8.t1 = r3m1.winnerId; po8.t2 = r3lm1.winnerId; }
            simPlayoffMatch('lcp_po8');
        }

        const fullSchedule = [...lcpSchedule, ...lcpPlayoffs];

        // Save & Reload
        const updatedLeague = { ...league };
        if (!updatedLeague.foreignMatches) updatedLeague.foreignMatches = { LPL: [], LEC: [], LCS: [], LCP: [], CBLOL: [] };
        if (!updatedLeague.foreignStandings) updatedLeague.foreignStandings = { LPL: {}, LEC: {}, LCS: {}, LCP: {}, CBLOL: {} };
        if (!updatedLeague.foreignHistory) updatedLeague.foreignHistory = { LPL: [], LEC: [], LCS: [], LCP: [], CBLOL: [] };

        updatedLeague.foreignMatches['LCP'] = fullSchedule;
        updatedLeague.foreignPlayoffSeeds = updatedLeague.foreignPlayoffSeeds || {};
        updatedLeague.foreignPlayoffSeeds['LCP'] = seeds;

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

            <div className="flex items-center justify-between mb-4 lg:mb-6 shrink-0">
                <h2 className="text-lg lg:text-2xl font-black text-gray-900 flex items-center gap-2">
                    📅 {activeTab === 'team_schedule' ? `${myTeam.name} 경기 일정` : `2026 ${displayLeague} 전체 일정`}
                </h2>
                
                {/* [NEW] Smart Auto-Sync Button! */}
                {displayLeague === 'LCP' && needsSync && (
                    <button 
                        onClick={handleRetroactiveGenerate}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-xs font-black transition shadow-md animate-pulse"
                    >
                        🔄 스케줄 동기화 (Auto-Sync)
                    </button>
                )}
            </div>
            
            {displayLeague === 'LCK' || displayLeague === 'LCP' ? (
                activeMatches.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 pb-4">
                        {activeMatches
                            .filter(m => activeTab === 'schedule' || (m.t1 === myTeam.id || m.t2 === myTeam.id))
                            .sort(compareDates) 
                            .map((m, i) => {
                                const t1 = m.t1 ? activeTeams.find(t => t.id === m.t1 || t.name === m.t1) : { name: 'TBD' };
                                const t2 = m.t2 ? activeTeams.find(t => t.id === m.t2 || t.name === m.t2) : { name: 'TBD' };
                                const isMyMatch = myTeam.id === m.t1 || myTeam.id === m.t2;
                                const isFinished = m.status === 'finished';
                                
                                const t1Name = (displayLeague === 'LCK' && formatTeamName) ? formatTeamName(m.t1, m.type) : t1.name;
                                const t2Name = (displayLeague === 'LCK' && formatTeamName) ? formatTeamName(m.t2, m.type) : t2.name;

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
                                                {isFinished && m.result?.winner === t1.name && <span className="text-[10px] lg:text-xs text-blue-500 font-bold mt-1">WIN</span>}
                                            </div>
                                            <div className="text-center font-bold flex flex-col items-center shrink-0 w-1/4">
                                            {isFinished ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-lg lg:text-xl text-gray-800">{m.result?.score || '2-0'}</span>
                                                    <button 
                                                        onClick={() => onMatchClick && onMatchClick(m)}
                                                        className="mt-1 text-[9px] lg:text-[10px] bg-gray-100 hover:bg-gray-200 text-gray-600 border border-gray-300 px-1.5 lg:px-2 py-0.5 rounded transition flex items-center gap-1 whitespace-nowrap"
                                                    >
                                                        <span>📊</span> <span className="hidden sm:inline">상세보기</span><span className="sm:hidden">기록</span>
                                                    </button>
                                                </div>
                                            ) : (
                                                <span className="text-gray-400 text-sm lg:text-base">VS</span>
                                            )}
                                            </div>
                                            <div className="flex flex-col items-center w-1/3">
                                                <span className={`font-bold text-xs lg:text-base text-center break-keep leading-tight ${isMyMatch && myTeam.id === m.t2 && displayLeague === 'LCK' ? 'text-blue-600' : 'text-gray-800'}`}>{t2Name}</span>
                                                {isFinished && m.result?.winner === t2.name && <span className="text-[10px] lg:text-xs text-blue-500 font-bold mt-1">WIN</span>}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                    </div>
                ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10">
                        <div className="text-2xl lg:text-4xl mb-2 lg:mb-4">⏳</div>
                        <div className="text-lg lg:text-xl font-bold">LCP 일정이 비어있습니다</div>
                        {displayLeague === 'LCP' && (
                            <button 
                                onClick={handleRetroactiveGenerate}
                                className="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-black shadow-lg transition transform hover:-translate-y-1"
                            >
                                ✨ LCP 스케줄 및 결과 연동하기 ✨
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