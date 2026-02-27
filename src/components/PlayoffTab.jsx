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
    
    if (!league || !teams) {
        return <div className="p-10 text-center text-gray-500">데이터 로딩 중...</div>;
    }

    const isLCK = currentLeague === 'LCK';
    const isLCPGenerated = league.foreignMatches?.['LCP']?.some(m => m.type === 'playoff');
    const isLckFinished = !league.matches?.some(m => m.status === 'pending');

    // ─── SUPER SEARCH: Resolves IDs, Names, and Full Names universally ───
    const findGlobalTeam = (token) => {
        if (!token || token === 'TBD' || token === 'null') return { name: 'TBD' };
        const s = String(token).trim().toUpperCase();
        const pool = [...teams, ...Object.values(FOREIGN_LEAGUES).flat()];
        const found = pool.find(t =>
            (t.id && String(t.id).toUpperCase() === s) ||
            (t.name && String(t.name).toUpperCase() === s) ||
            (t.fullName && String(t.fullName).toUpperCase() === s)
        );
        return found || { name: String(token) }; 
    };

    // ─── DYNAMIC SEED CALCULATOR ───
    // If the database forgot the seeds, we calculate them perfectly on the fly!
    const getLcpSeeds = () => {
        if (league.foreignPlayoffSeeds?.['LCP']?.length > 0) {
            return league.foreignPlayoffSeeds['LCP'];
        }
        const lcpTeams = FOREIGN_LEAGUES['LCP'] || [];
        const st = {};
        lcpTeams.forEach(t => st[t.name] = { w: 0, id: t.id || t.name, name: t.name });
        const regular = (league.foreignMatches?.['LCP'] || []).filter(m => m.type !== 'playoff' && m.status === 'finished');
        regular.forEach(m => {
            if (m.result?.winner && st[m.result.winner]) st[m.result.winner].w++;
        });
        const sorted = Object.values(st).sort((a,b) => b.w - a.w);
        return sorted.map((t, idx) => ({ ...t, seed: idx + 1 }));
    };
    const computedLcpSeeds = getLcpSeeds();

    // ─── BRACKET FORMATTER ───
    const getBracketDisplayName = (teamId) => {
        if (!teamId || teamId === 'TBD') return 'TBD';
        
        const team = findGlobalTeam(teamId);
        const displayName = team.name;

        const seeds = currentLeague === 'LCP' ? computedLcpSeeds : (league.playoffSeeds || []);
        const seedInfo = seeds.find(s => 
            (s.id && String(s.id).toUpperCase() === String(teamId).toUpperCase()) ||
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

    // ─── INTELLIGENT PATHING ENGINE ───
    const getValidTeam = (actualTeam, expectedTeam) => {
        // Trust the DB if it has real data. If it has TBD or null, forcefully inject the expected math!
        if (actualTeam && actualTeam !== 'TBD' && actualTeam !== 'null') return actualTeam;
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
        return m.result.winner; // absolute fallback
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

    // ─── LCP BRACKET LOGIC ───────────────────────────────────────────────────
    const renderLCPBracket = () => {
        const lcpMatches = league.foreignMatches?.['LCP']?.filter(m => m.type === 'playoff') || [];
        const findM = (round, matchNum) => lcpMatches.find(m => m.round === round && m.match === matchNum);

        const getSeedToken = (num) => {
            const s = computedLcpSeeds.find(x => x.seed === num);
            return s ? (s.id || s.name) : null;
        };

        // Construct display objects that cascade logically!
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

    // ─── LCK BRACKET LOGIC ───────────────────────────────────────────────────
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
            <div className="flex gap-2 p-3 border-b bg-gray-100 overflow-x-auto shrink-0 sticky top-0 z-50 rounded-lg mb-4 sm:mb-6">
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
            ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400 py-10 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <div className="text-xl font-black text-gray-600">{currentLeague} 플레이오프 준비 중</div>
                </div>
            )}
        </div>
    );
};

export default PlayoffTab;