class PluginEngineCore {
    constructor() {
        this.slots = new Map(); // slotName -> Set of Components
        this.subscribers = new Map(); // slotName -> Set of callbacks
        this.actions = new Map(); // id -> Action definition
        this.appHooks = {}; // hooks provided by App.jsx, like addCustomPanel
    }

    // --- Developer API (exposed to plugins) ---

    /**
     * Register a React component to a specific UI slot
     * @param {string} slotName 
     * @param {React.Component} Component 
     */
    registerComponent(slotName, Component) {
        if (!this.slots.has(slotName)) {
            this.slots.set(slotName, new Set());
        }
        this.slots.get(slotName).add(Component);
        this._notifySubscribers(slotName);
    }

    /**
     * Unregister a React component from a specific UI slot
     * @param {string} slotName 
     * @param {React.Component} Component 
     */
    unregisterComponent(slotName, Component) {
        if (this.slots.has(slotName)) {
            this.slots.get(slotName).delete(Component);
            this._notifySubscribers(slotName);
        }
    }

    /**
     * Create a custom independent panel (split view)
     * @param {string} id Unique identifier for the panel
     * @param {React.Component} Component Component to render inside the panel
     * @param {string} [title] Optional title for the panel
     */
    addCustomPanel(id, Component, title = 'Custom Panel') {
        if (this.appHooks.addCustomPanel) {
            this.appHooks.addCustomPanel(id, Component, title);
        } else {
            console.warn(`YiziAPI: addCustomPanel called but App hook is not registered yet.`);
        }
    }


    /**
     * Register an executable action/command for a plugin
     * @param {Object} actionDef { id, name, defaultShortcut, onExecute }
     */
    registerAction(actionDef) {
        if (!actionDef || !actionDef.id) return;
        this.actions.set(actionDef.id, actionDef);
        this._notifySubscribers('plugin-actions');
    }

    unregisterAction(actionId) {
        if (this.actions.has(actionId)) {
            this.actions.delete(actionId);
            this._notifySubscribers('plugin-actions');
        }
    }

    /**
     * Get all registered actions
     */
    getActions() {
        return Array.from(this.actions.values());
    }

    /**
     * Get the absolute path of the workspace/folder currently active in YiziView
     */
    getCurrentFolder() {
        if (this.appHooks.getCurrentFolder) {
            return this.appHooks.getCurrentFolder();
        }
        return null;
    }


    // --- Internal Engine API (used by Host React application) ---

    getComponents(slotName) {
        return Array.from(this.slots.get(slotName) || []);
    }

    subscribe(slotName, callback) {
        if (!this.subscribers.has(slotName)) {
            this.subscribers.set(slotName, new Set());
        }
        this.subscribers.get(slotName).add(callback);
        
        return () => {
            const subs = this.subscribers.get(slotName);
            if (subs) subs.delete(callback);
        };
    }

    _notifySubscribers(slotName) {
        const subs = this.subscribers.get(slotName);
        if (subs) {
            subs.forEach(cb => cb());
        }
    }

    /**
     * Register internal app hooks like panel management
     */
    setAppHooks(hooks) {
        this.appHooks = { ...this.appHooks, ...hooks };
    }

    /**
     * Initialize the plugin system and load plugins from main process
     */
    async initialize() {
        if (!window.electron || !window.electron.pluginAPI) {
            console.warn('Plugin Engine: Electron plugin API not found. Running in web mode?');
            return;
        }

        try {
            const plugins = await window.electron.pluginAPI.getPlugins();
            console.log('Plugin Engine: Scanning plugins', plugins);
            
            for (const plugin of plugins) {
                if (plugin.rendererEntry) {
                    try {
                        // Dynamically load the plugin renderer script
                        // If it's a module, we could use dynamic import(). 
                        // For maximum compatibility with arbitrary bundled scripts, we can inject a script tag.
                        // Or if we serve it via custom protocol yiziview-plugin://, we can use import.
                        
                        // Append cache-buster so that hot-reloading (window.location.reload) always fetches the fresh script!
                        const moduleUrl = `yiziview-plugin://${plugin.name}/${plugin.rendererEntry}?t=${Date.now()}`;
                        console.log(`Plugin Engine: Loading UI for ${plugin.name} from ${moduleUrl}`);
                        
                        // We use dynamic import for ESM plugins.
                        // Note: If plugins are UMD, they'll just execute and find window.YiziAPI
                        await import(/* @vite-ignore */ moduleUrl);
                        console.log(`Plugin Engine: Successfully loaded ${plugin.name}`);
                    } catch (err) {
                        console.error(`Plugin Engine: Failed to load UI for ${plugin.name}`, err);
                    }
                }
            }
        } catch (err) {
            console.error('Plugin Engine: Initialization error', err);
        }
    }
}

// Create a singleton instance
export const PluginEngine = new PluginEngineCore();

// Expose the API globally for plugins before anything else loads
window.YiziAPI = PluginEngine;
