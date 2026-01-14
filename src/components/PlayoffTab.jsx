// src/components/PlayoffTab.jsx
import React from 'react';
import MatchupBox from './MatchupBox'; // Ensure this imports correctly from the same folder

const PlayoffTab = ({ 
    league, 
    teams, 
    hasPlayoffsGenerated, 
    handleMatchClick, 
    formatTeamName 
}) => {
    
    // Internal Helper Component for columns
    const BracketColumn = ({ title, children, className }) => (
        <div className={`flex flex-col items-center justify-start w-52 space-y-6 ${className}`}>
            <h4 className="text-sm font-bold uppercase tracking-wider text-gray-500 mb-2">{title}</h4>
            <div className="w-full flex flex-col items-center">
                {children}
            </div>
        </div>
    );

    // Render logic for the bracket
    const renderBracket = () => {
        const poMatches = league.matches.filter(m => m.type === 'playoff');
        
        // Helpers for logic inside the tab
        const getWinner = m => m && m.status === 'finished' ? teams.find(t => t.name === m.result.winner)?.id : null;
        const getLoser = m => {
            if (!m || m.status !== 'finished') return null;
            const winnerId = getWinner(m);
            return m.t1 === winnerId ? m.t2 : m.t1;
        };
        const findMatch = (round, match) => poMatches.find(m => m.round === round && m.match === match);

        // Find specific matches
        const r1m1 = findMatch(1, 1);
        const r1m2 = findMatch(1, 2);
        
        const r2m1_actual = findMatch(2, 1);
        const r2m2_actual = findMatch(2, 2);
        
        const r2lm1_actual = findMatch(2.1, 1);
        const r2lm2_actual = findMatch(2.2, 1);
        
        const r3m1_actual = findMatch(3, 1);
        const r3lm1_actual = findMatch(3.1, 1);

        const r4m1_actual = findMatch(4, 1);
        const final_actual = findMatch(5, 1);

        // Helper to generate "Pending" placeholder props
        const pendingMatch = (t1, t2) => ({
            t1, t2, status: 'pending', type: 'playoff'
        });

        return (
            <div className="flex-1 overflow-x-auto pb-8">
                <div className="flex flex-col space-y-24 min-w-[1400px] relative pt-12">
                    {/* --- 승자조 --- */}
                    <div className="relative border-b-2 border-dashed pb-16">
                        <h3 className="text-lg font-black text-blue-600 mb-8 absolute -top-2">승자조 (Winner's Bracket)</h3>
                        <div className="flex justify-between items-center mt-8">
                            <BracketColumn title="1라운드">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={r1m1} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                    <MatchupBox match={r1m2} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 2R">
                                <div className="flex flex-col justify-around space-y-32 h-[300px]">
                                    <MatchupBox match={r2m1_actual || pendingMatch(league.playoffSeeds?.find(s => s.seed === 1)?.id, getWinner(r1m1))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                    <MatchupBox match={r2m2_actual || pendingMatch(league.playoffSeeds?.find(s => s.seed === 2)?.id, getWinner(r1m2))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                                </div>
                            </BracketColumn>
                            <BracketColumn title="승자조 결승">
                                <MatchupBox match={r3m1_actual || pendingMatch(getWinner(r2m1_actual), getWinner(r2m2_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                            <BracketColumn title="결승전">
                                <MatchupBox match={final_actual || pendingMatch(getWinner(r3m1_actual), getWinner(r4m1_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                        </div>
                    </div>

                    {/* --- 패자조 --- */}
                    <div className="relative pt-8">
                        <h3 className="text-lg font-black text-red-600 mb-8 absolute -top-2">패자조 (Loser's Bracket)</h3>
                        <div className="flex justify-start items-center space-x-24 mt-8">
                            <BracketColumn title="패자조 1R">
                                <MatchupBox match={r2lm1_actual || pendingMatch(getLoser(r1m1), getLoser(r1m2))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                            <BracketColumn title="패자조 2R">
                                <MatchupBox 
                                    match={r2lm2_actual || pendingMatch(
                                        [getLoser(r2m1_actual), getLoser(r2m2_actual)].sort((a,b) => (league.playoffSeeds?.find(s=>s.id===b)?.seed || 99) - (league.playoffSeeds?.find(s=>s.id===a)?.seed || 99))[0], 
                                        getWinner(r2lm1_actual)
                                    )} 
                                    onClick={handleMatchClick} 
                                    formatTeamName={formatTeamName} 
                                />
                            </BracketColumn>
                            <BracketColumn title="패자조 3R">
                                <MatchupBox 
                                    match={r3lm1_actual || pendingMatch(
                                        [getLoser(r2m1_actual), getLoser(r2m2_actual)].sort((a,b) => (league.playoffSeeds?.find(s=>s.id===a)?.seed || 99) - (league.playoffSeeds?.find(s=>s.id===b)?.seed || 99))[0], 
                                        getWinner(r2lm2_actual)
                                    )} 
                                    onClick={handleMatchClick} 
                                    formatTeamName={formatTeamName} 
                                />
                            </BracketColumn>
                            <BracketColumn title="결승 진출전">
                                <MatchupBox match={r4m1_actual || pendingMatch(getLoser(r3m1_actual), getWinner(r3lm1_actual))} onClick={handleMatchClick} formatTeamName={formatTeamName} />
                            </BracketColumn>
                        </div>
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="bg-white rounded-lg border shadow-sm p-6 min-h-[800px] flex flex-col">
            <h2 className="text-2xl font-black text-gray-900 mb-6 flex items-center gap-2">👑 2026 LCK 컵 플레이오프</h2>
            {hasPlayoffsGenerated ? renderBracket() : (
                <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                    <div className="text-4xl mb-4">🛡️</div>
                    <div className="text-xl font-bold">플레이오프가 아직 시작되지 않았습니다</div>
                    <p className="mt-2">정규 시즌과 플레이-인을 모두 마친 후 대진이 생성됩니다.</p>
                </div>
            )}
        </div>
    );
};

export default PlayoffTab;