// src/engine/rosterLogic.js
import playerList from '../data/players.json';

// --- ROSTER LOGIC ---
// Returns the default starting 5 (best player per position)
export const getTeamRoster = (teamName) => {
  const positions = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];

  if (!Array.isArray(playerList) || playerList.length === 0) {
    return positions.map(pos => ({ 이름: 'Unknown', 포지션: pos, 종합: 70 }));
  }

  let players = playerList.filter(p => p.팀 === teamName);

  if (players.length === 0) {
      const aliases = {
          'GEN': '젠지', 'HLE': '한화', 'T1': '티원', 'KT': '케이티', 
          'DK': '디플러스', 'BNK': '피어엑스', 'NS': '농심', 
          'DRX': '디알엑스', 'BRO': '브리온', 'DNS': '수퍼스'
      };
      const krName = aliases[teamName];
      if (krName) {
         players = playerList.filter(p => p.팀.includes(krName) || (p.팀 === teamName));
      }
  }

  if (!players || players.length === 0) {
    console.warn(`Warning: No players found for team ${teamName}. Using placeholders.`);
    return positions.map(pos => ({
      이름: `${teamName} ${pos}`,
      포지션: pos,
      종합: 75, 
      상세: { 라인전: 75, 무력: 75, 한타: 75, 성장: 75, 안정성: 75, 운영: 75 }
    }));
  }

  return positions.map(pos => {
      const found = players.find(p => p.포지션 === pos || p.포지션 === (pos === 'SUP' ? 'SPT' : pos));
      return found || players[0] || { 이름: 'Unknown', 포지션: pos, 종합: 70 }; 
  });
};

// NEW: Returns ALL players for a team (including substitutes)
export const getFullTeamRoster = (teamName) => {
  if (!Array.isArray(playerList) || playerList.length === 0) {
    return [];
  }

  let players = playerList.filter(p => p.팀 === teamName);

  if (players.length === 0) {
      const aliases = {
          'GEN': '젠지', 'HLE': '한화', 'T1': '티원', 'KT': '케이티', 
          'DK': '디플러스', 'BNK': '피어엑스', 'NS': '농심', 
          'DRX': '디알엑스', 'BRO': '브리온', 'DNS': '수퍼스'
      };
      const krName = aliases[teamName];
      if (krName) {
         players = playerList.filter(p => p.팀.includes(krName) || (p.팀 === teamName));
      }
  }

  return players || [];
};

// NEW: Validates that a lineup has all 5 positions filled with unique players
export const validateLineup = (lineup) => {
  const positions = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
  
  // Check all positions are filled
  const hasAllPositions = positions.every(pos => lineup[pos] && lineup[pos].이름);
  
  // Check no duplicate players
  const playerNames = Object.values(lineup).map(p => p?.이름).filter(Boolean);
  const uniqueNames = new Set(playerNames);
  const noDuplicates = playerNames.length === uniqueNames.size;
  
  return hasAllPositions && noDuplicates && playerNames.length === 5;
};

// NEW: Creates a default lineup from available players (best per position)
export const getDefaultLineup = (teamName) => {
  const fullRoster = getFullTeamRoster(teamName);
  const positions = ['TOP', 'JGL', 'MID', 'ADC', 'SUP'];
  const lineup = {};

  positions.forEach(pos => {
    const playersInPosition = fullRoster.filter(p => 
      p.포지션 === pos || p.포지션 === (pos === 'SUP' ? 'SPT' : pos)
    );
    
    // Sort by OVR (종합) and pick the best
    playersInPosition.sort((a, b) => (b.종합 || 0) - (a.종합 || 0));
    
    lineup[pos] = playersInPosition[0] || { 
      이름: 'Unknown', 
      포지션: pos, 
      종합: 70,
      상세: { 라인전: 70, 무력: 70, 한타: 70, 성장: 70, 안정성: 70, 운영: 70 }
    };
  });

  return lineup;
};