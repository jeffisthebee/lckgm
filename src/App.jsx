// src/App.jsx
import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';

// Import the pages we just made
import LeagueManager from './pages/LeagueManager';
import TeamSelection from './pages/TeamSelection';
import Dashboard from './pages/Dashboard';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LeagueManager />} />
      <Route path="/new-league" element={<TeamSelection />} />
      <Route path="/league/:leagueId" element={<Dashboard />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}