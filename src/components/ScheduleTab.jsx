// src/components/ScheduleTab.jsx
import React, { useState, useEffect } from 'react';
import { quickSimulateMatch } from '../engine/simEngine';
// Import CBLOL logic along with LCP
import { generateLCPRegularSchedule, generateLCPPlayoffs, generateCBLOLRegularSchedule, generateCBLOLPlayoffs } from '../engine/scheduleLogic';
import { FOREIGN_LEAGUES, FOREIGN_PLAYERS } from '../data/foreignLeagues';
import { updateLeague } from '../engine/storage';
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

// --- Omni-Search Team Finder ---
const findGlobalTeam = (token, teamsList) => {
    if (!token || token === 'TBD' || token === 'null' || token === 'undefined') return { name: 'TBD' };
    const s = String(token).trim().toUpperCase();
    const pool = [...(teamsList || []), ...Object.values(FOREIGN_LEAGUES).flat()];
    const found = pool.find(t =>
        (t.id && String(t.id).toUpperCase() === s) ||
        (t.name && String(t.name).toUpperCase() === s) ||
        (t.fullName && String(t.fullName).toUpperCase() === s)
    );
    return found || { name: String(token) };
};

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
            이름: `${tName} ${role}`, playerName: `${tName} ${role}`,
            포지션: role, role: role, 팀: tName, 종합: 80,
            상세: { 라인전: 80, 한타: 80, 운영: 80, 생존: 80, 성장: 80, 무력: 80 },
            playerData: { 팀: tName, 포지션: role }
        };
    });
};

const ScheduleTab = ({ activeTab, league, setLeague, teams, myTeam, hasDrafted, formatTeamName, onMatchClick }) => {
    const [currentLeague, setCurrentLeague] = useState('LCK');
    const displayLeague = activeTab === 'team_schedule' ? 'LCK' : currentLeague;

    // Manual Override State
    const [forceRegen, setForceRegen] = useState(false);

    // Target League determines which sync engine is currently running (Air-gapped from LCK)
    const targetLeague = ['LCP', 'CBLOL'].includes(displayLeague) ? displayLeague : null;

    const activeMatches = displayLeague === 'LCK' ? (league.matches || []) : (league.foreignMatches?.[displayLeague] || []);
    const pendingLCK = league.matches ? league.matches.filter(m => m.status === 'pending').sort(compareDatesObj) : [];
    const currentPendingLCK = pendingLCK.length > 0 ? pendingLCK[0] : { date: '99.99 (완료)', time: '23:59' };
    
    // Scrubber: Identifies Corrupted Games
    // Scrubber: Identifies Corrupted Games
    const checkBadData = (matches, lg) => matches.some(m => {
        // [FORCE REWRITE] If CBLOL regular matches were mistakenly saved as BO3, trigger a wipe!
        if (lg === 'CBLOL' && (m.type === 'regular' || m.type === 'super') && m.format !== 'BO1') return true;

        const t1Str = String(m.t1); const t2Str = String(m.t2);
        if (m.status === 'finished') {
            if (!m.t1 || t1Str === 'TBD' || t1Str === 'null' || t1Str === 'undefined') return true;
            if (!m.t2 || t2Str === 'TBD' || t2Str === 'null' || t2Str === 'undefined') return true;
            
            // [THE FIX] We intentionally delete `history` to save the 5MB browser limit! 
            // So we MUST NOT flag `history.length === 0` as corrupted data anymore!
            if (!m.result) return true;
            if (m.result.history && m.result.history.length > 0 && m.result.history[0]?.logs?.includes('데이터 오류')) return true;
        }
        return false;
    });

    const needsSync = targetLeague && (
        forceRegen ||
        activeMatches.length === 0 || 
        activeMatches.some(m => m.status === 'pending' && currentPendingLCK.date !== '99.99 (완료)' && compareDatesObj(m, currentPendingLCK) < 0) ||
        (currentPendingLCK.date === '99.99 (완료)' && activeMatches.some(m => m.status === 'pending')) ||
        checkBadData(activeMatches, targetLeague)
    );

    // --- DUAL-CORE AUTO-SYNC ENGINE ---
    useEffect(() => {
        if (!needsSync || !targetLeague) return;

        const lgTeams = FOREIGN_LEAGUES[targetLeague] || [];
        const lgPlayers = (FOREIGN_PLAYERS && FOREIGN_PLAYERS[targetLeague]) ? FOREIGN_PLAYERS[targetLeague] : [];
        let isUpdated = false;

        let schedule = activeMatches.filter(m => m.type === 'regular' || m.type === 'super');
        const hasBadData = forceRegen || checkBadData(activeMatches, targetLeague);
        
        if (schedule.length === 0 || hasBadData) {
            console.log(`[Auto-Sync] Regenerating flawless ${targetLeague} schedule...`);
            if (targetLeague === 'LCP') schedule = generateLCPRegularSchedule(lgTeams);
            else if (targetLeague === 'CBLOL') schedule = generateCBLOLRegularSchedule(lgTeams); // Generates BO1s
            isUpdated = true;
        }

        const safeLeague = {
            ...league,
            currentChampionList: league.currentChampionList || championList,
            metaVersion: league.metaVersion || '16.01'
        };

        const simMatchIfPast = (matchObj) => {
            if (matchObj.status === 'finished') return matchObj; 
            if (currentPendingLCK.date !== '99.99 (완료)' && compareDatesObj(matchObj, currentPendingLCK) >= 0) return matchObj;

            const t1Obj = findGlobalTeam(matchObj.t1, teams);
            const t2Obj = findGlobalTeam(matchObj.t2, teams);
            if (t1Obj.name === 'TBD' || t2Obj.name === 'TBD') return matchObj; 

            const t1 = { ...t1Obj, roster: getSafeRoster(t1Obj, lgPlayers) };
            const t2 = { ...t2Obj, roster: getSafeRoster(t2Obj, lgPlayers) };

            try {
                const simResult = quickSimulateMatch(t1, t2, matchObj.format, safeLeague.currentChampionList);
                isUpdated = true;
                
                let fScore = simResult.scoreString || simResult.score;
                
                if (matchObj.format === 'BO1') {
                    fScore = '1-0';
                } else {
                    if (typeof fScore === 'object') {
                        fScore = `${Math.max(fScore.A ?? 0, fScore.B ?? 0)}-${Math.min(fScore.A ?? 0, fScore.B ?? 0)}`;
                    }
                    if (!fScore) {
                        const isBO5 = matchObj.format === 'BO5' || matchObj.type === 'playoff';
                        fScore = `${isBO5 ? 3 : 2}-0`;
                    }
                }

                return {
                    ...matchObj,
                    t1: t1.id || t1.name, 
                    t2: t2.id || t2.name,
                    status: 'finished',
                    result: { 
                        winner: simResult.winner?.name || simResult.winner, 
                        score: fScore, 
                        history: [] // Memory Saver: Deletes huge logs for background foreign games
                    }
                };
            } catch (e) {
                console.error("Engine Crash Blocked:", e);
                const isBO1 = matchObj.format === 'BO1';
                const isBO5 = matchObj.format === 'BO5' || matchObj.type === 'playoff';
                const reqWins = isBO5 ? 3 : (isBO1 ? 1 : 2);
                const t1Wins = Math.random() > 0.5;
                isUpdated = true;
                
                return {
                    ...matchObj,
                    t1: t1.id || t1.name, 
                    t2: t2.id || t2.name,
                    status: 'finished',
                    result: {
                        winner: t1Wins ? t1.name : t2.name,
                        score: t1Wins ? `${reqWins}-0` : `0-${reqWins}`,
                        history: [] 
                    }
                };
            }
        };

        schedule = schedule.map(simMatchIfPast);

        let playoffs = hasBadData ? [] : activeMatches.filter(m => m.type === 'playoff' || m.type === 'playin');
        let seeds = league.foreignPlayoffSeeds?.[targetLeague] || [];
        
        if (schedule.every(m => m.status === 'finished')) {
            if (seeds.length === 0 || hasBadData) {
                const standings = {};
                lgTeams.forEach(t => standings[t.name] = { w: 0, l: 0, id: t.id || t.name, name: t.name });
                schedule.forEach(m => {
                    if (m.status === 'finished' && m.result) {
                        const winnerName = m.result.winner;
                        const t1Name = findGlobalTeam(m.t1, teams).name;
                        const t2Name = findGlobalTeam(m.t2, teams).name;
                        const loserName = winnerName === t1Name ? t2Name : t1Name;
                        if (standings[winnerName]) standings[winnerName].w += 1;
                        if (standings[loserName]) standings[loserName].l += 1;
                    }
                });
                const sorted = Object.values(standings).sort((a,b) => b.w - a.w);
                if (targetLeague === 'LCP') seeds = sorted.slice(0, 6).map((t, idx) => ({ ...t, seed: idx + 1 }));
                else if (targetLeague === 'CBLOL') seeds = sorted.slice(0, 8).map((t, idx) => ({ ...t, seed: idx + 1 }));
                isUpdated = true;
            }

            if (playoffs.length === 0) {
                if (targetLeague === 'LCP') playoffs = generateLCPPlayoffs(seeds);
                else if (targetLeague === 'CBLOL') playoffs = generateCBLOLPlayoffs(seeds);
                isUpdated = true;
            }

            const simPlayoffMatch = (id) => {
                const matchObj = playoffs.find(m => m.id === id);
                if (!matchObj || !matchObj.t1 || !matchObj.t2 || matchObj.t1 === 'TBD' || matchObj.t2 === 'TBD') return { winnerId: null, loserId: null };
                
                if (matchObj.status === 'finished') {
                    const wId = findGlobalTeam(matchObj.result.winner, teams).name;
                    const lId = wId === findGlobalTeam(matchObj.t1, teams).name ? matchObj.t2 : matchObj.t1;
                    return { winnerId: wId, loserId: lId };
                }
                
                if (currentPendingLCK.date !== '99.99 (완료)' && compareDatesObj(matchObj, currentPendingLCK) >= 0) return { winnerId: null, loserId: null };

                const simulatedMatch = simMatchIfPast(matchObj);
                Object.assign(matchObj, simulatedMatch); 
                isUpdated = true;

                if (simulatedMatch.status === 'finished') {
                    const wId = findGlobalTeam(simulatedMatch.result.winner, teams).name;
                    const lId = wId === findGlobalTeam(matchObj.t1, teams).name ? matchObj.t2 : matchObj.t1;
                    return { winnerId: wId, loserId: lId };
                }
                return { winnerId: null, loserId: null };
            };

            if (targetLeague === 'LCP') {
                const r1m1 = simPlayoffMatch('lcp_po1');
                const r1m2 = simPlayoffMatch('lcp_po2');
                const po3 = playoffs.find(m => m.id === 'lcp_po3');
                if (po3 && r1m1.winnerId) po3.t2 = r1m1.winnerId;
                const r2m1 = simPlayoffMatch('lcp_po3');
                const po4 = playoffs.find(m => m.id === 'lcp_po4');
                if (po4 && r1m2.winnerId) po4.t2 = r1m2.winnerId;
                const r2m2 = simPlayoffMatch('lcp_po4');
                const po5 = playoffs.find(m => m.id === 'lcp_po5');
                if (po5 && r2m1.winnerId && r2m2.winnerId) { po5.t1 = r2m1.winnerId; po5.t2 = r2m2.winnerId; }
                const r3m1 = simPlayoffMatch('lcp_po5');
                const po6 = playoffs.find(m => m.id === 'lcp_po6');
                if (po6 && r2m1.loserId && r2m2.loserId) { po6.t1 = r2m1.loserId; po6.t2 = r2m2.loserId; }
                const r2lm1 = simPlayoffMatch('lcp_po6');
                const po7 = playoffs.find(m => m.id === 'lcp_po7');
                if (po7 && r2lm1.winnerId && r3m1.loserId) { po7.t1 = r2lm1.winnerId; po7.t2 = r3m1.loserId; }
                const r3lm1 = simPlayoffMatch('lcp_po7');
                const po8 = playoffs.find(m => m.id === 'lcp_po8');
                if (po8 && r3m1.winnerId && r3lm1.winnerId) { po8.t1 = r3m1.winnerId; po8.t2 = r3lm1.winnerId; }
                simPlayoffMatch('lcp_po8');

            } else if (targetLeague === 'CBLOL') {
                const pi1 = simPlayoffMatch('cblol_pi1');
                const pi2 = simPlayoffMatch('cblol_pi2');

                const pi3Match = playoffs.find(m => m.id === 'cblol_pi3');
                if (pi3Match && pi1.winnerId && pi2.loserId) { 
                    pi3Match.t1 = pi1.winnerId; 
                    pi3Match.t2 = pi2.loserId; 
                }
                const pi3 = simPlayoffMatch('cblol_pi3');

                const po1Match = playoffs.find(m => m.id === 'cblol_po1');
                const po2Match = playoffs.find(m => m.id === 'cblol_po2');
                if (pi2.winnerId && pi3.winnerId && po1Match && !po1Match.t2) {
                    let pickSeed6 = Math.random() < 0.90;
                    po1Match.t2 = pickSeed6 ? pi3.winnerId : pi2.winnerId;
                    po2Match.t2 = pickSeed6 ? pi2.winnerId : pi3.winnerId;
                    isUpdated = true;
                }
                const po1 = simPlayoffMatch('cblol_po1');
                const po2 = simPlayoffMatch('cblol_po2');

                const po3Match = playoffs.find(m => m.id === 'cblol_po3');
                const po4Match = playoffs.find(m => m.id === 'cblol_po4');
                if (po1.winnerId && po2.winnerId && po3Match && !po3Match.t2) {
                    const seedA = seeds.find(s => s.id === po1.winnerId || s.name === po1.winnerId)?.seed || 99;
                    const seedB = seeds.find(s => s.id === po2.winnerId || s.name === po2.winnerId)?.seed || 99;
                    const lowerSeedTeam = seedA > seedB ? po1.winnerId : po2.winnerId;
                    const higherSeedTeam = seedA > seedB ? po2.winnerId : po1.winnerId;
                    let pickLower = Math.random() < 0.90;
                    po3Match.t2 = pickLower ? lowerSeedTeam : higherSeedTeam;
                    po4Match.t2 = pickLower ? higherSeedTeam : lowerSeedTeam;
                    isUpdated = true;
                }
                const po3 = simPlayoffMatch('cblol_po3');
                const po4 = simPlayoffMatch('cblol_po4');

                const po5Match = playoffs.find(m => m.id === 'cblol_po5');
                if (po5Match && po3.winnerId && po4.winnerId) { 
                    po5Match.t1 = po3.winnerId; 
                    po5Match.t2 = po4.winnerId; 
                }
                const po5 = simPlayoffMatch('cblol_po5'); 

                const po6Match = playoffs.find(m => m.id === 'cblol_po6');
                if (po6Match && po1.loserId && po2.loserId) { 
                    po6Match.t1 = po1.loserId; 
                    po6Match.t2 = po2.loserId; 
                }
                const po6 = simPlayoffMatch('cblol_po6');

                const po7Match = playoffs.find(m => m.id === 'cblol_po7');
                if (po7Match && po6.winnerId && po3.loserId && po4.loserId && !po7Match.t2) {
                    const seedL3 = seeds.find(s => s.id === po3.loserId || s.name === po3.loserId)?.seed || 99;
                    const seedL4 = seeds.find(s => s.id === po4.loserId || s.name === po4.loserId)?.seed || 99;
                    const lowerSeedLoser = seedL3 > seedL4 ? po3.loserId : po4.loserId;
                    po7Match.t1 = po6.winnerId; 
                    po7Match.t2 = lowerSeedLoser;
                    isUpdated = true;
                }
                const po7 = simPlayoffMatch('cblol_po7');

                const po8Match = playoffs.find(m => m.id === 'cblol_po8');
                if (po8Match && po7.winnerId && po3.loserId && po4.loserId && !po8Match.t2) {
                    const seedL3 = seeds.find(s => s.id === po3.loserId || s.name === po3.loserId)?.seed || 99;
                    const seedL4 = seeds.find(s => s.id === po4.loserId || s.name === po4.loserId)?.seed || 99;
                    const higherSeedLoser = seedL3 < seedL4 ? po3.loserId : po4.loserId;
                    po8Match.t1 = po7.winnerId; 
                    po8Match.t2 = higherSeedLoser;
                    isUpdated = true;
                }
                const po8 = simPlayoffMatch('cblol_po8');

                const po9Match = playoffs.find(m => m.id === 'cblol_po9');
                if (po9Match && po8.winnerId && po5.loserId) { 
                    po9Match.t1 = po8.winnerId; 
                    po9Match.t2 = po5.loserId; 
                }
                const po9 = simPlayoffMatch('cblol_po9');

                const po10Match = playoffs.find(m => m.id === 'cblol_po10');
                if (po10Match && po5.winnerId && po9.winnerId) { 
                    po10Match.t1 = po5.winnerId; 
                    po10Match.t2 = po9.winnerId; 
                }
                simPlayoffMatch('cblol_po10');
            }
        }

        // ONLY save foreignMatches. LCK matches are completely untouched!
        if (isUpdated) {
            const fullSchedule = [...schedule, ...playoffs];
            const updatedLeague = { ...league };
            if (!updatedLeague.foreignMatches) updatedLeague.foreignMatches = { LPL: [], LEC: [], LCS: [], LCP: [], CBLOL: [] };
            
            updatedLeague.foreignMatches[targetLeague] = fullSchedule;
            updatedLeague.foreignPlayoffSeeds = updatedLeague.foreignPlayoffSeeds || {};
            updatedLeague.foreignPlayoffSeeds[targetLeague] = seeds;

            updateLeague(league.id, updatedLeague);
            if (setLeague) setLeague(updatedLeague);
            
            if (forceRegen) setForceRegen(false);
        }
    }, [needsSync, currentPendingLCK, targetLeague, activeMatches, league, setLeague, teams, forceRegen]);

    return (
        <div className="bg-white rounded-lg border shadow-sm p-4 lg:p-8 min-h-[300px] lg:min-h-[600px] flex flex-col h-full lg:h-auto overflow-y-auto relative">
            
            {needsSync && (
                <div className="absolute inset-0 bg-white/80 z-50 flex flex-col items-center justify-center backdrop-blur-sm">
                    <div className="text-4xl animate-spin mb-4">⏳</div>
                    <div className="text-lg font-black text-blue-600 animate-pulse">{targetLeague} 데이터를 복구 및 동기화 중입니다...</div>
                </div>
            )}

            {activeTab === 'schedule' && (
                <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 sticky top-0 z-40 rounded-lg mb-4 sm:mb-6">
                    {['LCK', 'LPL', 'LEC', 'LCS', 'LCP', 'CBLOL'].map(lg => (
                        <button
                            key={lg}
                            onClick={() => setCurrentLeague(lg)}
                            className={`px-5 py-2 rounded-full font-bold text-xs lg:text-sm transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                                currentLeague === lg ? 'bg-blue-600 text-white ring-2 ring-blue-300 transform scale-105' : 'bg-white text-gray-600 hover:bg-gray-200 border border-gray-300'
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
                {/* [MANUAL OVERRIDE BUTTON] visible only on foreign leagues to clear bad save data */}
                {targetLeague && (
                    <button 
                        onClick={() => setForceRegen(true)}
                        className="text-xs bg-red-100 text-red-600 hover:bg-red-200 px-3 py-1.5 rounded-md font-bold shadow-sm transition-all"
                    >
                        🔄 일정 재생성 (오류 수정)
                    </button>
                )}
            </div>
            
            {['LCK', 'LCP', 'CBLOL'].includes(displayLeague) ? (
                activeMatches.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 pb-4">
                        {activeMatches
                            .filter(m => activeTab === 'schedule' || displayLeague !== 'LCK' || (m.t1 === myTeam.id || m.t2 === myTeam.id))
                            .sort(compareDatesObj) 
                            .map((m, i) => {
                                const t1 = findGlobalTeam(m.t1, teams);
                                const t2 = findGlobalTeam(m.t2, teams);
                                const isMyMatch = myTeam.id === m.t1 || myTeam.id === m.t2;
                                const isFinished = m.status === 'finished';
                                
                                const t1Name = (displayLeague === 'LCK' && formatTeamName) ? formatTeamName(m.t1, m.type) : t1.name;
                                const t2Name = (displayLeague === 'LCK' && formatTeamName) ? formatTeamName(m.t2, m.type) : t2.name;

                                let badgeColor = 'text-gray-500';
                                let badgeText = '정규시즌';
                                if (m.type === 'super') { badgeColor = 'text-purple-600'; badgeText = '🔥 슈퍼위크'; }
                                else if (m.type === 'playin') { badgeColor = 'text-indigo-600'; badgeText = m.label || '플레이-인'; }
                                else if (m.type === 'playoff') { badgeColor = 'text-yellow-600'; badgeText = m.label || '플레이오프'; }

                                // [SAFE UI RENDERING] Respects LCK BO3/BO5 completely, uses 1-0 only for BO1s.
                                const expectedFallbackScore = m.format === 'BO1' ? '1-0' : (m.format === 'BO5' ? '3-0' : '2-0');

                                return (
                                    <div key={i} className={`p-3 lg:p-4 rounded-lg border flex flex-col gap-1 lg:gap-2 ${isMyMatch && displayLeague === 'LCK' ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-gray-200'}`}>
                                        <div className="flex justify-between text-[10px] lg:text-xs font-bold text-gray-500">
                                            <span>{m.date} {m.time}</span>
                                            <span className={`font-bold ${badgeColor}`}>{badgeText}</span>
                                        </div>
                                        <div className="flex justify-between items-center mt-1 lg:mt-2">
                                            <div className="flex flex-col items-center w-1/3">
                                                <span className={`font-bold text-xs lg:text-base text-center break-keep leading-tight ${isMyMatch && myTeam.id === m.t1 && displayLeague === 'LCK' ? 'text-blue-600' : 'text-gray-800'}`}>{t1Name}</span>
                                                {isFinished && m.result?.winner === t1.name && <span className="text-[10px] lg:text-xs text-blue-500 font-bold mt-1">WIN</span>}
                                            </div>
                                            <div className="text-center font-bold flex flex-col items-center shrink-0 w-1/4">
                                            {isFinished ? (
                                                <div className="flex flex-col items-center">
                                                    <span className="text-lg lg:text-xl text-gray-800">
                                                        {m.result?.score || expectedFallbackScore}
                                                    </span>
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
                        <div className="text-lg lg:text-xl font-bold">{displayLeague} 일정이 없습니다.</div>
                        <p className="mt-2 text-sm text-gray-500">LCK 리그가 시작되면 일정이 자동으로 생성됩니다.</p>
                    </div>
                )
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <div className="text-4xl lg:text-6xl mb-3 lg:mb-4 animate-bounce">🌍</div>
                    <div className="text-xl lg:text-2xl font-black text-gray-600">{currentLeague} 일정 준비 중</div>
                </div>
            )}
        </div>
    );
};

export default ScheduleTab;