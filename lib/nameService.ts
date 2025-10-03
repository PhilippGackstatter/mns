import { CustomTransaction } from "@demox-labs/miden-wallet-adapter";
import { A_CODE as a_CODE, ALPHABET_LENGTH, DOT_MIDEN, FELTS_PER_WORD, MAX_CHARS_PER_FELT, MAX_TOTAL_NAME_LENGTH, NAME_MAP_SLOT_IDX, NAME_SERVICE_ACCOUNT_ID, NETWORK_ID, NODE_URL } from "./constants";
import { Account, AccountId, AccountInterface, Assembler, Felt, FeltArray, FungibleAsset, Library, NetworkId, Note, NoteAssets, NoteExecutionHint, NoteInputs, NoteMetadata, NoteRecipient, NoteScript, NoteTag, NoteType, OutputNote, OutputNotesArray, TransactionKernel, TransactionRequestBuilder, TransactionScript, WebClient, Word } from "@demox-labs/miden-sdk";
import { randomInt } from "crypto";

// Validates a name input and returns an error message if invalid, or null if valid.
//
// Rules:
// - Only lowercase letters (a-z) are allowed
// - Must end with ".miden"
// - Maximum length is MAX_TOTAL_NAME_LENGTH characters (_excluding_ ".miden")
//
// # Returns
// An error message string if invalid, or null if valid
export function validateName(name: string): string | null {
  if (name.length === 0) {
    // Empty is valid (user is still typing)
    return null;
  }

  // Check for invalid characters (not lowercase letters or period)
  const invalidChars = name.match(/[^a-z.]/g);
  if (invalidChars) {
    return `Only lowercase letters and '.' are allowed`;
  }

  // Check if it ends with .miden
  if (!name.endsWith(DOT_MIDEN)) {
    return `Name must end with ${DOT_MIDEN}`;
  }

  // Check length against name without .miden
  if ((name.length - DOT_MIDEN.length) > MAX_TOTAL_NAME_LENGTH) {
    return `Name must be at most ${MAX_TOTAL_NAME_LENGTH} characters`;
  }

  return null;
}

// Encodes a string into 4 Felts
export function encodeName(s: string): Word {
  if (s.length === 0 || s.length > MAX_TOTAL_NAME_LENGTH) {
    throw new Error(`InvalidLength: ${s.length}`);
  }
  if ([...s].some(c => c < "a" || c > "z")) {
    throw new Error(`InvalidCharacter: ${s}`);
  }

  const felts: bigint[] = [BigInt(0), BigInt(0), BigInt(0), BigInt(0)];

  // First Felt stores the length
  felts[0] = BigInt(s.length);

  // Encode characters across the remaining 3 Felts
  let currentFelt = 1;
  let encoded = BigInt(0);
  let capacity = 0;

  for (const char of s) {
    const digit = BigInt(char.charCodeAt(0) - a_CODE);
    encoded = encoded * ALPHABET_LENGTH + digit;
    capacity++;

    // If this Felt is "full", move to next
    if (capacity >= MAX_CHARS_PER_FELT && currentFelt < FELTS_PER_WORD) {
      felts[currentFelt] = encoded;
      currentFelt++;
      encoded = BigInt(0);
      capacity = 0;
    }
  }

  // Store the last partially filled Felt
  if (currentFelt < FELTS_PER_WORD) {
    felts[currentFelt] = encoded;
  }

  return Word.newFromFelts(felts.map(f => new Felt(f)));
}

// Decodes a Word (4 Felts) back into a string
export function decodeName(word: Word): string {
  const felts = word.toFelts();

  // First Felt stores the length
  // Create a temporary Word with just this Felt to use toHex
  const lengthWord = Word.newFromFelts([felts[0], new Felt(BigInt(0)), new Felt(BigInt(0)), new Felt(BigInt(0))]);
  const length = Number(BigInt("0x" + lengthWord.toHex().slice(-16)));

  if (length === 0) {
    return "";
  }

  if (length > MAX_TOTAL_NAME_LENGTH) {
    throw new Error(`InvalidLength: ${length}`);
  }

  let result = "";
  let remaining = length;

  // Decode characters from the remaining 3 Felts
  for (let feltIndex = 1; feltIndex < FELTS_PER_WORD && remaining > 0; feltIndex++) {
    // Create a temporary Word with just this Felt to use toHex
    const feltWord = Word.newFromFelts([felts[feltIndex], new Felt(BigInt(0)), new Felt(BigInt(0)), new Felt(BigInt(0))]);
    let encoded = BigInt("0x" + feltWord.toHex().slice(-16));

    // Determine how many characters are in this Felt
    const charsInThisFelt = Math.min(remaining, MAX_CHARS_PER_FELT);

    // Extract characters from this Felt (in reverse order since we encoded with base-26 multiplication)
    const chars: string[] = [];
    for (let i = 0; i < charsInThisFelt; i++) {
      const digit = Number(encoded % ALPHABET_LENGTH);
      chars.unshift(String.fromCharCode(a_CODE + digit));
      encoded = encoded / ALPHABET_LENGTH;
    }

    result += chars.join("");
    remaining -= charsInThisFelt;
  }

  return result;
}

export async function registerName(name: string, accountId: AccountId): Promise<string> {
  if (typeof window === "undefined") {
    console.warn("registerName() can only run in the browser");
    return "";
  }

  // Strip .miden
  if (name.includes(DOT_MIDEN)) {
      name = name.substring(0, (name.length - DOT_MIDEN.length))
  }

  // Encode symbol to field elements
  const encodedWord = encodeName(name);

  // Must match masm/accounts/name_service.masm.
  const nameServiceCode = `
use.miden::account
use.miden::tx
use.std::word

const.NAME_MAP_SLOT_IDX=0

#! Registers the provided name in the contract.
#!
#! Inputs:  [NAME, ACCOUNT_ID, pad(8)]
#! Outputs: [pad(16)]
#!
#! Panics if:
#! - The provided name is already registered.
#! - The provided account ID word is the empty word.
export.register
    swapw
    # => [ACCOUNT_ID, NAME, pad(8)]

    exec.word::testz assertz.err="account ID to be registered must not be empty"
    swapw
    # => [NAME, ACCOUNT_ID, pad(8)]

    push.NAME_MAP_SLOT_IDX
    # => [index, NAME, ACCOUNT_ID, pad(8)]

    exec.account::set_map_item dropw
    # => [PREV_VALUE, pad(8)]

    exec.word::eqz assert.err="name is already registered"
    # => [pad(8)]
end
`;

  // Dynamic import to ensure client-side execution
  const {
    AssemblerUtils,
    TransactionKernel,
    TransactionRequestBuilder,
    TransactionScript,
  } = await import("@demox-labs/miden-sdk");

  const client = await WebClient.createClient(NODE_URL);

  // Import the name service account into the client to be able to execute transactions against it,
  // unless it is already imported.
  if (!await client.getAccount(NAME_SERVICE_ACCOUNT_ID)) {
    await client.importAccountById(NAME_SERVICE_ACCOUNT_ID);
  }
  await client.syncState()

  console.log("Created client and imported name service account");

  // Build the transaction script
  let assembler = TransactionKernel.assembler().withDebugMode(true);

  // Create the library to call the name service contract
  const nameServiceLib = AssemblerUtils.createAccountComponentLibrary(
    assembler,
    "name_service::code",
    nameServiceCode,
  );

  const transactionScriptCode = `
    begin
        push.0.0.${accountId.suffix()}.${accountId.prefix()}
        push.${encodedWord.toHex()}
        # => [NAME, ACCOUNT_ID]
        call.::name_service::code::register
        dropw dropw
    end
`;

  console.log(transactionScriptCode)
  // Creating the transaction script
  const transactionScript = TransactionScript.compile(
    transactionScriptCode,
    assembler.withLibrary(nameServiceLib),
  );

  console.log("Compiled transaction script");

  // Creating a transaction request with the transaction script
  const transactionRequest = new TransactionRequestBuilder()
    .withCustomScript(transactionScript)
    .withScriptArg(encodedWord)
    .build();

  console.log("Built transaction request");

  // Executing the transaction script against the name service contract
  const txResult = await client.newTransaction(
    NAME_SERVICE_ACCOUNT_ID,
    transactionRequest,
  );

  console.log("Executed transaction");

  // Submitting the transaction result to the node
  await client.submitTransaction(txResult);

  const txId = txResult.executedTransaction().id().toHex();
  console.log(`Submitted transaction ${txId}`);

  // Sync state
  await client.syncState();

  console.log("Synced state");

  // Return success message with transaction info
  return txId;
}

export async function lookupName(name: string): Promise<AccountId | undefined> {
  // Strip .miden
  if (name.includes(DOT_MIDEN)) {
      name = name.substring(0, (name.length - DOT_MIDEN.length))
  }

  const client = await WebClient.createClient(NODE_URL);

  // Import the name service account into the client to be able to execute transactions against it,
  // unless it is already imported.
  if (!await client.getAccount(NAME_SERVICE_ACCOUNT_ID)) {
    await client.importAccountById(NAME_SERVICE_ACCOUNT_ID);
  }
  await client.syncState()

  let nameServiceAccount = await client.getAccount(NAME_SERVICE_ACCOUNT_ID);

  if (!nameServiceAccount) {
    throw new Error("failed to get name service account");
  }

  const encodedWord = encodeName(name);

  let lookupResult = nameServiceAccount.storage().getMapItem(NAME_MAP_SLOT_IDX, encodedWord);

  if (!lookupResult) {
    return undefined
  }
  console.log(`lookup: name ${name} resolved to Word ${lookupResult.toHex()}`)

  // If the returned value is empty, the name is not mapped to anything.
  let emptyWord = Word.newFromFelts([new Felt(BigInt(0)), new Felt(BigInt(0)), new Felt(BigInt(0)), new Felt(BigInt(0))])
  if (lookupResult.toHex() === emptyWord.toHex()) {
    console.log(`lookup: name ${name} is not mapped to a value`)
    return undefined
  }

  let accountIdFelts = lookupResult.toFelts()
  let prefix = accountIdFelts[3].asInt()
  let suffix = accountIdFelts[2].asInt()
  let prefixHex = prefix.toString(16)
  // We only need 7 bytes (= 14 hex characters)
  let suffixHex = suffix.toString(16).substring(0, 14)
  let hexId = `0x${prefixHex}${suffixHex}`

  console.log(`lookup: name ${name} is mapped to accountID ${hexId}`)

  return AccountId.fromHex(hexId)
}

export function createSendTx(
  senderId: AccountId,
  recipientId: AccountId,
  faucetId: AccountId,
  amount: bigint,
): CustomTransaction {
  const noteAssets = new NoteAssets([new FungibleAsset(faucetId, amount)])
  let note = Note.createP2IDNote(senderId, recipientId, noteAssets, NoteType.Public, new Felt(BigInt(0)))

  console.log(`send: creating P2ID note ${note.id().toString()}`)

  let transactionRequest = new TransactionRequestBuilder()
    .withOwnOutputNotes(
      new OutputNotesArray([OutputNote.full(note)])
    )
    .build();

  return new CustomTransaction(
    senderId.toBech32(NETWORK_ID, AccountInterface.Unspecified),
    recipientId.toBech32(NETWORK_ID, AccountInterface.Unspecified),
    transactionRequest,
    [],
    []
  );

}