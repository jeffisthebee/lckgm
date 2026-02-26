// src/components/ScheduleTab.jsx
import React, { useState, useEffect } from 'react';
import { quickSimulateMatch } from '../engine/simEngine';
import { generateLCPRegularSchedule, generateLCPPlayoffs } from '../engine/scheduleLogic';

import { FOREIGN_LEAGUES, FOREIGN_PLAYERS } from '../data/foreignLeagues';
import { updateLeague } from '../engine/storage';
// [NEW] Import the Champion List to patch old save files!
import { championList } from '../data/constants'; 

const compareDatesObj = (a, b) => {
    if (!a || !b || !a.date || !b.date) return 0;
    const [monthA, dayA] = a.date.split(' ')[0].split('.').map(Number);
    const [monthB, dayB] = b.date.split(' ')[0].split('.').map(Number);
    
    if (monthA !== monthB) return monthA - monthB;
    if (dayA !== dayB) return dayA - dayB;
    
    if (a.time && b.time) {
        const [hA, mA] = a.time.split(':').map(Number);
        const [hB, mB] = b.time.split(':').map(Number);
        if (hA !== hB) return hA - hB;
        return mA - mB;
    }
    return 0;
};

// Robust Roster Generator ensures players have Detailed Stats so the engine NEVER crashes
const getSafeRoster = (teamObj, allPlayers) => {
    const tName = teamObj.name;
    let r = allPlayers.filter(p => p.팀 === tName || p.team === tName || p.Team === tName || (p.playerData && p.playerData.팀 === tName));
    
    const requiredRoles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    
    return requiredRoles.map(role => {
        const existing = r.find(p => String(p.포지션 || p.role).toUpperCase() === role);
        if (existing) {
            return {
                ...existing,
                이름: existing.이름 || existing.playerName || `${tName} ${role}`,
                playerName: existing.playerName || existing.이름 || `${tName} ${role}`,
                상세: existing.상세 || { 라인전: 80, 한타: 80, 운영: 80, 생존: 80, 성장: 80, 무력: 80 },
                종합: existing.종합 || existing.ovr || 80,
                playerData: existing.playerData || { 팀: tName, 포지션: role }
            };
        }
        return {
            이름: `${tName} ${role}`,
            playerName: `${tName} ${role}`,
            포지션: role,
            role: role,
            팀: tName,
            종합: 80,
            상세: { 라인전: 80, 한타: 80, 운영: 80, 생존: 80, 성장: 80, 무력: 80 },
            playerData: { 팀: tName, 포지션: role }
        };
    });
};

const ScheduleTab = ({ activeTab, league, teams, myTeam, hasDrafted, formatTeamName, onMatchClick }) => {
    const [currentLeague, setCurrentLeague] = useState('LCK');
    const displayLeague = activeTab === 'team_schedule' ? 'LCK' : currentLeague;

    const activeMatches = displayLeague === 'LCK' 
        ? (league.matches || [])
        : (league.foreignMatches?.[displayLeague] || []);

    const activeTeams = displayLeague === 'LCK' ? teams : (FOREIGN_LEAGUES[displayLeague] || []);

    const pendingLCK = league.matches ? league.matches.filter(m => m.status === 'pending').sort(compareDatesObj) : [];
    const currentPendingLCK = pendingLCK.length > 0 ? pendingLCK[0] : { date: '99.99 (완료)', time: '23:59' };
    
    // Checks if we need to sync AND if the current data is corrupted (empty history)
    const needsSync = displayLeague === 'LCP' && (
        activeMatches.length === 0 || 
        activeMatches.some(m => m.status === 'pending' && currentPendingLCK.date !== '99.99 (완료)' && compareDatesObj(m, currentPendingLCK) < 0) ||
        (currentPendingLCK.date === '99.99 (완료)' && activeMatches.some(m => m.status === 'pending')) ||
        activeMatches.some(m => m.t1 === 'TBD' || !activeTeams.find(t => t.id === m.t1 || t.name === m.t1)) ||
        activeMatches.some(m => m.status === 'finished' && (!m.result || !m.result.history || m.result.history.length === 0))
    );

    useEffect(() => {
        if (!needsSync) return;

        const lcpTeams = FOREIGN_LEAGUES['LCP'] || [];
        const lcpPlayers = (FOREIGN_PLAYERS && FOREIGN_PLAYERS['LCP']) ? FOREIGN_PLAYERS['LCP'] : [];

        let isUpdated = false;

        let lcpSchedule = activeMatches.filter(m => m.type !== 'playoff');
        
        // Destroy corrupted games (like those flat 2-1s with no history!)
        const hasBadData = lcpSchedule.some(m => 
            !lcpTeams.find(t => t.id === m.t1 || t.name === m.t1) || 
            (m.status === 'finished' && (!m.result || !m.result.history || m.result.history.length === 0))
        );
        
        if (lcpSchedule.length === 0 || hasBadData) {
            console.log("[Auto-Sync] Scrubbing corrupt data and regenerating LCP Schedule...");
            lcpSchedule = generateLCPRegularSchedule(lcpTeams);
            isUpdated = true;
        }

        // [THE PATCH] Feed the champion list to the engine even if the save file forgot it!
        const safeLeague = {
            ...league,
            currentChampionList: league.currentChampionList || championList,
            metaVersion: league.metaVersion || '16.01'
        };

        const simMatchIfPast = (matchObj) => {
            if (matchObj.status === 'finished') return matchObj; 

            if (currentPendingLCK.date !== '99.99 (완료)' && compareDatesObj(matchObj, currentPendingLCK) >= 0) {
                return matchObj;
            }

            const t1Obj = lcpTeams.find(t => t.id === matchObj.t1 || t.name === matchObj.t1);
            const t2Obj = lcpTeams.find(t => t.id === matchObj.t2 || t.name === matchObj.t2);
            if (!t1Obj || !t2Obj) return matchObj; 

            const t1 = { ...t1Obj, roster: getSafeRoster(t1Obj, lcpPlayers) };
            const t2 = { ...t2Obj, roster: getSafeRoster(t2Obj, lcpPlayers) };

            try {
                // RUN THE REAL SIMULATION!
                const simResult = quickSimulateMatch(t1, t2, matchObj.format, matchObj.type, safeLeague);
                isUpdated = true;
                
                // Ensure Score String Formatting is correct
                let fScore = simResult.scoreString || simResult.score;
                if (typeof fScore === 'object') {
                    const valA = fScore.A ?? 0;
                    const valB = fScore.B ?? 0;
                    fScore = `${Math.max(valA, valB)}-${Math.min(valA, valB)}`;
                }
                if (!fScore) {
                     const reqWins = (matchObj.format === 'BO5' || matchObj.type === 'playoff') ? 3 : 2;
                     fScore = `${reqWins}-0`;
                }

                return {
                    ...matchObj,
                    status: 'finished',
                    result: {
                        winner: simResult.winner?.name || simResult.winner,
                        score: fScore,
                        history: simResult.history || []
                    }
                };
            } catch (e) {
                console.error("Engine Crash Blocked:", e);
                // If it STILL crashes, dynamically calculate BO3 vs BO5 scores!
                const isBO5 = matchObj.format === 'BO5' || matchObj.type === 'playoff';
                const reqWins = isBO5 ? 3 : 2;
                const t1Wins = Math.random() > 0.5;
                const winnerScore = reqWins;
                const loserScore = Math.floor(Math.random() * reqWins); 
                
                isUpdated = true;
                return {
                    ...matchObj,
                    status: 'finished',
                    result: {
                        winner: t1Wins ? t1.name : t2.name,
                        score: t1Wins ? `${winnerScore}-${loserScore}` : `${loserScore}-${winnerScore}`,
                        // Inject safe fake history to prevent the Modal from crashing
                        history: [{ logs: ['데이터 오류로 인해 강제 시뮬레이션 됨'], picks: { A: [], B: [] }, bans: { A: [], B: [] } }] 
                    }
                };
            }
        };

        lcpSchedule = lcpSchedule.map(simMatchIfPast);

        // PLAYOFFS
        let lcpPlayoffs = hasBadData ? [] : activeMatches.filter(m => m.type === 'playoff');
        let seeds = league.foreignPlayoffSeeds?.['LCP'] || [];
        
        const isRegularSeasonDone = lcpSchedule.every(m => m.status === 'finished');

        if (isRegularSeasonDone) {
            if (seeds.length === 0 || hasBadData) {
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
                isUpdated = true;
            }

            if (lcpPlayoffs.length === 0) {
                lcpPlayoffs = generateLCPPlayoffs(seeds);
                isUpdated = true;
            }

            const simPlayoffMatch = (id) => {
                const matchObj = lcpPlayoffs.find(m => m.id === id);
                if (!matchObj || !matchObj.t1 || !matchObj.t2) return { winnerId: null, loserId: null };
                if (matchObj.status === 'finished') {
                    const winnerId = lcpTeams.find(t => t.name === matchObj.result.winner)?.id || matchObj.result.winner;
                    const loserId = winnerId === matchObj.t1 ? matchObj.t2 : matchObj.t1;
                    return { winnerId, loserId };
                }
                if (currentPendingLCK.date !== '99.99 (완료)' && compareDatesObj(matchObj, currentPendingLCK) >= 0) {
                    return { winnerId: null, loserId: null };
                }

                const simulatedMatch = simMatchIfPast(matchObj);
                Object.assign(matchObj, simulatedMatch); 
                isUpdated = true;

                if (simulatedMatch.status === 'finished') {
                    const winnerId = lcpTeams.find(t => t.name === simulatedMatch.result.winner)?.id || simulatedMatch.result.winner;
                    const loserId = winnerId === matchObj.t1 ? matchObj.t2 : matchObj.t1;
                    return { winnerId, loserId };
                }
                return { winnerId: null, loserId: null };
            };

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

        if (isUpdated) {
            const fullSchedule = [...lcpSchedule, ...lcpPlayoffs];
            const updatedLeague = { ...league };
            if (!updatedLeague.foreignMatches) updatedLeague.foreignMatches = { LPL: [], LEC: [], LCS: [], LCP: [], CBLOL: [] };
            if (!updatedLeague.foreignStandings) updatedLeague.foreignStandings = { LPL: {}, LEC: {}, LCS: {}, LCP: {}, CBLOL: {} };
            
            updatedLeague.foreignMatches['LCP'] = fullSchedule;
            updatedLeague.foreignPlayoffSeeds = updatedLeague.foreignPlayoffSeeds || {};
            updatedLeague.foreignPlayoffSeeds['LCP'] = seeds;

            updateLeague(league.id, updatedLeague);
            window.location.reload(); 
        }
    }, [needsSync, currentPendingLCK, displayLeague, activeMatches]);

    return (
        <div className="bg-white rounded-lg border shadow-sm p-4 lg:p-8 min-h-[300px] lg:min-h-[600px] flex flex-col h-full lg:h-auto overflow-y-auto relative">
            
            {needsSync && (
                <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
                    <div className="text-4xl animate-spin mb-4">⏳</div>
                    <div className="text-lg font-black text-blue-600 animate-pulse">LCP 데이터를 복구 및 동기화 중입니다...</div>
                </div>
            )}

            {activeTab === 'schedule' && (
                <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 sticky top-0 z-40 rounded-lg mb-4 sm:mb-6">
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
            </div>
            
            {displayLeague === 'LCK' || displayLeague === 'LCP' ? (
                activeMatches.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 pb-4">
                        {activeMatches
                            // [FIX] Ensure Team Schedule doesn't hide foreign games!
                            .filter(m => activeTab === 'schedule' || displayLeague !== 'LCK' || (m.t1 === myTeam.id || m.t2 === myTeam.id))
                            .sort(compareDatesObj) 
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
                        <div className="text-lg lg:text-xl font-bold">LCP 일정이 없습니다.</div>
                        <p className="mt-2 text-sm text-gray-500">LCK 리그가 시작되면 일정이 자동으로 생성됩니다.</p>
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