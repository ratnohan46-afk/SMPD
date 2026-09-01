const db=require("./db");
const {PublicKey}=require("@solana/web3.js");
const {ensureUser}=require("./wallets");
const {tx}=require("./ledger");

async function scanUser(connection,u){
 const pk=new PublicKey(u.wallet_public);
 const state=db.prepare("SELECT * FROM scan_state WHERE discord_id=?").get(u.discord_id);
 let sigs=await connection.getSignaturesForAddress(pk,{limit:50,commitment:"finalized",...(state?.last_signature?{until:state.last_signature}:{})});
 sigs=sigs.reverse();
 for(const s of sigs){
  if(s.err) continue;
  if(db.prepare("SELECT 1 FROM deposits WHERE signature=?").get(s.signature)) continue;
  const t=await connection.getParsedTransaction(s.signature,{commitment:"finalized",maxSupportedTransactionVersion:0});
  if(!t?.meta) continue;
  const keys=t.transaction.message.accountKeys;
  const idx=keys.findIndex(k=>k.pubkey.toBase58()===u.wallet_public);
  if(idx<0) continue;
  const delta=(t.meta.postBalances[idx]||0)-(t.meta.preBalances[idx]||0);
  if(delta>0){
   const run=db.transaction(()=>{
    db.prepare("INSERT INTO deposits(signature,discord_id,lamports,slot,created_at) VALUES(?,?,?,?,?)")
      .run(s.signature,u.discord_id,delta,s.slot,Date.now());
    db.prepare("UPDATE users SET balance_lamports=balance_lamports+? WHERE discord_id=?").run(delta,u.discord_id);
    tx(u.discord_id,"deposit",delta,null,s.signature);
   });
   run();
  } else {
   db.prepare("INSERT INTO deposits(signature,discord_id,lamports,slot,created_at) VALUES(?,?,?,?,?)").run(s.signature,u.discord_id,0,s.slot,Date.now());
  }
  db.prepare("INSERT INTO scan_state(discord_id,last_signature) VALUES(?,?) ON CONFLICT(discord_id) DO UPDATE SET last_signature=excluded.last_signature")
    .run(u.discord_id,s.signature);
 }
}
async function scanAll(connection){
 const users=db.prepare("SELECT * FROM users").all();
 for(const u of users){try{await scanUser(connection,u)}catch(e){console.error("deposit scan",u.discord_id,e.message)}}
}
module.exports={scanAll};
