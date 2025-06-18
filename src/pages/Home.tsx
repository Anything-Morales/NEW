import React from 'react';
import { MessageCircle, Wallet, Anchor, Shield, Mail } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from '../App';

export function Home() {
  const { walletAddress, userType } = useContext(AuthContext);

  const getUserTypeIcon = () => {
    return userType === 'email' ? (
      <Mail className="w-5 h-5 text-green-500" />
    ) : (
      <Shield className="w-5 h-5 text-blue-500" />
    );
  };

  const getUserTypeLabel = () => {
    return userType === 'email' ? 'Email Account' : 'MetaMask Wallet';
  };

  const getConnectionStatus = () => {
    if (userType === 'email') {
      return `Connected: Email User (${walletAddress?.slice(0, 6)}...${walletAddress?.slice(-4)})`;
    } else {
      return `Connected: ${walletAddress?.slice(0, 6)}...${walletAddress?.slice(-4)}`;
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4">
      <div className="max-w-xl mx-auto space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-4 py-12">
          <Anchor className="w-16 h-16 mx-auto text-white" />
          <h1 className="text-4xl font-bold">Kraken</h1>
          <p className="text-gray-400 max-w-md mx-auto">
            Secure, decentralized messaging powered by Web3 technology.
            Connect with MetaMask or email to start sending encrypted messages.
          </p>
        </div>

        {/* Account Status */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-medium mb-1">Account Status</h2>
              {walletAddress ? (
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    {getUserTypeIcon()}
                    <span className="text-sm text-gray-400">{getUserTypeLabel()}</span>
                  </div>
                  <p className="text-gray-400 text-sm">
                    {getConnectionStatus()}
                  </p>
                </div>
              ) : (
                <p className="text-red-400">Not connected</p>
              )}
            </div>
            <Wallet className="w-6 h-6 text-gray-400" />
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/messages" className="group">
            <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 hover:border-white/20 transition-all">
              <MessageCircle className="w-8 h-8 mb-4 text-white" />
              <h2 className="text-lg font-medium mb-2">Send Message</h2>
              <p className="text-gray-400 text-sm">
                Start a secure conversation with any user address
              </p>
            </div>
          </Link>

          <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
            <Shield className="w-8 h-8 mb-4 text-white" />
            <h2 className="text-lg font-medium mb-2">Security</h2>
            <p className="text-gray-400 text-sm">
              End-to-end encrypted messages with Web3 authentication
            </p>
          </div>
        </div>

        {/* Account Type Info */}
        {userType && (
          <div className="bg-gradient-to-br from-blue-500/5 to-green-500/5 rounded-2xl p-6 border border-zinc-800">
            <div className="flex items-start space-x-4">
              <div className="flex-shrink-0 bg-zinc-800 p-3 rounded-lg">
                {getUserTypeIcon()}
              </div>
              <div>
                <h3 className="text-lg font-medium text-white mb-2">
                  {userType === 'email' ? 'Email Account' : 'MetaMask Wallet'}
                </h3>
                <p className="text-gray-400 text-sm leading-relaxed">
                  {userType === 'email' 
                    ? 'You\'re using an email-based account with a generated secure address. Your messages are encrypted and stored securely.'
                    : 'You\'re connected with MetaMask. Your wallet address serves as your identity for secure, decentralized messaging.'
                  }
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}