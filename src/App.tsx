import React, { createContext, useContext, useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Home } from './pages/Home';
import { Messages } from './pages/Messages';
import { Wallet } from './pages/Wallet';
import { Search } from './pages/Search';
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
    // Check for existing authentication
    const checkAuth = async () => {
      try {
        console.log('Checking authentication status...');
        
        // Check Supabase session
        const { data: { session }, error } = await supabase.auth.getSession();
        const storedAddress = localStorage.getItem('walletAddress');
        const storedAuth = localStorage.getItem('isAuthenticated');
        const storedUserType = localStorage.getItem('userType') as 'metamask' | 'email' | null;
        
        console.log('Auth check results:', { 
          hasSession: !!session, 
          storedAddress, 
          storedAuth,
          storedUserType,
          sessionUser: session?.user?.id 
        });
        
        if (session && storedAuth === 'true' && storedAddress && storedUserType) {
          // Valid session and stored credentials
          setIsAuthenticated(true);
          setWalletAddress(storedAddress);
          setUserType(storedUserType);
          console.log('User authenticated with session and stored address:', storedAddress, 'type:', storedUserType);
        } else if (storedAuth === 'true' && storedAddress && storedUserType) {
          // Has stored auth but no session - try to restore
          console.log('Has stored auth but no session, attempting to restore...');
          
          // Try to authenticate based on user type
          let email: string;
          let password: string;

          if (storedUserType === 'email') {
            // For email users, we need to get their actual email from the stored address
            // This is a limitation - in production, you'd store the email separately
            console.log('Cannot restore email user session without stored email');
            localStorage.removeItem('isAuthenticated');
            localStorage.removeItem('walletAddress');
            localStorage.removeItem('userType');
            setIsAuthenticated(false);
            setWalletAddress(null);
            setUserType(null);
          } else {
            // For MetaMask users, use the deterministic email/password
            email = `${storedAddress}@kraken.web3`;
            password = `kraken_${storedAddress}_secure_2025`;
            
            const { data, error: signInError } = await supabase.auth.signInWithPassword({
              email,
              password,
            });
            
            if (!signInError && data.session) {
              setIsAuthenticated(true);
              setWalletAddress(storedAddress);
              setUserType(storedUserType);
              console.log('Successfully restored session for:', storedAddress);
            } else {
              console.log('Failed to restore session, clearing stored auth');
              localStorage.removeItem('isAuthenticated');
              localStorage.removeItem('walletAddress');
              localStorage.removeItem('userType');
              setIsAuthenticated(false);
              setWalletAddress(null);
              setUserType(null);
            }
          }
        } else {
          // No valid authentication
          console.log('No valid authentication found');
          localStorage.removeItem('isAuthenticated');
          localStorage.removeItem('walletAddress');
          localStorage.removeItem('userType');
          setIsAuthenticated(false);
          setWalletAddress(null);
          setUserType(null);
        }
      } catch (error) {
        console.error('Error checking authentication:', error);
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('walletAddress');
        localStorage.removeItem('userType');
        setIsAuthenticated(false);
        setWalletAddress(null);
        setUserType(null);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('Auth state changed:', event, !!session);
      
      if (event === 'SIGNED_IN' && session) {
        const storedAddress = localStorage.getItem('walletAddress');
        const storedUserType = localStorage.getItem('userType') as 'metamask' | 'email' | null;
        if (storedAddress && storedUserType) {
          setIsAuthenticated(true);
          setWalletAddress(storedAddress);
          setUserType(storedUserType);
          console.log('Auth state: signed in with address:', storedAddress, 'type:', storedUserType);
        }
      } else if (event === 'SIGNED_OUT') {
        console.log('Auth state: signed out');
        localStorage.removeItem('isAuthenticated');
        localStorage.removeItem('walletAddress');
        localStorage.removeItem('userType');
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
    console.log('Logging out user');
    
    try {
      // Sign out from Supabase
      await supabase.auth.signOut();
    } catch (error) {
      console.error('Error signing out from Supabase:', error);
    }
    
    // Clear local storage
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('walletAddress');
    localStorage.removeItem('userType');
    
    // Update state
    setIsAuthenticated(false);
    setWalletAddress(null);
    setUserType(null);
  };

  // Show loading spinner while checking authentication
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
          <Route
            path="/login"
            element={!isAuthenticated ? <Login /> : <Navigate to="/" replace />}
          />
          <Route
            path="/"
            element={isAuthenticated ? <Layout /> : <Navigate to="/login" replace />}
          >
            <Route index element={<Home />} />
            <Route path="messages" element={<Messages />} />
            <Route path="search" element={<Search />} />
            <Route path="wallet" element={<Wallet />} />
            <Route path="profile" element={<Profile />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthContext.Provider>
  );
}

export default App