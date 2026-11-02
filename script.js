// Nurgulify Music: player logic
const songs = [
    { id:1, title:"Lofi Study Session", artist:"Freesound Audio", album:"Chill & Relax", duration:"2:30",
      url:"https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf756.mp3?filename=lofi-study-112191.mp3",
      img:"https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=600&q=80", liked:true },
    { id:2, title:"Synthwave Sunset", artist:"Cyber Pulse", album:"Synthwave 1984", duration:"2:15",
      url:"https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=synthwave-80s-10978.mp3",
      img:"https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=600&q=80", liked:false },
    { id:3, title:"Midnight Ambient Chill", artist:"Astral Sound", album:"Late Night", duration:"2:40",
      url:"https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=ambient-classical-guitar-14498.mp3",
      img:"https://images.unsplash.com/photo-1518609878373-06d740f60d8b?auto=format&fit=crop&w=600&q=80", liked:true },
    { id:4, title:"Cosmic Electronic Flow", artist:"Nebula Sound", album:"Focus Flow", duration:"2:20",
      url:"https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=space-chillout-12596.mp3",
      img:"https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=600&q=80", liked:false }
];


const $ = id => document.getElementById(id);
const audio = $('audio-element');
let cur = 0, isShuffle = false, isRepeat = false, view = 'home', toastTimer, failCount = 0;

const formatTime = s => {
    if (!isFinite(s)) return '0:00';
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
};
const setText = (ids, text) => ids.forEach(id => $(id).innerText = text);
const setWidth = pct => ['footer-progress-bar', 'sidebar-progress-bar'].forEach(id => $(id).style.width = pct + '%');

document.addEventListener('DOMContentLoaded', () => {
    audio.volume = 0.8;
    renderGrid();
    renderPlaylists();
    loadSong(0);
    switchNav('home');

    audio.addEventListener('timeupdate', () => {
        if (!audio.duration) return;
        setWidth((audio.currentTime / audio.duration) * 100);
        setText(['footer-current-time', 'sidebar-current-time'], formatTime(audio.currentTime));
    });
    audio.addEventListener('loadedmetadata', () => setText(['footer-duration', 'sidebar-duration'], formatTime(audio.duration)));
    audio.addEventListener('play', () => { failCount = 0; setPlayIcons(true); });
    audio.addEventListener('pause', () => setPlayIcons(false));
    audio.addEventListener('ended', nextTrack);
    audio.addEventListener('error', () => {
        showToast('Playback error', 'This track could not be loaded');
        setPlayIcons(false);
        if (++failCount < songs.length && audio.dataset.wantPlay === '1') nextTrack();
    });

    document.addEventListener('keydown', e => {
        if (e.key === 'Escape') closeModal();
        if (e.code === 'Space' && !['INPUT', 'TEXTAREA', 'BUTTON', 'A'].includes(e.target.tagName)) {
            e.preventDefault();
            togglePlayPause();
        }
    });
});

function loadSong(index) {
    cur = index;
    const song = songs[cur];
    audio.src = song.url;
    setWidth(0);
    setText(['footer-current-time', 'sidebar-current-time'], '0:00');
    setText(['footer-duration', 'sidebar-duration'], song.duration || '0:00');
    updateNowPlaying();
}

// Updates the UI only: it does not touch the audio, so liking a song never restarts it
function updateNowPlaying() {
    const s = songs[cur];
    setText(['footer-title', 'right-sidebar-title'], s.title);
    setText(['footer-artist', 'right-sidebar-artist'], s.artist);
    $('footer-img').src = $('right-sidebar-img').src = s.img;
    ['footer-like-icon', 'right-sidebar-like-icon'].forEach(id => {
        $(id).className = 'fa-heart text-sm ' + (s.liked ? 'fa-solid text-purple-500' : 'fa-regular text-gray-400');
    });
}

function playCurrent() {
    audio.dataset.wantPlay = '1';
    const p = audio.play();
    if (p) p.catch(() => {});
}

function togglePlayPause() {
    if (audio.paused) {
        playCurrent();
        showToast('Playing', songs[cur].title);
    } else {
        audio.dataset.wantPlay = '0';
        audio.pause();
    }
}

function setPlayIcons(playing) {
    document.querySelectorAll('.js-play-icon').forEach(i => {
        i.classList.toggle('fa-pause', playing);
        i.classList.toggle('fa-play', !playing);
    });
}

function selectSong(index) {
    if (index !== cur) loadSong(index);
    playCurrent();
    showToast('Now Playing', songs[cur].title);
}

function nextTrack() {
    let next = (cur + 1) % songs.length;
    if (isShuffle && songs.length > 1) {
        do { next = Math.floor(Math.random() * songs.length); } while (next === cur);
    }
    loadSong(next);
    playCurrent();
    showToast('Now Playing', songs[cur].title);
}

function prevTrack() {
    if (audio.currentTime > 3) { audio.currentTime = 0; return; }
    loadSong((cur - 1 + songs.length) % songs.length);
    playCurrent();
    showToast('Now Playing', songs[cur].title);
}

function seekTrack(event) {
    const rect = event.currentTarget.getBoundingClientRect();
    if (audio.duration) audio.currentTime = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1) * audio.duration;
}

function updateVolumeIcon() {
    const off = audio.muted || audio.volume === 0;
    $('volume-icon').className = 'fa-solid text-sm ' + (off ? 'fa-volume-xmark' : audio.volume < 0.5 ? 'fa-volume-low' : 'fa-volume-high');
}
function changeVolume(val) { audio.volume = +val; audio.muted = false; updateVolumeIcon(); }
function toggleMute() { audio.muted = !audio.muted; updateVolumeIcon(); }

function setToggle(selector, on) {
    document.querySelectorAll(selector).forEach(b => {
        b.classList.toggle('text-purple-400', on);
        b.classList.toggle('text-gray-400', !on);
        b.setAttribute('aria-pressed', on);
    });
}
function toggleShuffle() { isShuffle = !isShuffle; setToggle('.js-shuffle', isShuffle); showToast('Shuffle', isShuffle ? 'Enabled' : 'Disabled'); }
function toggleRepeat() { isRepeat = !isRepeat; audio.loop = isRepeat; setToggle('.js-repeat', isRepeat); showToast('Repeat', isRepeat ? 'Enabled' : 'Disabled'); }

function renderGrid() {
    $('made-for-you-grid').innerHTML = songs.map((song, idx) => song.album === 'Audius' ? '' : `
        <div onclick="selectSong(${idx})" class="glass-card p-3.5 rounded-2xl cursor-pointer group hover:bg-panelHover transition-all duration-300">
            <div class="relative w-full aspect-square rounded-xl overflow-hidden mb-3 shadow-lg">
                <img src="${song.img}" alt="${song.title}" loading="lazy" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
                <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div class="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg"><i class="fa-solid fa-play ml-0.5 text-sm"></i></div>
                </div>
            </div>
            <h4 class="font-bold text-sm text-white truncate">${song.title}</h4>
            <p class="text-xs text-gray-400 truncate mt-0.5">${song.artist}</p>
        </div>`).join('');
}

function switchNav(tab, e) {
    if (e) e.preventDefault();
    view = tab;
    ['home', 'search', 'library'].forEach(t => $(t + '-view').classList.toggle('hidden', t !== tab));
    document.querySelectorAll('[data-nav]').forEach(a => {
        const on = a.dataset.nav === tab;
        ['bg-purple-900/40', 'text-white', 'border-purple-500/30', 'shadow-lg'].forEach(c => a.classList.toggle(c, on));
        ['text-gray-400', 'border-transparent'].forEach(c => a.classList.toggle(c, !on));
        const icon = a.querySelector('i');
        icon.classList.toggle('text-purple-400', on);
        icon.classList.toggle('text-gray-400', !on);
    });
    if (tab === 'library') renderLibrary();
    if (tab === 'search') handleSearch($('global-search').value, true);
}

function renderLibrary() {
    const liked = songs.map((s, i) => ({ s, i })).filter(x => x.s.liked);
    $('library-list').innerHTML = liked.length ? liked.map(({ s, i }) => `
        <div onclick="selectSong(${i})" class="flex items-center justify-between p-3 rounded-2xl glass-card cursor-pointer hover:bg-panelHover transition-all">
            <div class="flex items-center gap-4 min-w-0">
                <img src="${s.img}" alt="${s.title}" class="w-12 h-12 rounded-xl object-cover shrink-0">
                <div class="min-w-0">
                    <h4 class="text-sm font-bold text-white truncate">${s.title}</h4>
                    <p class="text-xs text-gray-400 truncate">${s.artist}</p>
                </div>
            </div>
            <i class="fa-solid fa-heart text-purple-500 ml-3"></i>
        </div>`).join('') : '<p class="text-sm text-gray-400">No liked songs yet. Tap the heart on any track.</p>';
}

function handleSearch(query, stay) {
    const q = query.trim().toLowerCase();
    if (!q) { if (!stay) switchNav('home'); else $('search-results-container').innerHTML = '<p class="text-sm text-gray-400">Type something to search.</p>'; return; }
    if (view !== 'search') { switchNav('search'); }
    const results = songs.map((s, i) => ({ s, i })).filter(({ s }) => [s.title, s.artist, s.album].some(f => f.toLowerCase().includes(q)));
    $('search-results-container').innerHTML = results.length ? results.map(({ s, i }) => `
        <div onclick="selectSong(${i})" class="flex items-center justify-between p-3 rounded-xl glass-card cursor-pointer hover:bg-panelHover transition-all">
            <span class="text-white font-medium truncate">${s.title} - ${s.artist}</span>
            <span class="text-purple-400 text-xs shrink-0 ml-3">Play Stream</span>
        </div>`).join('') : '<p class="text-sm text-gray-400">No results found.</p>';
}

const closeBtn = '<button onclick="closeModal()" aria-label="Close" class="text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>';

function closeModal() {
    const b = $('modal-backdrop');
    b.classList.add('hidden');
    b.classList.remove('flex');
}

function showToast(title, desc) {
    const t = $('toast');
    $('toast-title').innerText = title;
    $('toast-desc').innerText = desc;
    t.classList.remove('translate-x-[120%]', 'opacity-0');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.add('translate-x-[120%]', 'opacity-0'), 3000);
}

/* ========== ACCOUNTS, PLAYLISTS, UPLOADS (talk to server.js) ========== */
let user = null;

async function api(path, method = 'GET', body) {
    const r = await fetch('/api' + path, {
        method, credentials: 'same-origin',
        headers: body ? { 'Content-Type': 'application/json' } : {},
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || 'Request failed');
    return data;
}

function applyUser(u) {
    user = u;
    songs.forEach(s => s.liked = !!u && u.likes.includes(s.id));
    const name = u ? u.username : 'Guest';
    $('sb-username').textContent = name;
    $('sb-avatar').textContent = $('hd-avatar').textContent = name[0].toUpperCase();
    updateNowPlaying();
    renderLibrary();
    renderPlaylists();
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        const [t, me] = await Promise.all([api('/tracks'), api('/me')]);
        if (t.tracks.length) songs.splice(0, songs.length, ...t.tracks);
        user = me.user;
    } catch (e) {
        // No backend (for example on static hosting): still load the extra tracks from the static file
        try {
            const extra = await (await fetch('data/extra-tracks.json')).json();
            let nextId = songs.reduce((a, s) => Math.max(a, s.id), 0);
            extra.forEach(t => songs.push({ ...t, id: ++nextId, liked: false }));
        } catch (_) {}
        showToast('Guest mode', 'Accounts and uploads need the Node server');
    }
    renderGrid();
    if (audio.paused) loadSong(0);
    applyUser(user);
});

async function toggleLikeActiveSong() {
    if (!user) return openModal('auth', null, 'login');
    if (String(songs[cur].id).startsWith('a_')) return showToast('Likes', 'Likes work only for tracks hosted on Nurgulify');
    try {
        const r = await api('/likes/' + songs[cur].id, 'POST');
        user.likes = r.likes;
        applyUser(user);
        showToast('Library', songs[cur].liked ? 'Added to Liked Songs' : 'Removed from Liked Songs');
    } catch (e) { showToast('Error', e.message); }
}

function renderPlaylists() {
    const box = $('playlist-list');
    box.innerHTML = '';
    (user ? user.playlists : []).forEach(p => {
        const a = document.createElement('a');
        a.href = '#';
        a.className = 'flex items-center gap-4 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-panelHover transition-all';
        a.innerHTML = '<i class="fa-solid fa-music w-5 text-xs text-purple-400"></i><span class="truncate"></span>';
        a.lastChild.textContent = p.name;
        a.onclick = e => openModal('playlist', e, p.id);
        box.appendChild(a);
    });
}

async function submitAuth(mode) {
    const username = $('auth-user').value.trim(), password = $('auth-pass').value;
    try {
        const r = await api('/' + mode, 'POST', { username, password });
        applyUser(r.user);
        closeModal();
        showToast(mode === 'register' ? 'Welcome!' : 'Logged in', r.user.username);
    } catch (e) { $('auth-err').textContent = e.message; }
}

async function logout() {
    try { await api('/logout', 'POST'); } catch (e) {}
    applyUser(null);
    closeModal();
    showToast('Logged out', 'See you soon');
}

async function createPlaylist() {
    const name = $('playlist-name').value.trim();
    if (!name) return $('playlist-name').focus();
    try {
        user.playlists = (await api('/playlists', 'POST', { name })).playlists;
        renderPlaylists();
        closeModal();
        showToast('Playlist created', name);
    } catch (e) { showToast('Error', e.message); }
}

async function addToPlaylist(pid) {
    try {
        user.playlists = (await api(`/playlists/${pid}/tracks`, 'POST', { trackId: songs[cur].id })).playlists;
        closeModal();
        showToast('Added to playlist', songs[cur].title);
    } catch (e) { showToast('Error', e.message); }
}

async function uploadTrack() {
    const file = $('up-file').files[0], err = $('up-err');
    if (!file) { err.textContent = 'Choose an MP3 file'; return; }
    if (file.size > 25 * 1024 * 1024) { err.textContent = 'File is too large (max 25 MB)'; return; }
    err.textContent = 'Uploading...';
    try {
        const r = await fetch('/api/tracks', {
            method: 'POST', credentials: 'same-origin', body: file,
            headers: { 'Content-Type': file.type || 'audio/mpeg', 'X-Title': encodeURIComponent($('up-title').value), 'X-Artist': encodeURIComponent($('up-artist').value) }
        });
        const data = await r.json();
        if (!r.ok) throw new Error(data.error);
        data.track.liked = false;
        songs.push(data.track);
        renderGrid();
        closeModal();
        showToast('Track uploaded', data.track.title);
    } catch (e) { err.textContent = e.message; }
}

const inp = 'w-full bg-darkBg border border-borderPurple rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-purple-500';
const btn = 'w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl';
const btn2 = 'w-full py-3 border border-purple-500/40 text-purple-300 font-bold rounded-xl hover:bg-panelHover';
const head = t => `<div class="flex justify-between"><h3 class="text-lg font-bold text-white">${t}</h3>${closeBtn}</div>`;

function openModal(type, e, arg) {
    if (e) e.preventDefault();
    if (!user && ['upload', 'addto', 'create-playlist', 'playlist'].includes(type)) { type = 'auth'; arg = 'login'; }
    const mode = arg === 'register' ? 'register' : 'login';
    const pl = user && user.playlists.find(p => p.id === arg);
    const modals = {
        premium: `<div class="text-center space-y-4"><h3 class="text-2xl font-bold text-white">Nurgulify Premium</h3><p class="text-sm text-gray-300">Enjoy 100% ad-free high fidelity streaming.</p><button onclick="closeModal()" class="${btn}">Got It</button></div>`,
        lyrics: lyricsHtml(),
        queue: `<div class="space-y-4">${head('Queue')}<div class="space-y-2 max-h-80 overflow-y-auto">${songs.map((s, i) => `<div onclick="selectSong(${i});closeModal();" class="p-2.5 rounded-xl hover:bg-panelHover cursor-pointer text-xs ${i === cur ? 'text-purple-400 font-bold' : 'text-white'}">${s.title}</div>`).join('')}</div></div>`,
        auth: `<div class="space-y-4">${head(mode === 'register' ? 'Create account' : 'Log in')}
            <input id="auth-user" maxlength="20" placeholder="Username" autocomplete="username" class="${inp}">
            <input id="auth-pass" type="password" placeholder="Password (min 6 characters)" autocomplete="${mode === 'register' ? 'new-password' : 'current-password'}" onkeydown="if(event.key==='Enter')submitAuth('${mode}')" class="${inp}">
            <p id="auth-err" class="text-xs text-red-400 min-h-[1rem]"></p>
            <button onclick="submitAuth('${mode}')" class="${btn}">${mode === 'register' ? 'Sign up' : 'Log in'}</button>
            <p class="text-xs text-gray-400 text-center">${mode === 'register' ? 'Already have an account?' : 'New here?'} <a href="#" onclick="openModal('auth',event,'${mode === 'register' ? 'login' : 'register'}')" class="text-purple-400 font-semibold">${mode === 'register' ? 'Log in' : 'Sign up'}</a></p></div>`,
        profile: user
            ? `<div class="text-center space-y-4"><h3 class="text-xl font-bold text-white">${user.username}</h3><p class="text-xs text-gray-400">${user.likes.length} liked songs · ${user.playlists.length} playlists</p><button onclick="openModal('upload')" class="${btn}">Upload a track</button><button onclick="logout()" class="${btn2}">Log out</button></div>`
            : `<div class="text-center space-y-4"><h3 class="text-xl font-bold text-white">Guest</h3><p class="text-xs text-gray-400">Log in to save likes, playlists and upload music</p><button onclick="openModal('auth',null,'login')" class="${btn}">Log in</button><button onclick="openModal('auth',null,'register')" class="${btn2}">Sign up</button></div>`,
        upload: `<div class="space-y-4">${head('Upload a track')}
            <input id="up-title" maxlength="60" placeholder="Title" class="${inp}">
            <input id="up-artist" maxlength="60" placeholder="Artist (optional)" class="${inp}">
            <input id="up-file" type="file" accept="audio/mpeg,.mp3" class="${inp}">
            <p id="up-err" class="text-xs text-gray-400 min-h-[1rem]">MP3 only, up to 25 MB. Visible to everyone.</p>
            <button onclick="uploadTrack()" class="${btn}">Upload</button></div>`,
        'create-playlist': `<div class="space-y-4">${head('Create Playlist')}<input id="playlist-name" maxlength="40" placeholder="Playlist name" onkeydown="if(event.key==='Enter')createPlaylist()" class="${inp}"><button onclick="createPlaylist()" class="${btn}">Create</button></div>`,
        addto: `<div class="space-y-4">${head('Add to playlist')}<div class="space-y-2">${user && user.playlists.length
            ? user.playlists.map(p => `<div onclick="addToPlaylist('${p.id}')" class="p-2.5 rounded-xl hover:bg-panelHover cursor-pointer text-white text-sm">${p.name}</div>`).join('')
            : '<p class="text-sm text-gray-400">No playlists yet. Create one from the sidebar.</p>'}</div></div>`,
        playlist: pl ? `<div class="space-y-4">${head(pl.name)}<div class="space-y-2 max-h-80 overflow-y-auto">${pl.tracks.length
            ? pl.tracks.map(id => ({ s: songs.find(x => x.id === id), i: songs.findIndex(x => x.id === id) })).filter(x => x.s)
                .map(({ s, i }) => `<div onclick="selectSong(${i});closeModal();" class="p-2.5 rounded-xl hover:bg-panelHover cursor-pointer text-white text-sm">${s.title} <span class="text-gray-400 text-xs">· ${s.artist}</span></div>`).join('')
            : '<p class="text-sm text-gray-400">This playlist is empty. Use the folder button in the player to add the current song.</p>'}</div></div>` : ''
    };
    $('modal-content').innerHTML = modals[type] || modals.profile;
    const b = $('modal-backdrop');
    b.classList.remove('hidden');
    b.classList.add('flex');
    $('modal-content').querySelector('input')?.focus();
}

/* ========== SPOTIFY EMBEDS (links come from data/embeds.json) ========== */
async function getEmbeds() {
    try { return (await api('/embeds')).embeds; } catch (e) {}
    // No backend: read the links straight from the static file
    const links = (await (await fetch('data/embeds.json')).json()).links || [];
    return links.map(l => /^https:\/\/open\.spotify\.com\/(?:intl-\w+\/)?(artist|album|track|playlist)\/([A-Za-z0-9]+)/.exec(String(l)))
        .filter(Boolean).map(m => ({ type: m[1], id: m[2] }));
}
document.addEventListener('DOMContentLoaded', async () => {
    try {
        const embeds = await getEmbeds();
        if (!embeds.length) return;
        $('embed-section').classList.remove('hidden');
        $('embed-grid').innerHTML = embeds.map(e => `<iframe title="Spotify player" src="https://open.spotify.com/embed/${e.type}/${e.id}?theme=0" width="100%" height="${e.type === 'track' ? 152 : 352}" frameborder="0" allow="encrypted-media; clipboard-write" loading="lazy" class="rounded-2xl"></iframe>`).join('');
    } catch (e) {}
});

/* ========== AUDIUS (open music network): trending + search, artists are credited ========== */
const AUDIUS = 'https://api.audius.co/v1';   // if it ever fails, try https://discoveryprovider.audius.co/v1
const AUDIUS_APP = 'Nurgulify';
const AUDIUS_KEY = '';                       // optional: paste your free Audius API key/bearer token here
const A_FALLBACK_IMG = 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?auto=format&fit=crop&w=600&q=80';
const aLists = { feed: [], search: [] };

const safe = (s, n = 80) => String(s || '').replace(/[<>&"'`\\]/g, '').trim().slice(0, n);

async function aFetch(path) {
    const url = `${AUDIUS}${path}${path.includes('?') ? '&' : '?'}app_name=${AUDIUS_APP}`;
    const r = await fetch(url, AUDIUS_KEY ? { headers: { Authorization: 'Bearer ' + AUDIUS_KEY } } : {});
    if (!r.ok) throw new Error('Audius ' + r.status);
    return (await r.json()).data || [];
}

function aImg(t) {
    const u = t.artwork && (t.artwork['480x480'] || t.artwork['150x150'] || t.artwork['1000x1000']);
    return /^https:\/\/[^\s"'<>]+$/.test(u || '') ? u : A_FALLBACK_IMG;
}

function fromAudius(t) {
    const title = safe(t.title) || 'Untitled', artist = safe(t.user && t.user.name) || 'Unknown artist';
    const link = 'https://audius.co' + (String(t.permalink || '').startsWith('/') ? safe(t.permalink, 200) : '');
    return {
        id: 'a_' + safe(t.id, 20), title, artist, album: 'Audius',
        duration: t.duration ? formatTime(t.duration) : '0:00',
        url: `${AUDIUS}/tracks/${encodeURIComponent(t.id)}/stream?app_name=${AUDIUS_APP}`,
        img: aImg(t), liked: false,
        credit: `"${title}" by ${artist}, streamed from Audius (${link})`
    };
}


const streamable = t => t && t.id && t.is_streamable !== false;

// Extend search: local tracks first, then results from Audius
let aTimer;
const localSearch = handleSearch;
handleSearch = function (query, stay) {
    localSearch(query, stay);
    clearTimeout(aTimer);
    const q = query.trim(), box = $('audius-search');
    if (q.length < 2) { box.innerHTML = ''; return; }
    aTimer = setTimeout(async () => {
        try {
            aLists.search = (await aFetch('/tracks/search?limit=12&query=' + encodeURIComponent(q))).filter(streamable);
            box.innerHTML = aLists.search.length ? '<h3 class="text-lg font-bold text-white pt-4">From Audius</h3>' + aLists.search.map((t, i) => `
                <div onclick="playAudius('search',${i})" class="flex items-center gap-3 p-3 rounded-xl glass-card cursor-pointer hover:bg-panelHover transition-all">
                    <img src="${aImg(t)}" alt="" loading="lazy" class="w-10 h-10 rounded-lg object-cover shrink-0">
                    <span class="text-white font-medium truncate">${safe(t.title)} - ${safe(t.user && t.user.name)}</span>
                    <span class="text-purple-400 text-xs shrink-0 ml-auto">Audius</span>
                </div>`).join('') : '';
        } catch (e) { box.innerHTML = ''; }
    }, 400);
};

/* ========== AUDIUS FEED: genre chips + "Load more" (merged under the main grid) ========== */
const A_PAGE = 24;
const A_CHIPS = [['Trending', ''], ['Lofi', 'lofi'], ['Synthwave', 'synthwave'], ['Ambient', 'ambient'], ['Chill', 'chill'], ['Electronic', 'electronic'], ['Pop', 'pop'], ['Hip-Hop', 'hip hop']];
const aState = { q: '', offset: 0 };

function playAudius(list, i) {
    const arr = aLists[list];
    if (!arr || !arr[i]) return;
    const target = fromAudius(arr[i]);
    // Add the whole loaded list to the queue so next/previous keep going through it
    arr.forEach(t => { const s = fromAudius(t); if (!songs.some(x => x.id === s.id)) songs.push(s); });
    selectSong(songs.findIndex(x => x.id === target.id));
}

function aCard(t, i) {
    return `<div onclick="playAudius('feed',${i})" class="glass-card p-3.5 rounded-2xl cursor-pointer group hover:bg-panelHover transition-all duration-300">
        <div class="relative w-full aspect-square rounded-xl overflow-hidden mb-3 shadow-lg">
            <img src="${aImg(t)}" alt="${safe(t.title)}" loading="lazy" class="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500">
            <div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <div class="w-10 h-10 rounded-full bg-purple-600 text-white flex items-center justify-center shadow-lg"><i class="fa-solid fa-play ml-0.5 text-sm"></i></div>
            </div>
        </div>
        <h4 class="font-bold text-sm text-white truncate">${safe(t.title)}</h4>
        <p class="text-xs text-gray-400 truncate mt-0.5">${safe(t.user && t.user.name)}</p>
    </div>`;
}

function renderChips() {
    $('audius-chips').innerHTML = A_CHIPS.map(([label, q]) => `<button onclick="setAudiusChip('${q}')" class="px-4 py-1.5 rounded-full text-xs font-semibold border transition-all ${aState.q === q ? 'bg-purple-600 border-purple-500 text-white' : 'bg-panelBg border-borderPurple text-gray-300 hover:border-purple-500'}">${label}</button>`).join('');
}

function setAudiusChip(q) { aState.q = q; renderChips(); loadAudiusFeed(true); }

async function loadAudiusFeed(reset) {
    const more = $('audius-more');
    if (reset) { aState.offset = 0; aLists.feed = []; $('audius-grid').innerHTML = ''; }
    more.disabled = true;
    try {
        const path = aState.q ? `/tracks/search?query=${encodeURIComponent(aState.q)}&` : '/tracks/trending?';
        const data = (await aFetch(`${path}limit=${A_PAGE}&offset=${aState.offset}`)).filter(streamable);
        const fresh = data.filter(t => !aLists.feed.some(x => x.id === t.id));
        const start = aLists.feed.length;
        aLists.feed.push(...fresh);
        $('audius-grid').insertAdjacentHTML('beforeend', fresh.map((t, k) => aCard(t, start + k)).join(''));
        aState.offset += A_PAGE;
        more.classList.toggle('hidden', data.length === 0 || aLists.feed.length >= 120);
        if (aLists.feed.length) { $('audius-section').classList.remove('hidden'); renderChips(); }
    } catch (e) { /* Audius unreachable: the section stays hidden */ }
    more.disabled = false;
}
document.addEventListener('DOMContentLoaded', () => loadAudiusFeed(true));

/* ========== LYRICS (Spotify-style, synced) + FAST START ========== */
// A track can have a `lyrics` field: LRC text like "[00:12.50]first line". Plain text also works.
let lyrLines = [], lyrSong = null, lyrActive = -1;

function parseLrc(text) {
    const out = [];
    String(text || '').split('\n').forEach(l => {
        const m = /^\[(\d+):(\d+(?:\.\d+)?)\](.*)$/.exec(l.trim());
        if (m) out.push({ t: +m[1] * 60 + +m[2], s: safe(m[3], 200) });
    });
    return out;
}
function seekTo(t) { audio.currentTime = t; }

function lyricsHtml() {
    const s = songs[cur];
    lyrLines = parseLrc(s.lyrics); lyrSong = s.id; lyrActive = -1;
    let body;
    if (lyrLines.length) {
        body = `<div id="lyr-box" class="relative max-h-80 overflow-y-auto space-y-4 py-6 text-center">${lyrLines.map((l, i) =>
            `<p data-i="${i}" onclick="seekTo(${l.t})" class="lyr-line cursor-pointer text-xl font-bold text-gray-500 hover:text-gray-300 transition-all">${l.s || '♪'}</p>`).join('')}</div>`;
    } else if (s.lyrics) {
        body = `<div class="max-h-80 overflow-y-auto space-y-2 py-4 text-center text-gray-200">${String(s.lyrics).split('\n').map(l => `<p>${safe(l, 200) || '&nbsp;'}</p>`).join('')}</div>`;
    } else {
        body = `<div class="text-center py-6 text-purple-300 space-y-2"><p class="text-lg font-bold">♪ No lyrics for this track ♪</p><p class="text-xs text-gray-400">${s.credit || ''}</p></div>`;
    }
    return `<div class="space-y-4">${head(safe(s.title) + ' · Lyrics')}${body}</div>`;
}

audio.addEventListener('timeupdate', () => {
    const box = $('lyr-box');
    if (!box || !lyrLines.length || songs[cur].id !== lyrSong) return;
    let a = -1;
    for (let i = 0; i < lyrLines.length && lyrLines[i].t <= audio.currentTime + 0.25; i++) a = i;
    if (a === lyrActive) return;
    lyrActive = a;
    box.querySelectorAll('.lyr-line').forEach((p, i) => {
        const on = i === a;
        p.classList.toggle('text-white', on); p.classList.toggle('text-2xl', on); p.classList.toggle('text-gray-500', !on);
    });
    const p = box.querySelector(`[data-i="${a}"]`);
    if (p) box.scrollTo({ top: p.offsetTop - box.clientHeight / 2 + p.clientHeight / 2, behavior: 'smooth' });
});

// Fast start: while a track plays, fetch the beginning of the next one so it starts almost instantly
const warmup = new Audio();
warmup.preload = 'auto';
audio.addEventListener('playing', () => {
    if (isShuffle || songs.length < 2) return;
    const next = songs[(cur + 1) % songs.length];
    if (warmup.src !== next.url) { warmup.src = next.url; warmup.load(); }
});
