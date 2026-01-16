// src/engine/rosterLogic.js
import playerList from '../data/players.json';

// --- ROSTER LOGIC ---
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