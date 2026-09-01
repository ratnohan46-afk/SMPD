const Database=require("better-sqlite3");
const db=new Database(process.env.DB_PATH||"smpd.sqlite");
db.pragma("journal_mode=WAL");
db.pragma("foreign_keys=ON");
db.exec(`
CREATE TABLE IF NOT EXISTS users(
 discord_id TEXT PRIMARY KEY,
 wallet_public TEXT NOT NULL UNIQUE,
 wallet_secret TEXT NOT NULL,
 balance_lamports INTEGER NOT NULL DEFAULT 0,
 last_activity INTEGER NOT NULL DEFAULT 0,
 created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS deposits(signature TEXT PRIMARY KEY,discord_id TEXT NOT NULL,lamports INTEGER NOT NULL,slot INTEGER,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS scan_state(discord_id TEXT PRIMARY KEY,last_signature TEXT);
CREATE TABLE IF NOT EXISTS transactions(id INTEGER PRIMARY KEY AUTOINCREMENT,discord_id TEXT NOT NULL,type TEXT NOT NULL,amount_lamports INTEGER NOT NULL,counterparty TEXT,reference TEXT,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS withdrawals(id INTEGER PRIMARY KEY AUTOINCREMENT,discord_id TEXT NOT NULL,destination TEXT NOT NULL,amount_lamports INTEGER NOT NULL,fee_lamports INTEGER NOT NULL DEFAULT 0,signature TEXT,status TEXT NOT NULL,error TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS giveaways(id INTEGER PRIMARY KEY AUTOINCREMENT,creator_id TEXT NOT NULL,amount_lamports INTEGER NOT NULL,ends_at INTEGER NOT NULL,channel_id TEXT NOT NULL,message_id TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open',winner_id TEXT,created_at INTEGER NOT NULL,updated_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS giveaway_entries(giveaway_id INTEGER NOT NULL,discord_id TEXT NOT NULL,PRIMARY KEY(giveaway_id,discord_id));
CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS game_history(
 id INTEGER PRIMARY KEY AUTOINCREMENT,
 discord_id TEXT NOT NULL,
 game TEXT NOT NULL,
 bet_lamports INTEGER NOT NULL,
 win INTEGER NOT NULL,
 payout_lamports INTEGER NOT NULL DEFAULT 0,
 multiplier REAL NOT NULL DEFAULT 0,
 level INTEGER,
 choice TEXT,
 result TEXT,
 created_at INTEGER NOT NULL
);
`);
module.exports=db;
