// src/components/AwardsTab.jsx
import React, { useMemo } from 'react';
import { computeAwards } from '../engine/statsManager';

// Helper: Role Badge
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

// Helper: Player Card
const PlayerCard = ({ player, rank, playerList }) => {
    if (!player) return (
        <div className="min-w-[140px] h-[180px] bg-gray-50 rounded-xl border border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400">
            N/A
        </div>
    );
    
    // Look up Korean Real Name
    // Assumes playerList has { "이름": "Zeus", "실명": "최우제" ... }
    const playerData = playerList.find(p => p.이름 === player.playerName);
    const koreanName = playerData ? playerData.실명 : player.playerName; // Fallback to IGN if no match
    const ign = player.playerName;

    const rankStyles = {
        1: 'border-yellow-400 bg-gradient-to-br from-yellow-50 to-white ring-2 ring-yellow-200',
        2: 'border-gray-300 bg-gradient-to-br from-gray-50 to-white ring-1 ring-gray-200',
        3: 'border-orange-300 bg-gradient-to-br from-orange-50 to-white ring-1 ring-orange-200'
    };

    return (
        <div className={`relative min-w-[150px] w-[150px] lg:w-full p-3 rounded-xl border shadow-sm flex flex-col items-center gap-3 shrink-0 snap-center ${rankStyles[rank]}`}>
            {/* Role Badge Top Left */}
            <div className="absolute top-2 left-2 opacity-80 scale-90 origin-top-left">
                <RoleBadge role={player.role} />
            </div>

            {/* Team Logo */}
            <div className="w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md mt-4" 
                 style={{ backgroundColor: player.teamObj?.colors?.primary || '#333' }}>
                {player.teamObj?.name || 'FA'}
            </div>

            {/* Name Section */}
            <div className="text-center">
                <div className="font-black text-gray-900 text-base leading-tight">{koreanName}</div>
                <div className="text-xs text-gray-500 font-bold uppercase tracking-wide">{ign}</div>
            </div>

            {/* Stats */}
            <div className="w-full text-center mt-auto border-t pt-2 border-gray-200/50">
                <div className="text-[10px] text-gray-400 font-bold uppercase">Total Score</div>
                <div className="text-xl font-black text-gray-800 leading-none">{player.finalScore.toFixed(0)}</div>
            </div>
        </div>
    );
};

// Section Component for 1st/2nd/3rd Teams
const TeamSection = ({ title, rank, players, playerList }) => {
    const roles = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
    
    // Styles for the header badge
    const headerStyles = {
        1: 'bg-yellow-500 text-white border-yellow-600',
        2: 'bg-gray-400 text-white border-gray-500',
        3: 'bg-orange-400 text-white border-orange-500'
    };

    return (
        <div className="mb-8 last:mb-0">
            <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`px-3 py-1 rounded-lg font-black text-sm shadow-sm border-b-2 ${headerStyles[rank]}`}>
                    {title}
                </div>
                <div className="h-px bg-gray-200 flex-1"></div>
            </div>
            
            {/* Horizontal Scroll Container */}
            <div className="flex overflow-x-auto gap-3 pb-4 px-1 -mx-1 snap-x snap-mandatory scrollbar-hide lg:grid lg:grid-cols-5 lg:overflow-visible">
                {roles.map(role => (
                    <PlayerCard 
                        key={role} 
                        player={players[role]} 
                        rank={rank} 
                        playerList={playerList}
                    />
                ))}
            </div>
        </div>
    );
};

export default function AwardsTab({ league, teams, playerList }) {
    const { seasonMvp, allProTeams } = useMemo(() => computeAwards(league, teams), [league, teams]);
    
    // MVP Data Prep
    const mvpTeam = seasonMvp ? teams.find(t => seasonMvp.teams.includes(t.name)) : null;
    const mvpPlayerData = seasonMvp && playerList ? playerList.find(p => p.이름 === seasonMvp.playerName) : null;
    const mvpName = mvpPlayerData ? mvpPlayerData.실명 : seasonMvp?.playerName;

    return (
        <div className="p-2 lg:p-6 max-w-7xl mx-auto space-y-10">
            {/* Header */}
            <div className="text-center space-y-2">
                <h2 className="text-3xl lg:text-4xl font-black text-gray-900 uppercase tracking-tighter">
                    <span className="text-blue-600">2026</span> LCK Awards
                </h2>
                <p className="text-gray-500 text-sm font-medium">Regular Season Performance</p>
            </div>

            {/* MVP Showcase */}
            <div className="flex justify-center">
                <div className="relative w-full max-w-lg bg-gradient-to-b from-gray-900 to-gray-800 text-white p-6 lg:p-8 rounded-2xl shadow-2xl border border-gray-700 overflow-hidden group">
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 p-8 opacity-5 text-[150px] font-black leading-none pointer-events-none select-none">MVP</div>
                    
                    <div className="relative z-10 flex flex-col items-center text-center">
                        <div className="inline-block bg-yellow-500 text-black font-black text-xs px-3 py-1 rounded-full mb-6 shadow-lg shadow-yellow-500/20">
                            SEASON MVP
                        </div>

                        {seasonMvp ? (
                            <>
                                <div className="w-28 h-28 bg-gray-700 rounded-full border-4 border-yellow-400 flex items-center justify-center text-3xl font-black shadow-2xl mb-4 relative"
                                     style={{backgroundColor: mvpTeam?.colors?.primary}}>
                                    {mvpTeam?.name}
                                    <div className="absolute -bottom-2 bg-black text-yellow-400 text-[10px] px-2 py-0.5 rounded border border-yellow-500 font-bold">
                                        {seasonMvp.pogs} POG
                                    </div>
                                </div>
                                
                                <h1 className="text-4xl lg:text-5xl font-black text-white mb-1 tracking-tight">{mvpName}</h1>
                                <div className="text-xl text-gray-400 font-bold mb-6">{seasonMvp.playerName}</div>
                                
                                <div className="grid grid-cols-2 gap-8 w-full max-w-xs border-t border-gray-700 pt-6">
                                    <div>
                                        <div className="text-3xl font-black text-yellow-400">{seasonMvp.pogs * 100}</div>
                                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">MVP Points</div>
                                    </div>
                                    <div>
                                        <div className="text-3xl font-black text-white">{seasonMvp.lastScore?.toFixed(1) || '-'}</div>
                                        <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Avg Rating</div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <div className="py-12 text-gray-500 font-bold">데이터 집계 중...</div>
                        )}
                    </div>
                </div>
            </div>

            {/* All-LCK Teams */}
            <div>
                <TeamSection title="All-LCK 1st Team" rank={1} players={allProTeams[1]} playerList={playerList} />
                <TeamSection title="All-LCK 2nd Team" rank={2} players={allProTeams[2]} playerList={playerList} />
                <TeamSection title="All-LCK 3rd Team" rank={3} players={allProTeams[3]} playerList={playerList} />
            </div>
        </div>
    );
}