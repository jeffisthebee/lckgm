// src/engine/migrate.js
import db from './db';

export const migrateFromLocalStorage = async () => {
    // 1. Check if migration already ran
    const alreadyMigrated = await db.settings.get('migrated_v1').catch(() => null);
    if (alreadyMigrated) return;

    // 2. Check if there's anything in localStorage to migrate
    const raw = localStorage.getItem('lckgm_leagues');
    if (raw) {
        try {
            const leagues = JSON.parse(raw);
            if (Array.isArray(leagues) && leagues.length > 0) {
                console.log(`[Migration] Found ${leagues.length} league(s) in localStorage. Migrating to IndexedDB...`);
                
                // Import every league into IndexedDB
                await db.leagues.bulkPut(leagues);
                
                console.log('[Migration] Leagues migrated successfully!');
            }
        } catch (err) {
            console.error('[Migration] Failed to parse localStorage data:', err);
        }
    }

    // 3. Migrate the tutorial setting if it exists
    const tutorialHidden = localStorage.getItem('lckgm_tutorial_hidden');
    if (tutorialHidden) {
        await db.settings.put({ key: 'tutorial_hidden', value: tutorialHidden });
        console.log('[Migration] Tutorial setting migrated.');
    }

    // 4. Mark migration as done so it never runs again
    await db.settings.put({ key: 'migrated_v1', value: 'true' });

    // 5. Clean up localStorage now that IndexedDB has everything
    localStorage.removeItem('lckgm_leagues');
    localStorage.removeItem('lckgm_tutorial_hidden');

    console.log('[Migration] Complete! localStorage cleared.');
};