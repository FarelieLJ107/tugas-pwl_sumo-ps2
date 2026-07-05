import React, { useState, useEffect } from 'react';
import { User } from 'firebase/auth';
import { HardDrive, LogOut, FileIcon, RefreshCw, AlertCircle } from 'lucide-react';
import { initAuth, googleSignIn, logout, getAccessToken } from '../lib/auth';

export const DrivePanel: React.FC = () => {
  const [needsAuth, setNeedsAuth] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [files, setFiles] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user, token) => {
        setNeedsAuth(false);
        setUser(user);
        setToken(token);
        fetchFiles(token);
      },
      () => {
        setNeedsAuth(true);
        setToken(null);
        setUser(null);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleLogin = async () => {
    setIsLoggingIn(true);
    setError(null);
    try {
      const result = await googleSignIn();
      if (result) {
        setToken(result.accessToken);
        setUser(result.user);
        setNeedsAuth(false);
        fetchFiles(result.accessToken);
      }
    } catch (err: any) {
      console.error('Login failed:', err);
      setError(err.message || 'Login gagal.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    await logout();
    setNeedsAuth(true);
    setToken(null);
    setUser(null);
    setFiles([]);
  };

  const fetchFiles = async (currentToken: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch('https://www.googleapis.com/drive/v3/files?pageSize=10&fields=files(id,name,mimeType,modifiedTime)', {
        headers: { Authorization: `Bearer ${currentToken}` },
      });
      if (!res.ok) {
        throw new Error('Gagal mengambil data dari Google Drive');
      }
      const data = await res.json();
      setFiles(data.files || []);
    } catch (err: any) {
      console.error('Fetch error:', err);
      setError(err.message || 'Terjadi kesalahan saat memuat file.');
    } finally {
      setIsLoading(false);
    }
  };

  if (needsAuth) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
        <div className="w-16 h-16 bg-indigo-500/10 rounded-full flex items-center justify-center mb-4">
          <HardDrive className="w-8 h-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2 font-display">Integrasi Google Drive</h2>
        <p className="text-slate-400 text-sm max-w-md mb-6">
          Akses file Google Drive Anda secara langsung melalui sistem Sumo PlayStation.
          Otorisasi diperlukan untuk membaca data Anda dengan aman.
        </p>
        
        {error && (
          <div className="mb-6 p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg flex items-start gap-2 text-rose-400 text-sm max-w-md text-left">
            <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button 
          onClick={handleLogin} 
          disabled={isLoggingIn}
          className="gsi-material-button bg-white text-slate-800 hover:bg-slate-50 font-medium py-2 px-4 rounded-xl flex items-center justify-center gap-3 transition-colors disabled:opacity-50"
        >
          <div className="gsi-material-button-icon">
            <svg version="1.1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" className="w-5 h-5 block">
              <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"></path>
              <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"></path>
              <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"></path>
              <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"></path>
              <path fill="none" d="M0 0h48v48H0z"></path>
            </svg>
          </div>
          <span className="gsi-material-button-contents font-medium text-sm">
            {isLoggingIn ? 'Memproses...' : 'Sign in with Google'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl flex flex-col sm:flex-row justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-xl font-bold font-display text-white tracking-tight flex items-center gap-2">
            <HardDrive className="w-5 h-5 text-indigo-400" />
            Google Drive Explorer
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Terhubung sebagai: <strong className="text-indigo-400">{user?.email}</strong>
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={() => token && fetchFiles(token)}
            disabled={isLoading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button 
            onClick={handleLogout}
            className="px-3 py-1.5 bg-rose-950/30 text-rose-400 hover:bg-rose-900/50 border border-rose-900/50 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Logout Drive
          </button>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider font-display">Daftar File Terbaru</h3>
        </div>
        
        {error ? (
          <div className="p-8 text-center flex flex-col items-center">
             <AlertCircle className="w-8 h-8 text-rose-500 mb-2 opacity-50" />
             <p className="text-slate-400 text-sm">{error}</p>
          </div>
        ) : isLoading && files.length === 0 ? (
          <div className="p-8 text-center">
            <div className="animate-spin w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-3"></div>
            <p className="text-slate-400 text-sm">Memuat file dari Google Drive...</p>
          </div>
        ) : files.length === 0 ? (
          <div className="p-8 text-center">
            <FileIcon className="w-8 h-8 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Tidak ada file yang ditemukan.</p>
          </div>
        ) : (
          <ul className="divide-y divide-slate-800/60">
            {files.map(file => (
              <li key={file.id} className="p-4 hover:bg-slate-800/30 transition-colors flex items-center gap-3">
                <FileIcon className="w-5 h-5 text-indigo-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                  <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                    Modifikasi: {new Date(file.modifiedTime).toLocaleString('id-ID')}
                  </p>
                </div>
                <div className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded truncate max-w-[100px]">
                  {file.mimeType.split('.').pop()}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
};
