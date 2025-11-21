
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Voter, Position, Candidate } from '../types';
import { LogoutIcon, SunIcon, MoonIcon, InformationCircleIcon, ShieldCheckIcon, SpeakerWaveIcon, PlayIcon, PauseIcon } from './icons';
import { GoogleGenAI, Modality } from '@google/genai';

type Theme = 'light' | 'dark';

// --- Audio Helper Functions ---
const decode = (base64: string) => {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
};

const decodeAudioData = async (
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> => {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
};


interface VotingBoothProps {
  voter: Voter;
  positions: Position[];
  candidates: Candidate[];
  onVote: (selections: { [key: number]: number[] }) => void;
  onLogout: () => void;
  theme: Theme;
  toggleTheme: () => void;
  workspaceName: string;
  electionName: string;
}

const ThemeToggleButton: React.FC<{ theme: Theme, toggleTheme: () => void }> = ({ theme, toggleTheme }) => (
    <button
        onClick={toggleTheme}
        className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
        aria-label="Toggle theme"
    >
        {theme === 'light' ? <MoonIcon className="w-5 h-5" /> : <SunIcon className="w-5 h-5" />}
    </button>
);

const CandidateModal: React.FC<{ candidate: Candidate | null, positionName: string, onClose: () => void, theme: Theme }> = ({ candidate, positionName, onClose, theme }) => {
    const [summary, setSummary] = useState('');
    const [isSummarizing, setIsSummarizing] = useState(false);
    const [summaryError, setSummaryError] = useState('');
    
    const [audioBuffer, setAudioBuffer] = useState<AudioBuffer | null>(null);
    const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
    const [audioError, setAudioError] = useState('');
    const [isPlaying, setIsPlaying] = useState(false);

    const audioContextRef = useRef<AudioContext | null>(null);
    const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

    const hasApiKey = process.env.API_KEY && process.env.API_KEY !== 'YOUR_GEMINI_API_KEY';

    useEffect(() => {
        if (candidate) {
            if (!audioContextRef.current || audioContextRef.current.state === 'closed') {
                // FIX: Cast window to any to allow for webkitAudioContext fallback for older browsers.
                audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
            }
        }
        return () => {
            if (audioSourceRef.current) {
                audioSourceRef.current.stop();
                audioSourceRef.current.disconnect();
                audioSourceRef.current = null;
            }
            setIsPlaying(false);
        };
    }, [candidate]);

    const handleSummarize = async () => {
        if (!candidate?.manifesto) return;
        setIsSummarizing(true);
        setSummary('');
        setSummaryError('');
        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: `Please summarize the following candidate manifesto in 2-3 key bullet points:\n\n---\n${candidate.manifesto}`,
            });
            setSummary(response.text);
        } catch (error) {
            console.error("Error summarizing manifesto:", error);
            setSummaryError("Could not generate summary. Please try again later.");
        } finally {
            setIsSummarizing(false);
        }
    };

    const handleGenerateSpeech = async () => {
        if (!candidate?.manifesto) return;
        setIsGeneratingAudio(true);
        setAudioError('');
        setAudioBuffer(null);
        if (audioSourceRef.current) {
            audioSourceRef.current.stop();
        }

        try {
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const textToSpeak = summary || candidate.manifesto;
            const response = await ai.models.generateContent({
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: `Read the following manifesto clearly and professionally: ${textToSpeak}` }] }],
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: {
                        voiceConfig: {
                          prebuiltVoiceConfig: { voiceName: 'Kore' },
                        },
                    },
                },
            });
            const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
            if (base64Audio && audioContextRef.current) {
                const audioBytes = decode(base64Audio);
                const buffer = await decodeAudioData(audioBytes, audioContextRef.current, 24000, 1);
                setAudioBuffer(buffer);
            } else {
                throw new Error("No audio data received.");
            }
        } catch (error) {
            console.error("Error generating speech:", error);
            setAudioError("Could not generate audio. Please try again later.");
        } finally {
            setIsGeneratingAudio(false);
        }
    };
    
    const handlePlayPause = () => {
        if (!audioContextRef.current) return;
        
        if (isPlaying) {
            if (audioSourceRef.current) {
                audioSourceRef.current.stop();
            }
            setIsPlaying(false);
        } else {
            if (audioBuffer) {
                if (audioContextRef.current.state === 'suspended') {
                    audioContextRef.current.resume();
                }
                const source = audioContextRef.current.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(audioContextRef.current.destination);
                source.onended = () => {
                    setIsPlaying(false);
                    audioSourceRef.current = null;
                };
                source.start();
                audioSourceRef.current = source;
                setIsPlaying(true);
            }
        }
    };

    if (!candidate) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl max-w-lg w-full transform transition-transform scale-95 hover:scale-100" onClick={(e) => e.stopPropagation()}>
                <img src={candidate.imageUrl} alt={candidate.name} className="w-32 h-32 rounded-full mx-auto -mt-20 mb-4 ring-4 ring-white dark:ring-gray-700 object-cover" />
                <h3 className="text-2xl font-bold text-center mb-2 text-gray-800 dark:text-gray-200">{candidate.name}</h3>
                <h4 className="text-md font-semibold text-center text-blue-600 dark:text-blue-400 mb-4">{positionName}</h4>
                <div className="text-gray-600 dark:text-gray-400 text-sm max-h-48 overflow-y-auto p-2 border-t border-b dark:border-gray-700">
                    <h5 className="font-bold text-gray-700 dark:text-gray-300 mb-2">Manifesto</h5>
                    <p className="whitespace-pre-wrap">{candidate.manifesto || "No manifesto provided."}</p>
                </div>
                {candidate.manifesto && hasApiKey && (
                    <div className="mt-4 p-2 border-t dark:border-gray-700">
                        <button onClick={handleSummarize} disabled={isSummarizing} className="w-full text-center text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-wait">
                            {isSummarizing ? 'Generating Summary...' : '✨ Summarize with AI'}
                        </button>
                        {summary && <div className="mt-2 p-3 bg-blue-50 dark:bg-blue-900/50 rounded-lg text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">{summary}</div>}
                        {summaryError && <p className="mt-2 text-sm text-red-500 text-center">{summaryError}</p>}
                    </div>
                )}
                {candidate.manifesto && hasApiKey && (
                  <div className="mt-4 pt-4 border-t dark:border-gray-700">
                    <h5 className="font-bold text-gray-700 dark:text-gray-300 mb-2 text-center">Listen to Manifesto</h5>
                    {isGeneratingAudio && <p className="text-sm text-center text-blue-500">Generating audio...</p>}
                    {audioError && <p className="text-sm text-center text-red-500">{audioError}</p>}
                    <div className="flex items-center justify-center gap-4 mt-2">
                        <button onClick={handleGenerateSpeech} disabled={isGeneratingAudio} className="flex-1 text-center text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline disabled:opacity-50 disabled:cursor-wait flex items-center justify-center gap-2">
                            <SpeakerWaveIcon className="w-5 h-5"/>
                            {audioBuffer ? 'Regenerate Audio' : 'Generate Audio'}
                        </button>
                        {audioBuffer && (
                            <button onClick={handlePlayPause} className="p-2 rounded-full bg-blue-600 text-white hover:bg-blue-700">
                                {isPlaying ? <PauseIcon className="w-5 h-5" /> : <PlayIcon className="w-5 h-5" />}
                            </button>
                        )}
                    </div>
                  </div>
                )}
                <div className="flex justify-center mt-6">
                    <button onClick={onClose} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">Close</button>
                </div>
            </div>
        </div>
    );
};


const VotingBooth: React.FC<VotingBoothProps> = ({ voter, positions, candidates, onVote, onLogout, theme, toggleTheme, workspaceName, electionName }) => {
  const [selections, setSelections] = useState<{ [key: number]: number[] }>({});
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [viewingCandidate, setViewingCandidate] = useState<Candidate | null>(null);

  const displayablePositions = useMemo(() => {
    return positions.filter(p => {
      if (p.type === 'CLASS_SPECIFIC') {
        return p.associatedClass === voter.class;
      }
      return true; // General position
    });
  }, [positions, voter.class]);

  const handleSelect = (positionId: number, candidateId: number) => {
    const position = positions.find(p => p.id === positionId);
    if (!position) return;

    const maxVotes = position.maxVotes || 1;
    const currentSelections = selections[positionId] || [];

    if (maxVotes === 1) {
        // Radio button behavior
        setSelections(prev => ({ ...prev, [positionId]: [candidateId] }));
    } else {
        // Checkbox behavior
        const isSelected = currentSelections.includes(candidateId);
        let newSelections;
        if (isSelected) {
            newSelections = currentSelections.filter(id => id !== candidateId);
        } else {
            if (currentSelections.length < maxVotes) {
                newSelections = [...currentSelections, candidateId];
            } else {
                // Optional: alert user they've reached the max
                alert(`You can only select up to ${maxVotes} candidates for this position.`);
                newSelections = currentSelections;
            }
        }
        setSelections(prev => ({ ...prev, [positionId]: newSelections }));
    }
  };

  const isVoteComplete = displayablePositions.every(p => {
    const selectedCount = selections[p.id]?.length || 0;
    return selectedCount > 0;
  });

  const handleSubmit = () => {
    if (!isVoteComplete) {
      alert('Please cast your vote for all positions.');
      return;
    }
    setShowConfirmation(true);
  };

  const confirmVote = () => {
    onVote(selections);
    setShowConfirmation(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex flex-col transition-colors">
      <header className="bg-white dark:bg-gray-800 shadow-md w-full p-4 flex justify-between items-center">
        <div className="flex items-center gap-4">
            <img src={voter.imageUrl} alt={voter.name} className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover ring-2 ring-blue-200 dark:ring-blue-800" />
            <div>
              <p className="text-sm font-semibold text-blue-600 dark:text-blue-400">{electionName}</p>
              <h1 className="text-xl md:text-2xl font-bold text-gray-800 dark:text-gray-200">
                Welcome, <span className="text-blue-600 dark:text-blue-400">{voter.name}</span>
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {workspaceName} | Class: {voter.class} | Roll No: {voter.rollNo}
              </p>
            </div>
        </div>
        <div className="flex items-center gap-4">
            <ThemeToggleButton theme={theme} toggleTheme={toggleTheme} />
            <button onClick={onLogout} className="flex items-center gap-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 transition-colors">
            <LogoutIcon className="w-5 h-5" />
            <span className="hidden md:inline">Logout</span>
            </button>
        </div>
      </header>

      <main className="flex-grow container mx-auto p-4 md:p-8">
        <h2 className="text-2xl font-semibold text-center text-gray-700 dark:text-gray-300 mb-8">Cast Your Vote</h2>
        <div className="space-y-12">
          {displayablePositions.map(position => {
            const maxVotes = position.maxVotes || 1;
            return (
              <div key={position.id}>
                <div className="border-b-2 border-blue-200 dark:border-blue-800 pb-2 mb-6">
                  <h3 className="text-xl font-bold text-blue-700 dark:text-blue-400">{position.name} {position.type === 'CLASS_SPECIFIC' && `(${position.associatedClass})`}</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">Select up to {maxVotes} candidate{maxVotes > 1 ? 's' : ''}.</p>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                  {candidates.filter(c => c.positionId === position.id).map(candidate => (
                    <div
                      key={candidate.id}
                      onClick={() => handleSelect(position.id, candidate.id)}
                      className={`cursor-pointer rounded-lg overflow-hidden shadow-lg transition-all duration-300 relative ${selections[position.id]?.includes(candidate.id) ? 'ring-4 ring-blue-500 scale-105' : 'ring-2 ring-transparent hover:shadow-2xl'}`}
                    >
                      <img className="w-full h-48 object-cover" src={candidate.imageUrl} alt={candidate.name} />
                      <div className="p-4 bg-white dark:bg-gray-800">
                        <p className="font-bold text-lg text-center text-gray-800 dark:text-gray-200">{candidate.name}</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setViewingCandidate(candidate); }}
                        className="absolute top-2 right-2 bg-black/50 text-white rounded-full p-1.5 hover:bg-black/75 transition-colors"
                        aria-label="View Manifesto"
                      >
                        <InformationCircleIcon className="w-5 h-5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </main>

      <footer className="sticky bottom-0 bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm shadow-top p-4 w-full">
        <div className="container mx-auto flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={!isVoteComplete}
            className="w-full md:w-1/2 lg:w-1/3 bg-green-600 text-white font-bold py-3 px-6 rounded-lg shadow-lg hover:bg-green-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Submit My Vote
          </button>
        </div>
      </footer>

      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-8 shadow-2xl max-w-sm w-full text-center">
            <ShieldCheckIcon className="w-16 h-16 text-blue-500 mx-auto mb-4" />
            <h3 className="text-xl font-bold mb-2 text-gray-800 dark:text-gray-200">Confirm Your Vote</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-6">Are you sure you want to submit your vote? This action cannot be undone.</p>
            <div className="flex justify-center gap-4">
              <button onClick={() => setShowConfirmation(false)} className="px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200 dark:hover:bg-gray-500 transition-colors">Cancel</button>
              <button onClick={confirmVote} className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">Yes, Submit Vote</button>
            </div>
          </div>
        </div>
      )}

      <CandidateModal 
        candidate={viewingCandidate}
        onClose={() => setViewingCandidate(null)}
        positionName={positions.find(p => p.id === viewingCandidate?.positionId)?.name || ''}
        theme={theme}
      />
    </div>
  );
};

export default VotingBooth;