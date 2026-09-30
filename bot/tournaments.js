// ==================== TOURNAMENTS ====================
// Single-elimination tournaments with sign-ups, check-in + waitlist, seeded
// brackets, private referee-run match rooms, live score posts, predictions,
// champion roles and cards, and optional 2v2 teams.
//
// Everything is stored in db.tournaments / db.tournamentStats (tierbot.json),
// and a 30-second scheduler drives the timed steps, so a restart never loses
// a tournament - it just picks up where it left off.

const path = require('path');
const {
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, ModalBuilder, TextInputBuilder,
    TextInputStyle, StringSelectMenuBuilder, RoleSelectMenuBuilder, UserSelectMenuBuilder,
    PermissionsBitField, AttachmentBuilder
} = require('discord.js');

// Public channels live under one category so tournaments don't clutter the server.
// /tournament setup creates them all. Rename here if you want different names.
const TOURNAMENT_CATEGORY = '🏆 TOURNAMENTS';
const CHANNELS = {
    signups: '📢・tournament-signups',
    brackets: '🗂・brackets',
    results: '📜・match-results',
    live: '🔴・live-matches',
    champions: '👑・champions',
    chat: '💬・tournament-chat'
};
const LEGACY_CHANNEL = '🏆・tournaments'; // older single-channel setup still works as a fallback
const MATCH_CATEGORY = '🏆 TOURNAMENT MATCHES';
const HOST_ROLE = 'Tournament Host';
const REFEREE_ROLE = 'Referee';
const PING_ROLE = 'Tournament Ping';
const ORACLE_ROLE = '🔮 Oracle';
const ORACLE_DAYS = 7;
const NO_SHOW_MINUTES = 10;
const ROOM_CLOSE_DELAY_MS = 60 * 1000;
const TICK_MS = 30 * 1000;
// Everyone SEES tournament times in their own timezone (Discord timestamps).
// Hosts TYPE times in their own timezone, set once with /tournament timezone;
// this is only the default for hosts who haven't set one.
const DEFAULT_TZ = process.env.TOURNAMENT_TIMEZONE || 'Asia/Kolkata';

// Choices for /tournament timezone (Discord allows 25).
const TIMEZONE_CHOICES = [
    ['India (IST)', 'Asia/Kolkata'], ['Pakistan (PKT)', 'Asia/Karachi'], ['Bangladesh', 'Asia/Dhaka'], ['Nepal', 'Asia/Kathmandu'],
    ['UAE / Oman', 'Asia/Dubai'], ['Saudi / Qatar / Kuwait', 'Asia/Riyadh'], ['Turkey', 'Europe/Istanbul'], ['Russia (Moscow)', 'Europe/Moscow'],
    ['EU Central (DE, FR, NL, PL, IT, ES)', 'Europe/Berlin'], ['EU East (GR, RO, FI, UA)', 'Europe/Athens'], ['UK / Ireland / Portugal', 'Europe/London'],
    ['Egypt', 'Africa/Cairo'], ['South Africa', 'Africa/Johannesburg'], ['Thailand / Vietnam / Indonesia (WIB)', 'Asia/Bangkok'],
    ['Singapore / Malaysia / Philippines', 'Asia/Singapore'], ['Japan / Korea', 'Asia/Tokyo'], ['Australia East', 'Australia/Sydney'],
    ['New Zealand', 'Pacific/Auckland'], ['US East', 'America/New_York'], ['US Central', 'America/Chicago'], ['US Mountain', 'America/Denver'],
    ['US West', 'America/Los_Angeles'], ['Mexico', 'America/Mexico_City'], ['Brazil', 'America/Sao_Paulo'], ['UTC', 'UTC']
];
// Short names hosts can add after a time, e.g. "26/09 18:00 CET".
const ZONE_ABBR = {
    IST: 'Asia/Kolkata', PKT: 'Asia/Karachi', NPT: 'Asia/Kathmandu', GST: 'Asia/Dubai', UAE: 'Asia/Dubai', KSA: 'Asia/Riyadh', TRT: 'Europe/Istanbul',
    MSK: 'Europe/Moscow', CET: 'Europe/Berlin', CEST: 'Europe/Berlin', EET: 'Europe/Athens', EEST: 'Europe/Athens', WET: 'Europe/London',
    GMT: 'UTC', UTC: 'UTC', UK: 'Europe/London', SGT: 'Asia/Singapore', PHT: 'Asia/Singapore', MYT: 'Asia/Singapore', WIB: 'Asia/Jakarta',
    ICT: 'Asia/Bangkok', JST: 'Asia/Tokyo', KST: 'Asia/Seoul', AEST: 'Australia/Sydney', AEDT: 'Australia/Sydney', NZT: 'Pacific/Auckland',
    EST: 'America/New_York', EDT: 'America/New_York', ET: 'America/New_York', CST: 'America/Chicago', CDT: 'America/Chicago', CT: 'America/Chicago',
    MST: 'America/Denver', MDT: 'America/Denver', PST: 'America/Los_Angeles', PDT: 'America/Los_Angeles', PT: 'America/Los_Angeles', BRT: 'America/Sao_Paulo'
};
// Shown on every card so players can compare and hosts can pick a fair time.
const WORLD_CLOCK = [
    ['🇮🇳 India', 'Asia/Kolkata'], ['🇵🇰 Pakistan', 'Asia/Karachi'], ['🇦🇪 Gulf', 'Asia/Dubai'], ['🇸🇬 SE Asia', 'Asia/Singapore'],
    ['🇪🇺 EU', 'Europe/Berlin'], ['🇬🇧 UK', 'Europe/London'], ['🇺🇸 US East', 'America/New_York'], ['🇺🇸 US West', 'America/Los_Angeles'],
    ['🇧🇷 Brazil', 'America/Sao_Paulo']
];

const championRoleName = gm => `👑 Best in ${gm}`;
const ts = (ms, style = 'F') => `<t:${Math.floor(ms / 1000)}:${style}>`;
const trunc = (s, n) => (s.length > n ? s.slice(0, n - 1) + '…' : s);
const slug = s => (s || 'x').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 20) || 'x';

module.exports = function createTournaments(deps) {
    const {
        client, getDb, saveData, GAMEMODE_ORDER, RANK_ORDER, DISPLAY_ORDER, getGamemodeSymbol,
        isStaffMember, LOG_CHANNEL, BOT_NAME, getSkinHeadUrl, getSkinBodyUrl
    } = deps;

    // ---------- storage ----------
    function store() {
        const db = getDb();
        if (!db.tournaments) db.tournaments = {};
        const s = db.tournaments;
        s.list ??= {}; s.templates ??= {}; s.counter ??= 0; s.champions ??= {}; s.oracle ??= null;
        return s;
    }
    function stats(uid) {
        const db = getDb();
        db.tournamentStats ??= {};
        return (db.tournamentStats[uid] ??= { played: 0, won: 0, finals: 0, matchWins: 0, matchLosses: 0, predictionsCorrect: 0, titles: [] });
    }
    const players = () => getDb().players;
    const activeList = () => Object.values(store().list).filter(t => ['draft', 'signup', 'checkin', 'running'].includes(t.status));

    function defaultConfig() {
        return {
            name: '', gamemode: 'Sword', server: null, region: 'Any', size: 16, teamSize: 1,
            bestOf: 3, finalBestOf: 5, signupCloseAt: null, startAt: null, checkinMinutes: 30,
            tierMin: null, tierMax: null, rules: '', refereeRoleId: null, stream: '', tz: null
        };
    }

    // ---------- time zones ----------
    // A zone is an IANA name ("Europe/Berlin", DST handled by Node) or a fixed
    // offset like "UTC+05:30".
    function resolveZone(input) {
        if (!input) return null;
        const v = input.trim();
        const up = v.toUpperCase();
        if (ZONE_ABBR[up]) return ZONE_ABBR[up];
        const off = up.match(/^(?:UTC|GMT)?\s*([+-])(\d{1,2})(?::?(\d{2}))?$/);
        if (off && Number(off[2]) <= 14) return `UTC${off[1]}${off[2].padStart(2, '0')}:${off[3] || '00'}`;
        try { new Intl.DateTimeFormat('en-US', { timeZone: v }); return v; } catch { return null; }
    }
    function zoneOffsetMin(zone, utcMs) {
        const fixed = zone.match(/^UTC([+-])(\d{2}):(\d{2})$/);
        if (fixed) return (fixed[1] === '-' ? -1 : 1) * (Number(fixed[2]) * 60 + Number(fixed[3]));
        const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
            timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit'
        }).formatToParts(new Date(utcMs)).map(x => [x.type, x.value]));
        const asUtc = Date.UTC(+parts.year, parts.month - 1, +parts.day, +parts.hour % 24, +parts.minute, +parts.second);
        return Math.round((asUtc - Math.floor(utcMs / 1000) * 1000) / 6e4);
    }
    // Wall-clock time in a zone -> real moment (handles daylight saving).
    function wallToUtc(y, mo, d, h, mi, zone) {
        const guess = Date.UTC(y, mo, d, h, mi);
        let utc = guess - zoneOffsetMin(zone, guess) * 6e4;
        const again = guess - zoneOffsetMin(zone, utc) * 6e4;
        if (again !== utc) utc = again;
        return utc;
    }
    function wallParts(ms, zone) {
        const d = new Date(ms + zoneOffsetMin(zone, ms) * 6e4);
        return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay() };
    }
    function zoneLabel(zone) {
        const abbr = Object.entries(ZONE_ABBR).find(([, z]) => z === zone)?.[0];
        if (abbr && !['UK', 'ET', 'CT', 'PT', 'GMT', 'UAE', 'KSA'].includes(abbr)) return abbr;
        const choice = TIMEZONE_CHOICES.find(([, z]) => z === zone)?.[0];
        return choice || zone;
    }
    const hostZone = uid => store().hostTz?.[uid] || resolveZone(DEFAULT_TZ) || 'Asia/Kolkata';

    // Accepts "in 2h", "1d 4h", "2026-09-26 18:00", "26/09 18:00", "26/09/2026 18:00",
    // "18:00", any of those followed by a zone ("18:00 CET", "18:00 UTC+1"),
    // or a Discord timestamp like <t:1790000000:F>.
    function parseTime(input, zone, now = Date.now()) {
        if (!input) return null;
        let t = input.trim();
        const stamp = t.match(/^<t:(\d{9,11})(?::[a-zA-Z])?>$/) || t.match(/^(\d{10})$/);
        if (stamp) return Number(stamp[1]) * 1000;
        t = t.toLowerCase();
        const rel = t.replace(/^in\s+/, '');
        if (/^(\d+\s*[dhm]\s*)+$/.test(rel)) {
            let ms = 0;
            for (const [, n, u] of rel.matchAll(/(\d+)\s*([dhm])/g)) ms += Number(n) * { d: 864e5, h: 36e5, m: 6e4 }[u];
            return now + ms;
        }
        const suffix = t.match(/^(.*\d)\s+([a-z_/+\-:0-9]+)$/i);
        if (suffix && !/^\d{1,2}:\d{2}$/.test(suffix[2])) {
            const z = resolveZone(suffix[2]);
            if (!z) return null;
            zone = z; t = suffix[1].trim();
        }
        const today = wallParts(now, zone);
        let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ t](\d{1,2}):(\d{2})$/);
        if (m) return wallToUtc(+m[1], m[2] - 1, +m[3], +m[4], +m[5], zone);
        m = t.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\s+(\d{1,2}):(\d{2})$/);
        if (m) {
            let when = wallToUtc(m[3] ? +m[3] : today.y, m[2] - 1, +m[1], +m[4], +m[5], zone);
            if (!m[3] && when < now) when = wallToUtc(today.y + 1, m[2] - 1, +m[1], +m[4], +m[5], zone);
            return when;
        }
        m = t.match(/^(\d{1,2}):(\d{2})$/);
        if (m) {
            let when = wallToUtc(today.y, today.mo, today.d, +m[1], +m[2], zone);
            if (when < now) when = wallToUtc(today.y, today.mo, today.d + 1, +m[1], +m[2], zone);
            return when;
        }
        return null;
    }
    function formatLocal(ms, zone) {
        if (!ms) return '';
        const w = wallParts(ms, zone);
        const p = n => String(n).padStart(2, '0');
        return `${w.y}-${p(w.mo + 1)}-${p(w.d)} ${p(w.h)}:${p(w.mi)}`;
    }
    // "🇮🇳 India 18:00 Fri · 🇪🇺 EU 14:30 Fri · ..." plus who gets a night-time start.
    function worldClock(ms) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const p = n => String(n).padStart(2, '0');
        const night = [];
        const parts = WORLD_CLOCK.map(([label, zone]) => {
            const w = wallParts(ms, zone);
            if (w.h >= 0 && w.h < 7) night.push(label);
            return `${label} **${p(w.h)}:${p(w.mi)}** ${days[w.wd]}`;
        });
        return { text: parts.join('\n'), night };
    }

    // ---------- permissions ----------
    const hasRoleNamed = (member, name) => !!member?.roles?.cache?.some(r => r.name === name);
    const canHost = member => isStaffMember(member) || hasRoleNamed(member, HOST_ROLE);
    const canManage = (member, t) => isStaffMember(member) || member?.id === t.hostId || member?.user?.id === t.hostId;

    // ---------- entries ----------
    function rankOf(uid, gm) { return players()[uid]?.gamemodeRanks?.[gm] || null; }
    function entryName(t, id) { return id ? (t.entries[id]?.name || 'Unknown') : 'TBD'; }
    function entryMembers(t, id) { return t.entries[id]?.members || []; }
    function seedValue(t, id) {
        const vals = entryMembers(t, id).map(uid => {
            const r = rankOf(uid, t.config.gamemode);
            const i = r ? DISPLAY_ORDER.indexOf(r) : -1;
            return i === -1 ? 99 : i;
        });
        return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 99;
    }
    function entryTier(t, id) {
        const ranks = entryMembers(t, id).map(uid => rankOf(uid, t.config.gamemode) || '—');
        return ranks.join('/');
    }
    function findEntryOf(t, uid) {
        return Object.values(t.entries).find(e => e.members.includes(uid) || e.pendingPartner === uid) || null;
    }
    function tierAllowed(t, uid) {
        const { tierMin, tierMax, gamemode } = t.config;
        if (!tierMin && !tierMax) return true;
        const r = rankOf(uid, gamemode);
        if (!r) return !tierMin;
        const i = RANK_ORDER.indexOf(r);
        if (tierMin && i < RANK_ORDER.indexOf(tierMin)) return false;
        if (tierMax && i > RANK_ORDER.indexOf(tierMax)) return false;
        return true;
    }
    function tierLimitText(c) {
        if (!c.tierMin && !c.tierMax) return 'Any tier';
        if (c.tierMin && c.tierMax) return `${c.tierMin} – ${c.tierMax}`;
        return c.tierMin ? `${c.tierMin} or higher` : `${c.tierMax} or lower`;
    }
    function parseTierLimit(input) {
        const v = (input || '').trim().toUpperCase();
        if (!v || v === 'ANY') return { tierMin: null, tierMax: null };
        const parts = v.split(/\s*[-–]\s*/);
        const ok = parts.every(p => RANK_ORDER.includes(p));
        if (!ok || parts.length > 2) return null;
        if (parts.length === 1) return { tierMin: parts[0], tierMax: null };
        let [a, b] = parts;
        if (RANK_ORDER.indexOf(a) > RANK_ORDER.indexOf(b)) [a, b] = [b, a];
        return { tierMin: a, tierMax: b };
    }

    // ---------- helpers ----------
    async function dm(userId, payload) {
        const u = await client.users.fetch(userId).catch(() => null);
        if (!u) return false;
        return u.send(payload).then(() => true).catch(() => false);
    }
    const guildOf = t => client.guilds.cache.get(t.guildId);
    // Finds the channel for a kind of post, falling back to the sign-up channel
    // (or the old single #🏆・tournaments channel) if it doesn't exist.
    function tChannel(guild, key) {
        if (!guild) return null;
        const byName = name => guild.channels.cache.find(c => c.name === name && c.type === 0);
        // Results fall back to the live channel rather than cluttering sign-ups.
        const extra = key === 'results' ? [byName(CHANNELS.live)] : [];
        return byName(CHANNELS[key]) || extra.find(Boolean) || byName(CHANNELS.signups) || byName(LEGACY_CHANNEL) || null;
    }
    const channelUrl = (t, channelId) => `https://discord.com/channels/${t.guildId}/${channelId}`;
    function resolveTournament(interaction, idOpt) {
        const s = store();
        if (idOpt) return s.list[idOpt.toUpperCase()] || null;
        const act = activeList();
        return act.length === 1 ? act[0] : null;
    }
    async function findOrCreateRole(guild, name, opts = {}) {
        return guild.roles.cache.find(r => r.name === name)
            || guild.roles.create({ name, reason: 'Tournament system', ...opts }).catch(() => null);
    }
    function formatText(c) {
        const team = c.teamSize === 2 ? '2v2 teams · ' : '';
        return `${team}Single elim · BO${c.bestOf}${c.finalBestOf !== c.bestOf ? ` · final BO${c.finalBestOf}` : ''}`;
    }
    function bar(n, max, width = 16) {
        const filled = Math.max(0, Math.min(width, Math.round((n / Math.max(1, max)) * width)));
        return '█'.repeat(filled) + '░'.repeat(width - filled);
    }
    const unit = t => (t.config.teamSize === 2 ? 'teams' : 'players');

    // ---------- setup panel (draft) ----------
    function setupPanel(t) {
        const c = t.config;
        const embed = new EmbedBuilder()
            .setColor(0x5865F2)
            .setAuthor({ name: t.status === 'draft' ? '🛠 TOURNAMENT SETUP · draft' : `🛠 EDITING · ${t.status}` })
            .setTitle(c.name || 'Unnamed tournament')
            .addFields(
                { name: '🎮 Gamemode', value: `${getGamemodeSymbol(c.gamemode)} ${c.gamemode}`, inline: true },
                { name: '🌐 Server', value: c.server || '*not set*', inline: true },
                { name: '🌍 Region', value: c.region || 'Any', inline: true },
                { name: '👥 Size', value: `${c.size} ${unit(t)}`, inline: true },
                { name: '⚔️ Format', value: formatText(c), inline: true },
                { name: '🏅 Tier limit', value: tierLimitText(c), inline: true },
                { name: '📝 Sign-ups close', value: c.signupCloseAt ? `${ts(c.signupCloseAt)}\n${ts(c.signupCloseAt, 'R')}` : '*not set*', inline: true },
                { name: '🗓 Starts', value: c.startAt ? `${ts(c.startAt)}\n${ts(c.startAt, 'R')}` : '*not set*', inline: true },
                { name: '✅ Check-in', value: c.checkinMinutes ? `${c.checkinMinutes} min before` : 'Off', inline: true },
                { name: '🧑‍⚖️ Referees', value: c.refereeRoleId ? `<@&${c.refereeRoleId}>` : `@${REFEREE_ROLE} role`, inline: true },
                { name: '👑 Prize', value: championRoleName(c.gamemode).replace('👑 ', ''), inline: true },
                { name: '📺 Stream', value: c.stream || '—', inline: true },
                { name: '📜 Rules', value: trunc(c.rules || '*none*', 1000), inline: false }
            )
            .setFooter({ text: `ID ${t.id} · Times you type are read as ${zoneLabel(c.tz || hostZone(t.hostId))} (change: /tournament timezone) · Only you can see this` });
        if (c.startAt) {
            const wc = worldClock(c.startAt);
            embed.addFields({ name: '🌍 Start time around the world', value: wc.text, inline: false });
            if (wc.night.length) embed.addFields({ name: '⚠️ Night-time start for', value: `${wc.night.join(', ')}. Players there may miss it. Consider a region tournament or a different time.`, inline: false });
        }

        const gmSelect = new StringSelectMenuBuilder().setCustomId(`tn:cfg:${t.id}:gamemode`).setPlaceholder('Gamemode')
            .addOptions(GAMEMODE_ORDER.map(g => ({ label: `Gamemode: ${g}`, value: g, default: g === c.gamemode })));
        const servers = (getDb().testServers || []).slice(0, 24);
        const serverOpts = servers.map((sv, i) => ({ label: trunc(`Server: ${sv.ip}:${sv.port}`, 100), value: `s${i}`, default: c.server === `${sv.ip}:${sv.port}` }));
        serverOpts.push({ label: 'Other server (set in ⚙️ More settings)', value: 'custom', default: !!c.server && !servers.some(sv => c.server === `${sv.ip}:${sv.port}`) });
        const serverSelect = new StringSelectMenuBuilder().setCustomId(`tn:cfg:${t.id}:server`).setPlaceholder('🌐 Server').addOptions(serverOpts);
        const formatOpts = [];
        for (const team of [1, 2]) for (const size of [8, 16, 32, 64]) {
            formatOpts.push({ label: `${size} ${team === 2 ? 'teams · 2v2' : 'players · 1v1'}`, value: `${size}:${team}`, default: c.size === size && c.teamSize === team });
        }
        const formatSelect = new StringSelectMenuBuilder().setCustomId(`tn:cfg:${t.id}:format`).setPlaceholder('👥 Size').addOptions(formatOpts);
        const refSelect = new RoleSelectMenuBuilder().setCustomId(`tn:cfg:${t.id}:referee`).setPlaceholder('🧑‍⚖️ Referee role (default: @Referee)').setMinValues(0).setMaxValues(1);
        const buttons = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tn:cfg:${t.id}:details`).setLabel('Name, times & rules').setEmoji('✏️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`tn:cfg:${t.id}:more`).setLabel('More settings').setEmoji('⚙️').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`tn:cfg:${t.id}:preview`).setLabel('Preview card').setEmoji('👁').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`tn:cfg:${t.id}:template`).setLabel('Save as template').setEmoji('💾').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`tn:cfg:${t.id}:publish`).setLabel(t.status === 'draft' ? 'Publish' : 'Save changes').setEmoji('📢').setStyle(ButtonStyle.Success)
        );
        return {
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(gmSelect),
                new ActionRowBuilder().addComponents(serverSelect),
                new ActionRowBuilder().addComponents(formatSelect),
                new ActionRowBuilder().addComponents(refSelect),
                buttons
            ]
        };
    }

    function detailsModal(t) {
        const c = t.config;
        return new ModalBuilder().setCustomId(`tn:mod:${t.id}:details`).setTitle('Name, times & rules').addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('name').setLabel('Tournament name').setStyle(TextInputStyle.Short).setMaxLength(60).setRequired(true).setValue(c.name || '')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('close').setLabel(trunc(`Sign-ups close (your time: ${zoneLabel(c.tz || hostZone(t.hostId))})`, 45)).setPlaceholder('e.g. 25/09 21:00, 2026-09-25 21:00, in 1d, 21:00 CET').setStyle(TextInputStyle.Short).setRequired(true).setValue(formatLocal(c.signupCloseAt, c.tz || hostZone(t.hostId)))),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('start').setLabel(trunc(`Starts (your time: ${zoneLabel(c.tz || hostZone(t.hostId))})`, 45)).setPlaceholder('e.g. 26/09 18:00, 18:00, in 2d, 18:00 UTC+1').setStyle(TextInputStyle.Short).setRequired(true).setValue(formatLocal(c.startAt, c.tz || hostZone(t.hostId)))),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('bestof').setLabel('Best of: matches / final (e.g. 3/5)').setStyle(TextInputStyle.Short).setRequired(true).setValue(`${c.bestOf}/${c.finalBestOf}`)),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rules').setLabel('Rules').setStyle(TextInputStyle.Paragraph).setMaxLength(1000).setRequired(false).setValue(c.rules || ''))
        );
    }
    function moreModal(t) {
        const c = t.config;
        return new ModalBuilder().setCustomId(`tn:mod:${t.id}:more`).setTitle('More settings').addComponents(
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('server').setLabel('Server name / IP (e.g. Tidal · play.tidal.gg)').setStyle(TextInputStyle.Short).setMaxLength(80).setRequired(false).setValue(c.server || '')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('region').setLabel('Region').setStyle(TextInputStyle.Short).setMaxLength(30).setRequired(false).setValue(c.region || 'Any')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tier').setLabel('Tier limit: "any", "LT3" (or higher), "LT4-HT2"').setStyle(TextInputStyle.Short).setRequired(false).setValue(c.tierMin || c.tierMax ? [c.tierMin, c.tierMax].filter(Boolean).join('-') : 'any')),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('checkin').setLabel('Check-in minutes before start (0 = off)').setStyle(TextInputStyle.Short).setRequired(false).setValue(String(c.checkinMinutes))),
            new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('stream').setLabel('Stream link (optional)').setStyle(TextInputStyle.Short).setMaxLength(100).setRequired(false).setValue(c.stream || ''))
        );
    }

    function validateConfig(t) {
        const c = t.config;
        if (!c.name) return 'Set a name first (✏️ Name, times & rules).';
        if (!c.signupCloseAt || !c.startAt) return 'Set the sign-up close time and the start time.';
        if (c.signupCloseAt > c.startAt) return 'Sign-ups must close before (or when) the tournament starts.';
        if (c.startAt < Date.now()) return 'The start time is in the past.';
        if (t.slots.length > c.size) return `There are already ${t.slots.length} ${unit(t)} signed up - the size can't be smaller than that.`;
        return null;
    }

    // ---------- public posts ----------
    function statusLabel(t) {
        const now = Date.now();
        switch (t.status) {
            case 'signup': return now >= t.config.signupCloseAt ? '🔒 SIGN-UPS CLOSED' : '📝 SIGN-UPS OPEN';
            case 'checkin': return '✅ CHECK-IN OPEN';
            case 'running': return '🔴 LIVE';
            case 'finished': return '🏁 FINISHED';
            case 'cancelled': return '❌ CANCELLED';
            default: return '🛠 DRAFT';
        }
    }
    function announcementEmbed(t) {
        const c = t.config;
        const host = players()[t.hostId];
        const embed = new EmbedBuilder()
            .setColor(t.status === 'cancelled' ? 0xE74C3C : 0xFFD700)
            .setAuthor({ name: `${statusLabel(t)} · ${c.gamemode.toUpperCase()}${c.region && c.region !== 'Any' ? ` · ${c.region}` : ''}` })
            .setTitle(`${getGamemodeSymbol(c.gamemode)} ${c.name}`)
            .setDescription(t.status === 'finished' && t.championEntry
                ? `👑 **${entryName(t, t.championEntry)}** won and is **Best in ${c.gamemode}**!`
                : t.status === 'cancelled'
                    ? `This tournament was cancelled.${t.cancelReason ? ` Reason: ${t.cancelReason}` : ''}`
                    : `Winner gets the **${championRoleName(c.gamemode)}** title until the next ${c.gamemode} cup.`)
            .addFields(
                { name: '🗓 Starts', value: `${ts(c.startAt)}\n${ts(c.startAt, 'R')}`, inline: true },
                { name: '⏳ Sign-ups close', value: Date.now() >= c.signupCloseAt ? 'Closed' : ts(c.signupCloseAt, 'R'), inline: true },
                { name: '🌐 Server', value: c.server || 'Announced in your match room', inline: true },
                { name: '⚔️ Format', value: formatText(c), inline: true },
                { name: '🏅 Tier limit', value: tierLimitText(c), inline: true },
                { name: '✅ Check-in', value: c.checkinMinutes ? `${c.checkinMinutes} min before start` : 'Not needed', inline: true },
                { name: `👥 ${t.config.teamSize === 2 ? 'Teams' : 'Players'} ${t.slots.length}/${c.size}${t.waitlist.length ? ` · waitlist ${t.waitlist.length}` : ''}`, value: `\`${bar(t.slots.length, c.size)}\``, inline: false }
            )
            .setFooter({ text: `Hosted by ${host?.username || 'staff'} · ID ${t.id} · The times above show in YOUR timezone` })
            .setTimestamp();
        const hostHead = getSkinHeadUrl(host);
        if (hostHead) embed.setThumbnail(hostHead);
        if (t.status === 'signup' || t.status === 'checkin' || t.status === 'draft') {
            embed.addFields({ name: '🌍 Start time around the world', value: worldClock(c.startAt).text, inline: false });
        }
        if (c.stream) embed.addFields({ name: '📺 Stream', value: c.stream, inline: false });
        const follow = [t.bracketMsg && `🗂 <#${t.bracketMsg.channelId}>`, t.liveMsg && `🔴 <#${t.liveMsg.channelId}>`].filter(Boolean);
        if (follow.length && t.status === 'running') embed.addFields({ name: 'Follow along', value: [...new Set(follow)].join(' · '), inline: false });
        return embed;
    }
    function announcementComponents(t) {
        if (t.status === 'finished' || t.status === 'cancelled') {
            return [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tn:players:${t.id}`).setLabel('Players').setEmoji('👥').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId(`tn:bracket:${t.id}`).setLabel('Bracket').setEmoji('🗂').setStyle(ButtonStyle.Secondary).setDisabled(!t.rounds)
            )];
        }
        const open = t.status === 'signup' && Date.now() < t.config.signupCloseAt;
        const full = t.slots.length >= t.config.size;
        const row = new ActionRowBuilder();
        if (t.status === 'running') {
            row.addComponents(
                new ButtonBuilder().setCustomId(`tn:predict:${t.id}`).setLabel('Predict winner').setEmoji('🔮').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`tn:bracket:${t.id}`).setLabel('Bracket').setEmoji('🗂').setStyle(ButtonStyle.Secondary)
            );
        } else {
            row.addComponents(
                new ButtonBuilder().setCustomId(`tn:join:${t.id}`).setLabel(full ? 'Join waitlist' : 'Join').setEmoji(full ? '⏳' : '✅').setStyle(ButtonStyle.Success).setDisabled(!open),
                new ButtonBuilder().setCustomId(`tn:leave:${t.id}`).setLabel('Leave').setEmoji('🚪').setStyle(ButtonStyle.Danger)
            );
        }
        row.addComponents(
            new ButtonBuilder().setCustomId(`tn:players:${t.id}`).setLabel('Players').setEmoji('👥').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`tn:rules:${t.id}`).setLabel('Rules').setEmoji('📜').setStyle(ButtonStyle.Secondary)
        );
        return [row];
    }
    async function fetchMessage(t, ref) {
        if (!ref) return null;
        const ch = guildOf(t)?.channels.cache.get(ref.channelId);
        return ch ? ch.messages.fetch(ref.messageId).catch(() => null) : null;
    }
    async function updateAnnouncement(t) {
        const msg = await fetchMessage(t, t.announce);
        if (msg) await msg.edit({ embeds: [announcementEmbed(t)], components: announcementComponents(t) }).catch(() => {});
    }

    // ---------- bracket ----------
    function seedOrder(n) {
        let order = [1];
        while (order.length < n) {
            const m = order.length * 2 + 1;
            order = order.flatMap(s => [s, m - s]);
        }
        return order;
    }
    function roundName(t, r) {
        const n = t.rounds[r].length;
        if (n === 1) return 'Final';
        if (n === 2) return 'Semifinals';
        if (n === 4) return 'Quarterfinals';
        return `Round of ${n * 2}`;
    }
    function matchLabel(t, m) {
        const n = t.rounds[m.round].length;
        if (n === 1) return 'Final';
        const short = n === 2 ? 'SF' : n === 4 ? 'QF' : `R${n * 2}-`;
        return `${short}${m.index + 1}`;
    }
    const neededWins = m => Math.ceil(m.bestOf / 2);
    function findMatch(t, mid) {
        for (const round of t.rounds || []) for (const m of round) if (m.id === mid) return m;
        return null;
    }
    const allMatches = t => (t.rounds || []).flat();

    function buildBracket(t, participants) {
        const shuffled = [...participants].sort(() => Math.random() - 0.5);
        const sorted = shuffled.sort((a, b) => seedValue(t, a) - seedValue(t, b));
        t.seeds = Object.fromEntries(sorted.map((id, i) => [id, i + 1]));
        let size = 2;
        while (size < sorted.length) size *= 2;
        const slots = seedOrder(size).map(s => sorted[s - 1] ?? null);
        const roundsCount = Math.log2(size);
        t.rounds = [];
        for (let r = 0; r < roundsCount; r++) {
            const count = size / 2 ** (r + 1);
            const bo = r === roundsCount - 1 ? t.config.finalBestOf : t.config.bestOf;
            t.rounds.push(Array.from({ length: count }, (_, i) => ({
                id: `R${r + 1}M${i + 1}`, round: r, index: i, a: null, b: null, winsA: 0, winsB: 0, log: [],
                winner: null, status: 'waiting', result: '', channelId: null, refereeId: null, bestOf: bo
            })));
        }
        t.rounds[0].forEach((m, i) => { m.a = slots[i * 2]; m.b = slots[i * 2 + 1]; });
        for (const m of t.rounds[0]) {
            if (m.a && !m.b) { m.winner = m.a; m.status = 'done'; m.result = 'bye'; advance(t, m); }
            else if (!m.a && m.b) { m.winner = m.b; m.status = 'done'; m.result = 'bye'; advance(t, m); }
        }
    }
    function advance(t, m) {
        const next = t.rounds[m.round + 1]?.[Math.floor(m.index / 2)];
        if (!next) return;
        if (m.index % 2 === 0) next.a = m.winner; else next.b = m.winner;
    }

    function bracketText(t) {
        const lines = [];
        for (let r = 0; r < t.rounds.length; r++) {
            lines.push(roundName(t, r).toUpperCase());
            for (const m of t.rounds[r]) {
                if (m.result === 'bye') { lines.push(` ${matchLabel(t, m).padEnd(6)} ${entryName(t, m.winner)} (bye)`); continue; }
                const a = `${trunc(entryName(t, m.a), 16)}${m.a ? ` (${entryTier(t, m.a)})` : ''}`;
                const b = `${trunc(entryName(t, m.b), 16)}${m.b ? ` (${entryTier(t, m.b)})` : ''}`;
                let mid = 'vs';
                if (m.status === 'done') mid = m.result === `${m.winsA}–${m.winsB}` ? m.result : m.result.toUpperCase();
                else if (m.status === 'live') mid = `${m.winsA}–${m.winsB}`;
                const mark = m.status === 'done' ? ` ✅ ${trunc(entryName(t, m.winner), 16)}` : m.status === 'live' ? ' 🔴' : '';
                lines.push(` ${matchLabel(t, m).padEnd(6)} ${a}  ${mid}  ${b}${mark}`);
            }
            lines.push('');
        }
        return trunc(lines.join('\n'), 3900);
    }
    // ---------- bracket image ----------
    // A real tournament-style bracket: rounds as columns, lines showing where
    // winners go, losers crossed out, champion at the end. Needs
    // @napi-rs/canvas; without it the text bracket is used instead.
    let canvasLib = null;
    function getCanvas() {
        if (canvasLib === false) return null;
        if (!canvasLib) {
            try { canvasLib = require('@napi-rs/canvas'); } catch { canvasLib = false; return null; }
            // Bundled font, so text shows even on hosts with no fonts installed.
            try {
                canvasLib.GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'NotoSans-Regular.ttf'), 'MCB Sans');
                canvasLib.GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'NotoSans-Bold.ttf'), 'MCB Sans Bold');
            } catch (e) { console.error('[Tournament] Could not load bundled fonts:', e.message); }
        }
        return canvasLib;
    }
    const font = (size, bold) => `${size}px "${bold ? 'MCB Sans Bold' : 'MCB Sans'}", "DejaVu Sans", sans-serif`;
    const headCache = new Map();
    async function loadHead(url) {
        if (!url) return null;
        if (headCache.has(url)) return headCache.get(url);
        const img = await Promise.race([getCanvas().loadImage(url), new Promise(r => setTimeout(() => r(null), 4000))]).catch(() => null);
        headCache.set(url, img);
        return img;
    }
    function fitText(ctx, text, maxW) {
        if (ctx.measureText(text).width <= maxW) return text;
        let s = text;
        while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
        return s + '…';
    }
    function roundRect(ctx, x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
    }
    // Shown instead of "TBD" so players can see who they'll face next.
    function feederLabel(t, m, side) {
        if (m.round === 0) return m.result === 'bye' ? 'BYE' : 'TBD';
        const prev = t.rounds[m.round - 1][m.index * 2 + (side === 'a' ? 0 : 1)];
        return prev ? `Winner of ${matchLabel(t, prev)}` : 'TBD';
    }
    function sideScore(m, side) {
        const mine = side === 'a' ? m.winsA : m.winsB;
        if (m.status === 'live') return String(mine);
        if (m.status !== 'done' || m.result === 'bye') return '';
        const won = m.winner === m[side];
        if (/^\d+–\d+$/.test(m.result)) return String(mine);
        const short = { 'no-show': 'NS', DQ: 'DQ', forfeit: 'FF', removed: 'OUT', 'staff decision': '—' }[m.result] || '—';
        return won ? 'W' : short;
    }

    async function renderBracketImage(t, highlightEntry = null) {
        const C = getCanvas();
        if (!C || !t.rounds) return null;
        try {
            const R = t.rounds.length, M0 = t.rounds[0].length;
            const boxW = 270, rowH = 32, boxH = rowH * 2, gapX = 64, slot = boxH + 34, padX = 36, top = 178, champW = 250;
            const W = padX * 2 + R * (boxW + gapX) + champW;
            const H = top + M0 * slot + 50;
            const canvas = C.createCanvas(W, H);
            const ctx = canvas.getContext('2d');
            const bg = ctx.createLinearGradient(0, 0, W, H);
            bg.addColorStop(0, '#0e1016'); bg.addColorStop(1, '#171b26');
            ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);

            // header
            ctx.fillStyle = '#f0b232'; ctx.font = font(15, true);
            ctx.fillText(`${t.config.gamemode.toUpperCase()} TOURNAMENT · ${t.config.teamSize === 2 ? '2V2 · ' : ''}SINGLE ELIMINATION`, padX, 44);
            ctx.fillStyle = '#ffffff'; ctx.font = font(34, true);
            ctx.fillText(fitText(ctx, t.config.name, W - padX * 2 - 260), padX, 86);
            ctx.fillStyle = '#9aa0ae'; ctx.font = font(16);
            const status = t.status === 'finished' ? 'Finished' : t.status === 'cancelled' ? 'Cancelled' : 'Live';
            ctx.fillText(`${t.participants?.length || 0} ${unit(t)} · ${status}${t.config.server ? ` · ${t.config.server}` : ''}`, padX, 114);
            ctx.textAlign = 'right';
            ctx.fillText(`Updated ${new Date().toISOString().slice(11, 16)} UTC`, W - padX, 44);
            ctx.textAlign = 'left';

            const pos = (r, i) => ({ x: padX + r * (boxW + gapX), y: top + (i + 0.5) * slot * 2 ** r - boxH / 2 });
            const mine = m => highlightEntry && (m.a === highlightEntry || m.b === highlightEntry);

            // round titles
            for (let r = 0; r < R; r++) {
                const { x } = pos(r, 0);
                ctx.fillStyle = '#c9ccd6'; ctx.font = font(15, true);
                const title = roundName(t, r).toUpperCase();
                ctx.fillText(title, x, top - 30);
                const tw = ctx.measureText(title).width;
                ctx.fillStyle = '#6b7080'; ctx.font = font(13);
                ctx.fillText(`· Best of ${t.rounds[r][0].bestOf}`, x + tw + 8, top - 30);
            }
            ctx.fillStyle = '#f0b232'; ctx.font = font(15, true);
            ctx.fillText('CHAMPION', padX + R * (boxW + gapX), top - 30);

            // connectors (drawn first so boxes sit on top)
            for (let r = 0; r < R; r++) {
                for (const m of t.rounds[r]) {
                    const p = pos(r, m.index);
                    const fromX = p.x + boxW, fromY = p.y + boxH / 2;
                    let toX, toY;
                    if (r < R - 1) { const q = pos(r + 1, Math.floor(m.index / 2)); toX = q.x; toY = q.y + boxH / 2; }
                    else { toX = padX + R * (boxW + gapX); toY = fromY; }
                    const advanced = m.status === 'done' && m.winner;
                    ctx.strokeStyle = advanced ? (mine(m) && m.winner === highlightEntry ? '#7984f5' : '#f0b232') : '#343948';
                    ctx.lineWidth = advanced ? 3 : 2;
                    const midX = fromX + gapX / 2;
                    ctx.beginPath(); ctx.moveTo(fromX, fromY); ctx.lineTo(midX, fromY); ctx.lineTo(midX, toY); ctx.lineTo(toX, toY); ctx.stroke();
                }
            }

            // match boxes
            for (let r = 0; r < R; r++) {
                for (const m of t.rounds[r]) {
                    const { x, y } = pos(r, m.index);
                    ctx.fillStyle = '#6b7080'; ctx.font = font(12, true);
                    ctx.fillText(matchLabel(t, m), x + 2, y - 7);
                    if (m.status === 'live') { ctx.fillStyle = '#ed4245'; ctx.fillText('● LIVE', x + boxW - 52, y - 7); }
                    roundRect(ctx, x, y, boxW, boxH, 8);
                    ctx.fillStyle = mine(m) ? '#232845' : '#1d212d'; ctx.fill();
                    ctx.lineWidth = m.status === 'live' ? 2.5 : mine(m) ? 2.5 : 1.5;
                    ctx.strokeStyle = m.status === 'live' ? '#ed4245' : mine(m) ? '#5865f2' : '#2e3342'; ctx.stroke();
                    ctx.strokeStyle = '#2e3342'; ctx.lineWidth = 1;
                    ctx.beginPath(); ctx.moveTo(x + 1, y + rowH); ctx.lineTo(x + boxW - 1, y + rowH); ctx.stroke();

                    for (const side of ['a', 'b']) {
                        const id = m[side];
                        const ry = y + (side === 'a' ? 0 : rowH);
                        const won = m.status === 'done' && id && m.winner === id;
                        const lost = m.status === 'done' && id && m.winner !== id;
                        let tx = x + 10;
                        // seed
                        ctx.font = font(12, true); ctx.fillStyle = '#5c6170';
                        if (id && t.seeds?.[id]) ctx.fillText(String(t.seeds[id]), tx, ry + 21);
                        tx += 22;
                        // skin head
                        // skin head, or a blank tile so names always line up
                        const head = id ? await loadHead(getSkinHeadUrl(players()[entryMembers(t, id)[0]])) : null;
                        ctx.globalAlpha = lost ? 0.35 : 1;
                        if (head) ctx.drawImage(head, tx, ry + 6, 20, 20);
                        else { roundRect(ctx, tx, ry + 6, 20, 20, 4); ctx.fillStyle = id ? '#2e3342' : '#232735'; ctx.fill(); }
                        ctx.globalAlpha = 1;
                        tx += 28;
                        // name
                        const label = id ? entryName(t, id) : feederLabel(t, m, side);
                        ctx.font = id ? font(15, won || m.status !== 'done') : font(13);
                        ctx.fillStyle = !id ? '#5c6170' : lost ? '#6b7080' : id === highlightEntry ? '#9ba4ff' : won ? '#ffffff' : '#dfe1e7';
                        const scoreW = 36;
                        const shown = fitText(ctx, label, x + boxW - scoreW - tx - 6);
                        ctx.fillText(shown, tx, ry + 21);
                        if (lost) {
                            const w = ctx.measureText(shown).width;
                            ctx.strokeStyle = '#ed4245'; ctx.lineWidth = 2;
                            ctx.beginPath(); ctx.moveTo(tx - 2, ry + 16); ctx.lineTo(tx + w + 2, ry + 16); ctx.stroke();
                        }
                        // tier (solo only)
                        // score
                        const sc = id ? sideScore(m, side) : '';
                        if (sc) {
                            roundRect(ctx, x + boxW - scoreW, ry + (side === 'a' ? 0 : 0), scoreW, rowH, 0);
                            ctx.fillStyle = won ? '#1f7a45' : m.status === 'live' ? '#3a1d22' : '#262a36'; ctx.fill();
                            ctx.fillStyle = won ? '#ffffff' : m.status === 'live' ? '#ff8a8d' : '#8a8f9c';
                            ctx.font = font(15, true); ctx.textAlign = 'center';
                            ctx.fillText(sc, x + boxW - scoreW / 2, ry + 21);
                            ctx.textAlign = 'left';
                        }
                    }
                }
            }

            // champion box
            const final = t.rounds[R - 1][0];
            const fp = pos(R - 1, 0);
            const cx = padX + R * (boxW + gapX), cy = fp.y - 10;
            roundRect(ctx, cx, cy, champW - padX, boxH + 20, 10);
            ctx.fillStyle = t.championEntry ? '#2e2710' : '#1d212d'; ctx.fill();
            ctx.lineWidth = 2.5; ctx.strokeStyle = '#f0b232'; ctx.stroke();
            ctx.fillStyle = '#f0b232'; ctx.font = font(13, true);
            ctx.fillText(`👑 BEST IN ${t.config.gamemode.toUpperCase()}`.replace('👑 ', ''), cx + 14, cy + 26);
            ctx.fillStyle = t.championEntry ? '#ffffff' : '#5c6170'; ctx.font = font(t.championEntry ? 19 : 15, !!t.championEntry);
            ctx.fillText(fitText(ctx, t.championEntry ? entryName(t, t.championEntry) : `Winner of ${matchLabel(t, final)}`, champW - padX - 28), cx + 14, cy + 58);

            // legend
            ctx.font = font(13); ctx.fillStyle = '#6b7080';
            ctx.fillText('Seed number · ● LIVE = playing now · Crossed out = knocked out · Gold line = winner\'s path · NS no-show · DQ disqualified · FF forfeit', padX, H - 20);

            return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'bracket.png' });
        } catch (e) {
            console.error(`[Tournament ${t.id}] Bracket image failed:`, e.message);
            return null;
        }
    }

    function bracketEmbed(t, withImage = false) {
        const done = allMatches(t).filter(m => m.status === 'done' && m.result !== 'bye').length;
        const total = allMatches(t).filter(m => m.result !== 'bye').length;
        const embed = new EmbedBuilder().setColor(0x5865F2)
            .setTitle(`🗂 Bracket · ${t.config.name}`)
            .setFooter({ text: `${done}/${total} matches played · updates after every match` })
            .setTimestamp();
        if (!withImage) return embed.setDescription('```\n' + bracketText(t) + '\n```');
        const live = allMatches(t).filter(m => m.status === 'live').map(m => `🔴 **${matchLabel(t, m)}** ${entryName(t, m.a)} **${m.winsA}–${m.winsB}** ${entryName(t, m.b)}`);
        const champ = t.championEntry ? `👑 **${entryName(t, t.championEntry)}** won the tournament!` : null;
        return embed.setImage('attachment://bracket.png')
            .setDescription([champ, ...live, !champ ? 'Press **🗂 Bracket** to see your own path highlighted.' : null].filter(Boolean).join('\n') || '​');
    }
    async function postBracket(t, channel) {
        const img = await renderBracketImage(t);
        return channel.send({ embeds: [bracketEmbed(t, !!img)], files: img ? [img] : [], components: announcementComponents(t) }).catch(() => null);
    }
    // Re-drawing the image on every point would spam edits, so updates are
    // batched: at most one edit every few seconds per tournament.
    const bracketTimers = new Map();
    function updateBracket(t) {
        if (bracketTimers.has(t.id)) return Promise.resolve();
        bracketTimers.set(t.id, setTimeout(async () => {
            bracketTimers.delete(t.id);
            const msg = await fetchMessage(t, t.bracketMsg);
            if (!msg) return;
            const img = await renderBracketImage(t);
            await msg.edit({ embeds: [bracketEmbed(t, !!img)], files: img ? [img] : [], attachments: [], components: announcementComponents(t) }).catch(() => {});
        }, 3000));
        return Promise.resolve();
    }

    // ---------- predictions + live post ----------
    function predictionSplit(t, m) {
        const picks = Object.values(t.predictions?.[m.id] || {});
        if (!picks.length) return null;
        const a = picks.filter(p => p === m.a).length;
        const pa = Math.round((a / picks.length) * 100);
        return { pa, pb: 100 - pa, n: picks.length };
    }
    function liveEmbed(t) {
        const live = allMatches(t).filter(m => m.status === 'live');
        const next = allMatches(t).filter(m => m.status === 'waiting' && (m.a || m.b)).slice(0, 4);
        const lines = live.map(m => {
            const sp = predictionSplit(t, m);
            return `🔴 **${matchLabel(t, m)}** · ${entryName(t, m.a)} **${m.winsA} – ${m.winsB}** ${entryName(t, m.b)} · BO${m.bestOf}`
                + (sp ? `\n　🔮 Fans: ${sp.pa}% · ${sp.pb}% (${sp.n} picks)` : '');
        });
        const embed = new EmbedBuilder().setColor(0xE74C3C)
            .setAuthor({ name: t.status === 'running' ? '🔴 LIVE NOW' : statusLabel(t) })
            .setTitle(t.config.name)
            .setDescription(lines.join('\n') || (t.status === 'running' ? '*Waiting for the next match…*' : '*No live matches.*'))
            .setFooter({ text: 'Updates every round · Press 🔮 to predict before a match starts' })
            .setTimestamp();
        if (next.length) embed.addFields({ name: '⏭ Up next', value: next.map(m => `${matchLabel(t, m)} · ${entryName(t, m.a)} vs ${entryName(t, m.b)}`).join('\n') });
        const watch = [t.config.stream, t.config.server ? `spectate on ${t.config.server}` : null].filter(Boolean).join(' · ');
        if (watch) embed.addFields({ name: '📺 Watch', value: watch });
        return embed;
    }
    async function updateLive(t) {
        const msg = await fetchMessage(t, t.liveMsg);
        if (msg) await msg.edit({ embeds: [liveEmbed(t)], components: announcementComponents(t) }).catch(() => {});
    }
    const refreshPublic = t => Promise.all([updateAnnouncement(t), updateBracket(t), updateLive(t)]);

    // ---------- match rooms ----------
    async function getCategory(guild) {
        let cat = guild.channels.cache.find(c => c.name === MATCH_CATEGORY && c.type === 4);
        if (!cat) {
            cat = await guild.channels.create({
                name: MATCH_CATEGORY, type: 4,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels] }
                ]
            });
        }
        return cat;
    }
    function refereeRole(guild, t) {
        return (t.config.refereeRoleId && guild.roles.cache.get(t.config.refereeRoleId)) || guild.roles.cache.find(r => r.name === REFEREE_ROLE) || null;
    }
    function pickReferee(guild, t, m) {
        const playing = new Set([...entryMembers(t, m.a), ...entryMembers(t, m.b)]);
        const role = refereeRole(guild, t);
        const busy = {};
        for (const tt of activeList()) for (const mm of allMatches(tt)) if (mm.status === 'live' && mm.refereeId) busy[mm.refereeId] = (busy[mm.refereeId] || 0) + 1;
        const candidates = role ? [...role.members.values()].filter(mem => !mem.user.bot && !playing.has(mem.id)) : [];
        candidates.sort((x, y) => {
            const on = mem => (mem.presence && mem.presence.status !== 'offline' ? 0 : 1);
            return (busy[x.id] || 0) - (busy[y.id] || 0) || on(x) - on(y);
        });
        if (candidates.length) return candidates[0].id;
        return playing.has(t.hostId) ? null : t.hostId;
    }
    function refereePanel(t, m) {
        const need = neededWins(m);
        const nameA = trunc(entryName(t, m.a), 60), nameB = trunc(entryName(t, m.b), 60);
        const winner = m.winsA >= need ? 'a' : m.winsB >= need ? 'b' : null;
        const embed = new EmbedBuilder().setColor(0xE67E22)
            .setAuthor({ name: `🧑‍⚖️ REFEREE PANEL · only the referee can use the buttons` })
            .setTitle(`${nameA}  ${m.winsA} – ${m.winsB}  ${nameB}`)
            .setDescription([
                `**${matchLabel(t, m)}** · Best of ${m.bestOf} (first to ${need}) · ${t.config.gamemode}${t.config.server ? ` on **${t.config.server}**` : ''}`,
                `Referee: ${m.refereeId ? `<@${m.refereeId}>` : '*none available - staff please take over*'}`,
                winner ? `\n✅ **${entryName(t, m[winner])}** reached ${need}. Press **End match** to confirm.` : '',
                t.config.rules ? `\n📜 ${trunc(t.config.rules, 600)}` : ''
            ].join('\n'))
            .setFooter({ text: `${t.config.name} · ${m.id}` });
        const id = `tn:ref:${t.id}:${m.id}`;
        const locked = m.status !== 'live';
        return {
            embeds: [embed],
            components: [
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`${id}:pa`).setLabel(trunc(`Round to ${nameA}`, 80)).setEmoji('➕').setStyle(ButtonStyle.Primary).setDisabled(locked || !!winner),
                    new ButtonBuilder().setCustomId(`${id}:pb`).setLabel(trunc(`Round to ${nameB}`, 80)).setEmoji('➕').setStyle(ButtonStyle.Primary).setDisabled(locked || !!winner),
                    new ButtonBuilder().setCustomId(`${id}:undo`).setLabel('Undo').setEmoji('↩️').setStyle(ButtonStyle.Secondary).setDisabled(locked || !m.log.length)
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`${id}:end`).setLabel('End match').setEmoji('🏁').setStyle(ButtonStyle.Success).setDisabled(locked || !winner),
                    new ButtonBuilder().setCustomId(`${id}:nsa`).setLabel(trunc(`No-show: ${nameA}`, 80)).setEmoji('⏰').setStyle(ButtonStyle.Secondary).setDisabled(locked),
                    new ButtonBuilder().setCustomId(`${id}:nsb`).setLabel(trunc(`No-show: ${nameB}`, 80)).setEmoji('⏰').setStyle(ButtonStyle.Secondary).setDisabled(locked)
                ),
                new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`${id}:dqa`).setLabel(trunc(`Disqualify ${nameA}`, 80)).setEmoji('🚫').setStyle(ButtonStyle.Danger).setDisabled(locked),
                    new ButtonBuilder().setCustomId(`${id}:dqb`).setLabel(trunc(`Disqualify ${nameB}`, 80)).setEmoji('🚫').setStyle(ButtonStyle.Danger).setDisabled(locked)
                )
            ]
        };
    }

    async function openMatchRoom(t, m) {
        const guild = guildOf(t);
        if (!guild) return;
        const members = [...entryMembers(t, m.a), ...entryMembers(t, m.b)];
        m.refereeId = pickReferee(guild, t, m);
        const cat = await getCategory(guild);
        const allow = [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.AttachFiles, PermissionsBitField.Flags.ReadMessageHistory];
        const overwrites = [
            { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
            { id: client.user.id, allow: [...allow, PermissionsBitField.Flags.ManageChannels] },
            ...members.map(id => ({ id, allow }))
        ];
        if (m.refereeId) overwrites.push({ id: m.refereeId, allow });
        const room = await guild.channels.create({
            name: `${matchLabel(t, m).toLowerCase()}-${slug(entryName(t, m.a))}-vs-${slug(entryName(t, m.b))}`,
            type: 0, parent: cat, permissionOverwrites: overwrites,
            topic: `Tournament ${t.id} · ${m.id} · ${t.config.name}`
        });
        m.channelId = room.id;
        m.status = 'live';
        m.readyAt = Date.now();
        saveData();
        const panel = refereePanel(t, m);
        await room.send({ content: [...members, m.refereeId].filter(Boolean).map(id => `<@${id}>`).join(' '), ...panel, allowedMentions: { users: [...members, m.refereeId].filter(Boolean) } });

        const link = new ActionRowBuilder().addComponents(new ButtonBuilder().setStyle(ButtonStyle.Link).setURL(channelUrl(t, room.id)).setLabel('Go to match room').setEmoji('🚪'));
        for (const side of ['a', 'b']) {
            const opp = side === 'a' ? m.b : m.a;
            const embed = new EmbedBuilder().setColor(0x5865F2)
                .setAuthor({ name: '🔔 YOUR MATCH IS READY' })
                .setTitle(`${matchLabel(t, m)} · vs ${entryName(t, opp)}`)
                .setDescription([
                    m.refereeId ? `Referee <@${m.refereeId}> is waiting in your match room.` : 'A referee will join your match room.',
                    t.config.server ? `Join **${t.config.server}** and be in the room within **${NO_SHOW_MINUTES} minutes**, or you can be marked as a no-show.` : `Be in the room within **${NO_SHOW_MINUTES} minutes**, or you can be marked as a no-show.`
                ].join('\n'))
                .setFooter({ text: `${t.config.name} · Best of ${m.bestOf}` });
            for (const uid of entryMembers(t, m[side])) await dm(uid, { embeds: [embed], components: [link] });
        }
        if (m.refereeId) {
            await dm(m.refereeId, { content: `🧑‍⚖️ You're refereeing **${matchLabel(t, m)}** (${entryName(t, m.a)} vs ${entryName(t, m.b)}) in **${t.config.name}**.`, components: [link] });
        }
    }

    async function postTranscript(t, m, room) {
        const guild = guildOf(t);
        const logCh = guild?.channels.cache.find(c => c.name === LOG_CHANNEL);
        if (!logCh || !room) return;
        const msgs = await room.messages.fetch({ limit: 100 }).catch(() => null);
        const lines = msgs ? [...msgs.values()].reverse().map(x => `[${new Date(x.createdTimestamp).toISOString()}] ${x.author.username}: ${x.content || ''}${x.attachments.size ? ` [${x.attachments.size} attachment(s): ${[...x.attachments.values()].map(a => a.url).join(' ')}]` : ''}`) : [];
        lines.push('', `Result: ${entryName(t, m.a)} ${m.winsA}-${m.winsB} ${entryName(t, m.b)} (${m.result}) · winner ${entryName(t, m.winner)}`);
        lines.push(`Round log: ${m.log.map(s => (s === 'a' ? entryName(t, m.a) : entryName(t, m.b))).join(', ') || '-'}`);
        const file = new AttachmentBuilder(Buffer.from(lines.join('\n'), 'utf8'), { name: `${t.id}-${m.id}-transcript.txt` });
        const embed = new EmbedBuilder().setColor(0xE74C3C).setAuthor({ name: `🏆 Match closed · ${room.name}` })
            .setDescription(`**${t.config.name}** · ${matchLabel(t, m)}\n${entryName(t, m.a)} **${m.winsA} – ${m.winsB}** ${entryName(t, m.b)} · ${m.result}\nReferee: ${m.refereeId ? `<@${m.refereeId}>` : '—'}`)
            .setTimestamp();
        await logCh.send({ embeds: [embed], files: [file] }).catch(() => {});
    }

    async function finishMatch(t, m, side, result) {
        if (m.status === 'done') return;
        m.winner = side === 'a' ? m.a : m.b;
        const loser = side === 'a' ? m.b : m.a;
        m.status = 'done';
        m.result = result;
        m.closedAt = Date.now();
        for (const uid of entryMembers(t, m.winner)) stats(uid).matchWins++;
        for (const uid of entryMembers(t, loser)) stats(uid).matchLosses++;
        for (const [uid, pick] of Object.entries(t.predictions?.[m.id] || {})) {
            if (pick === m.winner) { t.predictionScore[uid] = (t.predictionScore[uid] || 0) + 1; stats(uid).predictionsCorrect++; }
        }
        advance(t, m);
        saveData();

        const room = m.channelId ? guildOf(t)?.channels.cache.get(m.channelId) : null;
        if (room) {
            await room.send(`🏁 **${entryName(t, m.winner)} wins** (${result}). The bracket is updated and this room closes in about a minute. A copy of this chat is saved to staff logs.`).catch(() => {});
            await postTranscript(t, m, room);
        }
        const isFinal = m.round === t.rounds.length - 1;
        await postMatchResult(t, m, loser, isFinal);
        if (!isFinal) {
            const next = t.rounds[m.round + 1][Math.floor(m.index / 2)];
            const oppSide = m.index % 2 === 0 ? 'b' : 'a';
            if (!next[oppSide]) {
                for (const uid of entryMembers(t, m.winner)) {
                    await dm(uid, `✅ You won **${matchLabel(t, m)}** (${result})! Next up: **${matchLabel(t, next)}** against ${feederLabel(t, next, oppSide).replace('Winner of', 'the winner of')}. You'll get a DM with the room as soon as they finish.`);
                }
            }
        }
        if (!isFinal && loser) {
            for (const uid of entryMembers(t, loser)) await dm(uid, `GG! You were knocked out of **${t.config.name}** in the ${roundName(t, m.round)} by **${entryName(t, m.winner)}** (${result}). Thanks for playing.`);
        }
        if (isFinal) await finishTournament(t, m);
        else await startReadyMatches(t);
        await refreshPublic(t);
    }

    // A new post (not an edit) after every match, so people get notified.
    async function postMatchResult(t, m, loser, isFinal) {
        const guild = guildOf(t);
        const ch = tChannel(guild, 'results');
        if (!ch) return;
        const w = entryName(t, m.winner), l = entryName(t, loser);
        const scored = /^\d+–\d+$/.test(m.result);
        const score = scored ? (m.winner === m.a ? `${m.winsA} – ${m.winsB}` : `${m.winsB} – ${m.winsA}`) : null;
        const how = { 'no-show': `${l} didn't show up`, DQ: `${l} was disqualified`, removed: `${l} was removed`, 'staff decision': 'decided by staff', forfeit: 'by forfeit' }[m.result];
        let next = '🏆 **Tournament champion!**';
        if (!isFinal) {
            const nm = t.rounds[m.round + 1][Math.floor(m.index / 2)];
            const oppSide = m.index % 2 === 0 ? 'b' : 'a';
            next = `**${matchLabel(t, nm)}** vs ${nm[oppSide] ? `**${entryName(t, nm[oppSide])}**` : feederLabel(t, nm, oppSide).replace('Winner of', 'the winner of')}`;
        }
        const embed = new EmbedBuilder().setColor(isFinal ? 0xFFD700 : 0x2ECC71)
            .setAuthor({ name: `${isFinal ? '👑' : '✅'} ${matchLabel(t, m)} · ${t.config.name}` })
            .setTitle(`${w} defeated ${l}`)
            .setDescription(score ? `## ${score}` : `*${how || m.result}*`)
            .addFields(
                { name: '🏅 Round', value: `${roundName(t, m.round)} · BO${m.bestOf}`, inline: true },
                { name: '⏭ Next', value: next, inline: true },
                { name: '🧑‍⚖️ Referee', value: m.refereeId ? `<@${m.refereeId}>` : '—', inline: true }
            )
            .setFooter({ text: `${t.config.gamemode} · Full bracket in #${CHANNELS.brackets}` })
            .setTimestamp();
        if (m.log.length) embed.addFields({ name: '📋 Rounds', value: m.log.map((sd, i) => `R${i + 1}: ${sd === 'a' ? entryName(t, m.a) : entryName(t, m.b)}`).join(' · ').slice(0, 1000), inline: false });
        const sp = predictionSplit(t, m);
        if (sp) {
            const pct = m.winner === m.a ? sp.pa : sp.pb;
            embed.addFields({ name: '🔮 Predictions', value: `${pct}% of ${sp.n} fan${sp.n === 1 ? '' : 's'} picked ${w}${pct < 50 ? ' (upset!)' : ''}`, inline: false });
        }
        const head = getSkinHeadUrl(players()[entryMembers(t, m.winner)[0]]);
        if (head) embed.setThumbnail(head);
        await ch.send({ embeds: [embed], allowedMentions: { parse: [] } }).catch(() => {});

        // When a whole round is done, post the bracket once (not after every match).
        t.roundsPosted ??= {};
        const round = t.rounds[m.round];
        if (!isFinal && !t.roundsPosted[m.round] && round.every(x => x.status === 'done')) {
            t.roundsPosted[m.round] = true;
            saveData();
            const img = await renderBracketImage(t);
            const re = new EmbedBuilder().setColor(0x5865F2)
                .setTitle(`🏁 ${roundName(t, m.round)} complete`)
                .setDescription(`**${roundName(t, m.round + 1)}** ${m.round + 1 === t.rounds.length - 1 ? 'is next: one match for the title!' : 'are starting now.'}\n${t.rounds[m.round + 1].map(x => `• ${matchLabel(t, x)}: ${entryName(t, x.a)} vs ${entryName(t, x.b)}`).join('\n')}`)
                .setTimestamp();
            if (img) re.setImage('attachment://bracket.png');
            await ch.send({ embeds: [re], files: img ? [img] : [], allowedMentions: { parse: [] } }).catch(() => {});
        }
    }

    // Auto-resolves matches where one side was removed/kicked.
    function resolveForfeits(t) {
        let changed = true;
        while (changed) {
            changed = false;
            for (const m of allMatches(t)) {
                if (m.status !== 'waiting' || !m.a || !m.b) continue;
                const ra = t.entries[m.a]?.removed, rb = t.entries[m.b]?.removed;
                if (!ra && !rb) continue;
                m.winner = ra && !rb ? m.b : m.a;
                m.status = 'done'; m.result = 'forfeit'; m.closedAt = Date.now();
                advance(t, m);
                changed = true;
                if (m.round === t.rounds.length - 1) return m;
            }
        }
        return null;
    }

    async function startReadyMatches(t) {
        if (t.status !== 'running') return;
        const finalForfeit = resolveForfeits(t);
        if (finalForfeit) { await finishTournament(t, finalForfeit); return; }
        const toOpen = allMatches(t).filter(m => m.status === 'waiting' && m.a && m.b);
        if (toOpen.length) await guildOf(t)?.members.fetch().catch(() => {});
        for (const m of toOpen) {
            {
                try { await openMatchRoom(t, m); }
                catch (e) { console.error(`[Tournament ${t.id}] Could not open room for ${m.id}:`, e.message); }
            }
        }
        await refreshPublic(t);
    }

    // ---------- lifecycle ----------
    async function addEntry(t, entry) {
        t.entries[entry.id] = entry;
        if (t.slots.length < t.config.size) { t.slots.push(entry.id); return 'entered'; }
        t.waitlist.push(entry.id);
        return 'waitlist';
    }
    async function removeEntry(t, entryId, notifyPromoted = true) {
        const wasSlot = t.slots.includes(entryId);
        t.slots = t.slots.filter(id => id !== entryId);
        t.waitlist = t.waitlist.filter(id => id !== entryId);
        delete t.entries[entryId];
        if (wasSlot && t.waitlist.length && ['signup', 'checkin'].includes(t.status)) {
            const next = t.waitlist.shift();
            t.slots.push(next);
            if (notifyPromoted) {
                for (const uid of entryMembers(t, next)) await dm(uid, `🎉 A spot opened up - you're now in **${t.config.name}**!${t.status === 'checkin' ? ' Check-in is open, so check in from the DM you got earlier or press Check in below.' : ''}`)
                    .catch(() => {});
            }
        }
    }

    function checkinRow(t) {
        return new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tn:checkin:${t.id}`).setLabel('Check in').setEmoji('✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`tn:cantmake:${t.id}`).setLabel("I can't make it").setEmoji('❌').setStyle(ButtonStyle.Danger)
        );
    }
    async function beginCheckin(t) {
        t.status = 'checkin';
        saveData();
        const deadline = ts(t.config.startAt, 't');
        for (const id of t.slots) {
            for (const uid of entryMembers(t, id)) {
                await dm(uid, { content: `⏰ **${t.config.name}** starts ${ts(t.config.startAt, 'R')}. Check in to keep your spot - you have until ${deadline}.`, components: [checkinRow(t)] });
            }
        }
        for (const id of t.waitlist) {
            for (const uid of entryMembers(t, id)) {
                await dm(uid, { content: `⏳ You're on the waitlist for **${t.config.name}**. Check in before ${deadline} - if someone doesn't show, you take their spot.`, components: [checkinRow(t)] });
            }
        }
        await updateAnnouncement(t);
    }

    async function startTournament(t) {
        const needCheckin = t.config.checkinMinutes > 0;
        const ok = id => !needCheckin || t.entries[id]?.checkedIn;
        const participants = t.slots.filter(ok);
        const spare = t.waitlist.filter(ok);
        while (participants.length < t.config.size && spare.length) participants.push(spare.shift());
        for (const id of [...t.slots, ...t.waitlist]) {
            if (participants.includes(id)) continue;
            const wasSlot = t.slots.includes(id);
            for (const uid of entryMembers(t, id)) {
                await dm(uid, wasSlot
                    ? `❌ You didn't check in for **${t.config.name}**, so your spot went to the waitlist.`
                    : `The bracket for **${t.config.name}** is full, so the waitlist didn't get in this time. See you next cup!`);
            }
        }
        if (participants.length < 2) {
            await cancelTournament(t, `Not enough ${unit(t)} checked in.`);
            return;
        }
        t.participants = participants;
        t.slots = participants;
        t.waitlist = [];
        t.predictions = {};
        t.predictionScore = {};
        buildBracket(t, participants);
        for (const id of participants) for (const uid of entryMembers(t, id)) stats(uid).played++;
        t.status = 'running';
        t.startedAt = Date.now();
        saveData();

        const g = guildOf(t);
        const fallback = t.announce && g?.channels.cache.get(t.announce.channelId);
        const bCh = tChannel(g, 'brackets') || fallback;
        const lCh = tChannel(g, 'live') || fallback;
        if (bCh) {
            const b = await postBracket(t, bCh);
            if (b) t.bracketMsg = { channelId: bCh.id, messageId: b.id };
        }
        if (lCh) {
            const l = await lCh.send({ embeds: [liveEmbed(t)], components: announcementComponents(t) }).catch(() => null);
            if (l) t.liveMsg = { channelId: lCh.id, messageId: l.id };
        }
        saveData();
        await startReadyMatches(t);
    }

    async function cancelTournament(t, reason) {
        t.status = 'cancelled';
        t.cancelReason = reason || '';
        const guild = guildOf(t);
        for (const m of allMatches(t)) {
            if (m.channelId) { await guild?.channels.cache.get(m.channelId)?.delete().catch(() => {}); m.channelId = null; }
        }
        saveData();
        const everyone = new Set([...t.slots, ...t.waitlist].flatMap(id => entryMembers(t, id)));
        for (const uid of everyone) await dm(uid, `❌ **${t.config.name}** was cancelled.${reason ? ` Reason: ${reason}` : ''}`);
        await refreshPublic(t);
    }

    async function makeChampionCard(t, finalMatch) {
        try {
            const Cv = getCanvas();
            if (!Cv) throw new Error('@napi-rs/canvas is not installed');
            const { createCanvas, loadImage } = Cv;
            const W = 960, H = 420;
            const canvas = createCanvas(W, H);
            const ctx = canvas.getContext('2d');
            const g = ctx.createLinearGradient(0, 0, W, H);
            g.addColorStop(0, '#1a1406'); g.addColorStop(1, '#3a2a05');
            ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
            ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 6; ctx.strokeRect(12, 12, W - 24, H - 24);
            const champMembers = entryMembers(t, t.championEntry);
            let x = 60;
            for (const uid of champMembers.slice(0, 2)) {
                const url = getSkinBodyUrl(players()[uid]);
                if (!url) continue;
                const img = await loadImage(url).catch(() => null);
                if (img) { const h = 330, w = (img.width / img.height) * h; ctx.drawImage(img, x, 45, w, h); x += w + 20; }
            }
            const tx = Math.max(x + 30, 340);
            ctx.fillStyle = '#ffd700'; ctx.font = font(30, true);
            ctx.fillText(`BEST IN ${t.config.gamemode.toUpperCase()}`, tx, 110);
            ctx.fillStyle = '#ffffff'; ctx.font = font(54, true);
            ctx.fillText(trunc(entryName(t, t.championEntry), 20), tx, 180);
            ctx.fillStyle = '#e8d9a8'; ctx.font = font(28);
            ctx.fillText(trunc(t.config.name, 34), tx, 240);
            ctx.fillText(`Final: ${finalMatch.winsA}–${finalMatch.winsB} vs ${trunc(entryName(t, finalMatch.winner === finalMatch.a ? finalMatch.b : finalMatch.a), 18)}`, tx, 285);
            ctx.fillStyle = '#b8a877'; ctx.font = font(22);
            ctx.fillText(`${t.participants.length} ${unit(t)} · ${new Date().toLocaleDateString('en-GB')} · ${BOT_NAME}`, tx, 340);
            return new AttachmentBuilder(canvas.toBuffer('image/png'), { name: 'champion.png' });
        } catch (e) {
            console.error('[Tournament] Champion card skipped (install @napi-rs/canvas for it):', e.message);
            return null;
        }
    }

    async function finishTournament(t, finalMatch) {
        const guild = guildOf(t);
        t.status = 'finished';
        t.finishedAt = Date.now();
        t.championEntry = finalMatch.winner;
        const runnerUp = finalMatch.winner === finalMatch.a ? finalMatch.b : finalMatch.a;
        const gm = t.config.gamemode;
        const champs = entryMembers(t, t.championEntry);
        for (const uid of champs) {
            const s = stats(uid);
            s.won++;
            s.titles.push({ gamemode: gm, name: t.config.name, date: Date.now() });
        }
        for (const uid of [...champs, ...entryMembers(t, runnerUp)]) stats(uid).finals++;
        store().champions[gm] = { members: champs, name: entryName(t, t.championEntry), tournamentId: t.id, tournamentName: t.config.name, date: Date.now() };

        if (guild) {
            await guild.members.fetch().catch(() => {});
            const role = await findOrCreateRole(guild, championRoleName(gm), { color: 0xFFD700, hoist: true });
            if (role) {
                for (const mem of role.members.values()) if (!champs.includes(mem.id)) await mem.roles.remove(role).catch(() => {});
                for (const uid of champs) await guild.members.fetch(uid).then(mem => mem.roles.add(role)).catch(() => {});
            }
            const scores = Object.entries(t.predictionScore || {});
            const best = Math.max(0, ...scores.map(([, n]) => n));
            if (best > 0) {
                const top = scores.filter(([, n]) => n === best).map(([uid]) => uid);
                const oracle = await findOrCreateRole(guild, ORACLE_ROLE, { color: 0x9B59B6 });
                if (oracle) {
                    for (const mem of oracle.members.values()) if (!top.includes(mem.id)) await mem.roles.remove(oracle).catch(() => {});
                    for (const uid of top) await guild.members.fetch(uid).then(mem => mem.roles.add(oracle)).catch(() => {});
                }
                store().oracle = { userIds: top, until: Date.now() + ORACLE_DAYS * 864e5 };
                t.topPredictors = { userIds: top, correct: best };
            }
        }
        saveData();

        const ch = tChannel(guild, 'champions') || (t.announce && guild?.channels.cache.get(t.announce.channelId));
        if (ch) {
            const semis = t.rounds.length >= 2 ? t.rounds[t.rounds.length - 2].map(m => (m.winner === m.a ? m.b : m.a)).filter(Boolean) : [];
            const card = await makeChampionCard(t, finalMatch);
            const embed = new EmbedBuilder().setColor(0xFFD700)
                .setAuthor({ name: '👑 TOURNAMENT CHAMPION' })
                .setTitle(`${entryName(t, t.championEntry)} ${champs.length > 1 ? 'are' : 'is'} Best in ${gm}!`)
                .setDescription(`Won **${t.config.name}** against ${t.participants.length} ${unit(t)}.\nFinal: ${entryName(t, finalMatch.a)} **${finalMatch.winsA} – ${finalMatch.winsB}** ${entryName(t, finalMatch.b)}${finalMatch.refereeId ? ` · Referee <@${finalMatch.refereeId}>` : ''}`)
                .addFields(
                    { name: '🥇 Winner', value: entryName(t, t.championEntry), inline: true },
                    { name: '🥈 Runner-up', value: entryName(t, runnerUp), inline: true },
                    { name: '🥉 Semifinals', value: semis.map(id => entryName(t, id)).join(' · ') || '—', inline: true },
                    { name: '🔮 Top predictor', value: t.topPredictors ? `${t.topPredictors.userIds.map(id => `<@${id}>`).join(', ')} (${t.topPredictors.correct} correct)` : '—', inline: false }
                )
                .setFooter({ text: `Role granted: ${championRoleName(gm)} · ${BOT_NAME}` })
                .setTimestamp();
            const body = getSkinBodyUrl(players()[champs[0]]);
            if (card) embed.setImage('attachment://champion.png');
            else if (body) embed.setThumbnail(body);
            const ping = guild.roles.cache.find(r => r.name === PING_ROLE);
            await ch.send({ content: ping ? `${ping}` : undefined, embeds: [embed], files: card ? [card] : [], allowedMentions: { roles: ping ? [ping.id] : [] } }).catch(() => {});
        }
        await refreshPublic(t);
    }

    // ---------- scheduler ----------
    const busy = new Set();
    async function tickOne(t) {
        const now = Date.now();
        const c = t.config;
        if (t.status === 'signup') {
            if (!t.signupClosedShown && now >= c.signupCloseAt) { t.signupClosedShown = true; saveData(); await updateAnnouncement(t); }
            if (c.checkinMinutes > 0 && now >= c.startAt - c.checkinMinutes * 6e4) await beginCheckin(t);
            else if (c.checkinMinutes === 0 && now >= c.startAt) await startTournament(t);
        } else if (t.status === 'checkin') {
            if (now >= c.startAt) await startTournament(t);
        } else if (t.status === 'running') {
            for (const m of allMatches(t)) {
                if (m.status === 'live' && !m.noShowPinged && m.readyAt && now - m.readyAt > NO_SHOW_MINUTES * 6e4 && !m.log.length) {
                    m.noShowPinged = true; saveData();
                    const room = guildOf(t)?.channels.cache.get(m.channelId);
                    await room?.send(`⏰ ${NO_SHOW_MINUTES} minutes have passed. ${m.refereeId ? `<@${m.refereeId}>` : 'Referee'}, if a player still isn't here you can mark them as a no-show.`).catch(() => {});
                }
            }
        }
        // Close finished match rooms (done here, not with setTimeout, so a restart can't leave them behind).
        for (const m of allMatches(t)) {
            if (m.status === 'done' && m.channelId && m.closedAt && now - m.closedAt >= ROOM_CLOSE_DELAY_MS) {
                await guildOf(t)?.channels.cache.get(m.channelId)?.delete().catch(() => {});
                m.channelId = null; saveData();
            }
        }
    }
    async function tick() {
        const s = store();
        for (const t of Object.values(s.list)) {
            if (busy.has(t.id)) continue;
            busy.add(t.id);
            try { await tickOne(t); } catch (e) { console.error(`[Tournament ${t.id}] tick error:`, e); }
            busy.delete(t.id);
        }
        if (s.oracle && Date.now() > s.oracle.until) {
            const guild = client.guilds.cache.first();
            const role = guild?.roles.cache.find(r => r.name === ORACLE_ROLE);
            if (role) for (const mem of role.members.values()) await mem.roles.remove(role).catch(() => {});
            s.oracle = null; saveData();
        }
    }
    // Serializes work on one tournament so two clicks can't advance it twice.
    async function withLock(t, fn) {
        while (busy.has(t.id)) await new Promise(r => setTimeout(r, 100));
        busy.add(t.id);
        try { return await fn(); } finally { busy.delete(t.id); }
    }

    // ---------- interaction handling ----------
    async function handleCommand(interaction) {
        const { commandName, options, member, guild } = interaction;
        if (commandName === 'tournaments') {
            const s = store();
            const lines = GAMEMODE_ORDER.map(gm => {
                const ch = s.champions[gm];
                return `${getGamemodeSymbol(gm)} **${gm}**: ${ch ? `👑 ${ch.name} · ${ch.tournamentName} (${new Date(ch.date).toLocaleDateString('en-GB')})` : '*no champion yet*'}`;
            });
            const act = activeList().filter(t => t.status !== 'draft');
            const embed = new EmbedBuilder().setColor(0xFFD700).setTitle('👑 Current champions').setDescription(lines.join('\n'));
            if (act.length) embed.addFields({ name: '📅 Active tournaments', value: act.map(t => `\`${t.id}\` ${t.config.name} · ${statusLabel(t)}`).join('\n') });
            return interaction.reply({ embeds: [embed], flags: 64 });
        }
        const sub = options.getSubcommand();
        if (sub === 'timezone') {
            const s0 = store();
            s0.hostTz ??= {};
            const zone = resolveZone(options.getString('zone'));
            if (!zone) return interaction.reply({ content: '❌ Unknown timezone.', flags: 64 });
            s0.hostTz[interaction.user.id] = zone;
            // Apply to this host's tournaments that can still be edited.
            for (const tt of activeList()) if (tt.hostId === interaction.user.id && ['draft', 'signup'].includes(tt.status)) tt.config.tz = zone;
            saveData();
            const w = wallParts(Date.now(), zone);
            const p = n => String(n).padStart(2, '0');
            return interaction.reply({ content: `🕒 Your timezone is now **${zoneLabel(zone)}** (it's ${p(w.h)}:${p(w.mi)} there right now). Times you type when creating tournaments are read in this timezone. Players still see every time in their own timezone.`, flags: 64 });
        }
        if (sub === 'setup') {
            if (!isStaffMember(member)) return interaction.reply({ content: '❌ Only admins can create the tournament channels.', flags: 64 });
            await interaction.deferReply({ flags: 64 });
            return interaction.editReply({ content: await setupChannels(guild, options.getRole('verified_role')) });
        }
        const hostOnly = ['create', 'edit', 'start', 'cancel', 'kick', 'setwinner', 'templates'];
        if (hostOnly.includes(sub) && !canHost(member)) {
            return interaction.reply({ content: `❌ You need the **${HOST_ROLE}** role to run tournaments.`, flags: 64 });
        }
        const s = store();
        if (sub === 'create') {
            const tplName = options.getString('template');
            let config = defaultConfig();
            let name = options.getString('name') || '';
            if (tplName) {
                const tpl = s.templates[tplName.toLowerCase()];
                if (!tpl) return interaction.reply({ content: `❌ No template called "${tplName}". See \`/tournament templates\`.`, flags: 64 });
                config = { ...defaultConfig(), ...tpl.config };
                tpl.count = (tpl.count || 0) + 1;
                name = name || `${tpl.baseName} #${tpl.count}`;
            }
            const gm = options.getString('gamemode');
            if (gm) config.gamemode = gm;
            config.name = name;
            config.tz = hostZone(interaction.user.id);
            const id = `T${++s.counter}`;
            s.list[id] = { id, status: 'draft', hostId: interaction.user.id, guildId: guild.id, createdAt: Date.now(), config, entries: {}, slots: [], waitlist: [] };
            saveData();
            return interaction.reply({ ...setupPanel(s.list[id]), flags: 64 });
        }
        if (sub === 'list') {
            const act = activeList().filter(t => t.status !== 'draft' || t.hostId === interaction.user.id);
            if (!act.length) return interaction.reply({ content: '📭 No active tournaments.', flags: 64 });
            return interaction.reply({ content: act.map(t => `\`${t.id}\` **${t.config.name || 'Unnamed'}** · ${statusLabel(t)} · ${t.slots.length}/${t.config.size} ${unit(t)}`).join('\n'), flags: 64 });
        }
        if (sub === 'templates') {
            const list = Object.values(s.templates);
            return interaction.reply({ content: list.length ? list.map(tp => `💾 **${tp.baseName}** · ${tp.config.gamemode} · ${tp.config.size} ${tp.config.teamSize === 2 ? 'teams' : 'players'} · used ${tp.count || 0}×\nUse: \`/tournament create template:${tp.baseName}\``).join('\n') : '📭 No templates yet. Press 💾 Save as template in a setup panel.', flags: 64 });
        }
        const t = resolveTournament(interaction, options.getString('id'));
        if (!t) return interaction.reply({ content: '❌ Tournament not found. Add the `id` option (see `/tournament list`).', flags: 64 });
        if (hostOnly.includes(sub) && !canManage(member, t)) return interaction.reply({ content: '❌ Only this tournament\'s host or staff can do that.', flags: 64 });

        if (sub === 'edit') {
            if (!['draft', 'signup'].includes(t.status)) return interaction.reply({ content: '❌ You can only edit a tournament before check-in starts.', flags: 64 });
            return interaction.reply({ ...setupPanel(t), flags: 64 });
        }
        if (sub === 'start') {
            if (!['signup', 'checkin'].includes(t.status)) return interaction.reply({ content: '❌ Only a published tournament that hasn\'t started can be started early.', flags: 64 });
            await interaction.deferReply({ flags: 64 });
            await withLock(t, async () => { t.config.startAt = Date.now(); await startTournament(t); });
            return interaction.editReply({ content: t.status === 'running' ? `✅ **${t.config.name}** started.` : `⚠️ ${statusLabel(t)}${t.cancelReason ? ` · ${t.cancelReason}` : ''}` });
        }
        if (sub === 'cancel') {
            if (['finished', 'cancelled'].includes(t.status)) return interaction.reply({ content: '❌ That tournament is already over.', flags: 64 });
            await interaction.deferReply({ flags: 64 });
            if (t.status === 'draft') { delete s.list[t.id]; saveData(); return interaction.editReply({ content: '🗑 Draft deleted.' }); }
            await withLock(t, () => cancelTournament(t, options.getString('reason')));
            return interaction.editReply({ content: `✅ **${t.config.name}** cancelled. Everyone signed up got a DM.` });
        }
        if (sub === 'kick') {
            const user = options.getUser('player');
            const entry = findEntryOf(t, user.id);
            if (!entry) return interaction.reply({ content: '❌ That player isn\'t in this tournament.', flags: 64 });
            await interaction.deferReply({ flags: 64 });
            await withLock(t, async () => {
                if (t.status !== 'running') { await removeEntry(t, entry.id); saveData(); await updateAnnouncement(t); return; }
                entry.removed = true;
                const live = allMatches(t).find(m => m.status === 'live' && (m.a === entry.id || m.b === entry.id));
                if (live) await finishMatch(t, live, live.a === entry.id ? 'b' : 'a', 'removed');
                else { saveData(); await startReadyMatches(t); }
            });
            await dm(user.id, `You were removed from **${t.config.name}** by staff.`);
            return interaction.editReply({ content: `✅ Removed ${entry.name} from **${t.config.name}**.` });
        }
        if (sub === 'setwinner') {
            if (t.status !== 'running') return interaction.reply({ content: '❌ The tournament isn\'t running.', flags: 64 });
            const label = options.getString('match').toUpperCase().replace(/\s+/g, '');
            const m = allMatches(t).find(x => matchLabel(t, x).toUpperCase().replace(/-/g, '') === label.replace(/-/g, '') || x.id === label);
            if (!m) return interaction.reply({ content: '❌ Match not found. Use the label from the bracket, e.g. `QF2`, `SF1`, `Final`.', flags: 64 });
            if (m.status === 'done') return interaction.reply({ content: '❌ That match is already decided - results that fed later rounds can\'t be changed.', flags: 64 });
            const user = options.getUser('player');
            const side = entryMembers(t, m.a).includes(user.id) ? 'a' : entryMembers(t, m.b).includes(user.id) ? 'b' : null;
            if (!side || !m.a || !m.b) return interaction.reply({ content: '❌ That player isn\'t in this match (or the opponent isn\'t decided yet).', flags: 64 });
            await interaction.deferReply({ flags: 64 });
            await withLock(t, () => finishMatch(t, m, side, 'staff decision'));
            return interaction.editReply({ content: `✅ ${entryName(t, m.winner)} advances from ${matchLabel(t, m)}.` });
        }
        return false;
    }

    // What each channel is for - posted and pinned as the first message, so
    // nobody wonders what a channel does.
    function channelIntro(key) {
        const e = new EmbedBuilder().setColor(0xFFD700).setFooter({ text: `${BOT_NAME} · Tournaments` });
        const ch = k => `**#${CHANNELS[k]}**`;
        switch (key) {
            case 'signups': return e.setTitle('📢 Tournament Sign-ups').setDescription([
                'New tournaments are announced here. Press **✅ Join** on a card to sign up.',
                '',
                '**Before you join**',
                '• You need an applied profile (**APPLY NOW** in the dashboard). Your in-game name comes from it.',
                '• Some tournaments have a tier limit. The card tells you.',
                '• Blacklisted players can\'t join.',
                '',
                '**How it works**',
                '1️⃣ **Join** before sign-ups close. If it\'s full, you go on the **waitlist**.',
                '2️⃣ Before the start you get a **DM to check in**. Miss it and the waitlist takes your spot.',
                '3️⃣ When your match is ready you get a **DM with a button** into your private match room.',
                '4️⃣ A **referee** watches your match and decides the score.',
                '',
                '👥 **2v2 tournaments:** pick your teammate after pressing Join. They get a DM to accept.',
                `🔔 Want a ping for new tournaments? Ask staff for the **${PING_ROLE}** role.`
            ].join('\n'));
            case 'brackets': return e.setTitle('🗂 Brackets').setDescription([
                'The bracket for every running tournament is posted here and **updates itself** after each match.',
                '',
                '**Reading the bracket**',
                '• **QF** = quarterfinal, **SF** = semifinal. The number is the match.',
                '• `(HT2)` is the player\'s tier in that gamemode. Players are **seeded by tier**, so the best players meet late.',
                '• 🔴 = being played now · ✅ = finished · `bye` = no opponent, moves on automatically.',
                '• `NO-SHOW`, `DQ` and `FORFEIT` show how a match was decided without being played.',
                '',
                'Every tournament is **single elimination**: lose once and you\'re out.'
            ].join('\n'));
            case 'results': return e.setTitle('📜 Match Results').setDescription([
                'A result is posted here **after every match**: who won, the score, and where the winner goes next.',
                '',
                '• When a whole round finishes, the updated **bracket image** is posted too.',
                `• The always-up-to-date bracket is in ${ch('brackets')}.`,
                '• 🔮 Each result shows how many fans predicted the winner. Watch for upsets!',
                '',
                '**NS** = no-show · **DQ** = disqualified · **FF** = forfeit'
            ].join('\n'));
            case 'live': return e.setTitle('🔴 Live Matches').setDescription([
                'Scores update here **round by round** while matches are played.',
                '',
                '**🔮 Predictions**',
                '• Press **Predict winner** and pick who you think wins a match.',
                '• Picks close as soon as the first round of that match is played.',
                '• You can\'t predict your own match.',
                `• The best predictor of each tournament gets the **${ORACLE_ROLE}** role for ${ORACLE_DAYS} days.`,
                '',
                '📺 If a stream link or server is listed, you can watch or spectate there.'
            ].join('\n'));
            case 'champions': return e.setTitle('👑 Hall of Champions').setDescription([
                'Every tournament winner is posted here with their **champion card**.',
                '',
                '• The winner gets the **👑 Best in <gamemode>** role, e.g. 👑 Best in Mace.',
                '• You keep it until someone wins the next tournament in that gamemode.',
                '• Titles also show on your **/profile**.',
                '',
                'Use **/tournaments** to see the current champion of every gamemode.'
            ].join('\n'));
            case 'chat': return e.setTitle('💬 Tournament Chat').setDescription([
                'Talk about tournaments here: hype, questions, looking for a 2v2 teammate.',
                '',
                '**Rules**',
                '• Be respectful. Trash talk that turns into harassment gets you removed from tournaments.',
                '• Don\'t argue about results here. Problems during a match go to the **referee in your match room**.',
                '• Don\'t ping hosts or referees for no reason.',
                '',
                `Sign-ups: ${ch('signups')} · brackets: ${ch('brackets')} · results: ${ch('results')} · live scores: ${ch('live')}.`
            ].join('\n'));
        }
        return e;
    }

    function findVerifiedRole(guild, picked) {
        const s = store();
        if (picked) return picked;
        if (s.verifiedRoleId) { const r = guild.roles.cache.get(s.verifiedRoleId); if (r) return r; }
        return guild.roles.cache.find(r => r.name.toLowerCase() === 'verified') || null;
    }

    // Creates (or repairs) the tournament category and channels. Only the
    // Verified role can see them; everything except the chat is read-only.
    async function setupChannels(guild, pickedRole) {
        const F = PermissionsBitField.Flags;
        const verified = findVerifiedRole(guild, pickedRole);
        if (!verified) {
            return '❌ I couldn\'t find your Verified role. Run `/tournament setup verified_role:@YourVerifiedRole` and pick it.';
        }
        const s = store();
        s.verifiedRoleId = verified.id;
        s.channelIntros ??= {};
        const botAllow = { id: client.user.id, allow: [F.ViewChannel, F.SendMessages, F.EmbedLinks, F.AttachFiles, F.ReadMessageHistory, F.MentionEveryone, F.ManageMessages] };
        const hidden = { id: guild.id, deny: [F.ViewChannel] };
        const readOnly = [hidden, { id: verified.id, allow: [F.ViewChannel, F.ReadMessageHistory], deny: [F.SendMessages, F.CreatePublicThreads, F.CreatePrivateThreads] }, botAllow];
        const open = [hidden, { id: verified.id, allow: [F.ViewChannel, F.ReadMessageHistory, F.SendMessages] }, botAllow];
        const lines = [`🔒 Visible to **${verified.name}** only. Unverified members can't see these channels.`];

        let cat = guild.channels.cache.find(c => c.name === TOURNAMENT_CATEGORY && c.type === 4);
        if (!cat) { cat = await guild.channels.create({ name: TOURNAMENT_CATEGORY, type: 4, permissionOverwrites: [hidden, { id: verified.id, allow: [F.ViewChannel] }, botAllow] }); lines.push(`✅ Created category **${TOURNAMENT_CATEGORY}**`); }
        else await cat.permissionOverwrites.set([hidden, { id: verified.id, allow: [F.ViewChannel] }, botAllow]).catch(() => {});

        for (const [key, name] of Object.entries(CHANNELS)) {
            const perms = key === 'chat' ? open : readOnly;
            let ch = guild.channels.cache.find(c => c.name === name && c.type === 0);
            if (ch) {
                await ch.permissionOverwrites.set(perms).catch(() => {});
                lines.push(`☑️ ${ch} already existed, permissions updated`);
            } else {
                ch = await guild.channels.create({ name, type: 0, parent: cat, permissionOverwrites: perms });
                lines.push(`✅ Created ${ch}`);
            }
            // Post + pin the info embed once (again if someone deleted it).
            const introId = s.channelIntros[key];
            const existing = introId ? await ch.messages.fetch(introId).catch(() => null) : null;
            if (existing) await existing.edit({ embeds: [channelIntro(key)] }).catch(() => {});
            else {
                const msg = await ch.send({ embeds: [channelIntro(key)] }).catch(() => null);
                if (msg) { s.channelIntros[key] = msg.id; await msg.pin().catch(() => {}); }
            }
        }
        saveData();
        lines.push('', '📌 Each channel has a pinned post explaining what it\'s for.',
            'Private match rooms go in **🏆 TOURNAMENT MATCHES** (created automatically when the first match starts).');
        return lines.join('\n');
    }

    async function handleConfig(interaction, t, action) {
        if (!canManage(interaction.member, t)) return interaction.reply({ content: '❌ Only the host can change this.', flags: 64 });
        if (!['draft', 'signup'].includes(t.status)) return interaction.reply({ content: '❌ This tournament can\'t be edited anymore.', flags: 64 });
        const c = t.config;
        if (action === 'gamemode') { c.gamemode = interaction.values[0]; }
        else if (action === 'server') {
            const v = interaction.values[0];
            if (v === 'custom') { saveData(); return interaction.showModal(moreModal(t)); }
            const sv = (getDb().testServers || [])[Number(v.slice(1))];
            if (sv) c.server = `${sv.ip}:${sv.port}`;
        } else if (action === 'format') {
            const [size, team] = interaction.values[0].split(':').map(Number);
            if (t.slots.length > size) return interaction.reply({ content: `❌ ${t.slots.length} ${unit(t)} are already signed up.`, flags: 64 });
            if (t.status !== 'draft' && team !== c.teamSize) return interaction.reply({ content: '❌ You can\'t switch between 1v1 and 2v2 after publishing.', flags: 64 });
            c.size = size; c.teamSize = team;
        } else if (action === 'referee') { c.refereeRoleId = interaction.values[0] || null; }
        else if (action === 'details') { return interaction.showModal(detailsModal(t)); }
        else if (action === 'more') { return interaction.showModal(moreModal(t)); }
        else if (action === 'preview') {
            return interaction.reply({ content: '👁 Preview (only you can see this):', embeds: [announcementEmbed({ ...t, status: 'signup', config: { ...c, signupCloseAt: c.signupCloseAt || Date.now() + 864e5, startAt: c.startAt || Date.now() + 2 * 864e5, name: c.name || 'Unnamed tournament' } })], flags: 64 });
        } else if (action === 'template') {
            if (!c.name) return interaction.reply({ content: '❌ Give the tournament a name first.', flags: 64 });
            const baseName = c.name.replace(/\s*#\d+\s*$/, '').trim();
            const num = Number(c.name.match(/#(\d+)\s*$/)?.[1] || 0);
            const { name, signupCloseAt, startAt, tz, ...rest } = c;
            const s = store();
            s.templates[baseName.toLowerCase()] = { baseName, count: Math.max(num, s.templates[baseName.toLowerCase()]?.count || 0), config: rest };
            saveData();
            return interaction.reply({ content: `💾 Saved template **${baseName}**. Next time: \`/tournament create template:${baseName}\` (it'll be named "${baseName} #${Math.max(num, 1) + 1}").`, flags: 64 });
        } else if (action === 'publish') {
            const err = validateConfig(t);
            if (err) return interaction.reply({ content: `❌ ${err}`, flags: 64 });
            if (t.status === 'signup') {
                saveData();
                await interaction.update(setupPanel(t));
                await updateAnnouncement(t);
                return interaction.followUp({ content: '✅ Changes saved and the sign-up card is updated.', flags: 64 });
            }
            const ch = tChannel(interaction.guild, 'signups');
            if (!ch) return interaction.reply({ content: '❌ The tournament channels don\'t exist yet. An admin can create them with `/tournament setup`.', flags: 64 });
            await interaction.deferUpdate();
            t.status = 'signup';
            t.publishedAt = Date.now();
            const ping = interaction.guild.roles.cache.find(r => r.name === PING_ROLE);
            const msg = await ch.send({ content: ping ? `${ping}` : undefined, embeds: [announcementEmbed(t)], components: announcementComponents(t), allowedMentions: { roles: ping ? [ping.id] : [] } });
            t.announce = { channelId: ch.id, messageId: msg.id };
            saveData();
            return interaction.editReply({ content: `📢 Published in ${ch}! Use \`/tournament edit id:${t.id}\` to change times or rules before check-in.`, embeds: [], components: [] });
        }
        saveData();
        return interaction.update(setupPanel(t));
    }

    async function handleModal(interaction, t, which) {
        if (!canManage(interaction.member, t)) return interaction.reply({ content: '❌ Only the host can change this.', flags: 64 });
        const c = t.config;
        const f = k => interaction.fields.getTextInputValue(k);
        const errors = [];
        if (which === 'details') {
            c.name = f('name').trim();
            const zone = c.tz || hostZone(t.hostId);
            const close = parseTime(f('close'), zone), start = parseTime(f('start'), zone);
            if (close) c.signupCloseAt = close; else errors.push(`Couldn't read the sign-up close time "${f('close')}".`);
            if (start) c.startAt = start; else errors.push(`Couldn't read the start time "${f('start')}".`);
            const bo = f('bestof').match(/^\s*(\d)\s*(?:\/\s*(\d))?\s*$/);
            const odd = n => n >= 1 && n <= 9 && n % 2 === 1;
            if (bo && odd(+bo[1]) && (!bo[2] || odd(+bo[2]))) { c.bestOf = +bo[1]; c.finalBestOf = bo[2] ? +bo[2] : +bo[1]; }
            else errors.push('Best of must be odd numbers like 3/5 or 1/3.');
            c.rules = f('rules').trim();
        } else {
            c.server = f('server').trim() || c.server;
            c.region = f('region').trim() || 'Any';
            const tier = parseTierLimit(f('tier'));
            if (tier) Object.assign(c, tier); else errors.push('Tier limit must look like "any", "LT3" or "LT4-HT2".');
            const ci = f('checkin').trim();
            if (/^\d{1,3}$/.test(ci)) c.checkinMinutes = Math.min(180, Number(ci)); else if (ci) errors.push('Check-in must be a number of minutes.');
            c.stream = f('stream').trim();
        }
        saveData();
        if (interaction.isFromMessage()) await interaction.update(setupPanel(t));
        else await interaction.reply({ ...setupPanel(t), flags: 64 });
        if (errors.length) await interaction.followUp({ content: `⚠️ ${errors.join('\n')}\nTime examples: \`26/09 18:00\`, \`2026-09-26 18:00\`, \`18:00\`, \`18:00 CET\`, \`in 1d 4h\`.`, flags: 64 });
    }

    async function handleJoin(interaction, t) {
        const uid = interaction.user.id;
        const db = getDb();
        if (t.status !== 'signup' || Date.now() >= t.config.signupCloseAt) return interaction.reply({ content: '❌ Sign-ups are closed.', flags: 64 });
        if (!db.players[uid]) return interaction.reply({ content: '❌ Apply first (APPLY NOW in the dashboard) so we know your in-game name.', flags: 64 });
        if (db.blacklist.includes(uid)) return interaction.reply({ content: '❌ You are blacklisted.', flags: 64 });
        if (!tierAllowed(t, uid)) return interaction.reply({ content: `❌ This tournament is for **${tierLimitText(t.config)}** in ${t.config.gamemode}. Your tier: ${rankOf(uid, t.config.gamemode) || 'unranked'}.`, flags: 64 });
        const existing = findEntryOf(t, uid);
        if (existing?.pending) return interaction.reply({ content: `⏳ You have a team invite waiting for <@${existing.pendingPartner === uid ? existing.members[0] : existing.pendingPartner}>. It has to be accepted or declined first.`, flags: 64 });
        if (existing) return interaction.reply({ content: '✅ You\'re already signed up.', flags: 64 });
        if (t.config.teamSize === 2) {
            const row = new ActionRowBuilder().addComponents(new UserSelectMenuBuilder().setCustomId(`tn:partner:${t.id}`).setPlaceholder('Pick your teammate').setMaxValues(1));
            return interaction.reply({ content: '👥 This is a **2v2** tournament. Pick your teammate - they\'ll get a DM to accept.', components: [row], flags: 64 });
        }
        const result = await withLock(t, async () => {
            const r = await addEntry(t, { id: uid, members: [uid], name: db.players[uid].username, checkedIn: false });
            saveData();
            return r;
        });
        const pos = result === 'entered' ? `Spot **${t.slots.indexOf(uid) + 1}/${t.config.size}**` : `Waitlist **#${t.waitlist.indexOf(uid) + 1}** (you get in if someone leaves or misses check-in)`;
        const tier = rankOf(uid, t.config.gamemode);
        await interaction.reply({ content: `✅ You're in **${t.config.name}**. ${pos}, registered as **${db.players[uid].username}**${tier ? ` (your ${t.config.gamemode} tier ${tier})` : ''}.\n${t.config.checkinMinutes ? `You'll get a DM to check in ${t.config.checkinMinutes} min before the start.` : ''} Your first match comes as a DM with a button into your match room.`, flags: 64 });
        await updateAnnouncement(t);
    }

    async function handlePartner(interaction, t) {
        const uid = interaction.user.id, pid = interaction.values[0];
        const db = getDb();
        if (pid === uid) return interaction.update({ content: '❌ Pick someone else as your teammate.', components: [] });
        if (!db.players[pid]) return interaction.update({ content: '❌ Your teammate needs to apply first.', components: [] });
        if (db.blacklist.includes(pid) || !tierAllowed(t, pid)) return interaction.update({ content: '❌ Your teammate can\'t join this tournament (blacklisted or outside the tier limit).', components: [] });
        if (findEntryOf(t, uid) || findEntryOf(t, pid)) return interaction.update({ content: '❌ One of you is already signed up or has a pending invite.', components: [] });
        t.entries[`p${uid}`] = { id: `p${uid}`, members: [uid], pendingPartner: pid, name: '', checkedIn: false, pending: true };
        saveData();
        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`tn:team:${t.id}:${uid}:yes`).setLabel('Accept').setEmoji('✅').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`tn:team:${t.id}:${uid}:no`).setLabel('Decline').setStyle(ButtonStyle.Secondary)
        );
        const sent = await dm(pid, { content: `👥 **${db.players[uid].username}** wants you as their teammate in **${t.config.name}** (2v2 ${t.config.gamemode}).`, components: [row] });
        if (!sent) { delete t.entries[`p${uid}`]; saveData(); return interaction.update({ content: `❌ Couldn't DM <@${pid}>. Ask them to allow DMs from server members, then try again.`, components: [] }); }
        return interaction.update({ content: `📨 Invite sent to <@${pid}>. Your team is signed up once they accept.`, components: [] });
    }

    async function handleTeamReply(interaction, t, captainId, yes) {
        const pending = t.entries[`p${captainId}`];
        if (!pending || pending.pendingPartner !== interaction.user.id) return interaction.update({ content: '❌ This invite is no longer valid.', components: [] });
        delete t.entries[`p${captainId}`];
        if (!yes) { saveData(); await dm(captainId, `❌ <@${interaction.user.id}> declined your team invite for **${t.config.name}**.`); return interaction.update({ content: 'Invite declined.', components: [] }); }
        if (t.status !== 'signup' || Date.now() >= t.config.signupCloseAt) { saveData(); return interaction.update({ content: '❌ Sign-ups closed before you accepted.', components: [] }); }
        const db = getDb();
        const result = await withLock(t, async () => {
            const r = await addEntry(t, { id: captainId, members: [captainId, interaction.user.id], name: `${db.players[captainId]?.username} & ${db.players[interaction.user.id]?.username}`, checkedIn: false });
            saveData();
            return r;
        });
        const msg = `✅ Team **${t.entries[captainId].name}** is ${result === 'entered' ? 'in' : 'on the waitlist for'} **${t.config.name}**.`;
        await interaction.update({ content: msg, components: [] });
        await dm(captainId, msg);
        await updateAnnouncement(t);
    }

    async function handleRef(interaction, t, mid, action) {
        const m = findMatch(t, mid);
        if (!m) return interaction.reply({ content: '❌ Match not found.', flags: 64 });
        const uid = interaction.user.id;
        const playing = [...entryMembers(t, m.a), ...entryMembers(t, m.b)].includes(uid);
        const allowed = !playing && (uid === m.refereeId || canManage(interaction.member, t));
        if (!allowed) return interaction.reply({ content: '❌ Only the referee of this match (or the host/staff) can use these buttons.', flags: 64 });
        if (m.status !== 'live') return interaction.reply({ content: '❌ This match is already over.', flags: 64 });

        if (['nsa', 'nsb', 'dqa', 'dqb'].includes(action)) {
            const side = action.endsWith('a') ? 'a' : 'b';
            const what = action.startsWith('ns') ? 'did not show' : 'is disqualified';
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tn:ref:${t.id}:${m.id}:${action}!`).setLabel(`Yes, ${entryName(t, m[side])} ${what}`).setStyle(ButtonStyle.Danger)
            );
            return interaction.reply({ content: `Are you sure? **${entryName(t, m[side === 'a' ? 'b' : 'a'])}** will win this match.`, components: [row], flags: 64 });
        }
        return withLock(t, async () => {
            if (m.status !== 'live') return interaction.reply({ content: '❌ This match is already over.', flags: 64 });
            const need = neededWins(m);
            if (action === 'pa' || action === 'pb') {
                if (m.winsA >= need || m.winsB >= need) return interaction.reply({ content: 'Someone already won - press End match or Undo.', flags: 64 });
                if (action === 'pa') m.winsA++; else m.winsB++;
                m.log.push(action === 'pa' ? 'a' : 'b');
                m.predictLocked = true;
                saveData();
                await interaction.update(refereePanel(t, m));
                await Promise.all([updateLive(t), updateBracket(t)]);
                return;
            }
            if (action === 'undo') {
                const last = m.log.pop();
                if (last === 'a') m.winsA--; else if (last === 'b') m.winsB--;
                saveData();
                await interaction.update(refereePanel(t, m));
                await Promise.all([updateLive(t), updateBracket(t)]);
                return;
            }
            if (action === 'end') {
                const side = m.winsA >= need ? 'a' : m.winsB >= need ? 'b' : null;
                if (!side) return interaction.reply({ content: `Nobody has ${need} rounds yet.`, flags: 64 });
                await interaction.update(refereePanel(t, { ...m, status: 'done' }));
                await finishMatch(t, m, side, `${m.winsA}–${m.winsB}`);
                return;
            }
            if (action.endsWith('!')) {
                const base = action.slice(0, -1);
                const loserSide = base.endsWith('a') ? 'a' : 'b';
                const winSide = loserSide === 'a' ? 'b' : 'a';
                await interaction.update({ content: '✅ Done.', components: [] });
                const panelMsg = interaction.channel ? (await interaction.channel.messages.fetch({ limit: 20 }).catch(() => null))?.find(x => x.author.id === client.user.id && x.embeds[0]?.footer?.text?.endsWith(m.id)) : null;
                await finishMatch(t, m, winSide, base.startsWith('ns') ? 'no-show' : 'DQ');
                if (panelMsg) await panelMsg.edit(refereePanel(t, m)).catch(() => {});
                return;
            }
        });
    }

    async function handlePredict(interaction, t) {
        const uid = interaction.user.id;
        const open = allMatches(t).filter(m => m.a && m.b && !m.predictLocked && ['waiting', 'live'].includes(m.status)
            && !entryMembers(t, m.a).includes(uid) && !entryMembers(t, m.b).includes(uid));
        if (!open.length) return interaction.reply({ content: '🔮 No matches are open for predictions right now. Predictions close when the first round of a match is played.', flags: 64 });
        const select = new StringSelectMenuBuilder().setCustomId(`tn:predm:${t.id}`).setPlaceholder('Pick a match')
            .addOptions(open.slice(0, 25).map(m => {
                const mine = t.predictions?.[m.id]?.[uid];
                return { label: trunc(`${matchLabel(t, m)} · ${entryName(t, m.a)} vs ${entryName(t, m.b)}`, 100), value: m.id, description: mine ? `Your pick: ${entryName(t, mine)}` : 'No pick yet' };
            }));
        const score = t.predictionScore?.[uid] || 0;
        return interaction.reply({ content: `🔮 Pick a match, then who wins. You have **${score}** correct so far. The best predictor gets **${ORACLE_ROLE}** for ${ORACLE_DAYS} days.`, components: [new ActionRowBuilder().addComponents(select)], flags: 64 });
    }

    // Returns true if the interaction belonged to the tournament system.
    async function handleInteraction(interaction) {
        if (interaction.isChatInputCommand()) {
            if (interaction.commandName !== 'tournament' && interaction.commandName !== 'tournaments') return false;
            await handleCommand(interaction);
            return true;
        }
        const cid = interaction.customId || '';
        if (!cid.startsWith('tn:')) return false;
        const parts = cid.split(':');
        const kind = parts[1];
        const t = store().list[parts[2]];
        if (!t) { await interaction.reply({ content: '❌ This tournament no longer exists.', flags: 64 }); return true; }

        if (kind === 'cfg') { await handleConfig(interaction, t, parts[3]); return true; }
        if (kind === 'mod') { await handleModal(interaction, t, parts[3]); return true; }
        if (kind === 'join') { await handleJoin(interaction, t); return true; }
        if (kind === 'partner') { await handlePartner(interaction, t); return true; }
        if (kind === 'team') { await handleTeamReply(interaction, t, parts[3], parts[4] === 'yes'); return true; }
        if (kind === 'ref') { await handleRef(interaction, t, parts[3], parts[4]); return true; }
        if (kind === 'predict') { await handlePredict(interaction, t); return true; }
        if (kind === 'leave' || kind === 'cantmake') {
            const entry = findEntryOf(t, interaction.user.id);
            if (!entry) { await interaction.reply({ content: '❌ You\'re not signed up.', flags: 64 }); return true; }
            if (!['signup', 'checkin'].includes(t.status)) { await interaction.reply({ content: '❌ The tournament has started - ask the referee or host if you need to drop out.', flags: 64 }); return true; }
            if (kind === 'cantmake') await interaction.update({ content: `👋 You left **${t.config.name}**. Your spot goes to the waitlist.`, components: [] });
            else await interaction.reply({ content: `🚪 You left **${t.config.name}**.`, flags: 64 });
            await withLock(t, async () => { await removeEntry(t, entry.id); saveData(); });
            await updateAnnouncement(t);
            return true;
        }
        if (kind === 'checkin') {
            const entry = findEntryOf(t, interaction.user.id);
            if (!entry || entry.pending) { await interaction.update({ content: '❌ You\'re not in this tournament anymore.', components: [] }); return true; }
            if (t.status !== 'checkin') { await interaction.update({ content: t.status === 'signup' ? 'Check-in isn\'t open yet.' : '❌ Check-in is closed.', components: [] }); return true; }
            entry.checkedIn = true;
            saveData();
            const onWait = t.waitlist.includes(entry.id);
            await interaction.update({ content: `✅ Checked in for **${t.config.name}**${onWait ? ' (waitlist - you\'ll get in if a spot opens)' : ''}. It starts ${ts(t.config.startAt, 'R')}.`, components: [] });
            return true;
        }
        if (kind === 'players') {
            const fmt = (id, i) => `${i + 1}. ${entryName(t, id)}${t.status === 'checkin' ? (t.entries[id]?.checkedIn ? ' ✅' : ' ⏳') : ''}${t.seeds?.[id] ? ` · seed ${t.seeds[id]}` : ''}`;
            const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(`👥 ${t.config.name}`)
                .setDescription(trunc(t.slots.map(fmt).join('\n') || '*Nobody yet*', 4000))
                .setFooter({ text: `${t.slots.length}/${t.config.size} ${unit(t)}${t.status === 'checkin' ? ' · ✅ checked in · ⏳ not yet' : ''}` });
            if (t.waitlist.length) embed.addFields({ name: `⏳ Waitlist (${t.waitlist.length})`, value: trunc(t.waitlist.map(fmt).join('\n'), 1000) });
            await interaction.reply({ embeds: [embed], flags: 64 });
            return true;
        }
        if (kind === 'rules') {
            const c = t.config;
            const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(`📜 Rules · ${c.name}`)
                .setDescription([
                    `**Format:** ${formatText(c)}`,
                    `**Gamemode:** ${c.gamemode}${c.server ? ` on **${c.server}**` : ''}`,
                    `**Referees** decide every result in a private match room. Be there within ${NO_SHOW_MINUTES} minutes of the DM or you can be marked as a no-show.`,
                    c.checkinMinutes ? `**Check-in** opens ${c.checkinMinutes} minutes before the start. Miss it and the waitlist takes your spot.` : '',
                    '', c.rules || '*No extra rules.*'
                ].filter(x => x !== null).join('\n'));
            await interaction.reply({ embeds: [embed], flags: 64 });
            return true;
        }
        if (kind === 'bracket') {
            if (!t.rounds) { await interaction.reply({ content: 'The bracket is made when sign-ups close and the tournament starts.', flags: 64 }); return true; }
            await interaction.deferReply({ flags: 64 });
            const mineEntry = findEntryOf(t, interaction.user.id);
            const img = await renderBracketImage(t, mineEntry && !mineEntry.pending ? mineEntry.id : null);
            const e = bracketEmbed(t, !!img);
            if (img && mineEntry) e.setDescription(`Your matches are outlined in **blue**.${t.status === 'running' ? (allMatches(t).some(m => m.status !== 'done' && (m.a === mineEntry.id || m.b === mineEntry.id)) ? ' You\'re still in!' : ' You\'ve been knocked out, GG.') : ''}`);
            await interaction.editReply({ embeds: [e], files: img ? [img] : [] });
            return true;
        }
        if (kind === 'predm') {
            const m = findMatch(t, interaction.values[0]);
            if (!m || m.predictLocked || m.status === 'done') { await interaction.update({ content: '❌ Predictions for that match are closed.', components: [] }); return true; }
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tn:pick:${t.id}:${m.id}:a`).setLabel(trunc(entryName(t, m.a), 80)).setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId(`tn:pick:${t.id}:${m.id}:b`).setLabel(trunc(entryName(t, m.b), 80)).setStyle(ButtonStyle.Primary)
            );
            await interaction.update({ content: `🔮 **${matchLabel(t, m)}**: who wins?`, components: [row] });
            return true;
        }
        if (kind === 'pick') {
            const m = findMatch(t, parts[3]);
            if (!m || m.predictLocked || m.status === 'done') { await interaction.update({ content: '❌ Too late - this match already started.', components: [] }); return true; }
            t.predictions ??= {};
            t.predictions[m.id] ??= {};
            t.predictions[m.id][interaction.user.id] = parts[4] === 'a' ? m.a : m.b;
            saveData();
            const sp = predictionSplit(t, m);
            await interaction.update({ content: `🔮 You picked **${entryName(t, t.predictions[m.id][interaction.user.id])}** for ${matchLabel(t, m)}. Fans so far: ${entryName(t, m.a)} ${sp.pa}% · ${entryName(t, m.b)} ${sp.pb}%.`, components: [] });
            await updateLive(t);
            return true;
        }
        return false;
    }

    // ---------- profile + public API ----------
    function profileSummary(uid) {
        const s = getDb().tournamentStats?.[uid];
        const titles = Object.entries(store().champions).filter(([, ch]) => ch.members.includes(uid)).map(([gm]) => championRoleName(gm));
        if (!s && !titles.length) return null;
        return {
            badges: titles,
            line: s ? `${s.won} won · ${s.finals} finals · ${s.matchWins}–${s.matchLosses} matches${s.predictionsCorrect ? ` · 🔮 ${s.predictionsCorrect} correct picks` : ''}` : null,
            pastTitles: s?.titles?.length || 0
        };
    }

    const gamemodeChoices = GAMEMODE_ORDER.map(g => ({ name: g, value: g }));
    const idOpt = { name: 'id', type: 3, description: 'Tournament ID (from /tournament list) - optional if only one is active', required: false };
    const commands = [
        {
            name: 'tournament', description: 'Run or view tournaments', options: [
                { type: 1, name: 'create', description: '[Host] Start a new tournament (opens a private setup panel)', options: [
                    { name: 'name', type: 3, description: 'Tournament name', required: false },
                    { name: 'gamemode', type: 3, description: 'Gamemode', required: false, choices: gamemodeChoices },
                    { name: 'template', type: 3, description: 'Start from a saved template (see /tournament templates)', required: false }
                ] },
                { type: 1, name: 'edit', description: '[Host] Change settings before check-in', options: [idOpt] },
                { type: 1, name: 'start', description: '[Host] Start now instead of waiting for the start time', options: [idOpt] },
                { type: 1, name: 'cancel', description: '[Host] Cancel a tournament (everyone gets a DM)', options: [idOpt, { name: 'reason', type: 3, description: 'Reason shown to players', required: false }] },
                { type: 1, name: 'kick', description: '[Host] Remove a player or team', options: [{ name: 'player', type: 6, description: 'Player', required: true }, idOpt] },
                { type: 1, name: 'setwinner', description: '[Host] Decide a match (e.g. if the referee left)', options: [
                    { name: 'match', type: 3, description: 'Match label from the bracket, e.g. QF2, SF1, Final', required: true },
                    { name: 'player', type: 6, description: 'Winning player (or a member of the winning team)', required: true }, idOpt
                ] },
                { type: 1, name: 'list', description: 'Show active tournaments and their IDs' },
                { type: 1, name: 'timezone', description: '[Host] Set your timezone (used when you type tournament times)', options: [
                    { name: 'zone', type: 3, description: 'Where you are', required: true, choices: TIMEZONE_CHOICES.map(([name, value]) => ({ name, value })) }
                ] },
                { type: 1, name: 'setup', description: '[Admin] Create/repair the tournament channels (safe to run again)', options: [
                    { name: 'verified_role', type: 8, description: 'Role that can see the channels (default: a role named Verified)', required: false }
                ] },
                { type: 1, name: 'templates', description: '[Host] Show saved templates' }
            ]
        },
        { name: 'tournaments', description: 'Current champions for every gamemode' }
    ];

    return {
        commands,
        roleNames: [HOST_ROLE, REFEREE_ROLE, PING_ROLE],
        handleInteraction,
        profileSummary,
        activeSummary: () => activeList().filter(t => t.status !== 'draft').map(t => `${t.config.name} (${t.config.gamemode}, ${statusLabel(t)}, ${t.slots.length}/${t.config.size} ${unit(t)}, starts ${new Date(t.config.startAt).toUTCString()})`).join('; '),
        championsSummary: () => Object.entries(store().champions).map(([gm, ch]) => `${gm}: ${ch.name}`).join(', '),
        start() {
            store();
            setInterval(() => tick().catch(e => console.error('[Tournament] tick failed:', e)), TICK_MS);
            tick().catch(e => console.error('[Tournament] tick failed:', e));
            console.log(`🏆 Tournaments ready (${activeList().length} active)`);
        },
        _test: { renderBracketImage, tick, parseTime, resolveZone, worldClock, wallToUtc, formatLocal, seedOrder, buildBracket, advance, parseTierLimit, bracketText, matchLabel, resolveForfeits }
    };
};
