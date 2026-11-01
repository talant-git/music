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

// Restore liked songs between visits
try {
    const saved = JSON.parse(localStorage.getItem('nurgulify-liked') || 'null');
    if (Array.isArray(saved)) songs.forEach(s => s.liked = saved.includes(s.id));
} catch (e) {}

const $ = id => document.getElementById(id);
const audio = $('audio-element');
const playlists = [];
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
    setText(['footer-duration', 'sidebar-duration'], song.duration);
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

function toggleLikeActiveSong() {
    const s = songs[cur];
    s.liked = !s.liked;
    try { localStorage.setItem('nurgulify-liked', JSON.stringify(songs.filter(x => x.liked).map(x => x.id))); } catch (e) {}
    updateNowPlaying();
    if (view === 'library') renderLibrary();
    showToast('Library', s.liked ? 'Added to Liked Songs' : 'Removed from Liked Songs');
}

function renderGrid() {
    $('made-for-you-grid').innerHTML = songs.map((song, idx) => `
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

function renderPlaylists() {
    $('playlist-list').innerHTML = playlists.map(name => `
        <a href="#" onclick="event.preventDefault();showToast('${name.replace(/['"\\<>&]/g, '')}','This playlist is empty')" class="flex items-center gap-4 px-4 py-2.5 rounded-xl text-sm text-gray-400 hover:text-white hover:bg-panelHover transition-all">
            <i class="fa-solid fa-music w-5 text-xs text-purple-400"></i><span class="truncate"></span>
        </a>`).join('');
    $('playlist-list').querySelectorAll('span').forEach((el, i) => el.textContent = playlists[i]);
}

function createPlaylist() {
    const name = $('playlist-name').value.trim();
    if (!name) { $('playlist-name').focus(); return; }
    playlists.push(name);
    renderPlaylists();
    closeModal();
    showToast('Playlist created', name);
}

const closeBtn = '<button onclick="closeModal()" aria-label="Close" class="text-gray-400 hover:text-white"><i class="fa-solid fa-xmark"></i></button>';

function openModal(type, e) {
    if (e) e.preventDefault();
    const modals = {
        premium: `<div class="text-center space-y-4"><h3 class="text-2xl font-bold text-white">Nurgulify Premium</h3><p class="text-sm text-gray-300">Enjoy 100% ad-free high fidelity streaming.</p><button onclick="closeModal()" class="w-full py-3 bg-purple-600 text-white font-bold rounded-xl">Got It</button></div>`,
        lyrics: `<div class="space-y-4"><div class="flex justify-between"><h3 class="text-lg font-bold text-white">Live Stream Lyrics</h3>${closeBtn}</div><div class="text-center py-6 text-purple-300 font-medium space-y-3"><p class="text-lg font-bold">♪ Instrumental Audio Stream ♪</p><p>Enjoying the soundscape...</p></div></div>`,
        queue: `<div class="space-y-4"><div class="flex justify-between"><h3 class="text-lg font-bold text-white">Queue</h3>${closeBtn}</div><div class="space-y-2">${songs.map((s, i) => `<div onclick="selectSong(${i});closeModal();" class="p-2.5 rounded-xl hover:bg-panelHover cursor-pointer text-xs ${i === cur ? 'text-purple-400 font-bold' : 'text-white'}">${s.title}</div>`).join('')}</div></div>`,
        'create-playlist': `<div class="space-y-4"><div class="flex justify-between"><h3 class="text-lg font-bold text-white">Create Playlist</h3>${closeBtn}</div><input id="playlist-name" maxlength="40" placeholder="Playlist name" onkeydown="if(event.key==='Enter')createPlaylist()" class="w-full bg-darkBg border border-borderPurple rounded-xl px-4 py-2.5 text-sm text-gray-200 focus:outline-none focus:border-purple-500"><button onclick="createPlaylist()" class="w-full py-3 bg-purple-600 text-white font-bold rounded-xl">Create</button></div>`,
        profile: `<div class="text-center space-y-4"><h3 class="text-xl font-bold text-white">nurxan_17</h3><p class="text-xs text-gray-400">Connected to Nurgulify Cloud</p><button onclick="closeModal()" class="w-full py-2 bg-purple-600 text-white rounded-xl text-xs">Close</button></div>`
    };
    $('modal-content').innerHTML = modals[type] || modals.profile;
    const b = $('modal-backdrop');
    b.classList.remove('hidden');
    b.classList.add('flex');
    $('playlist-name')?.focus();
}

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
