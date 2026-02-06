import React, { createContext, useContext, useState, useEffect } from 'react';

const ExpandedFoldersContext = createContext({
    expandedSet: new Set(),
    setFolderExpanded: (path, expanded) => { }
});

export const useExpandedFolders = () => useContext(ExpandedFoldersContext);

export const ExpandedFoldersProvider = ({ children }) => {
    const [expandedSet, setExpandedSet] = useState(new Set());
    const [isLoaded, setIsLoaded] = useState(false);

    // Initial load
    useEffect(() => {
        const load = async () => {
            const folders = await window.electron.getExpandedFolders();
            setExpandedSet(new Set(folders));
            setIsLoaded(true);
        };
        load();
    }, []);

    const setFolderExpanded = (path, expanded) => {
        // Optimistic update
        setExpandedSet(prev => {
            const newSet = new Set(prev);
            if (expanded) newSet.add(path);
            else newSet.delete(path);
            return newSet;
        });

        // Persist
        window.electron.setFolderExpanded(path, expanded);
    };

    if (!isLoaded) return null; // Or a loading spinner?

    return (
        <ExpandedFoldersContext.Provider value={{ expandedSet, setFolderExpanded }}>
            {children}
        </ExpandedFoldersContext.Provider>
    );
};
