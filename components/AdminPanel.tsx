import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Position, Candidate, Voter, Vote, ElectionStatus, DEFAULT_USER_IMAGE, AuditLogEntry, AuditLogAction, ElectionDetails, AdminProfile } from '../types';
import { ChartBarIcon, ClipboardListIcon, UsersIcon, IdentificationIcon, LogoutIcon, TrashIcon, SunIcon, MoonIcon, CogIcon, DownloadIcon, HomeIcon, PlayIcon, StopIcon, RefreshIcon, UploadIcon, PencilIcon, DocumentTextIcon, ClipboardCopyIcon, UnlockIcon, TrophyIcon, BanIcon, UserIcon, SwitchHorizontalIcon, ArrowLeftIcon, ClipboardCheckIcon, SearchIcon, MegaphoneIcon, EyeOffIcon, ShieldCheckIcon } from './icons';
import ResultsChart from './ResultsChart';
import { PieChart, Pie, Cell, Tooltip, Legend as RechartsLegend, ResponsiveContainer } from 'recharts';
import ImageCropper from './ImageCropper';

// In a real app, you'd get this from an import, but for a single file component using a global script, this tells TypeScript it's available.
declare const XLSX: any;

type Theme = 'light' | 'dark';

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

interface AdminPanelProps {
  positions: Position[];
  candidates: Candidate[];
  voters: Voter[];
  votes: Vote[];
  adminProfile: AdminProfile;
  auditLog: AuditLogEntry[];
  addAuditLog: (action: AuditLogAction, details: string) => void;
  onLogout: () => void;
  setPositions: React.Dispatch<React.SetStateAction<Position[]>>;
  setCandidates: React.Dispatch<React.SetStateAction<Candidate[]>>;
  setVoters: React.Dispatch<React.SetStateAction<Voter[]>>;
  setVotes: React.Dispatch<React.SetStateAction<Vote[]>>;
  setAdminProfile: React.Dispatch<React.SetStateAction<AdminProfile | null>>;
  theme: Theme;
  toggleTheme: () => void;
  electionStatus: ElectionStatus;
  setElectionStatus: (status: ElectionStatus) => void;
  electionDetails: ElectionDetails;
  setElectionDetails: React.Dispatch<React.SetStateAction<ElectionDetails>>;
  handleResetElection: () => void;
  workspaceName: string;
  isSuperAdminOverride?: boolean;
  onReturnToSuperAdmin?: () => void;
  resultsPublished: boolean;
  setResultsPublished: (published: boolean) => void;
  onBackupToJson: () => void;
  onRestoreFromJson: (file: File) => void;
  lastBackupTimestamp: number | null;
}

type AdminTab = 'DASHBOARD' | 'POSITIONS' | 'CANDIDATES' | 'VOTERS' | 'AUDIT_LOG' | 'PROFILE' | 'SETTINGS';

// --- Data Safety Widget ---
const DataSafetyWidget: React.FC<{ lastBackupTimestamp: number | null; onBackup: () => void; }> = ({ lastBackupTimestamp, onBackup }) => {
    const now = Date.now();
    let status: 'safe' | 'warning' | 'danger' = 'danger';
    let message = "No local backup has been created. It is strongly recommended to back up your data to prevent loss.";
    let timeAgoStr = "never";

    if (lastBackupTimestamp) {
        const hoursSinceBackup = (now - lastBackupTimestamp) / (1000 * 60 * 60);
        timeAgoStr = timeAgo(lastBackupTimestamp);

        if (hoursSinceBackup < 24) {
            status = 'safe';
            message = "Data is backed up locally. Regular backups protect against data loss.";
        } else if (hoursSinceBackup < 168) { // 7 days
            status = 'warning';
            message = `Your last backup was ${timeAgoStr}. Consider creating a new backup soon.`;
        } else {
            status = 'danger';
            message = `It has been over a week since your last backup. Please create one now to secure your data.`;
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
                <h4 className={`font-bold ${currentStyle.textColor}`}>Data Safety Status</h4>
                <p className={`text-sm ${currentStyle.textColor} mb-1`}>
                    Last Local Backup: <span className="font-semibold">{timeAgoStr}</span>
                </p>
                <p className={`text-xs ${currentStyle.textColor}`}>{message}</p>
            </div>
            <button
                onClick={onBackup}
                className="flex-shrink-0 self-start sm:self-center mt-2 sm:mt-0 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            >
                <DownloadIcon className="w-5 h-5" />
                Backup to File
            </button>
        </div>
    );
};

// --- Admin Vote Modal Component ---
interface AdminVoteModalProps {
    voter: Voter;
    positions: Position[];
    candidates: Candidate[];
    onVote: (selections: { [key: number]: number[] }) => void;
    onClose: () => void;
}

const AdminVoteModal: React.FC<AdminVoteModalProps> = ({ voter, positions, candidates, onVote, onClose }) => {
    const [selections, setSelections] = useState<{ [key: number]: number[] }>({});
    const [showConfirmation, setShowConfirmation] = useState(false);

    const handleSelect = (positionId: number, candidateId: number) => {
        const position = positions.find(p => p.id === positionId);
        if (!position) return;

        const maxVotes = position.maxVotes || 1;
        const currentSelections = selections[positionId] || [];

        if (maxVotes === 1) {
            setSelections(prev => ({ ...prev, [positionId]: [candidateId] }));
        } else {
            const isSelected = currentSelections.includes(candidateId);
            let newSelections;
            if (isSelected) {
                newSelections = currentSelections.filter(id => id !== candidateId);
            } else {
                if (currentSelections.length < maxVotes) {
                    newSelections = [...currentSelections, candidateId];
                } else {
                    newSelections = currentSelections; // Do nothing if max is reached
                }
            }
            setSelections(prev => ({ ...prev, [positionId]: newSelections }));
        }
    };
    
    const isVoteComplete = positions.every(p => (selections[p.id]?.length || 0) > 0);
    
    const handleSubmit = () => {
        if (!isVoteComplete) {
            alert('Please cast a vote for all positions.');
            return;
        }
        setShowConfirmation(true);
    };

    const confirmVote = () => {
        onVote(selections);
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl max-w-4xl w-full h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b dark:border-gray-700">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-gray-200">
                        Casting Vote for: <span className="text-blue-600 dark:text-blue-400">{voter.name} ({voter.id})</span>
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">Select candidate(s) for each position below.</p>
                </header>
                
                <main className="flex-grow p-6 overflow-y-auto">
                    <div className="space-y-8">
                    {positions.map(position => {
                        const maxVotes = position.maxVotes || 1;
                        return (
                        <div key={position.id}>
                            <div className="border-b-2 border-blue-200 dark:border-blue-800 pb-1 mb-4">
                               <h3 className="text-lg font-bold text-blue-700 dark:text-blue-400">{position.name}</h3>
                               <p className="text-sm text-gray-500 dark:text-gray-400">Select up to {maxVotes} candidate{maxVotes > 1 ? 's': ''}.</p>
                            </div>
                            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                                {candidates.filter(c => c.positionId === position.id).map(candidate => (
                                <div
                                    key={candidate.id}
                                    onClick={() => handleSelect(position.id, candidate.id)}
                                    className={`cursor-pointer rounded-lg overflow-hidden shadow-md transition-all duration-200 ${selections[position.id]?.includes(candidate.id) ? 'ring-4 ring-blue-500 scale-105' : 'ring-1 ring-transparent hover:shadow-xl'}`}
                                >
                                    <img className="w-full h-32 object-cover" src={candidate.imageUrl} alt={candidate.name} />
                                    <div className="p-3 bg-white dark:bg-gray-700">
                                    <p className="font-bold text-md text-center text-gray-800 dark:text-gray-200">{candidate.name}</p>
                                    </div>
                                </div>
                                ))}
                            </div>
                        </div>
                        );
                    })}
                    </div>
                </main>
                
                <footer className="p-4 border-t dark:border-gray-700 flex justify-end gap-4">
                    <button onClick={onClose} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                    <button
                        onClick={handleSubmit}
                        disabled={!isVoteComplete}
                        className="bg-green-600 text-white font-bold py-2 px-6 rounded-lg shadow-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                        Submit Vote
                    </button>
                </footer>
                
                {showConfirmation && (
                    <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center z-10 p-4">
                        <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl max-w-sm w-full">
                            <h3 className="text-xl font-bold mb-4 text-gray-800 dark:text-gray-200">Confirm Vote</h3>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">Are you sure you want to submit this vote for <span className="font-bold">{voter.name}</span>? This action cannot be undone.</p>
                            <div className="flex justify-end gap-4">
                                <button onClick={() => setShowConfirmation(false)} className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500">Cancel</button>
                                <button onClick={confirmVote} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Confirm</button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};


const ThemeToggleButton: React.FC<{ theme: Theme, toggleTheme: () => void }> = ({ theme, toggleTheme }) => (
    <button
        onClick={toggleTheme}
        className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 transition-colors w-full px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
        aria-label="Toggle theme"
    >
        {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
        <span>{theme === 'light' ? 'Dark Mode' : 'Light Mode'}</span>
    </button>
);

const RADIAN = Math.PI / 180;
const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent == null || percent === 0 || cx == null || cy == null || midAngle == null || innerRadius == null || outerRadius == null) {
      return null;
    }
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
        <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" className="font-bold text-sm">
            {`${(percent * 100).toFixed(0)}%`}
        </text>
    );
};

const CountdownTimer = ({ endTime, onEnd }: { endTime: number; onEnd: () => void; }) => {
    const [timeLeft, setTimeLeft] = useState(endTime - Date.now());

    useEffect(() => {
        if (endTime <= 0) return;
        const timer = setInterval(() => {
            const remaining = endTime - Date.now();
            if (remaining <= 1000) { // Give a 1s buffer to avoid negative display
                clearInterval(timer);
                onEnd();
            } else {
                setTimeLeft(remaining);
            }
        }, 1000);

        return () => clearInterval(timer);
    }, [endTime, onEnd]);

    if (timeLeft <= 0) return <span>Time's up!</span>;

    const hours = Math.floor((timeLeft / (1000 * 60 * 60)) % 24);
    const minutes = Math.floor((timeLeft / 1000 / 60) % 60);
    const seconds = Math.floor((timeLeft / 1000) % 60);

    return (
        <span className="font-mono text-lg font-bold">
            {String(hours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
        </span>
    );
};

const NavButton: React.FC<{ tab: AdminTab, activeTab: AdminTab, setActiveTab: (tab: AdminTab) => void, icon: React.FC<{className?:string}>, label: string }> = ({ tab, activeTab, setActiveTab, icon: Icon, label }) => (
    <button onClick={() => setActiveTab(tab)} className={`flex items-center gap-3 px-4 py-2.5 rounded-lg w-full text-left transition-colors ${activeTab === tab ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'}`}>
        <Icon className="w-5 h-5" />
        <span>{label}</span>
    </button>
);


const AdminPanel: React.FC<AdminPanelProps> = ({
    positions, candidates, voters, votes, adminProfile, auditLog, addAuditLog,
    onLogout, setPositions, setCandidates, setVoters, setVotes, setAdminProfile,
    theme, toggleTheme, electionStatus, setElectionStatus, electionDetails, setElectionDetails, handleResetElection,
    workspaceName, isSuperAdminOverride, onReturnToSuperAdmin, resultsPublished, setResultsPublished,
    onBackupToJson, onRestoreFromJson, lastBackupTimestamp
}) => {
    const [activeTab, setActiveTab] = useState<AdminTab>('DASHBOARD');
    
    // State for Positions
    const [positionModal, setPositionModal] = useState<{ isOpen: boolean; position: Position | null }>({ isOpen: false, position: null });
    const [editingPosition, setEditingPosition] = useState<Partial<Position>>({});

    // State for Candidates
    const [candidateModal, setCandidateModal] = useState<{ isOpen: boolean; candidate: Candidate | null }>({ isOpen: false, candidate: null });
    const [editingCandidate, setEditingCandidate] = useState<Partial<Candidate>>({});
    const [cropperState, setCropperState] = useState<{
      src: string | null;
      onComplete: (croppedImageUrl: string) => void;
    }>({ src: null, onComplete: () => {} });


    // State for Voters
    const [voterModal, setVoterModal] = useState<{ isOpen: boolean; voter: Voter | null }>({ isOpen: false, voter: null });
    const [editingVoter, setEditingVoter] = useState<Partial<Voter>>({});
    const [voterSearch, setVoterSearch] = useState('');
    const [voterToCastVoteFor, setVoterToCastVoteFor] = useState<Voter | null>(null);

    // State for Profile
    const [editableProfile, setEditableProfile] = useState(adminProfile);
    const [passwordFields, setPasswordFields] = useState({ current: '', new: '', confirm: '' });
    const [profileMessage, setProfileMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

    // State for Election Details
    const [electionDetailsModalOpen, setElectionDetailsModalOpen] = useState(false);
    const [editingElectionDetails, setEditingElectionDetails] = useState<ElectionDetails>(electionDetails);

    // State for live updates
    const [liveData, setLiveData] = useState({});
    const liveUpdateInterval = useRef<number | null>(null);
    const [confirmationModal, setConfirmationModal] = useState<{ message: string; onConfirm: () => void; confirmText: string; } | null>(null);
    
    useEffect(() => {
        if (electionStatus === 'IN_PROGRESS') {
            liveUpdateInterval.current = window.setInterval(() => {
                setLiveData({}); // Trigger re-calculation of memos
            }, 5000);
        } else {
            if (liveUpdateInterval.current) {
                clearInterval(liveUpdateInterval.current);
            }
        }
        return () => {
            if (liveUpdateInterval.current) {
                clearInterval(liveUpdateInterval.current);
            }
        };
    }, [electionStatus]);

    const voteCounts = useMemo(() => {
        const counts: { [key: number]: number } = {};
        candidates.forEach(c => counts[c.id] = 0);
        votes.forEach(vote => {
            if (counts[vote.candidateId] !== undefined) {
                counts[vote.candidateId]++;
            }
        });
        return counts;
    }, [votes, candidates, liveData]);

    const votersWhoVotedCount = useMemo(() => {
        return voters.filter(v => v.hasVoted).length;
    }, [voters, liveData]);
    
    const voterTurnout = voters.length > 0 ? (votersWhoVotedCount / voters.length) * 100 : 0;
    
    const leadingCandidates = useMemo(() => {
        const leaders: { [positionId: number]: { name: string, votes: number, leadBy: number } } = {};
        positions.forEach(pos => {
            const positionCandidates = candidates
                .filter(c => c.positionId === pos.id)
                .map(c => ({ ...c, votes: voteCounts[c.id] || 0 }))
                .sort((a, b) => b.votes - a.votes);

            if (positionCandidates.length > 0) {
                const winner = positionCandidates[0];
                const runnerUpVotes = positionCandidates.length > 1 ? positionCandidates[1].votes : 0;
                leaders[pos.id] = {
                    name: winner.name,
                    votes: winner.votes,
                    leadBy: winner.votes - runnerUpVotes
                };
            }
        });
        return leaders;
    }, [positions, candidates, voteCounts]);

    const recentVoterActivity = useMemo(() => {
        return auditLog
            .filter(log => log.action === 'VOTE_CAST')
            .slice(0, 7) // Get the 7 most recent
            .map(log => {
                const voter = voters.find(v => v.id === log.actor.id);
                return {
                    id: log.id,
                    timestamp: log.timestamp,
                    voterImage: voter ? voter.imageUrl : DEFAULT_USER_IMAGE,
                    voterName: log.actor.name || 'Unknown Voter'
                };
            });
    }, [auditLog, voters, liveData]);

    const handlePositionSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const { name, type, associatedClass, maxVotes } = editingPosition;
        if (!name?.trim() || (type === 'CLASS_SPECIFIC' && !associatedClass?.trim())) {
            alert('Position Name is required. If type is Class Specific, Associated Class is also required.');
            return;
        }

        const finalMaxVotes = Number(maxVotes) || 1;
        const finalAssociatedClass = type === 'CLASS_SPECIFIC' ? associatedClass : null;
        
        if (positionModal.position) { // Editing
            const updatedPosition: Position = {
                ...positionModal.position,
                name: name.trim(),
                maxVotes: finalMaxVotes,
                type: type || 'GENERAL',
                associatedClass: finalAssociatedClass,
            };
            setPositions(positions.map(p => p.id === positionModal.position!.id ? updatedPosition : p));
            addAuditLog('POSITION_UPDATED', `Updated position: '${name}'`);
        } else { // Creating
            const newPosition: Position = {
                id: positions.length > 0 ? Math.max(...positions.map(p => p.id)) + 1 : 1,
                name: name.trim(),
                maxVotes: finalMaxVotes,
                type: type || 'GENERAL',
                associatedClass: finalAssociatedClass,
            };
            setPositions([...positions, newPosition]);
            addAuditLog('POSITION_CREATED', `Created position: '${newPosition.name}'`);
        }
        setPositionModal({ isOpen: false, position: null });
    };
    
    const openPositionModal = (position: Position | null) => {
        const posData: Partial<Position> = position 
            ? { ...position, type: position.type || 'GENERAL', associatedClass: position.associatedClass || null } 
            : { name: '', maxVotes: 1, type: 'GENERAL', associatedClass: null };
        setEditingPosition(posData);
        setPositionModal({ isOpen: true, position });
    };

    const handleDeletePosition = (id: number) => {
        const pos = positions.find(p => p.id === id);
        if (!pos) return;
        setConfirmationModal({
            message: `Are you sure you want to delete position '${pos.name}'? All candidates for this position will also be deleted.`,
            confirmText: 'Delete',
            onConfirm: () => {
                setPositions(positions.filter(p => p.id !== id));
                setCandidates(candidates.filter(c => c.positionId !== id));
                addAuditLog('POSITION_DELETED', `Deleted position: '${pos.name}' and its candidates.`);
                setConfirmationModal(null);
            }
        });
    };

    const handleCandidateSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingCandidate.name || !editingCandidate.positionId) {
            alert("Name and Position are required.");
            return;
        }

        if (candidateModal.candidate) { // Editing
            setCandidates(candidates.map(c => c.id === candidateModal.candidate!.id ? { ...c, ...editingCandidate } as Candidate : c));
            addAuditLog('CANDIDATE_UPDATED', `Updated candidate: '${editingCandidate.name}'`);
        } else { // Creating
            const newCandidate: Candidate = {
                id: candidates.length > 0 ? Math.max(...candidates.map(c => c.id)) + 1 : 1,
                name: editingCandidate.name,
                positionId: Number(editingCandidate.positionId),
                imageUrl: editingCandidate.imageUrl || DEFAULT_USER_IMAGE,
                manifesto: editingCandidate.manifesto || '',
                dob: editingCandidate.dob || '',
                mobile: editingCandidate.mobile || ''
            };
            setCandidates([...candidates, newCandidate]);
            addAuditLog('CANDIDATE_CREATED', `Created candidate: '${newCandidate.name}'`);
        }
        setCandidateModal({ isOpen: false, candidate: null });
    };

    const openCandidateModal = (candidate: Candidate | null) => {
        setEditingCandidate(candidate || { imageUrl: DEFAULT_USER_IMAGE });
        setCandidateModal({ isOpen: true, candidate });
    };

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
    
    const handleCandidateImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      openCropper(e, (croppedImage) => {
        setEditingCandidate(prev => ({ ...prev, imageUrl: croppedImage }));
      });
    };

    const handleDeleteCandidate = (id: number) => {
        const candidate = candidates.find(c => c.id === id);
        if (!candidate) return;
        setConfirmationModal({
            message: `Are you sure you want to delete candidate '${candidate.name}'?`,
            confirmText: 'Delete',
            onConfirm: () => {
                setCandidates(candidates.filter(c => c.id !== id));
                addAuditLog('CANDIDATE_DELETED', `Deleted candidate: '${candidate.name}'`);
                setConfirmationModal(null);
            }
        });
    };
    
    const handleVoterSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingVoter.name || !editingVoter.class || !editingVoter.rollNo) {
            alert("Name, Class, and Roll No are required.");
            return;
        }
        
        const voterId = `${editingVoter.class.toLowerCase().replace(/\s/g, '')}-${editingVoter.rollNo}-${Math.random().toString(36).substring(2, 6)}`;

        if (voterModal.voter) { // Editing
            setVoters(voters.map(v => v.id === voterModal.voter!.id ? { ...v, ...editingVoter } as Voter : v));
            addAuditLog('VOTER_UPDATED', `Updated voter: '${editingVoter.name}'`);
        } else { // Creating
            const newVoter: Voter = {
                id: voterId,
                name: editingVoter.name,
                class: editingVoter.class,
                rollNo: editingVoter.rollNo,
                password: editingVoter.rollNo, // Default password is roll number
                hasVoted: false,
                imageUrl: editingVoter.imageUrl || DEFAULT_USER_IMAGE,
                isBlocked: false
            };
            setVoters([...voters, newVoter]);
            addAuditLog('VOTER_CREATED', `Created voter: '${newVoter.name}'`);
        }
        setVoterModal({ isOpen: false, voter: null });
    };

    const openVoterModal = (voter: Voter | null) => {
        setEditingVoter(voter || { imageUrl: DEFAULT_USER_IMAGE });
        setVoterModal({ isOpen: true, voter });
    };
    
    const handleVoterImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        openCropper(e, (croppedImage) => {
            setEditingVoter(prev => ({...prev, imageUrl: croppedImage}));
        });
    };

    const handleDeleteVoter = (id: string) => {
        const voter = voters.find(v => v.id === id);
        if (!voter) return;
        setConfirmationModal({
            message: `Are you sure you want to delete voter '${voter.name}'?`,
            confirmText: 'Delete',
            onConfirm: () => {
                setVoters(voters.filter(v => v.id !== id));
                addAuditLog('VOTER_DELETED', `Deleted voter: '${voter.name}'`);
                setConfirmationModal(null);
            }
        });
    };
    
    const handleToggleVoterBlock = (id: string) => {
        const voter = voters.find(v => v.id === id);
        if (!voter) return;
        setVoters(voters.map(v => v.id === id ? { ...v, isBlocked: !v.isBlocked } : v));
        addAuditLog(voter.isBlocked ? 'VOTER_UNBLOCKED' : 'VOTER_BLOCKED', `${voter.isBlocked ? 'Unblocked' : 'Blocked'} voter: '${voter.name}'`);
    };
    
    const handleResetVoterVote = (id: string) => {
        const voter = voters.find(v => v.id === id);
        if (!voter) return;
        setConfirmationModal({
            message: `Are you sure you want to reset the vote for ${voter.name}? Their previous vote will be discarded.`,
            confirmText: 'Reset Vote',
            onConfirm: () => {
                setVotes(prev => prev.filter(v => v.voterId !== id));
                setVoters(voters.map(v => v.id === id ? { ...v, hasVoted: false } : v));
                addAuditLog('VOTER_VOTE_RESET', `Reset vote for voter: '${voter.name}'.`);
                setConfirmationModal(null);
            }
        });
    };
    
    const handleAdminManualVote = (selections: { [key: number]: number[] }) => {
        if (!voterToCastVoteFor) return;

        const newVotes: Vote[] = Object.entries(selections).flatMap(([posId, canIds]) =>
            canIds.map(canId => ({
                voterId: voterToCastVoteFor.id,
                positionId: Number(posId),
                candidateId: canId,
                timestamp: Date.now()
            }))
        );

        setVotes(prev => [...prev, ...newVotes]);
        setVoters(prev => prev.map(v => v.id === voterToCastVoteFor.id ? { ...v, hasVoted: true } : v));
        addAuditLog('VOTE_CAST', `Admin cast vote on behalf of '${voterToCastVoteFor.name}'`);
        setVoterToCastVoteFor(null);
    };

    const handleDownloadVoterTemplate = () => {
        const sampleData = [
            { "Name": "Aarav Sharma", "Class": "10", "Roll No": "15" },
            { "Name": "Isha Singh", "Class": "12", "Roll No": "3" },
            { "Name": "Rohan Gupta", "Class": "9", "Roll No": "21" },
        ];
        const ws = XLSX.utils.json_to_sheet(sampleData);
        ws['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 10 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "Voters");
        XLSX.writeFile(wb, "voter-import-template.xlsx");
    };
    
    const handleVotersImport = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                const existingVoters = new Set(
                    voters.map(v => 
                        `${(v.name || '').trim().toLowerCase()}|${(v.class || '').toString().trim().toLowerCase()}|${(v.rollNo || '').toString().trim().toLowerCase()}`
                    )
                );
                
                let addedCount = 0;
                let skippedCount = 0;

                const newVoters = (json as any[]).reduce<Voter[]>((acc, row: any) => {
                    const name = (row['Name'] || row['name'] || '').toString().trim();
                    const className = (row['Class'] || row['class'] || '').toString().trim();
                    const rollNo = (row['Roll No'] || row['roll no'] || row['roll'] || '').toString().trim();
                    
                    if (!name || !className || !rollNo) {
                        return acc; 
                    }

                    const duplicateKey = `${name.toLowerCase()}|${className.toLowerCase()}|${rollNo.toLowerCase()}`;

                    if (existingVoters.has(duplicateKey)) {
                        skippedCount++;
                        return acc;
                    }

                    addedCount++;
                    existingVoters.add(duplicateKey);

                    const newVoter: Voter = {
                        id: `${className.toLowerCase().replace(/\s/g, '')}-${rollNo}-${Math.random().toString(36).substring(2, 6)}`,
                        name,
                        class: className,
                        rollNo: rollNo,
                        password: rollNo,
                        hasVoted: false,
                        imageUrl: DEFAULT_USER_IMAGE,
                        isBlocked: false,
                    };
                    acc.push(newVoter);
                    return acc;
                }, []);
                
                if (addedCount > 0) {
                    setVoters(v => [...v, ...newVoters]);
                }
                
                const summary = `Import complete. Added: ${addedCount} new voters. Skipped: ${skippedCount} duplicates.`;
                alert(summary);
                addAuditLog('VOTER_IMPORTED', summary);

            } catch (error) {
                console.error("Import error:", error);
                alert("Failed to import voters. Please ensure it's a valid Excel file with correct column names (Name, Class, Roll No).");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handleCandidatesImport = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = new Uint8Array(e.target!.result as ArrayBuffer);
                const workbook = XLSX.read(data, { type: 'array' });
                const sheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[sheetName];
                const json = XLSX.utils.sheet_to_json(worksheet);

                 const lastIdNum = candidates.length > 0 ? Math.max(...candidates.map(c => c.id)) : 0;
                 const newCandidates = json.map((row: any, index) => {
                    const name = row['Name'] || row['name'];
                    const positionName = row['Position'] || row['position'];
                    const imageUrl = row['Image URL'] || row['image url'] || row['imageUrl'];
                    
                    if (!positionName) return null;
                    const position = positions.find(p => p.name.toLowerCase() === String(positionName).toLowerCase());
                    if (!name || !position) return null;

                    return {
                        id: lastIdNum + index + 1,
                        name: String(name),
                        positionId: position.id,
                        imageUrl: imageUrl || DEFAULT_USER_IMAGE,
                        manifesto: String(row['Manifesto'] || row['manifesto'] || ''),
                        dob: String(row['DOB'] || row['dob'] || ''),
                        mobile: String(row['Mobile'] || row['mobile'] || ''),
                    }
                 }).filter(Boolean) as Candidate[];
                 setCandidates(c => [...c, ...newCandidates]);
                 addAuditLog('CANDIDATE_IMPORTED', `Imported ${newCandidates.length} candidates from file.`);
            } catch (error) {
                console.error("Import error:", error);
                alert("Failed to import candidates. Please ensure it's a valid Excel file with correct column names (Name, Position). Optional columns are: Manifesto, Image URL, DOB, Mobile.");
            }
        };
        reader.readAsArrayBuffer(file);
    };

    const handlePrintVoterCards = () => {
        const printWindow = window.open('', '_blank');
        if (printWindow) {
            printWindow.document.write('<html><head><title>Voter ID Cards</title>');
            printWindow.document.write('<script src="https://cdn.tailwindcss.com"></script>');
            printWindow.document.write(`
                <style>
                    @media print {
                        body { -webkit-print-color-adjust: exact; }
                        .no-print { display: none; }
                    }
                    .voter-card {
                        border: 1px solid #ccc;
                        padding: 1rem;
                        margin: 0.5rem;
                        width: 300px;
                        display: inline-block;
                        vertical-align: top;
                        page-break-inside: avoid;
                    }
                </style>
            `);
            printWindow.document.write('</head><body class="p-4">');
            printWindow.document.write(`<h1 class="text-2xl font-bold mb-4 no-print">${workspaceName} - Voter Cards</h1>`);
            printWindow.document.write(`<button onclick="window.print()" class="no-print bg-blue-500 text-white px-4 py-2 rounded mb-4">Print</button>`);
            
            voters.forEach(voter => {
                printWindow.document.write(`
                    <div class="voter-card rounded-lg bg-white shadow-md">
                        <h2 class="text-lg font-bold text-blue-600">${workspaceName}</h2>
                        <p class="text-sm text-gray-500 mb-2">Official Voter ID Card</p>
                        <div class="border-t pt-2 mt-2">
                            <p><strong>Name:</strong> ${voter.name}</p>
                            <p><strong>Class:</strong> ${voter.class}</p>
                            <p><strong>Roll No:</strong> ${voter.rollNo}</p>
                        </div>
                        <div class="border-t pt-2 mt-2 bg-gray-50 p-2 rounded">
                            <p class="text-xs"><strong>Voter ID:</strong> <code>${voter.id}</code></p>
                            <p class="text-xs"><strong>Password:</strong> <code>${voter.password}</code></p>
                        </div>
                    </div>
                `);
            });

            printWindow.document.write('</body></html>');
            printWindow.document.close();
        }
    };
    
    const handleProfileUpdate = (e: React.FormEvent) => {
        e.preventDefault();
        setProfileMessage(null);
        if (passwordFields.current || passwordFields.new || passwordFields.confirm) {
            if (passwordFields.current !== adminProfile.password) {
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
        const updatedProfile = { ...editableProfile, password: passwordFields.new ? passwordFields.new : adminProfile.password };
        setAdminProfile(updatedProfile);
        addAuditLog('ADMIN_PROFILE_UPDATED', 'Admin profile was updated.');
        setPasswordFields({ current: '', new: '', confirm: '' });
        setProfileMessage({ type: 'success', text: 'Profile updated successfully!' });
    };

    const handleProfileImageUpdate = (e: React.ChangeEvent<HTMLInputElement>) => {
        openCropper(e, (croppedImage) => {
            setEditableProfile(prev => ({...prev, imageUrl: croppedImage}));
        });
    };
    
    const handlePublishResults = () => {
        const publish = !resultsPublished;
        const action = publish ? "Publish" : "Hide";
        setConfirmationModal({
            message: `Are you sure you want to ${action.toLowerCase()} the final election results?`,
            confirmText: action,
            onConfirm: () => {
                setResultsPublished(publish);
                setConfirmationModal(null);
            }
        });
    };

    const filteredVoters = useMemo(() => {
        return voters.filter(v => 
            v.name.toLowerCase().includes(voterSearch.toLowerCase()) ||
            v.id.toLowerCase().includes(voterSearch.toLowerCase()) ||
            v.rollNo.toLowerCase().includes(voterSearch.toLowerCase())
        );
    }, [voters, voterSearch]);

    const availableClasses = useMemo(() => {
        const classSet = new Set(voters.map(v => v.class));
        return Array.from(classSet).sort();
    }, [voters]);

    const handleOpenEditElectionDetails = () => {
        setEditingElectionDetails(electionDetails);
        setElectionDetailsModalOpen(true);
    };

    const handleSaveElectionDetails = (e: React.FormEvent) => {
        e.preventDefault();
        const endTimeValue = (e.target as any).elements.endTime.value;
        const newEndTime = endTimeValue ? new Date(endTimeValue).getTime() : null;

        const updatedDetails = {
            ...editingElectionDetails,
            endTime: newEndTime
        };
        setElectionDetails(updatedDetails);
        addAuditLog('ELECTION_UPDATED', `Updated election details (Name: ${updatedDetails.name}).`);
        setElectionDetailsModalOpen(false);
    };

    const renderContent = () => {
        switch (activeTab) {
            case 'DASHBOARD':
                const chartData = {
                    turnout: [{ name: 'Voted', value: votersWhoVotedCount }, { name: 'Not Voted', value: voters.length - votersWhoVotedCount }],
                };
                const COLORS = ['#3b82f6', '#e5e7eb'];
                return (
                    <div>
                        <h2 className="text-2xl font-bold mb-6 text-gray-700 dark:text-gray-300">Dashboard</h2>
                        <div className="mb-6">
                            <DataSafetyWidget lastBackupTimestamp={lastBackupTimestamp} onBackup={onBackupToJson} />
                        </div>
                        {electionStatus === 'IN_PROGRESS' && (
                            <div className="mb-6 bg-green-100 dark:bg-green-900/50 border-l-4 border-green-500 text-green-700 dark:text-green-200 p-4 rounded-r-lg" role="alert">
                                <p className="font-bold flex items-center gap-2">
                                    <span className="relative flex h-3 w-3">
                                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                        <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                    </span>
                                    Election is LIVE
                                </p>
                                <p>Results are updating in real-time. Time remaining: {electionDetails.endTime && <CountdownTimer endTime={electionDetails.endTime} onEnd={() => setElectionStatus('ENDED')} />}</p>
                            </div>
                        )}
                        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow mb-8">
                            <div className="flex justify-between items-start mb-2">
                                <h3 className="text-xl font-bold text-gray-800 dark:text-gray-200">{electionDetails.name}</h3>
                                <button onClick={handleOpenEditElectionDetails} className="p-1 text-gray-500 hover:text-blue-600 dark:hover:text-blue-400 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700">
                                    <PencilIcon className="w-5 h-5" />
                                </button>
                            </div>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">{electionDetails.description || "No description provided."}</p>
                            {electionDetails.endTime && (
                                <div className="pt-4 border-t dark:border-gray-700">
                                    <h4 className="text-sm font-medium text-gray-500 dark:text-gray-400">Configured End Time</h4>
                                    <p className="font-semibold text-gray-800 dark:text-gray-200">{new Date(electionDetails.endTime).toLocaleString()}</p>
                                </div>
                            )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Voters</h3>
                                <p className="text-3xl font-bold text-gray-800 dark:text-gray-200">{voters.length}</p>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Voters Voted</h3>
                                <p className="text-3xl font-bold text-gray-800 dark:text-gray-200">{votersWhoVotedCount}</p>
                            </div>
                             <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow flex items-center">
                                <div className="w-2/3">
                                    <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Voter Turnout</h3>
                                    <p className="text-3xl font-bold text-gray-800 dark:text-gray-200">{voterTurnout.toFixed(1)}%</p>
                                </div>
                                <div className="w-1/3 h-full">
                                    <ResponsiveContainer>
                                        <PieChart>
                                            <Pie data={chartData.turnout} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={15} outerRadius={25} paddingAngle={2}>
                                                {chartData.turnout.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                                            </Pie>
                                            <Tooltip />
                                        </PieChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>
                            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow">
                                <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Positions</h3>
                                <p className="text-3xl font-bold text-gray-800 dark:text-gray-200">{positions.length}</p>
                            </div>
                        </div>
                        <div className={`grid grid-cols-1 ${electionStatus === 'IN_PROGRESS' ? 'lg:grid-cols-3' : ''} gap-8`}>
                            <div className={`${electionStatus === 'IN_PROGRESS' ? 'lg:col-span-2' : ''}`}>
                                <h3 className="text-xl font-bold mb-4 text-gray-700 dark:text-gray-300">Current Leaders</h3>
                                <div className={`grid grid-cols-1 md:grid-cols-2 ${electionStatus !== 'IN_PROGRESS' ? 'lg:grid-cols-3' : ''} gap-6`}>
                                    {positions.map(pos => (
                                        <div key={pos.id} className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow">
                                            <h4 className="font-bold text-blue-600 dark:text-blue-400">{pos.name}</h4>
                                            {leadingCandidates[pos.id] ? (
                                                <div className="flex items-center gap-2 mt-2">
                                                    <TrophyIcon className="w-6 h-6 text-yellow-500" />
                                                    <div>
                                                        <p className="font-semibold text-gray-800 dark:text-gray-200">{leadingCandidates[pos.id].name}</p>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            {leadingCandidates[pos.id].votes} votes 
                                                            {leadingCandidates[pos.id].leadBy > 0 && ` (leading by ${leadingCandidates[pos.id].leadBy})`}
                                                        </p>
                                                    </div>
                                                </div>
                                            ) : (
                                                <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">No votes cast yet.</p>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                             {electionStatus === 'IN_PROGRESS' && (
                                <div className="lg:col-span-1">
                                    <h3 className="text-xl font-bold mb-4 text-gray-700 dark:text-gray-300">Live Vote Feed</h3>
                                    <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow space-y-2 max-h-[500px] overflow-y-auto">
                                        {recentVoterActivity.length > 0 ? (
                                            recentVoterActivity.map(activity => (
                                                <div key={activity.id} className="flex items-center gap-4 p-2 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors duration-200">
                                                    <img src={activity.voterImage} alt={activity.voterName} className="w-10 h-10 rounded-full object-cover flex-shrink-0"/>
                                                    <div className="flex-grow">
                                                        <p className="font-semibold text-gray-800 dark:text-gray-200 leading-tight">{activity.voterName}</p>
                                                        <p className="text-sm text-gray-500 dark:text-gray-400">
                                                            Voted {timeAgo(activity.timestamp)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        ) : (
                                            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                                                <p>Waiting for the first vote...</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                );
            case 'POSITIONS':
                return (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Manage Positions</h2>
                            <button onClick={() => openPositionModal(null)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Add Position</button>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                           <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                                        <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                                        <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Max Votes</th>
                                        <th className="p-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                    {positions.map(p => (
                                        <tr key={p.id}>
                                            <td className="p-3 font-semibold text-gray-800 dark:text-gray-200">{p.name}</td>
                                            <td className="p-3 text-gray-500 dark:text-gray-400">
                                                {p.type === 'CLASS_SPECIFIC' ? (
                                                    <span className="font-semibold">Class: {p.associatedClass}</span>
                                                ) : (
                                                    <span>General</span>
                                                )}
                                            </td>
                                            <td className="p-3 text-gray-500 dark:text-gray-400">{p.maxVotes || 1}</td>
                                            <td className="p-3 text-right">
                                                <button onClick={() => openPositionModal(p)} className="text-gray-500 hover:text-blue-600 p-1"><PencilIcon className="w-5 h-5"/></button>
                                                <button onClick={() => handleDeletePosition(p.id)} className="text-gray-500 hover:text-red-600 p-1"><TrashIcon className="w-5 h-5"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'CANDIDATES':
                return (
                    <div>
                         <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Manage Candidates</h2>
                            <div className="flex gap-2">
                                <label htmlFor="import-candidates" className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2">
                                    <UploadIcon className="w-5 h-5" /> Import
                                </label>
                                <input type="file" id="import-candidates" className="hidden" accept=".xlsx, .xls, .csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) { handleCandidatesImport(file); } (e.target as HTMLInputElement).value = ''; }} />
                                <button onClick={() => openCandidateModal(null)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Add Candidate</button>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Image</th>
                                        <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                                        <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Position</th>
                                        <th className="p-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                    {candidates.map(c => (
                                        <tr key={c.id}>
                                            <td className="p-3"><img src={c.imageUrl} alt={c.name} className="w-12 h-12 rounded-full object-cover"/></td>
                                            <td className="p-3 font-medium text-gray-900 dark:text-gray-100">{c.name}</td>
                                            <td className="p-3 text-gray-500 dark:text-gray-400">
                                                {(() => {
                                                    const pos = positions.find(p => p.id === c.positionId);
                                                    if (!pos) return 'N/A';
                                                    return `${pos.name}${pos.type === 'CLASS_SPECIFIC' && pos.associatedClass ? ` (${pos.associatedClass})` : ''}`;
                                                })()}
                                            </td>
                                            <td className="p-3 text-right">
                                                <button onClick={() => openCandidateModal(c)} className="text-gray-500 hover:text-blue-600 p-1"><PencilIcon className="w-5 h-5"/></button>
                                                <button onClick={() => handleDeleteCandidate(c.id)} className="text-gray-500 hover:text-red-600 p-1"><TrashIcon className="w-5 h-5"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'VOTERS':
                return (
                    <div>
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Manage Voters</h2>
                            <div className="flex gap-2">
                                <button onClick={handlePrintVoterCards} className="bg-purple-600 text-white px-4 py-2 rounded-md hover:bg-purple-700 flex items-center gap-2">
                                    <DocumentTextIcon className="w-5 h-5" /> Print Cards
                                </button>
                                <button onClick={handleDownloadVoterTemplate} className="bg-gray-500 text-white px-4 py-2 rounded-md hover:bg-gray-600 flex items-center gap-2">
                                    <DownloadIcon className="w-5 h-5" /> Template
                                </button>
                                <label htmlFor="import-voters" className="cursor-pointer bg-green-600 text-white px-4 py-2 rounded-md hover:bg-green-700 flex items-center gap-2">
                                    <UploadIcon className="w-5 h-5" /> Import
                                </label>
                                <input type="file" id="import-voters" className="hidden" accept=".xlsx, .xls, .csv" onChange={(e) => { const file = e.target.files?.[0]; if (file) { handleVotersImport(file); } (e.target as HTMLInputElement).value = ''; }} />
                                <button onClick={() => openVoterModal(null)} className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700">Add Voter</button>
                            </div>
                        </div>
                        <div className="mb-4 relative">
                            <SearchIcon className="w-5 h-5 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2"/>
                            <input 
                                type="text"
                                placeholder="Search by name, ID, or roll no..."
                                value={voterSearch}
                                onChange={(e) => setVoterSearch(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/50 rounded-lg border border-blue-200 dark:border-blue-800 flex items-start gap-3">
                            <div>
                                <UploadIcon className="w-5 h-5 text-blue-500 dark:text-blue-300 mt-0.5" />
                            </div>
                            <div>
                                <p className="text-sm text-blue-800 dark:text-blue-200 font-semibold">
                                    Import voters from an Excel file
                                </p>
                                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                                    Click "Template" to download a sample file with the required columns ('Name', 'Class', 'Roll No'). The 'Class' can be just the grade (e.g., "10") or include a section (e.g., "10-A"). After filling it out, use the "Import" button.
                                </p>
                            </div>
                        </div>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                            <table className="w-full">
                                <thead className="bg-gray-50 dark:bg-gray-700">
                                    <tr>
                                        <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Name</th>
                                        <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">ID</th>
                                        <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Class</th>
                                        <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Roll No</th>
                                        <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                                        <th className="p-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                    {filteredVoters.map(v => (
                                        <tr key={v.id}>
                                            <td className="p-3 font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
                                                <img src={v.imageUrl} alt={v.name} className="w-8 h-8 rounded-full object-cover"/>
                                                {v.name}
                                            </td>
                                            <td className="p-3 text-gray-500 dark:text-gray-400 font-mono text-sm">{v.id}</td>
                                            <td className="p-3 text-gray-500 dark:text-gray-400">{v.class}</td>
                                            <td className="p-3 text-gray-500 dark:text-gray-400">{v.rollNo}</td>
                                            <td className="p-3">
                                                { v.isBlocked ? <span className="px-2 py-1 text-xs font-semibold text-red-800 bg-red-200 rounded-full dark:bg-red-700 dark:text-red-100">Blocked</span>
                                                  : v.hasVoted ? <span className="px-2 py-1 text-xs font-semibold text-green-800 bg-green-200 rounded-full dark:bg-green-700 dark:text-green-100">Voted</span> 
                                                  : <span className="px-2 py-1 text-xs font-semibold text-yellow-800 bg-yellow-200 rounded-full dark:bg-yellow-700 dark:text-yellow-100">Not Voted</span>
                                                }
                                            </td>
                                            <td className="p-3 text-right space-x-1">
                                                <button disabled={v.hasVoted} onClick={() => setVoterToCastVoteFor(v)} className="text-gray-500 hover:text-green-600 p-1 disabled:opacity-30 disabled:cursor-not-allowed" title="Cast Vote for Voter"><ClipboardCheckIcon className="w-5 h-5"/></button>
                                                <button onClick={() => handleResetVoterVote(v.id)} className="text-gray-500 hover:text-yellow-600 p-1" title="Reset Vote Status"><RefreshIcon className="w-5 h-5"/></button>
                                                <button onClick={() => handleToggleVoterBlock(v.id)} className="text-gray-500 hover:text-orange-600 p-1" title={v.isBlocked ? "Unblock Voter" : "Block Voter"}>{v.isBlocked ? <UnlockIcon className="w-5 h-5"/> : <BanIcon className="w-5 h-5"/>}</button>
                                                <button onClick={() => openVoterModal(v)} className="text-gray-500 hover:text-blue-600 p-1"><PencilIcon className="w-5 h-5"/></button>
                                                <button onClick={() => handleDeleteVoter(v.id)} className="text-gray-500 hover:text-red-600 p-1"><TrashIcon className="w-5 h-5"/></button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                );
            case 'AUDIT_LOG':
                return (
                     <div>
                        <h2 className="text-2xl font-bold mb-6 text-gray-700 dark:text-gray-300">Audit Log</h2>
                        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
                             <div className="max-h-[70vh] overflow-y-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50 dark:bg-gray-700 sticky top-0">
                                        <tr>
                                            <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Timestamp</th>
                                            <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actor</th>
                                            <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Action</th>
                                            <th className="p-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Details</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                        {auditLog.map(log => (
                                            <tr key={log.id}>
                                                <td className="p-3 text-sm text-gray-500 dark:text-gray-400 whitespace-nowrap">{new Date(log.timestamp).toLocaleString()}</td>
                                                <td className="p-3 text-sm text-gray-900 dark:text-gray-100">{log.actor.name} ({log.actor.role})</td>
                                                <td className="p-3 text-sm text-gray-500 dark:text-gray-400"><code className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-md text-xs">{log.action}</code></td>
                                                <td className="p-3 text-sm text-gray-500 dark:text-gray-400">{log.details}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                );
            case 'SETTINGS':
                return (
                    <div>
                        <h2 className="text-2xl font-bold mb-6 text-gray-700 dark:text-gray-300">Settings & Data</h2>
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow max-w-2xl mx-auto">
                           <div className="space-y-6">
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-800 dark:text-gray-200 mb-2">Local File Backup &amp; Restore</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                                        Your data is automatically saved to the cloud. Use these options to save a complete backup file (<code>.json</code>) to your computer for archiving, or restore the entire platform state from a previously saved file.
                                    </p>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={onBackupToJson}
                                            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                                        >
                                            <DownloadIcon className="w-5 h-5" />
                                            Download Local Backup
                                        </button>
                                        <label
                                            htmlFor="admin-restore-file-input"
                                            className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
                                        >
                                            <UploadIcon className="w-5 h-5" />
                                            Restore from Local Backup
                                        </label>
                                        <input 
                                            type="file" 
                                            id="admin-restore-file-input" 
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
                    </div>
                );
            case 'PROFILE':
                return (
                     <div>
                        <h2 className="text-2xl font-bold mb-6 text-gray-700 dark:text-gray-300">Admin Profile</h2>
                        <div className="bg-white dark:bg-gray-800 p-8 rounded-lg shadow max-w-2xl mx-auto">
                           <form onSubmit={handleProfileUpdate} className="space-y-6">
                                <div className="flex items-center gap-6">
                                    <img src={editableProfile.imageUrl} alt="Admin" className="w-24 h-24 rounded-full object-cover ring-4 ring-blue-500 dark:ring-blue-400"/>
                                    <div>
                                        <label htmlFor="admin-image" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Update Profile Image</label>
                                        <input type="file" id="admin-image" onChange={handleProfileImageUpdate} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/50 dark:file:text-blue-300 dark:hover:file:bg-blue-900"/>
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Name</label>
                                    <input type="text" value={editableProfile.name} onChange={e => setEditableProfile(p => ({...p, name: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Login ID</label>
                                    <input type="text" value={editableProfile.id} readOnly className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm bg-gray-100 dark:bg-gray-600 dark:border-gray-500 dark:text-gray-300" />
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
                        </div>
                    </div>
                );
        }
    };


    return (
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex">
            <nav className="w-64 bg-white dark:bg-gray-800 p-6 shadow-lg flex-shrink-0 flex flex-col">
                <div>
                     <div className="mb-6 pb-4 border-b dark:border-gray-700">
                        <h1 className="text-xl font-bold text-blue-600 dark:text-blue-400 truncate">{workspaceName}</h1>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Admin Panel</p>
                    </div>
                    <div className="mb-6 text-center">
                        <img src={adminProfile.imageUrl} alt={adminProfile.name} className="w-20 h-20 rounded-full object-cover mx-auto mb-2 ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800" />
                        <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200 truncate">{adminProfile.name}</h2>
                    </div>
                    <div className="space-y-2">
                        <NavButton tab="DASHBOARD" activeTab={activeTab} setActiveTab={setActiveTab} icon={HomeIcon} label="Dashboard" />
                        <NavButton tab="POSITIONS" activeTab={activeTab} setActiveTab={setActiveTab} icon={ClipboardListIcon} label="Positions" />
                        <NavButton tab="CANDIDATES" activeTab={activeTab} setActiveTab={setActiveTab} icon={IdentificationIcon} label="Candidates" />
                        <NavButton tab="VOTERS" activeTab={activeTab} setActiveTab={setActiveTab} icon={UsersIcon} label="Voters" />
                        <NavButton tab="AUDIT_LOG" activeTab={activeTab} setActiveTab={setActiveTab} icon={DocumentTextIcon} label="Audit Log" />
                        <NavButton tab="SETTINGS" activeTab={activeTab} setActiveTab={setActiveTab} icon={CogIcon} label="Settings & Data" />
                    </div>
                </div>

                 <div className="mt-auto pt-6 border-t dark:border-gray-700 space-y-2">
                    <div className="bg-white dark:bg-gray-800 p-3 rounded-lg shadow-inner space-y-2">
                        <h3 className="text-sm font-semibold mb-2 text-gray-700 dark:text-gray-300">Election Control</h3>
                         {electionStatus === 'NOT_STARTED' && (
                            <button onClick={() => setElectionStatus('IN_PROGRESS')} className="w-full bg-green-500 text-white px-3 py-2 text-sm rounded-md hover:bg-green-600 flex items-center justify-center gap-2"><PlayIcon className="w-4 h-4"/> Start Election</button>
                        )}
                        {electionStatus === 'IN_PROGRESS' && (
                            <button onClick={() => setElectionStatus('ENDED')} className="w-full bg-red-500 text-white px-3 py-2 text-sm rounded-md hover:bg-red-600 flex items-center justify-center gap-2"><StopIcon className="w-4 h-4"/> End Election</button>
                        )}
                        {electionStatus === 'ENDED' && (
                             <>
                                <button
                                    onClick={handlePublishResults}
                                    className={`w-full text-white px-3 py-2 text-sm rounded-md flex items-center justify-center gap-2 ${resultsPublished ? 'bg-orange-500 hover:bg-orange-600' : 'bg-indigo-500 hover:bg-indigo-600'}`}
                                >
                                    {resultsPublished ? <><EyeOffIcon className="w-4 h-4" /> Hide Results</> : <><MegaphoneIcon className="w-4 h-4" /> Publish Results</>}
                                </button>
                                <button disabled title="Super Admin must enable a new election" className="w-full bg-gray-400 text-white px-3 py-2 text-sm rounded-md cursor-not-allowed flex items-center justify-center gap-2"><RefreshIcon className="w-4 h-4"/> Reset Blocked</button>
                            </>
                        )}
                    </div>
                    {isSuperAdminOverride && (
                        <button onClick={onReturnToSuperAdmin} className="w-full bg-yellow-500 text-white px-3 py-2 text-sm rounded-md hover:bg-yellow-600 flex items-center justify-center gap-2">
                            <ArrowLeftIcon className="w-4 h-4"/> Return to Super Admin
                        </button>
                    )}
                    <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />
                    <button onClick={onLogout} className="w-full flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors px-4 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700">
                        <LogoutIcon className="w-5 h-5" /> Logout
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
                            <button onClick={confirmationModal.onConfirm} className={`px-4 py-2 rounded-md text-white ${confirmationModal.confirmText.includes("Delete") || confirmationModal.confirmText.includes("Reset") ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}>{confirmationModal.confirmText}</button>
                        </div>
                    </div>
                </div>
            )}
             {positionModal.isOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-2xl max-w-md w-full">
                        <h3 className="text-lg font-bold mb-4">{positionModal.position ? 'Edit' : 'Add'} Position</h3>
                        <form onSubmit={handlePositionSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium">Position Name</label>
                                <input type="text" value={editingPosition.name || ''} onChange={e => setEditingPosition(p => ({...p, name: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required/>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium">Position Type</label>
                                <div className="mt-2 flex gap-4">
                                    <label className="flex items-center">
                                        <input type="radio" value="GENERAL" checked={editingPosition.type === 'GENERAL'} onChange={e => setEditingPosition(p => ({...p, type: e.target.value as 'GENERAL' | 'CLASS_SPECIFIC'}))} className="form-radio h-4 w-4 text-blue-600"/>
                                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">General</span>
                                    </label>
                                    <label className="flex items-center">
                                        <input type="radio" value="CLASS_SPECIFIC" checked={editingPosition.type === 'CLASS_SPECIFIC'} onChange={e => setEditingPosition(p => ({...p, type: e.target.value as 'GENERAL' | 'CLASS_SPECIFIC'}))} className="form-radio h-4 w-4 text-blue-600"/>
                                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">Class Specific</span>
                                    </label>
                                </div>
                            </div>
                             {editingPosition.type === 'CLASS_SPECIFIC' && (
                                <div className="mb-4">
                                    <label className="block text-sm font-medium">Associated Class</label>
                                    <input type="text" list="class-list" value={editingPosition.associatedClass || ''} onChange={e => setEditingPosition(p => ({...p, associatedClass: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required placeholder="e.g., 10-A" />
                                    <datalist id="class-list">
                                        {availableClasses.map(c => <option key={c} value={c} />)}
                                    </datalist>
                                </div>
                            )}
                            <div className="mb-4">
                                <label className="block text-sm font-medium">Max Votes / Voter</label>
                                <input type="number" min="1" value={editingPosition.maxVotes || 1} onChange={e => setEditingPosition(p => ({...p, maxVotes: parseInt(e.target.value, 10)}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required/>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setPositionModal({isOpen: false, position: null})} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-md bg-blue-600 text-white">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
             )}
            {candidateModal.isOpen && (
                 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-2xl max-w-md w-full">
                        <h3 className="text-lg font-bold mb-4">{candidateModal.candidate ? 'Edit' : 'Add'} Candidate</h3>
                        <form onSubmit={handleCandidateSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium">Name</label>
                                <input type="text" value={editingCandidate.name || ''} onChange={e => setEditingCandidate(p => ({...p, name: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required/>
                            </div>
                             <div className="mb-4">
                                <label className="block text-sm font-medium">Position</label>
                                <select value={editingCandidate.positionId || ''} onChange={e => setEditingCandidate(p => ({...p, positionId: Number(e.target.value)}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required>
                                    <option value="" disabled>Select a position</option>
                                    {positions.map(p => (
                                        <option key={p.id} value={p.id}>
                                            {p.name}{p.type === 'CLASS_SPECIFIC' && p.associatedClass ? ` (${p.associatedClass})` : ''}
                                        </option>
                                    ))}
                                </select>
                            </div>
                             <div className="mb-4">
                                <label className="block text-sm font-medium">Manifesto</label>
                                <textarea value={editingCandidate.manifesto || ''} onChange={e => setEditingCandidate(p => ({...p, manifesto: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows={4}/>
                            </div>
                            <div className="mb-4 flex items-center gap-4">
                                <img src={editingCandidate.imageUrl || DEFAULT_USER_IMAGE} alt="Candidate" className="w-20 h-20 rounded-full object-cover"/>
                                <div>
                                    <label htmlFor="candidate-image" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Update Image</label>
                                    <input type="file" id="candidate-image" onChange={handleCandidateImageUpload} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/50 dark:file:text-blue-300 dark:hover:file:bg-blue-900"/>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setCandidateModal({isOpen: false, candidate: null})} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-md bg-blue-600 text-white">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
             {voterModal.isOpen && (
                 <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-2xl max-w-md w-full">
                        <h3 className="text-lg font-bold mb-4">{voterModal.voter ? 'Edit' : 'Add'} Voter</h3>
                        <form onSubmit={handleVoterSubmit}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium">Name</label>
                                <input type="text" value={editingVoter.name || ''} onChange={e => setEditingVoter(p => ({...p, name: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required/>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium">Class</label>
                                <input type="text" value={editingVoter.class || ''} onChange={e => setEditingVoter(p => ({...p, class: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required/>
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium">Roll No</label>
                                <input type="text" value={editingVoter.rollNo || ''} onChange={e => setEditingVoter(p => ({...p, rollNo: e.target.value}))} className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required/>
                            </div>
                            <div className="mb-4 flex items-center gap-4">
                                <img src={editingVoter.imageUrl || DEFAULT_USER_IMAGE} alt="Voter" className="w-20 h-20 rounded-full object-cover"/>
                                <div>
                                    <label htmlFor="voter-image" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Update Image</label>
                                    <input type="file" id="voter-image" onChange={handleVoterImageUpload} accept="image/*" className="mt-1 block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 dark:file:bg-blue-900/50 dark:file:text-blue-300 dark:hover:file:bg-blue-900"/>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setVoterModal({isOpen: false, voter: null})} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-md bg-blue-600 text-white">Save</button>
                            </div>
                        </form>
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
            {voterToCastVoteFor && (
                <AdminVoteModal 
                    voter={voterToCastVoteFor}
                    positions={positions}
                    candidates={candidates}
                    onClose={() => setVoterToCastVoteFor(null)}
                    onVote={handleAdminManualVote}
                />
            )}
             {electionDetailsModalOpen && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-6 shadow-2xl max-w-md w-full">
                        <h3 className="text-lg font-bold mb-4">Edit Election Details</h3>
                        <form onSubmit={handleSaveElectionDetails}>
                            <div className="mb-4">
                                <label className="block text-sm font-medium">Election Name</label>
                                <input 
                                    type="text" 
                                    value={editingElectionDetails.name} 
                                    onChange={e => setEditingElectionDetails(p => ({...p, name: e.target.value}))} 
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" required
                                />
                            </div>
                             <div className="mb-4">
                                <label className="block text-sm font-medium">Description</label>
                                <textarea 
                                    value={editingElectionDetails.description} 
                                    onChange={e => setEditingElectionDetails(p => ({...p, description: e.target.value}))} 
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows={3}
                                />
                            </div>
                            <div className="mb-4">
                                <label className="block text-sm font-medium">End Time (Optional)</label>
                                <input 
                                    type="datetime-local"
                                    name="endTime"
                                    defaultValue={editingElectionDetails.endTime ? new Date(editingElectionDetails.endTime).toISOString().slice(0, 16) : ''}
                                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">If set, the election will end automatically. Leave blank for manual ending.</p>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button type="button" onClick={() => setElectionDetailsModalOpen(false)} className="px-4 py-2 rounded-md bg-gray-200 dark:bg-gray-600">Cancel</button>
                                <button type="submit" className="px-4 py-2 rounded-md bg-blue-600 text-white">Save</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminPanel;