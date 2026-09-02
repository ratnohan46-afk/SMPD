# FiveM Player Finder — Final v1

Bot Discord untuk mencari player FiveM yang sedang online, dengan tampilan Embed seperti tracker pada screenshot.

## Fitur

- `/find nama`
- `/finder-status`
- Mode `configured`: scan server yang kamu masukkan sendiri.
- Mode `discovery`: mengambil server dari feed server FiveM/Cfx.re lalu mencari player pada hasil yang diindeks.
- Refresh otomatis.
- Cache lokal agar bot tetap punya data terakhir jika refresh berikutnya gagal.
- Menampilkan server, player ID, nama, dan ping.
- Filter locale opsional, misalnya `id-ID`.
- Batas jumlah server discovery agar hosting tidak langsung terbebani.

## Sumber data

Bot menggunakan data server/player dari endpoint dan feed Cfx/FiveM melalui library `fivem-server-api`. Server FiveM juga menyediakan endpoint `players.json`, `info.json`, dan `dynamic.json` pada server yang dapat diakses.

## Instalasi

Gunakan Node.js 20 atau lebih baru.

```bash
npm install
```

Salin `.env.example` menjadi `.env`, lalu isi:

```env
DISCORD_TOKEN=token_bot
CLIENT_ID=application_id
GUILD_ID=id_server_discord
```

Untuk testing cepat, isi `GUILD_ID`. Slash command guild biasanya muncul lebih cepat daripada global command.

## Mode discovery

Default:

```env
SEARCH_MODE=discovery
DISCOVERY_LIMIT=200
DISCOVERY_LOCALES=id-ID
CACHE_REFRESH_SECONDS=60
```

`DISCOVERY_LIMIT` adalah jumlah server yang diambil dari hasil discovery, bukan jaminan bahwa seluruh server FiveM di dunia akan diperiksa.

Jika ingin fokus Indonesia:

```env
DISCOVERY_LOCALES=id-ID
```

Jika ingin tanpa filter locale:

```env
DISCOVERY_LOCALES=
```

## Mode server sendiri

Ubah:

```env
SEARCH_MODE=configured
```

Kemudian aktifkan server di `config/servers.json`:

```json
{
  "servers": [
    {
      "name": "Server Saya",
      "endpoint": "1.2.3.4:30120",
      "enabled": true
    }
  ]
}
```

## Menjalankan

```bash
npm start
```

## Penting tentang pencarian global

Mencari player di seluruh ekosistem FiveM bukan sama dengan mencari nama server. Bot harus memperoleh daftar server dan player dari feed/server endpoint, sehingga jumlah server yang dipindai, timeout, refresh, dan rate request harus dibatasi.

Karena endpoint Cfx/FiveM dapat berubah, project sengaja memakai library `fivem-server-api` dan konfigurasi batas discovery. Jika Cfx mengubah API, bagian integrasi `src/fivem.js` adalah bagian utama yang perlu diperbarui.

## Struktur

```text
fivem-player-finder/
├── config/
│   └── servers.json
├── data/
├── src/
│   ├── cache.js
│   ├── config.js
│   ├── discord.js
│   ├── fivem.js
│   └── index.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```
