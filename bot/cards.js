// ==================== IMAGE CARDS ====================
// Cards drawn as images (same style as the bracket) instead of embeds, so
// they look the same on phone and PC. Needs @napi-rs/canvas; every render
// function returns null without it and callers fall back to embeds.

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
    text: '#ffffff', soft: '#dfe1e7', muted: '#9aa0ae', dim: '#6b7080', faint: '#5c6170',
    gold: '#f0b232', goldBg: '#2e2710', green: '#2ecc71', greenDk: '#1f7a45', red: '#ed4245', blue: '#5865f2'
};
// Tier chip colours: tier 1 gold → tier 5 grey.
const TIER_COL = { 1: '#f0b232', 2: '#e67e22', 3: '#9b59b6', 4: '#3498db', 5: '#7f8c8d' };

const font = (size, bold) => `${size}px "${bold ? 'MCB Sans Bold' : 'MCB Sans'}", "DejaVu Sans", sans-serif`;

function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}
function fill(ctx, x, y, w, h, r, color, stroke) {
    roundRect(ctx, x, y, w, h, r);
    ctx.fillStyle = color; ctx.fill();
    if (stroke) { ctx.lineWidth = 1.5; ctx.strokeStyle = stroke; ctx.stroke(); }
}
function fitText(ctx, text, maxW) {
    text = String(text ?? '');
    if (ctx.measureText(text).width <= maxW) return text;
    let s = text;
    while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
    return s + '…';
}
function txt(ctx, s, x, y, size, color, bold, maxW, align = 'left') {
    ctx.font = font(size, bold); ctx.fillStyle = color; ctx.textAlign = align;
    ctx.fillText(maxW ? fitText(ctx, s, maxW) : String(s), x, y);
    ctx.textAlign = 'left';
}
function background(ctx, W, H, accent = COL.gold) {
    const g = ctx.createLinearGradient(0, 0, W, H);
    g.addColorStop(0, COL.bg1); g.addColorStop(1, COL.bg2);
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = accent; ctx.fillRect(0, 0, W, 6);
}

const imgCache = new Map();
async function loadImg(url) {
    if (!url || !canvasLib()) return null;
    if (imgCache.has(url)) return imgCache.get(url);
    const img = await Promise.race([C.loadImage(url), new Promise(r => setTimeout(() => r(null), 5000))]).catch(() => null);
    if (img) imgCache.set(url, img);
    return img;
}
// "<:sword_custom:123>" → emoji image URL
function emojiUrl(symbol) {
    const m = String(symbol || '').match(/<a?:\w+:(\d+)>/);
    return m ? `https://cdn.discordapp.com/emojis/${m[1]}.png?size=64` : null;
}
function tierNum(rank) { const m = String(rank || '').match(/(\d)$/); return m ? Number(m[1]) : null; }
function chip(ctx, x, y, label, color, h = 30) {
    ctx.font = font(15, true);
    const w = ctx.measureText(label).width + 22;
    fill(ctx, x, y, w, h, 7, color + '33', color);
    txt(ctx, label, x + 11, y + h / 2 + 5.5, 15, color, true);
    return w;
}
function progress(ctx, x, y, w, h, frac, color = COL.green) {
    fill(ctx, x, y, w, h, h / 2, COL.line);
    const fw = Math.max(0, Math.min(1, frac)) * w;
    if (fw > 0) fill(ctx, x, y, Math.max(fw, h), h, h / 2, color);
}
function done(canvas, name) {
    const { AttachmentBuilder } = require('discord.js');
    return new AttachmentBuilder(canvas.toBuffer('image/png'), { name });
}

// =====================================================================
// Tournament sign-up card
// data: { status, statusColor, name, gamemode, emoji, host, server, prize, title,
//         starts, closes, format, checkin, tier, region, players: [{name, head}], size,
//         waitlist, unit, world: [[label, 'HH:MM Day']], footer }
// =====================================================================
async function tournamentCard(d) {
    if (!canvasLib()) return null;
    try {
        const W = 1100, H = 640, P = 44;
        const canvas = C.createCanvas(W, H);
        const ctx = canvas.getContext('2d');
        background(ctx, W, H, d.statusColor || COL.gold);

        // header
        const emo = await loadImg(emojiUrl(d.emoji));
        let hx = P;
        if (emo) { ctx.drawImage(emo, P, 34, 34, 34); hx += 44; }
        txt(ctx, `${d.gamemode.toUpperCase()} TOURNAMENT`, hx, 58, 17, COL.gold, true);
        chip(ctx, hx + ctx.measureText(`${d.gamemode.toUpperCase()} TOURNAMENT`).width + 16, 36, d.status, d.statusColor || COL.green, 28);
        txt(ctx, d.name, P, 118, 46, COL.text, true, W - P * 2 - 330);
        txt(ctx, [d.host && `Hosted by ${d.host}`, d.server].filter(Boolean).join('  ·  '), P, 154, 18, COL.muted, false, W - P * 2 - 330);

        // prize box
        const px = W - P - 300, py = 36;
        fill(ctx, px, py, 300, 128, 14, COL.goldBg, COL.gold);
        txt(ctx, 'PRIZE', px + 22, py + 32, 14, COL.gold, true);
        txt(ctx, d.prize || d.title, px + 22, py + 76, d.prize ? 38 : 24, COL.text, true, 256);
        txt(ctx, d.prize ? `+ ${d.title}` : 'title until the next cup', px + 22, py + 106, 16, '#e8d9a8', false, 256);

        // info tiles
        const tiles = [['STARTS', d.starts], ['SIGN-UPS CLOSE', d.closes], ['FORMAT', d.format], ['CHECK-IN', d.checkin]];
        const tw = (W - P * 2 - 16 * 3) / 4, ty = 196;
        tiles.forEach(([k, v], i) => {
            const x = P + i * (tw + 16);
            fill(ctx, x, ty, tw, 92, 12, COL.panel, COL.line);
            txt(ctx, k, x + 18, ty + 30, 13, COL.dim, true);
            const lines = String(v).split('\n');
            lines.slice(0, 2).forEach((ln, j) => txt(ctx, ln, x + 18, ty + 58 + j * 22, j ? 15 : 19, j ? COL.muted : COL.soft, !j, tw - 36));
        });

        // players
        const py2 = 318;
        fill(ctx, P, py2, W - P * 2, 150, 14, COL.panel, COL.line);
        txt(ctx, (d.unit || 'players').toUpperCase(), P + 22, py2 + 36, 14, COL.dim, true);
        txt(ctx, `${d.players.length}`, P + 22, py2 + 86, 46, COL.text, true);
        ctx.font = font(46, true); const nw = ctx.measureText(`${d.players.length}`).width;
        txt(ctx, `/ ${d.size}`, P + 30 + nw, py2 + 86, 24, COL.muted, true);
        if (d.waitlist) txt(ctx, `+ ${d.waitlist} on waitlist`, P + 22, py2 + 118, 15, COL.gold, true);
        else if (d.players.length >= d.size) txt(ctx, 'Full', P + 22, py2 + 118, 15, COL.gold, true);
        else txt(ctx, `${d.size - d.players.length} spots left`, P + 22, py2 + 118, 15, COL.green, true);
        const bx = P + 200, bw = W - P * 2 - 222;
        progress(ctx, bx, py2 + 30, bw, 14, d.players.length / Math.max(1, d.size), d.players.length >= d.size ? COL.gold : COL.green);
        // joined players' heads
        const maxHeads = Math.floor(bw / 44) * 2;
        let i = 0;
        for (const p of d.players.slice(0, maxHeads)) {
            const col = i % Math.floor(bw / 44), row = Math.floor(i / Math.floor(bw / 44));
            const x = bx + col * 44, y = py2 + 62 + row * 42;
            const head = await loadImg(p.head);
            if (head) ctx.drawImage(head, x, y, 36, 36);
            else { fill(ctx, x, y, 36, 36, 6, COL.panelHi, COL.line); txt(ctx, (p.name || '?')[0].toUpperCase(), x + 18, y + 25, 17, COL.muted, true, 30, 'center'); }
            i++;
        }
        if (!d.players.length) txt(ctx, 'Be the first to join!', bx, py2 + 90, 18, COL.faint, false);

        // world clock
        const wy = 492;
        txt(ctx, 'START TIME AROUND THE WORLD', P, wy, 13, COL.dim, true);
        const n = d.world.length, cw = (W - P * 2) / n;
        d.world.forEach(([label, time], k) => {
            const x = P + k * cw;
            txt(ctx, label, x, wy + 30, 14, COL.muted, false, cw - 8);
            const night = /^0[0-6]:/.test(time);
            txt(ctx, time, x, wy + 56, 19, night ? COL.faint : COL.text, true, cw - 8);
        });

        // footer
        ctx.fillStyle = COL.line; ctx.fillRect(P, H - 58, W - P * 2, 1);
        txt(ctx, d.footer, P, H - 26, 14, COL.dim, false, W - P * 2);
        return done(canvas, 'tournament.png');
    } catch (e) {
        console.error('[Cards] tournament card failed:', e.message);
        return null;
    }
}

// =====================================================================
// Profile card
// data: { name, title, titleNext, points, nextPoints, prevPoints, position, region, device,
//         badges: [string], body, avatar, modes: [{name, emoji, rank}], stats: [[label, value]] }
// =====================================================================
async function profileCard(d) {
    if (!canvasLib()) return null;
    try {
        const W = 1100, H = 660, P = 40;
        const canvas = C.createCanvas(W, H);
        const ctx = canvas.getContext('2d');
        const champion = d.badges?.length;
        background(ctx, W, H, champion ? COL.gold : COL.blue);

        // left: skin render
        fill(ctx, P, 36, 270, H - 72, 16, COL.panel, champion ? COL.gold : COL.line);
        const body = await loadImg(d.body);
        if (body) {
            const h = 400, w = (body.width / body.height) * h;
            ctx.drawImage(body, P + 135 - w / 2, 70, w, h);
        } else {
            const av = await loadImg(d.avatar);
            if (av) {
                ctx.save(); ctx.beginPath(); ctx.arc(P + 135, 190, 90, 0, Math.PI * 2); ctx.clip();
                ctx.drawImage(av, P + 45, 100, 180, 180); ctx.restore();
            }
            txt(ctx, 'No skin found', P + 135, 320, 15, COL.faint, false, 240, 'center');
            txt(ctx, 'use /refreshskin', P + 135, 342, 14, COL.faint, false, 240, 'center');
        }
        txt(ctx, d.region || 'Unknown region', P + 135, H - 104, 16, COL.soft, true, 240, 'center');
        txt(ctx, d.device || '', P + 135, H - 78, 15, COL.muted, false, 240, 'center');

        // right: header
        const x0 = P + 300, rw = W - x0 - P;
        txt(ctx, d.title.toUpperCase(), x0, 66, 16, COL.gold, true);
        txt(ctx, d.name, x0, 118, 44, COL.text, true, rw - 220);
        let bxp = x0;
        for (const b of (d.badges || []).slice(0, 2)) bxp += chip(ctx, bxp, 134, b, COL.gold, 30) + 10;
        // position box
        fill(ctx, W - P - 200, 40, 200, 96, 14, COL.panelHi, COL.line);
        txt(ctx, 'POSITION', W - P - 180, 68, 13, COL.dim, true);
        txt(ctx, `#${d.position}`, W - P - 180, 112, 36, COL.text, true);
        txt(ctx, `${d.points} pts`, W - P - 20, 112, 17, COL.muted, true, 90, 'right');

        // progress to next title
        const py = 188;
        if (d.titleNext) {
            txt(ctx, `NEXT: ${d.titleNext.toUpperCase()}`, x0, py, 13, COL.dim, true);
            txt(ctx, `${d.points} / ${d.nextPoints}  ·  ${d.nextPoints - d.points} to go`, x0 + rw, py, 14, COL.muted, true, 300, 'right');
            progress(ctx, x0, py + 12, rw, 14, (d.points - d.prevPoints) / Math.max(1, d.nextPoints - d.prevPoints));
        } else {
            txt(ctx, 'HIGHEST TITLE REACHED', x0, py, 13, COL.gold, true);
            progress(ctx, x0, py + 12, rw, 14, 1, COL.gold);
        }

        // gamemode grid
        const gy = 238, cols = 3, gw = (rw - 12 * (cols - 1)) / cols, gh = 56;
        for (let i = 0; i < d.modes.length; i++) {
            const m = d.modes[i];
            const x = x0 + (i % cols) * (gw + 12), y = gy + Math.floor(i / cols) * (gh + 10);
            fill(ctx, x, y, gw, gh, 10, m.rank ? COL.panelHi : COL.panel, m.rank ? COL.line : COL.panel);
            const emo = await loadImg(emojiUrl(m.emoji));
            ctx.globalAlpha = m.rank ? 1 : 0.35;
            if (emo) ctx.drawImage(emo, x + 12, y + 14, 28, 28);
            txt(ctx, m.name, x + 50, y + 35, 17, m.rank ? COL.soft : COL.faint, !!m.rank, gw - 130);
            ctx.globalAlpha = 1;
            if (m.rank) {
                const c = TIER_COL[tierNum(m.rank)] || COL.muted;
                ctx.font = font(15, true);
                const cwid = ctx.measureText(m.rank).width + 22;
                fill(ctx, x + gw - cwid - 12, y + 13, cwid, 30, 7, c + '33', c);
                txt(ctx, m.rank, x + gw - cwid / 2 - 12, y + 34, 15, c, true, 80, 'center');
            } else txt(ctx, '—', x + gw - 24, y + 35, 17, COL.faint, true, 20, 'center');
        }

        // stats row
        const sy = H - 70;
        const sw = rw / d.stats.length;
        d.stats.forEach(([k, v], i) => {
            const x = x0 + i * sw;
            txt(ctx, String(v), x, sy + 6, 24, COL.text, true, sw - 10);
            txt(ctx, k.toUpperCase(), x, sy + 30, 12, COL.dim, true, sw - 10);
        });
        return done(canvas, 'profile.png');
    } catch (e) {
        console.error('[Cards] profile card failed:', e.message);
        return null;
    }
}

module.exports = { tournamentCard, profileCard, available: () => !!canvasLib() };
