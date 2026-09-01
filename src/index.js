require("dotenv").config();
const {Client,GatewayIntentBits,EmbedBuilder,ActionRowBuilder,ButtonBuilder,ButtonStyle}=require("discord.js");
const {Connection,PublicKey}=require("@solana/web3.js");
const db=require("./db");
const {ensureUser}=require("./wallets");
const {toLamports,toSol,fmtIDR,isAdmin}=require("./utils");
const {solIdr}=require("./price");
const {transfer,tx}=require("./ledger");
const {withdraw,reconcile}=require("./withdraw");
const {scanAll}=require("./scanner");
const {createRow,worker:gwWorker}=require("./giveaway");

if(!process.env.DISCORD_TOKEN||!process.env.DISCORD_CLIENT_ID) throw new Error("Discord env belum lengkap.");
const client=new Client({intents:[GatewayIntentBits.Guilds,GatewayIntentBits.GuildMembers,GatewayIntentBits.GuildMessages,GatewayIntentBits.MessageContent]});
const connection=new Connection(process.env.SOLANA_RPC_URL||"https://api.mainnet-beta.solana.com","finalized");

function frozen(){return db.prepare("SELECT value FROM settings WHERE key='frozen'").get()?.value==="1";}
function setFrozen(v){db.prepare("INSERT INTO settings(key,value) VALUES('frozen',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(v?"1":"0");}
function activeUsers(guild){
 const cutoff=Date.now()-Number(process.env.RAIN_ACTIVE_MINUTES||30)*60*1000;
 return guild.members.cache.filter(m=>!m.user.bot && ensureUser(m.id).last_activity>=cutoff);
}
async function sendBalance(i){
 const u=ensureUser(i.user.id), price=await solIdr(), s=toSol(u.balance_lamports);
 return i.reply({embeds:[new EmbedBuilder().setTitle("💰 SMPD Wallet").setDescription("Saldo utama kamu adalah SOL. Nilai IDR hanya estimasi harga pasar.")
  .addFields({name:"SOL",value:`${s.toFixed(9)} SOL`,inline:true},{name:"🇮🇩 Estimasi IDR",value:price?fmtIDR(s*price):"Tidak tersedia",inline:true})]});
}
client.once("ready",async()=>{
 console.log(`SMPD online: ${client.user.tag}`);
 await reconcile(connection);
 setInterval(()=>scanAll(connection).catch(console.error),Number(process.env.DEPOSIT_SCAN_MS||30000));
 setInterval(()=>gwWorker(client).catch(console.error),15000);
 scanAll(connection).catch(console.error);
});

client.on("messageCreate",m=>{
 if(!m.author.bot) {
  ensureUser(m.author.id);
  db.prepare("UPDATE users SET last_activity=? WHERE discord_id=?").run(Date.now(),m.author.id);
 }
});

client.on("interactionCreate",async i=>{
 try{
  if(i.isButton() && i.customId.startsWith("smpd_gw_join:")){
   const id=Number(i.customId.split(":")[1]);
   const g=db.prepare("SELECT * FROM giveaways WHERE id=?").get(id);
   if(!g||g.status!=="open"||g.ends_at<Date.now()) return i.reply({ephemeral:true,content:"❌ Giveaway sudah berakhir."});
   ensureUser(i.user.id);
   db.prepare("INSERT OR IGNORE INTO giveaway_entries(giveaway_id,discord_id) VALUES(?,?)").run(id,i.user.id);
   return i.reply({ephemeral:true,content:"🎟️ Kamu sudah masuk giveaway!"});
  }
  if(!i.isChatInputCommand()) return;
  ensureUser(i.user.id);

  if(i.commandName==="wallet"||i.commandName==="deposit"){
   const u=ensureUser(i.user.id);
   return i.reply({ephemeral:true,content:`🟣 **SMPD Deposit Wallet**

\`${u.wallet_public}\`

Network: **Solana Mainnet**

⚠️ Kirim **SOL melalui jaringan Solana**. Jangan kirim aset/token lain ke alamat ini.`});
  }
  if(i.commandName==="balance") return sendBalance(i);
  if(frozen() && !isAdmin(i.user.id) && ["withdraw","tip","give","rain","giveaway"].includes(i.commandName))
   return i.reply({ephemeral:true,content:"🛑 SMPD sedang dalam emergency freeze. Transaksi sementara dinonaktifkan."});

  if(i.commandName==="withdraw"){
   const address=i.options.getString("address"), amount=toLamports(i.options.getNumber("amount"));
   try{new PublicKey(address)}catch{return i.reply({ephemeral:true,content:"❌ Alamat Solana tidak valid."})}
   await i.deferReply({ephemeral:true});
   try{const sig=await withdraw(connection,ensureUser(i.user.id),address,amount);return i.editReply(`✅ Withdrawal berhasil.

Jumlah: **${toSol(amount)} SOL**
TX: \`${sig}\``)}
   catch(e){return i.editReply(`❌ Withdrawal gagal: ${e.message}`)}
  }

  if(["tip","give"].includes(i.commandName)){
   const target=i.options.getUser("user"), amount=toLamports(i.options.getNumber("amount"));
   if(target.bot||target.id===i.user.id) return i.reply({ephemeral:true,content:"❌ User tidak valid."});
   ensureUser(target.id);
   try{transfer(i.user.id,target.id,amount,i.commandName);return i.reply(`✅ ${i.commandName==="tip"?"Tip":"Give"} **${toSol(amount)} SOL** → <@${target.id}>`)}
   catch(e){return i.reply({ephemeral:true,content:`❌ ${e.message}`})}
  }

  if(i.commandName==="rain"){
   const amount=toLamports(i.options.getNumber("amount")), participants=[...activeUsers(i.guild).keys()];
   if(!participants.length) return i.reply({ephemeral:true,content:"❌ Tidak ada member aktif dalam jangka waktu yang ditentukan."});
   if(participants.includes(i.user.id)) participants.splice(participants.indexOf(i.user.id),1);
   if(!participants.length) return i.reply({ephemeral:true,content:"❌ Tidak ada member lain yang aktif."});
   const share=Math.floor(amount/participants.length);
   if(share<1) return i.reply({ephemeral:true,content:"❌ Jumlah terlalu kecil untuk peserta aktif."});
   const sender=db.prepare("SELECT balance_lamports FROM users WHERE discord_id=?").get(i.user.id);
   if(sender.balance_lamports<share*participants.length) return i.reply({ephemeral:true,content:"❌ Saldo tidak cukup."});
   const run=db.transaction(()=>{
    db.prepare("UPDATE users SET balance_lamports=balance_lamports-? WHERE discord_id=?").run(share*participants.length,i.user.id);
    for(const id of participants){db.prepare("UPDATE users SET balance_lamports=balance_lamports+? WHERE discord_id=?").run(share,id);tx(id,"rain",share,i.user.id);}
    tx(i.user.id,"rain",-share*participants.length,null,"rain");
   });run();
   return i.reply(`🌧️ **RAIN!** ${participants.length} member aktif mendapat **${toSol(share)} SOL** masing-masing.`);
  }

  if(i.commandName==="giveaway"){
   const amount=toLamports(i.options.getNumber("amount")), minutes=i.options.getInteger("minutes");
   const u=db.prepare("SELECT balance_lamports FROM users WHERE discord_id=?").get(i.user.id);
   if(u.balance_lamports<amount) return i.reply({ephemeral:true,content:"❌ Saldo tidak cukup."});
   const end=Date.now()+minutes*60000;
   // Reserve immediately so the creator cannot spend the giveaway balance elsewhere.
   db.prepare("UPDATE users SET balance_lamports=balance_lamports-? WHERE discord_id=?").run(amount,i.user.id);
   const msg=await i.reply({content:`🎉 **SMPD GIVEAWAY**

Hadiah: **${toSol(amount)} SOL**
Berakhir: <t:${Math.floor(end/1000)}:R>

Klik tombol untuk ikut!`,components:[createRow(0)],fetchReply:true});
   const id=db.prepare("INSERT INTO giveaways(creator_id,amount_lamports,ends_at,channel_id,message_id,status,created_at) VALUES(?,?,?,?,?,'open',?,?)")
    .run(i.user.id,amount,end,i.channelId,msg.id,Date.now(),Date.now()).lastInsertRowid;
   await msg.edit({components:[createRow(id)]});
   return;
  }

  if(i.commandName==="history"){
   const rows=db.prepare("SELECT * FROM transactions WHERE discord_id=? ORDER BY id DESC LIMIT 10").all(i.user.id);
   const text=rows.length?rows.map(r=>`${new Date(r.created_at).toLocaleString("id-ID")} • ${r.type} • ${r.amount_lamports>=0?"+":""}${toSol(r.amount_lamports)} SOL`).join("\n"):"Belum ada transaksi.";
   return i.reply({ephemeral:true,content:`📜 **SMPD History**
${text}`});
  }

  if(i.commandName==="smpd"){
   if(!isAdmin(i.user.id)) return i.reply({ephemeral:true,content:"❌ Admin only."});
   const action=i.options.getString("action");
   if(action==="freeze"){setFrozen(true);return i.reply("🛑 SMPD emergency freeze **AKTIF**.");}
   if(action==="unfreeze"){setFrozen(false);return i.reply("✅ SMPD emergency freeze **NONAKTIF**.");}
   if(action==="status"){const users=db.prepare("SELECT COUNT(*) c FROM users").get().c;const sum=db.prepare("SELECT COALESCE(SUM(balance_lamports),0) s FROM users").get().s;return i.reply(`🟢 Status SMPD
Users: **${users}**
Internal liabilities: **${toSol(sum)} SOL**
Freeze: **${frozen()?"ON":"OFF"}**`);}
   const user=i.options.getUser("user"), amount=toLamports(i.options.getNumber("amount")||0);
   if(!user||!amount) return i.reply({ephemeral:true,content:"❌ User dan amount wajib untuk credit/debit."});
   ensureUser(user.id);
   if(action==="credit"){db.prepare("UPDATE users SET balance_lamports=balance_lamports+? WHERE discord_id=?").run(amount,user.id);tx(user.id,"admin_credit",amount,i.user.id);return i.reply(`✅ Credit ${toSol(amount)} SOL ke <@${user.id}>.`)}
   if(action==="debit"){const u=db.prepare("SELECT balance_lamports FROM users WHERE discord_id=?").get(user.id);if(u.balance_lamports<amount)return i.reply({ephemeral:true,content:"❌ Saldo user tidak cukup."});db.prepare("UPDATE users SET balance_lamports=balance_lamports-? WHERE discord_id=?").run(amount,user.id);tx(user.id,"admin_debit",-amount,i.user.id);return i.reply(`✅ Debit ${toSol(amount)} SOL dari <@${user.id}>.`)}
  }
 }catch(e){console.error(e);if(!i.replied&&!i.deferred)i.reply({ephemeral:true,content:"❌ SMPD mengalami error internal."}).catch(()=>{});}
});
client.login(process.env.DISCORD_TOKEN);
