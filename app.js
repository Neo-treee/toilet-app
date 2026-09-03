let map;
let markers = [];
let currentPositionMarker = null;
let currentTempMarker = null;
let db;
let currentUser = null;
let userProfile = { nickname: '', groups: [] };
let activeFilters = [];
let currentToiletData = [];
let activeCommentSpotId = null;

// アプリの初期化
window.addEventListener('DOMContentLoaded', async () => {
  initMap();
  initFirebase();
});

// マップの初期化
function initMap() {
  map = L.map('map', { zoomControl: false }).setView([35.681236, 139.767125], 15);
  
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
    maxZoom: 19
  }).addTo(map);

  L.control.zoom({ position: 'topright' }).addTo(map);

  // マップクリック時：調整用ピンを着地
  map.on('click', (e) => {
    setTempMarker(e.latlng.lat, e.latlng.lng);
  });

  // 現在地の取得
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        map.setView([lat, lng], 16);
        
        currentPositionMarker = L.marker([lat, lng], {
          icon: L.divIcon({
            className: 'current-pos-icon',
            html: '<div style="background:#007bff; width:14px; height:14px; border-radius:50%; border:2px solid #fff; box-shadow:0 0 5px rgba(0,0,0,0.5);"></div>',
            iconSize: [14, 14]
          })
        }).addTo(map).bindPopup(t('currentLocationPopup'));
      },
      () => { console.log(t('msgLocFail')); }
    );
  }
}

// 調整用ドラッグ可能ピンの設定
function setTempMarker(lat, lng) {
  if (currentTempMarker) {
    map.removeLayer(currentTempMarker);
  }
  currentTempMarker = L.marker([lat, lng], { draggable: true }).addTo(map);
  
  currentTempMarker.on('dragend', function (e) {
    const newPos = e.target.getLatLng();
    focusMapWithPadding(newPos.lat, newPos.lng);
  });

  focusMapWithPadding(lat, lng);
}

// フォーム表示時にピンが隠れないよう表示位置を上にずらす
function focusMapWithPadding(lat, lng) {
  const isFormOpen = document.getElementById('input-form-register').style.display !== 'none' ||
                     document.getElementById('input-form-record').style.display !== 'none';
  
  if (isFormOpen) {
    // 画面下部にフォームがあるため、中心を少しずらして見やすくする
    map.panTo([lat, lng]);
    map.panBy([0, 120], { animate: true });
  } else {
    map.panTo([lat, lng]);
  }
}

// Firebaseの初期化と認証
function initFirebase() {
  if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
    db = firebase.firestore();
    
    firebase.auth().signInAnonymously().then(res => {
      currentUser = res.user;
      loadUserProfile();
      loadSpots();
    }).catch(err => {
      alert(t('errAuth') + err.message);
    });
  }
}

// ユーザープロファイルの読み込み
async function loadUserProfile() {
  if (!currentUser || !db) return;
  const doc = await db.collection('users').doc(currentUser.uid).get();
  if (doc.exists) {
    userProfile = doc.data();
  } else {
    userProfile = { nickname: t('guest'), groups: [] };
    await db.collection('users').doc(currentUser.uid).set(userProfile);
  }
  document.getElementById('disp-nickname').innerText = userProfile.nickname || t('guest');
  updateGroupDropdowns();
}

// グループドロップダウンの更新
function updateGroupDropdowns() {
  const dispSelect = document.getElementById('disp-group-select');
  const recSelect = document.getElementById('rec-group-select');
  
  dispSelect.innerHTML = `<option value="all">${t('optAll')}</option><option value="private">${t('optPrivateOnly')}</option><option value="public">${t('optPublicOnly')}</option>`;
  recSelect.innerHTML = `<option value="">選択してください...</option>`;

  if (userProfile.groups && userProfile.groups.length > 0) {
    userProfile.groups.forEach(g => {
      dispSelect.innerHTML += `<option value="${g.id}">👥 ${g.name}</option>`;
      recSelect.innerHTML += `<option value="${g.id}">👥 ${g.name}</option>`;
    });
  }
}

// データの読み込み＆マップピンの描画
async function loadSpots() {
  if (!db) return;
  
  db.collection('spots').onSnapshot(snapshot => {
    currentToiletData = [];
    markers.forEach(m => map.removeLayer(m));
    markers = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      data.id = doc.id;
      
      // アクセス権限フィルタリング (自分のみ, グループ, 全体)
      if (canViewSpot(data)) {
        currentToiletData.push(data);
        addMapMarker(data);
      }
    });

    renderList();
  });
}

// 閲覧権限チェック
function canViewSpot(data) {
  if (data.privacy === 'public' || !data.privacy) return true;
  if (data.uid === currentUser?.uid) return true;
  if (data.privacy === 'group' && userProfile.groups?.some(g => g.id === data.groupId)) return true;
  return false;
}

// マップにピンを追加
function addMapMarker(data) {
  if (!data.lat || !data.lng) return;

  // フィルタリング処理
  if (activeFilters.length > 0) {
    const hasAllFilters = activeFilters.every(f => data.facilities && data.facilities[f]);
    if (!hasAllFilters) return;
  }

  const marker = L.marker([data.lat, data.lng]).addTo(map);
  
  let popupContent = `
    <div style="font-size:13px; line-height:1.5;">
      <b>${data.type === 'record' ? '📖 思い出の記録' : '🚻 トイレ情報'}</b><br>
      ${data.rating ? '評価: ' + '★'.repeat(data.rating) + '☆'.repeat(5 - data.rating) + '<br>' : ''}
      ${data.comment || data.memo ? (data.comment || data.memo) + '<br>' : ''}
      <button onclick="openCommentModal('${data.id}')" style="margin-top:6px; background:#007bff; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px;">${t('btnOpenComments')}</button>
    </div>
  `;

  marker.bindPopup(popupContent);
  markers.push(marker);
}

// フィルター切替
function toggleFilter(el) {
  const feature = el.getAttribute('data-feature');
  el.classList.toggle('active');

  if (el.classList.contains('active')) {
    activeFilters.push(feature);
  } else {
    activeFilters = activeFilters.filter(f => f !== feature);
  }

  loadSpots();
}

// トイレ登録フォームを開く
function openRegisterForm() {
  closeForms();
  document.getElementById('input-form-register').style.display = 'block';
  
  const center = map.getCenter();
  setTempMarker(center.lat, center.lng);
}

// 思い出記録フォームを開く
function openRecordForm() {
  closeForms();
  document.getElementById('input-form-record').style.display = 'block';
  toggleRecordGroupSelect();

  const center = map.getCenter();
  setTempMarker(center.lat, center.lng);
}

// 公開範囲に応じたグループ選択エリアの表示制御
function toggleRecordGroupSelect() {
  const privacyVal = document.querySelector('input[name="rec-privacy"]:checked')?.value;
  const groupSection = document.getElementById('rec-group-section');
  if (privacyVal === 'group') {
    groupSection.style.display = 'block';
  } else {
    groupSection.style.display = 'none';
  }
}

// フォームを閉じる
function closeForms() {
  document.getElementById('input-form-register').style.display = 'none';
  document.getElementById('input-form-record').style.display = 'none';
  if (currentTempMarker) {
    map.removeLayer(currentTempMarker);
    currentTempMarker = null;
  }
}

// トイレデータの保存（全体公開向け）
async function saveRegisterData() {
  if (!currentTempMarker) {
    alert('地図上をタップして場所を指定してください。');
    return;
  }

  const pos = currentTempMarker.getLatLng();
  const rating = document.querySelector('input[name="reg-rating"]:checked')?.value || 0;
  
  const facilities = {
    accessible: document.getElementById('reg-accessible').checked,
    baby: document.getElementById('reg-baby').checked,
    washlet: document.getElementById('reg-washlet').checked,
    western: document.getElementById('reg-western').checked,
    open24h: document.getElementById('reg-open24h').checked,
    facility: document.getElementById('reg-facility').checked,
    station: document.getElementById('reg-station').checked,
    parking: document.getElementById('reg-parking').checked
  };

  const payload = {
    type: 'register',
    lat: pos.lat,
    lng: pos.lng,
    facilities: facilities,
    rating: parseInt(rating),
    comment: document.getElementById('reg-comment').value,
    privacy: 'public',
    uid: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  showLoading(t('loadingSave'));
  try {
    await db.collection('spots').add(payload);
    hideLoading();
    closeForms();
  } catch (err) {
    hideLoading();
    alert(t('alertSaveFail') + err.message);
  }
}

// 思い出記録データの保存
async function saveRecordData() {
  if (!currentTempMarker) {
    alert('地図上をタップして場所を指定してください。');
    return;
  }

  const pos = currentTempMarker.getLatLng();
  const privacy = document.querySelector('input[name="rec-privacy"]:checked')?.value || 'private';
  const groupId = privacy === 'group' ? document.getElementById('rec-group-select').value : '';
  const rating = document.querySelector('input[name="rec-rating"]:checked')?.value || 0;

  if (privacy === 'group' && !groupId) {
    alert(t('alertNoGroupForPost'));
    return;
  }

  const facilities = {
    accessible: document.getElementById('rec-accessible').checked,
    baby: document.getElementById('rec-baby').checked,
    washlet: document.getElementById('rec-washlet').checked,
    western: document.getElementById('rec-western').checked,
    open24h: document.getElementById('rec-open24h').checked,
    facility: document.getElementById('rec-facility').checked,
    station: document.getElementById('rec-station').checked,
    parking: document.getElementById('rec-parking').checked
  };

  const payload = {
    type: 'record',
    lat: pos.lat,
    lng: pos.lng,
    privacy: privacy,
    groupId: groupId,
    facilities: facilities,
    rating: parseInt(rating),
    date: document.getElementById('rec-date').value,
    companion: document.getElementById('rec-companion').value,
    memo: document.getElementById('rec-memo').value,
    uid: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  };

  showLoading(t('loadingSave'));
  try {
    await db.collection('spots').add(payload);
    hideLoading();
    closeForms();
  } catch (err) {
    hideLoading();
    alert(t('alertSaveFail') + err.message);
  }
}

// 一覧画面のレンダリング
function renderList() {
  const container = document.getElementById('list-container');
  const kw = document.getElementById('search-box').value.toLowerCase();
  const sort = document.getElementById('sort-box').value;

  let list = [...currentToiletData];

  // キーワード検索
  if (kw) {
    list = list.filter(item => 
      (item.comment && item.comment.toLowerCase().includes(kw)) ||
      (item.memo && item.memo.toLowerCase().includes(kw))
    );
  }

  // ソート
  if (sort === 'highest') {
    list.sort((a, b) => (b.rating || 0) - (a.rating || 0));
  } else if (sort === 'nearest' && currentPositionMarker) {
    const myPos = currentPositionMarker.getLatLng();
    list.sort((a, b) => {
      const distA = L.latLng(a.lat, a.lng).distanceTo(myPos);
      const distB = L.latLng(b.lat, b.lng).distanceTo(myPos);
      return distA - distB;
    });
  }

  if (list.length === 0) {
    container.innerHTML = `<div style="text-align:center; padding:20px; color:#999;">${t('emptyList')}</div>`;
    return;
  }

  container.innerHTML = list.map(item => `
    <div class="spot-card">
      <div class="spot-info">
        <span class="spot-badge badge-${item.privacy || 'public'}">${item.privacy === 'private' ? t('badgePrivate') : item.privacy === 'group' ? t('badgeGroup') : t('badgePublic')}</span>
        <b>${item.type === 'record' ? '📖 ' + (item.memo || '無題') : ' ' + (item.comment || 'トイレ')}</b>
        <div>${item.rating ? '★'.repeat(item.rating) : ''}</div>
        <div style="font-size:11px; color:#666; margin-top:4px;">${item.date || ''} ${item.companion ? 'with ' + item.companion : ''}</div>
        <button onclick="focusOnMap(${item.lat}, ${item.lng})" style="margin-top:6px; padding:4px 8px; font-size:11px; background:#007bff; color:#fff; border:none; border-radius:4px;">${t('btnMap')}</button>
      </div>
    </div>
  `).join('');
}

// 地図を対象の場所へフォーカス
function focusOnMap(lat, lng) {
  switchTab('map');
  map.setView([lat, lng], 17);
}

// タブの切り替え
function switchTab(tab) {
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  if (tab === 'map') {
    document.getElementById('nav-map').classList.add('active');
    document.getElementById('list-view').style.display = 'none';
  } else {
    document.getElementById('nav-list').classList.add('active');
    document.getElementById('list-view').style.display = 'block';
    renderList();
  }
}

// 場所の検索 (Nominatim API)
async function searchLocation() {
  const query = document.getElementById('input-search-location').value;
  if (!query) return;

  showLoading(t('loadingSearch'));
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}`);
    const data = await res.json();
    hideLoading();

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      map.setView([lat, lon], 16);
    } else {
      alert(t('errSearch'));
    }
  } catch (err) {
    hideLoading();
    alert(t('errSearchSys'));
  }
}

// 設定モーダル
function openSettings() { document.getElementById('settings-modal').style.display = 'block'; }
function closeSettings() { document.getElementById('settings-modal').style.display = 'none'; }

// 設定の保存
async function saveSettings() {
  const nick = document.getElementById('input-nickname').value;
  if (nick) {
    userProfile.nickname = nick;
    document.getElementById('disp-nickname').innerText = nick;
    if (currentUser) {
      await db.collection('users').doc(currentUser.uid).update({ nickname: nick });
    }
  }
  closeSettings();
}

// グループ作成
async function createNewGroup() {
  const name = document.getElementById('input-create-group-name').value;
  if (!name) return;

  showLoading(t('loadingGroupCreate'));
  try {
    const ref = await db.collection('groups').add({
      name: name,
      createdBy: currentUser.uid,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    const newGroup = { id: ref.id, name: name };
    userProfile.groups = userProfile.groups || [];
    userProfile.groups.push(newGroup);

    await db.collection('users').doc(currentUser.uid).update({ groups: userProfile.groups });

    hideLoading();
    updateGroupDropdowns();
    alert(t('msgGroupCreated1') + name + t('msgGroupCreated2'));
  } catch (err) {
    hideLoading();
    alert(t('errGroupCreateFail') + err.message);
  }
}

// コメントモーダル
function openCommentModal(spotId) {
  activeCommentSpotId = spotId;
  document.getElementById('comment-modal').style.display = 'flex';
  loadComments(spotId);
}
function closeCommentModal() { document.getElementById('comment-modal').style.display = 'none'; }

// コメント読み込み
async function loadComments(spotId) {
  const container = document.getElementById('comment-list-container');
  container.innerHTML = '読み込み中...';

  const snapshot = await db.collection('spots').doc(spotId).collection('comments').orderBy('createdAt', 'asc').get();
  if (snapshot.empty) {
    container.innerHTML = `<div style="text-align:center; color:#999;">${t('noCommentsYet')}</div>`;
    return;
  }

  container.innerHTML = snapshot.docs.map(doc => {
    const c = doc.data();
    return `<div style="border-bottom:1px solid #eee; padding:6px 0;"><b>${c.nickname || t('anonymous')}</b>: ${c.text}</div>`;
  }).join('');
}

// コメント送信
async function submitComment() {
  const input = document.getElementById('input-new-comment');
  const text = input.value;
  if (!text || !activeCommentSpotId) return;

  await db.collection('spots').doc(activeCommentSpotId).collection('comments').add({
    text: text,
    nickname: userProfile.nickname || t('anonymous'),
    uid: currentUser.uid,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  input.value = '';
  loadComments(activeCommentSpotId);
}

// プライバシーモーダル
function openPrivacyModal() { document.getElementById('privacy-modal').style.display = 'block'; }
function closePrivacyModal() { document.getElementById('privacy-modal').style.display = 'none'; }

// ローディングインジケータ
function showLoading(text) {
  document.getElementById('loading-text').innerText = text;
  document.getElementById('loading').style.display = 'flex';
}
function hideLoading() {
  document.getElementById('loading').style.display = 'none';
}
