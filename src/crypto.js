const crypto = require("crypto");
function masterKey(){
  const s=process.env.MASTER_KEY;
  if(!s || s.length<32) throw new Error("MASTER_KEY harus diisi dan minimal 32 karakter.");
  return crypto.createHash("sha256").update(s).digest();
}
function encrypt(text){
  const iv=crypto.randomBytes(12);
  const c=crypto.createCipheriv("aes-256-gcm",masterKey(),iv);
  const data=Buffer.concat([c.update(text,"utf8"),c.final()]);
  return [iv,c.getAuthTag(),data].map(x=>x.toString("base64url")).join(".");
}
function decrypt(blob){
  const [iv,tag,data]=blob.split(".").map(x=>Buffer.from(x,"base64url"));
  const d=crypto.createDecipheriv("aes-256-gcm",masterKey(),iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(data),d.final()]).toString("utf8");
}
module.exports={encrypt,decrypt};
