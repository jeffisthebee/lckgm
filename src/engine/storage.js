// src/engine/storage.js

export const getLeagues = () => { 
    const s = localStorage.getItem('lckgm_leagues'); 
    return s ? JSON.parse(s) : []; 
  };
  
  export const updateLeague = (id, u) => { 
    const leagues = getLeagues(); 
    const index = leagues.findIndex(l => l.id === id); 
    if (index !== -1) { 
      leagues[index] = { ...leagues[index], ...u }; 
      localStorage.setItem('lckgm_leagues', JSON.stringify(leagues));
      return leagues[index];
    }
    return null;
  };
  
  export const getLeagueById = (id) => getLeagues().find(l => l.id === id);