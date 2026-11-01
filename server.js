// Nurgulify Music server. No dependencies: run with `node server.js`
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000, ROOT = __dirname;
const DB_FILE = path.join(ROOT, 'data', 'db.json'), UPLOADS = path.join(ROOT, 'uploads');
fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
fs.mkdirSync(UPLOADS, { recursive: true });

let db = { users: {}, sessions: {}, tracks: [] };
if (fs.existsSync(DB_FILE)) db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
// Merge extra tracks from data/extra-tracks.json (added once, matched by url)
try {
    let maxId = db.tracks.reduce((a, t) => Math.max(a, t.id), 0);
    JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'extra-tracks.json'), 'utf8'))
        .forEach(t => { if (!db.tracks.some(x => x.url === t.url)) db.tracks.push({ ...t, id: ++maxId }); });
} catch (e) { /* no extra file: fine */ }
const save = () => { fs.writeFileSync(DB_FILE + '.tmp', JSON.stringify(db)); fs.renameSync(DB_FILE + '.tmp', DB_FILE); };

const clean = (s, n = 60) => String(s || '').replace(/[<>&"'`\\]/g, '').trim().slice(0, n);
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
const send = (res, code, obj, headers = {}) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers });
    res.end(JSON.stringify(obj));
};
const readBody = (req, max) => new Promise((ok, bad) => {
    let n = 0; const chunks = [];
    req.on('data', d => { n += d.length; if (n > max) { bad(new Error('File too large')); req.destroy(); } else chunks.push(d); });
    req.on('end', () => ok(Buffer.concat(chunks)));
    req.on('error', bad);
});
const readJson = async req => { try { return JSON.parse((await readBody(req, 1e5)).toString() || '{}'); } catch { return {}; } };
const currentUser = req => {
    const c = (req.headers.cookie || '').split(/;\s*/).find(x => x.startsWith('sid='));
    const s = c && db.sessions[c.slice(4)];
    return s && s.exp > Date.now() ? db.users[s.u] || null : null;
};
const pub = u => ({ username: u.username, likes: u.likes, playlists: u.playlists });
const attempts = {};
const tooMany = ip => {
    const a = attempts[ip] = (attempts[ip] && Date.now() - attempts[ip].t < 6e5) ? attempts[ip] : { n: 0, t: Date.now() };
    return ++a.n > 15;
};

function startSession(req, res, user) {
    const tok = crypto.randomBytes(32).toString('hex');
    db.sessions[tok] = { u: user.key, exp: Date.now() + 30 * 864e5 };
    save();
    const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
    send(res, 200, { user: pub(user) }, { 'Set-Cookie': `sid=${tok}; HttpOnly; SameSite=Lax; Path=/; Max-Age=2592000${secure}` });
}

function serve(req, res, file, type) {
    fs.stat(file, (err, st) => {
        if (err) return send(res, 404, { error: 'Not found' });
        let start = 0, end = st.size - 1, code = 200;
        const h = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff' };
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
        if (m && (m[1] || m[2])) {
            start = m[1] ? +m[1] : st.size - +m[2];
            if (m[1] && m[2]) end = Math.min(+m[2], end);
            code = 206; h['Content-Range'] = `bytes ${start}-${end}/${st.size}`;
        }
        if (start > end || start < 0) { res.writeHead(416); return res.end(); }
        h['Content-Length'] = end - start + 1;
        res.writeHead(code, h);
        fs.createReadStream(file, { start, end }).pipe(res);
    });
}

async function api(req, res, url) {
    const p = url.pathname.slice(4), method = req.method, me = currentUser(req);
    const ip = req.socket.remoteAddress;

    if (p === '/tracks' && method === 'GET') return send(res, 200, { tracks: db.tracks });
    if (p === '/me' && method === 'GET') return send(res, 200, { user: me ? pub(me) : null });

    if ((p === '/register' || p === '/login') && method === 'POST') {
        if (tooMany(ip)) return send(res, 429, { error: 'Too many attempts. Try again later.' });
        const { username, password } = await readJson(req);
        const key = String(username || '').toLowerCase();
        if (!/^[a-z0-9_.]{3,20}$/.test(key)) return send(res, 400, { error: 'Username: 3-20 letters, digits, _ or .' });
        if (typeof password !== 'string' || password.length < 6 || password.length > 100) return send(res, 400, { error: 'Password must be at least 6 characters' });
        if (p === '/register') {
            if (db.users[key]) return send(res, 409, { error: 'This username is taken' });
            const salt = crypto.randomBytes(16).toString('hex');
            db.users[key] = { key, username: String(username), salt, hash: hash(password, salt), likes: [], playlists: [] };
            return startSession(req, res, db.users[key]);
        }
        const u = db.users[key];
        const ok = u && crypto.timingSafeEqual(Buffer.from(hash(password, u.salt), 'hex'), Buffer.from(u.hash, 'hex'));
        return ok ? startSession(req, res, u) : send(res, 401, { error: 'Wrong username or password' });
    }

    if (p === '/logout' && method === 'POST') {
        const c = (req.headers.cookie || '').split(/;\s*/).find(x => x.startsWith('sid='));
        if (c) { delete db.sessions[c.slice(4)]; save(); }
        return send(res, 200, { ok: true }, { 'Set-Cookie': 'sid=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' });
    }

    if (!me) return send(res, 401, { error: 'Please log in' });

    let m;
    if ((m = p.match(/^\/likes\/(\d+)$/)) && method === 'POST') {
        const id = +m[1];
        if (!db.tracks.some(t => t.id === id)) return send(res, 404, { error: 'Track not found' });
        me.likes = me.likes.includes(id) ? me.likes.filter(x => x !== id) : [...me.likes, id];
        save();
        return send(res, 200, { likes: me.likes });
    }
    if (p === '/playlists' && method === 'POST') {
        const name = clean((await readJson(req)).name, 40);
        if (!name) return send(res, 400, { error: 'Enter a playlist name' });
        if (me.playlists.length >= 30) return send(res, 400, { error: 'Playlist limit reached' });
        me.playlists.push({ id: crypto.randomBytes(4).toString('hex'), name, tracks: [] });
        save();
        return send(res, 200, { playlists: me.playlists });
    }
    if ((m = p.match(/^\/playlists\/(\w+)\/tracks$/)) && method === 'POST') {
        const pl = me.playlists.find(x => x.id === m[1]), id = +(await readJson(req)).trackId;
        if (!pl || !db.tracks.some(t => t.id === id)) return send(res, 404, { error: 'Not found' });
        if (!pl.tracks.includes(id)) pl.tracks.push(id);
        save();
        return send(res, 200, { playlists: me.playlists });
    }
    if (p === '/tracks' && method === 'POST') {
        if (!(req.headers['content-type'] || '').startsWith('audio/')) return send(res, 400, { error: 'Only MP3 files are allowed' });
        const body = await readBody(req, 25 * 1024 * 1024);
        const mp3 = body.slice(0, 3).toString() === 'ID3' || (body[0] === 0xFF && (body[1] & 0xE0) === 0xE0);
        if (!mp3) return send(res, 400, { error: 'This is not a valid MP3 file' });
        const dec = v => { try { return decodeURIComponent(v || ''); } catch { return ''; } };
        const id = db.tracks.reduce((a, t) => Math.max(a, t.id), 0) + 1;
        fs.writeFileSync(path.join(UPLOADS, id + '.mp3'), body);
        const track = {
            id, title: clean(dec(req.headers['x-title'])) || 'Untitled', artist: clean(dec(req.headers['x-artist'])) || me.username,
            album: 'Community', duration: '', url: `/uploads/${id}.mp3`, owner: me.key,
            img: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80'
        };
        db.tracks.push(track);
        save();
        return send(res, 200, { track });
    }
    send(res, 404, { error: 'Not found' });
}

save();
http.createServer(async (req, res) => {
    try {
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname.startsWith('/api/')) return await api(req, res, url);
        if (url.pathname === '/' || url.pathname === '/index.html') return serve(req, res, path.join(ROOT, 'index.html'), 'text/html; charset=utf-8');
        if (url.pathname === '/script.js') return serve(req, res, path.join(ROOT, 'script.js'), 'text/javascript; charset=utf-8');
        if (/^\/uploads\/\d+\.mp3$/.test(url.pathname)) return serve(req, res, path.join(UPLOADS, path.basename(url.pathname)), 'audio/mpeg');
        send(res, 404, { error: 'Not found' });
    } catch (e) {
        send(res, e.message === 'File too large' ? 413 : 500, { error: e.message === 'File too large' ? 'File too large (max 25 MB)' : 'Server error' });
    }
}).listen(PORT, () => console.log(`Nurgulify running at http://localhost:${PORT}`));
