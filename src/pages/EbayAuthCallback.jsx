import { useEffect, useState } from 'react';
import { base44 } from '@/api/base44Client';
import { Link } from 'react-router-dom';

export default function EbayAuthCallback() {
  const [status, setStatus] = useState('processing'); // processing | success | error
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const error = params.get('error');

    if (error) {
      setErrorMsg('eBay authorization was declined.');
      setStatus('error');
      return;
    }

    if (!code) {
      setErrorMsg('No authorization code received from eBay.');
      setStatus('error');
      return;
    }

    base44.functions.invoke('ebayAuthCallback', { code })
      .then(() => setStatus('success'))
      .catch(err => {
        setErrorMsg(err.message || 'Token exchange failed.');
        setStatus('error');
      });
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-sm p-8 max-w-sm w-full text-center">
        {status === 'processing' && (
          <>
            <div className="w-10 h-10 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin mx-auto mb-4" />
            <p className="text-slate-700 font-medium">Connecting eBay account...</p>
          </>
        )}
        {status === 'success' && (
          <>
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-green-600 text-2xl">✓</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">eBay Connected!</h2>
            <p className="text-slate-500 text-sm mb-5">Your eBay account has been successfully linked to FlipQuik.</p>
            <Link to="/Settings" className="block w-full bg-slate-900 text-white rounded-xl py-3 text-sm font-medium">
              Go to Settings
            </Link>
          </>
        )}
        {status === 'error' && (
          <>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-red-600 text-2xl">✕</span>
            </div>
            <h2 className="text-lg font-bold text-slate-900 mb-2">Connection Failed</h2>
            <p className="text-slate-500 text-sm mb-5">{errorMsg}</p>
            <Link to="/Settings" className="block w-full bg-slate-900 text-white rounded-xl py-3 text-sm font-medium">
              Back to Settings
            </Link>
          </>
        )}
      </div>
    </div>
  );
}