import React, { useState } from 'react';
import { Workspace } from '../types';
import { SunIcon, MoonIcon, ArrowLeftIcon, DownloadIcon, UploadIcon } from './icons';

type Theme = 'light' | 'dark';

interface WorkspaceManagerProps {
    workspaces: Workspace[];
    onWorkspaceSelected: (workspace: Workspace) => void;
    theme: Theme;
    toggleTheme: () => void;
    onGoBack: () => void;
    onRestoreFromJson: (file: File) => void;
}

const WorkspaceManager: React.FC<WorkspaceManagerProps> = ({ workspaces, onWorkspaceSelected, theme, toggleTheme, onGoBack, onRestoreFromJson }) => {
    const [joinId, setJoinId] = useState('');
    const [error, setError] = useState('');

    const handleJoin = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        const targetWorkspace = workspaces.find(ws => ws.id.toLowerCase() === joinId.toLowerCase().trim());
        if (targetWorkspace) {
            onWorkspaceSelected(targetWorkspace);
        } else {
            setError('Workspace ID not found. If this is a new device, use the Restore from Backup feature below.');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
            <div className="absolute top-4 right-4">
                <button onClick={toggleTheme} className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700">
                    {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
                </button>
            </div>
            <div className="max-w-md w-full">
                {workspaces.length === 0 && (
                    <div className="bg-blue-100 dark:bg-blue-900/50 border-l-4 border-blue-500 text-blue-800 dark:text-blue-200 p-4 rounded-r-lg mb-6" role="alert">
                        <h3 className="font-bold">Welcome! First Time Setup?</h3>
                        <p className="mt-2 text-sm">
                           If you have a backup file (<code>.json</code>) from another device or an administrator, use the <strong>Restore from Backup</strong> feature below to load all data. Otherwise, you must join an existing workspace by its ID.
                        </p>
                    </div>
                )}
                <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8">
                    <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200 mb-6">
                        Join an Election Workspace
                    </h2>
                    <form onSubmit={handleJoin} className="space-y-6">
                        <div>
                            <label htmlFor="joinId" className="text-sm font-medium text-gray-700 dark:text-gray-300">Workspace ID</label>
                            <input id="joinId" type="text" value={joinId} onChange={e => setJoinId(e.target.value)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400" placeholder="Enter the ID from your admin" required />
                        </div>
                        <button type="submit" className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700">Join</button>
                    </form>
                    {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
                    
                    <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <h3 className="text-lg font-semibold text-center text-gray-700 dark:text-gray-300 mb-2">Restore from Backup</h3>
                        <p className="text-xs text-center text-gray-500 dark:text-gray-400 mb-4">
                           Setting up a new device? Select your backup file (<code>.json</code>) to restore all election data instantly.
                        </p>
                        <label
                            htmlFor="wm-restore-file-input"
                            className="cursor-pointer w-full inline-flex items-center justify-center gap-2 bg-yellow-500 text-white py-2 px-4 rounded-md hover:bg-yellow-600"
                        >
                            <UploadIcon className="w-5 h-5" />
                            Select Backup File (.json)
                        </label>
                        <input 
                            type="file" 
                            id="wm-restore-file-input" 
                            className="hidden" 
                            accept=".json" 
                            onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                    onRestoreFromJson(file);
                                }
                                (e.target as HTMLInputElement).value = ''; // Reset file input
                            }} 
                        />
                    </div>
                </div>
                <div className="mt-8 text-center">
                    <button
                        onClick={onGoBack}
                        className="inline-flex items-center gap-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition-colors"
                    >
                        <ArrowLeftIcon className="w-4 h-4" />
                        <span>Back to Login</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default WorkspaceManager;
