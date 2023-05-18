// Programmatic example of creating a Squad with 3 members, creating an NFT collection, creating an NFT, and assigning the NFT
// to the collection. 

//NOTE: there are numerous ways to do this, but for this example we will be running the collection creation by default via metaplex,
// then transferring the update authority to the vault, then we'll create an NFT purely through the multisig and add it to the collection
// with a tiny hack for the expected Signer arg for metaplex (since we will invoke via CPI w/PDA)

// NOTE2: You may want to run this with an airdrop on devnet, or use a wallet that is funded on devnet if you need.

import Squads, { DEFAULT_MULTISIG_PROGRAM_ID, getAuthorityPDA } from '@sqds/sdk';
import {Keypair, PublicKey, Connection, Signer, ComputeBudgetProgram, Transaction, clusterApiUrl, LAMPORTS_PER_SOL} from '@solana/web3.js';
import {Wallet} from '@sqds/sdk';
import BN from 'bn.js';
import { Metaplex, Nft, TransactionBuilder, UpdateNftOutput, keypairIdentity } from "@metaplex-foundation/js";
import { createMint} from '@solana/spl-token';
import { airdrop } from '../functions';
// import fs from 'fs';
// import os from 'os';

const COLLECTION_URI = 'https://raw.githubusercontent.com/Squads-Protocol/sdk-examples/fc6222ce177126c648f13ea94f1a5a899af2a43c/examples/nft-collections/collection.json';
const NFT_URI = 'https://raw.githubusercontent.com/Squads-Protocol/sdk-examples/fc6222ce177126c648f13ea94f1a5a899af2a43c/examples/nft-collections/nft.json'

/*
  // for fewer potential issues, you should use a CLI wallet instead of a random keypair that's been airdropped to
  let walletJSON = JSON.parse(fs.readFileSync(`${homedir}/.config/solana/id.json`, "utf-8"));
  const walletKeypair = Keypair.fromSecretKey(Uint8Array.from(walletJSON));
  const squads = Squads.endpoint(YOUR_RPC_NODE, new Wallet(walletKeypair));
  const homedir = os.homedir();
*/

// if using this random keypair for the test, be sure to airdrop to it using the airdrop function in this repo
const walletKeypair = Keypair.generate();

// it is highly recommended that you use a different RPC NODE
const squads = Squads.devnet(new Wallet(walletKeypair), {commitmentOrConfig:"confirmed"});

// instantiate metaplex
const connection = new Connection(clusterApiUrl('devnet'),  {commitment:"confirmed"});
const metaplex = new Metaplex(connection);
metaplex.use(keypairIdentity(walletKeypair));

// creates a multisig with 1 signer and a single member using the immediate function
const createSquad = async (members: PublicKey[], threshold: number) => {
    // using random key so no collision
    const createKey = new Keypair().publicKey;
    const name = 'NFT Collection Management Squad';
    const description = 'This is a test squad for managing NFT collections';
    
    try {
        const multisigAccount = await squads.createMultisig(threshold, createKey, members, name, description);
        console.log("Successfully created a new multisig at", multisigAccount.publicKey.toBase58());
        console.log('Multisig account:', JSON.stringify(multisigAccount));
        const [vault] = await getAuthorityPDA(multisigAccount.publicKey, new BN(1), DEFAULT_MULTISIG_PROGRAM_ID);
        console.log("Default Vault address:", vault.toBase58());
        return {multisigPublicKey: multisigAccount.publicKey, vaultPublicKey: vault};
    }catch(e){
        console.log('Error:', e);
        throw e;
    }
};

// this will create the example collection nft
const createCollectionNFT = async (authoritySigner: Signer): Promise<Nft> => {
    const {nft} = await metaplex.nfts().create({
        uri: COLLECTION_URI,
        name: "Collection SDK Example",
        collectionAuthority: authoritySigner,
        updateAuthority: authoritySigner,
        mintTokens: true,
        isCollection: true,
        sellerFeeBasisPoints: 500, // Represents 5.00%.
        tokenOwner: authoritySigner.publicKey,
    });
    return nft;
};

// we have to hack this a bit, as it wants a signer because its client facing, but this will be a CPI.
const createNFT = async (vault: PublicKey, collection: PublicKey, mint: PublicKey, destination: PublicKey): Promise<TransactionBuilder> => {
    const signerCast = {
        publicKey: vault,
        secretKey: vault.toBytes()
    } as Signer;
    const createNFTBuilder = await metaplex.nfts().builders().create({
        uri: NFT_URI,
        name: "NFT SDK Example",
        collectionAuthority: signerCast,
        updateAuthority: signerCast,
        sellerFeeBasisPoints: 500, // Represents 5.00%.
        tokenOwner: destination,
        collection,
        mintTokens: true,
        mintAuthority: signerCast,
        useExistingMint: mint
    });
    return createNFTBuilder;
};

const transferUpdateAuthority = async (nft: Nft, vault: PublicKey): Promise<UpdateNftOutput> => {
    const updated = await metaplex.nfts().update({
        nftOrSft: nft,
        newUpdateAuthority: vault
    });
    return updated;
};

const collectionAndNewNFTExample = async () => {
    // using a threshold of 1, refer to the create-mint example for a more robust version with higher threshold
    // and multiple users voting/executing
    await airdrop(squads.connection, walletKeypair.publicKey, LAMPORTS_PER_SOL);
    const initThreshold = 1;
    const otherMembersBesidesWallet = [
        Keypair.generate(),
        Keypair.generate(),
    ];
    const initMembers = [walletKeypair.publicKey, ...otherMembersBesidesWallet.map(kp => kp.publicKey)];

    // create the collection nft
    const collectionNft = await createCollectionNFT(walletKeypair);
    console.log("collection nft mint", collectionNft.mint.address.toBase58());

    // create the squad multisig
    const {multisigPublicKey, vaultPublicKey} = await createSquad(initMembers, initThreshold);

    // now assign the update authority of the collection to the squad
    const updatedCollection = await transferUpdateAuthority(collectionNft, vaultPublicKey);
    console.log("transfered collection update authority to the vault!");

    // now since metaplex wants to have the mint sorted, as they'll generate mints by default with a client-centric keypair signer,
    // we'll make the new nft mint first and pass it in
    const newNftMint = await createMint(squads.connection, walletKeypair, vaultPublicKey, vaultPublicKey, 0, undefined, {commitment: 'processed', skipPreflight: true});
    console.log("New nft mint created at ", newNftMint.toBase58());
    // get the instructions that will now create a NFT that will be added to the collection
    // for this particular example we'll mint it to the vault/treasury
    const newNftBuilder = await createNFT(vaultPublicKey, collectionNft.mint.address, newNftMint, vaultPublicKey);

    // stage the transaction that will create the NFT and add it to the multisig-managed collection
    const multisigTransaction = await squads.createTransaction(multisigPublicKey, 1);

    // add the nft builder instructions to the transaction:
    const nftIxes = newNftBuilder.getInstructions();
    for(let ix of nftIxes){
        await squads.addInstruction(multisigTransaction.publicKey,ix);
    }
    // activate the transaction
    await squads.activateTransaction(multisigTransaction.publicKey);

    // approve the transaction
    await squads.approveTransaction(multisigTransaction.publicKey);

    // execute the transaction - use the non-immediate squads builder, as we'll need to add compute units
    const executeIx = await squads.buildExecuteTransaction(multisigTransaction.publicKey);
    const computeIx = await ComputeBudgetProgram.setComputeUnitLimit({
        units: 1000000,
    })
    const {blockhash, lastValidBlockHeight} = await squads.connection.getLatestBlockhash("confirmed");
    const executeTx = new Transaction({
        feePayer: walletKeypair.publicKey,
        blockhash,
        lastValidBlockHeight,
    });
    executeTx.add(computeIx);
    executeTx.add(executeIx);
    // sign & serialize and send
    executeTx.sign(walletKeypair);
    const txid = await squads.connection.sendRawTransaction(executeTx.serialize(), {skipPreflight: true, preflightCommitment: 'confirmed'});
    console.log("sent execute tx!", txid);
    console.log("finished, check the added nft mint at", newNftMint.toBase58());
};

collectionAndNewNFTExample();