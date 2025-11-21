import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Position, Candidate, Voter, Vote, ElectionStatus, Workspace, DEFAULT_USER_IMAGE, AuditLogEntry, AuditLogAction, ElectionDetails, FullAppState, WorkspaceData, AdminProfile } from './types';
import { cloudService } from './services/cloudService';
import AdminPanel from './components/AdminPanel';
import VotingBooth from './components/VotingBooth';
import ResultsChart from './components/ResultsChart';
import { UserIcon, LockIcon, IdentificationIcon, SunIcon, MoonIcon, ChartBarIcon, ShieldCheckIcon, TrophyIcon, CloudIcon, CloudUploadIcon, CloudCheckIcon } from './components/icons';
import WorkspaceManager from './components/WorkspaceManager';
import SuperAdminPanel from './components/SuperAdminPanel';
import VoterVerificationModal from './components/VoterVerificationModal';
import VotedScreen from './components/VotedScreen';
import ReactConfetti from 'react-confetti';

type AppState = 'WORKSPACE_SELECT' | 'LOGIN' | 'ADMIN_VIEW' | 'VOTER_VIEW' | 'VOTED_SCREEN' | 'PUBLIC_RESULTS' | 'SUPER_ADMIN_VIEW';
type Theme = 'light' | 'dark';
type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error';

const useDebouncedEffect = (effect: () => void, deps: any[], delay: number) => {
    const callback = useCallback(effect, deps);
    useEffect(() => {
        const handler = setTimeout(() => {
            callback();
        }, delay);
        return () => clearTimeout(handler);
    }, [callback, delay]);
};

// --- State Defaults ---
const getDefaultWorkspaceData = (): WorkspaceData => ({
    positions: [],
    candidates: [],
    voters: [],
    votes: [],
    electionStatus: 'NOT_STARTED',
    electionDetails: { name: 'School Election', description: '', endTime: null },
    adminProfile: null,
    auditLog: [],
    resultsPublished: false,
});

const getDefaultState = (): FullAppState => ({
    workspaces: [],
    superAdminProfile: {
        id: 'superadmin', name: 'Super Admin', password: 'super123', imageUrl: DEFAULT_USER_IMAGE, contact: '',
    },
    workspaceData: {},
    theme: 'light',
    lastWorkspaceId: null,
    lastBackupTimestamp: null,
});


// --- Reusable Theme Toggle Button ---
const ThemeToggleButton: React.FC<{ theme: Theme, toggleTheme: () => void }> = ({ theme, toggleTheme }) => (
    <button
        onClick={toggleTheme}
        className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-label="Toggle theme"
    >
        {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
    </button>
);

// --- Unified Login Screen ---
const UnifiedLoginScreen: React.FC<{
    onLogin: (id: string, pass: string) => void;
    loginError: string | null;
    theme: Theme;
    toggleTheme: () => void;
    electionStatus: ElectionStatus;
    resultsPublished: boolean;
    onViewResults: () => void;
    workspace: Workspace | null;
    onSwitchWorkspace: () => void;
    setShowVoterVerification: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({ onLogin, loginError, theme, toggleTheme, electionStatus, resultsPublished, onViewResults, workspace, onSwitchWorkspace, setShowVoterVerification }) => {
    const [loginId, setLoginId] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(loginId, password);
    };

    const resultsButtonState = useMemo(() => {
        if (electionStatus === 'ENDED' && resultsPublished) {
            return { disabled: false, text: "View Final Results" };
        }
        return null; // Don't show the button otherwise
    }, [electionStatus, resultsPublished]);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4 transition-colors">
            <div className="absolute top-4 right-4">
                <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />
            </div>
            <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-xl shadow-lg p-8 space-y-6">
                 <div>
                    <h2 className="text-3xl font-bold text-center text-gray-800 dark:text-gray-200">
                        {workspace ? workspace.name : "Election System Login"}
                    </h2>
                    <p className="text-center text-gray-500 dark:text-gray-400">
                        {workspace ? "Election Portal" : "Voter, Admin & Super Admin"}
                    </p>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Login ID</label>
                        <div className="mt-1 relative">
                             <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><UserIcon className="h-5 w-5 text-gray-400" /></div>
                            <input
                                type="text"
                                value={loginId}
                                onChange={(e) => setLoginId(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                                placeholder="Enter your ID"
                                required
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                        <div className="mt-1 relative">
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><LockIcon className="h-5 w-5 text-gray-400" /></div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400"
                                placeholder="Enter password"
                                required
                            />
                        </div>
                         <div className="text-right mt-2">
                            <button type="button" onClick={() => setShowVoterVerification(true)} className="text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                                Find My Voter ID?
                            </button>
                        </div>
                    </div>
                    <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500">
                        Login
                    </button>
                </form>
                {loginError && <p className="text-center text-sm text-red-600">{loginError}</p>}
                <div className="text-center border-t dark:border-gray-700 pt-6 space-y-4">
                     <button onClick={onSwitchWorkspace} className="w-full text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
                        {workspace ? `Not ${workspace.name}? Switch Workspace` : 'Select Workspace to vote'}
                    </button>
                    {resultsButtonState && (
                        <button
                            onClick={onViewResults}
                            disabled={resultsButtonState.disabled}
                            className="inline-flex items-center gap-2 w-full justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:bg-gray-400 disabled:cursor-not-allowed"
                        >
                           <ChartBarIcon className="w-5 h-5"/> {resultsButtonState.text}
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};

interface PublicResultsProps {
    positions: Position[];
    candidates: Candidate[];
    votes: Vote[];
    onBack: () => void;
    theme: Theme;
    toggleTheme: () => void;
    workspaceName: string;
    electionName: string;
    electionStatus: ElectionStatus;
    resultsPublished: boolean;
}

const PublicResults: React.FC<PublicResultsProps> = ({ positions, candidates, votes, onBack, theme, toggleTheme, workspaceName, electionName, electionStatus, resultsPublished }) => {
    const voteCounts = useMemo(() => {
        const counts: { [key: number]: number } = {};
        candidates.forEach(c => counts[c.id] = 0);
        votes.forEach(vote => {
            if (counts[vote.candidateId] !== undefined) {
                counts[vote.candidateId]++;
            }
        });
        return counts;
    }, [votes, candidates]);

    const resultsData = useMemo(() => {
        return positions.map(position => {
            const positionCandidates = candidates
                .filter(c => c.positionId === position.id)
                .map(c => ({ name: c.name, votes: voteCounts[c.id] || 0, imageUrl: c.imageUrl }))
                .sort((a, b) => b.votes - a.votes);
            return {
                positionName: position.name,
                candidates: positionCandidates,
                winner: positionCandidates.length > 0 ? positionCandidates[0] : null
            };
        });
    }, [positions, candidates, voteCounts]);

    if (electionStatus === 'ENDED' && resultsPublished) {
        return (
            <div className="min-h-screen bg-slate-900 text-white p-4 md:p-8 diwali-theme overflow-hidden">
                <ReactConfetti recycle={false} numberOfPieces={400} />
                 <header className="flex justify-between items-center mb-12">
                    <div>
                        <h1 className="text-4xl font-bold text-yellow-300">{electionName}</h1>
                        <h2 className="text-2xl font-semibold text-yellow-200">{workspaceName} - Final Results</h2>
                    </div>
                    <div className="flex items-center gap-4">
                        <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />
                        <button onClick={onBack} className="px-4 py-2 bg-yellow-500/20 border border-yellow-400 text-yellow-300 rounded-lg hover:bg-yellow-500/40">
                            &larr; Back
                        </button>
                    </div>
                </header>
                <div className="space-y-12">
                    {resultsData.map(data => (
                         <div key={data.positionName} className="text-center">
                            <h3 className="text-2xl font-semibold text-yellow-200 mb-2">The new <span className="font-bold text-yellow-100">{data.positionName}</span> is</h3>
                             {data.winner ? (
                                <div className="max-w-md mx-auto bg-slate-800/50 border-2 border-yellow-500 rounded-xl p-8 shadow-lg shadow-yellow-500/10">
                                    <img src={data.winner.imageUrl} alt={data.winner.name} className="w-32 h-32 rounded-full mx-auto mb-4 ring-4 ring-yellow-400 object-cover" />
                                    <p className="text-4xl font-bold text-yellow-300">{data.winner.name}</p>
                                    <p className="text-xl text-yellow-400 mt-2 flex items-center justify-center gap-2">
                                        <TrophyIcon className="w-6 h-6"/> With {data.winner.votes} Votes
                                    </p>
                                </div>
                             ) : (
                                <p className="text-xl text-yellow-300">No winner declared.</p>
                             )}
                         </div>
                    ))}
                </div>
                 <footer className="text-center mt-16">
                    <p className="text-yellow-200 font-bold text-2xl">Congratulations to all the winners!</p>
                </footer>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900 p-4">
             <div className="absolute top-4 right-4">
                <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />
            </div>
            <div className="text-center bg-white dark:bg-gray-800 p-12 rounded-lg shadow-lg">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-200 mb-4">Results Not Yet Published</h2>
                <p className="text-gray-600 dark:text-gray-400 mb-8">
                    The election has concluded. Final results will be available here once published by the administrator.
                </p>
                <button onClick={onBack} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    &larr; Back to Login
                </button>
            </div>
        </div>
    );
};


const App: React.FC = () => {
    // --- STATE MANAGEMENT ---
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [appState, setAppState] = useState<AppState>('LOGIN');
    const [loginError, setLoginError] = useState<string | null>(null);
    const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
    const syncStatusTimer = useRef<number | null>(null);
    
    // --- Top-level states, loaded once ---
    const [theme, setTheme] = useState<Theme>('light');
    const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
    const [superAdminProfile, setSuperAdminProfile] = useState<AdminProfile>({} as AdminProfile);
    const [workspaceData, setWorkspaceData] = useState<Record<string, WorkspaceData>>({});
    const [activeWorkspace, setActiveWorkspace] = useState<Workspace | null>(null);
    const [lastBackupTimestamp, setLastBackupTimestamp] = useState<number | null>(null);

    // --- Derived states for active workspace ---
    const [positions, setPositions] = useState<Position[]>([]);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [voters, setVoters] = useState<Voter[]>([]);
    const [votes, setVotes] = useState<Vote[]>([]);
    const [electionStatus, setElectionStatus] = useState<ElectionStatus>('NOT_STARTED');
    const [electionDetails, setElectionDetails] = useState<ElectionDetails>({ name: 'School Election', description: '', endTime: null });
    const [auditLog, setAuditLog] = useState<AuditLogEntry[]>([]);
    const [resultsPublished, setResultsPublished] = useState<boolean>(false);
    const [adminProfile, setAdminProfile] = useState<AdminProfile | null>(null);
    
    // --- Logged-in user state ---
    const [loggedInAdmin, setLoggedInAdmin] = useState<AdminProfile | null>(null);
    const [loggedInVoter, setLoggedInVoter] = useState<Voter | null>(null);
    const [loggedInSuperAdmin, setLoggedInSuperAdmin] = useState<AdminProfile | null>(null);

    // --- Modal State ---
    const [showVoterVerification, setShowVoterVerification] = useState(false);

    // --- EFFECTS ---

    // 1. Initial Load from Cloud Service
    useEffect(() => {
        cloudService.loadData().then(initialState => {
            const state = initialState || getDefaultState();
            setTheme(state.theme);
            setWorkspaces(state.workspaces);
            setSuperAdminProfile(state.superAdminProfile);
            setWorkspaceData(state.workspaceData);
            setLastBackupTimestamp(state.lastBackupTimestamp);
            
            const lastWs = state.lastWorkspaceId 
                ? state.workspaces.find(ws => ws.id === state.lastWorkspaceId) 
                : null;
            setActiveWorkspace(lastWs);
        }).catch(err => {
            console.error("Failed to load data from cloud:", err);
            // Handle error, maybe show a global error message
        }).finally(() => {
            setIsInitialLoad(false);
        });
    }, []);

    // 2. Hydrate workspace-specific states when activeWorkspace changes
    useEffect(() => {
        if (isInitialLoad) return;
        
        const data = activeWorkspace ? (workspaceData[activeWorkspace.id] || getDefaultWorkspaceData()) : getDefaultWorkspaceData();
        setPositions(data.positions);
        setCandidates(data.candidates);
        setVoters(data.voters);
        setVotes(data.votes);
        setElectionStatus(data.electionStatus);
        setElectionDetails(data.electionDetails);
        setAdminProfile(data.adminProfile);
        setAuditLog(data.auditLog);
        setResultsPublished(data.resultsPublished);

        if (!activeWorkspace && !loggedInSuperAdmin) {
            setAppState('LOGIN');
        }
    }, [activeWorkspace, workspaceData, isInitialLoad, loggedInSuperAdmin]);

    // 3. Update master workspaceData object when any active workspace state changes
    useEffect(() => {
        if (isInitialLoad || !activeWorkspace) return;
        
        setWorkspaceData(prev => ({
            ...prev,
            [activeWorkspace.id]: {
                positions, candidates, voters, votes, electionStatus, 
                electionDetails, adminProfile, auditLog, resultsPublished,
            }
        }));
    }, [
        positions, candidates, voters, votes, electionStatus, 
        electionDetails, adminProfile, auditLog, resultsPublished
    ]);

    // 4. Debounced save to cloud service
    useDebouncedEffect(() => {
        if (isInitialLoad) return;
        
        if (syncStatusTimer.current) clearTimeout(syncStatusTimer.current);
        setSyncStatus('syncing');

        const stateToSave: FullAppState = {
            theme,
            workspaces,
            superAdminProfile,
            workspaceData,
            lastWorkspaceId: activeWorkspace?.id || null,
            lastBackupTimestamp,
        };

        cloudService.saveData(stateToSave).then(() => {
            setSyncStatus('synced');
            syncStatusTimer.current = window.setTimeout(() => setSyncStatus('idle'), 2000);
        }).catch(() => {
            setSyncStatus('error');
        });

    }, [theme, workspaces, superAdminProfile, workspaceData, activeWorkspace, lastBackupTimestamp], 1500);

    // 5. Apply theme to document
    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);
    
    // --- HELPERS ---
    const addAuditLog = (action: AuditLogAction, details: string) => {
        // Super admin actions are global and there's no global audit log.
        if (loggedInSuperAdmin) {
            console.log(`[Super Admin Action] ${action}: ${details}`);
            return;
        }

        let actor: AuditLogEntry['actor'] = { id: 'System', name: 'System', role: 'System' };
        if (loggedInAdmin) {
            actor = { id: loggedInAdmin.id, name: loggedInAdmin.name, role: 'Admin' };
        } else if (loggedInVoter) {
            actor = { id: loggedInVoter.id, name: loggedInVoter.name, role: 'Voter' };
        }

        const newLogEntry: AuditLogEntry = {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            action,
            details,
            actor,
        };
        setAuditLog(prev => [newLogEntry, ...prev]);
    };

    const addAuditLogWithoutActor = (action: AuditLogAction, details: string, actor: AuditLogEntry['actor']) => {
        const newLogEntry: AuditLogEntry = {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: Date.now(),
            action,
            details,
            actor,
        };
        setAuditLog(prev => [newLogEntry, ...prev]);
    };

    const handleBackupToJson = () => {
        try {
            const stateToSave: FullAppState = {
                theme, workspaces, superAdminProfile, workspaceData,
                lastWorkspaceId: activeWorkspace?.id || null, lastBackupTimestamp,
            };
            const formattedData = JSON.stringify(stateToSave, null, 2);
            const blob = new Blob([formattedData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            link.download = `election-data-backup-${timestamp}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
            setLastBackupTimestamp(Date.now());
        } catch (error) {
            console.error("Failed to create backup:", error);
            alert("Failed to create backup file. See console for details.");
        }
    };

    const handleRestoreFromJson = (file: File) => {
        if (!file) {
            alert("Please select a file to restore.");
            return;
        }
        if (!window.confirm("Restoring from a file will overwrite ALL current data in the cloud. This action cannot be undone. Are you sure you want to proceed?")) {
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const text = e.target?.result as string;
                const restoredState = JSON.parse(text) as FullAppState;
                // Save directly to cloud and then reload
                setSyncStatus('syncing');
                cloudService.saveData(restoredState).then(() => {
                    alert("Data restored successfully. The application will now reload.");
                    window.location.reload();
                });
            } catch (error) {
                console.error("Failed to restore from file:", error);
                setSyncStatus('error');
                alert("Failed to restore data. The file may be corrupt or not a valid backup file. See console for details.");
            }
        };
        reader.readAsText(file);
    };

    // --- HANDLERS ---
    const handleSetElectionStatus = (status: ElectionStatus) => {
        const actor = loggedInAdmin ? { id: loggedInAdmin.id, name: loggedInAdmin.name, role: 'Admin' as const } : { id: 'System', name: 'System', role: 'System' as const };
        
        if (status === 'IN_PROGRESS') {
            setElectionDetails(prev => ({
                ...prev,
                endTime: prev.endTime && prev.endTime > Date.now() ? prev.endTime : Date.now() + 8 * 60 * 60 * 1000,
            }));
            addAuditLogWithoutActor('ELECTION_START', 'The election has been started.', actor);
        } else if (status === 'ENDED') {
            setElectionDetails(prev => ({ ...prev, endTime: null }));
            addAuditLogWithoutActor('ELECTION_END', 'The election has been ended.', actor);
        }
        setElectionStatus(status);
    };

    const handleSetResultsPublished = (published: boolean) => {
        setResultsPublished(published);
        addAuditLog(published ? 'RESULTS_PUBLISHED' : 'RESULTS_HIDDEN', `Results were ${published ? 'publicly published' : 'hidden from public view'}.`);
    };
    
    const handleResetElection = () => {
        addAuditLog('ELECTION_RESET', 'The entire election data was reset.');
        const defaultData = getDefaultWorkspaceData();
        setPositions(defaultData.positions);
        setCandidates(defaultData.candidates);
        setVoters(defaultData.voters);
        setVotes(defaultData.votes);
        setAuditLog([]); // Keep old audit logs for SA, but clear for this election cycle
        setElectionStatus(defaultData.electionStatus);
        setElectionDetails(defaultData.electionDetails);
        setResultsPublished(defaultData.resultsPublished);
    };

    const toggleTheme = () => {
        setTheme(prev => prev === 'light' ? 'dark' : 'light');
    };

    const handleLogin = (id: string, pass: string) => {
        setLoginError(null);
        const trimmedId = id.trim();
        
        // 1. Check for Super Admin (workspace-agnostic)
        if (trimmedId === superAdminProfile.id && pass === superAdminProfile.password) {
            setLoggedInSuperAdmin(superAdminProfile);
            setAppState('SUPER_ADMIN_VIEW');
            return;
        }

        // 2. From here, a workspace is required
        if (!activeWorkspace) {
            setLoginError("Please select a workspace before logging in.");
            return;
        }
        
        // 3. Check for Workspace Admin
        if (adminProfile && trimmedId === adminProfile.id && pass === adminProfile.password) {
            setLoggedInAdmin(adminProfile);
            addAuditLogWithoutActor('ADMIN_LOGIN', 'Admin logged in successfully.', {id: adminProfile.id, name: adminProfile.name, role: 'Admin'});
            setAppState('ADMIN_VIEW');
            return;
        }

        // 4. Check for Voter
        const voter = voters.find(v => v.id.toLowerCase() === trimmedId.toLowerCase());
        if (voter && pass === voter.password) {
            if (voter.isBlocked) {
                setLoginError('Your account is blocked. Please contact the administrator.');
                addAuditLogWithoutActor('VOTER_LOGIN_FAIL', `Login failed for voter '${voter.name}' (Account blocked).`, {id: voter.id, name: voter.name, role: 'Voter'});
                return;
            }
            if (electionStatus !== 'IN_PROGRESS') {
                setLoginError('The election is not currently in progress.');
                addAuditLogWithoutActor('VOTER_LOGIN_FAIL', `Login failed for voter '${voter.name}' (Election not in progress).`, {id: voter.id, name: voter.name, role: 'Voter'});
                return;
            }
            if (voter.hasVoted) {
                setLoginError('You have already cast your vote.');
                addAuditLogWithoutActor('VOTER_LOGIN_FAIL', `Login failed for voter '${voter.name}' (Already voted).`, {id: voter.id, name: voter.name, role: 'Voter'});
                return;
            }
            setLoggedInVoter(voter);
            addAuditLogWithoutActor('VOTER_LOGIN_SUCCESS', `Voter '${voter.name}' logged in successfully.`, {id: voter.id, name: voter.name, role: 'Voter'});
            setAppState('VOTER_VIEW');
            return;
        }

        // 5. If nothing matches
        setLoginError("Invalid credentials. Please check your ID and password.");
    };

    const handleVote = (selections: { [key: number]: number[] }) => {
        if (!loggedInVoter) return;

        const newVotes: Vote[] = Object.entries(selections).flatMap(([posId, canIds]) =>
            canIds.map(canId => ({
                voterId: loggedInVoter.id,
                positionId: Number(posId),
                candidateId: canId,
                timestamp: Date.now()
            }))
        );

        setVotes(prev => [...prev, ...newVotes]);
        setVoters(prev => prev.map(v => v.id === loggedInVoter.id ? { ...v, hasVoted: true } : v));
        addAuditLog('VOTE_CAST', `Voter '${loggedInVoter.name}' cast their vote.`);
        setLoggedInVoter(null);
        setAppState('VOTED_SCREEN');
    };
    
    const handleWorkspaceLogout = () => {
        setLoggedInAdmin(null);
        setLoggedInVoter(null);
        setAppState('LOGIN');
    };
    
    const handleFullLogout = () => {
        setLoggedInAdmin(null);
        setLoggedInVoter(null);
        setLoggedInSuperAdmin(null);
        setActiveWorkspace(null); 
        setAppState('LOGIN');
    };
    
    const handleWorkspaceSelected = (workspace: Workspace) => {
        setActiveWorkspace(workspace);
        setAppState('LOGIN');
    };
    
    const handleSwitchToWorkspaceSelect = () => {
        setLoggedInAdmin(null);
        setLoggedInVoter(null);
        setActiveWorkspace(null);
        setAppState('WORKSPACE_SELECT');
    };
    
    // --- Super Admin Handlers ---
    const setAdminProfileForWorkspace = (wsId: string, profile: AdminProfile) => {
        setWorkspaceData(prev => ({
            ...prev,
            [wsId]: {
                ...(prev[wsId] || getDefaultWorkspaceData()),
                adminProfile: profile
            }
        }));
    };

    const handleDeleteWorkspace = (wsId: string) => {
        const wsName = workspaces.find(ws => ws.id === wsId)?.name || 'Unknown';
        addAuditLog('WORKSPACE_DELETED', `Workspace '${wsName}' (ID: ${wsId}) was deleted.`);
        setWorkspaces(prev => prev.filter(ws => ws.id !== wsId));
        setWorkspaceData(prev => {
            const newData = { ...prev };
            delete newData[wsId];
            return newData;
        });
        if (activeWorkspace?.id === wsId) {
            setActiveWorkspace(null);
        }
    };
    
    const handleResetWorkspaceForNewElection = (wsId: string) => {
        const actorProfile = loggedInSuperAdmin || superAdminProfile;
        const newLog: AuditLogEntry = {
            id: `${Date.now()}-sa-reset`,
            timestamp: Date.now(),
            actor: { id: actorProfile.id, name: actorProfile.name, role: 'Super Admin' },
            action: 'ELECTION_RESET',
            details: `Super Admin enabled a new election for this workspace.`
        };

        setWorkspaceData(prev => {
            const wsCurrentData = prev[wsId] || getDefaultWorkspaceData();
            return {
                ...prev,
                [wsId]: {
                    ...wsCurrentData,
                    votes: [],
                    electionStatus: 'NOT_STARTED',
                    electionDetails: { ...wsCurrentData.electionDetails, endTime: null },
                    resultsPublished: false,
                    voters: wsCurrentData.voters.map(v => ({...v, hasVoted: false})),
                    auditLog: [newLog, ...wsCurrentData.auditLog]
                }
            }
        });
    };

    const renderContent = () => {
        if (isInitialLoad) {
            return (
                <div className="min-h-screen flex items-center justify-center bg-gray-100 dark:bg-gray-900">
                    <div className="flex flex-col items-center gap-4">
                        <CloudUploadIcon className="w-12 h-12 text-blue-500 animate-pulse" />
                        <p className="text-lg font-semibold text-gray-700 dark:text-gray-300">Connecting to Cloud Storage...</p>
                    </div>
                </div>
            );
        }

        switch (appState) {
            case 'WORKSPACE_SELECT':
                return <WorkspaceManager 
                    workspaces={workspaces}
                    onWorkspaceSelected={handleWorkspaceSelected}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    onGoBack={() => setAppState('LOGIN')}
                    onRestoreFromJson={handleRestoreFromJson}
                />;
            case 'LOGIN':
                return (
                    <>
                        <UnifiedLoginScreen
                            onLogin={handleLogin}
                            loginError={loginError}
                            theme={theme}
                            toggleTheme={toggleTheme}
                            electionStatus={electionStatus}
                            resultsPublished={resultsPublished}
                            onViewResults={() => setAppState('PUBLIC_RESULTS')}
                            workspace={activeWorkspace}
                            onSwitchWorkspace={handleSwitchToWorkspaceSelect}
                            setShowVoterVerification={setShowVoterVerification}
                        />
                        <VoterVerificationModal 
                            isOpen={showVoterVerification}
                            onClose={() => setShowVoterVerification(false)}
                            voters={voters}
                            theme={theme}
                        />
                    </>
                );
            case 'ADMIN_VIEW':
                if (!loggedInAdmin || !activeWorkspace || !adminProfile) return null;
                return <AdminPanel
                    positions={positions}
                    candidates={candidates}
                    voters={voters}
                    votes={votes}
                    adminProfile={adminProfile}
                    auditLog={auditLog}
                    addAuditLog={addAuditLog}
                    setPositions={setPositions}
                    setCandidates={setCandidates}
                    setVoters={setVoters}
                    setVotes={setVotes}
                    setAdminProfile={setAdminProfile}
                    onLogout={handleWorkspaceLogout}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    electionStatus={electionStatus}
                    setElectionStatus={handleSetElectionStatus}
                    electionDetails={electionDetails}
                    setElectionDetails={setElectionDetails}
                    handleResetElection={handleResetElection}
                    workspaceName={activeWorkspace.name}
                    resultsPublished={resultsPublished}
                    setResultsPublished={handleSetResultsPublished}
                    isSuperAdminOverride={!!loggedInSuperAdmin}
                    onReturnToSuperAdmin={!!loggedInSuperAdmin ? () => {
                        setLoggedInAdmin(null);
                        setAppState('SUPER_ADMIN_VIEW');
                    } : undefined}
                    onBackupToJson={handleBackupToJson}
                    onRestoreFromJson={handleRestoreFromJson}
                    lastBackupTimestamp={lastBackupTimestamp}
                />;
             case 'SUPER_ADMIN_VIEW':
                if (!loggedInSuperAdmin) return null;
                return <SuperAdminPanel 
                    workspaces={workspaces}
                    setWorkspaces={setWorkspaces}
                    superAdminProfile={superAdminProfile}
                    setSuperAdminProfile={setSuperAdminProfile}
                    onEnterWorkspace={(ws) => {
                        setActiveWorkspace(ws);
                        setLoggedInAdmin(workspaceData[ws.id]?.adminProfile || null);
                        setAppState('ADMIN_VIEW');
                    }}
                    onDeleteWorkspace={handleDeleteWorkspace}
                    getAdminProfile={(wsId) => workspaceData[wsId]?.adminProfile || null}
                    setAdminProfile={setAdminProfileForWorkspace}
                    onLogout={handleFullLogout}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    addAuditLog={addAuditLog}
                    getWorkspaceStatus={(wsId) => workspaceData[wsId]?.electionStatus || 'NOT_STARTED'}
                    onEnableNewElection={handleResetWorkspaceForNewElection}
                    onBackupToJson={handleBackupToJson}
                    onRestoreFromJson={handleRestoreFromJson}
                    lastBackupTimestamp={lastBackupTimestamp}
                />;
            case 'VOTER_VIEW':
                if (!loggedInVoter || !activeWorkspace) return null;
                return <VotingBooth
                    voter={loggedInVoter}
                    positions={positions}
                    candidates={candidates}
                    onVote={handleVote}
                    onLogout={handleWorkspaceLogout}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    workspaceName={activeWorkspace.name}
                    electionName={electionDetails.name}
                />;
            case 'VOTED_SCREEN':
                return <VotedScreen onLogout={handleWorkspaceLogout} theme={theme} toggleTheme={toggleTheme} />;
            case 'PUBLIC_RESULTS':
                 if (!activeWorkspace) {
                    handleSwitchToWorkspaceSelect();
                    return null;
                 };
                return <PublicResults
                    positions={positions}
                    candidates={candidates}
                    votes={votes}
                    onBack={() => setAppState('LOGIN')}
                    theme={theme}
                    toggleTheme={toggleTheme}
                    workspaceName={activeWorkspace.name}
                    electionName={electionDetails.name}
                    electionStatus={electionStatus}
                    resultsPublished={resultsPublished}
                />;
            default:
                return <div>Invalid State</div>;
        }
    };

    const SyncStatusIndicator = () => {
        if (syncStatus === 'idle') return null;

        const statusMap = {
            syncing: { icon: <CloudUploadIcon className="w-5 h-5 animate-pulse" />, text: "Syncing...", color: "text-blue-500" },
            synced: { icon: <CloudCheckIcon className="w-5 h-5" />, text: "Saved to Cloud", color: "text-green-500" },
            error: { icon: <CloudIcon className="w-5 h-5" />, text: "Sync Failed", color: "text-red-500" },
        };

        const currentStatus = statusMap[syncStatus];
        if (!currentStatus) return null;

        return (
            <div className={`fixed bottom-4 left-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white dark:bg-gray-800 shadow-lg border dark:border-gray-700 transition-opacity duration-300`}>
                <span className={currentStatus.color}>{currentStatus.icon}</span>
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{currentStatus.text}</span>
            </div>
        );
    };

    return (
        <>
            {renderContent()}
            <SyncStatusIndicator />
        </>
    );
};

export default App;
