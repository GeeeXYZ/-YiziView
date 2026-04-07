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

            return net.fetch(`file:///${absolutePath}`);
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
}

module.exports = new PluginManager();
