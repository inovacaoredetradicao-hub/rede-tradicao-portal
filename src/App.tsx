import React, { Suspense, useState, lazy } from 'react';
import { AuthProvider, useAuth } from '@/AuthContext';
import { Layout } from '@/components/Layout';
import { Login } from '@/components/Login';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Toaster } from 'sonner';

const OperationalAuditOverview = lazy(() =>
  import('@/features/audit/OperationalAuditOverview').then((m) => ({ default: m.OperationalAuditOverview })),
);
const OperationalCountsAdmin = lazy(() =>
  import('@/features/audit/OperationalCountsAdmin').then((m) => ({ default: m.OperationalCountsAdmin })),
);
const ChecklistsPage = lazy(() => import('@/features/audit/ChecklistsPage').then((m) => ({ default: m.ChecklistsPage })));
const ReturnsPage = lazy(() => import('@/features/audit/ReturnsPage').then((m) => ({ default: m.ReturnsPage })));
const UniformsPage = lazy(() => import('@/features/uniforms/UniformsPage').then((m) => ({ default: m.UniformsPage })));
const ProductsPage = lazy(() => import('@/features/products/ProductsPage').then((m) => ({ default: m.ProductsPage })));
const UsersAdminPage = lazy(() => import('@/features/users/UsersAdminPage').then((m) => ({ default: m.UsersAdminPage })));

function AppContent() {
  const { profile, isAuthReady } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');

  if (!isAuthReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!profile) {
    return <Login />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'management':
        return profile.role === 'admin' ? (
          <OperationalCountsAdmin onBack={() => setActiveTab('overview')} />
        ) : (
          <OperationalAuditOverview onNavigate={setActiveTab} />
        );
      case 'checklists':
        return <ChecklistsPage />;
      case 'returns':
        return <ReturnsPage />;
      case 'uniforms':
        return <UniformsPage />;
      case 'products':
        return profile.role === 'admin' ? <ProductsPage /> : <OperationalAuditOverview onNavigate={setActiveTab} />;
      case 'users':
        return profile.isMaster ? <UsersAdminPage /> : <OperationalAuditOverview onNavigate={setActiveTab} />;
      case 'overview':
      default:
        return <OperationalAuditOverview onNavigate={setActiveTab} />;
    }
  };

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <Suspense
        fallback={
          <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            <p className="text-muted-foreground animate-pulse">Carregando...</p>
          </div>
        }
      >
        {renderContent()}
      </Suspense>
    </Layout>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </ErrorBoundary>
  );
}
