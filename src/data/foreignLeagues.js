import lpl from './leagues/lpl.json';
import lec from './leagues/lec.json';
import lcs from './leagues/lcs.json';
import lcp from './leagues/lcp.json';
import cblol from './leagues/cblol.json';

// Import all player data
import playersLCK from '../data/players.json';
import playersLPL from '../data/players_lpl.json';
import playersLEC from '../data/players_lec.json';
import playersLCS from '../data/players_lcs.json';
import playersLCP from '../data/players_lcp.json';
import playersCBLOL from '../data/players_cblol.json';

export const FOREIGN_LEAGUES = {
  LPL: lpl,
  LEC: lec,
  LCS: lcs,
  LCP: lcp,
  CBLOL: cblol
};

// [NEW] Export all the player databases so the Simulation Engine can use them!
export const FOREIGN_PLAYERS = {
  LCK: playersLCK,
  LPL: playersLPL,
  LEC: playersLEC,
  LCS: playersLCS,
  LCP: playersLCP,
  CBLOL: playersCBLOL
};