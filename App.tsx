import React from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { RoleProvider, useRole } from './contexts/RoleContext';
import { InsuranceModule } from './components/InsuranceModule';
import { AuthModal } from './components/AuthModal';

const AppContent: React.FC = () => {
  const { user: authUser, loading: authLoading } = useAuth();
  const { user: roleUser, loading: roleLoading } = useRole();

  const loading = authLoading || roleLoading;

  if (loading) {
    return (
      <div className="min-h-screen bg-opd-bg flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-opd-primary/20 border-t-opd-primary rounded-full animate-spin" />
      </div>
    );
  }

  if (!authUser || !roleUser) {
    return <AuthModal isOpen={true} onClose={() => {}} />;
  }

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
    <RoleProvider>
      <AppContent />
    </RoleProvider>
  </AuthProvider>
);

export default App;
