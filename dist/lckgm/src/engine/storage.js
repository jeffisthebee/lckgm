// src/engine/storage.js
import db from './db';

// Get all leagues
export const getLeagues = async () => {
  return await db.leagues.toArray();
};

// Get a single league by ID
export const getLeagueById = async (id) => {
  return await db.leagues.get(id);
};

// Save a brand new league
export const saveLeague = async (league) => {
  await db.leagues.put(league);
  return league;
};

// Update an existing league by merging changes
export const updateLeague = async (id, updates) => {
  const existing = await db.leagues.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  await db.leagues.put(updated);
  return updated;
};

// Delete a league by ID
export const deleteLeague = async (id) => {
  await db.leagues.delete(id);
};

// Settings helpers (for things like tutorial_hidden)
export const getSetting = async (key) => {
  const row = await db.settings.get(key);
  return row ? row.value : null;
};

export const setSetting = async (key, value) => {
  await db.settings.put({ key, value });
};

export const deleteSetting = async (key) => {
  await db.settings.delete(key);
};