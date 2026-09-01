require("dotenv").config();
const {REST,Routes,SlashCommandBuilder,PermissionFlagsBits}=require("discord.js");
const commands=[
 new SlashCommandBuilder().setName("wallet").setDescription("Lihat alamat wallet Solana kamu."),
 new SlashCommandBuilder().setName("deposit").setDescription("Lihat alamat deposit SOL kamu."),
 new SlashCommandBuilder().setName("balance").setDescription("Lihat saldo SOL dan estimasi IDR."),
 new SlashCommandBuilder().setName("withdraw").setDescription("Withdraw SOL ke alamat Solana.")
  .addStringOption(o=>o.setName("address").setDescription("Alamat tujuan").setRequired(true))
  .addNumberOption(o=>o.setName("amount").setDescription("Jumlah SOL").setRequired(true).setMinValue(0.000001)),
 new SlashCommandBuilder().setName("tip").setDescription("Kirim saldo internal ke member.")
  .addUserOption(o=>o.setName("user").setDescription("Penerima").setRequired(true))
  .addNumberOption(o=>o.setName("amount").setDescription("Jumlah SOL").setRequired(true).setMinValue(0.000001)),
 new SlashCommandBuilder().setName("give").setDescription("Berikan saldo internal ke member.")
  .addUserOption(o=>o.setName("user").setDescription("Penerima").setRequired(true))
  .addNumberOption(o=>o.setName("amount").setDescription("Jumlah SOL").setRequired(true).setMinValue(0.000001)),
 new SlashCommandBuilder().setName("rain").setDescription("Bagikan SOL ke member yang aktif.")
  .addNumberOption(o=>o.setName("amount").setDescription("Total SOL").setRequired(true).setMinValue(0.000001)),
 new SlashCommandBuilder().setName("giveaway").setDescription("Buat giveaway dengan tombol peserta.")
  .addNumberOption(o=>o.setName("amount").setDescription("Hadiah SOL").setRequired(true).setMinValue(0.000001))
  .addIntegerOption(o=>o.setName("minutes").setDescription("Durasi menit").setRequired(true).setMinValue(1).setMaxValue(1440)),
 new SlashCommandBuilder().setName("history").setDescription("Riwayat 10 transaksi terakhir."),
 new SlashCommandBuilder().setName("smpd").setDescription("Perintah admin SMPD.")
  .addSubcommand(s=>s.setName("admin").setDescription("Admin SMPD")
   .addStringOption(o=>o.setName("action").setDescription("Aksi").setRequired(true).addChoices(
    {name:"freeze",value:"freeze"},{name:"unfreeze",value:"unfreeze"},{name:"status",value:"status"},{name:"credit",value:"credit"},{name:"debit",value:"debit"}))
   .addUserOption(o=>o.setName("user").setDescription("User untuk credit/debit"))
   .addNumberOption(o=>o.setName("amount").setDescription("Jumlah SOL untuk credit/debit").setMinValue(0.000001)))
].map(c=>c.toJSON());
(async()=>{
 const rest=new REST({version:"10"}).setToken(process.env.DISCORD_TOKEN);
 const route=process.env.DISCORD_GUILD_ID?Routes.applicationGuildCommands(process.env.DISCORD_CLIENT_ID,process.env.DISCORD_GUILD_ID):Routes.applicationCommands(process.env.DISCORD_CLIENT_ID);
 await rest.put(route,{body:commands});console.log("SMPD commands registered");
})().catch(e=>{console.error(e);process.exit(1)});
