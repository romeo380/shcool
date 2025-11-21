import React, { useState, useEffect } from 'react';
import ReactConfetti from 'react-confetti';
import { SunIcon, MoonIcon } from './icons';

type Theme = 'light' | 'dark';

interface VotedScreenProps {
    onLogout: () => void;
    theme: Theme;
    toggleTheme: () => void;
}

const ThemeToggleButton: React.FC<{ theme: Theme, toggleTheme: () => void }> = ({ theme, toggleTheme }) => (
    <button
        onClick={toggleTheme}
        className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-label="Toggle theme"
    >
        {theme === 'light' ? <MoonIcon className="w-6 h-6" /> : <SunIcon className="w-6 h-6" />}
    </button>
);

const VotedScreen: React.FC<VotedScreenProps> = ({ onLogout, theme, toggleTheme }) => {
    const [showConfetti, setShowConfetti] = useState(true);
    
    useEffect(() => {
        const timer = setTimeout(() => setShowConfetti(false), 5000); // Confetti for 5 seconds
        return () => clearTimeout(timer);
    }, []);

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            {showConfetti && <ReactConfetti recycle={false} numberOfPieces={200} />}
            <div className="absolute top-4 right-4">
                <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />
            </div>
            <div className="text-center bg-white dark:bg-gray-800 p-12 rounded-lg shadow-lg">
                <h2 className="text-3xl font-bold text-green-600 dark:text-green-400 mb-4">Thank You for Voting!</h2>
                <p className="text-gray-600 dark:text-gray-300 mb-8">Your vote has been cast successfully.</p>
                <button onClick={onLogout} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                    Return to Login
                </button>
            </div>
        </div>
    );
};

export default VotedScreen;
