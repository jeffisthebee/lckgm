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

    // [THE SUPER SEARCH] Resolves IDs, Short Names, and Full Names across all league databases
    const findGlobalTeam = (teamId) => {
        if (!teamId || teamId === 'TBD') return { name: 'TBD' };
        
        // Normalize search term
        const searchStr = String(teamId).trim().toUpperCase();

        // Create a massive pool of every team registered in the game
        const allForeignTeams = Object.values(FOREIGN_LEAGUES).flat();
        const searchPool = [...teams, ...allForeignTeams];

        // 1. Search by ID or Name or FullName
        const found = searchPool.find(t => 
            (t.id && String(t.id).toUpperCase() === searchStr) || 
            (t.name && t.name.toUpperCase() === searchStr) ||
            (t.fullName && t.fullName.toUpperCase() === searchStr)
        );

        // 2. Return found object or a safe fallback object
        return found || { name: teamId, colors: { primary: '#607d8b' } };
    };

    // Formatter for the MatchupBox that appends seed information
    const getBracketDisplayName = (teamId) => {
        const team = findGlobalTeam(teamId);
        if (team.name === 'TBD') return 'TBD';

        const seeds = league.foreignPlayoffSeeds?.[currentLeague] || league.playoffSeeds || [];
        const seedInfo = seeds.find(s => 
            (s.name && s.name === team.name) || 
            (s.id && String(s.id) === String(team.id))
        );

        return seedInfo ? `${team.name} (${seedInfo.seed}시드)` : team.name;
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
        
        // Helper to find match by round/match number
        const findM = (round, matchNum) => lcpMatches.find(m => m.round === round && m.match === matchNum);

        // Pathing Helpers: If the match exists, get the results
        const getWinner = (m) => (m && m.status === 'finished' && m.result?.winner) ? m.result.winner : null;
        const getLoser = (m) => {
            if (!m || m.status !== 'finished' || !m.result?.winner) return null;
            const winnerName = m.result.winner;
            const t1Name = findGlobalTeam(m.t1).name;
            return winnerName === t1Name ? m.t2 : m.t1;
        };

        const r1m1 = findM(1, 1); 
        const r1m2 = findM(1, 2); 
        const r2m1 = findM(2, 1); 
        const r2m2 = findM(2, 2); 
        const r3m1 = findM(3, 1); 
        const r2lm1 = findM(2.1, 1); 
        const r3lm1 = findM(3.1, 1); 
        const final = findM(4, 1);   

        // Pathing logic for visual "Pending" state if the matches aren't fully synced yet
        const displayMatch = (actualMatch, fallbackT1, fallbackT2) => {
            if (actualMatch) return actualMatch;
            return { t1: fallbackT1, t2: fallbackT2, status: 'pending', type: 'playoff' };
        };

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
                                    <MatchupBox match={displayMatch(r2m1, null, getWinner(r1m1))} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                    <MatchupBox match={displayMatch(r2m2, null, getWinner(r1m2))} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 결승">
                                <MatchupBox match={displayMatch(r3m1, getWinner(r2m1), getWinner(r2m2))} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="결승전">
                                <MatchupBox match={displayMatch(final, getWinner(r3m1), null)} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                        </div>
                    </div>

                    {/* Lower Bracket */}
                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Lower Bracket)</h3>
                        <div className="flex justify-start items-center space-x-24 mt-8">
                            <BracketColumn title="패자조 1R">
                                <MatchupBox match={displayMatch(r2lm1, getLoser(r2m1), getLoser(r2m2))} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                            <BracketColumn title="결승 진출전">
                                <MatchupBox match={displayMatch(r3lm1, getWinner(r2lm1), getLoser(r3m1))} onClick={handleMatchClick} formatTeamName={getBracketDisplayName} />
                            </BracketColumn>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    // Preserved LCK Logic with Team Finder Upgrade
    const renderLCKBracket = () => {
        const poMatches = league.matches ? league.matches.filter(m => m.type === 'playoff') : [];
        const findMatch = (round, matchNum) => poMatches.find(m => m.round === round && m.match === matchNum);

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