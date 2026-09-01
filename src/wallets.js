const {Keypair}=require("@solana/web3.js");
const db=require("./db");
const {encrypt,decrypt}=require("./crypto");
function ensureUser(id){
 let u=db.prepare("SELECT * FROM users WHERE discord_id=?").get(id);
 if(u) return u;
 const kp=Keypair.generate();
 db.prepare("INSERT INTO users(discord_id,wallet_public,wallet_secret,created_at) VALUES(?,?,?,?)")
   .run(id,kp.publicKey.toBase58(),encrypt(JSON.stringify([...kp.secretKey])),Date.now());
 return db.prepare("SELECT * FROM users WHERE discord_id=?").get(id);
}
function keypair(u){
 return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(decrypt(u.wallet_secret))));
}
module.exports={ensureUser,keypair};
