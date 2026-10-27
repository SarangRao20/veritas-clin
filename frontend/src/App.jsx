import React, { useState } from 'react';
import Navbar from './components/Navbar';
import LandingView from './components/LandingView';
import AuthView from './components/AuthView';
import InputWorkspace from './components/InputWorkspace';
import ProcessingView from './components/ProcessingView';
import OutputReportView from './components/OutputReportView';
import VivaGuideModal from './components/VivaGuideModal';
import { CLINICAL_CASES } from './data/clinicalCases';

export default function App() {
  const [currentView, setCurrentView] = useState('landing');
  const [user, setUser] = useState(null);
  const [selectedCaseKey, setSelectedCaseKey] = useState('trap_aki_negation');
  const [noteText, setNoteText] = useState(CLINICAL_CASES.trap_aki_negation.rawText);
  const [threshold, setThreshold] = useState(0.35);
  const [strictness, setStrictness] = useState('inpatient');
  const [isGuideOpen, setIsGuideOpen] = useState(false);

  const handleSelectCase = (key) => {
    setSelectedCaseKey(key);
    if (CLINICAL_CASES[key]) {
      setNoteText(CLINICAL_CASES[key].rawText);
    }
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setCurrentView('input');
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900 font-sans">
      
      {/* Top Navbar */}
      <Navbar 
        currentView={currentView}
        onNavigate={setCurrentView}
        user={user}
        onOpenGuide={() => setIsGuideOpen(true)}
      />

      {/* Main Multi-Stage Views */}
      <main className="flex-1 flex flex-col">
        {currentView === 'landing' && (
          <LandingView 
            onLaunchStudio={() => setCurrentView('input')}
            onOpenGuide={() => setIsGuideOpen(true)}
          />
        )}

        {currentView === 'auth' && (
          <AuthView 
            onLoginSuccess={handleLoginSuccess}
          />
        )}

        {currentView === 'input' && (
          <InputWorkspace 
            selectedCaseKey={selectedCaseKey}
            onSelectCase={handleSelectCase}
            noteText={noteText}
            onNoteTextChange={setNoteText}
            threshold={threshold}
            onThresholdChange={setThreshold}
            strictness={strictness}
            onStrictnessChange={setStrictness}
            onProceedToAudit={() => setCurrentView('processing')}
            onOpenGuide={() => setIsGuideOpen(true)}
          />
        )}

        {currentView === 'processing' && (
          <ProcessingView 
            threshold={threshold}
            onComplete={() => setCurrentView('output')}
          />
        )}

        {currentView === 'output' && (
          <OutputReportView 
            selectedCaseKey={selectedCaseKey}
            threshold={threshold}
            onBackToIntake={() => setCurrentView('input')}
          />
        )}
      </main>

      {/* Footer (Displayed on landing) */}
      {currentView === 'landing' && (
        <footer className="bg-white border-t border-slate-200 py-10 px-4 sm:px-6 lg:px-8 text-xs text-slate-500 font-mono text-center">
          <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              &copy; 2026 Veritas-Clin &bull; Evidence-Grounded Extraction &bull; Academic Capstone
            </div>
            <div className="flex items-center gap-6">
              <a href="https://github.com/SarangRao20/veritas-clin" target="_blank" rel="noopener noreferrer" className="hover:text-sky-600 transition-colors">
                GitHub Repository
              </a>
              <button onClick={() => setIsGuideOpen(true)} className="hover:text-sky-600 transition-colors">
                Viva Defense Guide
              </button>
            </div>
          </div>
        </footer>
      )}

      {/* Slide-over Examiner Viva Guide Modal */}
      <VivaGuideModal 
        isOpen={isGuideOpen}
        onClose={() => setIsGuideOpen(false)}
      />

    </div>
  );
}
