// src/main.jsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { migrateFromLocalStorage } from './engine/migrate';
import './index.css';

const init = async () => {
    // Run migration first, before anything renders
    await migrateFromLocalStorage();

    ReactDOM.createRoot(document.getElementById('root')).render(
        <BrowserRouter>
            <App />
        </BrowserRouter>
    );
};

init();