"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@demox-labs/miden-wallet-adapter-react";
import { WalletMultiButton } from "@demox-labs/miden-wallet-adapter-reactui";

export default function Home() {
  const [message, setMessage] = useState<string>("Welcome to your Miden Web App!");

  const {
    wallet,
    accountId: rawAccountId,
    connected,
    requestTransaction,
  } = useWallet();

  useEffect(() => {
    console.log("🧑‍💼 rawAccountId", rawAccountId);
    console.log("🧑‍💼 connected", connected);
    console.log("🧑‍💼 wallet", wallet);
  }, [rawAccountId, connected, wallet]);

  const handleAction = async () => {
    if (!connected) {
      setMessage("Please connect your wallet first!");
      return;
    }

    setMessage(`Wallet connected! Account ID: ${rawAccountId?.slice(0, 12)}...`);
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-slate-100 relative">
      {/* Title Header - Top Left */}
      <div className="absolute top-6 left-6">
        <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 px-6 py-4">
          <h1 className="text-2xl font-semibold text-orange-400">
            Miden Web App
          </h1>
        </div>
      </div>

      {/* Wallet Connect - Top Right */}
      <div className="absolute top-6 right-6 flex gap-4 items-center">
        {connected && (
          <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-700 px-4 py-2">
            <p className="text-green-400 font-semibold text-sm">
              Connected: {rawAccountId?.slice(0, 12)}...
            </p>
          </div>
        )}
        <WalletMultiButton />
      </div>

      {/* Main Content */}
      <div className="flex items-center justify-center min-h-screen">
        <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-8 max-w-md w-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-orange-400 mb-6">
              Welcome to Miden
            </h2>
            <p className="text-gray-300 mb-8">{message}</p>
            
            {!connected ? (
              <>
                <p className="text-yellow-400 text-sm mb-4">
                  👆 Connect your wallet using the button in the top right corner
                </p>
                <p className="text-gray-400 text-xs">
                  This is your starting point for building Miden-powered applications.
                </p>
              </>
            ) : (
              <div className="space-y-4">
                <p className="text-green-400 text-sm">
                  🎉 Wallet successfully connected!
                </p>
                <button
                  onClick={handleAction}
                  className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 rounded-lg text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  Test Connection
                </button>
                <p className="text-gray-400 text-xs">
                  Start building your Miden application here. You can use the existing
                  library functions or create your own smart contracts.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
