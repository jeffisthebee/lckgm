// src/components/MatchupBox.jsx
import React from 'react';
import { teams } from '../data/teams';

const MatchupBox = ({ match, showScore = true, onClick, formatTeamName }) => {
    if (!match || (!match.t1 && !match.t2)) {
        return <div className="h-16 border-2 border-dashed rounded-lg flex items-center justify-center text-gray-400 text-sm w-full">TBD</div>;
    }
    
    // Helper to resolve team name if formatTeamName isn't passed
    const getTeamName = (id, type) => {
        if (formatTeamName) return formatTeamName(id, type);
        const t = teams.find(x => x.id === id);
        return t ? t.name : 'TBD';
    };

    const t1 = teams.find(t => t.id === match.t1);
    const t2 = teams.find(t => t.id === match.t2);
    const winnerId = match.status === 'finished' ? teams.find(t => t.name === match.result.winner)?.id : null;

    const team1Name = t1 ? getTeamName(t1.id, match.type) : 'TBD';
    const team2Name = t2 ? getTeamName(t2.id, match.type) : 'TBD';

    return (
        <div 
            onClick={() => onClick && onClick(match)}
            className={`bg-white border-2 rounded-lg shadow-sm w-full transition hover:shadow-md ${match.status === 'pending' ? 'border-gray-300' : 'border-gray-400 cursor-pointer hover:border-blue-400'}`}
        >
            <div className={`flex justify-between items-center p-2 rounded-t-md ${winnerId === t1?.id ? 'bg-blue-100' : 'bg-gray-50'}`}>
                <span className={`font-bold text-sm ${winnerId === t1?.id ? 'text-blue-700' : 'text-gray-800'}`}>{team1Name}</span>
                {showScore && <span className={`font-black text-sm ${winnerId === t1?.id ? 'text-blue-700' : 'text-gray-500'}`}>{match.status === 'finished' && match.result?.score ? match.result.score.split(':')[0] : ''}</span>}
            </div>
            <div className={`flex justify-between items-center p-2 rounded-b-md ${winnerId === t2?.id ? 'bg-blue-100' : 'bg-gray-50'}`}>
                <span className={`font-bold text-sm ${winnerId === t2?.id ? 'text-blue-700' : 'text-gray-800'}`}>{team2Name}</span>
                {showScore && <span className={`font-black text-sm ${winnerId === t2?.id ? 'text-blue-700' : 'text-gray-500'}`}>{match.status === 'finished' && match.result?.score ? match.result.score.split(':')[1] : ''}</span>}
            </div>
        </div>
    );
};

export default MatchupBox;