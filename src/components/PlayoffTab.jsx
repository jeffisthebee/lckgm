// src/components/PlayoffTab.jsx
import React, { useState } from 'react';
import MatchupBox from './MatchupBox'; 
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';

const PlayoffTab = ({ 
    league, 
    teams, 
    hasPlayoffsGenerated, 
    handleMatchClick 
}) => {
    const [currentLeague, setCurrentLeague] = useState('LCK');
    
    if (!league || !teams) return <div className="p-10 text-center text-gray-500">데이터 로딩 중...</div>;

    const isLCK = currentLeague === 'LCK';
    const isLCPGenerated = league.foreignMatches?.['LCP']?.some(m => m.type === 'playoff');
    const isLckFinished = !league.matches?.some(m => m.status === 'pending');

    const findGlobalTeam = (token) => {
        const strToken = String(token);
        if (!token || strToken === 'TBD' || strToken === 'null' || strToken === 'undefined') return { name: 'TBD' };
        
        const s = strToken.trim().toUpperCase();
        const pool = [...teams, ...Object.values(FOREIGN_LEAGUES).flat()];
        const found = pool.find(t =>
            (t.id && String(t.id).toUpperCase() === s) ||
            (t.name && String(t.name).toUpperCase() === s) ||
            (t.fullName && String(t.fullName).toUpperCase() === s)
        );
        return found || { name: strToken }; 
    };

    const getLcpSeeds = () => {
        if (league.foreignPlayoffSeeds?.['LCP']?.length > 0) return league.foreignPlayoffSeeds['LCP'];
        const lcpTeams = FOREIGN_LEAGUES['LCP'] || [];
        const st = {};
        lcpTeams.forEach(t => st[t.name] = { w: 0, id: t.id || t.name, name: t.name });
        const regular = (league.foreignMatches?.['LCP'] || []).filter(m => m.type !== 'playoff' && m.status === 'finished');
        regular.forEach(m => { if (m.result?.winner && st[m.result.winner]) st[m.result.winner].w++; });
        return Object.values(st).sort((a,b) => b.w - a.w).map((t, idx) => ({ ...t, seed: idx + 1 }));
    };
    const computedLcpSeeds = getLcpSeeds();

    const getCblolSeeds = () => {
        const cblolTeams = FOREIGN_LEAGUES['CBLOL'] || [];
        const st = {};
        cblolTeams.forEach(t => st[t.name] = { w: 0, id: t.id || t.name, name: t.name });
        const regular = (league.foreignMatches?.['CBLOL'] || []).filter(m => m.type !== 'playoff' && m.type !== 'playin' && m.status === 'finished');
        regular.forEach(m => { if (m.result?.winner && st[m.result.winner]) st[m.result.winner].w++; });
        let base = league.foreignPlayoffSeeds?.['CBLOL']?.length > 0
            ? league.foreignPlayoffSeeds['CBLOL']
            : Object.values(st).sort((a, b) => b.w - a.w).map((t, idx) => ({ ...t, seed: idx + 1 }));

        const cblolMatches = league.foreignMatches?.['CBLOL'] || [];
        const pi2 = cblolMatches.find(m => m.id === 'cblol_pi2');
        const pi3 = cblolMatches.find(m => m.id === 'cblol_pi3');
        const pi2Winner = pi2?.status === 'finished' ? findGlobalTeam(pi2.result?.winner).name : null;
        const pi3Winner = pi3?.status === 'finished' ? findGlobalTeam(pi3.result?.winner).name : null;

        if (pi2Winner) {
            base = base.map(s => s.seed === 5 ? { ...s, id: pi2Winner, name: pi2Winner } : s);
        }
        if (pi3Winner) {
            base = base.map(s => s.seed === 6 ? { ...s, id: pi3Winner, name: pi3Winner } : s);
        }
        return base;
    };
    const computedCblolSeeds = getCblolSeeds();

    // --- [NEW] LCS SEED GENERATOR ---
    const getLcsSeeds = () => {
        let base = league.foreignPlayoffSeeds?.['LCS'] || [];
        
        if (!base || base.length === 0) {
            const lcsTeams = FOREIGN_LEAGUES['LCS'] || [];
            const st = {};
            lcsTeams.forEach(t => st[t.name] = { w: 0, id: t.id || t.name, name: t.name });
            const regular = (league.foreignMatches?.['LCS'] || []).filter(m => (m.type === 'regular' || m.type === 'super') && m.status === 'finished');
            regular.forEach(m => { if (m.result?.winner && st[m.result.winner]) st[m.result.winner].w++; });
            base = Object.values(st).sort((a, b) => b.w - a.w).map((t, idx) => ({ ...t, seed: idx + 1 }));
        }

        // Override Seed 6 from Playin Match
        const lcsMatches = league.foreignMatches?.['LCS'] || [];
        const pi1 = lcsMatches.find(m => m.id === 'lcs_pi1');
        const pi1Winner = pi1?.status === 'finished' ? findGlobalTeam(pi1.result?.winner).name : null;

        if (pi1Winner) {
            base = base.map(s => s.seed === 6 ? { ...s, id: pi1Winner, name: pi1Winner } : s);
        }
        return base;
    };
    const computedLcsSeeds = getLcsSeeds();

    // --- LEC SEED GENERATOR ---
    const getLecSeeds = () => {
        let base = league.foreignPlayoffSeeds?.['LEC'] || [];
        if (!base || base.length === 0) {
            const lecTeams = FOREIGN_LEAGUES['LEC'] || [];
            const st = {};
            lecTeams.forEach(t => st[t.name] = { w: 0, l: 0, diff: 0, h2h: {}, defeatedOpponents: [], id: t.id || t.name, name: t.name });
            const regular = (league.foreignMatches?.['LEC'] || []).filter(m => m.type === 'regular' && m.status === 'finished');
            regular.forEach(m => {
                const winner = m.result?.winner;
                const t1 = lecTeams.find(t => t.name === m.t1 || String(t.id) === String(m.t1))?.name || m.t1;
                const t2 = lecTeams.find(t => t.name === m.t2 || String(t.id) === String(m.t2))?.name || m.t2;
                const loser = winner === t1 ? t2 : t1;
                let diff = 0;
                if (m.result?.score) { const pts = String(m.result.score).split(/[-:]/).map(Number); if (pts.length === 2 && !isNaN(pts[0]) && !isNaN(pts[1])) diff = Math.abs(pts[0] - pts[1]); }
                if (st[winner]) { st[winner].w++; st[winner].diff += diff; st[winner].defeatedOpponents.push(loser); if (!st[winner].h2h[loser]) st[winner].h2h[loser] = { w: 0, l: 0 }; st[winner].h2h[loser].w += 1; }
                if (st[loser]) { st[loser].l++; st[loser].diff -= diff; if (!st[loser].h2h[winner]) st[loser].h2h[winner] = { w: 0, l: 0 }; st[loser].h2h[winner].l += 1; }
            });
            const tiedGroups = {};
            Object.values(st).forEach(r => { const k = `${r.w}_${r.diff}`; if (!tiedGroups[k]) tiedGroups[k] = []; tiedGroups[k].push(r.name); });
            base = Object.values(st).sort((a, b) => {
                if (b.w !== a.w) return b.w - a.w;
                if (b.diff !== a.diff) return b.diff - a.diff;
                const tieKey = `${a.w}_${a.diff}`;
                if ((tiedGroups[tieKey]?.length || 0) === 2) { const aW = a.h2h[b.name]?.w || 0; const bW = b.h2h[a.name]?.w || 0; if (aW !== bW) return bW - aW; }
                let sovA = 0, sovB = 0;
                a.defeatedOpponents.forEach(o => { sovA += (st[o]?.w || 0); });
                b.defeatedOpponents.forEach(o => { sovB += (st[o]?.w || 0); });
                return sovB - sovA;
            }).map((t, idx) => ({ ...t, seed: idx + 1 }));
        }
        return base;
    };
    const computedLecSeeds = getLecSeeds();

    const getBracketDisplayName = (teamId) => {
        const strId = String(teamId);
        if (!teamId || strId === 'TBD' || strId === 'null' || strId === 'undefined') return 'TBD';
        
        const team = findGlobalTeam(teamId);
        const displayName = team.name;

        const seeds = currentLeague === 'LCP'   ? computedLcpSeeds
                    : currentLeague === 'CBLOL'  ? computedCblolSeeds
                    : currentLeague === 'LCS'    ? computedLcsSeeds
                    : currentLeague === 'LEC'    ? computedLecSeeds
                    : (league.playoffSeeds || []);
                    
        const seedInfo = seeds.find(s => 
            (s.id && String(s.id).toUpperCase() === strId.toUpperCase()) ||
            (s.name && String(s.name).toUpperCase() === String(displayName).toUpperCase())
        );

        return seedInfo ? `${displayName} (${seedInfo.seed}시드)` : displayName;
    };

    const BracketColumn = ({ title, children, className }) => (
        <div className={`flex flex-col items-center justify-start w-52 space-y-6 ${className}`}>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{title}</h4>
            <div className="w-full flex flex-col items-center">{children}</div>
        </div>
    );

    const getValidTeam = (actualTeam, expectedTeam) => {
        const actualStr = String(actualTeam);
        if (actualTeam && actualStr !== 'TBD' && actualStr !== 'null' && actualStr !== 'undefined') return actualTeam;
        return expectedTeam || null;
    };

    const displayMatch = (actual, expectedT1, expectedT2) => {
        return {
            ...(actual || { status: 'pending', type: 'playoff' }),
            t1: getValidTeam(actual?.t1, expectedT1),
            t2: getValidTeam(actual?.t2, expectedT2)
        };
    };

    const getMatchWinner = (m) => {
        if (!m || m.status !== 'finished' || !m.result?.winner) return null;
        const winnerName = String(m.result.winner).toUpperCase();
        const t1Name = findGlobalTeam(m.t1).name.toUpperCase();
        const t2Name = findGlobalTeam(m.t2).name.toUpperCase();
        if (t1Name === winnerName) return m.t1;
        if (t2Name === winnerName) return m.t2;
        return m.result.winner; 
    };

    const getMatchLoser = (m) => {
        if (!m || m.status !== 'finished' || !m.result?.winner) return null;
        const winnerName = String(m.result.winner).toUpperCase();
        const t1Name = findGlobalTeam(m.t1).name.toUpperCase();
        const t2Name = findGlobalTeam(m.t2).name.toUpperCase();
        if (t1Name === winnerName) return m.t2;
        if (t2Name === winnerName) return m.t1;
        return null;
    };

    // --- LCS BRACKET RENDERER ---
    const renderLCSBracket = () => {
        const allMatches = league.foreignMatches?.['LCS'] || [];
        const findM = (id) => allMatches.find(m => m.id === id);

        const getSeedToken = (num) => {
            const s = computedLcsSeeds.find(x => x.seed === num);
            return s ? (s.id || s.name) : null;
        };

        // --- Play-in ---
        const dispPi1 = displayMatch(findM('lcs_pi1'), getSeedToken(6), getSeedToken(7));

        // --- Upper Bracket ---
        const mPo1 = findM('lcs_po1');
        const mPo2 = findM('lcs_po2');
        const dispPo1 = displayMatch(mPo1, getSeedToken(1), mPo1?.t2 || getSeedToken(4)); // t2 dynamically picked
        const dispPo2 = displayMatch(mPo2, getSeedToken(2), mPo2?.t2 || getSeedToken(3)); 
        const dispPo3 = displayMatch(findM('lcs_po3'), getMatchWinner(dispPo1), getMatchWinner(dispPo2));

        // --- Lower Bracket ---
        const dispPo4 = displayMatch(findM('lcs_po4'), getSeedToken(5), getMatchLoser(dispPo1));
        const dispPo5 = displayMatch(findM('lcs_po5'), getMatchWinner(dispPi1) || getSeedToken(6), getMatchLoser(dispPo2));
        
        const dispPo6 = displayMatch(findM('lcs_po6'), getMatchWinner(dispPo4), getMatchWinner(dispPo5));
        const dispPo7 = displayMatch(findM('lcs_po7'), getMatchLoser(dispPo3), getMatchWinner(dispPo6));

        // --- Grand Finals ---
        const dispFinal = displayMatch(findM('lcs_po8'), getMatchWinner(dispPo3), getMatchWinner(dispPo7));

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-16 min-w-[1100px] relative pt-12">
                    
                    {/* Playin */}
                    <div className="relative border-b-2 border-dashed border-gray-200 pb-10">
                        <h3 className="text-lg font-black text-indigo-600 mb-8 absolute -top-2">플레이-인 (Play-In)</h3>
                        <div className="flex items-start space-x-16 mt-8">
                            <BracketColumn title="최종 진출전">
                                <MatchupBox match={dispPi1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                        </div>
                    </div>

                    {/* Upper Bracket */}
                    <div className="relative border-b-2 border-dashed border-gray-200 pb-10">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Upper Bracket)</h3>
                        <div className="flex items-start mt-8 space-x-10">
                            <BracketColumn title="승자조 1라운드">
                                <div className="flex flex-col space-y-16">
                                    <MatchupBox match={dispPo1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispPo2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 결승">
                                <div className="flex flex-col justify-center h-full pt-20">
                                    <MatchupBox match={dispPo3} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="🏆 결승전">
                                <div className="flex flex-col justify-center h-full pt-20">
                                    <MatchupBox match={dispFinal} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                        </div>
                    </div>

                    {/* Lower Bracket */}
                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Lower Bracket)</h3>
                        <div className="flex items-start space-x-10 mt-8">
                            <BracketColumn title="패자조 1라운드">
                                <div className="flex flex-col space-y-16">
                                    <MatchupBox match={dispPo4} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispPo5} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="패자조 2라운드">
                                <div className="flex flex-col justify-center h-full pt-20">
                                    <MatchupBox match={dispPo6} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="결승 진출전">
                                <div className="flex flex-col justify-center h-full pt-20">
                                    <MatchupBox match={dispPo7} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                        </div>
                    </div>

                </div>
            </div>
        );
    };

    const renderLCPBracket = () => {
        const lcpMatches = league.foreignMatches?.['LCP']?.filter(m => m.type === 'playoff') || [];
        const findM = (round, matchNum) => lcpMatches.find(m => m.round === round && m.match === matchNum);

        const getSeedToken = (num) => {
            const s = computedLcpSeeds.find(x => x.seed === num);
            return s ? (s.id || s.name) : null;
        };

        const dispR1m1 = displayMatch(findM(1, 1), getSeedToken(3), getSeedToken(6));
        const dispR1m2 = displayMatch(findM(1, 2), getSeedToken(4), getSeedToken(5));
        
        const dispR2m1 = displayMatch(findM(2, 1), getSeedToken(1), getMatchWinner(dispR1m1));
        const dispR2m2 = displayMatch(findM(2, 2), getSeedToken(2), getMatchWinner(dispR1m2));
        
        const dispR3m1 = displayMatch(findM(3, 1), getMatchWinner(dispR2m1), getMatchWinner(dispR2m2));
        
        const dispR2lm1 = displayMatch(findM(2.1, 1), getMatchLoser(dispR2m1), getMatchLoser(dispR2m2));
        const dispR3lm1 = displayMatch(findM(3.1, 1), getMatchWinner(dispR2lm1), getMatchLoser(dispR3m1));
        
        const dispFinal = displayMatch(findM(4, 1), getMatchWinner(dispR3m1), getMatchWinner(dispR3lm1));

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-24 min-w-[1200px] relative pt-12">
                    {/* Upper Bracket */}
                    <div className="relative border-b-2 border-dashed pb-16">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Upper Bracket)</h3>
                        <div className="flex justify-between items-center mt-8">
                            <BracketColumn title="PO 1라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={dispR1m1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispR1m2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="PO 2라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={dispR2m1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispR2m2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 결승">
                                <MatchupBox match={dispR3m1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="🏆 결승전">
                                <MatchupBox match={dispFinal} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                        </div>
                    </div>

                    {/* Lower Bracket */}
                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Lower Bracket)</h3>
                        <div className="flex justify-start items-center space-x-24 mt-8">
                            <BracketColumn title="패자조 1R">
                                <MatchupBox match={dispR2lm1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="결승 진출전">
                                <MatchupBox match={dispR3lm1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                        </div>
                    </div>
                </div>
            </div>
        );
    };


    const renderCBLOLBracket = () => {
        const allMatches = league.foreignMatches?.['CBLOL'] || [];
        const findM = (id) => allMatches.find(m => m.id === id);

        const getSeedToken = (num) => {
            const s = computedCblolSeeds.find(x => x.seed === num);
            return s ? (s.id || s.name) : null;
        };

        const dispPi1 = displayMatch(findM('cblol_pi1'), getSeedToken(7), getSeedToken(8));
        const dispPi2 = displayMatch(findM('cblol_pi2'), getSeedToken(5), getSeedToken(6));
        const dispPi3 = displayMatch(findM('cblol_pi3'), getMatchWinner(dispPi1), getMatchLoser(dispPi2));

        const dispPo1 = displayMatch(findM('cblol_po1'), getSeedToken(1), getMatchWinner(dispPi3) || getMatchWinner(dispPi2));
        const dispPo2 = displayMatch(findM('cblol_po2'), getSeedToken(2), getMatchLoser(dispPi3) || getMatchWinner(dispPi2));
        const dispPo3 = displayMatch(findM('cblol_po3'), getSeedToken(3), getMatchWinner(dispPo1) || getMatchWinner(dispPo2));
        const dispPo4 = displayMatch(findM('cblol_po4'), getSeedToken(4), getMatchWinner(dispPo2) || getMatchWinner(dispPo1));
        const dispPo5 = displayMatch(findM('cblol_po5'), getMatchWinner(dispPo3), getMatchWinner(dispPo4));

        const dispPo6 = displayMatch(findM('cblol_po6'), getMatchLoser(dispPo1), getMatchLoser(dispPo2));
        const dispPo7 = displayMatch(findM('cblol_po7'), getMatchWinner(dispPo6), getMatchLoser(dispPo3) || getMatchLoser(dispPo4));
        const dispPo8 = displayMatch(findM('cblol_po8'), getMatchWinner(dispPo7), getMatchLoser(dispPo4) || getMatchLoser(dispPo3));
        const dispPo9 = displayMatch(findM('cblol_po9'), getMatchWinner(dispPo8), getMatchLoser(dispPo5));

        const dispFinal = displayMatch(findM('cblol_po10'), getMatchWinner(dispPo5), getMatchWinner(dispPo9));

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-16 min-w-[1500px] relative pt-12">

                    <div className="relative border-b-2 border-dashed border-gray-200 pb-10">
                        <h3 className="text-lg font-black text-indigo-600 mb-8 absolute -top-2">플레이-인 (Play-In)</h3>
                        <div className="flex items-start space-x-16 mt-8">
                            <BracketColumn title="플레이-인 1R">
                                <div className="flex flex-col space-y-6">
                                    <MatchupBox match={dispPi1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispPi2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="플레이-인 결정전">
                                <MatchupBox match={dispPi3} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                        </div>
                    </div>

                    <div className="relative border-b-2 border-dashed border-gray-200 pb-10">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Upper Bracket)</h3>
                        <div className="flex items-start justify-between mt-8">
                            <BracketColumn title="승자조 1라운드">
                                <div className="flex flex-col space-y-6">
                                    <MatchupBox match={dispPo1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispPo2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 2라운드">
                                <div className="flex flex-col space-y-6">
                                    <MatchupBox match={dispPo3} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispPo4} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 결승">
                                <MatchupBox match={dispPo5} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="🏆 결승전">
                                <MatchupBox match={dispFinal} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                        </div>
                    </div>

                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Lower Bracket)</h3>
                        <div className="flex items-start space-x-10 mt-8">
                            <BracketColumn title="패자조 1라운드">
                                <MatchupBox match={dispPo6} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="패자조 2라운드">
                                <MatchupBox match={dispPo7} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="패자조 3라운드">
                                <MatchupBox match={dispPo8} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="패자조 4라운드">
                                <MatchupBox match={dispPo9} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                        </div>
                    </div>

                </div>
            </div>
        );
    };

    // --- LEC BRACKET RENDERER ---
    const renderLECBracket = () => {
        const allMatches = league.foreignMatches?.['LEC'] || [];
        const findM = (id) => allMatches.find(m => m.id === id);

        const getSeedToken = (num) => {
            const s = computedLecSeeds.find(x => x.seed === num);
            return s ? (s.id || s.name) : null;
        };

        // ── Upper Bracket Round 1 ────────────────────────────────────────
        // S1 vs S8, S2 vs S7, S3 vs S6, S4 vs S5
        const dispUb1g1 = displayMatch(findM('lec_po_ub1g1'), getSeedToken(1), getSeedToken(8));
        const dispUb1g2 = displayMatch(findM('lec_po_ub1g2'), getSeedToken(2), getSeedToken(7));
        const dispUb1g3 = displayMatch(findM('lec_po_ub1g3'), getSeedToken(3), getSeedToken(6));
        const dispUb1g4 = displayMatch(findM('lec_po_ub1g4'), getSeedToken(4), getSeedToken(5));

        // ── Upper Bracket Round 2 ────────────────────────────────────────
        // ub1g1W vs ub1g4W,  ub1g2W vs ub1g3W
        const dispUb2g1 = displayMatch(findM('lec_po_ub2g1'), getMatchWinner(dispUb1g1), getMatchWinner(dispUb1g4));
        const dispUb2g2 = displayMatch(findM('lec_po_ub2g2'), getMatchWinner(dispUb1g2), getMatchWinner(dispUb1g3));

        // ── Lower Bracket Round 1 ────────────────────────────────────────
        // ub1g1L vs ub1g4L,  ub1g2L vs ub1g3L
        const dispLb1g1 = displayMatch(findM('lec_po_lb1g1'), getMatchLoser(dispUb1g1), getMatchLoser(dispUb1g4));
        const dispLb1g2 = displayMatch(findM('lec_po_lb1g2'), getMatchLoser(dispUb1g2), getMatchLoser(dispUb1g3));

        // ── Lower Bracket Round 2 ────────────────────────────────────────
        // lb1g1W vs ub2g2L,  lb1g2W vs ub2g1L
        const dispLb2g1 = displayMatch(findM('lec_po_lb2g1'), getMatchWinner(dispLb1g1), getMatchLoser(dispUb2g2));
        const dispLb2g2 = displayMatch(findM('lec_po_lb2g2'), getMatchWinner(dispLb1g2), getMatchLoser(dispUb2g1));

        // ── Upper Final ──────────────────────────────────────────────────
        const dispUbf = displayMatch(findM('lec_po_ubf'), getMatchWinner(dispUb2g1), getMatchWinner(dispUb2g2));

        // ── Lower Semifinal ──────────────────────────────────────────────
        const dispLbsf = displayMatch(findM('lec_po_lbsf'), getMatchWinner(dispLb2g1), getMatchWinner(dispLb2g2));

        // ── Round 4: lbsfW vs ubfL ───────────────────────────────────────
        const dispR4 = displayMatch(findM('lec_po_r4'), getMatchWinner(dispLbsf), getMatchLoser(dispUbf));

        // ── Grand Final: r4W vs ubfW ─────────────────────────────────────
        const dispFinal = displayMatch(findM('lec_po_final'), getMatchWinner(dispUbf), getMatchWinner(dispR4));

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-16 min-w-[1400px] relative pt-12">

                    {/* ── 승자조 (Upper Bracket) ─────────────────────── */}
                    <div className="relative border-b-2 border-dashed border-gray-200 pb-12">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Upper Bracket)</h3>
                        <div className="flex items-start justify-between mt-8">
                            <BracketColumn title="승자조 1라운드">
                                <div className="flex flex-col space-y-6">
                                    <MatchupBox match={dispUb1g1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispUb1g2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispUb1g3} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispUb1g4} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 2라운드">
                                <div className="flex flex-col space-y-6 pt-16">
                                    <MatchupBox match={dispUb2g1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispUb2g2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 결승 (UBF)">
                                <div className="flex flex-col justify-center pt-32">
                                    <MatchupBox match={dispUbf} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="🏆 결승전">
                                <div className="flex flex-col justify-center pt-32">
                                    <MatchupBox match={dispFinal} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                        </div>
                    </div>

                    {/* ── 패자조 (Lower Bracket) ─────────────────────── */}
                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Lower Bracket)</h3>
                        <div className="flex items-start space-x-10 mt-8">
                            <BracketColumn title="패자조 1라운드">
                                <div className="flex flex-col space-y-6">
                                    <MatchupBox match={dispLb1g1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispLb1g2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="패자조 2라운드">
                                <div className="flex flex-col space-y-6">
                                    <MatchupBox match={dispLb2g1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispLb2g2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="패자조 준결승 (LBSF)">
                                <div className="flex flex-col justify-center pt-6">
                                    <MatchupBox match={dispLbsf} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="결승 진출전">
                                <div className="flex flex-col justify-center pt-6">
                                    <MatchupBox match={dispR4} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                        </div>
                    </div>

                </div>
            </div>
        );
    };

    const renderLCKBracket = () => {
        const poMatches = league.matches ? league.matches.filter(m => m.type === 'playoff') : [];
        const findMatch = (round, matchNum) => poMatches.find(m => m.round === round && m.match === matchNum);

        const getLckSeedId = (num) => {
            const s = league.playoffSeeds?.find(item => item.seed === num);
            return s ? s.id : null;
        };

        const dispR1m1 = displayMatch(findMatch(1, 1), getLckSeedId(3), getLckSeedId(6));
        const dispR1m2 = displayMatch(findMatch(1, 2), getLckSeedId(4), getLckSeedId(5));
        const dispR2m1 = displayMatch(findMatch(2, 1), getLckSeedId(1), getMatchWinner(dispR1m1));
        const dispR2m2 = displayMatch(findMatch(2, 2), getLckSeedId(2), getMatchWinner(dispR1m2));
        
        const getHigherSeedLoser = (mA, mB) => {
            const lA = getMatchLoser(mA);
            const lB = getMatchLoser(mB);
            if (!lA) return lB;
            if (!lB) return lA;
            const sA = league.playoffSeeds?.find(s => s.id === lA)?.seed || 99;
            const sB = league.playoffSeeds?.find(s => s.id === lB)?.seed || 99;
            return sA < sB ? lA : lB;
        };

        const getLowerSeedLoser = (mA, mB) => {
            const higher = getHigherSeedLoser(mA, mB);
            const lA = getMatchLoser(mA);
            return (lA === higher) ? getMatchLoser(mB) : lA;
        };

        const dispR2lm1 = displayMatch(findMatch(2.1, 1), getMatchLoser(dispR1m1), getMatchLoser(dispR1m2));
        const dispR2lm2 = displayMatch(findMatch(2.2, 1), getHigherSeedLoser(dispR2m1, dispR2m2), getMatchWinner(dispR2lm1));
        const dispR3m1 = displayMatch(findMatch(3, 1), getMatchWinner(dispR2m1), getMatchWinner(dispR2m2));
        const dispR3lm1 = displayMatch(findMatch(3.1, 1), getLowerSeedLoser(dispR2m1, dispR2m2), getMatchWinner(dispR2lm2));
        const dispR4m1 = displayMatch(findMatch(4, 1), getMatchLoser(dispR3m1), getMatchWinner(dispR3lm1));
        const dispFinal = displayMatch(findMatch(5, 1), getMatchWinner(dispR3m1), getMatchWinner(dispR4m1));

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-24 min-w-[1400px] relative pt-12">
                    <div className="relative border-b-2 border-dashed pb-16">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Winner's Bracket)</h3>
                        <div className="flex justify-between items-center mt-8">
                            <BracketColumn title="1라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={dispR1m1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispR1m2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 2R">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={dispR2m1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={dispR2m2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 결승">
                                <MatchupBox match={dispR3m1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="결승전">
                                <MatchupBox match={dispFinal} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                        </div>
                    </div>

                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Loser's Bracket)</h3>
                        <div className="flex justify-start items-center space-x-24 mt-8">
                            <BracketColumn title="패자조 1R">
                                <MatchupBox match={dispR2lm1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="패자조 2R">
                                <MatchupBox match={dispR2lm2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="패자조 3R">
                                <MatchupBox match={dispR3lm1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="결승 진출전">
                                <MatchupBox match={dispR4m1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg border shadow-sm p-6 min-h-[800px] flex flex-col">
            
            <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 rounded-lg mb-4 sm:mb-6">
                {['LCK', 'LPL', 'LEC', 'LCS', 'LCP', 'CBLOL'].map(lg => (
                    <button
                        key={lg}
                        onClick={() => setCurrentLeague(lg)}
                        className={`px-5 py-2 rounded-full font-bold text-xs lg:text-sm transition-all whitespace-nowrap shadow-sm active:scale-95 ${
                            currentLeague === lg ? 'bg-blue-600 text-white shadow-lg' : 'bg-white text-gray-600'
                        }`}
                    >
                        {lg}
                    </button>
                ))}
            </div>

            <h2 className="text-2xl font-black text-gray-900 mb-6">
                👑 2026 {currentLeague} 플레이오프
            </h2>

            {isLCK ? (
                hasPlayoffsGenerated ? renderLCKBracket() : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="text-xl font-bold">플레이오프가 아직 시작되지 않았습니다</div>
                    </div>
                )
            ) : currentLeague === 'LCP' ? (
                (isLCPGenerated || isLckFinished) ? renderLCPBracket() : (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                        <div className="text-xl font-bold">LCP 플레이오프 대진표 준비 중</div>
                    </div>
                )
            ) : currentLeague === 'CBLOL' ? (
                (league.foreignMatches?.['CBLOL']?.some(m => m.type === 'playoff' || m.type === 'playin') || isLckFinished)
                    ? renderCBLOLBracket()
                    : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <div className="text-xl font-bold">CBLOL 플레이오프 대진표 준비 중</div>
                        </div>
                    )
            // --- [THE FIX] ADDED LCS RENDER TRIGGER ---
            ) : currentLeague === 'LCS' ? (
                (league.foreignMatches?.['LCS']?.some(m => m.type === 'playoff' || m.type === 'playin') || isLckFinished)
                    ? renderLCSBracket()
                    : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <div className="text-xl font-bold">LCS 플레이오프 대진표 준비 중</div>
                        </div>
                    )
            ) : currentLeague === 'LEC' ? (
                (league.foreignMatches?.['LEC']?.some(m => m.type === 'playoff') || isLckFinished)
                    ? renderLECBracket()
                    : (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                            <div className="text-xl font-bold">LEC 플레이오프 대진표 준비 중</div>
                        </div>
                    )
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <div className="text-xl font-black text-gray-600">{currentLeague} 플레이오프 준비 중</div>
                </div>
            )}
        </div>
    );
};

export default PlayoffTab;