// src/components/AwardsTab.jsx
import React, { useState, useMemo } from 'react';
import { computeAwards, computePlayoffAwards } from '../engine/statsManager';

// --- RoleBadge Component ---
const RoleBadge = ({ role }) => {
    const icons = { TOP: '⚔️', JGL: '🌲', MID: '🧙', ADC: '🏹', SUP: '🛡️' };
    const colors = {
        TOP: 'bg-red-100 text-red-700 border-red-200',
        JGL: 'bg-green-100 text-green-700 border-green-200',
        MID: 'bg-purple-100 text-purple-700 border-purple-200',
        ADC: 'bg-blue-100 text-blue-700 border-blue-200',
        SUP: 'bg-yellow-100 text-yellow-700 border-yellow-200'
    };
    return (
        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border flex items-center gap-1 ${colors[role] || 'bg-gray-100'}`}>
            <span>{icons[role]}</span> {role}
        </span>
    );
};

// --- PlayerCard Component ---
const PlayerCard = ({ player, rank, playerList }) => {
    if (!player) return (
        <div className="min-w-[160px] h-[220px] bg-gray-50 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
            N/A
        </div>
    );
    
    const playerData = playerList.find(p => p.이름 === player.playerName);
    const koreanName = playerData ? playerData.실명 : player.playerName; 
    const ign = player.playerName;

    const rankStyles = {
        1: 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-white ring-2 ring-yellow-200',
        2: 'border-gray-300 bg-gradient-to-br from-gray-50 to-white ring-1 ring-gray-200',
        3: 'border-orange-300 bg-gradient-to-br from-orange-50 to-white ring-1 ring-orange-200'
    };

    return (
        <div className={`relative min-w-[160px] w-[160px] lg:w-full p-3 rounded-xl border shadow-sm flex flex-col items-center gap-2 shrink-0 snap-center ${rankStyles[rank]}`}>
            <div className="absolute top-2 left-2 opacity-80 scale-90 origin-top-left">
                <RoleBadge role={player.role} />
            </div>

            <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-xs shadow-md mt-4" 
                 style={{ backgroundColor: player.teamObj?.colors?.primary || '#333' }}>
                {player.teamObj?.name || 'FA'}
            </div>

            <div className="text-center mb-1">
                <div className="font-black text-gray-900 text-base leading-tight">{koreanName}</div>
                <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wide">{ign}</div>
            </div>

            <div className="w-full text-center mt-auto bg-white/50 rounded-lg p-2 border border-gray-100">
                <div className="text-2xl font-black text-gray-800 leading-none mb-1">{player.finalScore.toFixed(0)}</div>
                <div className="text-[10px] text-gray-400 font-bold mb-2">총 점수</div>
                
                <div className="text-[9px] text-gray-500 border-t border-gray-200 pt-1 mt-1">
                    <span className="font-bold">(세부 점수)</span>
                    <div className="flex justify-center flex-wrap gap-1 mt-0.5 whitespace-nowrap leading-tight">
                        <span title="팀 성적 점수">팀 {player.rankPoints}</span>
                        <span>+</span>
                        <span title="POG 포인트">POG {player.pogCount * 10}</span>
                        <span>+</span>
                        <span title="스탯 평점">지표 {player.avgScore.toFixed(0)}</span>
                        
                        {player.mvpBonus > 0 && (
                             <><span>+</span><span className="text-yellow-600 font-bold">MVP {player.mvpBonus}</span></>
                        )}
                        {player.isFinalsMvp && (
                            <><span>+</span><span className="text-blue-600 font-bold">FMVP 20</span></>
                        )}
                        {player.isPogLeader && !player.isFinalsMvp && (
                             <><span>+</span><span className="text-green-600 font-bold">POG 20</span></>
                        )}
                         {player.isPogLeader && player.isFinalsMvp && (
                             <><span>+</span><span className="text-green-600 font-bold">POG 20</span></>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- MvpShowcaseCard Component (New) ---
const MvpShowcaseCard = ({ player, title, badgeColor, teams, playerList, size = 'large' }) => {
    if (!player) return (
        <div className={`relative bg-gray-800 rounded-2xl border border-gray-700 p-8 flex items-center justify-center text-gray-500 font-bold ${size === 'large' ? 'w-full max-w-lg mx-auto' : 'w-full'}`}>
            데이터 없음
        </div>
    );

    const team = teams.find(t => player.teams?.includes(t.name) || (player.teamObj && player.teamObj.id === t.id));
    const pData = playerList.find(p => p.이름 === player.playerName);
    const realName = pData ? pData.실명 : player.playerName;

    return (
        <div className={`relative bg-gradient-to-b from-gray-900 to-gray-800 text-white rounded-2xl shadow-2xl border border-gray-700 overflow-hidden group ${size === 'large' ? 'w-full max-w-lg mx-auto p-8' : 'w-full p-6'}`}>
            <div className="absolute top-0 right-0 p-6 opacity-5 text-[80px] lg:text-[120px] font-black leading-none pointer-events-none select-none">MVP</div>
            
            <div className="relative z-10 flex flex-col items-center text-center">
                <div className={`inline-block text-black font-black text-xs px-3 py-1 rounded-full mb-4 shadow-lg ${badgeColor}`}>
                    {title}
                </div>

                <div className={`rounded-full border-4 flex items-center justify-center font-black shadow-2xl mb-4 relative ${badgeColor.replace('bg-', 'border-')}`}
                     style={{
                         backgroundColor: team?.colors?.primary,
                         width: size === 'large' ? '7rem' : '5rem', 
                         height: size === 'large' ? '7rem' : '5rem',
                         fontSize: size === 'large' ? '1.875rem' : '1.5rem'
                     }}>
                    {team?.name}
                </div>
                
                <h1 className={`${size === 'large' ? 'text-4xl lg:text-5xl' : 'text-2xl lg:text-3xl'} font-black text-white mb-1 tracking-tight`}>{realName}</h1>
                <div className={`${size === 'large' ? 'text-xl' : 'text-sm'} text-gray-400 font-bold mb-2`}>{player.playerName}</div>
                {player.pogCount !== undefined && (
                    <div className="bg-yellow-500/10 text-yellow-300 font-bold px-3 py-1 rounded-full mb-4 text-sm">
                        POG Counts: {player.pogCount}
                    </div>
                )}
                
                <div className="w-full border-t border-gray-700 pt-3 mt-2">
                        <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">Total Score</div>
                        <div className={`font-black ${badgeColor.replace('bg-', 'text-').replace('text-black', '')} ${size === 'large' ? 'text-4xl' : 'text-3xl'}`}>
                        {player.finalScore?.toFixed(0)}
                        </div>
                </div>
            </div>
        </div>
    );
};


// --- TeamSection Component ---
const TeamSection = ({ title, rank, players, playerList }) => {
    const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    const headerStyles = {
        1: 'bg-yellow-500 text-white border-yellow-600',
        2: 'bg-gray-400 text-white border-gray-500',
        3: 'bg-orange-400 text-white border-orange-500'
    };
    return (
        <div className="mb-8 last:mb-0">
            <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`px-3 py-1 rounded-lg font-black text-sm shadow-sm border-b-2 ${headerStyles[rank]}`}>{title}</div>
                <div className="h-px bg-gray-200 flex-1"></div>
            </div>
            <div className="flex overflow-x-auto gap-3 pb-4 px-1 -mx-1 snap-x snap-mandatory scrollbar-hide lg:grid lg:grid-cols-5 lg:overflow-visible">
                {roles.map(role => ( <PlayerCard key={role} player={players[role]} rank={rank} playerList={playerList} /> ))}
            </div>
        </div>
    );
};

// --- Main Component ---
export default function AwardsTab({ league, teams, playerList }) {
    const isPlayoffsFinished = useMemo(() => {
        if (!league.matches) return false;
        const playoffs = league.matches.filter(m => m.type === 'playoff');
        if (playoffs.length === 0) return false;

        // Check 1: Is there a match explicitly marked as Round 5 or "Final"?
        const explicitFinal = playoffs.find(m => 
            m.round === 5 || 
            String(m.round) === "5" || 
            (m.label && (m.label.includes('결승') || m.label.toLowerCase().includes('final')))
        );
        if (explicitFinal) return explicitFinal.status === 'finished';

        // Check 2: If no explicit round 5, assume the highest round number is the final
        const rounds = playoffs.map(m => Number(m.round) || 0);
        const maxRound = Math.max(...rounds);
        const finalMatches = playoffs.filter(m => (Number(m.round) || 0) === maxRound);
        
        // If the highest round matches are all finished, we consider playoffs done
        return finalMatches.length > 0 && finalMatches.every(m => m.status === 'finished');
    }, [league]);

    const [viewMode, setViewMode] = useState('regular'); // 'regular' | 'playoff'

    const regularData = useMemo(() => computeAwards(league, teams), [league, teams]);
    const playoffData = useMemo(() => isPlayoffsFinished ? computePlayoffAwards(league, teams) : null, [league, teams, isPlayoffsFinished]);

    // If Playoff mode is selected but data isn't ready (e.g. playoffs ongoing), fallback or show partial?
    // Current logic: if playoffs not finished, playoffData is null.
    // We can auto-switch to regular if playoff data missing.
    const activeData = (viewMode === 'playoff' && playoffData) ? playoffData : regularData;
    
    // Safety check: if user clicked 'playoff' but we have no data, force regular rendering (or loading)
    // but better to just show activeData (which falls back to regular if logic above is tweaked, but here activeData is strictly one or other)
    
    if (!activeData) return <div className="p-10 text-center text-gray-500">데이터를 불러오는 중입니다...</div>;

    const { seasonMvp, finalsMvp, pogLeader, allProTeams } = activeData;
    const isPlayoffView = viewMode === 'playoff' && playoffData;

    return (
        <div className="p-2 lg:p-6 max-w-7xl mx-auto space-y-8">
            {/* Header & Toggle */}
            <div className="flex flex-col items-center justify-center gap-4">
                <div className="text-center space-y-1">
                    <h2 className="text-3xl lg:text-4xl font-black text-gray-900 uppercase tracking-tighter">
                        <span className="text-blue-600">2026</span> LCK Awards
                    </h2>
                    <p className="text-gray-500 text-sm font-medium">
                        {isPlayoffView ? 'Playoffs & Finals Performance' : 'Regular Season Performance'}
                    </p>
                </div>

                {isPlayoffsFinished && (
                    <div className="bg-gray-100 p-1 rounded-lg flex gap-1">
                        <button onClick={() => setViewMode('regular')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'regular' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>정규 시즌</button>
                        <button onClick={() => setViewMode('playoff')} className={`px-4 py-1.5 rounded-md text-sm font-bold transition ${viewMode === 'playoff' ? 'bg-white shadow text-blue-600' : 'text-gray-500 hover:text-gray-700'}`}>플레이오프</button>
                    </div>
                )}
            </div>

            {/* MVP Showcase Section */}
            <div className="w-full">
                {!isPlayoffView ? (
                    // Regular Season: One Big Card
                    <MvpShowcaseCard 
                        player={seasonMvp} 
                        title="SEASON MVP" 
                        badgeColor="bg-yellow-500 text-black" 
                        teams={teams} 
                        playerList={playerList} 
                        size="large"
                    />
                ) : (
                    // Playoffs: Two Medium Cards Side-by-Side
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8 max-w-5xl mx-auto">
                        <MvpShowcaseCard 
                            player={pogLeader} 
                            title="PLAYOFF MVP" 
                            badgeColor="bg-green-400 text-black" 
                            teams={teams} 
                            playerList={playerList} 
                            size="medium"
                        />
                         <MvpShowcaseCard 
                            player={finalsMvp} 
                            title="FINALS MVP" 
                            badgeColor="bg-blue-400 text-black" 
                            teams={teams} 
                            playerList={playerList} 
                            size="medium"
                        />
                    </div>
                )}
            </div>

            {/* All Teams */}
            <div>
                <TeamSection title={isPlayoffView ? "All-Playoff 1st Team" : "All-LCK 1st Team"} rank={1} players={allProTeams[1]} playerList={playerList} />
                <TeamSection title={isPlayoffView ? "All-Playoff 2nd Team" : "All-LCK 2nd Team"} rank={2} players={allProTeams[2]} playerList={playerList} />
                <TeamSection title={isPlayoffView ? "All-Playoff 3rd Team" : "All-LCK 3rd Team"} rank={3} players={allProTeams[3]} playerList={playerList} />
            </div>
        </div>
    );
}