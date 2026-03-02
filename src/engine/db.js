import Dexie from 'dexie';

const db = new Dexie('LCKManagerDB');

db.version(1).stores({
  leagues: 'id, leagueName, lastPlayed',
  settings: 'key'
});

export default db;