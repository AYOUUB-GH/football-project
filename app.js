// ===================================================================
//  JUSTPLAY – Football Match Organizer
//  app.js – Core application logic with MongoDB API integration
// ===================================================================

const API_BASE = window.location.origin + '/api';

// ==================== DATA (loaded from API) ====================

let stadiums = [];
let matches = [];
let currentUser = null;
let users = [];
let selectedAvatarDataUrl = null;
let loginAvatarDataUrl = null;

// ==================== LOCAL STORAGE HELPERS ====================

function getSavedUser() {
  const saved = localStorage.getItem('justplay_currentUser');
  if (saved) {
    try {
      return JSON.parse(saved);
    } catch (e) {
      return null;
    }
  }
  return null;
}

function saveCurrentUser(user) {
  if (user) {
    localStorage.setItem('justplay_currentUser', JSON.stringify(user));
  } else {
    localStorage.removeItem('justplay_currentUser');
  }
}

function clearCurrentUser() {
  localStorage.removeItem('justplay_currentUser');
}

function logout() {
  if (confirm('Are you sure you want to log out?')) {
    clearCurrentUser();
    // Redirect to the landing page (marketing page)
    window.location.href = 'index.html';
  }
}

const playerNames = [
  "Ahmed K.", "Youssef A.", "Omar B.", "Khalid M.", "Ali R.",
  "Hassan S.", "Samir L.", "Nabil F.", "Karim D.", "Mehdi T.",
  "Rami H.", "Amine Z.", "Bilal J.", "Walid N.", "Fares G.",
  "Rachid Q.", "Sofiane P.", "Mourad E.", "Tarek W.", "Ziad V."
];

// ==================== API HELPERS ====================

async function apiGet(endpoint) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`GET ${endpoint} failed:`, err);
    return null;
  }
}

async function apiPost(endpoint, data) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      let errText = `API error: ${res.status}`;
      try {
        const errData = await res.json();
        errText = errData.error || errData.message || errText;
      } catch (e) {
        // ignore JSON parse errors
      }
      throw new Error(errText);
    }
    return await res.json();
  } catch (err) {
    console.error(`POST ${endpoint} failed:`, err);
    return { error: err.message };
  }
}

async function apiPut(endpoint, data) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) {
      let errText = `API error: ${res.status}`;
      try {
        const errData = await res.json();
        errText = errData.error || errData.message || errText;
      } catch (e) {}
      throw new Error(errText);
    }
    return await res.json();
  } catch (err) {
    console.error(`PUT ${endpoint} failed:`, err);
    return { error: err.message };
  }
}

async function apiDelete(endpoint) {
  try {
    const res = await fetch(`${API_BASE}${endpoint}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error(`DELETE ${endpoint} failed:`, err);
    return null;
  }
}

// ==================== DATA LOADING ====================

async function loadStadiums() {
  const data = await apiGet('/stadiums');
  if (data) {
    stadiums = data;
  }
  return stadiums;
}

async function loadMatches() {
  const data = await apiGet('/matches');
  if (data) {
    // Normalize: the API returns populated stadiumId as an object
    matches = data.map(m => ({
      ...m,
      id: m._id,
      // Keep the populated stadium object for reference
      _stadium: m.stadiumId,
      // For backward compat, store the stadium id string
      stadiumId: m.stadiumId?._id || m.stadiumId
    }));
  }
  return matches;
}

// Load users from backend
async function loadUsers() {
  const data = await apiGet('/users');
  if (data && Array.isArray(data)) {
    users = data;
    // Try to restore saved user
    const savedUser = getSavedUser();
    if (savedUser && savedUser._id) {
      currentUser = users.find(u => u._id === savedUser._id) || null;
    } else {
      currentUser = null;
    }
  }
  return users;
}

function getStadiumById(id) {
  return stadiums.find(s => s._id === id || s.id === id);
}

function getMatchById(id) {
  return matches.find(m => m._id === id || m.id === id);
}

// ==================== STATE ====================

let currentPage = 'home';
let pageHistory = [];
let currentStadium = null;
let currentMatch = null;
let map = null;
let miniMaps = {};
let mapMarkers = [];
let currentMatchTab = 'all';

// ==================== NAVIGATION ====================

function navigateTo(page, pushHistory = true) {
  if (pushHistory && currentPage !== page) {
    pageHistory.push(currentPage);
  }

  currentPage = page;

  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  // Show target page
  const targetPage = document.getElementById(`page-${page}`);
  if (targetPage) {
    targetPage.classList.add('active');
  }

  // Update nav
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  // Show/hide bottom nav for detail pages
  // Always show bottom nav
  document.getElementById('bottom-nav').style.display = 'flex';

  // Initialize map if we're going to the map page
  if (page === 'map') {
    setTimeout(initMap, 100);
  }

  // Populate edit-profile form when navigating there
  if (page === 'edit-profile') {
    setTimeout(() => renderEditProfile(), 50);
  }

  // Scroll to top
  window.scrollTo(0, 0);
}

function goBack() {
  if (pageHistory.length > 0) {
    const prev = pageHistory.pop();
    navigateTo(prev, false);
  } else {
    navigateTo('home', false);
  }
}

function showSection(section) {
  pageHistory.push(currentPage);
  navigateTo(section);
}

// ==================== MAP ====================

function initMap() {
  if (map) {
    map.invalidateSize();
    return;
  }

  map = L.map('map', {
    zoomControl: false,
    attributionControl: false
  }).setView([36.0700, 4.7650], 13);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);

  // Custom green marker icon
  const greenIcon = L.divIcon({
    className: '',
    html: `<div style="
      width: 36px; height: 36px;
      background: linear-gradient(135deg, #059669, #10b981);
      border-radius: 50% 50% 50% 0;
      transform: rotate(-45deg);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.29);
      border: 2px solid white;
    "><span style="transform: rotate(45deg); font-size: 16px;">⚽</span></div>`,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36]
  });

  stadiums.forEach(stadium => {
    const marker = L.marker([stadium.lat, stadium.lng], { icon: greenIcon })
      .addTo(map)
      .bindPopup(`
        <div style="min-width: 180px;">
          <div class="popup-title">${stadium.name}</div>
          <div class="popup-info">📍 ${stadium.address}</div>
          <div class="popup-info">⏰ ${stadium.slots.length} time slots available</div>
          <div class="popup-price">${stadium.price} DA/hr</div>
          <div class="popup-btn" onclick="openStadiumDetail('${stadium._id}')">View Details</div>
        </div>
      `);

    mapMarkers.push({ marker, stadium });
  });
}

function initMiniMap(containerId, lat, lng, name) {
  if (miniMaps[containerId]) {
    miniMaps[containerId].remove();
    delete miniMaps[containerId];
  }

  const miniMap = L.map(containerId, {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false
  }).setView([lat, lng], 15);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    maxZoom: 19
  }).addTo(miniMap);

  const icon = L.divIcon({
    className: '',
    html: `<div style="
      width: 28px; height: 28px;
      background: linear-gradient(135deg, #059669, #10b981);
      border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 0 12px rgba(16,185,129,0.3);
      border: 2px solid white;
    "><span style="font-size: 12px;">⚽</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 14]
  });

  L.marker([lat, lng], { icon }).addTo(miniMap);
  miniMaps[containerId] = miniMap;
}

function filterStadiums(query) {
  const filtered = stadiums.filter(s =>
    s.name.toLowerCase().includes(query.toLowerCase()) ||
    s.address.toLowerCase().includes(query.toLowerCase())
  );
  renderStadiumList(filtered);
}

// ==================== RENDERERS ====================

function renderFeaturedStadiums() {
  const container = document.getElementById('featured-stadiums');
  container.innerHTML = stadiums.slice(0, 4).map(s => `
    <div class="stadium-card" onclick="openStadiumDetail('${s._id}')">
      <img class="stadium-card-img" src="${s.image}" alt="${s.name}" loading="lazy">
      <div class="stadium-card-body">
        <div class="stadium-card-name">${s.name}</div>
        <div class="stadium-card-location">📍 ${s.address}</div>
        <div class="stadium-card-footer">
          <div class="stadium-price">${s.price} DA<span>/hr</span></div>
          <div class="stadium-rating">⭐ ${s.rating}</div>
        </div>
      </div>
    </div>
  `).join('');
}

function renderHomeMatches() {
  const container = document.getElementById('home-matches');
  const upcomingMatches = matches.filter(m => m.status !== 'past').slice(0, 3);
  container.innerHTML = upcomingMatches.map(m => renderMatchCard(m)).join('');
}

function renderMatchCard(m) {
  const stadium = getStadiumById(m.stadiumId) || m._stadium;
  const dateStr = formatDate(m.date);
  const spotsLeft = m.maxPlayers - m.players.length;

  const avatars = m.players.slice(0, 3).map((name) => {
    const initials = name.split(' ').map(n => n[0]).join('');
    return `<div class="player-avatar">${initials}</div>`;
  }).join('');

  const moreCount = m.players.length > 3 ? m.players.length - 3 : 0;
  const matchId = m._id || m.id;

  return `
    <div class="match-card" onclick="openMatchDetail('${matchId}')">
      <div class="match-card-header">
        <div class="match-card-title">${m.title}</div>
        <span class="match-status ${m.status}">${m.status === 'open' ? `${spotsLeft} spots` : m.status === 'full' ? 'Full' : 'Soon'}</span>
      </div>
      <div class="match-card-info">
        <div class="match-info-item">
          <span class="match-info-icon">🏟️</span>
          ${stadium ? stadium.name : 'Unknown'}
        </div>
        <div class="match-info-item">
          <span class="match-info-icon">📅</span>
          ${dateStr}
        </div>
        <div class="match-info-item">
          <span class="match-info-icon">⏰</span>
          ${m.time}
        </div>
        ${m.fee > 0 ? `<div class="match-info-item"><span class="match-info-icon">💰</span> ${m.fee} DA</div>` : ''}
      </div>
      <div class="match-card-footer">
        <div class="match-players">
          <div class="player-avatars">
            ${avatars}
            ${moreCount > 0 ? `<div class="player-avatar more">+${moreCount}</div>` : ''}
          </div>
          <span class="player-count">${m.players.length}/${m.maxPlayers}</span>
        </div>
        ${m.status === 'open' ? `<button type="button" class="btn btn-primary" onclick="event.stopPropagation(); joinMatchById('${matchId}')">Join</button>` : ''}
      </div>
    </div>
  `;
}

function renderMatchesList() {
  const container = document.getElementById('matches-list');
  let filtered = [...matches];

  if (currentMatchTab === 'open') {
    filtered = filtered.filter(m => m.status === 'open');
  } else if (currentMatchTab === 'my') {
    filtered = filtered.filter(m => m.players.includes(currentUser.name));
  } else if (currentMatchTab === 'past') {
    filtered = filtered.filter(m => new Date(m.date) < new Date('2026-02-14'));
  }

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚽</div>
        <div class="empty-state-title">No matches found</div>
        <div class="empty-state-desc">Try a different filter or create your own match!</div>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(m => renderMatchCard(m)).join('');
}

function renderStadiumList(list) {
  list = list || stadiums;
  const container = document.getElementById('stadium-list');
  container.innerHTML = list.map(s => `
    <div class="stadium-list-item" onclick="openStadiumDetail('${s._id}')">
      <img class="stadium-list-img" src="${s.image}" alt="${s.name}" loading="lazy">
      <div class="stadium-list-info">
        <div class="stadium-list-name">${s.name}</div>
        <div class="stadium-list-address">📍 ${s.address}</div>
        <div class="stadium-list-price">${s.price} DA/hr · ⭐ ${s.rating}</div>
      </div>
    </div>
  `).join('');
}

function renderOwnerStadiums() {
  const container = document.getElementById('owner-stadiums');
  if (!container) return;

  const owned = stadiums.filter(s => currentUser && s.ownerId && s.ownerId === currentUser._id);

  if (owned.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">🏟️</div>
        <div class="empty-state-title">No Stadiums Yet</div>
        <div class="empty-state-desc">You haven't added any stadiums. Click the "+ Add New" button to get started.</div>
      </div>
    `;
    return;
  }

  container.innerHTML = owned.map(s => `
    <div class="owner-stadium-card">
      <img class="owner-stadium-img" src="${s.image}" alt="${s.name}" loading="lazy">
      <div class="owner-stadium-body">
        <div class="owner-stadium-name">${s.name}</div>
        <div class="owner-stadium-status">✅ Active · ${s.price} DA/hr</div>
        <div class="owner-actions">
          <button type="button" class="btn btn-secondary" onclick="showToast('✏️', 'Edit mode coming soon!')">✏️ Edit</button>
          <button type="button" class="btn btn-secondary" onclick="showToast('📅', 'Slot manager coming soon!')">📅 Slots</button>
          <button type="button" class="btn btn-secondary" onclick="openStadiumDetail('${s._id}')">👁️ View</button>
        </div>
      </div>
    </div>
  `).join('');
}

// ==================== STADIUM DETAIL ====================

function openStadiumDetail(id) {
  currentStadium = getStadiumById(id);
  if (!currentStadium) return;

  document.getElementById('stadium-detail-img').src = currentStadium.image;
  document.getElementById('stadium-detail-img').alt = currentStadium.name || 'Stadium image';
  document.getElementById('stadium-detail-name').textContent = currentStadium.name;
  document.getElementById('stadium-address-text').textContent = currentStadium.address;
  document.getElementById('stadium-detail-price').textContent = `${currentStadium.price} DA`;
  document.getElementById('stadium-detail-rating').textContent = `⭐ ${currentStadium.rating}`;
  document.getElementById('stadium-detail-surface').textContent = currentStadium.surface;

  // Render time slots
  const slotsContainer = document.getElementById('stadium-time-slots');
  slotsContainer.innerHTML = currentStadium.slots.map(slot => {
    const isUnavailable = currentStadium.unavailableSlots.includes(slot);
    return `<div class="time-slot ${isUnavailable ? 'unavailable' : ''}" onclick="${isUnavailable ? '' : 'selectTimeSlot(this)'}">${slot}</div>`;
  }).join('');

  // Render amenities
  const amenitiesContainer = document.getElementById('stadium-amenities');
  amenitiesContainer.innerHTML = currentStadium.amenities.map(a =>
    `<div class="amenity-item"><span class="amenity-icon">${a.split(' ')[0]}</span>${a.split(' ').slice(1).join(' ')}</div>`
  ).join('');

  navigateTo('stadium-detail');

  // Init mini map
  setTimeout(() => {
    initMiniMap('stadium-mini-map', currentStadium.lat, currentStadium.lng, currentStadium.name);
  }, 300);
}

function selectTimeSlot(el) {
  document.querySelectorAll('#stadium-time-slots .time-slot').forEach(s => s.classList.remove('selected'));
  el.classList.add('selected');
}

async function bookStadium() {
  const selectedSlot = document.querySelector('#stadium-time-slots .time-slot.selected');
  if (!selectedSlot) {
    showToast('⚠️', 'Please select a time slot first!');
    return;
  }

  const time = selectedSlot.textContent;
  const result = await apiPost(`/stadiums/${currentStadium._id}/book`, { time });

  if (result && !result.error) {
    showToast('✅', `Booked ${currentStadium.name} at ${time}!`);
    // Update local data with the updated stadium from server
    currentStadium = result.stadium;
    // Refresh the UI to show the slot as unavailable (red)
    openStadiumDetail(currentStadium._id);
  } else {
    showToast('❌', result.error || 'Booking failed');
  }
}

function openStadiumFromMatch() {
  if (currentMatch) {
    const stadium = getStadiumById(currentMatch.stadiumId);
    if (stadium) openStadiumDetail(stadium._id);
  }
}

// ==================== PROFILE HELPERS ====================

function renderEditProfile() {
  if (!currentUser) return;
  document.getElementById('edit-name').value = currentUser.name || '';
  document.getElementById('edit-email').value = currentUser.email || '';
  document.getElementById('edit-phone').value = currentUser.phone || '';
  // select position if present
  const pos = currentUser.position || '';
  const select = document.getElementById('edit-position');
  if (select) {
    Array.from(select.options).forEach(opt => opt.selected = (opt.text === pos));
  }
  document.getElementById('edit-bio').value = currentUser.bio || '';
  // avatar preview
  const editAvatarEl = document.getElementById('edit-profile-avatar');
  if (editAvatarEl) {
    if (selectedAvatarDataUrl) {
      editAvatarEl.style.backgroundImage = `url(${selectedAvatarDataUrl})`;
      editAvatarEl.textContent = '';
      editAvatarEl.style.backgroundSize = 'cover';
      editAvatarEl.style.backgroundPosition = 'center';
      editAvatarEl.style.backgroundRepeat = 'no-repeat';
      editAvatarEl.style.backgroundColor = 'transparent';
    } else if (currentUser.avatar) {
      editAvatarEl.style.backgroundImage = `url(${currentUser.avatar})`;
      editAvatarEl.textContent = '';
      editAvatarEl.style.backgroundSize = 'cover';
      editAvatarEl.style.backgroundPosition = 'center';
      editAvatarEl.style.backgroundRepeat = 'no-repeat';
    } else {
      editAvatarEl.style.backgroundImage = '';
      editAvatarEl.textContent = (currentUser.name || '').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
      editAvatarEl.style.backgroundColor = '';
    }
  }
}

async function saveProfile() {
  const name = document.getElementById('edit-name').value.trim();
  const email = document.getElementById('edit-email').value.trim();
  const phone = document.getElementById('edit-phone').value.trim();
  const position = document.getElementById('edit-position').value;
  const bio = document.getElementById('edit-bio').value.trim();

  const payload = { name, email, phone, position, bio };
  // include avatar if changed
  if (selectedAvatarDataUrl) payload.avatar = selectedAvatarDataUrl;
  else if (currentUser && currentUser.avatar) payload.avatar = currentUser.avatar;

  // If currentUser has an _id, update existing user, otherwise create
  if (currentUser && currentUser._id) {
    const res = await apiPut(`/users/${currentUser._id}`, payload);
    if (res && !res.error) {
      currentUser = res;
      selectedAvatarDataUrl = null;
      showToast('✅', 'Profile updated');
      // reflect in UI (profile header)
      const avatar = document.getElementById('profile-avatar');
      if (avatar) {
        if (currentUser.avatar) {
          avatar.style.backgroundImage = `url(${currentUser.avatar})`;
          avatar.textContent = '';
          avatar.style.backgroundSize = 'cover';
          avatar.style.backgroundPosition = 'center';
        } else {
          avatar.style.backgroundImage = '';
          avatar.textContent = (currentUser.name || '').split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2);
        }
      }
      const pname = document.getElementById('profile-name');
      if (pname) pname.textContent = currentUser.name;
      // refresh users from API to ensure latest state
      await loadUsers();
      renderEditProfile();
    } else {
      const msg = (res && res.error) ? res.error : 'Failed to update profile';
      showToast('❌', msg);
    }
  } else {
    const res = await apiPost('/users', payload);
    if (res && !res.error) {
      currentUser = res;
      showToast('✅', 'Profile created');
      await loadUsers();
      renderEditProfile();
    } else {
      const msg = (res && res.error) ? res.error : 'Failed to create profile';
      showToast('❌', msg);
    }
  }
}

// ==================== MATCH DETAIL ====================

function openMatchDetail(id) {
  currentMatch = getMatchById(id);
  if (!currentMatch) return;

  const stadium = getStadiumById(currentMatch.stadiumId) || currentMatch._stadium;

  document.getElementById('match-detail-title').textContent = currentMatch.title;

  // Meta
  const metaContainer = document.getElementById('match-detail-meta');
  metaContainer.innerHTML = `
    <div class="meta-item"><span>📅</span> ${formatDate(currentMatch.date)}</div>
    <div class="meta-item"><span>⏰</span> ${currentMatch.time}</div>
    <div class="meta-item"><span>👥</span> ${currentMatch.players.length}/${currentMatch.maxPlayers}</div>
    ${currentMatch.fee > 0 ? `<div class="meta-item"><span>💰</span> ${currentMatch.fee} DA entry</div>` : '<div class="meta-item"><span>🆓</span> Free</div>'}
  `;

  // Stadium info
  if (stadium) {
    document.getElementById('match-stadium-info').innerHTML = `
      <img class="stadium-list-img" src="${stadium.image}" alt="${stadium.name}">
      <div class="stadium-list-info">
        <div class="stadium-list-name">${stadium.name}</div>
        <div class="stadium-list-address">📍 ${stadium.address}</div>
        <div class="stadium-list-price">${stadium.price} DA/hr · ⭐ ${stadium.rating}</div>
      </div>
    `;
  }

  // Rules
  const rulesContainer = document.getElementById('match-rules');
  rulesContainer.innerHTML = currentMatch.rules.map(r =>
    `<div class="rule-item"><span class="rule-icon">✅</span>${r}</div>`
  ).join('');

  // Players
  const playerCount = document.getElementById('match-player-count');
  playerCount.textContent = `${currentMatch.players.length}/${currentMatch.maxPlayers}`;

  const playersGrid = document.getElementById('match-players-grid');
  let playersHTML = currentMatch.players.map(name => {
    const initials = name.split(' ').map(n => n[0]).join('');
    return `
      <div class="player-item">
        <div class="player-item-avatar">${initials}</div>
        <div class="player-item-name">${name}</div>
      </div>
    `;
  }).join('');

  // Empty slots
  const emptySlots = currentMatch.maxPlayers - currentMatch.players.length;
  for (let i = 0; i < emptySlots; i++) {
    playersHTML += `
      <div class="player-item empty">
        <div class="player-item-avatar">?</div>
        <div class="player-item-name">Open</div>
      </div>
    `;
  }
  playersGrid.innerHTML = playersHTML;

  // Join button state
  const joinBtn = document.getElementById('join-match-btn');
  const isJoined = currentMatch.players.includes(currentUser.name);
  if (isJoined) {
    joinBtn.textContent = '✅ Already Joined';
    joinBtn.style.opacity = '0.6';
    joinBtn.style.pointerEvents = 'none';
  } else if (currentMatch.status === 'full') {
    joinBtn.textContent = '🚫 Match is Full';
    joinBtn.style.opacity = '0.6';
    joinBtn.style.pointerEvents = 'none';
  } else {
    joinBtn.textContent = '⚡ Join This Match';
    joinBtn.style.opacity = '1';
    joinBtn.style.pointerEvents = 'auto';
  }

  navigateTo('match-detail');

  // Mini map
  if (stadium) {
    setTimeout(() => {
      initMiniMap('match-mini-map', stadium.lat, stadium.lng, stadium.name);
    }, 300);
  }
}

async function joinMatch() {
  if (!currentMatch) return;
  const matchId = currentMatch._id || currentMatch.id;

  const result = await apiPost(`/matches/${matchId}/join`, { playerName: currentUser.name });
  if (result) {
    showToast('🎉', `You joined "${currentMatch.title}"!`);
    await loadMatches();
    openMatchDetail(matchId);
  } else {
    showToast('⚠️', 'Could not join match. You may already be in it or it\'s full.');
  }
}

async function joinMatchById(id) {
  const result = await apiPost(`/matches/${id}/join`, { playerName: currentUser.name });
  if (result) {
    showToast('🎉', `You joined "${result.title}"!`);
    await loadMatches();
    renderMatchesList();
    renderHomeMatches();
  } else {
    showToast('⚠️', 'Could not join match.');
  }
}

// ==================== MATCH TABS ====================

function setMatchTab(tab) {
  currentMatchTab = tab;
  document.querySelectorAll('#match-tabs .tab-item').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab);
  });
  renderMatchesList();
}

// ==================== CREATE MATCH MODAL ====================

function openCreateMatchModal() {
  const modal = document.getElementById('create-match-modal');
  modal.classList.add('visible');
  // accessibility handlers
  _addModalHandlers(modal, closeCreateMatchModal);

  // Populate stadium dropdown
  const select = document.getElementById('new-match-stadium');
  select.innerHTML = '<option value="">Select a stadium...</option>' +
    stadiums.map(s => `<option value="${s._id}">${s.name} — ${s.price} DA/hr</option>`).join('');

  // Set default date to tomorrow
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  document.getElementById('new-match-date').value = tomorrow.toISOString().split('T')[0];
  document.getElementById('new-match-time').value = '18:00';

  // Populate friends list
  const friendsContainer = document.getElementById('new-match-friends');
  if (friendsContainer) {
    friendsContainer.innerHTML = playerNames.filter(n => n !== (currentUser ? currentUser.name : '')).map((name, index) => `
      <div style="display: flex; align-items: center; margin-bottom: 8px;">
        <input type="checkbox" id="friend-${index}" value="${name}" style="margin-right: 10px; accent-color: #10b981;">
        <label for="friend-${index}" style="color: #cbd5e1; cursor: pointer; font-size: 0.9rem;">${name}</label>
      </div>
    `).join('');
  }
}

function closeCreateMatchModal() {
  const modal = document.getElementById('create-match-modal');
  modal.classList.remove('visible');
  _removeModalHandlers(modal);
}

async function createMatch() {
  const title = document.getElementById('new-match-title').value.trim();
  const stadiumId = document.getElementById('new-match-stadium').value;
  const date = document.getElementById('new-match-date').value;
  const time = document.getElementById('new-match-time').value;
  const maxPlayers = parseInt(document.getElementById('new-match-players').value);
  const fee = parseInt(document.getElementById('new-match-fee').value) || 0;

  // Get selected friends
  const selectedFriends = Array.from(document.querySelectorAll('#new-match-friends input:checked')).map(cb => cb.value);

  if (!title) { showToast('⚠️', 'Please enter a match title!'); return; }
  if (!stadiumId) { showToast('⚠️', 'Please select a stadium!'); return; }
  if (!date || !time) { showToast('⚠️', 'Please select date and time!'); return; }

  if (selectedFriends.length + 1 > maxPlayers) {
    showToast('⚠️', `Too many players! Max is ${maxPlayers}.`);
    return;
  }

  const matchData = {
    title,
    stadiumId,
    date,
    time,
    maxPlayers,
    players: [currentUser.name, ...selectedFriends],
    status: 'open',
    rules: [`${maxPlayers / 2} vs ${maxPlayers / 2} format`, '30-minute halves', 'Fair play rules apply', 'Have fun!'],
    fee
  };

  const result = await apiPost('/matches', matchData);
  if (result) {
    closeCreateMatchModal();
    showToast('🎉', `Match "${title}" created!`);
    await loadMatches();
    renderMatchesList();
    renderHomeMatches();

    // Clear form
    document.getElementById('new-match-title').value = '';
    document.getElementById('new-match-fee').value = '';
  } else {
    showToast('❌', 'Failed to create match. Try again.');
  }
}

async function submitLogin() {
  const name = document.getElementById('login-username').value.trim();
  const phone = document.getElementById('login-phone').value.trim();
  const age = document.getElementById('login-age').value;
  const position = document.getElementById('login-position').value;
  const skillLevel = document.getElementById('login-skill').value;

  if (!name || !phone || !age || !position || !skillLevel) {
    showToast('⚠️', 'Please fill in all fields!');
    return;
  }

  // Check if user already exists (simple check by phone for this demo)
  // In a real app, the backend handles auth/registration distinction
  let existingUser = users.find(u => u.phone === phone);
  
  if (existingUser) {
    // Login existing
    currentUser = existingUser;
    saveCurrentUser(currentUser);
    showToast('✅', `Welcome back, ${currentUser.name}!`);
  } else {
    // Register new
    const payload = {
      name,
      phone,
      age: parseInt(age),
      position,
      skillLevel,
      avatar: loginAvatarDataUrl,
      stats: { matchesPlayed: 0, goals: 0, rating: 5.0 },
      matchHistory: []
    };

    const res = await apiPost('/users', payload);
    if (res && !res.error) {
      currentUser = res;
      saveCurrentUser(currentUser);
      showToast('🎉', 'Account created successfully!');
      await loadUsers();
    } else {
      showToast('❌', res.error || 'Registration failed');
      return;
    }
  }

  navigateTo('home');
  updateProfileHeader();
  renderEditProfile();
}

// ==================== ADD STADIUM MODAL ====================

function openAddStadiumModal() {
  const modal = document.getElementById('add-stadium-modal');
  modal.classList.add('visible');
  _addModalHandlers(modal, closeAddStadiumModal);
}

function closeAddStadiumModal() {
  const modal = document.getElementById('add-stadium-modal');
  modal.classList.remove('visible');
  _removeModalHandlers(modal);
}

async function addStadium() {
  const name = document.getElementById('new-stadium-name').value.trim();
  const address = document.getElementById('new-stadium-address').value.trim();
  const price = parseInt(document.getElementById('new-stadium-price').value);
  const surface = document.getElementById('new-stadium-surface').value;

  if (!name || !address || !price) {
    showToast('⚠️', 'Please fill in all required fields!');
    return;
  }

  const stadiumData = {
    name,
    address,
    price,
    surface,
    lat: 36.07 + (Math.random() * 0.02 - 0.01),
    lng: 4.765 + (Math.random() * 0.02 - 0.01),
    rating: 0,
    image: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=600&h=400&fit=crop",
    images: ["https://images.unsplash.com/photo-1522778119026-d647f0596c20?w=600&h=400&fit=crop"],
    amenities: ["💡 Floodlights", "🅿️ Parking"],
    slots: ["09:00", "11:00", "13:00", "15:00", "17:00", "19:00", "21:00"],
    unavailableSlots: [],
    description: `${name} - a great place to play football.`
  };

  const result = await apiPost('/stadiums', stadiumData);
  if (result) {
    closeAddStadiumModal();
    showToast('🎉', `Stadium "${name}" added!`);
    await loadStadiums();
    renderOwnerStadiums();
    renderFeaturedStadiums();
    renderStadiumList();

    // Clear form
    document.getElementById('new-stadium-name').value = '';
    document.getElementById('new-stadium-address').value = '';
    document.getElementById('new-stadium-price').value = '';
  } else {
    showToast('❌', 'Failed to add stadium. Try again.');
  }
}

// ==================== TOAST ====================

function showToast(icon, message) {
  const toast = document.getElementById('toast');
  document.getElementById('toast-icon').textContent = icon;
  document.getElementById('toast-message').textContent = message;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 3000);
}

// ==================== UTILS ====================

function formatDate(dateStr) {
  const date = new Date(dateStr);
  const options = { weekday: 'short', month: 'short', day: 'numeric' };
  return date.toLocaleDateString('en-US', options);
}

// ==================== MODAL ACCESSIBILITY HELPERS ====================

const _focusableSelectors = 'a[href], area[href], input:not([disabled]):not([type=hidden]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [tabindex]:not([tabindex="-1"])';

function _getFocusable(container) {
  return Array.from(container.querySelectorAll(_focusableSelectors)).filter(el => el.offsetParent !== null);
}

function _addModalHandlers(modal, onClose) {
  const content = modal.querySelector('.modal-content');
  // save previously focused element
  modal._previouslyFocused = document.activeElement;

  // allow overlay click to close
  modal._overlayClick = (e) => { if (e.target === modal) onClose(); };
  modal.addEventListener('mousedown', modal._overlayClick);

  // key handling: Escape to close, Tab to trap
  modal._keyHandler = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
      return;
    }
    if (e.key === 'Tab') {
      const focusable = _getFocusable(content);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  document.addEventListener('keydown', modal._keyHandler);

  // set aria-hidden and focus
  modal.setAttribute('aria-hidden', 'false');
  // focus the first focusable element or the dialog container
  const focusable = _getFocusable(content);
  (focusable[0] || content).focus();
}

function _removeModalHandlers(modal) {
  const content = modal.querySelector('.modal-content');
  if (modal._overlayClick) modal.removeEventListener('mousedown', modal._overlayClick);
  if (modal._keyHandler) document.removeEventListener('keydown', modal._keyHandler);
  modal.setAttribute('aria-hidden', 'true');
  if (modal._previouslyFocused && typeof modal._previouslyFocused.focus === 'function') {
    modal._previouslyFocused.focus();
  }
  modal._overlayClick = null;
  modal._keyHandler = null;
  modal._previouslyFocused = null;
}

// ==================== INITIALIZATION ====================

async function initApp() {
  console.log('🚀 JustPlay initializing...');

  // Load data from API (including users)
  await Promise.all([loadStadiums(), loadMatches(), loadUsers()]);

  // Ensure profile header and edit preview reflect loaded user
  try { updateProfileHeader(); } catch (e) { /* ignore */ }
  try { renderEditProfile(); } catch (e) { /* ignore */ }

  console.log(`📊 Loaded ${stadiums.length} stadiums, ${matches.length} matches`);

  // Render initial content
  renderFeaturedStadiums();
  renderHomeMatches();
  renderMatchesList();
  renderStadiumList();
  renderOwnerStadiums();

  // Navigation event listeners
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', () => {
      navigateTo(item.dataset.page);
    });
  });

  // Match tabs
  document.querySelectorAll('#match-tabs .tab-item').forEach(tab => {
    tab.addEventListener('click', () => setMatchTab(tab.dataset.tab));
  });

  // Search
  const searchInput = document.getElementById('map-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => filterStadiums(e.target.value));
  }

  // Wire up photo input handler
  const photoInput = document.getElementById('edit-photo-input');
  if (photoInput) {
    photoInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { showToast('⚠️', 'Please select an image file'); return; }

      // Read file as data URL then compress via canvas to reduce payload size
      const reader = new FileReader();
      reader.onload = () => {
        const originalDataUrl = reader.result;
        const img = new Image();
        img.onload = () => {
          const maxDim = 1024; // max width/height
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round(h * (maxDim / w)); w = maxDim; } else { w = Math.round(w * (maxDim / h)); h = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          // convert to jpeg to improve compression (preserve PNG if necessary in fallback)
          let compressed = canvas.toDataURL('image/jpeg', 0.8);

          // fallback: if compression increased size, keep original
          const sizeOf = (d) => Math.round((d.length * 3) / 4 / 1024);
          try {
            if (sizeOf(compressed) > sizeOf(originalDataUrl)) compressed = originalDataUrl;
          } catch (e) {}

          selectedAvatarDataUrl = compressed;
          const editAvatarEl = document.getElementById('edit-profile-avatar');
          if (editAvatarEl) {
            editAvatarEl.style.backgroundImage = `url(${selectedAvatarDataUrl})`;
            editAvatarEl.style.backgroundRepeat = 'no-repeat';
            editAvatarEl.style.backgroundSize = 'cover';
            editAvatarEl.style.backgroundPosition = 'center';
            editAvatarEl.style.backgroundColor = 'transparent';
            editAvatarEl.textContent = '';
          }
          console.log(`Avatar sizes (KB): original=${sizeOf(originalDataUrl)}KB compressed=${sizeOf(selectedAvatarDataUrl)}KB`);
        };
        img.onerror = () => {
          // fallback to original data url
          selectedAvatarDataUrl = originalDataUrl;
          const editAvatarEl = document.getElementById('edit-profile-avatar');
          if (editAvatarEl) {
            editAvatarEl.style.backgroundImage = `url(${selectedAvatarDataUrl})`;
            editAvatarEl.textContent = '';
          }
        };
        img.src = originalDataUrl;
      };
      reader.readAsDataURL(file);
    });
  }

  // Wire up login photo input handler
  const loginPhotoInput = document.getElementById('login-photo-input');
  if (loginPhotoInput) {
    loginPhotoInput.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) { showToast('⚠️', 'Please select an image file'); return; }

      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 500;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) { h = Math.round(h * (maxDim / w)); w = maxDim; } else { w = Math.round(w * (maxDim / h)); h = maxDim; }
          }
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          loginAvatarDataUrl = canvas.toDataURL('image/jpeg', 0.8);
          
          const preview = document.getElementById('login-avatar-preview');
          if (preview) {
            preview.style.backgroundImage = `url(${loginAvatarDataUrl})`;
            preview.textContent = '';
            preview.style.backgroundSize = 'cover';
          }
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  console.log('✅ JustPlay ready!');

  // Make bottom nav bigger
  const bottomNav = document.getElementById('bottom-nav');
  if (bottomNav) {
    bottomNav.style.height = '80px';
    document.querySelectorAll('.page').forEach(p => p.style.paddingBottom = '90px');
  }

  // Theme (dark mode) init: read saved preference and update toggle
  const darkToggle = document.getElementById('dark-mode-toggle');
  function applyTheme(isDark) {
    if (isDark) {
      document.body.classList.add('dark');
      if (darkToggle) { darkToggle.classList.add('on'); darkToggle.setAttribute('aria-checked','true'); }
    } else {
      document.body.classList.remove('dark');
      if (darkToggle) { darkToggle.classList.remove('on'); darkToggle.setAttribute('aria-checked','false'); }
    }
  }

  const savedTheme = localStorage.getItem('theme');
  const isDarkSaved = savedTheme === 'dark';
  applyTheme(isDarkSaved);

  // Toggle handler
  if (darkToggle) {
    darkToggle.addEventListener('click', () => {
      const isDark = document.body.classList.toggle('dark');
      if (isDark) { darkToggle.classList.add('on'); darkToggle.setAttribute('aria-checked','true'); localStorage.setItem('theme','dark'); }
      else { darkToggle.classList.remove('on'); darkToggle.setAttribute('aria-checked','false'); localStorage.setItem('theme','light'); }
    });
  }

  // Sidebar toggle handlers
  const sidebarToggle = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const sidebarBackdrop = document.getElementById('sidebar-backdrop');
  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.add('visible');
    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'true');
  }
  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('open');
    if (sidebarBackdrop) sidebarBackdrop.classList.remove('visible');
    if (sidebarToggle) sidebarToggle.setAttribute('aria-expanded', 'false');
  }
  // expose closeSidebar to global scope for inline handlers
  window.closeSidebar = closeSidebar;

  if (sidebarToggle) sidebarToggle.addEventListener('click', () => {
    if (sidebar && sidebar.classList.contains('open')) closeSidebar(); else openSidebar();
  });
  if (sidebarBackdrop) sidebarBackdrop.addEventListener('click', closeSidebar);
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeSidebar(); });

  // Check for login action from index.html
  const urlParams = new URLSearchParams(window.location.search);
  const action = urlParams.get('action');

  if (action) {
    // Use a small delay to ensure the UI is ready for modals
    setTimeout(() => {
      const isUserLoggedIn = !!getSavedUser();

      if (action === 'login' && !isUserLoggedIn) {
        navigateTo('login');
      } else if (action === 'create_match') {
        if (isUserLoggedIn) {
          openCreateMatchModal();
        } else {
          showToast('🔐', 'Please log in to create a match.');
          navigateTo('login');
        }
      } else if (action === 'join_match') {
        navigateTo('matches');
      }
    }, 100);
  }
}

// Ensure profile header reflects current user (called on init and after updates)
function updateProfileHeader() {
  const avatarEl = document.getElementById('profile-avatar');
  const pname = document.getElementById('profile-name');
  const sidebarLoginBtn = document.getElementById('sidebar-login-btn');

  if (!currentUser) {
    // Guest State
    if (pname) pname.textContent = 'Guest';
    if (avatarEl) {
      avatarEl.style.backgroundImage = '';
      avatarEl.style.backgroundColor = '#334155';
      avatarEl.textContent = '👤';
    }
    if (sidebarLoginBtn) sidebarLoginBtn.style.display = 'flex';
  } else {
    // Logged In State
    if (pname) pname.textContent = currentUser.name || '';
    if (avatarEl) {
      if (currentUser.avatar) {
        avatarEl.style.backgroundImage = `url(${currentUser.avatar})`;
        avatarEl.style.backgroundRepeat = 'no-repeat';
        avatarEl.style.backgroundSize = 'cover';
        avatarEl.style.backgroundPosition = 'center';
        avatarEl.textContent = '';
      } else {
        avatarEl.style.backgroundImage = '';
        avatarEl.style.backgroundColor = '';
        avatarEl.textContent = (currentUser.name) ? (currentUser.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2)) : '';
      }
    }
    if (sidebarLoginBtn) sidebarLoginBtn.style.display = 'none';
  }

  // Show/hide owner dashboard link
  const ownerMenuItem = document.getElementById('owner-dashboard-menu-item');
  if (ownerMenuItem) {
    ownerMenuItem.style.display = (currentUser && currentUser.role === 'owner') ? 'flex' : 'none';
  }
}

// Wait for DOM then init
document.addEventListener('DOMContentLoaded', initApp);
// Ensure header reflects current user after initial data load
