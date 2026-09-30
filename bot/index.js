require('dotenv').config();
const { Client, GatewayIntentBits, REST, Routes, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, PermissionsBitField, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const fs = require('fs');
const express = require('express');

// ==================== GROQ AI CONFIG ====================
const GROQ_API_KEY = process.env.GROQ_API_KEY;
// llama-3.3-70b-versatile was decommissioned by Groq (404 model_not_found).
// Using a primary + fallback list so a single future deprecation can't
// silently break the AI assistant again - it'll just quietly move down
// the list instead of failing every request.
const GROQ_MODELS = ['llama-3.1-8b-instant', 'meta-llama/llama-4-scout-17b-16e-instruct', 'llama-3.3-70b-versatile'];
const AI_CHANNEL_NAME = '🤖・mcbpvp-assistant';

let geminiClient = null;
let aiContext = {};

async function initGemini() {
    if (!GROQ_API_KEY) {
        console.error('❌ GROQ_API_KEY is missing from .env — AI will not respond. Add GROQ_API_KEY=your_key to your .env file.');
        geminiClient = null;
        return;
    }
    geminiClient = true;
    console.log('✅ AI (Groq) initialized successfully');
}

// ==================== AI SYSTEM PROMPT WITH LIVE DATA ====================
async function getAIResponse(userId, message, guild) {
    if (!geminiClient) return null;
    
    try {
        if (!aiContext[userId]) {
            aiContext[userId] = [];
        }
        
        if (aiContext[userId].length > 10) {
            aiContext[userId] = aiContext[userId].slice(-10);
        }
        
        // Get live database data for this user
        const playerData = db.players[userId];
        const userQueuePositions = [];
        for (const gm of GAMEMODES) {
            const q = db.queues[gm.name];
            if (q) {
                const pos = q.waiting.indexOf(userId);
                if (pos !== -1) {
                    userQueuePositions.push({ gamemode: gm.name, position: pos + 1, total: q.waiting.length });
                }
            }
        }
        
        // Get server list
        const servers = db.testServers || [];
        const serverList = servers.map((s, i) => `${i+1}. ${s.ip}:${s.port}`).join('\n') || 'No test servers configured.';
        
        // Get player stats
        const totalPoints = calculateTotalPoints(userId);
        const title = getTitleFromPoints(totalPoints);
        const position = getPlayerPosition(userId);
        
        // Get gamemode ranks
        const ranks = {};
        for (const gm of GAMEMODE_ORDER) {
            ranks[gm] = playerData?.gamemodeRanks?.[gm] || 'Unranked';
        }
        
        // Get queue info
        const queueInfo = userQueuePositions.length ? 
            userQueuePositions.map(q => `${q.gamemode}: #${q.position}/${q.total}`).join(', ') : 
            'Not in any queue';

        // ===== COMMUNITY-WIDE DATA (so the bot knows the server, not just this user) =====
        const totalPlayers = Object.keys(db.players).length;
        const totalTesters = Object.keys(db.testers || {}).length;
        const allPlayersSorted = Object.entries(db.players)
            .map(([id, p]) => ({ id, username: p.username, points: calculateTotalPoints(id) }))
            .sort((a, b) => b.points - a.points);
        const topPlayer = allPlayersSorted[0];
        const gamemodeLeaders = GAMEMODE_ORDER.map(gm => {
            let best = null;
            for (const [id, p] of Object.entries(db.players)) {
                const rank = p.gamemodeRanks?.[gm];
                if (!rank) continue;
                const rv = DISPLAY_ORDER.indexOf(rank);
                if (!best || rv < best.rv) best = { username: p.username, rank, rv };
            }
            return best ? `${gm}: ${best.username} (${best.rank})` : null;
        }).filter(Boolean).join(', ') || 'No ranked players yet';
        const queueSizes = GAMEMODE_ORDER.map(gm => `${gm}: ${db.queues[gm]?.waiting?.length || 0} waiting`).join(', ');

        // ===== SYSTEM PROMPT WITH LIVE DATA =====
        const systemPrompt = `You are MCBPVP BOT, the AI assistant for MCBPVP Club — and you actually know this community, not just canned lines.

CURRENT LIVE DATA FOR THIS USER (${userId}):
- Discord: ${guild?.members?.cache?.get(userId)?.user?.username || 'Unknown'}
- Total Points: ${totalPoints}
- Title: ${title.name}
- Overall Rank: #${position}
- Gamemode Ranks: ${Object.entries(ranks).map(([gm, r]) => `${gm}: ${r}`).join(', ')}
- Queue Positions: ${queueInfo}
- Test History: ${playerData?.testHistory?.length || 0} tests completed
- Strikes: ${playerData?.strikes || 0}/${STRIKE_BAN_LIMIT}
- Blacklisted: ${db.blacklist.includes(userId) ? '⚠️ Yes' : '✅ No'}

COMMUNITY-WIDE DATA (use this to answer questions about the server, other players, or standings — you have live access to this):
- Total registered players: ${totalPlayers}
- Total certified testers: ${totalTesters}
- #1 overall player: ${topPlayer ? `${topPlayer.username} (${topPlayer.points} pts)` : 'Nobody ranked yet'}
- Current gamemode leaders: ${gamemodeLeaders}
- Current queue sizes: ${queueSizes}

AVAILABLE TEST SERVERS:
${serverList}

Your personality:
- Talk like an actual person in the Discord who's genuinely plugged into this community, not a script reading off a data sheet
- You know the standings, who's good at what, and what's going on — speak like it
- Vary how you open replies — don't default to the same phrase every time, react to what they actually said
- Use casual contractions (you're, it's, don't) and low-key slang where it fits naturally
- It's fine to be a little blunt or funny — you're not a customer service bot
- Never repeat the same phrasing you used earlier in the conversation

RULES:
1. Match the reply length to the question — a quick question gets a quick answer, but if something needs explaining, actually explain it properly. Don't artificially chop answers short or pad short answers with fluff.
2. For actions with buttons → "Click the [button] in [channel]"
3. Only mention commands for things WITHOUT buttons
4. Don't repeat yourself across messages
5. If someone has an issue → "Make a ticket in <#1490796802717257879>"
6. Use the LIVE DATA above to answer questions accurately, but don't recite it like a stat sheet — work it into a normal sentence

KEY KNOWLEDGE:
- Tier: LT5 → MT5 → HT5 → LT4 → MT4 → HT4 → LT3 → MT3 → HT3 → LT2 → MT2 → HT2 → LT1 → MT1 → HT1
- LT5 = lowest, HT1 = highest
- LT promo = +5 pts, HT promo = +10 pts
- Points can't go below 0
- 11 gamemodes: Sword, Axe, No Axe, Mace HT, Mace LT, Nethpot, Crystal, Mace-Sphere, UHC, SMP, Pot

BUTTONS (tell players to use these):
- APPLY NOW → in dashboard channel
- REQUEST TEST → in request-test channel
- MY PROFILE → in dashboard channel
- Verify Pack → in test channel
- Start Test → in test channel
- Done → in test channel
- Close Ticket → in test channel
- Refresh → in queue channel
- My Position → in queue channel
- Leave Queue → in queue channel
- Filter by Tier → in leaderboard channel

COMMANDS (only mention these):
- /claim @player (testers only)
- /done (testers only)
- /autotest [gamemode] (testers only)
- /testertest player:@user gamemode:mode (admin only)
- /addtestserver ip port (admin only)

BANNED MODS:
1. Hitbox - See through walls
2. Client - Unfair advantages
3. Auto Clicker - Auto clicking
4. Kill Aura - Auto attacks
5. Auto Range - Auto attacks
6. Speed Hacks - Unfair speed
7. Fly Hacks - Unfair flight
8. Reach Hacks - Extended range
9. X-Ray - See through blocks
10. ESP - See players through walls

MCBPVP KNOWLEDGE:
- We're a Bedrock PvP community
- We test players to rank them up
- Official server coming soon
- Have 11 gamemodes
- All tests are done by certified testers

Always be cool, knowledgeable, and genuinely helpful — like a friend who's actually part of this community!`;

        // Build message history for the chat API
        const historyMessages = aiContext[userId].map(msg => ({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text
        }));

        let groqResponse, errBody = '';
        for (const model of GROQ_MODELS) {
            groqResponse = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GROQ_API_KEY}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: model,
                    messages: [
                        { role: 'system', content: systemPrompt },
                        ...historyMessages,
                        { role: 'user', content: message }
                    ],
                    temperature: 0.9,
                    max_tokens: 500
                })
            });
            if (groqResponse.ok) break;
            errBody = await groqResponse.text().catch(() => '');
            // Only fall through to the next model if this one is dead/renamed -
            // any other error (rate limit, bad request, etc) should stop immediately
            // rather than burning through the whole list pointlessly.
            if (!errBody.includes('model_not_found')) break;
            console.error(`[Groq] Model ${model} unavailable, trying next fallback...`);
        }

        if (!groqResponse.ok) {
            console.error(`[Groq] API error ${groqResponse.status}:`, errBody);
            return null;
        }

        const data = await groqResponse.json();
        const responseText = data.choices?.[0]?.message?.content || 'I had trouble processing that. Could you try again?';
        
        aiContext[userId].push({ role: 'user', text: message });
        aiContext[userId].push({ role: 'model', text: responseText });
        
        return responseText;
    } catch (error) {
        console.error('AI Error:', error);
        return null;
    }
}

// ==================== KEEP-ALIVE SERVER ====================
const keepAliveApp = express();
keepAliveApp.get('/', (req, res) => res.send('Bot is alive!'));
keepAliveApp.listen(process.env.SERVER_PORT || process.env.PORT || 3000, () => console.log('🌐 Server running'));

// ==================== MCBPVP-CORE (Minecraft plugin) BRIDGE ====================
// Lets the Minecraft server ask "what rank does this player have in Sword?"
// and report Rookie -> LT5 auto-promotions. Does not touch anything else.

const MCBPVP_SECRET = process.env.MCBPVP_SECRET || 'CHANGE-ME-TO-A-LONG-RANDOM-STRING';

keepAliveApp.use(express.json());

function checkMcbpvpAuth(req, res) {
    if (req.headers['x-mcbpvp-secret'] !== MCBPVP_SECRET) {
        res.status(401).json({ error: 'unauthorized' });
        return false;
    }
    return true;
}

// GET all 11 gamemode ranks for a player (by their Discord ID)
keepAliveApp.get('/mcbpvp/player/:discordId', (req, res) => {
    if (!checkMcbpvpAuth(req, res)) return;
    const player = db.players[req.params.discordId];
    const ranks = {};
    for (const gm of GAMEMODE_ORDER) {
        ranks[gm] = player?.gamemodeRanks?.[gm] || 'Rookie';
    }
    res.json({
        discordId: req.params.discordId,
        ranks,
        totalPoints: calculateTotalPoints(req.params.discordId),
        title: getTitleFromPoints(calculateTotalPoints(req.params.discordId)).name
    });
});

// GET a single gamemode's rank
keepAliveApp.get('/mcbpvp/rank/:discordId/:gamemode', (req, res) => {
    if (!checkMcbpvpAuth(req, res)) return;
    const player = db.players[req.params.discordId];
    const rank = player?.gamemodeRanks?.[req.params.gamemode] || 'Rookie';
    res.json({ rank, points: getFixedPointsForRank(rank) });
});

// POST a Rookie -> LT5 auto-promotion (beat the ladder leader, or 5-win streak).
// Only fires if the player is still Rookie in that gamemode - never overwrites
// an existing tester-assigned rank.
keepAliveApp.post('/mcbpvp/promote-rookie', (req, res) => {
    if (!checkMcbpvpAuth(req, res)) return;
    const { discordId, gamemode, reason } = req.body;
    if (!discordId || !GAMEMODE_ORDER.includes(gamemode)) {
        return res.status(400).json({ error: 'bad request' });
    }
    if (!db.players[discordId]) db.players[discordId] = {};
    if (!db.players[discordId].gamemodeRanks) db.players[discordId].gamemodeRanks = {};

    const current = db.players[discordId].gamemodeRanks[gamemode];
    if (current && current !== 'Rookie') {
        return res.json({ promoted: false, reason: 'already ranked', currentRank: current });
    }

    db.players[discordId].gamemodeRanks[gamemode] = 'LT5';
    if (!db.players[discordId].gamemodePoints) db.players[discordId].gamemodePoints = {};
    db.players[discordId].gamemodePoints[gamemode] = getFixedPointsForRank('LT5');
    saveData();

    console.log(`[MCBPVP Bridge] Promoted ${discordId} to LT5 in ${gamemode} (${reason})`);
    res.json({ promoted: true, newRank: 'LT5' });
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildPresences
    ]
});

const TOKEN = process.env.TIER_BOT_TOKEN;
const GUILD_ID = process.env.GUILD_ID;
if (!TOKEN || !GUILD_ID) {
    console.error('❌ Missing TIER_BOT_TOKEN or GUILD_ID');
    process.exit(1);
}

const BOT_NAME = 'MCBPVP BOT';

// ==================== EMOJIS ====================
const GAMEMODE_SYMBOLS = {
    'Sword': '<:sword_custom:1506938208653410385>',
    'Axe': '<:axe_custom:1506940126650044437>',
    'No Axe': '<:noaxe_custom:1506941052072759326>',
    'Mace HT': '<:maceht_custom:1506940554909319248>',
    'Mace LT': '<:macelt_custom:1506940394150035577>',
    'Nethpot': '<:nethpot_custom:1506940205393903717>',
    'Crystal': '<:crystal_custom:1506939370312044554>',
    'Mace-Sphere': '<:macesphere_custom:1506940719972089969>',
    'UHC': '<:uhc_custom:1506940036904521810>',
    'SMP': '<:smp_custom:1506939443226083380>',
    'Pot': '<:pot_custom:1506940908988530699>'
};
function getGamemodeSymbol(gamemode) { return GAMEMODE_SYMBOLS[gamemode] || '🎮'; }

// ==================== NEW TIER SYSTEM ====================
const RANK_ORDER = ['LT5', 'MT5', 'HT5', 'LT4', 'MT4', 'HT4', 'LT3', 'MT3', 'HT3', 'LT2', 'MT2', 'HT2', 'LT1', 'MT1', 'HT1'];
// Derived from RANK_ORDER (best-first) instead of a separate hardcoded list,
// so it can never drift out of sync when the ladder changes again.
const DISPLAY_ORDER = [...RANK_ORDER].reverse();

const TIER_GROUPS = {
    'TIER 1': ['HT1', 'MT1', 'LT1'],
    'TIER 2': ['HT2', 'MT2', 'LT2'],
    'TIER 3': ['HT3', 'MT3', 'LT3'],
    'TIER 4': ['HT4', 'MT4', 'LT4'],
    'TIER 5': ['HT5', 'MT5', 'LT5']
};

function getTierFromRank(rank) {
    for (const [tier, ranks] of Object.entries(TIER_GROUPS)) {
        if (ranks.includes(rank)) return tier;
    }
    return null;
}

// ==================== CONFIGURATION ====================
const APPLICANT_ROLE = 'Combat Learner';
// Staff tiers: Tester (per-gamemode roles, handled elsewhere) < Mod < Admin.
// Create these two roles in Discord and assign them to your staff -
// no need to give anyone full server Administrator permission anymore.
const STAFF_ROLES = { ADMIN: 'Admin', MOD: 'Mod' };
const DASHBOARD_CHANNEL = '👤・dashboard';
const REQUEST_CHANNEL = '📬・request-test';
const QUEUE_CHANNEL = '⏳・queue';
const RESULTS_CHANNEL = '📜｜test-results';
const LOG_CHANNEL = '🔒｜staff-logs';
const LOGS_2_CHANNEL = '📋｜logs-2';
const TESTER_PANEL_CHANNEL = '🎮・test-panel';
const LEADERBOARD_CHANNEL = '🏆│leaderboards';
const TESTER_LIST_CHANNEL = '👥・testers';
const TICKET_CHANNEL_ID = '1490796802717257879';
const MAX_QUEUE_SIZE = 50;
const STRIKE_BAN_LIMIT = 7;
const MAX_PROFILE_EDITS = 2;
const DECAY_DAYS = 90;
const DECAY_POINTS = 20;

const CATEGORY_OVERRIDES = {
    'Sword': null,
    'Axe': null,
    'No Axe': null,
    'Mace HT': null,
    'Mace LT': null,
    'Nethpot': null,
    'Crystal': null,
    'Mace-Sphere': null,
    'UHC': null,
    'SMP': null,
    'Pot': null
};

const RANK_COLORS = {
    'LT5': 0x95a5a6, 'MT5': 0xbdc3c7, 'HT5': 0xf1c40f,
    'LT4': 0x7f8c8d, 'MT4': 0xf9ca24, 'HT4': 0xf39c12,
    'LT3': 0x95a5a6, 'MT3': 0xf6b93b, 'HT3': 0xe67e22,
    'LT2': 0x7f8c8d, 'MT2': 0xe58e26, 'HT2': 0xd35400,
    'LT1': 0x95a5a6, 'MT1': 0xd63031, 'HT1': 0xc0392b
};
const TITLES = [
    { name: 'Combat Learner', minPoints: 0, role: 'Combat Learner', image: 'https://cdn.discordapp.com/attachments/1491042296215506964/1506560043921834034/Picsart_26-05-20_12-54-04-858.png' },
    { name: 'Combat Cadet', minPoints: 150, role: 'Combat Cadet', image: 'https://cdn.discordapp.com/attachments/1491042296215506964/1506560298017099867/Picsart_26-05-20_12-55-32-940.png' },
    { name: 'Combat Ace', minPoints: 270, role: 'Combat Ace', image: 'https://cdn.discordapp.com/attachments/1491042296215506964/1506560343001006150/Picsart_26-05-20_12-56-04-206.png' },
    { name: 'Combat Master', minPoints: 405, role: 'Combat Master', image: 'https://cdn.discordapp.com/attachments/1491042296215506964/1506560205507399791/Picsart_26-05-20_12-55-03-739.png' },
    { name: 'Combat Grandmaster', minPoints: 495, role: 'Combat Grandmaster', image: 'https://cdn.discordapp.com/attachments/1491042296215506964/1506560118488039504/Picsart_26-05-20_12-54-34-377.png' }
];
const TITLE_IMAGES = Object.fromEntries(TITLES.map(t => [t.role, t.image]));
const GAMEMODE_ORDER = ['Sword', 'Axe', 'No Axe', 'Mace HT', 'Mace LT', 'Nethpot', 'Crystal', 'Mace-Sphere', 'UHC', 'SMP', 'Pot'];
const GAMEMODES = [
    { name: 'Sword', testerRole: 'Sword Tester' },
    { name: 'Axe', testerRole: 'Axe Tester' },
    { name: 'No Axe', testerRole: 'No Axe Tester' },
    { name: 'Mace HT', testerRole: 'Mace HT Tester' },
    { name: 'Mace LT', testerRole: 'Mace LT Tester' },
    { name: 'Nethpot', testerRole: 'Nethpot Tester' },
    { name: 'Crystal', testerRole: 'Crystal Tester' },
    { name: 'Mace-Sphere', testerRole: 'Mace-Sphere Tester' },
    { name: 'UHC', testerRole: 'UHC Tester' },
    { name: 'SMP', testerRole: 'SMP Tester' },
    { name: 'Pot', testerRole: 'Pot Tester' }
];
const GAMEMODE_CATEGORIES = Object.fromEntries(GAMEMODES.map(g => [g.name, `📁 ${g.name.toUpperCase()} TESTS`]));

// ==================== DATABASE ====================
let db = {
    players: {}, queues: {}, gamemodeImages: {}, queueMessages: {},
    staffNotes: {}, strikes: {}, blacklist: [], testers: {}, testerStats: {},
    activeTests: {},
    testServers: [],
    websiteSync: { enabled: false, apiUrl: null, apiKey: null },
    settings: {
        universalCooldown: 3,
        maxQueueSizePerGamemode: {},
        testServer: { ip: null, port: null }
    },
    commandPermissions: {}
};
const DATA_FILE = 'tierbot.json';
if (fs.existsSync(DATA_FILE)) {
    try {
        db = JSON.parse(fs.readFileSync(DATA_FILE));
    } catch(e) { console.error('Failed to load data:', e); }
}
if (!db.commandPermissions) db.commandPermissions = {};
if (!db.websiteSync) db.websiteSync = { enabled: false, apiUrl: null, apiKey: null };
if (!db.settings) db.settings = { universalCooldown: 3, maxQueueSizePerGamemode: {}, testServer: { ip: null, port: null } };
if (!db.players) db.players = {};
if (!db.queues) db.queues = {};
if (!db.gamemodeImages) db.gamemodeImages = {};
if (!db.staffNotes) db.staffNotes = {};
if (!db.strikes) db.strikes = {};
if (!db.blacklist) db.blacklist = [];
if (!db.testers) db.testers = {};
if (!db.testerStats) db.testerStats = {};
if (!db.activeTests) db.activeTests = {};
if (!db.queueMessages) db.queueMessages = {};
if (!db.testServers) db.testServers = [];
function saveData() { try { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2)); } catch(e) { console.error('Failed to save data:', e); } }

// ==================== BEDROCK SKIN AVATARS ====================
// This is a Bedrock/Geyser server, so most players never had a real Java
// skin - fetchSkinAvatar() above was silently returning the default Steve
// thumbnail for almost everyone via mc-heads.net. This fetches the actual
// Bedrock skin through GeyserMC's official Global API (verified working
// endpoints as of this build):
//   GET https://api.geysermc.org/v2/xbox/xuid/:gamertag -> { xuid }
//   GET https://api.geysermc.org/v2/skin/:xuid           -> { texture_id, ... }
async function fetchBedrockSkin(gamertag) {
    try {
        const fetch = (await import('node-fetch')).default;
        const xuidRes = await fetch(`https://api.geysermc.org/v2/xbox/xuid/${encodeURIComponent(gamertag)}`, { timeout: 5000 });
        if (!xuidRes.ok) return null;
        const { xuid } = await xuidRes.json();
        if (!xuid) return null;
        const skinRes = await fetch(`https://api.geysermc.org/v2/skin/${xuid}`, { timeout: 5000 });
        if (!skinRes.ok) return null;
        const skinData = await skinRes.json();
        if (!skinData.texture_id) return null;
        return { xuid, textureId: skinData.texture_id };
    } catch (e) {
        console.error(`[BedrockSkin] Failed for ${gamertag}:`, e.message);
        return null;
    }
}

// Renders just the head (base layer + hat overlay) from a full skin texture.
// Lazily requires @napi-rs/canvas and fails soft (returns null) if it isn't
// installed yet, so a missing dependency can never crash the whole bot -
// it just falls back to the default/Java thumbnail until installed.
async function renderBedrockHeadAvatar(textureId) {
    try {
        const { createCanvas, loadImage, GlobalFonts } = require('@napi-rs/canvas');
        const skinImg = await loadImage(`https://textures.minecraft.net/texture/${textureId}`);
        const canvas = createCanvas(128, 128);
        const ctx = canvas.getContext('2d');
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(skinImg, 8, 8, 8, 8, 0, 0, 128, 128);   // base head
        ctx.drawImage(skinImg, 40, 8, 8, 8, 0, 0, 128, 128);  // hat overlay
        return canvas.toBuffer('image/png');
    } catch (e) {
        console.error(`[BedrockSkin] Render failed for texture ${textureId}:`, e.message);
        return null;
    }
}

// Single source of truth for putting a player's avatar into any embed.
// Renders their real Bedrock head if we have a texture on file, otherwise
// falls back to the stored Java/mc-heads URL, otherwise default Steve.
async function getAvatarForEmbed(player) {
    if (player?.textureId) {
        const buffer = await renderBedrockHeadAvatar(player.textureId);
        if (buffer) {
            return { thumbnailUrl: 'attachment://avatar.png', files: [new AttachmentBuilder(buffer, { name: 'avatar.png' })] };
        }
    }
    return { thumbnailUrl: player?.skinUrl || 'https://mc-heads.net/avatar/Steve/64.png', files: [] };
}

// ==================== SKIN FETCHING ====================
async function fetchSkinAvatar(gamertag) {
    console.log(`[Skin] Fetching for: ${gamertag}`);
    const variations = [gamertag, gamertag.replace(/_$/, '')];
    const defaultSkin = 'https://mc-heads.net/avatar/Steve/64.png';
    const methods = [
        async (name) => {
            const fetch = (await import('node-fetch')).default;
            const url = `https://mc-heads.net/avatar/${name}/64.png`;
            const res = await fetch(url, { timeout: 5000 });
            if (res.ok) return url;
            return null;
        },
        async (name) => {
            const fetch = (await import('node-fetch')).default;
            const url = `https://mc-heads.net/avatar/.${name}/64.png`;
            const res = await fetch(url, { timeout: 5000 });
            if (res.ok) return url;
            return null;
        },
        async (name) => {
            const fetch = (await import('node-fetch')).default;
            const url = `https://minotar.net/avatar/${name}/64.png`;
            const res = await fetch(url, { timeout: 5000 });
            if (res.ok) return url;
            return null;
        },
        async (name) => {
            const fetch = (await import('node-fetch')).default;
            const url = `https://crafatar.com/avatars/${name}/64.png`;
            const res = await fetch(url, { timeout: 5000 });
            if (res.ok) return url;
            return null;
        },
        async (name) => {
            const fetch = (await import('node-fetch')).default;
            const xuidRes = await fetch(`https://api.geysermc.org/v2/xbox/xuid/${encodeURIComponent(name)}`, { timeout: 5000 });
            if (!xuidRes.ok) return null;
            const xuidData = await xuidRes.json();
            const xuid = xuidData.xuid;
            if (!xuid) return null;
            const skinRes = await fetch(`https://api.geysermc.org/v2/skin/${xuid}`, { timeout: 5000 });
            if (!skinRes.ok) return null;
            const skinData = await skinRes.json();
            const textureId = skinData.texture_id;
            if (!textureId) return null;
            return `https://textures.minecraft.net/texture/${textureId}`;
        },
        async (name) => {
            const fetch = (await import('node-fetch')).default;
            const url = `https://visage.surgeplay.com/face/64/${name}`;
            const res = await fetch(url, { timeout: 5000 });
            if (res.ok) return url;
            return null;
        }
    ];
    for (const name of variations) {
        for (const method of methods) {
            try {
                const result = await method(name);
                if (result) return result;
            } catch (e) { continue; }
        }
    }
    return defaultSkin;
}

// ==================== HELPER FUNCTIONS ====================
function calculateTotalPoints(playerId) {
    const player = db.players[playerId];
    if (!player) return 0;
    let total = 0;
    for (const gm of GAMEMODE_ORDER) {
        total += player.gamemodePoints?.[gm] || 0;
    }
    return total;
}

function getTitleFromPoints(points) {
    for (let i = TITLES.length-1; i>=0; i--) if (points >= TITLES[i].minPoints) return TITLES[i];
    return TITLES[0];
}

async function getRole(guild, name) { return guild.roles.cache.find(r => r.name === name); }

async function updateTitleRole(guild, userId) {
    const points = calculateTotalPoints(userId);
    const title = getTitleFromPoints(points);
    const member = await guild.members.fetch(userId).catch(()=>null);
    if (!member) return;
    for (const t of TITLES) {
        const role = await getRole(guild, t.role);
        if (role && member.roles.cache.has(role.id)) await member.roles.remove(role).catch(()=>{});
    }
    const newRole = await getRole(guild, title.role);
    if (newRole && !member.roles.cache.has(newRole.id)) await member.roles.add(newRole).catch(()=>{});
}

// Fixed points awarded for holding a given tier in a gamemode.
// This replaces the old delta/history-based system: your points for a
// gamemode are always exactly this value for whatever tier you currently
// hold there, independent of how many tests you've taken or in how many
// other gamemodes you've been tested.
const POINTS_BY_RANK = {
    'LT5': 1, 'MT5': 2, 'HT5': 3,
    'LT4': 4, 'MT4': 5, 'HT4': 6,
    'LT3': 8, 'MT3': 10, 'HT3': 12,
    'LT2': 15, 'MT2': 18, 'HT2': 22,
    'LT1': 28, 'MT1': 35, 'HT1': 45
};

function getFixedPointsForRank(rank) {
    return POINTS_BY_RANK[rank] || 0;
}

// Kept for backward compatibility with any old call sites; now just
// returns the point difference between the fixed values of two tiers.
function calculatePointsForRankChange(oldRank, newRank) {
    if (oldRank === newRank || !newRank || newRank === 'No upgrade' || newRank === 'no upgrade') {
        return 0;
    }
    const newIndex = RANK_ORDER.indexOf(newRank);
    if (newIndex === -1) return 0;
    return getFixedPointsForRank(newRank) - getFixedPointsForRank(oldRank);
}

function getPlayerPosition(playerId) {
    const all = Object.entries(db.players).map(([id])=>({id, points: calculateTotalPoints(id)}));
    all.sort((a,b)=>b.points - a.points);
    const pos = all.findIndex(p=>p.id===playerId)+1;
    return pos>0 ? pos : all.length+1;
}

async function setRank(guild, userId, newRank) {
    const member = await guild.members.fetch(userId).catch(()=>null);
    if (!member) return false;
    for (const rank of RANK_ORDER) {
        const r = await getRole(guild, rank);
        if (r && member.roles.cache.has(r.id)) await member.roles.remove(r).catch(()=>{});
    }
    const newR = await getRole(guild, newRank);
    if (newR) await member.roles.add(newR).catch(()=>{});
    if (db.players[userId]) { db.players[userId].rank = newRank; saveData(); }
    return true;
}

async function updateTesterStats(testerId) {
    if (!testerId) return;
    if (!db.testerStats[testerId]) db.testerStats[testerId] = { tests: 0, points: 0, lastTest: null };
    db.testerStats[testerId].tests += 1;
    db.testerStats[testerId].lastTest = Date.now();
    saveData();
}

function hasCommandPermission(interaction, commandName) {
    try {
        if (!db || !db.commandPermissions) return true;
        const allowedRoles = db.commandPermissions[commandName] || [];
        if (allowedRoles.length === 0) return true;
        if (!interaction || !interaction.member) return true;
        return interaction.member.roles.cache.some(r => allowedRoles.includes(r.id));
    } catch (error) {
        console.error('[hasCommandPermission] Error:', error);
        return true;
    }
}

// ==================== DECAY SYSTEM ====================
async function checkDecay(guild) {
    const now = Date.now();
    const decayPeriod = DECAY_DAYS * 24 * 60 * 60 * 1000;
    for (const [playerId, data] of Object.entries(db.players)) {
        let decayed = false;
        for (const gm of GAMEMODE_ORDER) {
            const lastTest = data.gamemodeLastTest?.[gm] || 0;
            if (lastTest && (now - lastTest) > decayPeriod) {
                const currentPoints = data.gamemodePoints?.[gm] || 0;
                if (currentPoints > 0) {
                    const newPoints = Math.max(0, currentPoints - DECAY_POINTS);
                    if (!data.gamemodePoints) data.gamemodePoints = {};
                    data.gamemodePoints[gm] = newPoints;
                    decayed = true;
                    data.gamemodeLastTest[gm] = now;
                    const member = await guild.members.fetch(playerId).catch(()=>null);
                    if (member) {
                        try {
                            await member.send(`⚠️ **Point Decay Notice**\nYou lost **${DECAY_POINTS} points** in **${gm}** due to inactivity over the last ${DECAY_DAYS} days. Current points: **${newPoints}**`);
                        } catch(e) {}
                    }
                }
            }
        }
        if (decayed) {
            await updateTitleRole(guild, playerId);
            saveData();
        }
    }
}

// ==================== QUEUE VIEWER ====================
let activeQueueViewer = null;
let currentQueueGamemode = 'Sword';

async function buildQueueEmbed(guild, gamemode) {
    const queue = db.queues[gamemode] || { waiting: [], testing: [] };
    const waiting = queue.waiting || [];
    let testing = queue.testing || [];

    const activeChannels = guild.channels.cache.filter(c => c.name.startsWith('test-'));
    const activeIds = new Set();
    activeChannels.forEach(ch => {
        const m = ch.topic?.match(/PlayerID: (\d+)/);
        if (m) activeIds.add(m[1]);
    });
    const cleaned = testing.filter(t => activeIds.has(t.userId));
    if (cleaned.length !== testing.length) {
        queue.testing = cleaned;
        saveData();
    }
    testing = cleaned;

    const gmData = GAMEMODES.find(g => g.name === gamemode);
    const testerRole = gmData ? await getRole(guild, gmData.testerRole) : null;
    let activeTesters = [];
    if (testerRole) {
        for (const member of testerRole.members.values()) {
            if (member.presence && member.presence.status !== 'offline') {
                activeTesters.push(member.displayName || member.user.username);
            }
        }
    }
    const activeTestersText = activeTesters.length ? activeTesters.join(' · ') : 'No active testers';

    const waitingText = waiting.length ? waiting.map((id, i) => {
        const p = db.players[id];
        return `\`#${i+1}\` ${p?.username || 'Unknown'}`;
    }).join('\n') : '*No players waiting*';

    const testingText = testing.length ? testing.map(t => {
        const p = db.players[t.userId];
        const tester = db.players[t.testerId];
        return `• ${p?.username || 'Unknown'} → ${tester?.username || 'Unknown'}`;
    }).join('\n') : '*No active tests*';

    const embed = new EmbedBuilder()
        .setColor(0x1a1a2e)
        .setTitle(`${getGamemodeSymbol(gamemode)} ${gamemode.toUpperCase()} QUEUE`)
        .setDescription([
            `**🟢 Active Testers (${activeTesters.length})**`,
            activeTestersText,
            '',
            `**🔴 Currently Testing (${testing.length})**`,
            testingText,
            '',
            `**⏳ Waiting Queue (${waiting.length}/${MAX_QUEUE_SIZE})**`,
            waitingText
        ].join('\n'))
        .setFooter({ text: `Updated ${new Date().toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' })}` })
        .setTimestamp();
    return embed;
}

function buildQueueComponents(gamemode) {
    const select = new StringSelectMenuBuilder()
        .setCustomId('queue_gamemode_menu')
        .setPlaceholder('Select a gamemode…')
        .addOptions(GAMEMODES.map(g => ({
            label: g.name,
            value: g.name,
            emoji: getGamemodeSymbol(g.name)
        })));

    const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
            .setCustomId(`queue_refresh:${gamemode}`)
            .setLabel('🔄 Refresh')
            .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
            .setCustomId(`queue_myposition:${gamemode}`)
            .setLabel('📍 My Position')
            .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
            .setCustomId(`queue_leave:${gamemode}`)
            .setLabel('🚪 Leave Queue')
            .setStyle(ButtonStyle.Danger)
    );
    const row2 = new ActionRowBuilder().addComponents(select);
    return [row1, row2];
}

async function deployQueueViewer(channel, gamemode = 'Sword') {
    const embed = await buildQueueEmbed(channel.guild, gamemode);
    const components = buildQueueComponents(gamemode);
    const msg = await channel.send({
        embeds: [embed],
        components,
        allowedMentions: { parse: ['users'] }
    });
    activeQueueViewer = { message: msg, gamemode };
    currentQueueGamemode = gamemode;
    return msg;
}

async function refreshQueueViewer(guild, gamemode = null) {
    if (!activeQueueViewer) return;
    const target = gamemode || activeQueueViewer.gamemode || 'Sword';
    const embed = await buildQueueEmbed(guild, target);
    const components = buildQueueComponents(target);
    await activeQueueViewer.message.edit({
        embeds: [embed],
        components,
        allowedMentions: { parse: ['users'] }
    }).catch(() => {});
    activeQueueViewer.gamemode = target;
    currentQueueGamemode = target;
}

async function updateQueueViewerAuto(guild, gamemode) {
    if (activeQueueViewer) await refreshQueueViewer(guild, gamemode);
}

// ==================== LEADERBOARD SYSTEM ====================
let activeLeaderboardMessage = null;
let currentLeaderboardGamemode = 'overall';
let currentLeaderboardPage = 1;
let currentTierFilter = null;

// Call this after ANY action that changes a player's tier/points (test
// completion, addtier, removetier, forcerank, reset, etc.) so the deployed
// leaderboard channel is never stale - no manual /refreshleaderboard needed.
// Edits the existing pinned leaderboard message in place - never sends a new one.
async function refreshDeployedLeaderboard(guild) {
    if (!activeLeaderboardMessage || !guild) return;
    await updateLeaderboardMessage({ guild }, currentLeaderboardGamemode, currentLeaderboardPage, false, null, currentTierFilter);
}

async function getGamemodeLeaderboardData(guild, gamemodeName, tierFilter = null) {
    const players = [];
    const memberCache = await guild.members.fetch().catch(() => guild.members.cache);
    for (const [id, data] of Object.entries(db.players)) {
        const member = memberCache.get(id) || null;
        const rank = data.gamemodeRanks?.[gamemodeName];
        if (!rank || !RANK_ORDER.includes(rank)) continue;
        if (tierFilter) {
            const tier = getTierFromRank(rank);
            if (tier !== tierFilter) continue;
        }
        const points = data.gamemodePoints?.[gamemodeName] || 0;
        players.push({
            id,
            username: data.username,
            displayName: member?.displayName || data.username,
            rank,
            points,
            rankValue: DISPLAY_ORDER.indexOf(rank)
        });
    }
    players.sort((a, b) => {
        if (a.rankValue !== b.rankValue) return a.rankValue - b.rankValue;
        return b.points - a.points;
    });
    return players;
}

async function formatLeaderboardEmbed(guild, gamemodeValue, page = 1, tierFilter = null) {
    const gamemodeName = getGamemodeDisplayName(gamemodeValue);
    const titleEmoji = gamemodeValue === 'overall' ? '🏆' : getGamemodeSymbol(gamemodeName);
    let title = `${titleEmoji} ${gamemodeName.toUpperCase()} LEADERBOARD`;
    let description = '';
    
    if (gamemodeValue === 'overall') {
        const players = [];
        const memberCache = await guild.members.fetch().catch(() => guild.members.cache);
        for (const [id, data] of Object.entries(db.players)) {
            const member = memberCache.get(id) || null;
            const points = calculateTotalPoints(id);
            const title = getTitleFromPoints(points);
            players.push({
                id,
                username: data.username,
                displayName: member?.displayName || data.username,
                points,
                title: title.name
            });
        }
        players.sort((a, b) => b.points - a.points);
        
        const pageSize = 20;
        const totalPages = Math.ceil(players.length / pageSize) || 1;
        const currentPage = Math.min(page, totalPages);
        const startIdx = (currentPage - 1) * pageSize;
        const pagePlayers = players.slice(startIdx, startIdx + pageSize);
        
        for (let i = 0; i < pageSize; i++) {
            const rank = startIdx + i + 1;
            const player = pagePlayers[i];
            let rankPrefix;
            if (rank === 1) rankPrefix = '🥇 ';
            else if (rank === 2) rankPrefix = '🥈 ';
            else if (rank === 3) rankPrefix = '🥉 ';
            else rankPrefix = `${rank}. `;
            if (!player) {
                description += `${rankPrefix}???\n\n`;
            } else {
                description += `${rankPrefix}**${player.displayName}** • PTS ${player.points}\n\n`;
            }
        }
        const footerText = `Page ${currentPage}/${totalPages} • Showing top ${Math.min(players.length,100)} of ${players.length} total players • Updated ${new Date().toLocaleDateString('en-GB')}`;
        const embed = new EmbedBuilder().setColor(0x2C2F33).setTitle(title).setDescription(description || '*No players to display*').setFooter({ text: footerText }).setTimestamp();
        return { embed, totalPages, currentPage, totalPlayers: players.length, pagePlayers };
    } else {
        const players = await getGamemodeLeaderboardData(guild, gamemodeName, tierFilter);
        if (tierFilter) {
            title = `${titleEmoji} ${gamemodeName.toUpperCase()} - ${tierFilter}`;
        }
        const pageSize = 20;
        const totalPages = Math.ceil(players.length / pageSize) || 1;
        const currentPage = Math.min(page, totalPages);
        const startIdx = (currentPage - 1) * pageSize;
        const pagePlayers = players.slice(startIdx, startIdx + pageSize);
        
        for (let i = 0; i < pageSize; i++) {
            const rank = startIdx + i + 1;
            const player = pagePlayers[i];
            let rankPrefix;
            if (rank === 1) rankPrefix = '🥇 ';
            else if (rank === 2) rankPrefix = '🥈 ';
            else if (rank === 3) rankPrefix = '🥉 ';
            else rankPrefix = `${rank}. `;
            if (!player) {
                description += `${rankPrefix}???\n\n`;
            } else {
                description += `${rankPrefix}**${player.displayName}** • ${player.rank}\n\n`;
            }
        }
        const footerText = `Page ${currentPage}/${totalPages} • Total: ${players.length} players ranked • Updated ${new Date().toLocaleDateString('en-GB')}`;
        const embed = new EmbedBuilder().setColor(0x2C2F33).setTitle(title).setDescription(description || '*No players to display*').setFooter({ text: footerText }).setTimestamp();
        return { embed, totalPages, currentPage, totalPlayers: players.length, pagePlayers };
    }
}

function buildLeaderboardPlayerPicker(pagePlayers, gamemodeValue) {
    const valid = (pagePlayers || []).filter(Boolean).slice(0, 25);
    if (valid.length === 0) return null;
    const picker = new StringSelectMenuBuilder()
        .setCustomId('leaderboard_view_profile')
        .setPlaceholder('👤 View a player\'s profile...')
        .addOptions(valid.map(p => ({
            label: (p.displayName || p.username).slice(0, 100),
            value: p.id,
            description: gamemodeValue === 'overall' ? `${p.points} pts` : `${p.rank}`
        })));
    return new ActionRowBuilder().addComponents(picker);
}

function getGamemodeDisplayName(gamemodeValue) {
    const mapping = {
        'overall': 'Overall', 'sword': 'Sword', 'axe': 'Axe', 'crystal': 'Crystal', 'pot': 'Pot',
        'uhc': 'UHC', 'noaxe': 'No Axe', 'maceht': 'Mace HT', 'macelt': 'Mace LT',
        'nethpot': 'Nethpot', 'macesphere': 'Mace-Sphere', 'smp': 'SMP'
    };
    return mapping[gamemodeValue] || gamemodeValue;
}

async function sendLeaderboardToChannel(channel, gamemodeValue = 'overall', page = 1, tierFilter = null) {
    const guild = channel.guild;
    const { embed, totalPages, currentPage, pagePlayers } = await formatLeaderboardEmbed(guild, gamemodeValue, page, tierFilter);
    
    const tierSelect = new StringSelectMenuBuilder()
        .setCustomId('leaderboard_tier_menu')
        .setPlaceholder('Filter by Tier')
        .addOptions([
            { label: 'All Players', value: 'all' },
            { label: 'TIER 1', value: 'TIER 1' },
            { label: 'TIER 2', value: 'TIER 2' },
            { label: 'TIER 3', value: 'TIER 3' },
            { label: 'TIER 4', value: 'TIER 4' },
            { label: 'TIER 5', value: 'TIER 5' }
        ]);
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('leaderboard_gamemode_menu')
        .setPlaceholder('Select a gamemode...')
        .addOptions(
            ['Overall', 'Sword', 'Axe', 'Crystal', 'Pot', 'UHC', 'No Axe', 'Mace HT', 'Mace LT', 'Nethpot', 'Mace-Sphere', 'SMP'].map(name => ({
                label: name,
                value: name.toLowerCase().replace(/\s/g, ''),
                description: `View ${name} leaderboard`,
                emoji: name === 'Overall' ? '🏆' : getGamemodeSymbol(name)
            }))
        );
    
    const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`leaderboard_page:${gamemodeValue}:${currentPage-1}`).setLabel('◀ PREV').setStyle(ButtonStyle.Secondary).setDisabled(currentPage===1),
        new ButtonBuilder().setCustomId(`leaderboard_page:${gamemodeValue}:${currentPage+1}`).setLabel('NEXT ▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage===totalPages||totalPages===0),
        new ButtonBuilder().setCustomId(`leaderboard_myposition:${gamemodeValue}`).setLabel('📍 MY POSITION').setStyle(ButtonStyle.Primary).setEmoji('📍'),
        new ButtonBuilder().setCustomId(`leaderboard_search`).setLabel('🔎 SEARCH PLAYER').setStyle(ButtonStyle.Success).setEmoji('🔎')
    );
    
    const tierRow = new ActionRowBuilder().addComponents(tierSelect);
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
    const playerRow = buildLeaderboardPlayerPicker(pagePlayers, gamemodeValue);
    
    const components = gamemodeValue === 'overall' 
        ? [buttonsRow, selectRow] 
        : [tierRow, buttonsRow, selectRow];
    if (playerRow && components.length < 5) components.push(playerRow);
    
    const msg = await channel.send({ embeds: [embed], components }).catch(()=>null);
    if (msg) { 
        activeLeaderboardMessage = msg; 
        currentLeaderboardGamemode = gamemodeValue; 
        currentLeaderboardPage = currentPage;
        currentTierFilter = tierFilter;
    }
    return msg;
}

async function updateLeaderboardMessage(interaction, gamemodeValue = null, page = null, isEdit = false, existingMsg = null, tierFilter = null) {
    const guild = interaction.guild;
    const targetGamemode = gamemodeValue !== null ? gamemodeValue : currentLeaderboardGamemode;
    const targetPage = page !== null ? page : currentLeaderboardPage;
    const targetTier = tierFilter !== undefined ? tierFilter : currentTierFilter;
    
    const { embed, totalPages, currentPage, pagePlayers } = await formatLeaderboardEmbed(guild, targetGamemode, targetPage, targetTier);
    
    const tierSelect = new StringSelectMenuBuilder()
        .setCustomId('leaderboard_tier_menu')
        .setPlaceholder('Filter by Tier')
        .addOptions([
            { label: 'All Players', value: 'all' },
            { label: 'TIER 1', value: 'TIER 1' },
            { label: 'TIER 2', value: 'TIER 2' },
            { label: 'TIER 3', value: 'TIER 3' },
            { label: 'TIER 4', value: 'TIER 4' },
            { label: 'TIER 5', value: 'TIER 5' }
        ]);
    
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('leaderboard_gamemode_menu')
        .setPlaceholder('Select a gamemode...')
        .addOptions(
            ['Overall', 'Sword', 'Axe', 'Crystal', 'Pot', 'UHC', 'No Axe', 'Mace HT', 'Mace LT', 'Nethpot', 'Mace-Sphere', 'SMP'].map(name => ({
                label: name,
                value: name.toLowerCase().replace(/\s/g, ''),
                description: `View ${name} leaderboard`,
                emoji: name === 'Overall' ? '🏆' : getGamemodeSymbol(name)
            }))
        );
    
    const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`leaderboard_page:${targetGamemode}:${currentPage-1}`).setLabel('◀ PREV').setStyle(ButtonStyle.Secondary).setDisabled(currentPage===1),
        new ButtonBuilder().setCustomId(`leaderboard_page:${targetGamemode}:${currentPage+1}`).setLabel('NEXT ▶').setStyle(ButtonStyle.Secondary).setDisabled(currentPage===totalPages||totalPages===0),
        new ButtonBuilder().setCustomId(`leaderboard_myposition:${targetGamemode}`).setLabel('📍 MY POSITION').setStyle(ButtonStyle.Primary).setEmoji('📍'),
        new ButtonBuilder().setCustomId(`leaderboard_search`).setLabel('🔎 SEARCH PLAYER').setStyle(ButtonStyle.Success).setEmoji('🔎')
    );
    
    const tierRow = new ActionRowBuilder().addComponents(tierSelect);
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);
    const playerRow = buildLeaderboardPlayerPicker(pagePlayers, targetGamemode);
    
    const components = targetGamemode === 'overall' 
        ? [buttonsRow, selectRow] 
        : [tierRow, buttonsRow, selectRow];
    if (playerRow && components.length < 5) components.push(playerRow);
    
    if (isEdit && existingMsg) { 
        await existingMsg.edit({ embeds: [embed], components }).catch(()=>{}); 
        currentLeaderboardGamemode = targetGamemode; 
        currentLeaderboardPage = currentPage;
        currentTierFilter = targetTier;
    } else if (activeLeaderboardMessage) { 
        await activeLeaderboardMessage.edit({ embeds: [embed], components }).catch(()=>{}); 
        currentLeaderboardGamemode = targetGamemode; 
        currentLeaderboardPage = currentPage;
        currentTierFilter = targetTier;
    } else if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ embeds: [embed], components }).catch(()=>{});
    } else {
        await interaction.reply({ embeds: [embed], components }).catch(()=>{}); 
    }
}

async function deployLeaderboard(interaction) {
    await interaction.deferReply({ flags: 64 });
    const channel = interaction.guild.channels.cache.find(c => c.name === LEADERBOARD_CHANNEL);
    if (!channel) return interaction.editReply({ content: `❌ Channel ${LEADERBOARD_CHANNEL} not found! Create it first.` });
    await sendLeaderboardToChannel(channel, 'overall', 1, null);
    await interaction.editReply({ content: `✅ Leaderboard deployed to ${LEADERBOARD_CHANNEL}!` });
}

// ==================== PROFILES & PANELS ====================
async function showProfile(interaction, targetUser) {
    const pd = db.players[targetUser.id];
    if (!pd) return interaction.reply({ content: `❌ ${targetUser.username} has not applied yet!`, flags: 64 });
    const points = calculateTotalPoints(targetUser.id);
    const title = getTitleFromPoints(points);
    const position = getPlayerPosition(targetUser.id);
    const { thumbnailUrl, files } = await getAvatarForEmbed(pd);
    const tierFields = GAMEMODE_ORDER.map(gm => ({
        name: `${getGamemodeSymbol(gm)} ${gm}`,
        value: pd.gamemodeRanks?.[gm] ? `\`${pd.gamemodeRanks[gm]}\`` : '`NA`',
        inline: true
    }));
    const embed = new EmbedBuilder()
        .setColor(title.role === 'Combat Grandmaster' ? 0xFFD700 : 0x5865F2)
        .setAuthor({ name: title.name })
        .setTitle(`🏆 ${pd.username}`)
        .setDescription(`${pd.region || 'Unknown Region'}`)
        .setThumbnail(thumbnailUrl)
        .addFields(
            { name: '📍 Position', value: `**#${position} Overall** • ${points} pts`, inline: false },
            ...tierFields,
            { name: '\u200B', value: '\u200B', inline: false },
            { name: '📊 Stats', value: `Tests: ${pd.testHistory?.length || 0} • Warnings: ${pd.warnings?.length || 0} • Strikes: ${pd.strikes || 0}/${STRIKE_BAN_LIMIT}`, inline: false }
        )
        .setFooter({ text: `Next title: ${getTitleFromPoints(points + 1).name} at ${getTitleFromPoints(points + 1).minPoints} points` })
        .setTimestamp();

    const components = [];
    if (targetUser.id === interaction.user.id) {
        const editCount = pd.editCount !== undefined ? pd.editCount : 0;
        const remaining = MAX_PROFILE_EDITS - editCount;
        if (remaining > 0) {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('edit_profile_button')
                    .setLabel(`✏️ Edit Profile (${remaining} left)`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji('✏️')
            );
            components.push(row);
        } else {
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                    .setCustomId('edit_profile_disabled')
                    .setLabel('❌ Edits Used Up')
                    .setStyle(ButtonStyle.Secondary)
                    .setDisabled(true)
            );
            components.push(row);
        }
    }
    await interaction.reply({ embeds: [embed], components, files, flags: 64 });
}

async function sendProfileToChannel(channel, targetUser) {
    const pd = db.players[targetUser.id];
    if (!pd) return channel.send({ content: `❌ ${targetUser.username} has not applied.` });
    const points = calculateTotalPoints(targetUser.id);
    const title = getTitleFromPoints(points);
    const position = getPlayerPosition(targetUser.id);
    const { thumbnailUrl, files } = await getAvatarForEmbed(pd);
    const tierFields = GAMEMODE_ORDER.map(gm => ({
        name: `${getGamemodeSymbol(gm)} ${gm}`,
        value: pd.gamemodeRanks?.[gm] ? `\`${pd.gamemodeRanks[gm]}\`` : '`NA`',
        inline: true
    }));
    const embed = new EmbedBuilder()
        .setColor(title.role === 'Combat Grandmaster' ? 0xFFD700 : 0x5865F2)
        .setAuthor({ name: title.name })
        .setTitle(`🏆 ${pd.username}`)
        .setDescription(`${pd.region || 'Unknown Region'}`)
        .setThumbnail(thumbnailUrl)
        .addFields(
            { name: '📍 Position', value: `**#${position} Overall** • ${points} pts`, inline: false },
            ...tierFields,
            { name: '\u200B', value: '\u200B', inline: false },
            { name: '📊 Stats', value: `Tests: ${pd.testHistory?.length || 0} • Warnings: ${pd.warnings?.length || 0} • Strikes: ${pd.strikes || 0}/${STRIKE_BAN_LIMIT}`, inline: false }
        )
        .setFooter({ text: `Next title: ${getTitleFromPoints(points + 1).name} at ${getTitleFromPoints(points + 1).minPoints} points` })
        .setTimestamp();
    await channel.send({ embeds: [embed], files });
}

async function sendApplyPanel(channel) {
    const embed = new EmbedBuilder()
        .setColor(0x0a0a0a)
        .setTitle('🏆 MCBPVP CLUB')
        .setDescription([
            `**⚔️ Official Tier Testing**`,
            `━━━━━━━━━━━━━━`,
            `**📈 Progress System**`,
            `LT5 → MT5 → HT5 → LT4 → MT4 → HT4 → LT3 → MT3 → HT3 → LT2 → MT2 → HT2 → LT1 → MT1 → HT1`,
            `━━━━━━━━━━━━━━`,
            `**🎖 Rank Progression**`,
            `Combat Learner`,
            `Combat Cadet`,
            `Combat Ace`,
            `Combat Master`,
            `━━━━━━━━━━━━━━`,
            `🎯 **Tested By Official Staff**`,
            `🌎 **Regional Leaderboards**`,
            `🏆 **Competitive Rankings**`,
            `━━━━━━━━━━━━━━`,
            `⬇️ **Apply Below**`
        ].join('\n'))
        .setFooter({ text: 'MCBPVP Club • Competitive Minecraft Bedrock PvP' })
        .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('apply_button').setLabel('APPLY NOW').setStyle(ButtonStyle.Success).setEmoji('📝'),
        new ButtonBuilder().setCustomId('profile_button').setLabel('MY PROFILE').setStyle(ButtonStyle.Secondary).setEmoji('👤')
    );
    await channel.send({ embeds: [embed], components: [row] });
}

async function sendRequestPanel(channel) {
    const embed = new EmbedBuilder()
        .setColor(0x0a0a0a)
        .setTitle('🏆 MCBPVP TESTING')
        .setDescription([
            `Ready to get ranked?`,
            `━━━━━━━━━━━━━━`,
            `**⚔️ Official Tier Testing**`,
            `📈 Earn Ratings`,
            `🏅 Gain Points`,
            `🌎 Join Leaderboards`,
            `━━━━━━━━━━━━━━`,
            `**📋 Process**`,
            `Select Mode`,
            `↓`,
            `Join Queue`,
            `↓`,
            `Get Tested`,
            `↓`,
            `Receive Rating`,
            `━━━━━━━━━━━━━━`,
            `🎮 **11 Supported Gamemodes**`,
            `👇 Press the button below`
        ].join('\n'))
        .setFooter({ text: 'MCBPVP Club • Competitive Minecraft Bedrock PvP' })
        .setTimestamp();
    const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('request_button').setLabel('REQUEST TEST').setStyle(ButtonStyle.Primary).setEmoji('🚀')
    );
    await channel.send({ embeds: [embed], components: [row] });
}

async function sendTesterPanel(channel) {
    const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('🎮 TESTER CONTROL PANEL')
        .setDescription([
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `**📋 Queue Commands**`,
            `\`/queue <gamemode>\` - View waiting players`,
            `\`/claim @player\` - Claim a player from queue`,
            `\`/testnow @player\` - Start test with a player`,
            `\`/autotest [gamemode]\` - Toggle auto-test`,
            ``,
            `**⚔️ Test Commands**`,
            `\`/start\` - Begin test timer (or use button)`,
            `\`/done\` - Submit test results (or use button)`,
            `\`/close\` - Close test channel`,
            `\`/forceclose\` - Force close test channel`,
            ``,
            `**🔧 Staff Tools**`,
            `\`/warn @user\` - Warn a player`,
            `\`/strike @user\` - Add a strike`,
            `\`/blacklist @user\` - Ban from testing`,
            `\`/unblacklist @user\` - Remove ban`,
            `\`/notes @user\` - Add private note`,
            `\`/audit @user\` - View staff actions`,
            `\`/check @user\` - View player info`,
            `\`/tester @user\` - View tester profile`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `*Need help? Ask in ${AI_CHANNEL_NAME} channel or contact a staff member.*`
        ].join('\n')).setFooter({ text: 'MCBPVP Club | Tester Panel' }).setTimestamp();
    await channel.send({ embeds: [embed] });
}

// ==================== MODALS ====================
async function showApplyModal(interaction) {
    if (db.players[interaction.user.id]) return interaction.reply({ content: '❌ Already applied!', flags: 64 });
    const modal = new ModalBuilder().setCustomId('apply_modal').setTitle('Minecraft Tier Application');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Minecraft Username (Gamertag)').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('region').setLabel('Region').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('device').setLabel('Device').setStyle(TextInputStyle.Short).setRequired(true))
    );
    await interaction.showModal(modal);
}

async function showDoneModal(interaction, playerId, gamemodeName) {
    const modal = new ModalBuilder().setCustomId(`done_modal:${playerId}:${gamemodeName}`).setTitle('Complete Test');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('rank').setLabel('Earned Rank (or "no upgrade")').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('LT5, MT5, HT5, LT4, etc.')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('score').setLabel('Score / Frags').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('notes').setLabel('Notes').setStyle(TextInputStyle.Paragraph).setRequired(false))
    );
    await interaction.showModal(modal);
}

async function showTesterSetupModal(interaction, targetUser) {
    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`set_tester_gamemode:${targetUser.id}`)
            .setPlaceholder('Select gamemode')
            .addOptions(GAMEMODES.map(g => ({ label: g.name, value: g.name, description: `Set as ${g.name} tester` })))
    );
    await interaction.reply({ content: 'Select the gamemode for this tester:', components: [row], flags: 64 });
}

async function showTierRemovalModal(interaction, targetUser) {
    const row = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId(`remove_tier_gamemode:${targetUser.id}`)
            .setPlaceholder('Select gamemode')
            .addOptions(GAMEMODES.map(g => ({ label: g.name, value: g.name, description: `Remove ${g.name} rank` })))
    );
    await interaction.reply({ content: `Select gamemode to remove rank for ${targetUser.username}:`, components: [row], flags: 64 });
}

async function showForceApplyModal(interaction, targetUser) {
    const modal = new ModalBuilder().setCustomId(`forceapply_modal:${targetUser.id}`).setTitle(`Force Apply: ${targetUser.username}`);
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Minecraft Username').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('region').setLabel('Region').setStyle(TextInputStyle.Short).setRequired(true)),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('device').setLabel('Device').setStyle(TextInputStyle.Short).setRequired(true))
    );
    await interaction.showModal(modal);
}

async function showEditProfileModal(interaction) {
    const pd = db.players[interaction.user.id];
    if (!pd) return interaction.reply({ content: '❌ You haven\'t applied yet!', flags: 64 });
    const editCount = pd.editCount !== undefined ? pd.editCount : 0;
    if (editCount >= MAX_PROFILE_EDITS) {
        return interaction.reply({ content: `❌ You have already used all ${MAX_PROFILE_EDITS} profile edits.`, flags: 64 });
    }
    const modal = new ModalBuilder().setCustomId('editprofile_modal').setTitle('✏️ Edit Profile');
    modal.addComponents(
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('username').setLabel('Minecraft Username').setStyle(TextInputStyle.Short).setRequired(true).setValue(pd.username || '')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('region').setLabel('Region').setStyle(TextInputStyle.Short).setRequired(true).setValue(pd.region || '')),
        new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('device').setLabel('Device').setStyle(TextInputStyle.Short).setRequired(true).setValue(pd.device || ''))
    );
    await interaction.showModal(modal);
}

// ==================== WEBSITE SYNC ====================
async function syncToWebsite(testData) {
    if (!db.websiteSync?.enabled || !db.websiteSync?.apiUrl) return { success: false };
    try {
        const fetch = (await import('node-fetch')).default;
        const response = await fetch(db.websiteSync.apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-API-Key': db.websiteSync.apiKey },
            body: JSON.stringify({ action: 'update_rank', data: testData })
        });
        return { success: response.ok };
    } catch (error) { return { success: false }; }
}

// ==================== AUTO-SETUP ====================
async function autoSetupRoles(guild) {
    const rolesToCreate = [
        APPLICANT_ROLE, ...TITLES.map(t => t.role), ...RANK_ORDER,
        ...GAMEMODES.map(g => g.testerRole),
        'CREATOR', 'ADMIN', 'HELPER', 'Tester'
    ];
    for (const roleName of rolesToCreate) {
        const existing = guild.roles.cache.find(r => r.name === roleName);
        if (!existing) {
            await guild.roles.create({ name: roleName, reason: 'Auto-setup by Tier Bot' });
            console.log(`✅ Created role: ${roleName}`);
        }
    }
    console.log('✅ Role setup complete (no channels created).');
}

// ==================== RECALCULATE ALL PLAYERS ====================
function resolveCanonicalGamemode(rawName) {
    if (!rawName) return null;
    if (GAMEMODE_ORDER.includes(rawName)) return rawName;
    // Corrupted names from the old greedy-regex bug have trailing junk appended
    // (e.g. "Mace LT | TesterID: 123") - the real name is always a clean prefix.
    // Check longest names first so "Mace LT"/"Mace HT"/"Mace-Sphere" aren't
    // mistaken for a bare "Mace" match.
    const sorted = [...GAMEMODE_ORDER].sort((a, b) => b.length - a.length);
    for (const gm of sorted) {
        if (rawName === gm || rawName.startsWith(gm + ' ') || rawName.startsWith(gm + '|')) return gm;
    }
    return null;
}

async function recalculateAllPlayers(guild) {
    console.log('🔄 Recalculating all player points and repairing any corrupted gamemode names...');
    let count = 0;
    for (const [playerId, data] of Object.entries(db.players)) {
        if (!data.gamemodePoints) data.gamemodePoints = {};
        if (!data.gamemodeLastTest) data.gamemodeLastTest = {};
        if (!data.gamemodeRanks) data.gamemodeRanks = {};

        // Clean up testHistory gamemode names in place so /history displays
        // correctly and this repair is stable if run again later.
        for (const entry of (data.testHistory || [])) {
            const clean = resolveCanonicalGamemode(entry.gamemode);
            if (clean) entry.gamemode = clean;
        }

        // Rebuild ranks/points fresh from cleaned history - this recovers any
        // test whose result was previously stored under a corrupted gamemode key.
        const latestRankByGm = {};
        const latestDateByGm = {};
        for (const entry of (data.testHistory || [])) {
            const gm = resolveCanonicalGamemode(entry.gamemode);
            if (!gm) continue;
            if (entry.rank && entry.rank !== 'No upgrade' && entry.rank !== 'no upgrade' && RANK_ORDER.includes(entry.rank)) {
                if (!latestDateByGm[gm] || entry.date >= latestDateByGm[gm]) {
                    latestRankByGm[gm] = entry.rank;
                    latestDateByGm[gm] = entry.date;
                }
            }
        }
        // Respect any rank already correctly recorded with no matching history
        // entry (e.g. an admin manually granted a rank via /forcerank).
        for (const gm of GAMEMODE_ORDER) {
            if (!latestRankByGm[gm] && data.gamemodeRanks[gm] && RANK_ORDER.includes(data.gamemodeRanks[gm])) {
                latestRankByGm[gm] = data.gamemodeRanks[gm];
            }
        }

        // Drop any leftover corrupted keys and rebuild clean.
        data.gamemodeRanks = {};
        data.gamemodePoints = {};
        for (const gm of GAMEMODE_ORDER) {
            if (latestRankByGm[gm]) {
                data.gamemodeRanks[gm] = latestRankByGm[gm];
                data.gamemodePoints[gm] = getFixedPointsForRank(latestRankByGm[gm]);
                if (!data.gamemodeLastTest[gm]) data.gamemodeLastTest[gm] = latestDateByGm[gm] || Date.now();
            }
        }
        count++;
    }
    saveData();
    console.log(`✅ Recalculated ${count} players - gamemode names repaired and points rebuilt.`);
}

// ==================== REGISTER COMMANDS ====================
async function registerCommands() {
    const gamemodeChoices = GAMEMODES.map(g => ({ name: g.name, value: g.name }));
    const rankChoices = RANK_ORDER.map(r => ({ name: r, value: r }));
    const autoTestChoices = [
        ...gamemodeChoices,
        { name: 'Stop Auto-Test', value: 'stop' }
    ];
    const commands = [
        { name: 'apply', description: 'Apply to become a Combat Learner' },
        { name: 'request', description: 'Request a test for a specific gamemode' },
        { name: 'cancel', description: 'Cancel your pending test request' },
        { name: 'position', description: 'Check your position in queues' },
        { name: 'profile', description: 'View your Minecraft profile', options: [{ name: 'user', type: 6, description: 'User to view', required: false }] },
        { name: 'editprofile', description: 'Edit your Minecraft profile (username, region, device)' },
        { name: 'refreshskin', description: 'Refresh your Minecraft skin avatar' },
        { name: 'cooldown', description: 'Check your remaining cooldown' },
        { name: 'history', description: 'View your test history' },
        { name: 'leaderboard', description: 'View top players by points' },
        { name: 'stats', description: 'View your stats per gamemode' },
        { name: 'rankup', description: 'Check points needed for next title' },
        { name: 'notify', description: 'Toggle DM notifications when picked from queue' },
        { name: 'kit', description: 'View kit image for a gamemode', options: [{ name: 'gamemode', type: 3, description: 'Select a gamemode', required: true, choices: gamemodeChoices }] },
        { name: 'testerinfo', description: 'View tester information', options: [{ name: 'user', type: 6, description: 'Tester to view', required: true }] },
        { name: 'testerleaderboard', description: 'View tester leaderboard (Tester of the Month)' },
        { name: 'queue', description: 'View waiting queue for a gamemode (device-filtered)', options: [{ name: 'gamemode', type: 3, description: 'Select a gamemode', required: true, choices: gamemodeChoices }] },
        { name: 'testnow', description: 'Start a test with a player', options: [{ name: 'player', type: 6, description: 'Player to test', required: true }] },
        { name: 'claim', description: 'Claim a player from queue', options: [{ name: 'player', type: 6, description: 'Player to claim', required: true }] },
        { name: 'autotest', description: 'Toggle auto-test for a gamemode (or stop)', options: [{ name: 'gamemode', type: 3, description: 'Select gamemode or Stop', required: false, choices: autoTestChoices }] },
        { name: 'start', description: 'Start the test timer' },
        { name: 'done', description: 'Complete the current test' },
        { name: 'close', description: 'Close the test channel' },
        { name: 'forceclose', description: 'Force close the test channel' },
        { name: 'tester', description: 'View tester profile (staff)', options: [{ name: 'user', type: 6, description: 'Tester to view', required: true }] },
        { name: 'notes', description: 'Add private note about a player', options: [{ name: 'player', type: 6, description: 'Player', required: true }, { name: 'note', type: 3, description: 'Note content', required: true }] },
        { name: 'warn', description: 'Warn a player', options: [{ name: 'player', type: 6, description: 'Player to warn', required: true }, { name: 'reason', type: 3, description: 'Warning reason', required: true }] },
        { name: 'strike', description: 'Add a strike to a player', options: [{ name: 'player', type: 6, description: 'Player', required: true }] },
        { name: 'blacklist', description: 'Blacklist a player from testing', options: [{ name: 'player', type: 6, description: 'Player to blacklist', required: true }] },
        { name: 'unblacklist', description: 'Remove player from blacklist', options: [{ name: 'player', type: 6, description: 'Player to unblacklist', required: true }] },
        { name: 'audit', description: 'View staff actions on a player', options: [{ name: 'player', type: 6, description: 'Player', required: true }] },
        { name: 'check', description: 'Check player info', options: [{ name: 'player', type: 6, description: 'Player to check', required: true }] },
        { name: 'settester', description: '[Admin] Set tester profile', options: [{ name: 'user', type: 6, description: 'Tester to configure', required: true }] },
        { name: 'removetester', description: '[Admin] Remove tester profile', options: [{ name: 'user', type: 6, description: 'Tester to remove', required: true }] },
        { name: 'removetier', description: '[Admin] Remove player\'s rank from a gamemode', options: [{ name: 'player', type: 6, description: 'Player', required: true }] },
        { name: 'addtier', description: '[Admin] Directly grant a player a rank in a gamemode (with matching points)', options: [
            { name: 'player', type: 6, description: 'Player', required: true },
            { name: 'gamemode', type: 3, description: 'Gamemode', required: true, choices: gamemodeChoices },
            { name: 'rank', type: 3, description: 'Rank to grant', required: true, choices: rankChoices }
        ] },
        { name: 'testers', description: 'View all registered testers' },
        { name: 'certify', description: '[Admin] Certify a tester', options: [{ name: 'user', type: 6, description: 'Tester to certify', required: true }] },
        { name: 'revoke', description: '[Admin] Revoke tester certification', options: [{ name: 'user', type: 6, description: 'Tester to revoke', required: true }] },
        { name: 'forceapply', description: '[Admin] Force apply a player', options: [{ name: 'player', type: 6, description: 'Player to force apply', required: true }] },
        { name: 'deapply', description: '[Admin] Remove player application (keeps data)', options: [{ name: 'player', type: 6, description: 'Player to deapply', required: true }] },
        { name: 'forceunverify', description: '[Admin] Force unverify a player (wipes data)', options: [{ name: 'player', type: 6, description: 'Player to unverify', required: true }] },
        { name: 'forcerank', description: '[Admin] Force change player rank', options: [{ name: 'player', type: 6, description: 'Player', required: true }, { name: 'rank', type: 3, description: 'New rank', required: true, choices: rankChoices }] },
        { name: 'setpoints', description: '[Admin] Set player points', options: [{ name: 'player', type: 6, description: 'Player', required: true }, { name: 'points', type: 4, description: 'Points amount', required: true }] },
        { name: 'reset', description: '[Admin] Reset a single player completely (wipes data)', options: [{ name: 'player', type: 6, description: 'Player to reset', required: true }] },
        { name: 'resetall', description: '[Admin] **RESET EVERYTHING** – clears all players, queues, stats (keeps kits & testers)' },
        { name: 'recalculate', description: '[Admin] Recalculate player points', options: [{ name: 'player', type: 6, description: 'Player', required: true }] },
        { name: 'testertest', description: '[Admin] Test a player for tester role', options: [
            { name: 'player', type: 6, description: 'Player to test', required: true },
            { name: 'gamemode', type: 3, description: 'Gamemode to test', required: true, choices: gamemodeChoices }
        ] },
        { name: 'addtestserver', description: '[Admin] Add a test server', options: [
            { name: 'ip', type: 3, description: 'Server IP address', required: true },
            { name: 'port', type: 4, description: 'Server port', required: true }
        ] },
        { name: 'removetestserver', description: '[Admin] Remove a test server by index', options: [
            { name: 'index', type: 4, description: 'Server number from /viewtestservers', required: true }
        ] },
        { name: 'viewtestservers', description: 'View all available test servers' },
        { name: 'kitimg', description: '[Admin] Add or remove kit image for a gamemode', options: [
            { name: 'action', type: 3, description: 'add or remove', required: true, choices: [{ name: 'add', value: 'add' }, { name: 'remove', value: 'remove' }, { name: 'list', value: 'list' }] },
            { name: 'gamemode', type: 3, description: 'Gamemode name', required: false, choices: gamemodeChoices },
            { name: 'image', type: 3, description: 'Image URL', required: false }
        ] },
        { name: 'deployqueueviewer', description: '[Admin] Deploy unified queue viewer (dropdown) to queue channel' },
        { name: 'deployleaderboard', description: '[Admin] Deploy leaderboard to channel' },
        { name: 'refreshleaderboard', description: '[Admin] Manually refresh leaderboard' },
        { name: 'sendpanel', description: '[Admin] Send control panel to a channel', options: [{ name: 'type', type: 3, description: 'apply, tester, or request', required: true, choices: [{ name: 'apply', value: 'apply' }, { name: 'tester', value: 'tester' }, { name: 'request', value: 'request' }] }] },
        { name: 'setcooldown', description: '[Admin] Set universal cooldown (days, 0 to disable)', options: [{ name: 'days', type: 4, description: 'Days', required: true }] },
        { name: 'maxqueue', description: '[Admin] Set max queue size per gamemode', options: [{ name: 'gamemode', type: 3, description: 'Select a gamemode', required: true, choices: gamemodeChoices }, { name: 'size', type: 4, description: 'Max size', required: true }] },
        { name: 'announce', description: '[Admin] Announce to all testers', options: [{ name: 'message', type: 3, description: 'Announcement message', required: true }] },
        { name: 'export', description: '[Admin] Export all player data to CSV' },
        { name: 'backup', description: '[Admin] Manual database backup' },
        { name: 'setup', description: '[Admin] Run role auto-setup (creates missing roles)' },
        { name: 'websitesync', description: '[Owner] Configure website sync', options: [{ name: 'url', type: 3, description: 'API URL', required: true }, { name: 'key', type: 3, description: 'API Key', required: true }] },
        { name: 'testsync', description: '[Owner] Test website sync connection' },
        { name: 'setperm', description: '[Admin] Set which role(s) can use a command', options: [
            { name: 'command', type: 3, description: 'Command name', required: true },
            { name: 'role', type: 8, description: 'Role to allow (leave empty to remove restriction)', required: false }
        ] },
        { name: 'test', description: '[Admin] Test various embeds and check server setup', options: [
            { name: 'type', type: 3, description: 'What to test', required: true, choices: [
                { name: 'Profile', value: 'profile' },
                { name: 'Apply Panel', value: 'apply' },
                { name: 'Request Panel', value: 'request' },
                { name: 'Tester Panel', value: 'tester' },
                { name: 'Leaderboard', value: 'leaderboard' },
                { name: 'Queue Viewer', value: 'queue' },
                { name: 'Result Embed', value: 'result' },
                { name: 'Check Categories', value: 'categories' }
            ] },
            { name: 'user', type: 6, description: 'User for profile preview (optional)', required: false }
        ] },
        { name: 'help', description: 'Show all commands' }
    ];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try { await rest.put(Routes.applicationCommands(client.user.id), { body: commands }); console.log('✅ Commands registered'); } catch(e) { console.error('❌ Failed to register commands:', e); }
}

async function showHelp(interaction) {
    const embed = new EmbedBuilder().setColor(0x2ECC71).setTitle('📋 TIER BOT COMMANDS')
        .setDescription([
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `**👤 PLAYER COMMANDS**`,
            `\`/apply\` - Apply as Combat Learner`,
            `\`/editprofile\` - Edit your username, region, device`,
            `\`/request\` - Request a test`,
            `\`/cancel\` - Cancel queue request`,
            `\`/position\` - Check queue position`,
            `\`/profile\` - View your Minecraft profile`,
            `\`/refreshskin\` - Update your skin avatar`,
            `\`/cooldown\` - Check remaining cooldown`,
            `\`/history\` - View test history`,
            `\`/leaderboard\` - View leaderboard (with dropdown)`,
            `\`/stats\` - Your per-gamemode stats`,
            `\`/rankup\` - Points to next title`,
            `\`/notify\` - Toggle DM notifications`,
            `\`/kit <gamemode>\` - View kit image`,
            `\`/testerinfo @user\` - View tester info`,
            `\`/testerleaderboard\` - Tester of the Month`,
            `\`/viewtestservers\` - View available test servers`,
            ``,
            `**🎮 TESTER COMMANDS**`,
            `\`/queue <gamemode>\` - View queue (device-filtered)`,
            `\`/testnow @player\` - Start test (24h auto-cancel)`,
            `\`/claim @player\` - Claim from queue`,
            `\`/autotest [gamemode]\` - Toggle auto-test`,
            `\`/start\` - Begin test (or use button)`,
            `\`/done\` - Complete test (or use button)`,
            `\`/close\` - Close test channel`,
            `\`/forceclose\` - Force close test channel`,
            `\`/tester @user\` - View tester profile (staff)`,
            `\`/notes @user\` - Add note`,
            `\`/warn @user\` - Warn player`,
            `\`/strike @user\` - Add strike`,
            `\`/blacklist @user\` - Ban from testing`,
            `\`/unblacklist @user\` - Remove ban`,
            `\`/audit @user\` - Staff actions log`,
            `\`/check @user\` - Lookup player`,
            ``,
            `**⚙️ ADMIN COMMANDS**`,
            `\`/settester @user\` - Set tester profile`,
            `\`/removetester @user\` - Remove tester`,
            `\`/removetier @user\` - Remove player's tier`,
            `\`/testers\` - View all testers`,
            `\`/certify @user\` - Certify a tester`,
            `\`/revoke @user\` - Revoke certification`,
            `\`/testertest\` - Test a player for tester role`,
            `\`/addtestserver\` - Add a test server`,
            `\`/removetestserver\` - Remove a test server`,
            `\`/forceapply @user\` - Force apply a player`,
            `\`/deapply @user\` - Remove application (keeps data)`,
            `\`/forceunverify @user\` - Force unverify (wipes data)`,
            `\`/forcerank @user <rank>\` - Force rank`,
            `\`/setpoints @user <points>\` - Set points`,
            `\`/reset @user\` - Reset a single player`,
            `\`/resetall\` - **RESET EVERYTHING**`,
            `\`/recalculate @user\` - Recalc points`,
            `\`/kitimg add/remove/list\` - Manage kit images`,
            `\`/deployqueueviewer\` - Deploy unified queue viewer`,
            `\`/deployleaderboard\` - Deploy leaderboard`,
            `\`/refreshleaderboard\` - Refresh leaderboard`,
            `\`/sendpanel apply/tester/request\` - Send panels`,
            `\`/setcooldown <days>\` - Set universal cooldown`,
            `\`/maxqueue <gamemode> <size>\` - Set queue limit`,
            `\`/announce\` - Announce to testers`,
            `\`/export\` - Export data to CSV`,
            `\`/backup\` - Manual database backup`,
            `\`/setup\` - Run role auto-setup`,
            `\`/websitesync\` - Configure website sync (Owner only)`,
            `\`/testsync\` - Test website sync (Owner only)`,
            `\`/setperm\` - Set command permissions (Admin only)`,
            `\`/test\` - Test embeds and server setup (Admin only)`,
            `\`/help\` - This menu`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
        ].join('\n')).setTimestamp();
    await interaction.reply({ embeds: [embed], flags: 64 });
}

// ==================== RESET ALL ====================
async function resetAll(guild) {
    db.players = {};
    db.queues = {};
    db.queueMessages = {};
    db.staffNotes = {};
    db.strikes = {};
    db.blacklist = [];
    db.testerStats = {};
    db.activeTests = {};
    db.testServers = [];
    saveData();
    return true;
}

// ==================== TESTER LIST ====================
async function getTestersList(guild) {
    const list = [];
    for (const [id, data] of Object.entries(db.testers)) {
        const member = await guild.members.fetch(id).catch(()=>null);
        if (!member) continue;
        let statusEmoji = '⚫';
        if (member.presence) {
            const st = member.presence.status;
            if (st === 'online') statusEmoji = '🟢';
            else if (st === 'idle') statusEmoji = '🟠';
            else if (st === 'dnd') statusEmoji = '🔴';
        }
        const symbol = getGamemodeSymbol(data.gamemode);
        list.push({ id, username: member.user.username, displayName: member.displayName, gamemode: data.gamemode, tier: data.tier, region: data.region || 'Not set', statusEmoji, symbol });
    }
    list.sort((a,b) => a.gamemode.localeCompare(b.gamemode) || (RANK_ORDER.indexOf(b.tier)-RANK_ORDER.indexOf(a.tier)));
    return list;
}

async function sendTestersEmbed(interaction, page = 1) {
    const guild = interaction.guild;
    const testers = await getTestersList(guild);
    if (testers.length === 0) return interaction.reply({ content: '📭 No testers registered yet.', flags: 64 });
    const perPage = 10;
    const totalPages = Math.ceil(testers.length / perPage);
    const curPage = Math.min(page, totalPages);
    const start = (curPage-1)*perPage;
    const pageTesters = testers.slice(start, start+perPage);
    let desc = '';
    for (const t of pageTesters) {
        desc += `${t.statusEmoji} **${t.displayName}**\n   ${t.symbol} ${t.gamemode} · Tier: **${t.tier}** · ${t.region}\n\n`;
    }
    const embed = new EmbedBuilder().setColor(0x5865F2).setTitle('🎮 REGISTERED TESTERS').setDescription(desc || '*No testers on this page*').setFooter({ text: `Page ${curPage}/${totalPages} • Total testers: ${testers.length}` }).setTimestamp();
    const row = new ActionRowBuilder();
    if (totalPages > 1) {
        row.addComponents(
            new ButtonBuilder().setCustomId(`testers_page:${curPage-1}`).setLabel('◀ PREV').setStyle(ButtonStyle.Secondary).setDisabled(curPage===1),
            new ButtonBuilder().setCustomId(`testers_page:${curPage+1}`).setLabel('NEXT ▶').setStyle(ButtonStyle.Secondary).setDisabled(curPage===totalPages)
        );
    }
    await interaction.reply({ embeds: [embed], components: row.components.length ? [row] : [], flags: 64 });
}

async function announceTester(guild, memberId, action = 'add') {
    const channel = guild.channels.cache.find(c => c.name === TESTER_LIST_CHANNEL);
    if (!channel) return;
    const member = await guild.members.fetch(memberId).catch(()=>null);
    if (!member) return;
    const testerData = db.testers[memberId];
    if (!testerData && action !== 'remove') return;
    const symbol = getGamemodeSymbol(testerData?.gamemode || '');
    let embed;
    if (action === 'add') {
        embed = new EmbedBuilder().setColor(0x2ECC71).setTitle('✅ New Tester Registered')
            .setDescription(`${member.user.tag} is now a **${testerData.gamemode}** tester!`)
            .addFields({ name: '🏆 Tier', value: testerData.tier, inline: true }, { name: '🌍 Region', value: testerData.region || 'Not set', inline: true }, { name: '📱 Device', value: testerData.device || 'Not set', inline: true })
            .setThumbnail(member.user.displayAvatarURL()).setTimestamp();
    } else {
        embed = new EmbedBuilder().setColor(0xE74C3C).setTitle('🔴 Tester Retired').setDescription(`${member.user.tag} is no longer a tester.`).setTimestamp();
    }
    await channel.send({ embeds: [embed] }).catch(()=>{});
}

// ==================== VIEW TEST SERVERS ====================
async function viewTestServers(interaction) {
    const servers = db.testServers || [];
    if (servers.length === 0) {
        return interaction.reply({ 
            content: '📭 No test servers configured. Use `/addtestserver <ip> <port>` to add one.', 
            flags: 64 
        });
    }
    
    let description = servers.map((s, i) => `${i+1}. \`${s.ip}:${s.port}\``).join('\n');
    
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🌐 Available Test Servers')
        .setDescription([
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `${description}`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `**🚀 Official MCBPVP Server**`,
            `Coming soon! We're working hard to bring you`,
            `the best Bedrock PvP experience.`,
            ``
        ].join('\n'))
        .setFooter({ text: `${BOT_NAME} • Test Servers` })
        .setTimestamp();
    
    await interaction.reply({ embeds: [embed], flags: 64 });
}

// ==================== READY ====================
client.once('ready', async () => {
    console.log(`✅ MCBPVP BOT logged in as ${client.user.tag}`);
    const guild = client.guilds.cache.get(GUILD_ID);
    if (!guild) return console.error('❌ Guild not found!');
    
    await autoSetupRoles(guild);
    await recalculateAllPlayers(guild);
    await cleanupLeftMembers(guild);
    await registerCommands();
    await initGemini();
    
    setInterval(() => {
        try {
            checkDecay(guild);
        } catch(e) { console.error('Decay check error:', e); }
    }, 24 * 60 * 60 * 1000);
    await checkDecay(guild);
    
    console.log(`\n✅ Ready! | ${GAMEMODES.length} gamemodes loaded`);
    console.log(`📌 Use /sendpanel apply, /sendpanel request, or /sendpanel tester to deploy panels.`);
    console.log(`📌 Use /deployqueueviewer to deploy the new queue dropdown.`);
    console.log(`🤖 AI active in ${AI_CHANNEL_NAME} channel!`);
});

// ==================== MEMBER LEAVE CLEANUP ====================
function wipePlayerData(id) {
    let changed = false;
    if (db.players[id]) { delete db.players[id]; changed = true; }
    if (db.testers[id]) { delete db.testers[id]; changed = true; }
    if (db.testerStats[id]) { delete db.testerStats[id]; changed = true; }
    if (db.staffNotes[id]) { delete db.staffNotes[id]; changed = true; }
    if (db.blacklist.includes(id)) { db.blacklist = db.blacklist.filter(pid => pid !== id); changed = true; }
    for (const gm of Object.keys(db.queues || {})) {
        const q = db.queues[gm];
        if (!q) continue;
        const beforeWaiting = q.waiting.length;
        const beforeTesting = q.testing.length;
        q.waiting = q.waiting.filter(pid => pid !== id);
        q.testing = q.testing.filter(t => t.userId !== id && t.testerId !== id);
        if (q.waiting.length !== beforeWaiting || q.testing.length !== beforeTesting) changed = true;
    }
    return changed;
}

// Safety net for anyone who left while the bot was offline (guildMemberRemove
// only fires while the bot is connected) - sweeps on every startup so stale
// data (e.g. a #1 leaderboard spot held by someone who's long gone) never
// lingers until someone tries to manually /removetier a person Discord's own
// slash-command picker won't even let you select anymore.
async function cleanupLeftMembers(guild) {
    try {
        const members = await guild.members.fetch();
        const memberIds = new Set(members.keys());
        const ids = new Set([...Object.keys(db.players), ...Object.keys(db.testers)]);
        let changed = false;
        for (const id of ids) {
            if (memberIds.has(id)) continue;
            if (wipePlayerData(id)) changed = true;
        }
        if (changed) {
            saveData();
            console.log('🧹 Swept orphaned data for members who left while the bot was offline.');
        }
    } catch (e) { console.error('cleanupLeftMembers error:', e); }
}

client.on('guildMemberRemove', async (member) => {
    if (member.guild.id !== GUILD_ID) return;
    if (wipePlayerData(member.id)) {
        saveData();
        console.log(`🧹 Removed all data for ${member.user?.tag || member.id} after they left the server.`);
        await refreshDeployedLeaderboard(member.guild);
    }
});

// ==================== GEMINI AI MESSAGE HANDLER ====================
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;
    if (message.channel.name !== AI_CHANNEL_NAME) return;
    if (!geminiClient) {
        console.error(`[AI] Message received in ${message.channel.name} but AI is not ready — check GROQ_API_KEY in .env and restart.`);
        await message.reply('❌ AI is currently unavailable. Please try again later.');
        return;
    }

    await message.channel.sendTyping();

    try {
        const response = await getAIResponse(message.author.id, message.content, message.guild);
        if (response) {
            if (response.length > 2000) {
                const chunks = response.match(/.{1,1990}/g) || [response];
                for (const chunk of chunks) {
                    await message.reply(chunk);
                }
            } else {
                await message.reply(response);
            }
        } else {
            await message.reply('🤔 Hmm, I couldn\'t quite process that. Could you try rephrasing your question?');
        }
    } catch (error) {
        console.error('AI Response Error:', error);
        await message.reply('❌ Something went wrong. Please try again later.');
    }
});

// ==================== INTERACTION HANDLER ====================
client.on('interactionCreate', async interaction => {
    try {
        if (interaction.isButton()) {
            if (interaction.customId === 'apply_button') {
                if (db.players[interaction.user.id]) return interaction.reply({ content: '❌ Already applied!', flags: 64 });
                await showApplyModal(interaction);
                return;
            }
            if (interaction.customId === 'request_button') {
                if (!db.players[interaction.user.id]) return interaction.reply({ content: '❌ Apply first!', flags: 64 });
                const row = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder().setCustomId('request_menu').setPlaceholder('Select a gamemode')
                        .addOptions(GAMEMODES.map(g => ({ label: g.name, value: g.name })))
                );
                await interaction.reply({ content: '🎮 **Select a gamemode:**', components: [row], flags: 64 });
                return;
            }
            if (interaction.customId === 'profile_button') {
                if (!db.players[interaction.user.id]) return interaction.reply({ content: '❌ Apply first!', flags: 64 });
                await showProfile(interaction, interaction.user);
                return;
            }
            if (interaction.customId === 'edit_profile_button') {
                await showEditProfileModal(interaction);
                return;
            }
            if (interaction.customId === 'edit_profile_disabled') {
                await interaction.reply({ content: `❌ You have used all ${MAX_PROFILE_EDITS} profile edits.`, flags: 64 });
                return;
            }
            if (interaction.customId === 'start_test') {
                await interaction.deferUpdate();
                const embed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle('⏱️ TEST STARTED!')
                    .setDescription('Use the **Done** button below when finished.');
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('done_test').setLabel('✅ Done').setStyle(ButtonStyle.Success)
                );
                await interaction.channel.send({ embeds: [embed], components: [row] });
                return;
            }
            if (interaction.customId === 'done_test') {
                let playerId = interaction.channel.topic?.match(/PlayerID: (\d+)/)?.[1];
                let gamemode = interaction.channel.topic?.match(/Gamemode:\s*(.+?)(?:\s\||$)/)?.[1];
                if (!playerId) {
                    const match = interaction.channel.name.match(/test-(.+)-(.+)/);
                    if (match) {
                        const username = match[1];
                        gamemode = match[2];
                        for (const [id,data] of Object.entries(db.players)) if (data.username === username) { playerId = id; break; }
                    }
                }
                if (!playerId) return interaction.reply({ content: '❌ Could not find player', flags: 64 });
                await showDoneModal(interaction, playerId, gamemode);
                return;
            }
            if (interaction.customId === 'verify_pack') {
                const channel = interaction.channel;
                const testerId = channel.topic?.match(/TesterID: (\d+)/)?.[1];
                if (testerId && interaction.user.id !== testerId && !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    return interaction.reply({ content: '❌ Only the tester who claimed this player can verify.', flags: 64 });
                }
                await interaction.reply({ content: '✅ Texture pack verified. You may now start the test.', flags: 64 });
                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('start_test').setLabel('▶ Start Test').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
                );
                const msg = await channel.messages.fetch(interaction.message.id);
                await msg.edit({ components: [row] });
                return;
            }
            if (interaction.customId === 'close_ticket') {
                await interaction.reply({ content: '🔒 Closing channel...', flags: 64 });
                const gamemode = interaction.channel.topic?.match(/Gamemode:\s*(.+?)(?:\s\||$)/)?.[1];
                const playerId = interaction.channel.topic?.match(/PlayerID: (\d+)/)?.[1];
                if (gamemode && playerId) {
                    const queue = db.queues[gamemode];
                    if (queue) {
                        queue.testing = queue.testing.filter(t => t.userId !== playerId);
                        saveData();
                        await updateQueueViewerAuto(interaction.guild, gamemode);
                    }
                }
                setTimeout(() => interaction.channel.delete().catch(()=>{}), 2000);
                return;
            }
            if (interaction.customId.startsWith('queue_position:')) {
                const gm = interaction.customId.split(':')[1];
                const queue = db.queues[gm];
                if (!queue) return interaction.reply({ content: '❌ Queue not found', flags: 64 });
                const pos = queue.waiting.indexOf(interaction.user.id);
                if (pos === -1) return interaction.reply({ content: '❌ Not in queue', flags: 64 });
                const embed = new EmbedBuilder().setColor(0x2ECC71).setTitle(`📍 Your Position in ${gm} Queue`).setDescription(`**Position:** #${pos+1} out of ${queue.waiting.length}\n**Players ahead:** ${pos}`);
                await interaction.reply({ embeds: [embed], flags: 64 });
                return;
            }
            if (interaction.customId.startsWith('queue_refresh:')) {
                const gamemode = interaction.customId.split(':')[1];
                await refreshQueueViewer(interaction.guild, gamemode);
                await interaction.deferUpdate();
                return;
            }
            if (interaction.customId.startsWith('queue_myposition:')) {
                const gamemode = interaction.customId.split(':')[1];
                const queue = db.queues[gamemode];
                if (!queue) return interaction.reply({ content: `❌ ${gamemode} queue not found`, flags: 64 });
                const pos = queue.waiting.indexOf(interaction.user.id);
                if (pos === -1) return interaction.reply({ content: `❌ Not in ${gamemode} queue`, flags: 64 });
                const embed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle(`📍 Your Position in ${gamemode} Queue`)
                    .setDescription(`**Position:** #${pos+1} out of ${queue.waiting.length}\n**Players ahead:** ${pos}`);
                await interaction.reply({ embeds: [embed], flags: 64 });
                return;
            }
            if (interaction.customId.startsWith('queue_leave:')) {
                const gamemode = interaction.customId.split(':')[1];
                const queue = db.queues[gamemode];
                if (!queue) return interaction.reply({ content: `❌ Queue for ${gamemode} not found.`, flags: 64 });
                const waiting = queue.waiting || [];
                const pos = waiting.indexOf(interaction.user.id);
                if (pos === -1) {
                    return interaction.reply({ content: `❌ You are not in the **${gamemode}** queue.`, flags: 64 });
                }
                queue.waiting = waiting.filter(id => id !== interaction.user.id);
                saveData();
                await refreshQueueViewer(interaction.guild, gamemode);
                await interaction.reply({ content: `🚪 You left the **${gamemode}** queue.`, flags: 64 });
                return;
            }
            if (interaction.customId.startsWith('leaderboard_page:')) {
                await interaction.deferUpdate();
                const parts = interaction.customId.split(':');
                const gamemode = parts[1];
                const page = parseInt(parts[2]);
                await updateLeaderboardMessage(interaction, gamemode, page, true, interaction.message, currentTierFilter);
                return;
            }
            if (interaction.customId.startsWith('leaderboard_myposition:')) {
                await interaction.deferReply({ flags: 64 });
                const gamemode = interaction.customId.split(':')[1];
                if (gamemode === 'overall') {
                    const standings = [];
                    for (const [id] of Object.entries(db.players)) {
                        const points = calculateTotalPoints(id);
                        standings.push({ id, points });
                    }
                    standings.sort((a,b) => b.points - a.points);
                    const pos = standings.findIndex(p => p.id === interaction.user.id) + 1;
                    if (pos === 0) return interaction.editReply({ content: `❌ Not ranked.` });
                    const embed = new EmbedBuilder().setColor(0x2ECC71).setTitle(`📍 ${interaction.user.username}'s Position`).setDescription(`**Leaderboard:** Overall\n**Rank:** #${pos}\n**Players ahead:** ${pos-1}\n**Players behind:** ${standings.length-pos}`);
                    await interaction.editReply({ embeds: [embed] });
                } else {
                    const gamemodeName = getGamemodeDisplayName(gamemode);
                    const players = await getGamemodeLeaderboardData(interaction.guild, gamemodeName, currentTierFilter);
                    const pos = players.findIndex(p => p.id === interaction.user.id) + 1;
                    if (pos === 0) return interaction.editReply({ content: `❌ Not ranked in ${gamemodeName}` });
                    const embed = new EmbedBuilder().setColor(0x2ECC71).setTitle(`📍 ${interaction.user.username}'s Position`).setDescription(`**Leaderboard:** ${gamemodeName}${currentTierFilter ? ' - ' + currentTierFilter : ''}\n**Rank:** #${pos}\n**Players ahead:** ${pos-1}\n**Players behind:** ${players.length-pos}`);
                    await interaction.editReply({ embeds: [embed] });
                }
                return;
            }
            if (interaction.customId === 'leaderboard_search') {
                const modal = new ModalBuilder().setCustomId('search_player_modal').setTitle('🔎 Search Player');
                modal.addComponents(new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('search_username').setLabel('Minecraft Username').setStyle(TextInputStyle.Short).setRequired(true)));
                await interaction.showModal(modal);
                return;
            }
            if (interaction.customId.startsWith('view_profile:')) {
                const userId = interaction.customId.split(':')[1];
                const user = await client.users.fetch(userId).catch(()=>null);
                if (user) await showProfile(interaction, user);
                else await interaction.reply({ content: '❌ User not found', flags: 64 });
                return;
            }
            if (interaction.customId.startsWith('testers_page:')) {
                await interaction.deferUpdate();
                const page = parseInt(interaction.customId.split(':')[1]);
                await sendTestersEmbed(interaction, page);
                return;
            }
        }

        if (interaction.isStringSelectMenu()) {
            if (interaction.customId === 'request_menu') {
                const gm = interaction.values[0];
                if (!db.players[interaction.user.id]) return interaction.reply({ content: '❌ Apply first', flags: 64 });
                if (db.blacklist.includes(interaction.user.id)) return interaction.reply({ content: '❌ Blacklisted', flags: 64 });
                const player = db.players[interaction.user.id];
                const cdDays = db.settings.universalCooldown || 0;
                const lastTest = player.lastTestTimestamp || 0;
                if (cdDays > 0 && (Date.now() - lastTest) < cdDays * 24 * 60 * 60 * 1000) {
                    const remaining = Math.ceil((cdDays * 24 * 60 * 60 * 1000 - (Date.now() - lastTest)) / (24 * 60 * 60 * 1000));
                    return interaction.reply({ content: `❌ You are on cooldown. Please wait ${remaining} day(s) before requesting any test.`, flags: 64 });
                }
                if (!db.queues[gm]) db.queues[gm] = { waiting: [], testing: [], messageId: null };
                const max = db.settings.maxQueueSizePerGamemode?.[gm] || MAX_QUEUE_SIZE;
                if (db.queues[gm].waiting.length >= max) return interaction.reply({ content: `❌ ${gm} queue full`, flags: 64 });
                if (db.queues[gm].waiting.includes(interaction.user.id)) return interaction.reply({ content: '❌ Already in queue', flags: 64 });
                db.queues[gm].waiting.push(interaction.user.id);
                player.lastRequestAt = Date.now();
                saveData();
                await updateQueueViewerAuto(interaction.guild, gm);
                await interaction.reply({ content: `✅ Added to ${gm} queue (#${db.queues[gm].waiting.length})`, flags: 64 });
                return;
            }
            if (interaction.customId === 'queue_gamemode_menu') {
                const gamemode = interaction.values[0];
                await refreshQueueViewer(interaction.guild, gamemode);
                await interaction.deferUpdate();
                return;
            }
            if (interaction.customId === 'leaderboard_view_profile') {
                const userId = interaction.values[0];
                const user = await client.users.fetch(userId).catch(() => null);
                if (user) await showProfile(interaction, user);
                else await interaction.reply({ content: '❌ User not found', flags: 64 });
                return;
            }
            if (interaction.customId === 'leaderboard_gamemode_menu') {
                await interaction.deferUpdate();
                const gamemode = interaction.values[0];
                if (gamemode === 'overall') {
                    currentTierFilter = null;
                    await updateLeaderboardMessage(interaction, gamemode, 1, true, interaction.message, null);
                } else {
                    currentTierFilter = null;
                    await updateLeaderboardMessage(interaction, gamemode, 1, true, interaction.message, null);
                }
                return;
            }
            if (interaction.customId === 'leaderboard_tier_menu') {
                await interaction.deferUpdate();
                const tierFilter = interaction.values[0];
                if (tierFilter === 'all') {
                    currentTierFilter = null;
                } else {
                    currentTierFilter = tierFilter;
                }
                await updateLeaderboardMessage(interaction, currentLeaderboardGamemode, 1, true, interaction.message, currentTierFilter);
                return;
            }
            if (interaction.customId.startsWith('set_tester_gamemode:')) {
                const targetId = interaction.customId.split(':')[1];
                const gamemode = interaction.values[0];
                const modal = new ModalBuilder().setCustomId(`tester_details:${targetId}:${gamemode}`).setTitle(`Set ${gamemode} Tester Details`);
                modal.addComponents(
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('tier').setLabel('Tier (LT5-HT1)').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('HT3, LT2, etc.')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('region').setLabel('Region').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('EU, NA, ASIA')),
                    new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('device').setLabel('Device').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('PC, Mobile, Console'))
                );
                await interaction.showModal(modal);
                return;
            }
            if (interaction.customId.startsWith('remove_tier_gamemode:')) {
                const targetId = interaction.customId.split(':')[1];
                const gamemode = interaction.values[0];
                const player = db.players[targetId];
                if (!player) return interaction.reply({ content: '❌ Player not found', flags: 64 });
                if (player.gamemodeRanks && player.gamemodeRanks[gamemode]) {
                    delete player.gamemodeRanks[gamemode];
                    if (player.gamemodePoints) delete player.gamemodePoints[gamemode];
                    if (player.gamemodeLastTest) delete player.gamemodeLastTest[gamemode];
                    saveData();
                    await updateTitleRole(interaction.guild, targetId);
                    await refreshDeployedLeaderboard(interaction.guild);
                    await interaction.reply({ content: `✅ Removed ${gamemode} rank and points from <@${targetId}>.`, flags: 64 });
                } else {
                    await interaction.reply({ content: `❌ ${gamemode} rank not found for that player.`, flags: 64 });
                }
                return;
            }
        }

        if (interaction.isModalSubmit()) {
            if (interaction.customId === 'apply_modal') {
                if (db.players[interaction.user.id]) return interaction.reply({ content: '❌ Already applied', flags: 64 });
                const username = interaction.fields.getTextInputValue('username');
                const region = interaction.fields.getTextInputValue('region');
                const device = interaction.fields.getTextInputValue('device');
                const role = await getRole(interaction.guild, APPLICANT_ROLE);
                if (!role) return interaction.reply({ content: '❌ Role not found', flags: 64 });
                await interaction.member.roles.add(role);
                const bedrockSkin = await fetchBedrockSkin(username);
                const skinUrl = bedrockSkin ? null : await fetchSkinAvatar(username);
                db.players[interaction.user.id] = {
                    username, region, device, rank: null, gamemodeRanks: {}, gamemodePoints: {}, gamemodeLastTest: {},
                    customAvatar: null, skinUrl: skinUrl, textureId: bedrockSkin?.textureId || null, appliedAt: Date.now(), testHistory: [], notifyOnPick: true,
                    lastRequestAt: 0, lastTestTimestamp: 0, warnings: [], strikes: 0, editCount: 0
                };
                saveData();
                await updateTitleRole(interaction.guild, interaction.user.id);
                if (bedrockSkin) {
                    await interaction.reply({ content: `✅ Applied! Welcome ${username}\n✅ Bedrock skin found and saved!`, flags: 64 });
                } else if (skinUrl) {
                    await interaction.reply({ content: `✅ Applied! Welcome ${username}\n✅ Skin found and saved!`, flags: 64 });
                } else {
                    await interaction.reply({ content: `✅ Applied! Welcome ${username}\n⚠️ Skin could not be fetched. Use /refreshskin later.`, flags: 64 });
                }
                return;
            }
            if (interaction.customId === 'editprofile_modal') {
                if (!db.players[interaction.user.id]) return interaction.reply({ content: '❌ You haven\'t applied yet!', flags: 64 });
                const player = db.players[interaction.user.id];
                const editCount = player.editCount !== undefined ? player.editCount : 0;
                if (editCount >= MAX_PROFILE_EDITS) {
                    return interaction.reply({ content: `❌ You have already used all ${MAX_PROFILE_EDITS} profile edits.`, flags: 64 });
                }
                const username = interaction.fields.getTextInputValue('username');
                const region = interaction.fields.getTextInputValue('region');
                const device = interaction.fields.getTextInputValue('device');
                const oldUsername = player.username;
                player.username = username;
                player.region = region;
                player.device = device;
                player.editCount = editCount + 1;
                if (username !== oldUsername) {
                    const bedrockSkin = await fetchBedrockSkin(username);
                    if (bedrockSkin) {
                        player.textureId = bedrockSkin.textureId;
                    } else {
                        const newSkin = await fetchSkinAvatar(username);
                        if (newSkin) player.skinUrl = newSkin;
                    }
                }
                saveData();
                await interaction.reply({ content: `✅ Profile updated! (${player.editCount}/${MAX_PROFILE_EDITS} edits used)`, flags: 64 });
                return;
            }
            if (interaction.customId === 'search_player_modal') {
                const term = interaction.fields.getTextInputValue('search_username').toLowerCase();
                const results = [];
                for (const [id,data] of Object.entries(db.players)) if (data.username.toLowerCase().includes(term)) results.push({ id, username: data.username, points: calculateTotalPoints(id) });
                if (!results.length) return interaction.reply({ content: '❌ No players found', flags: 64 });
                let desc = '';
                for (let i=0;i<Math.min(results.length,10);i++) desc += `${i+1}. **${results[i].username}** - ${results[i].points} pts\n`;
                const embed = new EmbedBuilder().setColor(0x3498DB).setTitle(`🔎 Results for "${term}"`).setDescription(desc);
                const row = new ActionRowBuilder();
                for (let i=0;i<Math.min(results.length,5);i++) row.addComponents(new ButtonBuilder().setCustomId(`view_profile:${results[i].id}`).setLabel(results[i].username).setStyle(ButtonStyle.Secondary));
                await interaction.reply({ embeds: [embed], components: row.components.length ? [row] : [], flags: 64 });
                return;
            }
            if (interaction.customId.startsWith('tester_details:')) {
                const parts = interaction.customId.split(':');
                const targetId = parts[1];
                const gamemode = parts[2];
                const tier = interaction.fields.getTextInputValue('tier');
                const region = interaction.fields.getTextInputValue('region');
                const device = interaction.fields.getTextInputValue('device');
                const targetMember = await interaction.guild.members.fetch(targetId).catch(()=>null);
                if (!targetMember) return interaction.reply({ content: '❌ User not found', flags: 64 });
                const gmData = GAMEMODES.find(g => g.name === gamemode);
                if (gmData) {
                    const testerRole = await getRole(interaction.guild, gmData.testerRole);
                    if (testerRole) await targetMember.roles.add(testerRole).catch(()=>{});
                }
                db.testers[targetId] = { gamemode, tier, region, device, setBy: interaction.user.id, setAt: Date.now(), certified: false };
                saveData();
                await announceTester(interaction.guild, targetId, 'add');
                await interaction.reply({ content: `✅ Tester profile set for <@${targetId}> (${gamemode})!`, flags: 64 });
                return;
            }
            if (interaction.customId.startsWith('forceapply_modal:')) {
                const targetId = interaction.customId.split(':')[1];
                const username = interaction.fields.getTextInputValue('username');
                const region = interaction.fields.getTextInputValue('region');
                const device = interaction.fields.getTextInputValue('device');
                const target = await interaction.guild.members.fetch(targetId).catch(()=>null);
                if (!target) return interaction.reply({ content: '❌ Target not found', flags: 64 });
                const role = await getRole(interaction.guild, APPLICANT_ROLE);
                if (!role) return interaction.reply({ content: '❌ Role not found', flags: 64 });
                await target.roles.add(role);
                const skinUrl = await fetchSkinAvatar(username);
                db.players[targetId] = {
                    username, region, device, rank: null, gamemodeRanks: {}, gamemodePoints: {}, gamemodeLastTest: {},
                    customAvatar: null, skinUrl: skinUrl, appliedAt: Date.now(), testHistory: [], notifyOnPick: true,
                    lastRequestAt: 0, lastTestTimestamp: 0, warnings: [], strikes: 0, editCount: 0
                };
                saveData();
                await updateTitleRole(interaction.guild, targetId);
                await interaction.reply({ content: `✅ Force applied ${target.user.tag}`, flags: 64 });
                return;
            }
            if (interaction.customId.startsWith('done_modal:')) {
                await interaction.deferUpdate();
                const parts = interaction.customId.split(':');
                const playerId = parts[1];
                const gamemodeName = parts[2];
                let rankInput = interaction.fields.getTextInputValue('rank');
                const score = interaction.fields.getTextInputValue('score');
                const notes = interaction.fields.getTextInputValue('notes') || 'No notes';
                const player = db.players[playerId];
                if (!player) return interaction.followUp({ content: '❌ Player not found', flags: 64 });
                
                const previousRank = player.gamemodeRanks?.[gamemodeName] || null;
                if (!player.gamemodePoints) player.gamemodePoints = {};
                const currentPoints = player.gamemodePoints[gamemodeName] || 0;
                let pointsEarned = 0, isUpgrade = false, newPoints = currentPoints;
                let rank = rankInput;
                if (rankInput.toLowerCase().includes('no upgrade')) {
                    rank = 'No upgrade';
                    pointsEarned = 0;
                } else {
                    rank = rankInput.toUpperCase();
                    if (!RANK_ORDER.includes(rank)) {
                        return interaction.followUp({ content: `❌ Invalid rank: ${rank}. Use LT5, MT5, HT5, LT4, etc.`, flags: 64 });
                    }
                    // Points are fixed per tier, independent of previous rank or
                    // how many gamemodes the player has been tested in.
                    newPoints = getFixedPointsForRank(rank);
                    pointsEarned = newPoints - currentPoints;
                    if (previousRank !== rank) {
                        if (!player.gamemodeRanks) player.gamemodeRanks = {};
                        player.gamemodeRanks[gamemodeName] = rank;
                        isUpgrade = pointsEarned > 0;
                    }
                }
                
                player.gamemodePoints[gamemodeName] = newPoints;
                player.gamemodeLastTest[gamemodeName] = Date.now();
                
                if (isUpgrade) {
                    await setRank(interaction.guild, playerId, rank);
                }
                
                player.testHistory.push({ tester: interaction.user.id, gamemode: gamemodeName, rank, score, notes, pointsEarned, date: Date.now() });
                player.lastTestTimestamp = Date.now();
                
                if (player.strikes >= STRIKE_BAN_LIMIT && !db.blacklist.includes(playerId)) {
                    db.blacklist.push(playerId);
                    try { await interaction.guild.members.fetch(playerId).then(m => m.send(`🚫 You have been automatically blacklisted from testing due to reaching ${STRIKE_BAN_LIMIT} strikes.`)).catch(()=>{}); } catch(e) {}
                }
                
                saveData();
                await updateTitleRole(interaction.guild, playerId);
                await updateTesterStats(interaction.user.id);
                
                // Keep the public leaderboard channel in sync instantly - no more
                // waiting for someone to click a button or run /refreshleaderboard.
                await refreshDeployedLeaderboard(interaction.guild);
                
                const totalPoints = calculateTotalPoints(playerId);
                const title = getTitleFromPoints(totalPoints);
                const titleImage = TITLE_IMAGES[title.name] || TITLE_IMAGES['Combat Learner'];
                const { thumbnailUrl, files: avatarFiles } = await getAvatarForEmbed(player);
                
                // Classify the outcome so the announcement actually communicates
                // what happened, instead of every result looking the same.
                const prevIndex = previousRank ? RANK_ORDER.indexOf(previousRank) : -1;
                const newIndex = rank !== 'No upgrade' ? RANK_ORDER.indexOf(rank) : -1;
                let statusEmoji, statusLabel, statusColor;
                if (rank === 'No upgrade' || (previousRank && rank === previousRank)) {
                    statusEmoji = '❌'; statusLabel = 'TEST FAILED'; statusColor = 0xE74C3C;
                } else if (prevIndex === -1) {
                    statusEmoji = '🆕'; statusLabel = 'TIER AWARDED'; statusColor = 0x3498DB;
                } else if (newIndex > prevIndex) {
                    statusEmoji = '⬆️'; statusLabel = 'TIER UPGRADE'; statusColor = 0x2ECC71;
                } else {
                    statusEmoji = '⬇️'; statusLabel = 'TIER DEMOTION'; statusColor = 0xE67E22;
                }
                
                const resultsEmbed = new EmbedBuilder()
                    .setColor(statusColor)
                    .setAuthor({ name: `${statusEmoji} ${statusLabel}`, iconURL: titleImage })
                    .setTitle(player.username)
                    .setThumbnail(thumbnailUrl)
                    .addFields(
                        { name: '🎮 Gamemode', value: gamemodeName, inline: true },
                        { name: '🏅 Result', value: rank === 'No upgrade' ? 'No Upgrade' : `\`${rank}\``, inline: true },
                        { name: '📊 Previous', value: previousRank ? `\`${previousRank}\`` : '*None*', inline: true },
                        { name: '📈 Points', value: `${pointsEarned > 0 ? '+' : ''}${pointsEarned} (${newPoints} total)`, inline: true },
                        { name: '🥊 Match Score', value: score, inline: true },
                        { name: '👤 Tester', value: `<@${interaction.user.id}>`, inline: true },
                        { name: '📝 Notes', value: notes, inline: false }
                    )
                    .setFooter({ text: `${BOT_NAME} • Test Result` })
                    .setTimestamp();
                
                const resultsChannel = interaction.guild.channels.cache.find(c=>c.name===RESULTS_CHANNEL);
                if (resultsChannel) await resultsChannel.send({ content: `<@${playerId}>`, embeds: [resultsEmbed], files: avatarFiles });
                
                for (const gm of GAMEMODES) {
                    const q = db.queues[gm.name];
                    if (q) {
                        q.waiting = q.waiting.filter(id=>id!==playerId);
                        q.testing = q.testing.filter(t=>t.userId!==playerId);
                        await updateQueueViewerAuto(interaction.guild, gm.name);
                    }
                }
                
                const testerData = db.testers[interaction.user.id];
                if (testerData && testerData.autoTestGamemode === gamemodeName) {
                    const queue = db.queues[gamemodeName];
                    if (queue && queue.waiting.length > 0) {
                        const nextPlayerId = queue.waiting[0];
                        const nextPlayer = await interaction.guild.members.fetch(nextPlayerId).catch(()=>null);
                        if (nextPlayer) {
                            queue.waiting = queue.waiting.filter(id => id !== nextPlayerId);
                            queue.testing.push({ userId: nextPlayerId, testerId: interaction.user.id });
                            saveData();
                            let category;
                            const overrideId = CATEGORY_OVERRIDES[gamemodeName];
                            if (overrideId) {
                                category = interaction.guild.channels.cache.get(overrideId);
                            }
                            if (!category) {
                                const catName = GAMEMODE_CATEGORIES[gamemodeName];
                                category = interaction.guild.channels.cache.find(c => c.name === catName && c.type === 4);
                                if (!category) {
                                    console.log(`[AutoTest] Category "${catName}" missing – creating...`);
                                    category = await interaction.guild.channels.create({
                                        name: catName,
                                        type: 4,
                                        permissionOverwrites: [
                                            { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                                            { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels] }
                                        ]
                                    });
                                }
                            }
                            if (category) {
                                const gmData = GAMEMODES.find(g => g.name === gamemodeName);
                                const testerRole = gmData ? await getRole(interaction.guild, gmData.testerRole) : null;
                                const permissionOverwrites = [
                                    { id: interaction.guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                                    { id: nextPlayerId, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                                ];
                                if (testerRole) permissionOverwrites.push({ id: testerRole.id, allow: [PermissionsBitField.Flags.ViewChannel] });
                                const newChannel = await interaction.guild.channels.create({
                                    name: `test-${nextPlayer.user.username}-${gamemodeName}`,
                                    type: 0,
                                    parent: category,
                                    permissionOverwrites
                                });
                                await newChannel.setTopic(`PlayerID: ${nextPlayerId} | Gamemode: ${gamemodeName} | TesterID: ${interaction.user.id}`);
                                const playerData = db.players[nextPlayerId];
                                const kitImg = db.gamemodeImages[gamemodeName];
                                const pastTests = (playerData.testHistory || []).filter(t => t.gamemode === gamemodeName).slice(-3);
                                const historyText = pastTests.length ? pastTests.map(t => `• ${t.rank} → by <@${t.tester}> on ${new Date(t.date).toLocaleDateString()}`).join('\n') : '*No past tests*';
                                
                                const servers = db.testServers || [];
                                const serverList = servers.map((s, i) => `${i+1}. ${s.ip}:${s.port}`).join('\n') || 'No test servers configured.';
                                
                                const serverInfo = servers.length ? 
                                    `**Available Test Servers:**\n${serverList}` : 
                                    'No test servers configured. Use `/addtestserver` to add one.';
                                
                                const embed = new EmbedBuilder()
                                    .setColor(0x2C2F33)
                                    .setTitle(`${getGamemodeSymbol(gamemodeName)} Tier Test: ${gamemodeName}`)
                                    .setDescription([
                                        `Welcome <@${nextPlayerId}>!`,
                                        `You have been claimed by <@${interaction.user.id}>.`,
                                        ``,
                                        serverInfo,
                                        ``,
                                        `**Player Application Details**`,
                                        `> **Discord:** <@${nextPlayerId}> (${nextPlayer.user.tag})`,
                                        `> **IGN:** ${playerData.username}`,
                                        `> **Region:** ${playerData.region}`,
                                        `> **Device:** ${playerData.device}`,
                                        ``,
                                        `**Past Tier History**`,
                                        historyText,
                                        ``,
                                        `📸 **Texture Pack Verification Required**`,
                                        `Please send a screenshot of your global resource pack list.`
                                    ].join('\n'))
                                    .setThumbnail(kitImg)
                                    .setFooter({ text: `${BOT_NAME} | Test Channel` })
                                    .setTimestamp();
                                const verifyRow = new ActionRowBuilder().addComponents(
                                    new ButtonBuilder().setCustomId('verify_pack').setLabel('✅ Verify Pack').setStyle(ButtonStyle.Success),
                                    new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
                                );
                                await newChannel.send({ content: `<@${nextPlayerId}> <@${interaction.user.id}>`, embeds: [embed], components: [verifyRow] });
                                await updateQueueViewerAuto(interaction.guild, gamemodeName);
                                await interaction.followUp({ content: `🔄 Auto-test claimed ${nextPlayer.user.tag} for ${gamemodeName}. New channel: ${newChannel}`, flags: 64 });
                            }
                        }
                    }
                }
                
                const syncData = {
                    playerId, playerName: player.username, gamemode: gamemodeName, previousRank, newRank: rank,
                    pointsEarned, totalPoints, title: title.name, allGamemodeRanks: player.gamemodeRanks,
                    score, notes, testerId: interaction.user.id, testerName: interaction.user.username, timestamp: new Date().toISOString()
                };
                syncToWebsite(syncData).catch(console.error);
                
                await interaction.followUp({ content: `✅ Test completed! ${pointsEarned > 0 ? '+' : ''}${pointsEarned} points`, flags: 64 });
                
                setTimeout(() => {
                    try { interaction.channel.delete(); } catch(e) {}
                }, 5000);
                return;
            }
            if (interaction.customId === 'website_sync_modal') {
                const apiUrl = interaction.fields.getTextInputValue('api_url');
                const apiKey = interaction.fields.getTextInputValue('api_key');
                db.websiteSync = { enabled: true, apiUrl: apiUrl, apiKey: apiKey };
                saveData();
                await interaction.reply({ content: `✅ Website sync configured!\nURL: ${apiUrl}\nKey: ${'•'.repeat(apiKey.length)}`, flags: 64 });
                return;
            }
        }

        if (!interaction.isChatInputCommand()) return;
        const { commandName, options, member, guild, channel } = interaction;
        const isAdmin = member.permissions.has(PermissionsBitField.Flags.Administrator) || member.roles.cache.some(r => r.name === STAFF_ROLES.ADMIN);
        const isMod = isAdmin || member.roles.cache.some(r => r.name === STAFF_ROLES.MOD);
        const isOwner = interaction.user.id === interaction.guild.ownerId;
        const isCertifiedTester = db.testers[interaction.user.id]?.certified === true;
        const canTest = isAdmin || (isCertifiedTester && db.testers[interaction.user.id]?.gamemode);

        // PLAYER COMMANDS
        if (commandName === 'apply') {
            const dashboardCh = guild.channels.cache.find(c => c.name === DASHBOARD_CHANNEL);
            if (channel.id !== dashboardCh?.id) return interaction.reply({ content: `❌ Use ${DASHBOARD_CHANNEL}`, flags: 64 });
            await showApplyModal(interaction);
            return;
        }
        if (commandName === 'request') {
            const requestCh = guild.channels.cache.find(c => c.name === REQUEST_CHANNEL);
            if (channel.id !== requestCh?.id) return interaction.reply({ content: `❌ Use ${REQUEST_CHANNEL}`, flags: 64 });
            if (!db.players[interaction.user.id]) return interaction.reply({ content: '❌ Apply first', flags: 64 });
            const row = new ActionRowBuilder().addComponents(
                new StringSelectMenuBuilder().setCustomId('request_menu').setPlaceholder('Select gamemode')
                    .addOptions(GAMEMODES.map(g=>({ label: g.name, value: g.name })))
            );
            await interaction.reply({ content: '🎮 Select gamemode:', components: [row], flags: 64 });
            return;
        }
        if (commandName === 'cancel') {
            let removed = false;
            for (const gm of GAMEMODES) {
                const q = db.queues[gm.name];
                if (q && q.waiting.includes(interaction.user.id)) {
                    q.waiting = q.waiting.filter(id=>id!==interaction.user.id);
                    await updateQueueViewerAuto(guild, gm.name);
                    removed = true;
                }
            }
            await interaction.reply({ content: removed ? '✅ Removed from queues' : '❌ Not in any queue', flags: 64 });
            return;
        }
        if (commandName === 'position') {
            let msg = '**Your Queue Positions:**\n━━━━━━━━━━━━━━━━━━━━\n';
            let inQueue = false;
            for (const gm of GAMEMODES) {
                const q = db.queues[gm.name];
                if (q) {
                    const pos = q.waiting.indexOf(interaction.user.id);
                    if (pos !== -1) {
                        msg += `**${gm.name}:** #${pos+1}/${q.waiting.length}\n`;
                        inQueue = true;
                    }
                }
            }
            if (!inQueue) msg += '*Not in any queue*';
            await interaction.reply({ content: msg, flags: 64 });
            return;
        }
        if (commandName === 'profile') {
            const dashboardCh = guild.channels.cache.find(c => c.name === DASHBOARD_CHANNEL);
            if (channel.id !== dashboardCh?.id) return interaction.reply({ content: `❌ Use ${DASHBOARD_CHANNEL}`, flags: 64 });
            const target = options.getUser('user') || interaction.user;
            await showProfile(interaction, target);
            return;
        }
        if (commandName === 'editprofile') {
            await showEditProfileModal(interaction);
            return;
        }
        if (commandName === 'refreshskin') {
            if (!db.players[interaction.user.id]) return interaction.reply({ content: '❌ Apply first', flags: 64 });
            const player = db.players[interaction.user.id];
            await interaction.reply({ content: '🔄 Fetching your skin...', flags: 64 });
            const bedrockSkin = await fetchBedrockSkin(player.username);
            if (bedrockSkin) {
                player.textureId = bedrockSkin.textureId;
                saveData();
                await interaction.editReply({ content: '✅ Bedrock skin updated successfully!', flags: 64 });
                return;
            }
            const newSkin = await fetchSkinAvatar(player.username);
            if (newSkin) {
                player.skinUrl = newSkin;
                saveData();
                await interaction.editReply({ content: '✅ Skin updated successfully!', flags: 64 });
            } else {
                await interaction.editReply({ content: '❌ Could not fetch skin. Make sure your gamertag is correct and try again later.', flags: 64 });
            }
            return;
        }
        if (commandName === 'cooldown') {
            if (!db.players[interaction.user.id]) return interaction.reply({ content: '❌ Apply first', flags: 64 });
            const lastTest = db.players[interaction.user.id].lastTestTimestamp || 0;
            const cooldownDays = db.settings.universalCooldown || 0;
            if (cooldownDays === 0) return interaction.reply({ content: 'Cooldown is disabled.', flags: 64 });
            const elapsed = Date.now() - lastTest;
            const remainingDays = Math.max(0, cooldownDays - Math.floor(elapsed / (24 * 60 * 60 * 1000)));
            if (remainingDays === 0) await interaction.reply({ content: '✅ You are not on cooldown. You can request a test now.', flags: 64 });
            else await interaction.reply({ content: `⏳ You are on cooldown for ${remainingDays} more day(s).`, flags: 64 });
            return;
        }
        if (commandName === 'history') {
            const p = db.players[interaction.user.id];
            if (!p) return interaction.reply({ content: '❌ Apply first', flags: 64 });
            let text = '';
            for (let i=0;i<p.testHistory.length;i++) {
                const t = p.testHistory[i];
                text += `${i+1}. ${new Date(t.date).toLocaleDateString()} | ${t.gamemode} | ${t.rank} | ${t.pointsEarned > 0 ? '+' : ''}${t.pointsEarned}pts\n`;
            }
            const embed = new EmbedBuilder().setColor(0x3498DB).setTitle(`📜 ${p.username}'s Test History`).setDescription(text || '*No tests yet*').setFooter({ text: `Total points: ${calculateTotalPoints(interaction.user.id)}` });
            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }
        if (commandName === 'leaderboard') {
            await interaction.deferReply();
            await updateLeaderboardMessage(interaction, 'overall', 1);
            return;
        }
        if (commandName === 'stats') {
            const p = db.players[interaction.user.id];
            if (!p) return interaction.reply({ content: '❌ Apply first', flags: 64 });
            let txt = '';
            for (const gm of GAMEMODE_ORDER) {
                const rank = p.gamemodeRanks?.[gm] || 'NA';
                const points = p.gamemodePoints?.[gm] || 0;
                txt += `${getGamemodeSymbol(gm)} ${gm}: ${rank} (${points} pts)\n`;
            }
            const embed = new EmbedBuilder().setColor(0x2ECC71).setTitle(`📊 ${p.username}'s Gamemode Stats`).setDescription(txt);
            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }
        if (commandName === 'rankup') {
            const points = calculateTotalPoints(interaction.user.id);
            const next = getTitleFromPoints(points+1);
            const needed = next.minPoints - points;
            const embed = new EmbedBuilder().setColor(0x9B59B6).setTitle('📈 Rank Up Progress').setDescription(`**Current:** ${getTitleFromPoints(points).name}\n**Points:** ${points}\n**Next:** ${next.name}\n**Needed:** ${needed} points`);
            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }
        if (commandName === 'notify') {
            if (!db.players[interaction.user.id]) return interaction.reply({ content: '❌ Apply first', flags: 64 });
            const p = db.players[interaction.user.id];
            p.notifyOnPick = !p.notifyOnPick;
            saveData();
            await interaction.reply({ content: `✅ Notifications ${p.notifyOnPick ? 'ON' : 'OFF'}`, flags: 64 });
            return;
        }
        if (commandName === 'kit') {
            const gm = options.getString('gamemode');
            const url = db.gamemodeImages[gm];
            if (!url) return interaction.reply({ content: `❌ No kit image for ${gm}. Use /kitimg add`, flags: 64 });
            const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(`${getGamemodeSymbol(gm)} ${gm} Kit`).setImage(url);
            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }
        if (commandName === 'testerinfo') {
            const targetUser = options.getUser('user');
            const td = db.testers[targetUser.id];
            if (!td) return interaction.reply({ content: '❌ Not a tester', flags: 64 });
            const symbol = getGamemodeSymbol(td.gamemode);
            const tests = db.testerStats[targetUser.id]?.tests || 0;
            const embed = new EmbedBuilder().setColor(0x5865F2).setTitle(`${symbol} ${td.gamemode} Tester`).setThumbnail(targetUser.displayAvatarURL()).setDescription(`**Tier:** ${td.tier}\n**Region:** ${td.region || 'Not set'}\n**Device:** ${td.device || 'Not set'}\n**Tests:** ${tests}`);
            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }
        if (commandName === 'testerleaderboard') {
            const top = Object.entries(db.testerStats).map(([id,data])=>({id, tests: data.tests})).sort((a,b)=>b.tests-a.tests).slice(0,10);
            if (!top.length) return interaction.reply({ content: 'No tester data yet', flags: 64 });
            let desc = '';
            for (let i=0;i<top.length;i++) {
                const m = await guild.members.fetch(top[i].id).catch(()=>null);
                desc += `${i+1}. ${m ? m.user.username : 'Unknown'} — ${top[i].tests} tests\n`;
            }
            const embed = new EmbedBuilder().setColor(0xF1C40F).setTitle('🏆 Tester of the Month').setDescription(desc);
            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }
        if (commandName === 'viewtestservers') {
            await viewTestServers(interaction);
            return;
        }

        // TESTER COMMANDS
        const testerCommands = ['queue','claim','testnow','autotest','start','done','close','forceclose','notes','warn','strike','blacklist','unblacklist','check','tester','audit'];
        if (testerCommands.includes(commandName)) {
            if (!hasCommandPermission(interaction, commandName)) {
                return interaction.reply({ content: '❌ You do not have permission to use this command.', flags: 64 });
            }
            if (!canTest) {
                return interaction.reply({ content: '❌ You need to be a certified tester.', flags: 64 });
            }
        }

        if (commandName === 'queue') {
            const gm = options.getString('gamemode');
            const q = db.queues[gm];
            if (!q?.waiting.length) return interaction.reply({ content: `📭 ${gm} queue empty`, flags: 64 });
            const testerDevice = db.testers[interaction.user.id]?.device;
            let filtered = q.waiting;
            if (testerDevice) filtered = q.waiting.filter(pid => db.players[pid]?.device === testerDevice);
            if (!filtered.length) return interaction.reply({ content: `📭 No ${testerDevice||''} players in ${gm} queue`, flags: 64 });
            let list = `**${gm} Queue (${filtered.length} waiting):**\n`;
            for (let i=0;i<Math.min(filtered.length,10);i++) {
                const pid = filtered[i];
                list += `${i+1}. <@${pid}>\n`;
            }
            await interaction.reply({ content: list, flags: 64 });
            return;
        }

        if (commandName === 'claim' || commandName === 'testnow') {
            console.log(`[Claim] ${interaction.user.tag} is claiming...`);
            await interaction.deferReply({ flags: 64 });
            try {
                const target = options.getMember('player');
                if (!target) return interaction.editReply({ content: '❌ Player not found' });
                let gamemode = null;
                for (const gm of GAMEMODES) {
                    const q = db.queues[gm.name];
                    if (q && q.waiting.includes(target.id)) {
                        gamemode = gm.name;
                        break;
                    }
                }
                if (!gamemode) return interaction.editReply({ content: '❌ Player not in any queue' });

                const requiredRole = GAMEMODES.find(g => g.name === gamemode)?.testerRole;
                if (requiredRole && !member.roles.cache.some(r => r.name === requiredRole) && !isAdmin) {
                    return interaction.editReply({ content: `❌ You need the **${requiredRole}** role to claim this player.` });
                }

                for (const gm of GAMEMODES) {
                    const q = db.queues[gm.name];
                    if (q && q.waiting.includes(target.id)) {
                        q.waiting = q.waiting.filter(id => id !== target.id);
                        q.testing.push({ userId: target.id, testerId: interaction.user.id });
                        saveData();
                        break;
                    }
                }

                let category;
                const overrideId = CATEGORY_OVERRIDES[gamemode];
                if (overrideId) {
                    category = guild.channels.cache.get(overrideId);
                    if (!category) console.warn(`[Claim] Override ID ${overrideId} not found`);
                }
                if (!category) {
                    const catName = GAMEMODE_CATEGORIES[gamemode];
                    category = guild.channels.cache.find(c => c.name === catName && c.type === 4);
                    if (!category) {
                        console.log(`[Claim] Category "${catName}" not found, creating...`);
                        category = await guild.channels.create({
                            name: catName,
                            type: 4,
                            permissionOverwrites: [
                                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels] }
                            ]
                        });
                        console.log(`[Claim] Created category: ${catName}`);
                    }
                }
                if (!category) {
                    return interaction.editReply({ content: `❌ Could not find or create category for ${gamemode}.` });
                }

                const gmData = GAMEMODES.find(g => g.name === gamemode);
                const testerRole = gmData ? await getRole(guild, gmData.testerRole) : null;
                const permissionOverwrites = [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: target.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ];
                if (testerRole) permissionOverwrites.push({ id: testerRole.id, allow: [PermissionsBitField.Flags.ViewChannel] });

                const testChannel = await Promise.race([
                    guild.channels.create({
                        name: `test-${target.user.username}-${gamemode}`,
                        type: 0,
                        parent: category,
                        permissionOverwrites
                    }),
                    new Promise((_, reject) => setTimeout(() => reject(new Error('Channel creation timed out')), 10000))
                ]);

                await testChannel.setTopic(`PlayerID: ${target.id} | Gamemode: ${gamemode} | TesterID: ${interaction.user.id}`);

                const playerData = db.players[target.id];
                const kitImg = db.gamemodeImages[gamemode];
                
                const allPastTests = (playerData.testHistory || []).slice(-3);
                const historyText = allPastTests.length ? allPastTests.map(t => `• ${t.gamemode} → ${t.rank} → by <@${t.tester}> on ${new Date(t.date).toLocaleDateString()}`).join('\n') : '*No past tests*';
                
                const lastTest = (playerData.testHistory || [])[playerData.testHistory?.length - 1];
                const lastNote = lastTest?.notes || 'No previous notes';

                const servers = db.testServers || [];
                const serverList = servers.map((s, i) => `${i+1}. ${s.ip}:${s.port}`).join('\n') || 'No test servers configured.';
                
                const serverEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('🌐 Available Test Servers')
                    .setDescription([
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                        `${serverList}`,
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                        `**🚀 Official MCBPVP Server**`,
                        `Coming soon! We're working hard to bring you`,
                        `the best Bedrock PvP experience.`,
                        ``
                    ].join('\n'))
                    .setFooter({ text: `${BOT_NAME} • Test Servers` })
                    .setTimestamp();

                const embeds = [];

                const claimEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle(`⚔️ ${gamemode} Test`)
                    .addFields(
                        { name: 'Claimed By', value: `<@${interaction.user.id}>`, inline: false },
                        { name: 'Status', value: '🟢 In Progress', inline: false }
                    )
                    .setFooter({ text: `${BOT_NAME} • ${gamemode} Test` })
                    .setTimestamp();
                embeds.push(claimEmbed);

                const playerInfoEmbed = new EmbedBuilder()
                    .setColor(0x2C2F33)
                    .setTitle('👤 Player Information')
                    .addFields(
                        { name: 'Username', value: playerData?.username || 'Not set', inline: true },
                        { name: 'Region', value: playerData?.region || 'Not set', inline: true },
                        { name: 'Device', value: playerData?.device || 'Not set', inline: true },
                        { name: 'Note', value: lastNote, inline: false }
                    )
                    .setFooter({ text: `${BOT_NAME} • Player Info` })
                    .setTimestamp();
                embeds.push(playerInfoEmbed);

                const appEmbed = new EmbedBuilder()
                    .setColor(0x2ECC71)
                    .setTitle('📊 Application')
                    .addFields(
                        { name: 'Status', value: '✅ Accepted', inline: true },
                        { name: 'User ID', value: target.id, inline: true }
                    )
                    .setFooter({ text: `${BOT_NAME} • Application` })
                    .setTimestamp();
                embeds.push(appEmbed);

                const historyEmbed = new EmbedBuilder()
                    .setColor(0xF1C40F)
                    .setTitle('📜 Test History')
                    .setDescription(historyText || 'No previous tests.')
                    .setFooter({ text: `${BOT_NAME} • History` })
                    .setTimestamp();
                embeds.push(historyEmbed);

                if (kitImg) {
                    const kitEmbed = new EmbedBuilder()
                        .setColor(0x2C2F33)
                        .setTitle(`🪓 Kit Reference`)
                        .setImage(kitImg)
                        .setFooter({ text: `${BOT_NAME} • Kit` })
                        .setTimestamp();
                    embeds.push(kitEmbed);
                }

                embeds.push(serverEmbed);

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('verify_pack').setLabel('✅ Verify Pack').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
                );

                await testChannel.send({
                    content: `<@${target.id}> <@${interaction.user.id}>`,
                    embeds: embeds,
                    components: [row],
                    allowedMentions: { parse: ['users'] }
                });

                await updateQueueViewerAuto(guild, gamemode);
                await interaction.editReply({ content: `✅ Test channel created: ${testChannel}` });

            } catch (error) {
                console.error('[Claim Error]', error);
                try {
                    await interaction.editReply({ content: `❌ Failed: ${error.message || 'Unknown error'}` });
                } catch (e) {
                    await interaction.followUp({ content: `❌ Failed: ${error.message || 'Unknown error'}`, flags: 64 });
                }
            }
            return;
        }

        if (commandName === 'autotest') {
            const gamemode = options.getString('gamemode');
            const tester = db.testers[interaction.user.id];
            if (!tester) return interaction.reply({ content: '❌ You are not a registered tester.', flags: 64 });
            if (!gamemode) {
                const current = tester.autoTestGamemode || 'Disabled';
                const embed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('🔄 Auto-Test Status')
                    .setDescription(`Your auto-test is currently **${current}**.\nUse \`/autotest <gamemode>\` to set a gamemode, or \`/autotest stop\` to disable.`);
                return interaction.reply({ embeds: [embed], flags: 64 });
            }
            if (gamemode === 'stop') {
                delete tester.autoTestGamemode;
                saveData();
                return interaction.reply({ content: '✅ Auto-test disabled.', flags: 64 });
            }
            // A tester certified for one gamemode (e.g. Mace LT) must not be able to
            // auto-claim and hand out tiers in a gamemode they don't hold the role
            // for (e.g. Crystal) - this was previously unchecked.
            const requiredRole = GAMEMODES.find(g => g.name === gamemode)?.testerRole;
            if (requiredRole && !member.roles.cache.some(r => r.name === requiredRole) && !isAdmin) {
                return interaction.reply({ content: `❌ You need the **${requiredRole}** role to set auto-test for ${gamemode}.`, flags: 64 });
            }
            tester.autoTestGamemode = gamemode;
            saveData();
            await interaction.reply({ content: `✅ Auto-test set to **${gamemode}**. After each test, you will automatically claim the next player in the ${gamemode} queue.`, flags: 64 });
            return;
        }

        if (commandName === 'start') {
            const embed = new EmbedBuilder()
                .setColor(0x2ECC71)
                .setTitle('⏱️ TEST STARTED!')
                .setDescription('Use `/done` when finished.');
            await interaction.reply({ embeds: [embed] });
            return;
        }

        if (commandName === 'done') {
            let playerId = channel.topic?.match(/PlayerID: (\d+)/)?.[1];
            let gamemode = channel.topic?.match(/Gamemode:\s*(.+?)(?:\s\||$)/)?.[1];
            if (!playerId) {
                const match = channel.name.match(/test-(.+)-(.+)/);
                if (match) {
                    const username = match[1];
                    gamemode = match[2];
                    for (const [id,data] of Object.entries(db.players)) if (data.username === username) { playerId = id; break; }
                }
            }
            if (!playerId) return interaction.reply({ content: '❌ Player not found', flags: 64 });
            await showDoneModal(interaction, playerId, gamemode);
            return;
        }

        if (commandName === 'close' || commandName === 'forceclose') {
            if (commandName === 'forceclose' && !isMod) {
                return interaction.reply({ content: '❌ This command requires the **Mod** role or higher.', flags: 64 });
            }
            await interaction.reply({ content: '🔒 Closing channel...', flags: 64 });
            setTimeout(() => {
                try { channel.delete(); } catch(e) {}
            }, 3000);
            return;
        }

        if (commandName === 'tester') {
            const targetUser = options.getUser('user');
            const td = db.testers[targetUser.id];
            if (!td) return interaction.reply({ content: '❌ Not a tester', flags: 64 });
            const symbol = getGamemodeSymbol(td.gamemode);
            const tests = db.testerStats[targetUser.id]?.tests || 0;
            const embed = new EmbedBuilder().setColor(RANK_COLORS[td.tier]||0x5865F2).setAuthor({ name: targetUser.username, iconURL: targetUser.displayAvatarURL() })
                .setTitle(`${symbol} ${td.gamemode} TESTER`)
                .setDescription(`**Tier:** ${td.tier}\n**Region:** ${td.region||'Not set'}\n**Device:** ${td.device||'Not set'}\n**Tests:** ${tests}\n**Certified:** ${td.certified ? '✅ Yes' : '❌ No'}\n**Auto-Test:** ${td.autoTestGamemode || 'Disabled'}`);
            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }

        // MOD COMMANDS - handles tickets, strikes, warnings, blacklist
        if (!isMod) {
            return interaction.reply({ content: '❌ This command requires the **Mod** role or higher.', flags: 64 });
        }

        if (commandName === 'notes') {
            const target = options.getMember('player');
            const note = options.getString('note');
            if (!db.staffNotes[target.id]) db.staffNotes[target.id] = [];
            db.staffNotes[target.id].push({ author: interaction.user.id, note, date: Date.now() });
            saveData();
            await interaction.reply({ content: `✅ Note added for ${target.user.tag}`, flags: 64 });
            return;
        }

        if (commandName === 'warn') {
            const target = options.getMember('player');
            const reason = options.getString('reason');
            if (!db.players[target.id]) return interaction.reply({ content: '❌ Player not found', flags: 64 });
            if (!db.players[target.id].warnings) db.players[target.id].warnings = [];
            db.players[target.id].warnings.push({ by: interaction.user.id, reason, date: Date.now() });
            saveData();
            try { await target.send(`⚠️ Warned in ${guild.name}: ${reason}`); } catch(e) {}
            await interaction.reply({ content: `⚠️ Warned ${target.user.tag}`, flags: 64 });
            return;
        }

        if (commandName === 'strike') {
            const target = options.getMember('player');
            if (!db.players[target.id]) return interaction.reply({ content: '❌ Player not found', flags: 64 });
            db.players[target.id].strikes = (db.players[target.id].strikes||0)+1;
            if (db.players[target.id].strikes >= STRIKE_BAN_LIMIT && !db.blacklist.includes(target.id)) {
                db.blacklist.push(target.id);
                try { await target.send(`🚫 You have been automatically blacklisted from testing due to reaching ${STRIKE_BAN_LIMIT} strikes.`); } catch(e) {}
            }
            saveData();
            await interaction.reply({ content: `⚠️ Strike ${db.players[target.id].strikes}/${STRIKE_BAN_LIMIT}`, flags: 64 });
            return;
        }

        if (commandName === 'blacklist') {
            const target = options.getMember('player');
            if (!db.blacklist.includes(target.id)) db.blacklist.push(target.id);
            saveData();
            await interaction.reply({ content: `🚫 Blacklisted ${target.user.tag}`, flags: 64 });
            return;
        }

        if (commandName === 'unblacklist') {
            const target = options.getMember('player');
            db.blacklist = db.blacklist.filter(id=>id!==target.id);
            saveData();
            await interaction.reply({ content: `✅ Unblacklisted ${target.user.tag}`, flags: 64 });
            return;
        }

        if (commandName === 'audit') {
            const target = options.getMember('player');
            const notes = db.staffNotes[target.id] || [];
            let text = '';
            for (const n of notes.slice(-10)) text += `• ${new Date(n.date).toLocaleString()} - <@${n.author}>: ${n.note}\n`;
            const embed = new EmbedBuilder().setColor(0xE67E22).setTitle(`📋 Audit: ${target.user.tag}`).setDescription(text || '*No notes*');
            await interaction.reply({ embeds: [embed], flags: 64 });
            return;
        }

        if (commandName === 'check') {
            const target = options.getMember('player');
            const data = db.players[target.id];
            if (!data) return interaction.reply({ content: '❌ Not applied', flags: 64 });
            const points = calculateTotalPoints(target.id);
            await interaction.reply({ content: `**${data.username}** | Points: ${points} | Strikes: ${data.strikes||0}/${STRIKE_BAN_LIMIT} | Blacklisted: ${db.blacklist.includes(target.id)}`, flags: 64 });
            return;
        }

        // ADMIN COMMANDS - points, config, resets, server setup
        if (!isAdmin) {
            return interaction.reply({ content: '❌ This command requires the **Admin** role or server Administrator permission.', flags: 64 });
        }

        if (commandName === 'addtestserver') {
            const ip = options.getString('ip');
            const port = options.getInteger('port');
            
            if (!db.testServers) db.testServers = [];
            db.testServers.push({ ip, port });
            saveData();
            
            await interaction.reply({ 
                content: `✅ Test server added: \`${ip}:${port}\`\nTotal servers: ${db.testServers.length}`, 
                flags: 64 
            });
            return;
        }

        if (commandName === 'removetestserver') {
            const index = options.getInteger('index');
            
            if (!db.testServers || db.testServers.length === 0) {
                return interaction.reply({ content: '📭 No test servers configured.', flags: 64 });
            }
            
            if (index < 1 || index > db.testServers.length) {
                return interaction.reply({ 
                    content: `❌ Invalid index. Use \`/viewtestservers\` to see available servers (1-${db.testServers.length}).`, 
                    flags: 64 
                });
            }
            
            const removed = db.testServers[index - 1];
            db.testServers.splice(index - 1, 1);
            saveData();
            
            await interaction.reply({ 
                content: `✅ Removed server: \`${removed.ip}:${removed.port}\`\nRemaining servers: ${db.testServers.length}`, 
                flags: 64 
            });
            return;
        }

        if (commandName === 'testertest') {
            const targetUser = options.getUser('player');
            const gamemode = options.getString('gamemode');
            
            if (!targetUser) return interaction.reply({ content: '❌ Player not found.', flags: 64 });
            if (!db.players[targetUser.id]) {
                return interaction.reply({ content: `❌ ${targetUser.username} has not applied yet. They need to apply first.`, flags: 64 });
            }
            
            await interaction.deferReply({ flags: 64 });
            
            try {
                let category;
                const overrideId = CATEGORY_OVERRIDES[gamemode];
                if (overrideId) {
                    category = guild.channels.cache.get(overrideId);
                }
                if (!category) {
                    const catName = GAMEMODE_CATEGORIES[gamemode];
                    category = guild.channels.cache.find(c => c.name === catName && c.type === 4);
                    if (!category) {
                        console.log(`[TesterTest] Category "${catName}" not found, creating...`);
                        category = await guild.channels.create({
                            name: catName,
                            type: 4,
                            permissionOverwrites: [
                                { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                                { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.ManageChannels] }
                            ]
                        });
                    }
                }
                if (!category) {
                    return interaction.editReply({ content: `❌ Could not find or create category for ${gamemode}.` });
                }

                const permissionOverwrites = [
                    { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                    { id: targetUser.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                    { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                ];

                const testChannel = await guild.channels.create({
                    name: `testertest-${targetUser.username}-${gamemode}`,
                    type: 0,
                    parent: category,
                    permissionOverwrites
                });

                await testChannel.setTopic(`PlayerID: ${targetUser.id} | Gamemode: ${gamemode} | TesterTest: true | AdminID: ${interaction.user.id}`);

                const playerData = db.players[targetUser.id];
                const kitImg = db.gamemodeImages[gamemode];
                
                const allPastTests = (playerData.testHistory || []).slice(-3);
                const historyText = allPastTests.length ? allPastTests.map(t => `• ${t.gamemode} → ${t.rank} → by <@${t.tester}> on ${new Date(t.date).toLocaleDateString()}`).join('\n') : '*No past tests*';
                
                const lastTest = (playerData.testHistory || [])[playerData.testHistory?.length - 1];
                const lastNote = lastTest?.notes || 'No previous notes';

                const servers = db.testServers || [];
                const serverList = servers.map((s, i) => `${i+1}. ${s.ip}:${s.port}`).join('\n') || 'No test servers configured.';

                const serverEmbed = new EmbedBuilder()
                    .setColor(0x5865F2)
                    .setTitle('🌐 Available Test Servers')
                    .setDescription([
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                        `${serverList}`,
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                        `**🚀 Official MCBPVP Server**`,
                        `Coming soon! We're working hard to bring you`,
                        `the best Bedrock PvP experience.`,
                        ``
                    ].join('\n'))
                    .setFooter({ text: `${BOT_NAME} • Test Servers` })
                    .setTimestamp();

                const testerTestEmbed = new EmbedBuilder()
                    .setColor(0x9B59B6)
                    .setTitle(`👑 TESTER TEST - ${gamemode}`)
                    .setDescription([
                        `**Tester Candidate:** <@${targetUser.id}> (${targetUser.username})`,
                        `**Testing For:** ${gamemode} Tester`,
                        `**Conducted By:** <@${interaction.user.id}>`,
                        ``,
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                        `**📋 Player Details**`,
                        `> **IGN:** ${playerData?.username || 'Not set'}`,
                        `> **Region:** ${playerData?.region || 'Not set'}`,
                        `> **Device:** ${playerData?.device || 'Not set'}`,
                        `> **Last Note:** ${lastNote}`,
                        ``,
                        `**📜 Test History (last 3)**`,
                        historyText,
                        ``,
                        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                        `*The tester will be evaluated on: Fairness, Accuracy, Communication*`
                    ].join('\n'))
                    .setThumbnail(kitImg)
                    .setFooter({ text: `${BOT_NAME} • Tester Test` })
                    .setTimestamp();

                const row = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId('verify_pack').setLabel('✅ Verify Pack').setStyle(ButtonStyle.Success),
                    new ButtonBuilder().setCustomId('close_ticket').setLabel('🔒 Close Ticket').setStyle(ButtonStyle.Danger)
                );

                await testChannel.send({
                    content: `<@${targetUser.id}> <@${interaction.user.id}>`,
                    embeds: [testerTestEmbed, serverEmbed],
                    components: [row],
                    allowedMentions: { parse: ['users'] }
                });

                await interaction.editReply({ content: `✅ Tester test channel created: ${testChannel}` });

            } catch (error) {
                console.error('[TesterTest Error]', error);
                await interaction.editReply({ content: `❌ Failed: ${error.message || 'Unknown error'}` });
            }
            return;
        }

        if (commandName === 'settester') {
            const targetUser = options.getUser('user');
            await showTesterSetupModal(interaction, targetUser);
            return;
        }
        if (commandName === 'removetester') {
            const targetUser = options.getUser('user');
            if (!db.testers[targetUser.id]) return interaction.reply({ content: '❌ Not a tester', flags: 64 });
            const gmData = GAMEMODES.find(g => g.name === db.testers[targetUser.id].gamemode);
            if (gmData) {
                const testerRole = await getRole(guild, gmData.testerRole);
                const member = await guild.members.fetch(targetUser.id).catch(()=>null);
                if (testerRole && member) await member.roles.remove(testerRole).catch(()=>{});
            }
            delete db.testers[targetUser.id];
            saveData();
            await announceTester(guild, targetUser.id, 'remove');
            await interaction.reply({ content: `✅ Removed tester ${targetUser.username}`, flags: 64 });
            return;
        }
        if (commandName === 'removetier') {
            const targetUser = options.getUser('player');
            if (!db.players[targetUser.id]) return interaction.reply({ content: '❌ Player not found', flags: 64 });
            await showTierRemovalModal(interaction, targetUser);
            return;
        }
        if (commandName === 'addtier') {
            const targetUser = options.getUser('player');
            const gamemode = options.getString('gamemode');
            const rank = options.getString('rank');
            const player = db.players[targetUser.id];
            if (!player) return interaction.reply({ content: '❌ Player not found', flags: 64 });
            if (!player.gamemodeRanks) player.gamemodeRanks = {};
            if (!player.gamemodePoints) player.gamemodePoints = {};
            if (!player.gamemodeLastTest) player.gamemodeLastTest = {};
            player.gamemodeRanks[gamemode] = rank;
            player.gamemodePoints[gamemode] = getFixedPointsForRank(rank);
            player.gamemodeLastTest[gamemode] = Date.now();
            saveData();
            await updateTitleRole(guild, targetUser.id);
            await refreshDeployedLeaderboard(guild);
            await interaction.reply({ content: `✅ Granted <@${targetUser.id}> **${rank}** in **${gamemode}** (${getFixedPointsForRank(rank)} pts).`, flags: 64 });
            return;
        }
        if (commandName === 'testers') {
            await sendTestersEmbed(interaction, 1);
            return;
        }
        if (commandName === 'certify') {
            const targetUser = options.getUser('user');
            if (!db.testers[targetUser.id]) return interaction.reply({ content: '❌ Not a tester', flags: 64 });
            db.testers[targetUser.id].certified = true;
            saveData();
            await interaction.reply({ content: `✅ Certified ${targetUser.username} as a tester.`, flags: 64 });
            return;
        }
        if (commandName === 'revoke') {
            const targetUser = options.getUser('user');
            if (!db.testers[targetUser.id]) return interaction.reply({ content: '❌ Not a tester', flags: 64 });
            db.testers[targetUser.id].certified = false;
            saveData();
            await interaction.reply({ content: `❌ Revoked tester certification for ${targetUser.username}.`, flags: 64 });
            return;
        }
        if (commandName === 'forceapply') {
            const target = options.getMember('player');
            if (db.players[target.id]) return interaction.reply({ content: `❌ ${target.user.tag} already applied`, flags: 64 });
            await showForceApplyModal(interaction, target.user);
            return;
        }
        if (commandName === 'deapply') {
            const target = options.getMember('player');
            if (!db.players[target.id]) return interaction.reply({ content: '❌ Not applied', flags: 64 });
            const role = await getRole(guild, APPLICANT_ROLE);
            if (role && target.roles.cache.has(role.id)) await target.roles.remove(role);
            for (const r of RANK_ORDER) { const rr = await getRole(guild, r); if (rr && target.roles.cache.has(rr.id)) await target.roles.remove(rr); }
            for (const t of TITLES) { const rr = await getRole(guild, t.role); if (rr && target.roles.cache.has(rr.id)) await target.roles.remove(rr); }
            await interaction.reply({ content: `✅ Deapplied ${target.user.tag} (data kept)`, flags: 64 });
            return;
        }
        if (commandName === 'forceunverify') {
            const target = options.getMember('player');
            if (!db.players[target.id]) return interaction.reply({ content: '❌ Not applied', flags: 64 });
            const role = await getRole(guild, APPLICANT_ROLE);
            if (role && target.roles.cache.has(role.id)) await target.roles.remove(role);
            for (const r of RANK_ORDER) { const rr = await getRole(guild, r); if (rr && target.roles.cache.has(rr.id)) await target.roles.remove(rr); }
            for (const t of TITLES) { const rr = await getRole(guild, t.role); if (rr && target.roles.cache.has(rr.id)) await target.roles.remove(rr); }
            delete db.players[target.id];
            saveData();
            await refreshDeployedLeaderboard(guild);
            await interaction.reply({ content: `✅ Force unverified ${target.user.tag} (data wiped)`, flags: 64 });
            return;
        }
        if (commandName === 'forcerank') {
            const target = options.getMember('player');
            const rank = options.getString('rank');
            if (!db.players[target.id]) return interaction.reply({ content: '❌ Player not found', flags: 64 });
            await setRank(guild, target.id, rank);
            await refreshDeployedLeaderboard(guild);
            await interaction.reply({ content: `✅ ${target.user.tag} → ${rank}`, flags: 64 });
            return;
        }
        if (commandName === 'setpoints') {
            const target = options.getMember('player');
            const points = options.getInteger('points');
            if (!db.players[target.id]) return interaction.reply({ content: '❌ Player not found', flags: 64 });
            db.players[target.id].manualPoints = points;
            await updateTitleRole(guild, target.id);
            saveData();
            await interaction.reply({ content: `✅ ${target.user.tag} → ${points} pts`, flags: 64 });
            return;
        }
        if (commandName === 'reset') {
            const target = options.getMember('player');
            if (!db.players[target.id]) return interaction.reply({ content: '❌ Player not found', flags: 64 });
            delete db.players[target.id];
            const role = await getRole(guild, APPLICANT_ROLE);
            if (role && target.roles.cache.has(role.id)) await target.roles.remove(role);
            for (const r of RANK_ORDER) { const rr = await getRole(guild, r); if (rr && target.roles.cache.has(rr.id)) await target.roles.remove(rr); }
            for (const t of TITLES) { const rr = await getRole(guild, t.role); if (rr && target.roles.cache.has(rr.id)) await target.roles.remove(rr); }
            saveData();
            await refreshDeployedLeaderboard(guild);
            await interaction.reply({ content: `✅ Reset ${target.user.tag} (data wiped)`, flags: 64 });
            return;
        }
        if (commandName === 'resetall') {
            await resetAll(guild);
            await refreshDeployedLeaderboard(guild);
            await interaction.reply({ content: '✅ **Global reset complete.** All player data, queues, and statistics have been wiped.\nKit images and tester profiles remain intact.', flags: 64 });
            return;
        }
        if (commandName === 'recalculate') {
            const target = options.getMember('player');
            const points = calculateTotalPoints(target.id);
            await updateTitleRole(guild, target.id);
            await refreshDeployedLeaderboard(guild);
            await interaction.reply({ content: `✅ ${target.user.tag}: ${points} pts`, flags: 64 });
            return;
        }
        if (commandName === 'kitimg') {
            const action = options.getString('action');
            const gm = options.getString('gamemode');
            const img = options.getString('image');
            if (action === 'add') {
                if (!gm || !img) return interaction.reply({ content: '❌ /kitimg add [gamemode] [url]', flags: 64 });
                db.gamemodeImages[gm] = img;
                saveData();
                await interaction.reply({ content: `✅ ${gm} kit image added`, flags: 64 });
            } else if (action === 'remove') {
                if (!gm) return interaction.reply({ content: '❌ /kitimg remove [gamemode]', flags: 64 });
                delete db.gamemodeImages[gm];
                saveData();
                await interaction.reply({ content: `✅ ${gm} kit image removed`, flags: 64 });
            } else {
                const list = Object.keys(db.gamemodeImages).join(', ') || 'None';
                await interaction.reply({ content: `📦 Kit images: ${list}`, flags: 64 });
            }
            return;
        }
        if (commandName === 'deployqueueviewer') {
            await interaction.deferReply({ flags: 64 });
            const channel = guild.channels.cache.find(c => c.name === QUEUE_CHANNEL);
            if (!channel) return interaction.editReply({ content: `❌ ${QUEUE_CHANNEL} not found` });
            await deployQueueViewer(channel, 'Sword');
            await interaction.editReply({ content: `✅ Queue viewer deployed to ${QUEUE_CHANNEL}` });
            return;
        }
        if (commandName === 'deployleaderboard') {
            await deployLeaderboard(interaction);
            return;
        }
        if (commandName === 'refreshleaderboard') {
            const channel = guild.channels.cache.find(c => c.name === LEADERBOARD_CHANNEL);
            if (channel && activeLeaderboardMessage) {
                await sendLeaderboardToChannel(channel, currentLeaderboardGamemode || 'overall', 1, currentTierFilter);
            }
            await interaction.reply({ content: '✅ Leaderboard refreshed', flags: 64 });
            return;
        }
        if (commandName === 'sendpanel') {
            await interaction.deferReply({ flags: 64 });
            const type = options.getString('type');
            if (type === 'apply') {
                const ch = guild.channels.cache.find(c => c.name === DASHBOARD_CHANNEL);
                if (!ch) return interaction.editReply({ content: `❌ ${DASHBOARD_CHANNEL} not found` });
                await sendApplyPanel(ch);
                await interaction.editReply({ content: `✅ Apply panel sent to ${DASHBOARD_CHANNEL}` });
            } else if (type === 'tester') {
                const ch = guild.channels.cache.find(c => c.name === TESTER_PANEL_CHANNEL);
                if (!ch) return interaction.editReply({ content: `❌ ${TESTER_PANEL_CHANNEL} not found` });
                await sendTesterPanel(ch);
                await interaction.editReply({ content: `✅ Tester panel sent to ${TESTER_PANEL_CHANNEL}` });
            } else if (type === 'request') {
                const ch = guild.channels.cache.find(c => c.name === REQUEST_CHANNEL);
                if (!ch) return interaction.editReply({ content: `❌ ${REQUEST_CHANNEL} not found` });
                await sendRequestPanel(ch);
                await interaction.editReply({ content: `✅ Request panel sent to ${REQUEST_CHANNEL}` });
            }
            return;
        }
        if (commandName === 'setcooldown') {
            const days = options.getInteger('days');
            db.settings.universalCooldown = days;
            saveData();
            await interaction.reply({ content: `✅ Universal cooldown set to ${days} day(s). ${days === 0 ? 'Disabled.' : ''}`, flags: 64 });
            return;
        }
        if (commandName === 'maxqueue') {
            const gm = options.getString('gamemode');
            const size = options.getInteger('size');
            if (!db.settings.maxQueueSizePerGamemode) db.settings.maxQueueSizePerGamemode = {};
            db.settings.maxQueueSizePerGamemode[gm] = size;
            saveData();
            await interaction.reply({ content: `✅ Max queue for ${gm} set to ${size}`, flags: 64 });
            return;
        }
        if (commandName === 'announce') {
            const msg = options.getString('message');
            const testerRole = await getRole(guild, 'Tester');
            const ch = guild.channels.cache.find(c => c.name === TESTER_PANEL_CHANNEL);
            if (testerRole && ch) await ch.send({ content: testerRole.toString(), embeds: [new EmbedBuilder().setColor(0xF1C40F).setTitle('📢 ANNOUNCEMENT').setDescription(msg).setTimestamp()] });
            await interaction.reply({ content: '✅ Announcement sent', flags: 64 });
            return;
        }
        if (commandName === 'export') {
            let csv = 'User ID,Username,Region,Device,Points,Rank,Strikes,Blacklisted\n';
            for (const [id, data] of Object.entries(db.players)) {
                csv += `${id},${data.username},${data.region},${data.device},${calculateTotalPoints(id)},${data.rank||'None'},${data.strikes||0},${db.blacklist.includes(id)}\n`;
            }
            fs.writeFileSync('export.csv', csv);
            await interaction.reply({ content: '✅ Exported', files: [{ attachment: 'export.csv', name: 'players.csv' }], flags: 64 });
            fs.unlinkSync('export.csv');
            return;
        }
        if (commandName === 'backup') {
            fs.writeFileSync(`backup_${Date.now()}.json`, JSON.stringify(db, null, 2));
            await interaction.reply({ content: '✅ Backup created', flags: 64 });
            return;
        }
        if (commandName === 'setup') {
            await autoSetupRoles(guild);
            await interaction.reply({ content: '✅ Role setup complete! Missing roles have been created.', flags: 64 });
            return;
        }
        if (commandName === 'websitesync' && isOwner) {
            const modal = new ModalBuilder().setCustomId('website_sync_modal').setTitle('Website Sync Setup');
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('api_url').setLabel('API URL').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('https://yourwebsite.com/api/sync')),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('api_key').setLabel('API Key').setStyle(TextInputStyle.Short).setRequired(true).setPlaceholder('your-secret-api-key'))
            );
            await interaction.showModal(modal);
            return;
        }
        if (commandName === 'testsync' && isOwner) {
            if (!db.websiteSync?.enabled) return interaction.reply({ content: '❌ Website sync not configured', flags: 64 });
            const testData = { action: 'test', message: 'Test connection from Discord bot', timestamp: new Date().toISOString() };
            const result = await syncToWebsite(testData);
            if (result.success) await interaction.reply({ content: '✅ Website sync is working!', flags: 64 });
            else await interaction.reply({ content: '❌ Website sync failed. Check URL and key.', flags: 64 });
            return;
        }
        if (commandName === 'setperm') {
            const cmd = options.getString('command');
            const role = options.getRole('role');
            if (!role) {
                delete db.commandPermissions[cmd];
                saveData();
                await interaction.reply({ content: `✅ Removed permission restriction for \`/${cmd}\`. Anyone can use it now.`, flags: 64 });
                return;
            }
            if (!db.commandPermissions[cmd]) db.commandPermissions[cmd] = [];
            if (!db.commandPermissions[cmd].includes(role.id)) {
                db.commandPermissions[cmd].push(role.id);
                saveData();
                await interaction.reply({ content: `✅ \`/${cmd}\` now requires the ${role.name} role.`, flags: 64 });
            } else {
                await interaction.reply({ content: `⚠️ ${role.name} already has permission for \`/${cmd}\`.`, flags: 64 });
            }
            return;
        }
        if (commandName === 'test') {
            const type = options.getString('type');
            const targetUser = options.getUser('user') || interaction.user;
            await interaction.deferReply({ flags: 64 });

            let category = guild.channels.cache.find(c => c.name === '📁 SWORD TESTS');
            if (!category) category = guild.channels.cache.find(c => c.type === 4);
            let testChannel;
            try {
                testChannel = await guild.channels.create({
                    name: `🧪-test-${Date.now()}`,
                    type: 0,
                    parent: category?.id,
                    permissionOverwrites: [
                        { id: guild.id, deny: [PermissionsBitField.Flags.ViewChannel] },
                        { id: interaction.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] },
                        { id: client.user.id, allow: [PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages] }
                    ]
                });
            } catch (e) {
                return interaction.editReply({ content: `❌ Failed to create test channel: ${e.message}` });
            }

            try {
                await testChannel.send({ content: `🧪 **Test Suite** – ${type.toUpperCase()}` });
                switch (type) {
                    case 'apply':
                        await sendApplyPanel(testChannel);
                        break;
                    case 'request':
                        await sendRequestPanel(testChannel);
                        break;
                    case 'tester':
                        await sendTesterPanel(testChannel);
                        break;
                    case 'profile':
                        await sendProfileToChannel(testChannel, targetUser);
                        break;
                    case 'leaderboard': {
                        const { embed } = await formatLeaderboardEmbed(guild, 'overall', 1);
                        await testChannel.send({ embeds: [embed] });
                        break;
                    }
                    case 'queue': {
                        const embed = await buildQueueEmbed(guild, 'Sword');
                        const components = buildQueueComponents('Sword');
                        await testChannel.send({ embeds: [embed], components });
                        break;
                    }
                    case 'result': {
                        const dummyEmbed = new EmbedBuilder()
                            .setColor(0x2ECC71)
                            .setAuthor({ name: '⬆️ TIER UPGRADE', iconURL: 'https://cdn.discordapp.com/attachments/1491042296215506964/1506560043921834034/Picsart_26-05-20_12-54-04-858.png' })
                            .setTitle('Noxeel')
                            .setThumbnail('https://mc-heads.net/avatar/NoxeelMain/64.png')
                            .addFields(
                                { name: '🎮 Gamemode', value: 'Sword', inline: true },
                                { name: '🏅 Result', value: '`HT5`', inline: true },
                                { name: '📊 Previous', value: '`LT5`', inline: true },
                                { name: '📈 Points', value: '+13 (15 total)', inline: true },
                                { name: '🥊 Match Score', value: '10 - 2', inline: true },
                                { name: '👤 Tester', value: `<@${interaction.user.id}>`, inline: true },
                                { name: '📝 Notes', value: 'Sample preview - no notes', inline: false }
                            )
                            .setFooter({ text: `${BOT_NAME} • Test Result` })
                            .setTimestamp();
                        await testChannel.send({ embeds: [dummyEmbed] });
                        break;
                    }
                    case 'categories': {
                        let msg = '**📁 Category Status**\n';
                        for (const [gm, catName] of Object.entries(GAMEMODE_CATEGORIES)) {
                            const exists = guild.channels.cache.some(c => c.name === catName);
                            msg += `${exists ? '✅' : '❌'} ${catName} (for ${gm})\n`;
                        }
                        await testChannel.send({ content: msg });
                        break;
                    }
                    default:
                        await testChannel.send({ content: '❌ Unknown test type.' });
                }
                await interaction.editReply({ content: `✅ Test sent to ${testChannel}. It will auto-delete in 15 seconds.` });
                setTimeout(async () => {
                    try { await testChannel.delete(); } catch (e) {}
                }, 15000);
            } catch (error) {
                console.error('[Test Error]', error);
                await interaction.editReply({ content: `❌ Test failed: ${error.message}` });
                try { await testChannel.delete(); } catch (e) {}
            }
            return;
        }
        if (commandName === 'help') {
            await showHelp(interaction);
            return;
        }

    } catch (error) {
        console.error('[Global Interaction Error]', error);
        if (!interaction.replied && !interaction.deferred) {
            await interaction.reply({ content: '❌ Something went wrong. Please try again.', flags: 64 });
        } else {
            await interaction.editReply({ content: '❌ Something went wrong. Please try again.' }).catch(()=>{});
        }
    }
});

process.on('unhandledRejection', console.error);
process.on('uncaughtException', console.error);

client.login(TOKEN);