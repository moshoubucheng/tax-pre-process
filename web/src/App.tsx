import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { ClientProvider } from './hooks/useClientContext';
import Login from './pages/Login';
import ClientDashboard from './pages/ClientDashboard';
import Upload from './pages/Upload';
import AdminHome from './pages/AdminHome';
import AdminTransactions from './pages/AdminTransactions';
import Clients from './pages/Clients';
import AdminReceipts from './pages/AdminReceipts';
import Chat from './pages/Chat';
import Documents from './pages/Documents';
import AdminDocuments from './pages/AdminDocuments';
import Settings from './pages/Settings';
import ReviewStation from './pages/ReviewStation';
import AuditSearch from './pages/AuditSearch';
import Layout from './components/layout/Layout';

// Client-specific pages (admin viewing a client)
import ClientDashboardAdmin from './pages/client/ClientDashboard';
import ClientReview from './pages/client/ClientReview';
import ClientDocumentsAdmin from './pages/client/ClientDocuments';
import ClientTransactions from './pages/client/ClientTransactions';

function PrivateRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (adminOnly && user.role !== 'admin') {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<Login />} />

      {/* Home - Admin sees dashboard, Client sees their dashboard */}
      <Route path="/" element={
        <PrivateRoute>
          <Layout>
            {user?.role === 'admin' ? <AdminHome /> : <ClientDashboard />}
          </Layout>
        </PrivateRoute>
      } />

      {/* Clients list (Admin only) */}
      <Route path="/clients" element={
        <PrivateRoute adminOnly>
          <Layout>
            <Clients />
          </Layout>
        </PrivateRoute>
      } />

      {/* Admin Transactions - Global view across all companies */}
      <Route path="/admin/transactions" element={
        <PrivateRoute adminOnly>
          <Layout>
            <AdminTransactions />
          </Layout>
        </PrivateRoute>
      } />

      {/* Client-specific routes (Admin viewing a specific client) */}
      <Route path="/client/dashboard" element={
        <PrivateRoute adminOnly>
          <Layout>
            <ClientDashboardAdmin />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/client/review" element={
        <PrivateRoute adminOnly>
          <ClientReview />
        </PrivateRoute>
      } />

      <Route path="/client/documents" element={
        <PrivateRoute adminOnly>
          <Layout>
            <ClientDocumentsAdmin />
          </Layout>
        </PrivateRoute>
      } />

      <Route path="/client/transactions" element={
        <PrivateRoute adminOnly>
          <Layout>
            <ClientTransactions />
          </Layout>
        </PrivateRoute>
      } />

      {/* Upload/Receipts */}
      <Route path="/upload" element={
        <PrivateRoute>
          <Layout>
            {user?.role === 'admin' ? <AdminReceipts /> : <Upload />}
          </Layout>
        </PrivateRoute>
      } />

      {/* Chat/AI Support */}
      <Route path="/chat" element={
        <PrivateRoute>
          <Layout>
            <Chat />
          </Layout>
        </PrivateRoute>
      } />

      {/* Documents */}
      <Route path="/documents" element={
        <PrivateRoute>
          <Layout>
            {user?.role === 'admin' ? <AdminDocuments /> : <Documents />}
          </Layout>
        </PrivateRoute>
      } />

      {/* Settings */}
      <Route path="/settings" element={
        <PrivateRoute>
          <Layout>
            <Settings />
          </Layout>
        </PrivateRoute>
      } />

      {/* Audit Search - 証憑検索 (Electronic Bookkeeping Preservation Act compliance) */}
      <Route path="/search" element={
        <PrivateRoute>
          <Layout>
            <AuditSearch />
          </Layout>
        </PrivateRoute>
      } />

      {/* Review Station (direct URL access) */}
      <Route path="/review/:companyId" element={
        <PrivateRoute adminOnly>
          <ReviewStation />
        </PrivateRoute>
      } />

      {/* Legacy admin route - redirect to home */}
      <Route path="/admin" element={<Navigate to="/" replace />} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ClientProvider>
        <AppRoutes />
      </ClientProvider>
    </AuthProvider>
  );
}
