async function solIdr(){
 try{
  const r=await fetch(process.env.PRICE_API_URL||"https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=idr",{headers:{"accept":"application/json"}});
  if(!r.ok) return null;
  const j=await r.json();
  const p=Number(j?.solana?.idr);
  return Number.isFinite(p)&&p>0?p:null;
 }catch{return null;}
}
module.exports={solIdr};
