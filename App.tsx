import React from 'react';
import { AuthProvider } from './contexts/AuthContext';
import { InsuranceModule } from './components/InsuranceModule';

const AppContent: React.FC = () => {
  return (
    <div className="flex h-screen bg-opd-bg text-opd-text-primary overflow-hidden">
      <main className="flex-1 relative overflow-auto">
        <InsuranceModule />
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <AuthProvider>
    <AppContent />
  </AuthProvider>
);

export default App;
