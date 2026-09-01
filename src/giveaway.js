const db=require("./db");
const {ButtonBuilder,ActionRowBuilder,ButtonStyle}=require("discord.js");
const {tx}=require("./ledger");

function createRow(id){return new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`smpd_gw_join:${id}`).setLabel("🎟️ Ikut").setStyle(ButtonStyle.Primary));}
async function finish(client,g){
 if(g.status!=="open") return;
 const rows=db.prepare("SELECT discord_id FROM giveaway_entries WHERE giveaway_id=?").all(g.id);
 if(!rows.length){
  const run=db.transaction(()=>{
   db.prepare("UPDATE users SET balance_lamports=balance_lamports+? WHERE discord_id=?").run(g.amount_lamports,g.creator_id);
   db.prepare("UPDATE giveaways SET status='cancelled',updated_at=? WHERE id=?").run(Date.now(),g.id);
   tx(g.creator_id,"giveaway_refund",g.amount_lamports,null,String(g.id));
  });
  run();
  try { const ch=await client.channels.fetch(g.channel_id); await ch.send(`🎉 Giveaway #${g.id} dibatalkan karena tidak ada peserta. Dana dikembalikan ke pembuat.`); } catch {}
  return;
 }
 const winner=rows[Math.floor(Math.random()*rows.length)].discord_id;
 const run=db.transaction(()=>{
  const u=db.prepare("SELECT balance_lamports FROM users WHERE discord_id=?").get(g.creator_id);
  if(!u||u.balance_lamports<g.amount_lamports) throw new Error("Saldo pembuat giveaway tidak cukup.");
  db.prepare("UPDATE users SET balance_lamports=balance_lamports-? WHERE discord_id=?").run(g.amount_lamports,g.creator_id);
  db.prepare("UPDATE users SET balance_lamports=balance_lamports+? WHERE discord_id=?").run(g.amount_lamports,winner);
  db.prepare("UPDATE giveaways SET status='finished',winner_id=? WHERE id=?").run(winner,g.id);
  tx(g.creator_id,"giveaway",-g.amount_lamports,winner,String(g.id));
  tx(winner,"giveaway",g.amount_lamports,g.creator_id,String(g.id));
 });
 try{run(); const ch=await client.channels.fetch(g.channel_id); await ch.send(`🎉 Giveaway #${g.id} selesai! Pemenang: <@${winner}> — **${g.amount_lamports/1e9} SOL**`);}
 catch(e){console.error("giveaway",e.message)}
}
async function worker(client){
 const rows=db.prepare("SELECT * FROM giveaways WHERE status='open' AND ends_at<=?").all(Date.now());
 for(const g of rows) await finish(client,g);
}
module.exports={createRow,worker};
