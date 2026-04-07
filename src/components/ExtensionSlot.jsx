import React, { useState, useEffect } from 'react';
import { PluginEngine } from '../managers/PluginEngine';

/**
 * ExtensionSlot component serves as a mount point for plugin injected UI components.
 * 
 * @param {Object} props
 * @param {string} props.name - The unique identifier/name for this UI slot (e.g. 'topbar-actions')
 * @param {Object} [props.context] - Additional context to pass down as props to the injected components
 */
const ExtensionSlot = ({ name, context = {}, className = '' }) => {
    const [components, setComponents] = useState([]);

    useEffect(() => {
        // Initial load
        setComponents(PluginEngine.getComponents(name));

        // Subscribe to changes (e.g. when a new plugin loads late and registers)
        const unsubscribe = PluginEngine.subscribe(name, () => {
            setComponents(PluginEngine.getComponents(name));
        });

        return () => {
            unsubscribe();
        };
    }, [name]);

    if (components.length === 0) {
        return null;
    }

    return (
        <div className={`flex items-center gap-2 plugin-slot-${name} ${className}`}>
            {components.map((Component, index) => (
                <Component key={index} {...context} />
            ))}
        </div>
    );
};

export default ExtensionSlot;
