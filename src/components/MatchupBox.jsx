// src/components/MatchupBox.jsx
import React from 'react';
import { teams } from '../data/teams'; // Kept only as a fallback for pure LCK matches

const MatchupBox = ({ match, showScore = true, onClick, formatTeamName }) => {
    if (!match || (!match.t1 && !match.t2)) {
        return <div className="h-16 border-2 border-dashed rounded-lg flex items-center justify-center text-gray-400 text-sm w-full">TBD</div>;
    }

    // [THE FIX]: Trust formatTeamName unconditionally! 
    // If it's a foreign team, it will bypass the LCK 'teams' array completely.
    const team1Name = match.t1 
        ? (formatTeamName ? formatTeamName(match.t1, match.type) : (teams.find(t => t.id === match.t1)?.name || match.t1)) 
        : 'TBD';
        
    const team2Name = match.t2 
        ? (formatTeamName ? formatTeamName(match.t2, match.type) : (teams.find(t => t.id === match.t2)?.name || match.t2)) 
        : 'TBD';

    let isT1Winner = false;
    let isT2Winner = false;
    let score1 = '';
    let score2 = '';

    if (match.status === 'finished' && match.result) {
        // Accurately determine winner highlighting, even with "(3시드)" attached
        const wName = match.result.winner;
        if (wName) {
            if (typeof team1Name === 'string' && (team1Name.includes(wName) || match.t1 === wName)) isT1Winner = true;
            else if (typeof team2Name === 'string' && (team2Name.includes(wName) || match.t2 === wName)) isT2Winner = true;
        }

        // Properly parse "3-1" or "3:1" strings and assign the high score to the winner
        if (match.result.score) {
            const parts = String(match.result.score).split(/[-:]/);
            if (parts.length === 2) {
                const s1 = parseInt(parts[0].trim());
                const s2 = parseInt(parts[1].trim());
                if (isT1Winner) {
                    score1 = Math.max(s1, s2);
                    score2 = Math.min(s1, s2);
                } else if (isT2Winner) {
                    score2 = Math.max(s1, s2);
                    score1 = Math.min(s1, s2);
                } else {
                    score1 = s1; score2 = s2;
                }
            } else {
                score1 = match.result.score; 
            }
        }
    }

    return (
        <div 
            onClick={() => onClick && onClick(match)}
            className={`bg-white border-2 rounded-lg shadow-sm w-full transition hover:shadow-md ${match.status === 'pending' ? 'border-gray-300' : 'border-gray-400 cursor-pointer hover:border-blue-400'}`}
        >
            <div className={`flex justify-between items-center p-2 rounded-t-md ${isT1Winner ? 'bg-blue-100' : 'bg-gray-50'}`}>
                <span className={`font-bold text-sm ${isT1Winner ? 'text-blue-700' : 'text-gray-800'}`}>{team1Name}</span>
                {showScore && <span className={`font-black text-sm ${isT1Winner ? 'text-blue-700' : 'text-gray-500'}`}>{score1}</span>}
            </div>
            <div className={`flex justify-between items-center p-2 border-t rounded-b-md ${isT2Winner ? 'bg-blue-100' : 'bg-gray-50'}`}>
                <span className={`font-bold text-sm ${isT2Winner ? 'text-blue-700' : 'text-gray-800'}`}>{team2Name}</span>
                {showScore && <span className={`font-black text-sm ${isT2Winner ? 'text-blue-700' : 'text-gray-500'}`}>{score2}</span>}
            </div>
        </div>
    );
};

export default MatchupBox;