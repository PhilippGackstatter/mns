"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@demox-labs/miden-wallet-adapter-react";
import { WalletMultiButton } from "@demox-labs/miden-wallet-adapter-reactui";
import { registerName } from "../lib/nameService";
import { Address } from "@demox-labs/miden-sdk";

export default function Home() {
  const [message, setMessage] = useState<string>("Welcome to your Miden Web App!");
  const [name, setSymbol] = useState<string>("");
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [registrationResult, setRegistrationResult] = useState<string>("");

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

  const handleSymbolChange = (value: string) => {
    // Only allow uppercase letters and limit to 24 characters
    const filteredValue = value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 24);
    setSymbol(filteredValue);
  };

  const handleRegisterName = async () => {
    if (!connected) {
      setMessage("Please connect your wallet first!");
      return;
    }

    if (!name.trim()) {
      setMessage("Please enter a symbol name!");
      return;
    }

    if (name.length > 24) {
      setMessage("Symbol must be 24 characters or less!");
      return;
    }

    setIsRegistering(true);
    setRegistrationResult("");
    setMessage("Registering name...");

    try {
      const address = Address.fromBech32(rawAccountId!);
      const txId = await registerName(name, address.accountId());
      setRegistrationResult(txId);
      setMessage(`Name "${name}" registered successfully! Transaction ID: ${txId.slice(0, 12)}...`);
    } catch (error) {
      console.error("Registration error:", error);
      setMessage(`Registration failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsRegistering(false);
    }
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
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="bg-gray-800 rounded-2xl shadow-2xl border border-gray-700 p-8 max-w-lg w-full">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-orange-400 mb-6">
              Miden Name Service
            </h2>
            <p className="text-gray-300 mb-8">{message}</p>
            
            {!connected ? (
              <>
                <p className="text-yellow-400 text-sm mb-4">
                  👆 Connect your wallet using the button in the top right corner
                </p>
                <p className="text-gray-400 text-xs">
                  Connect your wallet to register names in the Miden Name Service.
                </p>
              </>
            ) : (
              <div className="space-y-6">
                <p className="text-green-400 text-sm">
                  🎉 Wallet successfully connected!
                </p>
                
                {/* Name Registration Form */}
                <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                  <h3 className="text-lg font-semibold text-orange-300 mb-4">
                    Register a Name
                  </h3>
                  <p className="text-gray-400 text-sm mb-4">
                    Enter a symbol name (uppercase letters only, max 24 characters):
                  </p>
                  
                  <div className="mb-6">
                    <label className="block text-gray-300 text-sm mb-2">
                      Symbol Name
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => handleSymbolChange(e.target.value)}
                      className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg font-mono"
                      placeholder="EXAMPLE"
                      disabled={isRegistering}
                      maxLength={24}
                    />
                    <p className="text-gray-500 text-xs mt-1">
                      {name.length}/24 characters
                    </p>
                  </div>
                  
                  <button
                    onClick={handleRegisterName}
                    disabled={isRegistering}
                    className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                  >
                    {isRegistering ? "Registering..." : "Register Name"}
                  </button>
                  
                  {registrationResult && (
                    <div className="mt-4 p-3 bg-green-900 border border-green-700 rounded-md">
                      <p className="text-green-400 text-sm">
                        ✅ Registration successful!
                      </p>
                      <p className="text-green-300 text-xs mt-1 break-all">
                        TX ID: {registrationResult}
                      </p>
                    </div>
                  )}
                </div>

                <button
                  onClick={handleAction}
                  className="w-full px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold transition-all duration-200"
                >
                  Test Connection
                </button>
                
                <p className="text-gray-400 text-xs">
                  NOTE: Make sure to update the NAME_SERVICE_ACCOUNT_ID in constants.ts with your deployed account ID.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
