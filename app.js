  <script>
    const firebaseConfig = {
      apiKey: "AIzaSyA0ixB0Wj-rSo7X7VOUZZROP8lUZBj6vJg",
      authDomain: "my-toilet-app-3c2c3.firebaseapp.com",
      projectId: "my-toilet-app-3c2c3",
      storageBucket: "my-toilet-app-3c2c3.firebasestorage.app",
      messagingSenderId: "322835199622",
      appId: "1:322835199622:web:7e43f787b97a003d408307"
    };

    firebase.initializeApp(firebaseConfig);
    const auth = firebase.auth();
    const db = firebase.firestore();
    const storage = firebase.storage();

    let currentUid = null;
    let myNickname = localStorage.getItem('user_nickname') || ''; 
    let myGroups = [];
    
    function loadGroupData() {
      try {
        const storedV2 = localStorage.getItem('user_groups_v2');
        if (storedV2) {
          myGroups = JSON.parse(storedV2);
        } else {
          const storedV1 = localStorage.getItem('user_groups');
          if (storedV1) {
            const oldIds = JSON.parse(storedV1);
            myGroups = oldIds.map(id => ({ id: id, name: id }));
            localStorage.setItem('user_groups_v2', JSON.stringify(myGroups));
          }
        }
      } catch (e) {
        myGroups = [];
      }
    }
    loadGroupData();

    let activeFilters = [];
    let currentDisplayGroup = 'all';

    function escapeHTML(str) {
      if (!str) return '';
      return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function getGroupName(groupId) {
      const group = myGroups.find(g => g.id === groupId);
      return group ? group.name : groupId; 
    }

    function changeDisplayGroup() {
      currentDisplayGroup = document.getElementById('disp-group-select').value;
      refreshMapAndList();
    }

    function updateProfileUI() {
      document.getElementById('disp-nickname').innerText = myNickname || t('guest');
      const groupSelect = document.getElementById('disp-group-select');
      const currentValue = groupSelect.value;
      
      let optionsHtml = `<option value="all">${t('optAll')}</option>`;
      myGroups.forEach(g => {
        optionsHtml += `<option value="${escapeHTML(g.id)}">👥 ${escapeHTML(g.name)}</option>`;
      });
      optionsHtml += `<option value="publicOnly">${t('optPublicOnly')}</option>`;
      optionsHtml += `<option value="privateOnly">${t('optPrivateOnly')}</option>`;
      
      groupSelect.innerHTML = optionsHtml;
      
      if (currentValue && [...groupSelect.options].some(opt => opt.value === currentValue)) {
        groupSelect.value = currentValue;
      } else {
        currentDisplayGroup = 'all';
        groupSelect.value = 'all';
      }
    }

    const DEFAULT_LAT = 35.6812;
    const DEFAULT_LNG = 139.7671;
    var map = L.map('map').setView([DEFAULT_LAT, DEFAULT_LNG], 12);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

    var tempMarker = null;
    var allSpots = [];
    var activeMarkers = {};
    var currentLat = null;
    var currentLng = null;
    var currentMarker = null;
    var unsubscribers = [];

    window.addEventListener('DOMContentLoaded', updateProfileUI);

    auth.signInAnonymously().catch(function(error) {
      alert(t('errAuth') + error.message);
    });

    auth.onAuthStateChanged(function(user) {
      if (user) {
        currentUid = user.uid;
        setupRealtimeListeners();
      }
    });

    function createIcon(privacyType) {
      var className = 'custom-pin pin-public';
      var iconSymbol = '🚽';
      if (privacyType === 'private') {
        className = 'custom-pin pin-private';
        iconSymbol = '🔒';
      } else if (privacyType === 'group') {
        className = 'custom-pin pin-group';
      }
      return L.divIcon({ className: className, html: iconSymbol, iconSize: [30, 30], iconAnchor: [15, 15], popupAnchor: [0, -15] });
    }

    function openNavigation(lat, lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
      window.open(url, '_blank');
    }

    function calculateDistanceStr(lat2, lng2) {
      if (!currentLat || !currentLng) return null;
      var p1 = L.latLng(currentLat, currentLng);
      var p2 = L.latLng(lat2, lng2);
      var meters = p1.distanceTo(p2);
      return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
    }

    function getDistanceMeters(lat2, lng2) {
      if (!currentLat || !currentLng) return Infinity;
      return L.latLng(currentLat, currentLng).distanceTo(L.latLng(lat2, lng2));
    }

    async function searchLocation() {
      const query = document.getElementById('input-search-location').value;
      if (!query) return;
      document.getElementById('loading-text').innerText = t('loadingSearch');
      document.getElementById('loading').style.display = 'flex';
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&email=info@toilet-app.com`);
        const data = await res.json();
        if (data && data.length > 0) {
          map.setView([parseFloat(data[0].lat), parseFloat(data[0].lon)], 16);
        } else {
          alert(t('errSearch'));
        }
      } catch (e) {
        alert(t('errSearchSys'));
      } finally {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('loading-text').innerText = t('loadingConnect');
      }
    }

    function compressImage(file, maxWidth = 1024, quality = 0.75) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
          const img = new Image();
          img.src = event.target.result;
          img.onload = () => {
            let width = img.width; let height = img.height;
            if (width > maxWidth) { height = Math.round((height * maxWidth) / width); width = maxWidth; }
            const canvas = document.createElement('canvas');
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            canvas.toBlob(blob => resolve(blob), 'image/jpeg', quality);
          };
          img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
      });
    }

    function setupRealtimeListeners() {
      unsubscribers.forEach(unsub => unsub());
      unsubscribers = [];

      let publicSpots = [];
      let groupSpotsMap = {};
      let privateSpots = [];

      const updateAll = () => {
        let groupSpots = [];
        Object.values(groupSpotsMap).forEach(spots => { groupSpots = groupSpots.concat(spots); });
        allSpots = [...publicSpots, ...groupSpots, ...privateSpots];
        refreshMapAndList();
        document.getElementById('loading').style.display = 'none';
      };

      unsubscribers.push(
        db.collection('toiletSpots').onSnapshot(snap => {
          publicSpots = snap.docs.map(doc => ({ docId: doc.id, pathType: 'public', ...doc.data() }));
          updateAll();
        }, err => console.error(err))
      );

      if (myGroups.length > 0) {
        myGroups.forEach(g => {
          unsubscribers.push(
            db.collection('groups').doc(g.id).collection('toiletSpots').onSnapshot(snap => {
              groupSpotsMap[g.id] = snap.docs.map(doc => ({ docId: doc.id, pathType: 'group', groupId: g.id, ...doc.data() }));
              updateAll();
            }, err => console.error(err))
          );
        });
      } else {
        updateAll();
      }

      if (currentUid) {
        unsubscribers.push(
          db.collection('users').doc(currentUid).collection('toiletSpots').onSnapshot(snap => {
            privateSpots = snap.docs.map(doc => ({ docId: doc.id, pathType: 'private', ...doc.data() }));
            updateAll();
          }, err => console.error(err))
        );
      }
    }

    function refreshMapAndList() {
      Object.keys(activeMarkers).forEach(key => { if (activeMarkers[key]) map.removeLayer(activeMarkers[key]); });
      activeMarkers = {};

      allSpots.forEach(spot => {
        var isVisibleByGroup = true;
        if (currentDisplayGroup === 'publicOnly') isVisibleByGroup = (spot.privacy === 'public');
        else if (currentDisplayGroup === 'privateOnly') isVisibleByGroup = (spot.privacy === 'private');
        else if (currentDisplayGroup !== 'all') isVisibleByGroup = (spot.privacy === 'group' && spot.groupId === currentDisplayGroup);

        var matchesFilter = activeFilters.every(f => {
          if (f === 'privateOnly') return spot.privacy === 'private';
          return spot.features && spot.features[f] === true;
        });

        if (isVisibleByGroup && matchesFilter) addMarkerToMap(spot);
      });

      if (document.getElementById('list-view').style.display === 'block') renderList();
    }

    function toggleFilter(el) {
      var feature = el.getAttribute('data-feature');
      if (el.classList.contains('active')) {
        el.classList.remove('active');
        activeFilters = activeFilters.filter(f => f !== feature);
      } else {
        el.classList.add('active');
        activeFilters.push(feature);
      }
      refreshMapAndList();
    }

    function renderFeatureTags(features) {
      if (!features) return '';
      var html = '<div class="tag-container">';
      if (features.accessible) html += `<span class="feature-tag">${t('filterAccessible')}</span>`;
      if (features.baby) html += `<span class="feature-tag">${t('filterBaby')}</span>`;
      if (features.washlet) html += `<span class="feature-tag">${t('filterWashlet')}</span>`;
      if (features.open24h) html += `<span class="feature-tag">${t('filterOpen24h')}</span>`;
      if (features.facility) html += `<span class="feature-tag">${t('filterFacility')}</span>`;
      html += '</div>';
      return html;
    }

    function addMarkerToMap(spot) {
      if (!spot.lat || !spot.lng) return;

      var stars = '★'.repeat(spot.rating || 3) + '☆'.repeat(5 - (spot.rating || 3));
      var badgeHtml = '';
      if (spot.privacy === 'private') {
        badgeHtml = `<span style="color:#6f42c1;">${t('badgePrivateIcon')}</span>`;
      } else if (spot.privacy === 'group') {
        const groupName = escapeHTML(getGroupName(spot.groupId));
        badgeHtml = `<span style="color:green;">${t('badgeGroupIcon')}${groupName}]</span>`;
      } else {
        badgeHtml = `<span style="color:orange;">${t('badgePublicIcon')}</span>`;
      }

      var tagsHtml = renderFeatureTags(spot.features);
      var safeImgUrl = escapeHTML(spot.imageUrl);
      var imgHtml = safeImgUrl ? `<img src="${safeImgUrl}" class="spot-img" onclick="window.open('${safeImgUrl}')">` : '';
      var distStr = calculateDistanceStr(spot.lat, spot.lng);
      var distHtml = distStr ? `<div style="font-size:11px; color:#007bff; font-weight:bold; margin-bottom:4px;">${t('distCurrent')}${distStr}</div>` : '';
      var isOwner = spot.userId === currentUid;
      var deleteBtnHtml = isOwner ? `<button style="flex:1; padding:5px 2px; background:#ff4444; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;" onclick="deleteSpot('${spot.docId}')">${t('btnDel')}</button>` : '';

      var popupContent = `
        <div style="font-size:13px; min-width:170px; max-width:210px;">
          ${badgeHtml} <b>${escapeHTML(spot.userName || t('anonymous'))}</b><br>
          <span style="color:#ffca08; font-size:14px;">${stars}</span><br>
          ${distHtml}
          ${tagsHtml}
          ${imgHtml}
          <b>${escapeHTML(spot.comment || t('noComment'))}</b><br><br>
          <div style="display:flex; gap:4px;">
            <button style="flex:1; padding:5px 2px; background:#28a745; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;" onclick="openNavigation(${spot.lat}, ${spot.lng})">${t('btnNaviMap')}</button>
            ${deleteBtnHtml}
          </div>
        </div>
      `;

      var marker = L.marker([spot.lat, spot.lng], { icon: createIcon(spot.privacy) }).bindPopup(popupContent);
      marker.addTo(map);
      activeMarkers[spot.docId] = marker;
    }

    async function saveData() {
      if (!currentUid) { alert(t('alertWait')); return; }

      var fileInput = document.getElementById('file-photo');
      var rawFile = fileInput.files[0];
      var rating = document.querySelector('input[name="rating"]:checked')?.value || 3;
      var comment = document.getElementById('toilet-comment').value;
      var privacy = document.querySelector('input[name="privacy"]:checked').value;

      if (!tempMarker) return;

      var targetGroup = null;
      if (privacy === 'group') {
        if (myGroups.length === 0) {
          alert(t('alertNoGroupForPost'));
          return;
        }
        targetGroup = document.getElementById('select-post-group').value;
      }

      document.getElementById('loading-text').innerText = t('loadingSave');
      document.getElementById('loading').style.display = 'flex';

      try {
        const lat = tempMarker.getLatLng().lat;
        const lng = tempMarker.getLatLng().lng;
        const features = {
          accessible: document.getElementById('chk-accessible').checked,
          baby: document.getElementById('chk-baby').checked,
          washlet: document.getElementById('chk-washlet').checked,
          open24h: document.getElementById('chk-open24h').checked,
          facility: document.getElementById('chk-facility').checked
        };

        let imageUrl = ''; let imagePath = ''; 
        if (rawFile) {
          document.getElementById('loading-text').innerText = t('loadingImage');
          const compressedBlob = await compressImage(rawFile, 1024, 0.75);
          imagePath = `toilet_photos/${currentUid}/${Date.now()}.jpg`;
          const storageRef = storage.ref(imagePath);
          const snapshot = await storageRef.put(compressedBlob);
          imageUrl = await snapshot.ref.getDownloadURL();
        }

        var newSpot = {
          lat: lat, lng: lng, rating: parseInt(rating), comment: comment,
          privacy: privacy, groupId: targetGroup,
          userName: myNickname || t('guest'), userId: currentUid, imageUrl: imageUrl, imagePath: imagePath,
          features: features, createdAt: firebase.firestore.FieldValue.serverTimestamp()
        };

        if (privacy === 'public') {
          await db.collection('toiletSpots').add(newSpot);
        } else if (privacy === 'group') {
          await db.collection('groups').doc(targetGroup).collection('toiletSpots').add(newSpot);
        } else if (privacy === 'private') {
          await db.collection('users').doc(currentUid).collection('toiletSpots').add(newSpot);
        }

        closeForm();
        resetFormInputs();
      } catch (error) {
        alert(t('alertSaveFail') + error.message);
      } finally {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('loading-text').innerText = t('loadingConnect');
      }
    }

    function resetFormInputs() {
      document.getElementById('toilet-comment').value = '';
      document.getElementById('file-photo').value = '';
      document.getElementById('chk-accessible').checked = false;
      document.getElementById('chk-baby').checked = false;
      document.getElementById('chk-washlet').checked = false;
      document.getElementById('chk-open24h').checked = false;
      document.getElementById('chk-facility').checked = false;
    }

    function getDocRef(spot) {
      if (spot.pathType === 'public') return db.collection('toiletSpots').doc(spot.docId);
      else if (spot.pathType === 'group') return db.collection('groups').doc(spot.groupId).collection('toiletSpots').doc(spot.docId);
      else if (spot.pathType === 'private') return db.collection('users').doc(currentUid).collection('toiletSpots').doc(spot.docId);
      return null;
    }

    async function deleteSpot(docId) {
      if (confirm(t('confirmDelete'))) {
        document.getElementById('loading-text').innerText = t('loadingDelete');
        document.getElementById('loading').style.display = 'flex';
        try {
          const spot = allSpots.find(s => s.docId === docId);
          if (!spot) throw new Error(t('errNotFound'));
          const docRef = getDocRef(spot);
          if (!docRef) throw new Error(t('errRefFail'));

          const docSnap = await docRef.get();
          if (docSnap.exists) {
            if (docSnap.data().userId !== currentUid) { alert(t('errNotOwner')); return; }
            if (docSnap.data().imagePath) { try { await storage.ref(docSnap.data().imagePath).delete(); } catch (e) {} }
            await docRef.delete();
          }
        } catch (error) {
          alert(t('errDeleteFail') + error.message);
        } finally {
          document.getElementById('loading').style.display = 'none';
          document.getElementById('loading-text').innerText = t('loadingConnect');
        }
      }
    }

    async function deleteSelectedSpots() {
      const checkboxes = document.querySelectorAll('.spot-checkbox:checked');
      if (checkboxes.length === 0) { alert(t('alertCheckDel')); return; }
      if (!confirm(`${t('confirmBulkDelete1')}${checkboxes.length}${t('confirmBulkDelete2')}`)) return;

      document.getElementById('loading-text').innerText = t('loadingBulkDelete');
      document.getElementById('loading').style.display = 'flex';
      try {
        for (const cb of checkboxes) {
          const spot = allSpots.find(s => s.docId === cb.value);
          if (spot && spot.userId === currentUid) {
            const docRef = getDocRef(spot);
            if (docRef) {
              if (spot.imagePath) { try { await storage.ref(spot.imagePath).delete(); } catch (e) {} }
              await docRef.delete();
            }
          }
        }
      } catch (error) { alert(t('errBulkFail') + error.message);
      } finally {
        document.getElementById('loading').style.display = 'none';
        document.getElementById('loading-text').innerText = t('loadingConnect');
      }
    }

    function switchTab(tabName) {
      if (tabName === 'map') {
        document.getElementById('map').style.display = 'block';
        document.getElementById('fab-add-spot').style.display = 'flex';
        document.getElementById('list-view').style.display = 'none';
        document.getElementById('nav-map').classList.add('active');
        document.getElementById('nav-list').classList.remove('active');
        map.invalidateSize();
      } else {
        document.getElementById('map').style.display = 'none';
        document.getElementById('fab-add-spot').style.display = 'none';
        document.getElementById('list-view').style.display = 'block';
        document.getElementById('nav-list').classList.add('active');
        document.getElementById('nav-map').classList.remove('active');
        renderList();
      }
    }

    function renderList() {
      var container = document.getElementById('list-container');
      var searchQuery = document.getElementById('search-box').value.toLowerCase();
      var sortMethod = document.getElementById('sort-box').value;

      var filtered = allSpots.filter(spot => {
        var isVisibleByGroup = true;
        if (currentDisplayGroup === 'publicOnly') isVisibleByGroup = (spot.privacy === 'public');
        else if (currentDisplayGroup === 'privateOnly') isVisibleByGroup = (spot.privacy === 'private');
        else if (currentDisplayGroup !== 'all') isVisibleByGroup = (spot.privacy === 'group' && spot.groupId === currentDisplayGroup);

        var matchesText = (spot.comment || '').toLowerCase().includes(searchQuery) || (spot.userName || '').toLowerCase().includes(searchQuery);
        var matchesFilter = activeFilters.every(f => {
          if (f === 'privateOnly') return spot.privacy === 'private';
          return spot.features && spot.features[f] === true;
        });

        return isVisibleByGroup && matchesText && matchesFilter;
      });

      filtered.sort((a, b) => {
        if (sortMethod === 'highest') return (b.rating || 0) - (a.rating || 0);
        else if (sortMethod === 'nearest') return getDistanceMeters(a.lat, a.lng) - getDistanceMeters(b.lat, b.lng);
        else {
          var getTime = item => {
            if (!item.createdAt) return 0;
            if (typeof item.createdAt === 'string') return new Date(item.createdAt).getTime();
            if (item.createdAt.seconds) return item.createdAt.seconds * 1000;
            return 0;
          };
          return getTime(b) - getTime(a);
        }
      });

      if (filtered.length === 0) {
        container.innerHTML = `<div class="empty-state">${t('emptyList')}</div>`;
        return;
      }

      var html = '';
      filtered.forEach((spot, index) => {
        var stars = '★'.repeat(spot.rating || 3) + '☆'.repeat(5 - (spot.rating || 3));
        var badgeClass = 'badge-public'; var badgeText = t('badgePublic');
        
        if (spot.privacy === 'private') { badgeClass = 'badge-private'; badgeText = t('badgePrivate'); }
        else if (spot.privacy === 'group') { badgeClass = 'badge-group'; badgeText = `${t('badgeGroup')}${escapeHTML(getGroupName(spot.groupId))}`; }

        var tagsHtml = renderFeatureTags(spot.features);
        var safeImgUrl = escapeHTML(spot.imageUrl);
        var imgHtml = safeImgUrl ? `<img src="${safeImgUrl}" class="spot-img" onclick="window.open('${safeImgUrl}')">` : '';
        var distStr = calculateDistanceStr(spot.lat, spot.lng);
        var distBadge = distStr ? `<span class="distance-tag">${t('distPrefix')}${distStr}</span>` : '';
        var isOwner = spot.userId === currentUid;
        var deleteBtnHtml = isOwner ? `<button class="btn-action btn-delete" onclick="deleteSpot('${spot.docId}')">${t('btnDel')}</button>` : '';

        if (index === 2) {
          html += `<div class="ad-container-card"><b>${t('sponsorPRTitle')}</b><br>${t('sponsorPRDesc')}<br><a href="https://www.amazon.co.jp/" target="_blank" class="ad-link">${t('sponsorPRLink')}</a></div>`;
        }

        html += `
          <div class="list-item">
            <div class="list-header">
              <label style="display:flex; align-items:center; gap:8px;">
                <input type="checkbox" class="spot-checkbox" value="${spot.docId}" ${!isOwner ? 'disabled' : ''} style="transform: scale(1.2);">
                <span class="list-stars">${stars}</span>
              </label>
              ${distBadge}
              <span class="list-badge ${badgeClass}">${badgeText}</span>
            </div>
            ${tagsHtml}
            ${imgHtml}
            <div class="list-comment"><b>${escapeHTML(spot.comment || t('noComment')).replace(/\n/g, '<br>')}</b>
            <div class="list-user">${t('postedBy')}<b>${escapeHTML(spot.userName || t('anonymous'))}</b></div>
            <div class="list-actions">
              <button class="btn-action btn-map" onclick="viewOnMap('${spot.docId}')">${t('btnMap')}</button>
              <button class="btn-action btn-nav" onclick="openNavigation(${spot.lat}, ${spot.lng})">${t('btnNavi')}</button>
              ${deleteBtnHtml}
            </div>
          </div>
        `;
      });
      container.innerHTML = html;
    }

    function viewOnMap(docId) {
      switchTab('map');
      var target = allSpots.find(s => s.docId === docId);
      if (target) {
        map.setView([target.lat, target.lng], 17);
        if (activeMarkers[docId]) activeMarkers[docId].openPopup();
      }
    }

    function updateCurrentLocation(isInitial = false) {
      if (!navigator.geolocation) { if (!isInitial) alert(t('msgLocNotSupported')); return; }
      navigator.geolocation.getCurrentPosition(
        function(pos) {
          currentLat = pos.coords.latitude; currentLng = pos.coords.longitude;
          if (currentMarker) currentMarker.setLatLng([currentLat, currentLng]);
          else currentMarker = L.circleMarker([currentLat, currentLng], { radius: 8, fillColor: "#007bff", color: "#fff", weight: 2, fillOpacity: 0.8 }).addTo(map).bindPopup(t('currentLocationPopup'));
          if (isInitial) map.setView([currentLat, currentLng], 15);
          refreshMapAndList();
        },
        function(err) {
          console.warn("Location error:", err.message);
          if (!isInitial) alert(t('msgLocFail'));
        },
        { enableHighAccuracy: true, timeout: 8000, maximumAge: 10000 }
      );
    }
    updateCurrentLocation(true);

    var locateControl = L.control({ position: 'topright' });
    locateControl.onAdd = function(map) {
      var div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
      div.style.backgroundColor = 'white'; div.style.width = '34px'; div.style.height = '34px';
      div.style.lineHeight = '34px'; div.style.textAlign = 'center'; div.style.cursor = 'pointer'; div.style.fontSize = '18px';
      div.title = 'Current Location'; div.innerHTML = '🎯';
      div.onclick = function(e) {
        L.DomEvent.stopPropagation(e);
        if (currentLat && currentLng) { map.flyTo([currentLat, currentLng], 16); updateCurrentLocation(false); }
        else updateCurrentLocation(false);
      };
      return div;
    };
    locateControl.addTo(map);

    map.on('contextmenu', function(e) {
      if (tempMarker) map.removeLayer(tempMarker); 
      tempMarker = L.marker(e.latlng, { draggable: true }).addTo(map);
      openForm();
    });

    function addPinAtCenter() {
      const center = map.getCenter();
      if (tempMarker) map.removeLayer(tempMarker);
      tempMarker = L.marker(center, { draggable: true }).addTo(map);
      openForm();
    }

    function toggleGroupSelect() {
      const selectGroup = document.getElementById('select-post-group');
      const isGroupChecked = document.querySelector('input[name="privacy"]:checked').value === 'group';
      selectGroup.style.display = (isGroupChecked && myGroups.length > 0) ? 'block' : 'none';
    }

    function openForm() { 
      const selectGroup = document.getElementById('select-post-group');
      if (myGroups.length > 0) {
        selectGroup.innerHTML = myGroups.map(g => `<option value="${escapeHTML(g.id)}">${escapeHTML(g.name)}</option>`).join('');
      } else {
        selectGroup.innerHTML = `<option value="">${t('groupNotSet')}</option>`;
      }
      toggleGroupSelect();
      document.getElementById('input-form').classList.add('open'); 
    }
    
    function closeForm() {
      document.getElementById('input-form').classList.remove('open');
      if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
    }

    function renderGroupSettings() {
      const container = document.getElementById('group-list-container');
      if (myGroups.length === 0) {
        container.innerHTML = `<div style="padding: 10px; background: #fafafa; border-radius: 4px; text-align: center;">${t('noJoinedGroups')}</div>`;
        return;
      }
      container.innerHTML = myGroups.map((g, index) => 
        `<div style="display:flex; justify-content:space-between; align-items:center; background:#eee; padding:8px 10px; margin-bottom:5px; border-radius:4px;">
          <div style="overflow: hidden; margin-right: 5px;">
            <span style="font-weight:bold;">${escapeHTML(g.name)}</span><br>
            <span style="font-size:11px; color:#555; word-break: break-all;">ID: ${escapeHTML(g.id)}</span>
          </div>
          <div style="display:flex; gap:4px; flex-shrink:0;">
            <button onclick="copyGroupId('${escapeHTML(g.id)}')" style="background:#007bff; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:11px;">${t('btnCopy')}</button>
            <button onclick="removeGroup(${index})" style="background:#ff4444; color:white; border:none; border-radius:4px; padding:4px 8px; cursor:pointer; font-size:11px;">${t('btnLeave')}</button>
          </div>
        </div>`
      ).join('');
    }

    function copyGroupId(id) {
      navigator.clipboard.writeText(id).then(() => {
        alert(t('msgCopyOk'));
      }).catch(err => {
        alert(t('msgCopyFail'));
      });
    }

    async function createNewGroup() {
      const input = document.getElementById('input-create-group-name');
      const groupName = input.value.trim();
      if (!groupName) { alert(t('alertGroupNameReq')); return; }

      document.getElementById('loading-text').innerText = t('loadingGroupCreate');
      document.getElementById('loading').style.display = 'flex';

      try {
        const docRef = await db.collection('groups').add({
          name: groupName,
          createdBy: currentUid,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        myGroups.push({ id: docRef.id, name: groupName });
        input.value = '';
        saveGroupsLocal();
        renderGroupSettings();
        alert(`${t('msgGroupCreated1')}${groupName}${t('msgGroupCreated2')}`);
      } catch (e) {
        alert(t('errGroupCreateFail') + e.message);
      } finally {
        document.getElementById('loading').style.display = 'none';
      }
    }

    async function joinGroupById() {
      const input = document.getElementById('input-join-group-id');
      const groupId = input.value.trim();
      if (!groupId) { alert(t('alertGroupIdReq')); return; }

      if (myGroups.some(g => g.id === groupId)) {
        alert(t('alertGroupAlready'));
        return;
      }

      document.getElementById('loading-text').innerText = t('loadingGroupJoin');
      document.getElementById('loading').style.display = 'flex';

      try {
        const doc = await db.collection('groups').doc(groupId).get();
        if (!doc.exists) {
          alert(t('alertGroupNotFound'));
          return;
        }

        const data = doc.data();
        const groupName = data.name || 'Group';
        
        myGroups.push({ id: groupId, name: groupName });
        input.value = '';
        saveGroupsLocal();
        renderGroupSettings();
        alert(`${t('msgGroupJoined1')}${groupName}${t('msgGroupJoined2')}`);
      } catch (e) {
        alert(t('errGroupJoinFail') + e.message);
      } finally {
        document.getElementById('loading').style.display = 'none';
      }
    }

    function removeGroup(index) {
      if(confirm(t('confirmLeaveGroup'))) {
        myGroups.splice(index, 1);
        saveGroupsLocal();
        renderGroupSettings();
      }
    }

    function saveGroupsLocal() {
      localStorage.setItem('user_groups_v2', JSON.stringify(myGroups));
      updateProfileUI();
      setupRealtimeListeners();
    }

    function openSettings() {
      document.getElementById('input-nickname').value = myNickname;
      renderGroupSettings();
      document.getElementById('settings-modal').classList.add('open');
    }
    
    function closeSettings() { document.getElementById('settings-modal').classList.remove('open'); }
    function openPrivacyModal() { document.getElementById('privacy-modal').classList.add('open'); }
    function closePrivacyModal() { document.getElementById('privacy-modal').classList.remove('open'); }
    
    function saveSettings() {
      myNickname = document.getElementById('input-nickname').value || '';
      localStorage.setItem('user_nickname', myNickname);
      updateProfileUI();
      closeSettings();
      alert(t('msgSettingsSaved'));
    }
  </script>
