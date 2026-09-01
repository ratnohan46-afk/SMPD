const db=require("./db");
function tx(uid,type,amount,counterparty=null,reference=null){
 db.prepare("INSERT INTO transactions(discord_id,type,amount_lamports,counterparty,reference,created_at) VALUES(?,?,?,?,?,?)")
 .run(uid,type,amount,counterparty,reference,Date.now());
}
function transfer(from,to,amount,type){
 const f=db.prepare("SELECT balance_lamports FROM users WHERE discord_id=?").get(from);
 if(!f||f.balance_lamports<amount) throw new Error("Saldo tidak cukup.");
 const t=db.prepare("SELECT discord_id FROM users WHERE discord_id=?").get(to);
 if(!t) throw new Error("User belum memiliki wallet.");
 const run=db.transaction(()=>{
  db.prepare("UPDATE users SET balance_lamports=balance_lamports-? WHERE discord_id=?").run(amount,from);
  db.prepare("UPDATE users SET balance_lamports=balance_lamports+? WHERE discord_id=?").run(amount,to);
  tx(from,type,-amount,to); tx(to,type,amount,from);
 });
 run();
}
module.exports={tx,transfer};
