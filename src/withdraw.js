const db=require("./db");
const {PublicKey,Transaction,SystemProgram,sendAndConfirmTransaction,LAMPORTS_PER_SOL}=require("@solana/web3.js");
const {keypair}=require("./wallets");
const {tx}=require("./ledger");

const locks=new Set();
async function withdraw(connection,u,destination,amount){
 if(locks.has(u.discord_id)) throw new Error("Withdrawal sebelumnya masih diproses.");
 locks.add(u.discord_id);
 try{
  const dest=new PublicKey(destination);
  const now=Date.now();
  const cooldown=Number(process.env.WITHDRAW_COOLDOWN_SECONDS||60)*1000;
  const last=db.prepare("SELECT created_at FROM withdrawals WHERE discord_id=? ORDER BY id DESC LIMIT 1").get(u.discord_id);
  if(last && now-last.created_at<cooldown) throw new Error(`Tunggu ${Math.ceil((cooldown-(now-last.created_at))/1000)} detik sebelum WD lagi.`);
  const min=Number(process.env.MIN_WITHDRAW_SOL||0.001), max=Number(process.env.MAX_WITHDRAW_SOL||1);
  if(amount/LAMPORTS_PER_SOL<min || amount/LAMPORTS_PER_SOL>max) throw new Error(`Batas WD: ${min}–${max} SOL.`);
  const fresh=db.prepare("SELECT * FROM users WHERE discord_id=?").get(u.discord_id);
  if(fresh.balance_lamports<amount) throw new Error("Saldo tidak cukup.");
  const kp=keypair(fresh);
  const {blockhash,lastValidBlockHeight}=await connection.getLatestBlockhash("confirmed");
  const tx0=new Transaction({feePayer:kp.publicKey,blockhash,lastValidBlockHeight})
    .add(SystemProgram.transfer({fromPubkey:kp.publicKey,toPubkey:dest,lamports:amount}));
  const fee=(await connection.getFeeForMessage(tx0.compileMessage(), "confirmed")).value||5000;
  const reserve=amount+fee;
  if(fresh.balance_lamports<reserve) throw new Error(`Saldo kurang untuk biaya network. Perkiraan fee ${fee/LAMPORTS_PER_SOL} SOL.`);
  const run=db.transaction(()=>{
    db.prepare("UPDATE users SET balance_lamports=balance_lamports-? WHERE discord_id=?").run(reserve,u.discord_id);
    return db.prepare("INSERT INTO withdrawals(discord_id,destination,amount_lamports,fee_lamports,status,created_at,updated_at) VALUES(?,?,?,?,?,?,?)")
      .run(u.discord_id,destination,amount,fee,"pending",now,now).lastInsertRowid;
  });
  const id=run();
  let sig=null;
  try{
    sig=await connection.sendTransaction(tx0,[kp],{skipPreflight:false,preflightCommitment:"confirmed"});
    db.prepare("UPDATE withdrawals SET signature=?,updated_at=? WHERE id=?").run(sig,Date.now(),id);
    const st=await connection.confirmTransaction({signature:sig,blockhash,lastValidBlockHeight},"confirmed");
    if(st.value.err) throw new Error("Transaksi ditolak oleh jaringan.");
    db.prepare("UPDATE withdrawals SET status='confirmed',updated_at=? WHERE id=?").run(Date.now(),id);
    const actual=await connection.getTransaction(sig,{commitment:"confirmed",maxSupportedTransactionVersion:0});
    const actualFee=actual?.meta?.fee??fee;
    const refund=fee-actualFee;
    if(refund>0){
      db.prepare("UPDATE users SET balance_lamports=balance_lamports+? WHERE discord_id=?").run(refund,u.discord_id);
      tx(u.discord_id,"withdraw_fee_refund",refund,null,sig);
    }
    tx(u.discord_id,"withdraw",-amount,destination,sig);
    return sig;
  }catch(e){
    db.prepare("UPDATE withdrawals SET status='failed',error=?,updated_at=? WHERE id=?").run(String(e.message).slice(0,500),Date.now(),id);
    db.prepare("UPDATE users SET balance_lamports=balance_lamports+? WHERE discord_id=?").run(reserve,u.discord_id);
    throw e;
  }
 }finally{locks.delete(u.discord_id)}
}
async function reconcile(connection){
 const rows=db.prepare("SELECT * FROM withdrawals WHERE status='pending'").all();
 for(const w of rows){
  if(!w.signature) continue;
  try{
   const t=await connection.getSignatureStatuses([w.signature]);
   const st=t?.value?.[0];
   if(st?.err){
    db.prepare("UPDATE withdrawals SET status='failed',error=?,updated_at=? WHERE id=?").run(JSON.stringify(st.err),Date.now(),w.id);
    db.prepare("UPDATE users SET balance_lamports=balance_lamports+? WHERE discord_id=?").run(w.amount_lamports+w.fee_lamports,w.discord_id);
   } else if(st?.confirmationStatus){
    db.prepare("UPDATE withdrawals SET status='confirmed',updated_at=? WHERE id=?").run(Date.now(),w.id);
   }
  }catch(e){}
 }
}
module.exports={withdraw,reconcile};
