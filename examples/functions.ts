import {Connection, PublicKey} from "@solana/web3.js";

// devnet airdrop
export const airdrop = async (connection: Connection, address: PublicKey, amount: number) => {
    const airdropSig = await connection.requestAirdrop(address, amount);
    console.log("Airdrop sig", airdropSig);
    await connection.confirmTransaction(airdropSig, "confirmed");

    return airdropSig;
}