const fs = require('fs');
const path = require('path');
const { app, protocol, net, shell } = require('electron');

class PluginManager {
    constructor() {
        this.pluginsDir = process.env.NODE_ENV === 'development' 
            ? path.join(__dirname, '../../plugins') 
            : path.join(app.getPath('userData'), 'plugins');
        
        this.configPath = path.join(app.getPath('userData'), 'plugin_settings.json');
        this.plugins = [];
        this.disabledPlugins = new Set();
        this.otaSwapPerformed = false;
        this.otaSwapNewVersion = null;
    }

    loadConfig() {
        try {
            if (fs.existsSync(this.configPath)) {
                const data = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
                if (data.disabled && Array.isArray(data.disabled)) {
                    this.disabledPlugins = new Set(data.disabled);
                }
            }
        } catch (e) {
            console.error('PluginManager: Error loading config', e);
        }
    }

    saveConfig() {
        try {
            fs.writeFileSync(this.configPath, JSON.stringify({ disabled: Array.from(this.disabledPlugins) }, null, 2));
        } catch (e) {
            console.error('PluginManager: Error saving config', e);
        }
    }

    async init() {
        this.loadConfig();
        // Create plugins directory if it doesn't exist
        if (!fs.existsSync(this.pluginsDir)) {
            fs.mkdirSync(this.pluginsDir, { recursive: true });
        }

        // ============================================
        // PRE-INSTALLED PLUGIN SEEDING
        // ============================================
        if (process.env.NODE_ENV !== 'development') {
            const builtinPluginsDir = path.join(process.resourcesPath, 'plugins');
            if (fs.existsSync(builtinPluginsDir)) {
                try {
                    const pluginFolders = fs.readdirSync(builtinPluginsDir);
                    for (const folder of pluginFolders) {
                        const targetUserDir = path.join(this.pluginsDir, folder);
                        if (!fs.existsSync(targetUserDir)) {
                            console.log(`[PluginManager] First launch: Seeding default plugin: ${folder}`);
                            fs.cpSync(path.join(builtinPluginsDir, folder), targetUserDir, { recursive: true });
                        }
                    }
                } catch (e) {
                    console.error('[PluginManager] Failed to seed built-in plugins:', e);
                }
            }
        }

        // ============================================
        // OTA PLUGIN HOT-SWAP (Prevention of EBUSY logic)
        // ============================================
        try {
            const tempUpdatesDir = path.join(this.pluginsDir, '.temp-updates');
            const targetUpdateDir = path.join(tempUpdatesDir, 'Yizi-studio-AIstudio-new');
            const activePluginDir = path.join(this.pluginsDir, 'Yizi-studio-AIstudio');
            
            if (fs.existsSync(targetUpdateDir)) {
                console.log(`[PluginManager] Detected pending OTA update. Executing swap...`);
                let swapAborted = false;

                // --- Phase 1: Verify extraction structure ---
                let actualUpdateDir = targetUpdateDir;
                if (!fs.existsSync(path.join(targetUpdateDir, 'manifest.json'))) {
                    const items = fs.readdirSync(targetUpdateDir);
                    const dirs = items.filter(i => fs.statSync(path.join(targetUpdateDir, i)).isDirectory());
                    if (dirs.length === 1 && fs.existsSync(path.join(targetUpdateDir, dirs[0], 'manifest.json'))) {
                        actualUpdateDir = path.join(targetUpdateDir, dirs[0]);
                        console.log(`[PluginManager] Detected nested extraction. Using: ${actualUpdateDir}`);
                    } else {
                        console.error(`[PluginManager] OTA update package is invalid: manifest.json not found. Aborting swap.`);
                        try { fs.rmSync(tempUpdatesDir, { recursive: true, force: true }); } catch(e) {}
                        swapAborted = true;
                    }
                }

                if (!swapAborted) {
                    // Read new version for logging
                    try {
                        const newManifest = JSON.parse(fs.readFileSync(path.join(actualUpdateDir, 'manifest.json'), 'utf8'));
                        this.otaSwapNewVersion = newManifest.version;
                        console.log(`[PluginManager] New plugin version: ${newManifest.version}`);
                    } catch (e) {
                        console.warn(`[PluginManager] Could not read new manifest version:`, e.message);
                    }

                    // --- Phase 2: Safe removal of old plugin ---
                    const backupDir = path.join(this.pluginsDir, '.ota-backup-Yizi-studio-AIstudio');
                    try {
                        if (fs.existsSync(backupDir)) {
                            fs.rmSync(backupDir, { recursive: true, force: true });
                        }
                        if (fs.existsSync(activePluginDir)) {
                            fs.renameSync(activePluginDir, backupDir);
                            console.log(`[PluginManager] Old plugin backed up successfully.`);
                        }
                    } catch (backupErr) {
                        console.warn(`[PluginManager] Backup rename failed, trying force delete...`, backupErr.message);
                        try {
                            fs.rmSync(activePluginDir, { recursive: true, force: true });
                        } catch (rmErr) {
                            console.error(`[PluginManager] CRITICAL: Cannot remove old plugin. Aborting swap.`, rmErr);
                            swapAborted = true;
                        }
                    }
                }

                if (!swapAborted) {
                    // --- Phase 3: Move new plugin into place ---
                    const backupDir = path.join(this.pluginsDir, '.ota-backup-Yizi-studio-AIstudio');
                    try {
                        fs.renameSync(actualUpdateDir, activePluginDir);
                        console.log(`[PluginManager] OTA swap successful! New version: ${this.otaSwapNewVersion}`);
                        this.otaSwapPerformed = true;
                    } catch (swapErr) {
                        console.error(`[PluginManager] CRITICAL: Failed to move new plugin:`, swapErr);
                        if (fs.existsSync(backupDir)) {
                            try {
                                fs.renameSync(backupDir, activePluginDir);
                                console.log(`[PluginManager] Restored old plugin from backup.`);
                            } catch (restoreErr) {
                                console.error(`[PluginManager] FATAL: Failed to restore backup!`, restoreErr);
                            }
                        }
                    }

                    // --- Phase 4: Cleanup ---
                    try {
                        if (fs.existsSync(backupDir)) fs.rmSync(backupDir, { recursive: true, force: true });
                        if (fs.existsSync(tempUpdatesDir)) fs.rmSync(tempUpdatesDir, { recursive: true, force: true });
                    } catch (cleanErr) {
                        console.warn(`[PluginManager] Non-critical cleanup failed:`, cleanErr.message);
                    }
                }
            }
        } catch (updateErr) {
            console.error(`[PluginManager] Failed to apply OTA swap:`, updateErr);
        }

        // Register custom protocol for serving plugin files to the renderer safely.
        // It captures yiziview-plugin://<plugin-name>/<file-path>
        protocol.handle('yiziview-plugin', (request) => {
            const url = new URL(request.url);
            const pluginName = url.host;
            const filePath = decodeURIComponent(url.pathname.replace(/^\//, ''));
            
            const absolutePath = path.join(this.pluginsDir, pluginName, filePath);
            
            // Security check: ensure the requested file is actually inside the plugins directory
            if (!absolutePath.startsWith(this.pluginsDir)) {
                console.error(`PluginManager: Blocked attempt to access file outside plugins dir: ${absolutePath}`);
                return new Response('Access Denied', { status: 403 });
            }

            try {
                const data = fs.readFileSync(absolutePath);
                let mimeType = 'text/plain';
                if (absolutePath.endsWith('.js') || absolutePath.endsWith('.mjs')) mimeType = 'text/javascript';
                else if (absolutePath.endsWith('.css')) mimeType = 'text/css';
                else if (absolutePath.endsWith('.json')) mimeType = 'application/json';
                else if (absolutePath.endsWith('.svg')) mimeType = 'image/svg+xml';
                else if (absolutePath.endsWith('.png')) mimeType = 'image/png';
                else if (absolutePath.endsWith('.jpg') || absolutePath.endsWith('.jpeg')) mimeType = 'image/jpeg';
                else if (absolutePath.endsWith('.html')) mimeType = 'text/html';

                return new Response(data, {
                    headers: {
                        'Content-Type': mimeType,
                        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
                        'Pragma': 'no-cache',
                        'Expires': '0'
                    }
                });
            } catch (err) {
                return new Response('Not Found', { status: 404 });
            }
        });

        await this.scanPlugins();
    }

    async scanPlugins() {
        this.plugins = [];
        try {
            const items = fs.readdirSync(this.pluginsDir);
            for (const item of items) {
                const pluginPath = path.join(this.pluginsDir, item);
                const stat = fs.statSync(pluginPath);
                
                if (stat.isDirectory()) {
                    const manifestPath = path.join(pluginPath, 'manifest.json');
                    if (fs.existsSync(manifestPath)) {
                        try {
                            const manifestData = fs.readFileSync(manifestPath, 'utf8');
                            const manifest = JSON.parse(manifestData);
                            
                            // Check compatibility or required fields here
                            if (manifest.name && manifest.version) {
                                this.plugins.push({
                                    id: item, // folder name as ID
                                    name: manifest.name,
                                    version: manifest.version,
                                    description: manifest.description || '',
                                    mainEntry: manifest.main,
                                    rendererEntry: manifest.renderer,
                                    dir: pluginPath,
                                    disabled: this.disabledPlugins.has(item)
                                });
                            }
                        } catch (e) {
                            console.error(`PluginManager: Failed to parse manifest in ${item}`, e);
                        }
                    }
                }
            }
            
            this.activateMainPlugins();
        } catch (e) {
            console.error('PluginManager: Failed to scan plugins directory', e);
        }
    }

    activateMainPlugins() {
        // Execute main process scripts if they exist AND are not disabled
        for (const plugin of this.plugins) {
            if (plugin.disabled) continue;

            if (plugin.mainEntry) {
                const mainScriptPath = path.join(plugin.dir, plugin.mainEntry);
                if (fs.existsSync(mainScriptPath)) {
                    try {
                        console.log(`PluginManager: Activating main script for ${plugin.name}`);
                        const pluginModule = require(mainScriptPath);
                        if (typeof pluginModule.activate === 'function') {
                            // Passed some safe API
                            pluginModule.activate({ app, pluginsDir: this.pluginsDir });
                        }
                    } catch (e) {
                        console.error(`PluginManager: Failed to load main script for ${plugin.name}`, e);
                    }
                }
            }
        }
    }

    getAllPlugins() {
        // Return full info for the Settings UI
        return this.plugins.map(p => ({
            id: p.id,
            name: p.name,
            version: p.version,
            description: p.description,
            disabled: p.disabled
        }));
    }

    getRendererPluginsConfig() {
        // Return only what the renderer needs to load UI extensions, filter out disabled
        return this.plugins.filter(p => !p.disabled).map(p => ({
            id: p.id,
            name: p.id, // Host name for protocol usually maps to folder for easiest path resolution
            rendererEntry: p.rendererEntry
        }));
    }

    // --- Developer / User Actions ---

    openPluginDir() {
        shell.openPath(this.pluginsDir);
    }

    togglePlugin(pluginId, enabled) {
        if (enabled) {
            this.disabledPlugins.delete(pluginId);
        } else {
            this.disabledPlugins.add(pluginId);
        }
        this.saveConfig();
        // Update memory state
        const plugin = this.plugins.find(p => p.id === pluginId);
        if (plugin) plugin.disabled = !enabled;
    }

    async deletePlugin(pluginId) {
        const plugin = this.plugins.find(p => p.id === pluginId);
        if (plugin) {
            try {
                await shell.trashItem(plugin.dir);
                this.plugins = this.plugins.filter(p => p.id !== pluginId);
                this.disabledPlugins.delete(pluginId);
                this.saveConfig();
                return true;
            } catch (e) {
                console.error(`PluginManager: Failed to trash plugin ${pluginId}`, e);
                return false;
            }
        }
        return false;
    }

    getOtaStatus() {
        return {
            swapPerformed: this.otaSwapPerformed,
            newVersion: this.otaSwapNewVersion
        };
    }
}

module.exports = new PluginManager();
