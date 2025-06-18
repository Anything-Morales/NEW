import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Messages } from './pages/Messages';
import { Wallet } from './pages/Wallet';
// import { Search } from './pages/Search';
import { Profile } from './pages/Profile';
import { supabase } from './lib/supabase';

interface AuthContextType {
  isAuthenticated: boolean;
  walletAddress: string | null;
  userType: 'metamask' | 'email' | null;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextType>({
  isAuthenticated: false,
  walletAddress: null,
  userType: null,
  logout: () => {},
});

export function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userType, setUserType] = useState<'metamask' | 'email' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        console.log('Checking authentication status...');
        const { data: { session } } = await supabase.auth.getSession();
        const storedAddress = localStorage.getItem('walletAddress');
        const storedAuth = localStorage.getItem('isAuthenticated');
        const storedUserType = localStorage.getItem('userType') as 'metamask' | 'email' | null;

        if (session && storedAuth === 'true' && storedAddress && storedUserType) {
          setIsAuthenticated(true);
          setWalletAddress(storedAddress);
          setUserType(storedUserType);
        } else if (storedAuth === 'true' && storedAddress && storedUserType) {
          if (storedUserType === 'email') {
            console.log('Cannot restore email user session without stored email');
            localStorage.clear();
            setIsAuthenticated(false);
            setWalletAddress(null);
            setUserType(null);
          } else {
            const email = `${storedAddress}@kraken.web3`;
            const password = `kraken_${storedAddress}_secure_2025`;
            const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

            if (!signInError && data.session) {
              setIsAuthenticated(true);
              setWalletAddress(storedAddress);
              setUserType(storedUserType);
            } else {
              localStorage.clear();
              setIsAuthenticated(false);
              setWalletAddress(null);
              setUserType(null);
            }
          }
        } else {
          localStorage.clear();
          setIsAuthenticated(false);
          setWalletAddress(null);
          setUserType(null);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        localStorage.clear();
        setIsAuthenticated(false);
        setWalletAddress(null);
        setUserType(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session) {
        const storedAddress = localStorage.getItem('walletAddress');
        const storedUserType = localStorage.getItem('userType') as 'metamask' | 'email' | null;
        if (storedAddress && storedUserType) {
          setIsAuthenticated(true);
          setWalletAddress(storedAddress);
          setUserType(storedUserType);
        }
      } else if (event === 'SIGNED_OUT') {
        localStorage.clear();
        setIsAuthenticated(false);
        setWalletAddress(null);
        setUserType(null);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const logout = async () => {
    try {
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out from Supabase:', error);
    }

    localStorage.clear();
    setIsAuthenticated(false);
    setWalletAddress(null);
    setUserType(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-zinc-400">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated, walletAddress, userType, logout }}>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />} />
          <Route path="/" element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace />}>
            <Route index element={<Home />} />
            <Route path="messages" element={<Messages />} />
            {/* <Route path="search" element={<Search />} /> */}
            <Route path="wallet" element={<Wallet />} />
            <Route path="profile" element={<Profile />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App;
