// ==================== IMAGE CARDS ====================
// Cards drawn as images (same style as the bracket) instead of embeds, so
// they look the same on phone and PC. Cards are 960px wide with large text
// so they stay readable when Discord shrinks them on a phone.
// Every render function returns null when @napi-rs/canvas is missing or
// drawing fails; callers then fall back to the old embeds.

const path = require('path');

let C = null;
function canvasLib() {
    if (C === false) return null;
    if (!C) {
        try { C = require('@napi-rs/canvas'); } catch { C = false; return null; }
        try {
            C.GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'NotoSans-Regular.ttf'), 'MCB Sans');
            C.GlobalFonts.registerFromPath(path.join(__dirname, 'fonts', 'NotoSans-Bold.ttf'), 'MCB Sans Bold');
        } catch (e) { console.error('[Cards] Could not load bundled fonts:', e.message); }
    }
    return C;
}

// ---------- palette (shared with the bracket) ----------
const COL = {
    bg1: '#0e1016', bg2: '#171b26', panel: '#1d212d', panelHi: '#232838', line: '#2e3342',
    text: '#ffffff', soft: '#dfe1e7', muted: '#9aa0ae', dim: '#737888', faint: '#5c6170',
    gold: '#f0b232', goldBg: '#2e2710', green: '#2ecc71', greenDk: '#1f7a45', red: '#ed4245',
    orange: '#e67e22', blue: '#5865f2', sky: '#3498db'
};
// Main accent colour (progress bars, winner boxes, "SIGN-UPS OPEN"…).
// Set CARD_COLOR in .env to a name below or a hex like #ff3355.
const COLORS = { red: '#e5484d', crimson: '#c9184a', purple: '#8e6cff', blue: '#3b8cff', cyan: '#1fb6cf', orange: '#ff7a1a', pink: '#e8488c', green: '#2ecc71' };
function setColor(c) {
    const v = String(c || '').trim().toLowerCase();
    COL.accent = COLORS[v] || (/^#[0-9a-f]{6}$/.test(v) ? v : COLORS.red);
    // Darker shade for filled cells (e.g. the winning score in the bracket).
    const n = parseInt(COL.accent.slice(1), 16);
    COL.accentDark = '#' + [16, 8, 0].map(sh => Math.round(((n >> sh) & 255) * 0.55).toString(16).padStart(2, '0')).join('');
    return COL.accent;
}
// Tier chip colours: tier 1 gold → tier 5 grey.
const TIER_COL = { 1: '#f0b232', 2: '#e67e22', 3: '#b07cd8', 4: '#3498db', 5: '#95a0ab' };
const W = 960, P = 40;
setColor(process.env.CARD_COLOR);

const font = (size, bold) => `${size}px "${bold ? 'MCB Sans Bold' : 'MCB Sans'}", "DejaVu Sans", sans-serif`;

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
// Panels (COL.panel / COL.panelHi) get a soft gradient, shadow and a
// hairline edge; everything else is a flat fill.
function box(ctx, x, y, w, h, r, color, stroke, lw = 2) {
    const isPanel = color === COL.panel || color === COL.panelHi;
    if (isPanel) {
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = 22; ctx.shadowOffsetY = 6;
        roundRect(ctx, x, y, w, h, r);
        const g = ctx.createLinearGradient(0, y, 0, y + h);
        g.addColorStop(0, color === COL.panelHi ? '#272c3d' : '#222634');
        g.addColorStop(1, color === COL.panelHi ? '#1f2332' : '#1a1d28');
        ctx.fillStyle = g; ctx.fill();
        ctx.restore();
        roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r);
        ctx.lineWidth = 1.5; ctx.strokeStyle = stroke && stroke !== COL.line ? stroke : 'rgba(255,255,255,0.07)'; ctx.stroke();
        // top highlight
        ctx.save(); roundRect(ctx, x, y, w, h, r); ctx.clip();
        const hl = ctx.createLinearGradient(0, y, 0, y + 30); hl.addColorStop(0, 'rgba(255,255,255,0.05)'); hl.addColorStop(1, 'rgba(255,255,255,0)');
        ctx.fillStyle = hl; ctx.fillRect(x, y, w, 30); ctx.restore();
        return;
    }
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = color; ctx.fill();
    if (stroke) { ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}
// Soft coloured light, used behind headers and skins.
function glow(ctx, x, y, radius, color, alpha = 0.25) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, radius);
    const a = Math.round(alpha * 255).toString(16).padStart(2, '0');
    g.addColorStop(0, color + a); g.addColorStop(1, color + '00');
    ctx.fillStyle = g; ctx.fillRect(x - radius, y - radius, radius * 2, radius * 2);
}
// The bundled font has no emoji or CJK glyphs; drop them so they don't
// show up as empty boxes.
function clean(s) {
    return String(s ?? '').replace(/・/g, '·').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{1F1E6}-\u{1F1FF}\uFE0F\u200D]/gu, '').replace(/\s{2,}/g, ' ').trim();
}
function fitText(ctx, text, maxW) {
    text = clean(text);
    if (!maxW || ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
}
function txt(ctx, s, x, y, size, color, bold, maxW, align = 'left') {
    ctx.font = font(size, bold); ctx.fillStyle = color; ctx.textAlign = align;
    ctx.fillText(fitText(ctx, s, maxW), x, y);
    ctx.textAlign = 'left';
}
function width(ctx, s, size, bold) { ctx.font = font(size, bold); return ctx.measureText(String(s)).width; }
// Wraps text into at most maxLines lines.
function wrap(ctx, text, maxW, size, bold, maxLines) {
    ctx.font = font(size, bold);
    const words = String(text || '').split(/\s+/).filter(Boolean);
    const lines = [];
    let cur = '';
    for (const w of words) {
        const t = cur ? `${cur} ${w}` : w;
        if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
        if (lines.length === maxLines) break;
    }
    if (lines.length < maxLines && cur) lines.push(cur);
    if (lines.length === maxLines && words.join(' ').length > lines.join(' ').length) lines[maxLines - 1] = fitText(ctx, lines[maxLines - 1] + '…', maxW);
    return lines;
}
function background(ctx, H, accent = COL.gold) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#12141c'); g.addColorStop(1, '#0c0d12');
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    glow(ctx, W * 0.85, 0, 520, accent, 0.22);
    glow(ctx, 0, H, 420, accent, 0.08);
    // faint diagonal texture
    ctx.save(); ctx.globalAlpha = 0.025; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1;
    for (let i = -H; i < W; i += 22) { ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i + H, H); ctx.stroke(); }
    ctx.restore();
    const bar = ctx.createLinearGradient(0, 0, W, 0);
    bar.addColorStop(0, accent); bar.addColorStop(1, accent + '33');
    ctx.fillStyle = bar; ctx.fillRect(0, 0, W, 7);
}
// Big faded icon in the top-right corner.
async function watermark(ctx, symbol, size = 260) {
    const img = await loadImg(emojiUrl(symbol));
    if (!img) return;
    ctx.save(); ctx.globalAlpha = 0.07; ctx.drawImage(img, W - size + 30, -20, size, size); ctx.restore();
}
function chip(ctx, x, y, label, color, size = 20, h = 40) {
    const w = width(ctx, label, size, true) + 28;
    const g = ctx.createLinearGradient(0, y, 0, y + h);
    g.addColorStop(0, color + '40'); g.addColorStop(1, color + '1c');
    roundRect(ctx, x, y, w, h, h / 2 - 4); ctx.fillStyle = g; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = color + 'aa'; ctx.stroke();
    txt(ctx, label, x + 14, y + h / 2 + size * 0.36, size, color, true);
    return w;
}
function progress(ctx, x, y, w, h, frac, color = COL.accent) {
    box(ctx, x, y, w, h, h / 2, '#2a2f3d');
    const fw = Math.max(0, Math.min(1, frac)) * w;
    if (fw > 0) {
        ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 14;
        const g = ctx.createLinearGradient(x, 0, x + fw, 0); g.addColorStop(0, color + 'aa'); g.addColorStop(1, color);
        roundRect(ctx, x, y, Math.max(fw, h), h, h / 2); ctx.fillStyle = g; ctx.fill(); ctx.restore();
    }
}
function label(ctx, s, x, y, color = COL.dim) { txt(ctx, String(s).toUpperCase(), x, y, 17, color, true); }

const imgCache = new Map();
async function loadImg(url) {
    if (!url || !canvasLib()) return null;
    if (imgCache.has(url)) return imgCache.get(url);
    const img = await Promise.race([C.loadImage(url), new Promise(r => setTimeout(() => r(null), 5000))]).catch(() => null);
    if (img) { imgCache.set(url, img); if (imgCache.size > 500) imgCache.delete(imgCache.keys().next().value); }
    return img;
}
// "<:sword_custom:123>" → emoji image URL
function emojiUrl(symbol) {
    const m = String(symbol || '').match(/<a?:\w+:(\d+)>/);
    return m ? `https://cdn.discordapp.com/emojis/${m[1]}.png?size=96` : null;
}
function tierNum(rank) { const m = String(rank || '').match(/(\d)$/); return m ? Number(m[1]) : null; }
const tierColor = rank => TIER_COL[tierNum(rank)] || COL.muted;
// Skin head, or a letter tile when there is none. For mc-heads avatar URLs
// the full skin is downloaded and the face drawn from both layers, because
// the avatar image leaves out the outer layer (hats, masks, hair).
async function head(ctx, url, x, y, size, name, alpha = 1) {
    const key = String(url || '').match(/mc-heads\.net\/avatar\/([^/?]+)/)?.[1];
    const skin = key ? await loadImg(`https://mc-heads.net/skin/${key}`) : null;
    const img = skin ? null : await loadImg(url);
    const r = Math.max(4, Math.round(size / 7));
    ctx.globalAlpha = alpha;
    if (skin || img) {
        ctx.save(); roundRect(ctx, x, y, size, size, r); ctx.clip();
        ctx.imageSmoothingEnabled = false;
        if (skin) {
            ctx.drawImage(skin, 8, 8, 8, 8, x, y, size, size);              // face
            if (skin.height >= 32) ctx.drawImage(skin, 40, 8, 8, 8, x, y, size, size); // outer layer
        } else ctx.drawImage(img, x, y, size, size);
        ctx.imageSmoothingEnabled = true;
        ctx.restore();
        roundRect(ctx, x, y, size, size, r); ctx.lineWidth = 2; ctx.strokeStyle = 'rgba(255,255,255,0.14)'; ctx.stroke();
        ctx.globalAlpha = 1;
        return;
    }
    {
        box(ctx, x, y, size, size, r, COL.panelHi, COL.line);
        txt(ctx, (String(name || '?').trim()[0] || '?').toUpperCase(), x + size / 2, y + size * 0.68, Math.round(size * 0.48), COL.muted, true, size, 'center');
    }
    ctx.globalAlpha = 1;
}
async function avatarCircle(ctx, url, cx, cy, r) {
    const img = await loadImg(url);
    if (!img) return false;
    ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.clip();
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2); ctx.restore();
    return true;
}
function footer(ctx, H, text) {
    const g = ctx.createLinearGradient(P, 0, W - P, 0);
    g.addColorStop(0, 'rgba(255,255,255,0.10)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(P, H - 64, W - P * 2, 2);
    txt(ctx, 'MCBPVP CLUB', W - P, H - 26, 16, COL.faint, true, 200, 'right');
    txt(ctx, text, P, H - 26, 18, COL.dim, false, W - P * 2 - 180);
}
function done(canvas, name) {
    const { AttachmentBuilder } = require('discord.js');
    return new AttachmentBuilder(canvas.toBuffer('image/png'), { name });
}
async function render(name, H, fn) {
    if (!canvasLib()) return null;
    try {
        const canvas = C.createCanvas(W, H);
        const ctx = canvas.getContext('2d');
        await fn(ctx);
        return done(canvas, name);
    } catch (e) {
        console.error(`[Cards] ${name} failed:`, e.message);
        return null;
    }
}

// =====================================================================
// Tournament sign-up card
// d: { status, statusColor, name, gamemode, emoji, host, server, prize, title,
//      tiles: [[label, value, sub]], players: [{name, head}], size, waitlist, unit,
//      world: [[label, 'HH:MM', 'Day']], footer }
// =====================================================================
async function tournamentCard(d) {
    const heads = d.players.length;
    const hs = 52, bw = W - P * 2 - 276;
    const perRow = Math.floor((bw + 10) / (hs + 10)), rows = Math.min(3, Math.max(1, Math.ceil(heads / perRow)));
    const ph = 150 + (rows - 1) * 64;
    const H = 636 + ph + 44 + 40 + 2 * 74 + 90;
    return render('tournament.png', H, async ctx => {
        background(ctx, H, d.statusColor || COL.gold);
        await watermark(ctx, d.emoji, 300);
        let y = 64;
        const emo = await loadImg(emojiUrl(d.emoji));
        let hx = P;
        if (emo) { ctx.drawImage(emo, P, y - 34, 44, 44); hx += 56; }
        txt(ctx, `${d.gamemode.toUpperCase()} TOURNAMENT`, hx, y, 22, COL.gold, true);
        chip(ctx, hx + width(ctx, `${d.gamemode.toUpperCase()} TOURNAMENT`, 22, true) + 18, y - 32, d.status, d.statusColor || COL.accent, 18, 40);
        txt(ctx, d.name, P, y + 76, 58, COL.text, true, W - P * 2);
        if (d.champion) txt(ctx, `Champion: ${d.champion}`, P, y + 118, 26, COL.gold, true, W - P * 2);
        else txt(ctx, [d.host && `Hosted by ${d.host}`, d.server].filter(Boolean).join('  ·  '), P, y + 118, 23, COL.muted, false, W - P * 2);

        // prize
        y = 222;
        {
            const g = ctx.createLinearGradient(P, 0, W - P, 0);
            g.addColorStop(0, '#3a2c08'); g.addColorStop(1, '#1d1a12');
            ctx.save(); ctx.shadowColor = 'rgba(240,178,50,0.25)'; ctx.shadowBlur = 30;
            roundRect(ctx, P, y, W - P * 2, 116, 16); ctx.fillStyle = g; ctx.fill(); ctx.restore();
            roundRect(ctx, P, y, W - P * 2, 116, 16); ctx.lineWidth = 2; ctx.strokeStyle = COL.gold + 'cc'; ctx.stroke();
            glow(ctx, P + 120, y + 60, 200, COL.gold, 0.12);
        }
        label(ctx, 'Prize', P + 28, y + 38, COL.gold);
        if (d.prize) {
            txt(ctx, d.prize, P + 28, y + 92, 48, COL.text, true, 360);
            const pw = Math.min(360, width(ctx, d.prize, 48, true));
            txt(ctx, `+ ${d.title} title`, P + 48 + pw, y + 88, 26, '#ecdcaa', true, W - P * 2 - pw - 80);
        } else txt(ctx, `${d.title} title`, P + 28, y + 88, 34, COL.text, true, W - P * 2 - 56);

        // info tiles 2×2
        y = 362;
        const tw = (W - P * 2 - 20) / 2, th = 118;
        d.tiles.slice(0, 4).forEach(([k, v, sub], i) => {
            const x = P + (i % 2) * (tw + 20), ty = y + Math.floor(i / 2) * (th + 18);
            box(ctx, x, ty, tw, th, 14, COL.panel, COL.line);
            label(ctx, k, x + 24, ty + 36);
            txt(ctx, v, x + 24, ty + 76, 30, COL.soft, true, tw - 48);
            if (sub) txt(ctx, sub, x + 24, ty + 104, 20, COL.muted, false, tw - 48);
        });

        // players
        y = 636;
        box(ctx, P, y, W - P * 2, ph, 16, COL.panel, COL.line);
        label(ctx, d.unit || 'players', P + 26, y + 40);
        const cnt = `${d.players.length}`;
        txt(ctx, cnt, P + 26, y + 104, 60, COL.text, true);
        txt(ctx, `/ ${d.size}`, P + 36 + width(ctx, cnt, 60, true), y + 104, 30, COL.muted, true);
        const full = d.players.length >= d.size;
        txt(ctx, d.waitlist ? `+${d.waitlist} waitlist` : full ? 'Full' : `${d.size - d.players.length} spots left`, P + 26, y + 138, 20, full || d.waitlist ? COL.gold : COL.accent, true);
        const bx = P + 250;
        progress(ctx, bx, y + 30, bw, 16, d.players.length / Math.max(1, d.size), full ? COL.gold : COL.accent);
        if (!heads) txt(ctx, 'Be the first to join!', bx, y + 100, 24, COL.faint, false);
        const gap = (bw - perRow * hs) / (perRow - 1);
        for (let i = 0; i < Math.min(heads, perRow * rows); i++) {
            const p = d.players[i];
            await head(ctx, p.head, bx + (i % perRow) * (hs + gap), y + 66 + Math.floor(i / perRow) * 64, hs, p.name);
        }
        if (heads > perRow * rows) txt(ctx, `+${heads - perRow * rows} more`, bx + bw, y + ph - 14, 18, COL.muted, true, 200, 'right');

        // world clock 4×2
        y = 636 + ph + 44;
        label(ctx, 'Start time around the world', P, y);
        const cw = (W - P * 2) / 4;
        d.world.slice(0, 8).forEach(([place, time, day], k) => {
            const x = P + (k % 4) * cw, wy = y + 40 + Math.floor(k / 4) * 74;
            const night = /^0[0-6]:/.test(time);
            txt(ctx, place, x, wy, 20, COL.muted, false, cw - 12);
            txt(ctx, time, x, wy + 36, 30, night ? COL.faint : COL.text, true);
            txt(ctx, day, x + width(ctx, time, 30, true) + 10, wy + 36, 20, night ? COL.faint : COL.muted, false);
        });
        footer(ctx, H, d.footer);
    });
}

// =====================================================================
// Profile card
// d: { name, title, titleNext, points, nextPoints, prevPoints, position, region, device,
//      badges: [string], body, avatar, modes: [{name, emoji, rank}], stats: [[label, value]], accent }
// =====================================================================
async function profileCard(d) {
    const H = 548 + Math.ceil(d.modes.length / 3) * 92 + 170;
    return render('profile.png', H, async ctx => {
        const champion = d.badges?.length;
        const accent = champion ? COL.gold : (d.accent || COL.blue);
        background(ctx, H, accent);

        // skin panel
        const sw = 300, sh = 470;
        box(ctx, P, 40, sw, sh, 18, COL.panel, champion ? COL.gold : COL.line, 2.5);
        ctx.save(); roundRect(ctx, P, 40, sw, sh, 18); ctx.clip();
        glow(ctx, P + sw / 2, 250, 230, accent, 0.35);
        ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.beginPath(); ctx.ellipse(P + sw / 2, 474, 90, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        const body = await loadImg(d.body);
        if (body) {
            const h = 400, w = (body.width / body.height) * h;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(body, P + sw / 2 - w / 2, 70, w, h);
            ctx.imageSmoothingEnabled = true;
        } else {
            const ok = await avatarCircle(ctx, d.avatar, P + sw / 2, 210, 110);
            if (!ok) box(ctx, P + sw / 2 - 110, 100, 220, 220, 110, COL.panelHi);
            txt(ctx, 'No skin found yet', P + sw / 2, 380, 20, COL.faint, false, sw - 30, 'center');
            txt(ctx, 'try /refreshskin', P + sw / 2, 410, 19, COL.faint, false, sw - 30, 'center');
        }

        // header
        const x0 = P + sw + 30, rw = W - x0 - P;
        label(ctx, d.title, x0, 74, COL.gold);
        txt(ctx, d.name, x0, 136, 52, COL.text, true, rw);
        txt(ctx, [d.region, d.device].filter(Boolean).join('  ·  '), x0, 176, 22, COL.muted, false, rw);
        let by = 200;
        for (const b of (d.badges || []).slice(0, 2)) { chip(ctx, x0, by, b.toUpperCase(), COL.gold, 18, 40); by += 50; }

        // position + points
        const py = 310;
        box(ctx, x0, py, rw, 200, 16, COL.panelHi, COL.line);
        label(ctx, 'Position', x0 + 26, py + 42);
        txt(ctx, `#${d.position}`, x0 + 26, py + 104, 56, COL.text, true);
        label(ctx, 'Points', x0 + rw / 2, py + 42);
        txt(ctx, `${d.points}`, x0 + rw / 2, py + 104, 56, COL.text, true);
        if (d.titleNext) {
            txt(ctx, `${d.nextPoints - d.points} pts to ${d.titleNext}`, x0 + 26, py + 146, 20, COL.muted, true, rw - 52);
            progress(ctx, x0 + 26, py + 162, rw - 52, 16, (d.points - d.prevPoints) / Math.max(1, d.nextPoints - d.prevPoints), accent);
        } else {
            txt(ctx, 'Highest title reached', x0 + 26, py + 146, 20, COL.gold, true);
            progress(ctx, x0 + 26, py + 162, rw - 52, 16, 1, COL.gold);
        }

        // gamemodes 3 columns
        const gy = 548, cols = 3, gw = (W - P * 2 - 16 * (cols - 1)) / cols, gh = 78;
        for (let i = 0; i < d.modes.length; i++) {
            const m = d.modes[i];
            const x = P + (i % cols) * (gw + 16), y = gy + Math.floor(i / cols) * (gh + 14);
            box(ctx, x, y, gw, gh, 12, m.rank ? COL.panelHi : COL.panel, m.rank ? COL.line : null);
            const emo = await loadImg(emojiUrl(m.emoji));
            ctx.globalAlpha = m.rank ? 1 : 0.35;
            if (emo) ctx.drawImage(emo, x + 14, y + 19, 40, 40);
            txt(ctx, m.name, x + 64, y + 48, 22, m.rank ? COL.soft : COL.faint, !!m.rank, gw - 64 - 92);
            ctx.globalAlpha = 1;
            if (m.rank) {
                const c = tierColor(m.rank);
                const cwid = width(ctx, m.rank, 20, true) + 24;
                const g = ctx.createLinearGradient(0, y + 19, 0, y + 59);
                g.addColorStop(0, c); g.addColorStop(1, c + 'b0');
                roundRect(ctx, x + gw - cwid - 14, y + 19, cwid, 40, 10); ctx.fillStyle = g; ctx.fill();
                txt(ctx, m.rank, x + gw - cwid / 2 - 14, y + 46, 20, '#15161c', true, 90, 'center');
            } else txt(ctx, '—', x + gw - 34, y + 48, 22, COL.faint, true, 30, 'center');
        }

        // stats
        const sy = H - 104;
        const stw = (W - P * 2) / d.stats.length;
        d.stats.forEach(([k, v], i) => {
            const x = P + i * stw;
            txt(ctx, String(v), x, sy, 38, COL.text, true, stw - 16);
            txt(ctx, String(k).toUpperCase(), x, sy + 34, 16, COL.dim, true, stw - 16);
        });
    });
}

// =====================================================================
// Match result (tournament) or tier-test result
// d: { kicker, title, accent, left: {name, head, sub, won}, right: {…}, score, how,
//      rows: [[label, value]], footer }
// =====================================================================
async function versusCard(d) {
    const rows = d.rows || [];
    const H = 180 + 330 + Math.ceil(rows.length / 2) * 104 + (d.footer ? 90 : 30);
    return render('result.png', H, async ctx => {
        background(ctx, H, d.accent || COL.accent);
        label(ctx, d.kicker, P, 64, d.accent || COL.accent);
        txt(ctx, d.title, P, 122, 44, COL.text, true, W - P * 2);
        const cy = 180, side = (W - P * 2 - 180) / 2;
        for (const [pl, x] of [[d.left, P], [d.right, P + side + 180]]) {
            if (!pl) continue;
            if (pl.won) glow(ctx, x + side / 2, cy + 110, 260, d.accent || COL.accent, 0.22);
            box(ctx, x, cy, side, 300, 18, pl.won ? COL.accent + '1f' : COL.panel, pl.won ? COL.accent : COL.line, 2.5);
            await head(ctx, pl.head, x + side / 2 - 70, cy + 30, 140, pl.name, pl.won === false ? 0.45 : 1);
            txt(ctx, pl.name, x + side / 2, cy + 222, 30, pl.won === false ? COL.dim : COL.text, true, side - 30, 'center');
            if (pl.won === false) { const w = Math.min(side - 30, width(ctx, pl.name, 30, true)); ctx.fillStyle = COL.red; ctx.fillRect(x + side / 2 - w / 2 - 4, cy + 210, w + 8, 3); }
            txt(ctx, pl.sub || (pl.won ? 'WINNER' : pl.won === false ? 'ELIMINATED' : ''), x + side / 2, cy + 266, 20, pl.won ? COL.accent : COL.dim, true, side - 30, 'center');
        }
        // centre score
        const mx = P + side + 90;
        if (d.score) txt(ctx, d.score, mx, cy + 170, d.score.length > 5 ? 44 : 64, COL.text, true, 176, 'center');
        if (d.how) txt(ctx, d.how, mx, cy + (d.score ? 214 : 160), 20, COL.muted, true, 176, 'center');
        // rows
        const tw = (W - P * 2 - 20) / 2;
        rows.forEach(([k, v], i) => {
            const x = P + (i % 2) * (tw + 20), y = cy + 330 + Math.floor(i / 2) * 104;
            box(ctx, x, y, tw, 88, 14, COL.panel, COL.line);
            label(ctx, k, x + 22, y + 34);
            txt(ctx, v, x + 22, y + 70, 24, COL.soft, true, tw - 44);
        });
        if (d.footer) footer(ctx, H, d.footer);
    });
}

// =====================================================================
// Tier test result
// d: { status, accent, name, head, gamemode, emoji, from, to, points, total, score, tester, notes, footer }
// =====================================================================
async function testResultCard(d) {
    const H = d.notes ? 760 : 660;
    return render('test-result.png', H, async ctx => {
        background(ctx, H, d.accent);
        await watermark(ctx, d.emoji, 300);
        chip(ctx, P, 32, d.status, d.accent, 20, 44);
        glow(ctx, P + 75, 180, 160, d.accent, 0.25);
        await head(ctx, d.head, P, 104, 150, d.name);
        txt(ctx, d.name, P + 180, 170, 52, COL.text, true, W - P * 2 - 180);
        const emo = await loadImg(emojiUrl(d.emoji));
        if (emo) ctx.drawImage(emo, P + 180, 196, 40, 40);
        txt(ctx, d.gamemode, P + 180 + (emo ? 52 : 0), 228, 28, COL.muted, true, 400);

        // from → to
        const y = 290;
        box(ctx, P, y, W - P * 2, 170, 18, COL.panel, COL.line);
        label(ctx, 'Previous', P + 30, y + 40);
        label(ctx, 'New tier', W / 2 + 40, y + 40);
        const big = (s, x, c) => txt(ctx, s, x, y + 124, 72, c, true, 300);
        big(d.from || '—', P + 30, d.from ? tierColor(d.from) : COL.faint);
        big(d.to || 'No change', W / 2 + 40, d.to ? tierColor(d.to) : COL.muted);
        txt(ctx, '→', W / 2 - 20, y + 118, 60, COL.dim, true, 60, 'center');

        const tw = (W - P * 2 - 40) / 3, ry = y + 196;
        [['Points', d.points], ['Match score', d.score], ['Tester', d.tester]].forEach(([k, v], i) => {
            const x = P + i * (tw + 20);
            box(ctx, x, ry, tw, 96, 14, COL.panel, COL.line);
            label(ctx, k, x + 22, ry + 36);
            txt(ctx, v, x + 22, ry + 76, 26, COL.soft, true, tw - 44);
        });
        if (d.notes) {
            label(ctx, 'Notes', P, ry + 146);
            wrap(ctx, d.notes, W - P * 2, 22, false, 2).forEach((ln, i) => txt(ctx, ln, P, ry + 182 + i * 32, 22, COL.muted, false, W - P * 2));
        }
        footer(ctx, H, d.footer);
    });
}

// =====================================================================
// Queue viewer
// d: { gamemode, emoji, testers: [names], testing: [[player, tester]], waiting: [{name, head, eta, waitedDays}],
//      max, avg, footer }
// =====================================================================
async function queueCard(d) {
    const shown = d.waiting.slice(0, 12);
    const H = 336 + Math.max(1, shown.length) * 70 + (d.waiting.length > shown.length ? 40 : 0) + 100;
    return render('queue.png', H, async ctx => {
        background(ctx, H, COL.accent);
        await watermark(ctx, d.emoji, 280);
        const emo = await loadImg(emojiUrl(d.emoji));
        let hx = P;
        if (emo) { ctx.drawImage(emo, P, 30, 56, 56); hx += 70; }
        txt(ctx, `${d.gamemode.toUpperCase()} QUEUE`, hx, 76, 46, COL.text, true, W - hx - P);

        // stat tiles
        const tw = (W - P * 2 - 40) / 3, ty = 116;
        const tiles = [
            ['Testers online', String(d.testers.length), d.testers.slice(0, 3).join(', ') || 'none right now'],
            ['Testing now', String(d.testing.length), d.testing.slice(0, 2).map(([a, b]) => `${a} → ${b}`).join(', ') || '—'],
            ['Avg test', `${d.avg} min`, `${d.waiting.length}/${d.max} waiting`]
        ];
        tiles.forEach(([k, v, sub], i) => {
            const x = P + i * (tw + 20);
            box(ctx, x, ty, tw, 150, 16, COL.panel, COL.line);
            label(ctx, k, x + 22, ty + 38, i === 0 && d.testers.length ? COL.accent : COL.dim);
            txt(ctx, v, x + 22, ty + 96, 44, COL.text, true, tw - 44);
            txt(ctx, sub, x + 22, ty + 130, 18, COL.muted, false, tw - 44);
        });

        // waiting list
        let y = 316;
        label(ctx, `Waiting · ${d.waiting.length}/${d.max}`, P, y);
        y += 20;
        if (!shown.length) { box(ctx, P, y, W - P * 2, 60, 12, COL.panel); txt(ctx, 'Nobody waiting. Press REQUEST TEST to join!', W / 2, y + 39, 22, COL.faint, false, W - P * 2, 'center'); }
        for (let i = 0; i < shown.length; i++) {
            const w = shown[i], ry = y + i * 70;
            box(ctx, P, ry, W - P * 2, 60, 12, i === 0 ? COL.accent + '26' : COL.panel, i === 0 ? COL.accent : null);
            txt(ctx, `#${i + 1}`, P + 20, ry + 40, 24, i === 0 ? COL.accent : COL.dim, true, 60);
            await head(ctx, w.head, P + 84, ry + 10, 40, w.name);
            txt(ctx, w.name, P + 138, ry + 40, 24, COL.soft, true, W - P * 2 - 420);
            if (w.waitedDays >= 3) txt(ctx, `waiting ${w.waitedDays}d`, W - P - 190, ry + 39, 18, COL.gold, true, 120, 'right');
            txt(ctx, w.eta, W - P - 20, ry + 40, 22, COL.muted, true, 160, 'right');
        }
        if (d.waiting.length > shown.length) txt(ctx, `+${d.waiting.length - shown.length} more waiting`, P, y + shown.length * 70 + 26, 20, COL.muted, true);
        footer(ctx, H, d.footer);
    });
}

// =====================================================================
// Tester card
// d: { name, avatar, gamemode, emoji, tier, region, device, tests, certified, status, statusColor, footer }
// =====================================================================
async function testerCard(d) {
    const H = 560;
    return render('tester.png', H, async ctx => {
        const accent = d.statusColor || COL.blue;
        background(ctx, H, accent);
        await watermark(ctx, d.emoji, 280);
        chip(ctx, P, 32, d.status, accent, 20, 44);
        glow(ctx, P + 90, 200, 150, accent, 0.3);
        const ok = await avatarCircle(ctx, d.avatar, P + 90, 200, 90);
        if (!ok) await head(ctx, null, P, 110, 180, d.name);
        txt(ctx, d.name, P + 210, 176, 50, COL.text, true, W - P * 2 - 210);
        const emo = await loadImg(emojiUrl(d.emoji));
        if (emo) ctx.drawImage(emo, P + 210, 200, 44, 44);
        txt(ctx, `${d.gamemode} Tester`, P + 210 + (emo ? 56 : 0), 234, 30, COL.muted, true, 500);
        const tw = (W - P * 2 - 60) / 4, ty = 320;
        [['Tier', d.tier], ['Region', d.region || '—'], ['Device', d.device || '—'], ['Tests', String(d.tests ?? 0)]].forEach(([k, v], i) => {
            const x = P + i * (tw + 20);
            box(ctx, x, ty, tw, 110, 14, COL.panel, COL.line);
            label(ctx, k, x + 20, ty + 36);
            txt(ctx, v, x + 20, ty + 84, 32, k === 'Tier' ? tierColor(v) : COL.soft, true, tw - 40);
        });
        footer(ctx, H, d.footer || (d.certified ? 'Certified tester' : 'Not certified yet'));
    });
}

// =====================================================================
// Leaderboard
// d: { mode, emoji, subtitle, filter, podium: [player×≤3], rows: [player], footer }
// player: { pos, name, head, body, value, sub, rank }   (rank = tier chip, e.g. HT2)
// =====================================================================
const MEDAL = { 1: '#f0b232', 2: '#c3cad6', 3: '#d08a4a' };
async function leaderboardCard(d) {
    const podiumH = d.podium?.length ? 560 : 0;
    const rowH = 78;
    const H = 170 + podiumH + (d.rows.length || (podiumH ? 0 : 1)) * rowH + 110;
    return render('leaderboard.png', H, async ctx => {
        background(ctx, H, MEDAL[1]);
        await watermark(ctx, d.emoji, 300);
        const emo = await loadImg(emojiUrl(d.emoji));
        let hx = P;
        if (emo) { ctx.drawImage(emo, P, 34, 60, 60); hx += 76; }
        txt(ctx, `${d.mode.toUpperCase()} LEADERBOARD`, hx, 84, 44, COL.text, true, W - hx - P);
        txt(ctx, d.subtitle, P, 136, 22, COL.muted, false, W - P * 2 - 220);
        if (d.filter) chip(ctx, W - P - width(ctx, d.filter, 18, true) - 28, 106, d.filter, COL.accent, 18, 40);

        // podium: #2 left, #1 centre, #3 right
        if (d.podium?.length) {
            const base = 170 + podiumH - 30;
            const spots = [[2, W / 2 - 290, 125], [1, W / 2, 175], [3, W / 2 + 290, 100]];
            for (const [place, cx, bh] of spots) {
                const pl = d.podium[place - 1];
                if (!pl) continue;
                const c = MEDAL[place], bw = 250, top = base - bh;
                glow(ctx, cx, top - 150, 230, c, place === 1 ? 0.3 : 0.18);
                // skin (full body if we have it)
                const body = await loadImg(pl.body);
                const skinH = place === 1 ? 270 : 220;
                if (body) {
                    const w = (body.width / body.height) * skinH;
                    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.ellipse(cx, top - 58, 70, 12, 0, 0, Math.PI * 2); ctx.fill();
                    ctx.imageSmoothingEnabled = false; ctx.drawImage(body, cx - w / 2, top - 60 - skinH, w, skinH); ctx.imageSmoothingEnabled = true;
                } else await head(ctx, pl.head, cx - 55, top - 170, 110, pl.name);
                txt(ctx, pl.name, cx, top - 20, place === 1 ? 30 : 25, COL.text, true, bw, 'center');
                // block
                const g = ctx.createLinearGradient(0, top, 0, base);
                g.addColorStop(0, c + 'cc'); g.addColorStop(1, c + '33');
                ctx.save(); ctx.shadowColor = c + '66'; ctx.shadowBlur = 24;
                roundRect(ctx, cx - bw / 2, top, bw, bh, 14); ctx.fillStyle = g; ctx.fill(); ctx.restore();
                // tier badge / points at the top of the block, big place number below it
                if (pl.rank) {
                    const tc = tierColor(pl.rank), cw = width(ctx, pl.rank, 20, true) + 26;
                    roundRect(ctx, cx - cw / 2, top + 12, cw, 36, 10); ctx.fillStyle = '#15161c'; ctx.fill();
                    txt(ctx, pl.rank, cx, top + 37, 20, tc, true, cw, 'center');
                } else {
                    const vw = width(ctx, pl.value, 20, true) + 26;
                    roundRect(ctx, cx - vw / 2, top + 12, vw, 36, 10); ctx.fillStyle = '#15161c'; ctx.fill();
                    txt(ctx, pl.value, cx, top + 37, 20, c, true, bw - 20, 'center');
                }
                const numSize = Math.max(28, Math.min(bh - 58, 80));
                txt(ctx, String(place), cx, base - 14, numSize, 'rgba(0,0,0,0.30)', true, bw, 'center');
            }
        }

        // rows
        let y = 170 + podiumH;
        if (!d.rows.length && !d.podium?.length) {
            box(ctx, P, y, W - P * 2, 64, 14, COL.panel);
            txt(ctx, 'Nobody ranked here yet. Get tested to appear!', W / 2, y + 41, 22, COL.faint, false, W - P * 2, 'center');
        }
        for (const pl of d.rows) {
            const medal = MEDAL[pl.pos];
            box(ctx, P, y, W - P * 2, rowH - 12, 14, medal ? COL.panelHi : COL.panel, medal ? medal + 'aa' : null);
            txt(ctx, `#${pl.pos}`, P + 22, y + 44, 24, medal || COL.dim, true, 70);
            await head(ctx, pl.head, P + 96, y + 9, 48, pl.name);
            txt(ctx, pl.name, P + 160, y + (pl.sub ? 34 : 44), 25, COL.soft, true, W - P * 2 - 400);
            if (pl.sub) txt(ctx, pl.sub, P + 160, y + 58, 17, COL.muted, false, W - P * 2 - 400);
            if (pl.rank) {
                const tc = tierColor(pl.rank), cw = width(ctx, pl.rank, 20, true) + 26;
                const g = ctx.createLinearGradient(0, y + 14, 0, y + 52); g.addColorStop(0, tc); g.addColorStop(1, tc + 'b0');
                roundRect(ctx, W - P - cw - 18, y + 14, cw, 38, 10); ctx.fillStyle = g; ctx.fill();
                txt(ctx, pl.rank, W - P - cw / 2 - 18, y + 41, 20, '#15161c', true, cw, 'center');
            } else txt(ctx, pl.value, W - P - 20, y + 44, 24, COL.text, true, 220, 'right');
            y += rowH;
        }
        footer(ctx, H, d.footer);
    });
}

module.exports = { setColor, accent: () => COL.accent, accentDark: () => COL.accentDark, tournamentCard, profileCard, leaderboardCard, versusCard, testResultCard, queueCard, testerCard, available: () => !!canvasLib() };
