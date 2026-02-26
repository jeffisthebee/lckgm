// src/components/PlayoffTab.jsx
import React, { useState } from 'react';
import MatchupBox from './MatchupBox'; 
import { FOREIGN_LEAGUES } from '../data/foreignLeagues';

const PlayoffTab = ({ 
    league, 
    teams, 
    hasPlayoffsGenerated, 
    handleMatchClick, 
    formatTeamName 
}) => {
    const [currentLeague, setCurrentLeague] = useState('LCK');
    
    if (!league || !teams) {
        return <div className="p-10 text-center text-gray-500">데이터 로딩 중...</div>;
    }

    const isLCK = currentLeague === 'LCK';
    
    // Visibility logic
    const isLCPGenerated = league.foreignMatches?.['LCP']?.some(m => m.type === 'playoff');
    const isLckFinished = !league.matches?.some(m => m.status === 'pending');

    // [THE FIX] Omni-Search Team Finder: Resolves IDs, Names, and FullNames across all leagues
    const findGlobalTeam = (teamId) => {
        const searchId = teamId ? String(teamId).trim() : null;
        if (!searchId || searchId === 'TBD') return { name: 'TBD' };

        // Create a massive pool of all teams in the game
        const allForeignLeagues = Object.values(FOREIGN_LEAGUES).flat();
        const searchPool = [...teams, ...allForeignLeagues];

        // Search by ID, Short Name, or Full Name
        const found = searchPool.find(t => 
            (t.id && String(t.id) === searchId) || 
            (t.name && String(t.name) === searchId) ||
            (t.fullName && String(t.fullName) === searchId)
        );

        return found || { name: teamId };
    };

    // [NEW] Local Team Formatter for the Bracket (includes Seed info)
    const getBracketDisplayName = (teamId) => {
        const team = findGlobalTeam(teamId);
        if (team.name === 'TBD') return 'TBD';

        // Add Seed if we are in LCP
        if (currentLeague === 'LCP') {
            const seeds = league.foreignPlayoffSeeds?.['LCP'] || [];
            const seedInfo = seeds.find(s => s.name === team.name || String(s.id) === String(team.id));
            if (seedInfo) return `${team.name} (${seedInfo.seed}시드)`;
        }

        // Add Seed if we are in LCK (uses the existing seed data)
        if (isLCK && league.playoffSeeds) {
            const seedInfo = league.playoffSeeds.find(s => String(s.id) === String(team.id));
            if (seedInfo) return `${team.name} (${seedInfo.seed}시드)`;
        }

        return team.name;
    };

    const BracketColumn = ({ title, children, className }) => (
        <div className={`flex flex-col items-center justify-start w-52 space-y-6 ${className}`}>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{title}</h4>
            <div className="w-full flex flex-col items-center">
                {children}
            </div>
        </div>
    );

    // --- LCP BRACKET LOGIC ---
    const renderLCPBracket = () => {
        const lcpMatches = league.foreignMatches?.['LCP']?.filter(m => m.type === 'playoff') || [];
        
        // Use normalized winners/losers for pathing
        const getWinnerId = (m) => (m && m.status === 'finished' && m.result?.winner) ? m.result.winner : null;
        const getLoserId = (m) => {
            if (!m || m.status !== 'finished' || !m.result?.winner) return null;
            const winner = m.result.winner;
            const t1Name = findGlobalTeam(m.t1).name;
            return winner === t1Name ? m.t2 : m.t1;
        };

        const findM = (round, matchNum) => lcpMatches.find(m => m.round === round && m.match === matchNum);
        const pendingM = (t1, t2) => ({ t1: t1 || null, t2: t2 || null, status: 'pending', type: 'playoff' });

        const r1m1 = findM(1, 1); 
        const r1m2 = findM(1, 2); 
        const r2m1 = findM(2, 1); 
        const r2m2 = findM(2, 2); 
        const r3m1 = findM(3, 1); 
        const r2lm1 = findM(2.1, 1); 
        const r3lm1 = findM(3.1, 1); 
        const final = findM(4, 1);   

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-24 min-w-[1200px] relative pt-12">
                    {/* Upper Bracket */}
                    <div className="relative border-b-2 border-dashed pb-16">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Upper Bracket)</h3>
                        <div className="flex justify-between items-center mt-8">
                            <BracketColumn title="PO 1라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={r1m1} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={r1m2} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="PO 2라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={r2m1 || pendingM(null, getWinnerId(r1m1))} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={r2m2 || pendingM(null, getWinnerId(r1m2))} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 결승">
                                <MatchupBox match={r3m1 || pendingM(getWinnerId(r2m1), getWinnerId(r2m2))} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="결승전">
                                <MatchupBox match={final || pendingM(getWinnerId(r3m1), null)} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                        </div>
                    </div>

                    {/* Lower Bracket */}
                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Lower Bracket)</h3>
                        <div className="flex justify-start items-center space-x-24 mt-8">
                            <BracketColumn title="패자조 1R">
                                <MatchupBox match={r2lm1 || pendingM(getLoserId(r2m1), getLoserId(r2m2))} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="결승 진출전">
                                <MatchupBox match={r3lm1 || pendingM(getWinnerId(r2lm1), getLoserId(r3m1))} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Preserved LCK Logic with Omni-Search upgrade
    const renderLCKBracket = () => {
        const poMatches = league.matches ? league.matches.filter(m => m.type === 'playoff') : [];
        const findMatch = (round, matchNum) => poMatches.find(m => m.round === round && m.match === matchNum);
        const pendingMatch = (t1, t2) => ({ t1: t1 || null, t2: t2 || null, status: 'pending', type: 'playoff' });

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-24 min-w-[1400px] relative pt-12">
                    <div className="relative border-b-2 border-dashed pb-16">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Winner's Bracket)</h3>
                        <div className="flex justify-between items-center mt-8">
                            <BracketColumn title="1라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={findMatch(1, 1)} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={findMatch(1, 2)} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 2R">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={findMatch(2, 1)} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={findMatch(2, 2)} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 결승">
                                <MatchupBox match={findMatch(3, 1)} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="결승전">
                                <MatchupBox match={findMatch(5, 1)} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
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
                            currentLeague === lg ? 'bg-blue-600 text-white' : 'bg-white text-gray-600'
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