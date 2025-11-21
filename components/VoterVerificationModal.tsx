

import React, { useState } from 'react';
import { Voter } from '../types';
import { SearchIcon, ClipboardCopyIcon, ClipboardCheckIcon, ShieldCheckIcon } from './icons';

type Theme = 'light' | 'dark';

interface VoterVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    voters: Voter[];
    theme: Theme;
}

const VoterVerificationModal: React.FC<VoterVerificationModalProps> = ({ isOpen, onClose, voters, theme }) => {
    const [name, setName] = useState('');
    const [className, setClassName] = useState('');
    const [rollNo, setRollNo] = useState('');
    const [error, setError] = useState('');
    const [foundVoter, setFoundVoter] = useState<Voter | null>(null);
    const [copySuccess, setCopySuccess] = useState(false);

    const resetState = () => {
        setName('');
        setClassName('');
        setRollNo('');
        setError('');
        setFoundVoter(null);
        setCopySuccess(false);
    };

    const handleClose = () => {
        resetState();
        onClose();
    };

    const handleVerify = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        const voter = voters.find(v =>
            (v.name || '').trim().toLowerCase() === name.trim().toLowerCase() &&
            (v.class || '').trim().toLowerCase() === className.trim().toLowerCase() &&
            (v.rollNo || '').trim().toLowerCase() === rollNo.trim().toLowerCase()
        );

        if (voter) {
            setFoundVoter(voter);
        } else {
            setError('No matching voter found. Please check your details and try again.');
        }
    };
    
    const handleCopyId = () => {
        if (foundVoter) {
            navigator.clipboard.writeText(foundVoter.id).then(() => {
                setCopySuccess(true);
                setTimeout(() => setCopySuccess(false), 2000);
            });
        }
    };

    if (!isOpen) return null;

    const inputClasses = "block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white dark:placeholder-gray-400";

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" aria-modal="true" role="dialog" onClick={handleClose}>
            <div className={`bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full transform transition-all`} onClick={(e) => e.stopPropagation()}>
                {foundVoter ? (
                    foundVoter.hasVoted ? (
                         <div className="p-8 text-center">
                            <ShieldCheckIcon className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-yellow-600 dark:text-yellow-400 mb-4">Vote Already Cast</h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">
                                The voter account for <span className="font-semibold">{foundVoter.name}</span> has already been used to vote in this election.
                            </p>
                            <button onClick={handleClose} className="w-full py-2.5 px-4 mt-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                                Close
                            </button>
                        </div>
                    ) : (
                         <div className="p-8 text-center">
                            <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-4">Voter Found!</h2>
                            <p className="text-gray-600 dark:text-gray-400 mb-6">Use the following credentials to log in.</p>
                            
                            <div className="space-y-4 text-left">
                                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Your Voter ID</label>
                                    <div className="flex items-center justify-between">
                                        <p className="text-lg font-mono font-bold text-gray-800 dark:text-gray-200">{foundVoter.id}</p>
                                        <button onClick={handleCopyId} className="p-2 rounded-md text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/50 flex items-center gap-1.5 transition-colors" aria-label="Copy Voter ID">
                                            {copySuccess ? <ClipboardCheckIcon className="w-4 h-4 text-green-500"/> : <ClipboardCopyIcon className="w-4 h-4"/>}
                                            <span className="text-sm">{copySuccess ? 'Copied!' : 'Copy'}</span>
                                        </button>
                                    </div>
                                </div>
                                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                                    <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Your Password</label>
                                    <p className="text-lg font-mono font-bold text-gray-800 dark:text-gray-200">
                                        {foundVoter.rollNo} <span className="text-sm font-sans font-normal text-gray-500 dark:text-gray-400">(Your Roll Number)</span>
                                    </p>
                                </div>
                            </div>

                            <button onClick={handleClose} className="w-full py-2.5 px-4 mt-8 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                                Return to Login
                            </button>
                        </div>
                    )
                ) : (
                    <div className="p-8">
                        <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-gray-200 mb-6">Find Your Voter ID</h2>

                        <form onSubmit={handleVerify} className="space-y-4">
                            <div>
                                <label htmlFor="verifyName" className="text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                                <input id="verifyName" type="text" value={name} onChange={e => setName(e.target.value)} className={`mt-1 ${inputClasses}`} placeholder="As per school records" required />
                            </div>
                            <div>
                                <label htmlFor="verifyClass" className="text-sm font-medium text-gray-700 dark:text-gray-300">Class</label>
                                <input id="verifyClass" type="text" value={className} onChange={e => setClassName(e.target.value)} className={`mt-1 ${inputClasses}`} placeholder="e.g., 10-B" required />
                            </div>
                            <div>
                                <label htmlFor="verifyRollNo" className="text-sm font-medium text-gray-700 dark:text-gray-300">Roll Number</label>
                                <input id="verifyRollNo" type="text" value={rollNo} onChange={e => setRollNo(e.target.value)} className={`mt-1 ${inputClasses}`} placeholder="e.g., 24" required />
                            </div>
                            <button type="submit" className="w-full flex justify-center items-center gap-2 py-2.5 px-4 mt-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700">
                                <SearchIcon className="w-5 h-5" />
                                Find My ID
                            </button>
                            {error && <p className="mt-4 text-center text-sm text-red-600">{error}</p>}
                        </form>

                        <div className="mt-6 text-center">
                            <button onClick={handleClose} className="text-sm font-medium text-gray-600 dark:text-gray-400 hover:underline">
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default VoterVerificationModal;