"use strict";
// Programmatic example of creating a Squad with 3 members, creating an NFT collection, creating an NFT, and assigning the NFT
// to the collection. 
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
//NOTE: there are numerous ways to do this, but for this example we will be running the collection creation by default via metaplex,
// then transferring the update authority to the vault, then we'll create an NFT purely through the multisig and add it to the collection
// with a tiny hack for the expected Signer arg for metaplex (since we will invoke via CPI w/PDA)
// NOTE2: You may want to run this with an airdrop on devnet, or use a wallet that is funded on devnet if you need.
const sdk_1 = __importStar(require("@sqds/sdk"));
const web3_js_1 = require("@solana/web3.js");
const sdk_2 = require("@sqds/sdk");
const bn_js_1 = __importDefault(require("bn.js"));
const js_1 = require("@metaplex-foundation/js");
const spl_token_1 = require("@solana/spl-token");
const functions_1 = require("../functions");
// import fs from 'fs';
// import os from 'os';
const COLLECTION_URI = 'https://raw.githubusercontent.com/Squads-Protocol/sdk-examples/fc6222ce177126c648f13ea94f1a5a899af2a43c/examples/nft-collections/collection.json';
const NFT_URI = 'https://raw.githubusercontent.com/Squads-Protocol/sdk-examples/fc6222ce177126c648f13ea94f1a5a899af2a43c/examples/nft-collections/nft.json';
/*
  // for fewer potential issues, you should use a CLI wallet instead of a random keypair that's been airdropped to
  let walletJSON = JSON.parse(fs.readFileSync(`${homedir}/.config/solana/id.json`, "utf-8"));
  const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(walletJSON));
  const squads = Squads.endpoint(YOUR_RPC_NODE, new Wallet(walletKeypair));
  const homedir = os.homedir();
*/
// if using this random keypair for the test, be sure to airdrop to it using the airdrop function in this repo
const walletKeypair = web3_js_1.Keypair.generate();
// it is highly recommended that you use a different RPC NODE
const squads = sdk_1.default.devnet(new sdk_2.Wallet(walletKeypair), { commitmentOrConfig: "confirmed" });
// instantiate metaplex
const connection = new web3_js_1.Connection((0, web3_js_1.clusterApiUrl)('devnet'), { commitment: "confirmed" });
const metaplex = new js_1.Metaplex(connection);
metaplex.use((0, js_1.keypairIdentity)(walletKeypair));
// creates a multisig with 1 signer and a single member using the immediate function
const createSquad = (members, threshold) => __awaiter(void 0, void 0, void 0, function* () {
    // using random key so no collision
    const createKey = new web3_js_1.Keypair().publicKey;
    const name = 'NFT Collection Management Squad';
    const description = 'This is a test squad for managing NFT collections';
    try {
        const multisigAccount = yield squads.createMultisig(threshold, createKey, members, name, description);
        console.log("Successfully created a new multisig at", multisigAccount.publicKey.toBase58());
        console.log('Multisig account:', JSON.stringify(multisigAccount));
        const [vault] = yield (0, sdk_1.getAuthorityPDA)(multisigAccount.publicKey, new bn_js_1.default(1), sdk_1.DEFAULT_MULTISIG_PROGRAM_ID);
        console.log("Default Vault address:", vault.toBase58());
        return { multisigPublicKey: multisigAccount.publicKey, vaultPublicKey: vault };
    }
    catch (e) {
        console.log('Error:', e);
        throw e;
    }
});
// this will create the example collection nft
const createCollectionNFT = (authoritySigner) => __awaiter(void 0, void 0, void 0, function* () {
    const { nft } = yield metaplex.nfts().create({
        uri: COLLECTION_URI,
        name: "Collection SDK Example",
        collectionAuthority: authoritySigner,
        updateAuthority: authoritySigner,
        mintTokens: true,
        isCollection: true,
        sellerFeeBasisPoints: 500,
        tokenOwner: authoritySigner.publicKey,
    });
    return nft;
});
// we have to hack this a bit, as it wants a signer because its client facing, but this will be a CPI.
const createNFT = (vault, collection, mint, destination) => __awaiter(void 0, void 0, void 0, function* () {
    const signerCast = {
        publicKey: vault,
        secretKey: vault.toBytes()
    };
    const createNFTBuilder = yield metaplex.nfts().builders().create({
        uri: NFT_URI,
        name: "NFT SDK Example",
        collectionAuthority: signerCast,
        updateAuthority: signerCast,
        sellerFeeBasisPoints: 500,
        tokenOwner: destination,
        collection,
        mintTokens: true,
        mintAuthority: signerCast,
        useExistingMint: mint
    });
    return createNFTBuilder;
});
const transferUpdateAuthority = (nft, vault) => __awaiter(void 0, void 0, void 0, function* () {
    const updated = yield metaplex.nfts().update({
        nftOrSft: nft,
        newUpdateAuthority: vault
    });
    return updated;
});
const collectionAndNewNFTExample = () => __awaiter(void 0, void 0, void 0, function* () {
    // using a threshold of 1, refer to the create-mint example for a more robust version with higher threshold
    // and multiple users voting/executing
    yield (0, functions_1.airdrop)(squads.connection, walletKeypair.publicKey, web3_js_1.LAMPORTS_PER_SOL);
    const initThreshold = 1;
    const otherMembersBesidesWallet = [
        web3_js_1.Keypair.generate(),
        web3_js_1.Keypair.generate(),
    ];
    const initMembers = [walletKeypair.publicKey, ...otherMembersBesidesWallet.map(kp => kp.publicKey)];
    // create the collection nft
    const collectionNft = yield createCollectionNFT(walletKeypair);
    console.log("collection nft mint", collectionNft.mint.address.toBase58());
    // create the squad multisig
    const { multisigPublicKey, vaultPublicKey } = yield createSquad(initMembers, initThreshold);
    // now assign the update authority of the collection to the squad
    const updatedCollection = yield transferUpdateAuthority(collectionNft, vaultPublicKey);
    console.log("transfered collection update authority to the vault!");
    // now since metaplex wants to have the mint sorted, as they'll generate mints by default with a client-centric keypair signer,
    // we'll make the new nft mint first and pass it in
    const newNftMint = yield (0, spl_token_1.createMint)(squads.connection, walletKeypair, vaultPublicKey, vaultPublicKey, 0, undefined, { commitment: 'processed', skipPreflight: true });
    console.log("New nft mint created at ", newNftMint.toBase58());
    // get the instructions that will now create a NFT that will be added to the collection
    // for this particular example we'll mint it to the vault/treasury
    const newNftBuilder = yield createNFT(vaultPublicKey, collectionNft.mint.address, newNftMint, vaultPublicKey);
    // stage the transaction that will create the NFT and add it to the multisig-managed collection
    const multisigTransaction = yield squads.createTransaction(multisigPublicKey, 1);
    // add the nft builder instructions to the transaction:
    const nftIxes = newNftBuilder.getInstructions();
    for (let ix of nftIxes) {
        yield squads.addInstruction(multisigTransaction.publicKey, ix);
    }
    // activate the transaction
    yield squads.activateTransaction(multisigTransaction.publicKey);
    // approve the transaction
    yield squads.approveTransaction(multisigTransaction.publicKey);
    // execute the transaction - use the non-immediate squads builder, as we'll need to add compute units
    const executeIx = yield squads.buildExecuteTransaction(multisigTransaction.publicKey);
    const computeIx = yield web3_js_1.ComputeBudgetProgram.setComputeUnitLimit({
        units: 1000000,
    });
    const { blockhash, lastValidBlockHeight } = yield squads.connection.getLatestBlockhash("confirmed");
    const executeTx = new web3_js_1.Transaction({
        feePayer: walletKeypair.publicKey,
        blockhash,
        lastValidBlockHeight,
    });
    executeTx.add(computeIx);
    executeTx.add(executeIx);
    // sign & serialize and send
    executeTx.sign(walletKeypair);
    const txid = yield squads.connection.sendRawTransaction(executeTx.serialize(), { skipPreflight: true, preflightCommitment: 'confirmed' });
    console.log("sent execute tx!", txid);
    console.log("finished, check the added nft mint at", newNftMint.toBase58());
});
collectionAndNewNFTExample();
