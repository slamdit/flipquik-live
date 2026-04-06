import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes, Navigate } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import TopNav from '@/components/TopNav';
import Dashboard from '@/pages/Dashboard';
import Capture from '@/pages/Capture';
import Inventory from '@/pages/Inventory';
import Sales from '@/pages/Sales';
import Insights from '@/pages/Insights';
import Settings from '@/pages/Settings';
import QuikEval from '@/pages/QuikEval';
import Performance from '@/pages/Performance';
import EbayAuthCallback from '@/pages/EbayAuthCallback';
import MultiEval from '@/pages/MultiEval';
import DistributeListing from '@/pages/DistributeListing';
import ActionQueue from '@/pages/ActionQueue';
import MarketplaceConnections from '@/pages/MarketplaceConnections';
import PlatformTemplates from '@/pages/PlatformTemplates';

const AppShell = () => {
  const { isLoadingAuth } = useAuth();

  if (isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <>
      <TopNav />
      <div className="pt-24">
        <Routes>
          <Route path="/" element={<Navigate to="/Dashboard" replace />} />
          <Route path="/Dashboard" element={<Dashboard />} />
          <Route path="/Capture" element={<Capture />} />
          <Route path="/Inventory" element={<Inventory />} />
          <Route path="/Sales" element={<Sales />} />
          <Route path="/Insights" element={<Insights />} />
          <Route path="/Settings" element={<Settings />} />
          <Route path="/QuikEval" element={<QuikEval />} />
          <Route path="/Performance" element={<Performance />} />
          <Route path="/ebay-auth-callback" element={<EbayAuthCallback />} />
          <Route path="/MultiEval" element={<MultiEval />} />
          <Route path="/DistributeListing" element={<DistributeListing />} />
          <Route path="/ActionQueue" element={<ActionQueue />} />
          <Route path="/MarketplaceConnections" element={<MarketplaceConnections />} />
          <Route path="/PlatformTemplates" element={<PlatformTemplates />} />
          <Route path="*" element={<PageNotFound />} />
        </Routes>
      </div>
    </>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <AppShell />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App