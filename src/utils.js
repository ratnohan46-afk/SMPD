const {LAMPORTS_PER_SOL}=require("@solana/web3.js");
function toLamports(v){const n=Number(v);if(!Number.isFinite(n)||n<=0)throw new Error("Jumlah tidak valid");return Math.round(n*LAMPORTS_PER_SOL);}
function toSol(v){return Number(v)/LAMPORTS_PER_SOL;}
function fmtSol(v){return toSol(v).toFixed(9);}
function fmtIDR(v){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(v);}
function isAdmin(id){return (process.env.ADMIN_USER_IDS||"").split(",").map(x=>x.trim()).includes(id);}
module.exports={toLamports,toSol,fmtSol,fmtIDR,isAdmin};
