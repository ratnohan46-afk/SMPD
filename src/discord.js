import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  EmbedBuilder
} from "discord.js";
import { findPlayers } from "./fivem.js";

export const commands = [
  new SlashCommandBuilder()
    .setName("find")
    .setDescription("Cari player FiveM yang sedang online")
    .addStringOption((o) =>
      o
        .setName("nama")
        .setDescription("Nama atau sebagian nama player")
        .setRequired(true)
        .setMaxLength(100)
    ),
  new SlashCommandBuilder()
    .setName("finder-status")
    .setDescription("Lihat status index FiveM Finder")
].map((c) => c.toJSON());

export async function registerCommands(config) {
  const rest = new REST({ version: "10" }).setToken(config.token);
  const route = config.guildId
    ? Routes.applicationGuildCommands(config.clientId, config.guildId)
    : Routes.applicationCommands(config.clientId);

  await rest.put(route, { body: commands });
}

function trimField(text, max = 1000) {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 3)}...`;
}

export function createClient(config, state) {
  const client = new Client({
    intents: [GatewayIntentBits.Guilds]
  });

  client.once("ready", () => {
    console.log(`Discord login: ${client.user.tag}`);
  });

  client.on("interactionCreate", async (interaction) => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === "finder-status") {
      const updated = state.updatedAt
        ? `<t:${Math.floor(new Date(state.updatedAt).getTime() / 1000)}:R>`
        : "belum pernah";

      const embed = new EmbedBuilder()
        .setTitle("🔎 FiveM Player Finder")
        .setDescription(
          `Mode: **${config.searchMode}**\n` +
          `Server terindex: **${state.servers.length}**\n` +
          `Update terakhir: ${updated}`
        );

      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (interaction.commandName === "find") {
      const term = interaction.options.getString("nama", true).trim();

      await interaction.deferReply();

      const matches = findPlayers(state.servers, term);

      if (!matches.length) {
        const embed = new EmbedBuilder()
          .setTitle(`🎯 "${term}"`)
          .setDescription(
            "Tidak ditemukan player yang cocok pada data online terakhir."
          )
          .setFooter({
            text: `FiveM Player Finder • ${state.servers.length} server diperiksa`
          });

        await interaction.editReply({ embeds: [embed] });
        return;
      }

      const shown = matches.slice(0, config.maxResults);
      const groups = new Map();

      for (const m of shown) {
        if (!groups.has(m.serverName)) groups.set(m.serverName, []);
        groups.get(m.serverName).push(m);
      }

      const description = [];
      for (const [serverName, players] of groups) {
        description.push(`**${serverName}** — ${players.length} ditemukan`);

        for (const p of players) {
          const ping = Number.isFinite(p.ping) ? `${p.ping}ms` : "?ms";
          description.push(`• \`${p.playerId}\` ${p.playerName} — ${ping}`);
        }

        description.push("");
      }

      const embed = new EmbedBuilder()
        .setTitle(`🎯 "${term}" — ${matches.length} ditemukan di ${groups.size} server`)
        .setDescription(trimField(description.join("\n"), 4000))
        .setFooter({
          text:
            matches.length > shown.length
              ? `Menampilkan ${shown.length}/${matches.length} hasil • Gunakan kata pencarian lebih spesifik`
              : `FiveM Player Finder • ${state.servers.length} server diperiksa`
        });

      await interaction.editReply({ embeds: [embed] });
    }
  });

  return client;
}
