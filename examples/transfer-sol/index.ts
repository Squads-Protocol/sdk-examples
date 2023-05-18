// Programmatic example of creating a Squad

import Squads, { DEFAULT_MULTISIG_PROGRAM_ID, getAuthorityPDA } from '@sqds/sdk';
import {Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram} from '@solana/web3.js';
import {Wallet} from '@sqds/sdk';
import BN from 'bn.js';

import {airdrop} from "../functions";

const walletKeypair = Keypair.generate();
const squads = Squads.devnet(new Wallet(walletKeypair));

const createSquad = async (members: PublicKey[], threshold: number) => {
    // random key so no collision
    const createKey = new Keypair().publicKey;
    const name = 'Test Squad';
    const description = 'This is a test squad';
    
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

const transferSol = async () => {
    // airdrop to fund the wallet - may fail occasionally since it defaults to public devnet
    await airdrop(squads.connection, walletKeypair.publicKey, LAMPORTS_PER_SOL);
    const payerBalance = await squads.connection.getBalance(walletKeypair.publicKey, "confirmed");
    // validate airdrop
    console.log(payerBalance);

    const otherMembersBesidesWallet = [
        Keypair.generate(),
        Keypair.generate(),
    ];


    const initMembers = [walletKeypair.publicKey, ...otherMembersBesidesWallet.map(kp => kp.publicKey)];
    const initThreshold = 2;
    const {multisigPublicKey, vaultPublicKey} = await createSquad(initMembers, initThreshold);
    
    // airdrop 1 SOL to the vault
    await airdrop(squads.connection, vaultPublicKey, LAMPORTS_PER_SOL);

    // wallet that will get SOL
    const recipientWallet = Keypair.generate().publicKey;

    // create the multisig transaction - use default authority Vault (1)
    const multisigTransaction = await squads.createTransaction(multisigPublicKey, 1);

    const transferSolIx = await SystemProgram.transfer({
        fromPubkey: vaultPublicKey,
        toPubkey: recipientWallet,
        lamports: LAMPORTS_PER_SOL/2, // send .5 SOL
    });

    // add the instruction to the transaction
    const ixRes = await squads.addInstruction(multisigTransaction.publicKey, transferSolIx);
    console.log('Instruction added to transaction:', JSON.stringify(ixRes));

    // activate the transaction so all members can vote on it
    await squads.activateTransaction(multisigTransaction.publicKey);

    // vote on the transaction
    await squads.approveTransaction(multisigTransaction.publicKey);
    const firstTxState = await squads.getTransaction(multisigTransaction.publicKey);
    console.log('Transaction state:', firstTxState.status);

    // still need one more approval from another member, so we'll use the other member's wallet
    const otherMemberWallet = new Wallet(otherMembersBesidesWallet[0]);
    // make sure there are lamports in the wallet
    await airdrop(squads.connection, otherMemberWallet.publicKey, LAMPORTS_PER_SOL);
    const otherMemberSquads = Squads.devnet(otherMemberWallet);
    await otherMemberSquads.approveTransaction(multisigTransaction.publicKey);

    // now you can also check the transaction state, as it should be "executeReady" as the 2/3 threshold has been met
    const transaction = await squads.getTransaction(multisigTransaction.publicKey);
    console.log('Transaction state:', transaction.status);

    // finally, we have the last member wallet execute it if we like
    const executorMemberWallet = new Wallet(otherMembersBesidesWallet[1]);
    const executorMemberSquads = Squads.devnet(executorMemberWallet);
    // make sure there are lamports in the wallet
    await airdrop(squads.connection, executorMemberWallet.publicKey, LAMPORTS_PER_SOL);

    // execute the transaction
    await executorMemberSquads.executeTransaction(multisigTransaction.publicKey);
    const postExecuteState = await squads.getTransaction(multisigTransaction.publicKey);
    console.log('Transaction state:', postExecuteState.status);
    // now we should be able to see that the recipient wallet has a token
    const receipientAccountValue = await squads.connection.getBalance(recipientWallet, "processed");
    console.log('Recipient token account balance:', receipientAccountValue / LAMPORTS_PER_SOL);
};

transferSol();