import React, { useState, useEffect } from 'react';
import { Workspace, DEFAULT_USER_IMAGE, AuditLogAction, ElectionStatus, Position, Candidate, Voter, Vote, AuditLogEntry, AdminProfile } from '../types';
import { CogIcon, HomeIcon, LogoutIcon, MoonIcon, SunIcon, TrashIcon, UserIcon, ShieldCheckIcon, PencilIcon, UploadIcon, DownloadIcon, ClipboardCopyIcon, ClipboardCheckIcon, RefreshIcon } from './icons';
import ImageCropper from './ImageCropper';

type Theme = 'light' | 'dark';

interface SuperAdminPanelProps {
    workspaces: Workspace[];
    setWorkspaces: React.Dispatch<React.SetStateAction<Workspace[]>>;
    superAdminProfile: AdminProfile;
    setSuperAdminProfile: React.Dispatch<React.SetStateAction<AdminProfile>>;
    onEnterWorkspace: (workspace: Workspace) => void;
    onDeleteWorkspace: (wsId: string) => void;
    getAdminProfile: (wsId: string) => AdminProfile | null;
    setAdminProfile: (wsId: string, profile: AdminProfile) => void;
    onLogout: () => void;
    theme: Theme;
    toggleTheme: () => void;
    addAuditLog: (action: AuditLogAction, details: string) => void;
    getWorkspaceStatus: (wsId: string) => ElectionStatus;
    onEnableNewElection: (wsId: string) => void;
    onBackupToJson: () => void;
    onRestoreFromJson: (file: File) => void;
    lastBackupTimestamp: number | null;
}

type SuperAdminTab = 'DASHBOARD' | 'PROFILE';

const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    while (true) {
        password = '';
        for (let i = 0; i < 8; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        if (/^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/.test(password)) {
            return password;
        }
    }
};

const timeAgo = (timestamp: number) => {
    const now = new Date().getTime();
    const seconds = Math.floor((now - timestamp) / 1000);

    if (seconds < 5) return "just now";
    if (seconds < 60) return `${seconds} seconds ago`;

    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
};

// --- Data Safety Widget ---
const DataSafetyWidget: React.FC<{ lastBackupTimestamp: number | null; onBackup: () => void; }> = ({ lastBackupTimestamp, onBackup }) => {
    const now = Date.now();
    let status: 'safe' | 'warning' | 'danger' = 'danger';
    let message = "No local backup has been created. It is strongly recommended to back up all data to a file periodically.";
    let timeAgoStr = "never";

    if (lastBackupTimestamp) {
        const hoursSinceBackup = (now - lastBackupTimestamp) / (1000 * 60 * 60);
        timeAgoStr = timeAgo(lastBackupTimestamp);

        if (hoursSinceBackup < 24) {
            status = 'safe';
            message = "Data is backed up locally. Regular local backups protect against unforeseen data loss.";
        } else if (hoursSinceBackup < 168) { // 7 days
            status = 'warning';
            message = `Your last local backup was ${timeAgoStr}. Consider creating a new backup soon.`;
        } else {
            status = 'danger';
            message = `It has been over a week since your last local backup. Please create one now to secure your data.`;
        }
    }

    const statusStyles = {
        safe: {
            icon: <ShieldCheckIcon className="w-8 h-8 text-green-500" />,
            bgColor: 'bg-green-50 dark:bg-green-900/50',
            borderColor: 'border-green-500',
            textColor: 'text-green-800 dark:text-green-200',
        },
        warning: {
            icon: <ShieldCheckIcon className="w-8 h-8 text-yellow-500" />,
            bgColor: 'bg-yellow-50 dark:bg-yellow-900/50',
            borderColor: 'border-yellow-500',
            textColor: 'text-yellow-800 dark:text-yellow-200',
        },
        danger: {
            icon: <ShieldCheckIcon className="w-8 h-8 text-red-500" />,
            bgColor: 'bg-red-50 dark:bg-red-900/50',
            borderColor: 'border-red-500',
            textColor: 'text-red-800 dark:text-red-200',
        },
    };

    const currentStyle = statusStyles[status];

    return (
        <div className={`p-4 rounded-lg border-l-4 ${currentStyle.bgColor} ${currentStyle.borderColor} flex flex-col sm:flex-row items-start sm:items-center gap-4`}>
            <div className="flex-shrink-0">{currentStyle.icon}</div>
            <div className="flex-grow">
                <h4 className={`font-bold ${currentStyle.textColor}`}>Global Data Safety</h4>
                <p className={`text-sm ${currentStyle.textColor} mb-1`}>
                    Last Full Local Backup: <span className="font-semibold">{timeAgoStr}</span>
                </p>
                <p className={`text-xs ${currentStyle.textColor}`}>{message}</p>
            </div>
            <button
                onClick={onBackup}
                className="flex-shrink-0 self-start sm:self-center mt-2 sm:mt-0 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
                <DownloadIcon className="w-5 h-5" />
                Backup All Data to File
            </button>
        </div>
    );
};


const SuperAdminPanel: React.FC<SuperAdminPanelProps> = ({
    workspaces, setWorkspaces, superAdminProfile, setSuperAdminProfile,
    onEnterWorkspace, onDeleteWorkspace, getAdminProfile, setAdminProfile,
    onLogout, theme, toggleTheme, addAuditLog, getWorkspaceStatus, onEnableNewElection,
    onBackupToJson, onRestoreFromJson, lastBackupTimestamp
}) => {
    const [activeTab, setActiveTab] = useState<SuperAdminTab>('DASHBOARD');
    const [newWorkspaceName, setNewWorkspaceName] = useState('');
    const [editingAdmin, setEditingAdmin] = useState<{ wsId: string; profile: AdminProfile } | null>(null);
    const [confirmationModal, setConfirmationModal] = useState<{ message: string; onConfirm: () => void; confirmText: string; } | null>(null);
    const [newlyCreatedAdmin, setNewlyCreatedAdmin] = useState<{ wsName: string; profile: AdminProfile } | null>(null);
    const [copySuccess, setCopySuccess] = useState('');

    
    const [editableProfile, setEditableProfile] = useState(superAdminProfile);
    const [passwordFields, setPasswordFields] = useState({ current: '', new: '', confirm: '' });
    const [profileMessage, setProfileMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
    const [cropperState, setCropperState] = useState<{
      src: string | null;
      onComplete: (croppedImageUrl: string) => void;
    }>({ src: null, onComplete: () => {} });

    const openCropper = (e: React.ChangeEvent<HTMLInputElement>, onComplete: (dataUrl: string) => void) => {
      const file = e.target.files?.[0];
      if (file) {
          const reader = new FileReader();
          reader.onloadend = () => {
              setCropperState({
                  src: reader.result as string,
                  onComplete,
              });
          };
          reader.readAsDataURL(file);
          e.target.value = ''; 
      }
    };

    const handleProfileImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        openCropper(e, (croppedImage) => setEditableProfile(prev => ({ ...prev, imageUrl: croppedImage })));
    };

    const handleCreateWorkspace = (e: React.FormEvent) => {
        e.preventDefault();
        if (!newWorkspaceName.trim()) return;

        const trimmedName = newWorkspaceName.trim();
        const idFriendlyName = trimmedName.toLowerCase().replace(/\s+/g, '-');
        const newId = `${idFriendlyName}-${Date.now().toString().slice(-6)}`;
        const newWorkspace: Workspace = { id: newId, name: trimmedName };

        const adminId = `admin-${idFriendlyName.slice(0, 12)}`;
        const adminPassword = generatePassword();
        const newAdminProfile: AdminProfile = {
            id: adminId,
            name: `${trimmedName} Admin`,
            password: adminPassword,
            imageUrl: DEFAULT_USER_IMAGE,
            contact: '',
        };

        setWorkspaces(prev => [...prev, newWorkspace]);
        setAdminProfile(newWorkspace.id, newAdminProfile);
        addAuditLog('WORKSPACE_CREATED', `Created new workspace '${trimmedName}' (ID: ${newId}).`);
        setNewlyCreatedAdmin({ wsName: newWorkspace.name, profile: newAdminProfile });
        setNewWorkspaceName('');
    };
    
    const handleEnableNewElectionRequest = (workspace: Workspace) => {
        setConfirmationModal({
            message: `Are you sure you want to enable a new election for "${workspace.name}"? This will reset all votes and voter statuses, allowing the local administrator to start over. This action is irreversible.`,
            confirmText: "Enable New Election",
            onConfirm: () => {
                onEnableNewElection(workspace.id);
                setConfirmationModal(null);
            }
        });
    };

    const handleDeleteRequest = (workspace: Workspace) => {
        setConfirmationModal({
            message: `Are you sure you want to delete the workspace "${workspace.name}"? This will permanently delete all associated election data (admins, voters, votes, etc.) and cannot be undone.`,
            confirmText: "Delete",
            onConfirm: () => {
                onDeleteWorkspace(workspace.id);
                setConfirmationModal(null);
            }
        });
    };

    const handleOpenAdminEditor = (wsId: string) => {
        const profile = getAdminProfile(wsId);
        const initialProfile = profile || { 
            id: '', 
            name: '', 
            password: '', 
            imageUrl: DEFAULT_USER_IMAGE, 
            contact: '' 
        };
        setEditingAdmin({ wsId, profile: initialProfile });
    };
    
    const handleUpdateAdminProfile = () => {
        if (editingAdmin && editingAdmin.profile.id && editingAdmin.profile.name && editingAdmin.profile.password) {
            const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
            if (!passwordRegex.test(editingAdmin.profile.password)) {
                alert('Password must be at least 6 characters long and contain both letters and numbers.');
                return;
            }
            setAdminProfile(editingAdmin.wsId, editingAdmin.profile);
            setEditingAdmin(null);
        } else {
            alert("Admin ID, Name, and Password cannot be empty.");
        }
    };

    const handleSuperAdminProfileUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        setProfileMessage(null);
        if (passwordFields.current || passwordFields.new || passwordFields.confirm) {
            if (passwordFields.current !== superAdminProfile.password) {
                setProfileMessage({ type: 'error', text: 'Current password is incorrect.' });
                return;
            }
            if (!passwordFields.new || passwordFields.new !== passwordFields.confirm) {
                setProfileMessage({ type: 'error', text: 'New passwords do not match.' });
                return;
            }
            if (passwordFields.new) {
                 const passwordRegex = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{6,}$/;
                if (!passwordRegex.test(passwordFields.new)) {
                    setProfileMessage({ type: 'error', text: 'Password must be at least 6 characters long and contain both letters and numbers.' });
                    return;
                }
            }
        }
        const updatedProfile = { ...editableProfile, password: passwordFields.new ? passwordFields.new : superAdminProfile.password };
        setSuperAdminProfile(updatedProfile);
        addAuditLog('SA_PROFILE_UPDATED', 'Super admin profile was updated.');
        setPasswordFields({ current: '', new: '', confirm: '' });
        setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
    };

    const handleCopy = (textToCopy: string, key: string) => {
        navigator.clipboard.writeText(textToCopy).then(() => {
            setCopySuccess(key);
            setTimeout(() => setCopySuccess(''), 2000);
        });
    };
    
    const StatusBadge: React.FC<{status: ElectionStatus}> = ({status}) => {
        const styles = {
            NOT_STARTED: 'bg-gray-200 text-gray-800 dark:bg-gray-600 dark:text-gray-100',
            IN_PROGRESS: 'bg-green-200 text-green-800 dark:bg-green-700 dark:text-green-100 animate-pulse',
            ENDED: 'bg-blue-200 text-blue-800 dark:bg-blue-700 dark:text-blue-100',
        };
        return <span className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status]}`}>{status.replace('_', ' ')}</span>
    }

    const renderContent = () => {
        switch (activeTab) {
            case 'DASHBOARD':
                return (
                    <div>
                        <h2 className="text-2xl font-bold mb-6 text-gray-700 dark:text-gray-300">Workspace Management</h2>
                        <div className="mb-6">
                            <DataSafetyWidget lastBackupTimestamp={lastBackupTimestamp} onBackup={onBackupToJson} />
                        </div>
                        <form onSubmit={handleCreateWorkspace} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-8 flex gap-4">
                            <input
                                type="text"
                                value={newWorkspaceName}
                                onChange={e => setNewWorkspaceName(e.target.value)}
                                placeholder="New School/Organization Name"
                                className="flex-grow mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                            <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Create Workspace</button>
                        </form>
                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                            <div className="grid grid-cols-1 md:grid-cols-6 font-bold p-2 border-b dark:border-gray-700 text-gray-800 dark:text-gray-200">
                                <span className="md:col-span-2">Name</span>
                                <span className="hidden md:block">ID</span>
                                <span className="hidden md:block">Admin Status</span>
                                <span className="hidden md:block">Election Status</span>
                                <span className="text-right">Actions</span>
                            </div>
                            {workspaces.map(ws => {
                                const admin = getAdminProfile(ws.id);
                                const status = getWorkspaceStatus(ws.id);
                                return (
                                <div key={ws.id} className="grid grid-cols-2 md:grid-cols-6 items-center p-3 border-b dark:border-gray-700 text-gray-800 dark:text-gray-200 last:border-b-0">
                                    <span className="md:col-span-2 font-semibold truncate pr-2">{ws.name}</span>
                                    <code className="hidden md:block text-sm text-gray-500 dark:text-gray-400 truncate pr-2">{ws.id}</code>
                                    <span className="hidden md:block">
                                        {admin ? (
                                            <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full dark:bg-green-700 dark:text-green-100">Configured</span>
                                        ) : (
                                            <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-200 rounded-full dark:bg-red-700 dark:text-red-100">Not Set</span>
                                        )}
                                    </span>
                                    <div className="hidden md:block">
                                        <StatusBadge status={status} />
                                    </div>
                                    <div className="flex justify-end items-center gap-2">
                                        {status === 'ENDED' && (
                                             <button onClick={() => handleEnableNewElectionRequest(ws)} className="text-gray-500 hover:text-yellow-600" title="Enable New Election"><RefreshIcon className="w-5 h-5"/></button>
                                        )}
                                        <button onClick={() => handleOpenAdminEditor(ws.id)} className="text-gray-500 hover:text-blue-600" title={admin ? "Edit Admin" : "Set Admin"}><PencilIcon className="w-5 h-5" /></button>
                                        <button onClick={() => onEnterWorkspace(ws)} className="text-gray-500 hover:text-green-600" title="Enter Workspace"><ShieldCheckIcon className="w-5 h-5"/></button>
                                        <button onClick={() => handleDeleteRequest(ws)} className="text-gray-500 hover:text-red-600" title="Delete Workspace"><TrashIcon className="w-5 h-5" /></button>
                                    </div>
                                </div>
                                );
                            })}
                        </div>
                    </div>
                );
            case 'PROFILE':
                 return (
                    <div>
                        <h2 className="text-2xl font-bold mb-6 text-gray-700 dark:text-gray-300">Super Admin Profile</h2>
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow max-w-2xl mx-auto space-y-6">
                           <form onSubmit={handleSuperAdminProfileUpdate} className="space-y-6">
                                <div className="flex items-center gap-6">
                                    <img src={editableProfile.imageUrl} alt="Super Admin" className="w-24 h-24 rounded-full object-cover ring-4 ring-blue-500 dark:ring-blue-400"/>
                                    <div>
                                        <label htmlFor="sa-image" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Update Profile Image</label>
                                        <input type="file" id="sa-image" onChange={handleProfileImageUpload} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/50 dark:file:text-blue-300 dark:hover:file:bg-blue-900"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                                    <input type="text" value={editableProfile.name} onChange={e => setEditableProfile(p => ({...p, name: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Login ID</label>
                                    <input type="text" value={editableProfile.id} onChange={e => setEditableProfile(p => ({...p, id: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div className="pt-6 border-t dark:border-gray-700">
                                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Change Password</h3>
                                    <div className="space-y-4">
                                        <input type="password" placeholder="Current Password" value={passwordFields.current} onChange={e => setPasswordFields(p => ({...p, current: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                        <input type="password" placeholder="New Password" value={passwordFields.new} onChange={e => setPasswordFields(p => ({...p, new: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                        <input type="password" placeholder="Confirm New Password" value={passwordFields.confirm} onChange={e => setPasswordFields(p => ({...p, confirm: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Password must be at least 6 characters and include both letters and numbers.</p>
                                </div>
                                <div className="flex justify-end items-center gap-4">
                                     {profileMessage && <p className={`text-sm ${profileMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>{profileMessage.text}</p>}
                                    <button type="submit" className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700">Save Changes</button>
                                </div>
                           </form>
                           
                           <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
                                <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Local File Backup &amp; Restore</h3>
                                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                    All platform data is automatically synced to the cloud. Use these options to download a local <code>.json</code> file for manual archiving, or to restore the entire platform from such a file.
                                </p>
                                <div className="flex gap-4 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                                    <button
                                        onClick={onBackupToJson}
                                        className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                    >
                                        <DownloadIcon className="w-5 h-5" />
                                        Download Local Backup
                                    </button>
                                    <label
                                        htmlFor="sa-restore-file-input"
                                        className="flex-1 cursor-pointer inline-flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                                    >
                                        <UploadIcon className="w-5 h-5" />
                                        Restore from Local File
                                    </label>
                                    <input 
                                        type="file" 
                                        id="sa-restore-file-input" 
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
                        </div>
                    </div>
                );
        }
    };

    const NavButton = ({ tab, icon: Icon, label }: { tab: SuperAdminTab; icon: React.FC<{className?:string}>; label: string }) => (
        <button onClick={() => setActiveTab(tab)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg w-full text-left transition-colors ${activeTab === tab ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
            <Icon className="w-5 h-5" />
            <span>{label}</span>
        </button>
    );

    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
            <nav className="w-64 bg-white dark:bg-gray-800 p-6 shadow-lg flex-shrink-0 flex flex-col">
                <div>
                    <h1 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mb-6">Super Admin</h1>
                     <div className="mb-6 text-center border-b dark:border-gray-700 pb-4">
                        <img src={superAdminProfile.imageUrl} alt={superAdminProfile.name} className="w-20 h-20 rounded-full object-cover mx-auto mb-2 ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800" />
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 truncate">{superAdminProfile.name}</h2>
                    </div>
                    <div className="space-y-2">
                        <NavButton tab="DASHBOARD" icon={HomeIcon} label="Dashboard" />
                        <NavButton tab="PROFILE" icon={CogIcon} label="Profile" />
                    </div>
                </div>
                <div className="mt-auto pt-6 border-t dark:border-gray-700 space-y-2">
                     <button onClick={toggleTheme} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                        {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
                        <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
                    </button>
                    <button onClick={onLogout} className="flex items-center gap-3 w-full px-4 py-2.5 rounded-lg text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700">
                        <LogoutIcon className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                </div>
            </nav>
            <main className="flex-grow p-8 overflow-auto">{renderContent()}</main>

            {/* Modals */}
            {confirmationModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-2xl max-w-sm w-full">
                        <h3 className="text-lg font-bold mb-4">Confirm Action</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">{confirmationModal.message}</p>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setConfirmationModal(null)} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600">Cancel</button>
                            <button onClick={confirmationModal.onConfirm} className={`px-4 py-2 rounded-md text-white ${confirmationModal.confirmText.includes("Delete") ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmationModal.confirmText}</button>
                        </div>
                    </div>
                </div>
            )}
            {editingAdmin && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-2xl max-w-md w-full">
                        <h3 className="text-lg font-bold mb-4">
                            { getAdminProfile(editingAdmin.wsId) ? 'Edit Admin' : 'Create Admin' } for {workspaces.find(w=>w.id === editingAdmin.wsId)?.name}
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium">Name</label>
                                <input type="text" value={editingAdmin.profile.name} onChange={e => setEditingAdmin(p => p ? {...p, profile: {...p.profile, name: e.target.value}} : null)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="e.g., John Doe"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Login ID</label>
                                <input type="text" value={editingAdmin.profile.id} onChange={e => setEditingAdmin(p => p ? {...p, profile: {...p.profile, id: e.target.value}} : null)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="e.g., admin_greenwood"/>
                            </div>
                            <div>
                                <label className="block text-sm font-medium">Password</label>
                                <input type="text" value={editingAdmin.profile.password} onChange={e => setEditingAdmin(p => p ? {...p, profile: {...p.profile, password: e.target.value}} : null)} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Enter a secure password"/>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">At least 6 characters with letters and numbers.</p>
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button onClick={() => setEditingAdmin(null)} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600">Cancel</button>
                            <button onClick={handleUpdateAdminProfile} className="px-4 py-2 rounded-md bg-blue-600 text-white">Save Changes</button>
                        </div>
                    </div>
                </div>
            )}
            {newlyCreatedAdmin && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                     <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-2xl max-w-md w-full">
                        <h3 className="text-lg font-bold mb-2">Workspace & Admin Created</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Please save these credentials securely. The password is only shown once.</p>
                        <div className="space-y-3">
                            <p><span className="font-semibold">Workspace:</span> {newlyCreatedAdmin.wsName}</p>
                            <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-md">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Admin Login ID</label>
                                <div className="flex justify-between items-center">
                                    <code>{newlyCreatedAdmin.profile.id}</code>
                                    <button onClick={() => handleCopy(newlyCreatedAdmin.profile.id, 'id')} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1 text-sm">
                                        {copySuccess === 'id' ? <ClipboardCheckIcon className="w-4 h-4 text-green-500"/> : <ClipboardCopyIcon className="w-4 h-4"/>}
                                        {copySuccess === 'id' ? 'Copied' : 'Copy'}
                                    </button>
                                </div>
                            </div>
                             <div className="bg-gray-100 dark:bg-gray-700 p-2 rounded-md">
                                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Admin Password</label>
                                <div className="flex justify-between items-center">
                                    <code>{newlyCreatedAdmin.profile.password}</code>
                                    <button onClick={() => handleCopy(newlyCreatedAdmin.profile.password, 'pw')} className="p-1 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center gap-1 text-sm">
                                        {copySuccess === 'pw' ? <ClipboardCheckIcon className="w-4 h-4 text-green-500"/> : <ClipboardCopyIcon className="w-4 h-4"/>}
                                        {copySuccess === 'pw' ? 'Copied' : 'Copy'}
                                    </button>
                                </div>
                            </div>
                        </div>
                        <div className="flex justify-end mt-6">
                            <button onClick={() => setNewlyCreatedAdmin(null)} className="px-4 py-2 rounded-md bg-blue-600 text-white">Close</button>
                        </div>
                    </div>
                </div>
            )}
            {cropperState.src && (
              <ImageCropper
                isOpen={!!cropperState.src}
                onClose={() => setCropperState({ src: null, onComplete: () => {} })}
                imageSrc={cropperState.src}
                onCropComplete={(croppedImage) => {
                  cropperState.onComplete(croppedImage);
                  setCropperState({ src: null, onComplete: () => {} });
                }}
                theme={theme}
              />
            )}
        </div>
    );
};

export default SuperAdminPanel;