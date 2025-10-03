"use client";

import React, { useState, useEffect } from "react";
import { useWallet } from "@demox-labs/miden-wallet-adapter-react";
import { WalletMultiButton } from "@demox-labs/miden-wallet-adapter-reactui";
import { registerName, lookupName, createSendTx, validateName } from "../lib/nameService";
import { Address, NetworkId, Note, OutputNote, OutputNotesArray, TransactionRequestBuilder } from "@demox-labs/miden-sdk";
import { MAX_TOTAL_NAME_LENGTH, NAME_EXISTS_ERROR, NETWORK_ID } from "@/lib/constants";
import { CustomTransaction, SendTransaction, Transaction, TransactionType } from "@demox-labs/miden-wallet-adapter-base";
import { MidenWalletAdapter } from "@demox-labs/miden-wallet-adapter";

type Tab = "register" | "lookup" | "send";

export default function Home() {
  const [message, setMessage] = useState<string>("TODO: Miden Name Service");
  const [activeTab, setActiveTab] = useState<Tab>("register");
  const [name, setName] = useState<string>("");
  const [isRegistering, setIsRegistering] = useState<boolean>(false);
  const [registrationResult, setRegistrationResult] = useState<string>("");
  const [lookupNameInput, setLookupNameInput] = useState<string>("");
  const [isLookingUp, setIsLookingUp] = useState<boolean>(false);
  const [lookupResult, setLookupResult] = useState<string>("");
  const [sendNameInput, setSendNameInput] = useState<string>("");
  const [sendAmount, setSendAmount] = useState<string>("");
  const [isSending, setIsSending] = useState<boolean>(false);
  const [sendResult, setSendResult] = useState<string>("");
  const [nameValidationError, setNameValidationError] = useState<string | null>(null);
  const [lookupNameValidationError, setLookupNameValidationError] = useState<string | null>(null);
  const [sendNameValidationError, setSendNameValidationError] = useState<string | null>(null);

  const {
    wallet,
    accountId: rawAccountId,
    connected,
    requestTransaction,
    requestAssets
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

  const handleNameChange = (value: string) => {
    setName(value);
    const error = validateName(value);
    setNameValidationError(error);
  };

  const handleRegisterName = async () => {
    if (!connected) {
      setMessage("Please connect your wallet first!");
      return;
    }

    if (!name.trim()) {
      setMessage("Please enter a name name!");
      return;
    }

    if (name.length > 24) {
      setMessage("name must be 24 characters or less!");
      return;
    }

    setIsRegistering(true);
    setRegistrationResult("");
    setMessage("Registering name...");

    try {
      const address = Address.fromBech32(rawAccountId!);
      const txId = await registerName(name, address.accountId());
      setRegistrationResult(txId);
      setMessage(`Name "${name}" registered successfully!`);
    } catch (error) {
      if (error instanceof Error && error.message.includes(NAME_EXISTS_ERROR)) {
        setMessage(`Registration failed: ${NAME_EXISTS_ERROR}`);
      } else {
        console.error("Registration error:", error);
        setMessage(`Registration failed: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    } finally {
      setIsRegistering(false);
    }
  };

  const handleLookupNameChange = (value: string) => {
    setLookupNameInput(value);
    const error = validateName(value);
    setLookupNameValidationError(error);
  };

  const handleLookupName = async () => {
    if (!lookupNameInput.trim()) {
      setMessage("Please enter a name to lookup!");
      return;
    }

    setIsLookingUp(true);
    setLookupResult("");
    setMessage("Looking up name...");

    try {
      const accountId = await lookupName(lookupNameInput);
      if (accountId) {
        setLookupResult(Address.fromAccountId(accountId, "Unspecified").toBech32(NETWORK_ID));
        setMessage(`Name "${lookupNameInput}" is registered!`);
      } else {
        setLookupResult("not_found");
        setMessage(`Name "${lookupNameInput}" is not registered.`);
      }
    } catch (error) {
      console.error("Lookup error:", error);
      setMessage(`Lookup failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsLookingUp(false);
    }
  };

  const handleSendNameChange = (value: string) => {
    setSendNameInput(value);
    const error = validateName(value);
    setSendNameValidationError(error);
  };

  const handleSendAmountChange = (value: string) => {
    // Only allow numbers and decimal point
    const filteredValue = value.replace(/[^0-9.]/g, '');
    // Ensure only one decimal point
    const parts = filteredValue.split('.');
    if (parts.length > 2) {
      return;
    }
    setSendAmount(filteredValue);
  };

  const handleSendToName = async () => {
    if (!connected) {
      setMessage("Please connect your wallet first!");
      return;
    }

    if (!sendNameInput.trim()) {
      setMessage("Please enter a name!");
      return;
    }

    if (!sendAmount.trim() || parseFloat(sendAmount) <= 0) {
      setMessage("Please enter a valid amount!");
      return;
    }

    setIsSending(true);
    setSendResult("");
    setMessage("Looking up name and initiating transaction...");

    try {
      // First lookup the name to get the account ID
      const recipientAccountId = await lookupName(sendNameInput);
      if (!recipientAccountId) {
        setMessage(`Name "${sendNameInput}" is not registered.`);
        setIsSending(false);
        return;
      }

      const recipientIdBech32 = Address.fromAccountId(recipientAccountId, "Unspecified").toBech32(NETWORK_ID);
      setMessage(`Name resolved to ${recipientIdBech32}... Initiating send...`);

      // Request available assets through the wallet adapter
      if (!requestAssets) {
        setMessage("Asset request not available. Please reconnect your wallet.");
        return;
      }

      const assets = await requestAssets();
      if (assets.length === 0) {
        setMessage("No assets available to send. Please receive an asset into your wallet first.");
        return;
      }
      // SAFETY: At least one asset should be available.
      const asset = assets.pop()!

      let sendAmountBigInt = BigInt(sendAmount) * BigInt(1_000_000)
      if (sendAmountBigInt > BigInt(asset.amount)) {
        setMessage(`Attempted to send ${sendAmountBigInt} but only ${asset.amount} of asset ${asset.faucetId} is available.`);
        return;
      }

      // Request the transaction through the wallet adapter
      if (!requestTransaction) {
        setMessage("Transaction request not available. Please reconnect your wallet.");
        return;
      }

      const senderId = Address.fromBech32(rawAccountId!)
      const faucetId = Address.fromBech32(asset.faucetId)
      const sendTx = createSendTx(senderId.accountId(), recipientAccountId, faucetId.accountId(), sendAmountBigInt);

      const txId = await requestTransaction({
        type: TransactionType.Custom,
        payload: sendTx,
      });

      console.log(`send: requested transaction ${txId}`)

      setSendResult(txId.toString());
      setMessage(`Successfully sent ${sendAmount} to "${sendNameInput}"!`);
    } catch (error) {
      console.error("Send error:", error);
      setMessage(`Send failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black text-slate-100 relative">
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
              </>
            ) : (
              <div className="space-y-6">

                {/* Tab Navigation */}
                <div className="flex gap-2 bg-gray-700 rounded-lg p-1 border border-gray-600">
                  <button
                    onClick={() => setActiveTab("register")}
                    className={`flex-1 px-4 py-2 rounded-md font-semibold transition-all duration-200 ${activeTab === "register"
                      ? "bg-orange-500 text-white"
                      : "bg-transparent text-gray-400 hover:text-gray-200"
                      }`}
                  >
                    Register
                  </button>
                  <button
                    onClick={() => setActiveTab("lookup")}
                    className={`flex-1 px-4 py-2 rounded-md font-semibold transition-all duration-200 ${activeTab === "lookup"
                      ? "bg-orange-500 text-white"
                      : "bg-transparent text-gray-400 hover:text-gray-200"
                      }`}
                  >
                    Lookup
                  </button>
                  <button
                    onClick={() => setActiveTab("send")}
                    className={`flex-1 px-4 py-2 rounded-md font-semibold transition-all duration-200 ${activeTab === "send"
                      ? "bg-orange-500 text-white"
                      : "bg-transparent text-gray-400 hover:text-gray-200"
                      }`}
                  >
                    Send
                  </button>
                </div>

                {/* Tab Content */}
                {activeTab === "register" && (
                  <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                    <h3 className="text-lg font-semibold text-orange-300 mb-4">
                      Register a Name
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Enter a name (lowercase letters only, max 36 characters):
                    </p>

                    <div className="mb-6">
                      <label className="block text-gray-300 text-sm mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => handleNameChange(e.target.value)}
                        className={`w-full px-4 py-3 bg-gray-600 border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent text-lg font-mono ${nameValidationError
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-gray-500 focus:ring-orange-500'
                          }`}
                        placeholder="example.miden"
                        disabled={isRegistering}
                        maxLength={36}
                      />
                      {nameValidationError ? (
                        <p className="text-red-400 text-xs mt-1">
                          ⚠️ {nameValidationError}
                        </p>
                      ) : (
                        <p className="text-gray-500 text-xs mt-1">
                          {name.length}/36 characters
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleRegisterName}
                      disabled={isRegistering || !!nameValidationError}
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
                          Transaction ID: {registrationResult}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "lookup" && (
                  <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                    <h3 className="text-lg font-semibold text-orange-300 mb-4">
                      Lookup Name
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Enter a name to lookup its registered account:
                    </p>

                    <div className="mb-6">
                      <label className="block text-gray-300 text-sm mb-2">
                        Name
                      </label>
                      <input
                        type="text"
                        value={lookupNameInput}
                        onChange={(e) => handleLookupNameChange(e.target.value)}
                        className={`w-full px-4 py-3 bg-gray-600 border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent text-lg font-mono ${lookupNameValidationError
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-gray-500 focus:ring-orange-500'
                          }`}
                        placeholder="example.miden"
                        disabled={isLookingUp}
                        maxLength={36}
                      />
                      {lookupNameValidationError ? (
                        <p className="text-red-400 text-xs mt-1">
                          ⚠️ {lookupNameValidationError}
                        </p>
                      ) : (
                        <p className="text-gray-500 text-xs mt-1">
                          {lookupNameInput.length}/36 characters
                        </p>
                      )}
                    </div>

                    <button
                      onClick={handleLookupName}
                      disabled={isLookingUp || !!lookupNameValidationError}
                      className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      {isLookingUp ? "Looking up..." : "Lookup Name"}
                    </button>

                    {lookupResult && lookupResult !== "not_found" && (
                      <div className="mt-4 p-3 bg-green-900 border border-green-700 rounded-md">
                        <p className="text-green-400 text-sm">
                          ✅ Name found!
                        </p>
                        <p className="text-green-300 text-xs mt-1 break-all">
                          Account ID: {lookupResult}
                        </p>
                      </div>
                    )}

                    {lookupResult === "not_found" && (
                      <div className="mt-4 p-3 bg-yellow-900 border border-yellow-700 rounded-md">
                        <p className="text-yellow-400 text-sm">
                          ℹ️ Name not found
                        </p>
                        <p className="text-yellow-300 text-xs mt-1">
                          This name is available for registration.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "send" && (
                  <div className="bg-gray-700 rounded-lg p-6 border border-gray-600">
                    <h3 className="text-lg font-semibold text-orange-300 mb-4">
                      Send To Name
                    </h3>
                    <p className="text-gray-400 text-sm mb-4">
                      Enter a name and amount to send funds:
                    </p>

                    <div className="mb-4">
                      <label className="block text-gray-300 text-sm mb-2">
                        Recipient Name
                      </label>
                      <input
                        type="text"
                        value={sendNameInput}
                        onChange={(e) => handleSendNameChange(e.target.value)}
                        className={`w-full px-4 py-3 bg-gray-600 border rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:border-transparent text-lg font-mono ${sendNameValidationError
                            ? 'border-red-500 focus:ring-red-500'
                            : 'border-gray-500 focus:ring-orange-500'
                          }`}
                        placeholder="example.miden"
                        disabled={isSending}
                        maxLength={36}
                      />
                      {sendNameValidationError ? (
                        <p className="text-red-400 text-xs mt-1">
                          ⚠️ {sendNameValidationError}
                        </p>
                      ) : (
                        <p className="text-gray-500 text-xs mt-1">
                          {sendNameInput.length}/36 characters
                        </p>
                      )}
                    </div>

                    <div className="mb-6">
                      <label className="block text-gray-300 text-sm mb-2">
                        Amount
                      </label>
                      <input
                        type="text"
                        value={sendAmount}
                        onChange={(e) => handleSendAmountChange(e.target.value)}
                        className="w-full px-4 py-3 bg-gray-600 border border-gray-500 rounded-md text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent text-lg font-mono"
                        placeholder="0.00"
                        disabled={isSending}
                      />
                      <p className="text-gray-500 text-xs mt-1">
                        Enter the amount to send
                      </p>
                    </div>

                    <button
                      onClick={handleSendToName}
                      disabled={isSending || !!sendNameValidationError}
                      className="w-full px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg text-white font-semibold transition-all duration-200 shadow-lg hover:shadow-xl"
                    >
                      {isSending ? "Sending..." : "Send"}
                    </button>

                    {sendResult && (
                      <div className="mt-4 p-3 bg-green-900 border border-green-700 rounded-md">
                        <p className="text-green-400 text-sm">
                          ✅ Transaction submitted!
                        </p>
                        <p className="text-green-300 text-xs mt-1 break-all">
                          Transaction ID: {sendResult}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                <button
                  onClick={handleAction}
                  className="w-full px-6 py-3 bg-gray-600 hover:bg-gray-500 rounded-lg text-white font-semibold transition-all duration-200"
                >
                  Test Connection
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
