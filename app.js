// --- 多言語・テキストフォールバック関数 ---
// t() 関数が未定義の場合のエラー防止用安全装置
if (typeof window.t !== 'function') {
  window.t = function(key) {
    const dictionary = {
      // 共通・UI系
      guest: 'ゲスト',
      anonymous: '匿名',
      optAll: 'すべて表示',
      optPublicOnly: '公開のみ',
      optPrivateOnly: '非公開のみ',
      optNoGroups: '参加しているグループがありません',
      optSelectGroup: '▼ グループを選択してください',
      optSelectGroupRec: '▼ 選択してください…',
      btnMap: '地図',
      btnNavi: 'ナビ',
      btnNaviMap: 'ナビ',
      btnDel: '削除',
      btnCopy: 'コピー',
      btnLeave: '脱退',
      btnComment: '💬 コメント',
      btnRecord: '📖 記録',
      
      // ラベル・バッジ系
      badgePrivateIcon: '🔒[非公開]',
      badgeGroupIcon: '👥[グループ:',
      badgePublicIcon: '🌐[公開]',
      badgePublic: '公開',
      badgePrivate: '非公開',
      badgeGroup: 'グループ: ',
      distCurrent: '現在地から: ',
      distPrefix: '距離: ',
      postedBy: '投稿者: ',
      sponsorPRTitle: 'スポンサーリンク',
      sponsorPRDesc: 'おすすめのドライブ・アウトドアグッズ',
      sponsorPRLink: 'Amazonでチェック',
      
      // トイレ設備タグ
      tagAccessible: '多目的',
      tagBaby: 'オムツ台',
      tagWashlet: '温水洗浄便座',
      tagWestern: '洋式',
      tagOpen24h: '24時間',
      tagFacility: '施設/コンビニ',
      tagStation: '駅',
      tagParking: '駐車場',

      // 投稿・記録の定型文
      textHours: '営業時間: ',
      textCleanliness: ' / 清潔度: ',
      textUnknown: '不明',
      textNone: '-',
      noComment: 'コメントなし',
      noCommentsYet: 'コメントはまだありません',
      
      // システム・ローディングメッセージ
      loadingSearch: '場所を検索中...',
      loadingConnect: '通信中...',
      loadingSave: 'データを保存中...',
      loadingImage: '画像を圧縮・アップロード中...',
      loadingDelete: 'データを削除中...',
      loadingBulkDelete: '一括削除中...',
      loadingGroupCreate: 'グループを作成中...',
      loadingGroupJoin: 'グループを検索中...',
      
      // アラート・エラー系
      errAuth: '認証エラー: ',
      errSearch: '場所が見つかりませんでした。',
      errSearchSys: '検索中にエラーが発生しました。',
      errNotFound: '対象のデータが見つかりません。',
      errRefFail: '参照の取得に失敗しました。',
      errNotOwner: '自分が投稿したデータのみ削除できます。',
      errDeleteFail: '削除に失敗しました: ',
      errBulkFail: '一括削除中にエラーが発生しました: ',
      errNoLocation: '位置情報が取得できません。もう一度ピンを立ててください。',
      errGroupCreateFail: 'グループ作成エラー: ',
      errGroupJoinFail: 'グループ参加エラー: ',
      errCommentFail: 'コメント送信失敗: ',
      alertWait: '認証処理中です。少々お待ちください。',
      alertNoGroupForPost: '投稿先のグループが選択されていないか、所属していません。',
      alertSaveFail: '保存に失敗しました: ',
      alertCheckDel: '削除したい項目にチェックを入れてください。',
      alertGroupNameReq: 'グループ名を入力してください',
      alertGroupIdReq: 'グループIDを入力してください',
      alertGroupAlready: 'すでにそのグループに参加しています',
      alertGroupNotFound: '指定されたIDのグループが見つかりません',
      alertSelectGroup: '共有するグループを選択してください。',
      alertCommentReq: 'コメントを入力してください',
      
      // 成功メッセージ・確認
      msgRegSuccess: 'トイレ情報を登録しました！ご協力ありがとうございます。',
      msgRecordSuccess: '思い出を記録しました！',
      confirmDelete: '本当に削除しますか？',
      confirmBulkDelete1: '選択した ',
      confirmBulkDelete2: ' 件のデータを削除しますか？',
      confirmLeaveGroup: '本当にこのグループから脱退しますか？',
      msgLocNotSupported: 'お使いのブラウザは位置情報をサポートしていません。',
      msgLocFail: '位置情報の取得に失敗しました。',
      msgCopyOk: 'グループIDをクリップボードにコピーしました',
      msgCopyFail: 'コピーに失敗しました',
      msgGroupCreated1: 'グループ「',
      msgGroupCreated2: '」を作成しました',
      msgGroupJoined1: 'グループ「',
      msgGroupJoined2: '」に参加しました',
      msgSettingsSaved: '設定を保存しました',

      // UI表示
      currentLocationPopup: '現在地',
      popupDragAdjust: 'ドラッグして位置を調整できます',
      emptyList: '表示できるトイレ情報がありません。',
      noJoinedGroups: '参加しているグループはありません'
    };
    return dictionary[key] || key;
  };
}

const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage();

let currentUid = null;
let myNickname = localStorage.getItem('user_nickname') || ''; 
let myGroups = [];
let currentCommentSpot = null;

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
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getGroupName(groupId) {
  const group = myGroups.find(g => g.id === groupId);
  return group ? group.name : groupId; 
}

function changeDisplayGroup() {
  const selectEl = document.getElementById('disp-group-select');
  if (selectEl) {
    currentDisplayGroup = selectEl.value;
  }
  refreshMapAndList();
}

function updateProfileUI() {
  const nicknameEl = document.getElementById('disp-nickname');
  if (nicknameEl) {
    nicknameEl.innerText = myNickname || t('guest');
  }
  const groupSelect = document.getElementById('disp-group-select');
  if (!groupSelect) return;

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
  const recGroupSelect = document.getElementById('rec-target-group');
  if (recGroupSelect) {
    let recOptionsHtml = `<option value="" disabled selected>${t('optSelectGroupRec')}</option>`;
    myGroups.forEach(g => {
      recOptionsHtml += `<option value="${escapeHTML(g.id)}">${escapeHTML(g.name)}</option>`;
    });
    recGroupSelect.innerHTML = recOptionsHtml;
  }
}

const DEFAULT_LAT = 35.6812;
const DEFAULT_LNG = 139.7671;
const map = L.map('map').setView([DEFAULT_LAT, DEFAULT_LNG], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }).addTo(map);

let tempMarker = null;
let allSpots = [];
let activeMarkers = {};
let currentLat = null;
let currentLng = null;
let currentMarker = null;
let unsubscribers = [];

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
  let className = 'custom-pin pin-public';
  let iconSymbol = '🚽';
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
  const p1 = L.latLng(currentLat, currentLng);
  const p2 = L.latLng(lat2, lng2);
  const meters = p1.distanceTo(p2);
  return meters < 1000 ? `${Math.round(meters)}m` : `${(meters / 1000).toFixed(1)}km`;
}

function getDistanceMeters(lat2, lng2) {
  if (!currentLat || !currentLng) return Infinity;
  return L.latLng(currentLat, currentLng).distanceTo(L.latLng(lat2, lng2));
}

async function searchLocation() {
  const searchInput = document.getElementById('input-search-location');
  if (!searchInput) return;
  const query = searchInput.value;
  if (!query) return;

  const loadingText = document.getElementById('loading-text');
  const loadingEl = document.getElementById('loading');
  if (loadingText) loadingText.innerText = t('loadingSearch');
  if (loadingEl) loadingEl.style.display = 'flex';

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
    if (loadingEl) loadingEl.style.display = 'none';
    if (loadingText) loadingText.innerText = t('loadingConnect');
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
        let width = img.width; 
        let height = img.height;
        if (width > maxWidth) { 
          height = Math.round((height * maxWidth) / width); 
          width = maxWidth; 
        }
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
    const loadingEl = document.getElementById('loading');
    if (loadingEl) loadingEl.style.display = 'none';
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
    let isVisibleByGroup = true;
    if (currentDisplayGroup === 'publicOnly') isVisibleByGroup = (spot.privacy === 'public');
    else if (currentDisplayGroup === 'privateOnly') isVisibleByGroup = (spot.privacy === 'private');
    else if (currentDisplayGroup !== 'all') isVisibleByGroup = (spot.privacy === 'group' && spot.groupId === currentDisplayGroup);

    const matchesFilter = activeFilters.every(f => {
      if (f === 'privateOnly') return spot.privacy === 'private';
      return spot.features && spot.features[f] === true;
    });

    if (isVisibleByGroup && matchesFilter) addMarkerToMap(spot);
  });

  const listView = document.getElementById('list-view');
  if (listView && listView.style.display === 'block') renderList();
}

function toggleFilter(el) {
  const feature = el.getAttribute('data-feature');
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
  let html = '<div class="tag-container">';
  if (features.accessible) html += `<span class="feature-tag">${t('tagAccessible')}</span>`;
  if (features.baby) html += `<span class="feature-tag">${t('tagBaby')}</span>`;
  if (features.washlet) html += `<span class="feature-tag">${t('tagWashlet')}</span>`;
  if (features.western) html += `<span class="feature-tag">${t('tagWestern')}</span>`;
  if (features.open24h) html += `<span class="feature-tag">${t('tagOpen24h')}</span>`;
  if (features.facility) html += `<span class="feature-tag">${t('tagFacility')}</span>`;
  if (features.station) html += `<span class="feature-tag">${t('tagStation')}</span>`;
  if (features.parking) html += `<span class="feature-tag">${t('tagParking')}</span>`;
  html += '</div>';
  return html;
}

function addMarkerToMap(spot) {
  if (!spot.lat || !spot.lng) return;

  const stars = '★'.repeat(spot.rating || 3) + '☆'.repeat(5 - (spot.rating || 3));
  let badgeHtml = '';
  if (spot.privacy === 'private') {
    badgeHtml = `<span style="color:#6f42c1;">${t('badgePrivateIcon')}</span>`;
  } else if (spot.privacy === 'group') {
    const groupName = escapeHTML(getGroupName(spot.groupId));
    badgeHtml = `<span style="color:green;">${t('badgeGroupIcon')}${groupName}]</span>`;
  } else {
    badgeHtml = `<span style="color:orange;">${t('badgePublicIcon')}</span>`;
  }

  const tagsHtml = renderFeatureTags(spot.features);
  const safeImgUrl = escapeHTML(spot.imageUrl);
  const imgHtml = safeImgUrl ? `<img src="${safeImgUrl}" class="spot-img" onclick="window.open('${safeImgUrl}')">` : '';
  const distStr = calculateDistanceStr(spot.lat, spot.lng);
  const distHtml = distStr ? `<div style="font-size:11px; color:#007bff; font-weight:bold; margin-bottom:4px;">${t('distCurrent')}${distStr}</div>` : '';
  const isOwner = spot.userId === currentUid;
  const deleteBtnHtml = isOwner ? `<button style="flex:1; padding:5px 2px; background:#ff4444; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;" onclick="deleteSpot('${spot.docId}')">${t('btnDel')}</button>` : '';

  const popupContent = `
    <div style="font-size:13px; min-width:170px; max-width:210px;">
      ${badgeHtml} <b>${escapeHTML(spot.userName || t('anonymous'))}</b><br>
      <span style="color:#ffca08; font-size:14px;">${stars}</span><br>
      ${distHtml}
      ${tagsHtml}
      ${imgHtml}
      <b>${escapeHTML(spot.comment || t('noComment'))}</b><br><br>
      <div style="display:flex; gap:4px;">
        <button style="flex:1; padding:5px 2px; background:#28a745; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;" onclick="openNavigation(${spot.lat}, ${spot.lng})">${t('btnNaviMap')}</button>
        <button style="flex:1; padding:5px 2px; background:#007bff; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;" onclick="openCommentModal('${spot.docId}')">${t('btnComment')}</button>
        <button style="flex:1; padding:5px 2px; background:#17a2b8; color:white; border:none; border-radius:4px; cursor:pointer; font-weight:bold; font-size:11px;" onclick="openRecordForm('${spot.docId}')">${t('btnRecord')}</button>
        ${deleteBtnHtml}
      </div>
    </div>
  `;

  const marker = L.marker([spot.lat, spot.lng], { icon: createIcon(spot.privacy) }).bindPopup(popupContent);
  marker.addTo(map);
  activeMarkers[spot.docId] = marker;
}

// --- 🚻 トイレ登録の保存処理 ---
async function saveRegisterData() {
  if (!currentUid) { alert(t('alertWait')); return; }
  if (!tempMarker) { alert(t('errNoLocation')); return; }

  const fileInput = document.getElementById('reg-photo');
  const rawFile = fileInput ? fileInput.files[0] : null;
  const rating = document.querySelector('input[name="reg-rating"]:checked')?.value || 3;
  const hours = document.getElementById('reg-hours')?.value || '';
  const cleanliness = document.getElementById('reg-cleanliness')?.value || '';
  const congestion = document.getElementById('reg-congestion')?.value || '';

  const loadingText = document.getElementById('loading-text');
  const loadingEl = document.getElementById('loading');
  if (loadingText) loadingText.innerText = t('loadingSave');
  if (loadingEl) loadingEl.style.display = 'flex';

  try {
    const lat = tempMarker.getLatLng().lat;
    const lng = tempMarker.getLatLng().lng;
    const features = {
      accessible: document.getElementById('reg-accessible')?.checked || false,
      baby: document.getElementById('reg-baby')?.checked || false,
      washlet: document.getElementById('reg-washlet')?.checked || false,
      western: document.getElementById('reg-western')?.checked || false,
      open24h: document.getElementById('reg-open24h')?.checked || false,
      facility: document.getElementById('reg-facility')?.checked || false,
      station: document.getElementById('reg-station')?.checked || false,
      parking: document.getElementById('reg-parking')?.checked || false
    };

    let imageUrl = ''; let imagePath = ''; 
    if (rawFile) {
      if (loadingText) loadingText.innerText = t('loadingImage');
      const compressedBlob = await compressImage(rawFile, 1024, 0.75);
      imagePath = `toilet_photos/${currentUid}/${Date.now()}.jpg`;
      const storageRef = storage.ref(imagePath);
      const snapshot = await storageRef.put(compressedBlob);
      imageUrl = await snapshot.ref.getDownloadURL();
    }

    const commentText = `${t('textHours')}${hours || t('textUnknown')}${t('textCleanliness')}${cleanliness || t('textNone')}`;

    const newSpot = {
      lat: lat, lng: lng, rating: parseInt(rating), comment: commentText,
      privacy: 'public', groupId: null,
      userName: myNickname || t('guest'), userId: currentUid, imageUrl: imageUrl, imagePath: imagePath,
      features: features, hours: hours, cleanliness: cleanliness, congestion: congestion,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('toiletSpots').add(newSpot);

    closeForms();
    resetRegisterInputs();
    alert(t('msgRegSuccess'));
  } catch (error) {
    alert(t('alertSaveFail') + error.message);
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
    if (loadingText) loadingText.innerText = t('loadingConnect');
  }
}

// --- 📖 トイレ記録（自分の思い出）の保存処理 ---
async function saveRecordData() {
  if (!currentUid) { alert(t('alertWait')); return; }

  const targetToiletId = document.getElementById('rec-target-toilet-id')?.value;
  let lat = null, lng = null;

  if (!targetToiletId) {
    if (!tempMarker) { alert(t('errNoLocation')); return; }
    lat = tempMarker.getLatLng().lat;
    lng = tempMarker.getLatLng().lng;
  } else {
    const targetSpot = allSpots.find(s => s.docId === targetToiletId);
    if (targetSpot) {
      lat = targetSpot.lat;
      lng = targetSpot.lng;
    }
  }

  const fileInput = document.getElementById('rec-photo');
  const rawFile = fileInput ? fileInput.files[0] : null;
  const rating = document.querySelector('input[name="rec-rating"]:checked')?.value || 3;
  const privacyEl = document.querySelector('input[name="rec-privacy"]:checked');
  const privacy = privacyEl ? privacyEl.value : 'private';
  const date = document.getElementById('rec-date')?.value || '';
  const companion = document.getElementById('rec-companion')?.value || '';
  const memo = document.getElementById('rec-memo')?.value || '';

  let targetGroup = null;
  if (privacy === 'group') {
    if (myGroups.length === 0) {
      alert(t('alertNoGroupForPost'));
      return;
    }
    const groupSelect = document.getElementById('rec-target-group');
    targetGroup = groupSelect ? groupSelect.value : '';
    if (!targetGroup) {
      alert(t('alertSelectGroup'));
      return;
    }
  }

  const loadingText = document.getElementById('loading-text');
  const loadingEl = document.getElementById('loading');
  if (loadingText) loadingText.innerText = t('loadingSave');
  if (loadingEl) loadingEl.style.display = 'flex';

  try {
    let imageUrl = ''; let imagePath = ''; 
    if (rawFile) {
      if (loadingText) loadingText.innerText = t('loadingImage');
      const compressedBlob = await compressImage(rawFile, 1024, 0.75);
      imagePath = `record_photos/${currentUid}/${Date.now()}.jpg`;
      const storageRef = storage.ref(imagePath);
      const snapshot = await storageRef.put(compressedBlob);
      imageUrl = await snapshot.ref.getDownloadURL();
    }

    const newRecord = {
      lat: lat, lng: lng, toiletId: targetToiletId || null,
      rating: parseInt(rating),
      privacy: privacy, groupId: targetGroup,
      date: date, companion: companion, comment: memo,
      userName: myNickname || t('guest'), userId: currentUid, imageUrl: imageUrl, imagePath: imagePath,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    };

    if (privacy === 'public') {
      await db.collection('toiletSpots').add(newRecord);
    } else if (privacy === 'group') {
      await db.collection('groups').doc(targetGroup).collection('toiletSpots').add(newRecord);
    } else if (privacy === 'private') {
      await db.collection('users').doc(currentUid).collection('toiletSpots').add(newRecord);
    }

    closeForms();
    resetRecordInputs();
    alert(t('msgRecordSuccess'));
  } catch (error) {
    alert(t('alertSaveFail') + error.message);
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
    if (loadingText) loadingText.innerText = t('loadingConnect');
  }
}

function resetRegisterInputs() {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  setVal('reg-hours', '');
  setVal('reg-cleanliness', '');
  setVal('reg-congestion', '');
  setVal('reg-photo', '');
  setCheck('reg-accessible', false);
  setCheck('reg-baby', false);
  setCheck('reg-washlet', false);
  setCheck('reg-western', false);
  setCheck('reg-open24h', false);
  setCheck('reg-facility', false);
  setCheck('reg-station', false);
  setCheck('reg-parking', false);
}

function resetRecordInputs() {
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  setVal('rec-date', '');
  setVal('rec-companion', '');
  setVal('rec-memo', '');
  setVal('rec-photo', '');
  setVal('rec-target-toilet-id', '');
}

function getDocRef(spot) {
  if (spot.pathType === 'public') return db.collection('toiletSpots').doc(spot.docId);
  else if (spot.pathType === 'group') return db.collection('groups').doc(spot.groupId).collection('toiletSpots').doc(spot.docId);
  else if (spot.pathType === 'private') return db.collection('users').doc(currentUid).collection('toiletSpots').doc(spot.docId);
  return null;
}

async function deleteSpot(docId) {
  if (confirm(t('confirmDelete'))) {
    const loadingText = document.getElementById('loading-text');
    const loadingEl = document.getElementById('loading');
    if (loadingText) loadingText.innerText = t('loadingDelete');
    if (loadingEl) loadingEl.style.display = 'flex';

    try {
      const spot = allSpots.find(s => s.docId === docId);
      if (!spot) throw new Error(t('errNotFound'));
      const docRef = getDocRef(spot);
      if (!docRef) throw new Error(t('errRefFail'));

      const docSnap = await docRef.get();
      if (docSnap.exists) {
        if (docSnap.data().userId !== currentUid) { alert(t('errNotOwner')); return; }
        if (docSnap.data().imagePath) { 
          try { await storage.ref(docSnap.data().imagePath).delete(); } catch (e) { console.error(e); } 
        }
        await docRef.delete();
      }
    } catch (error) {
      alert(t('errDeleteFail') + error.message);
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
      if (loadingText) loadingText.innerText = t('loadingConnect');
    }
  }
}

async function deleteSelectedSpots() {
  const checkboxes = document.querySelectorAll('.spot-checkbox:checked');
  if (checkboxes.length === 0) { alert(t('alertCheckDel')); return; }
  if (!confirm(`${t('confirmBulkDelete1')}${checkboxes.length}${t('confirmBulkDelete2')}`)) return;

  const loadingText = document.getElementById('loading-text');
  const loadingEl = document.getElementById('loading');
  if (loadingText) loadingText.innerText = t('loadingBulkDelete');
  if (loadingEl) loadingEl.style.display = 'flex';

  try {
    for (const cb of checkboxes) {
      const spot = allSpots.find(s => s.docId === cb.value);
      if (spot && spot.userId === currentUid) {
        const docRef = getDocRef(spot);
        if (docRef) {
          if (spot.imagePath) { 
            try { await storage.ref(spot.imagePath).delete(); } catch (e) { console.error(e); } 
          }
          await docRef.delete();
        }
      }
    }
  } catch (error) { 
    alert(t('errBulkFail') + error.message);
  } finally {
    if (loadingEl) loadingEl.style.display = 'none';
    if (loadingText) loadingText.innerText = t('loadingConnect');
  }
}

function switchTab(tabName) {
  const mapEl = document.getElementById('map');
  const fabEl = document.getElementById('fab-container');
  const listEl = document.getElementById('list-view');
  const navMap = document.getElementById('nav-map');
  const navList = document.getElementById('nav-list');

  if (tabName === 'map') {
    if (mapEl) mapEl.style.display = 'block';
    if (fabEl) fabEl.style.display = 'flex';
    if (listEl) listEl.style.display = 'none';
    if (navMap) navMap.classList.add('active');
    if (navList) navList.classList.remove('active');
    map.invalidateSize();
  } else {
    if (mapEl) mapEl.style.display = 'none';
    if (fabEl) fabEl.style.display = 'none';
    if (listEl) listEl.style.display = 'block';
    if (navList) navList.classList.add('active');
    if (navMap) navMap.classList.remove('active');
    renderList();
  }
}

function renderList() {
  const container = document.getElementById('list-container');
  if (!container) return;

  const searchBox = document.getElementById('search-box');
  const searchQuery = searchBox ? searchBox.value.toLowerCase() : '';
  const sortBox = document.getElementById('sort-box');
  const sortMethod = sortBox ? sortBox.value : 'newest';

  const filtered = allSpots.filter(spot => {
    let isVisibleByGroup = true;
    if (currentDisplayGroup === 'publicOnly') isVisibleByGroup = (spot.privacy === 'public');
    else if (currentDisplayGroup === 'privateOnly') isVisibleByGroup = (spot.privacy === 'private');
    else if (currentDisplayGroup !== 'all') isVisibleByGroup = (spot.privacy === 'group' && spot.groupId === currentDisplayGroup);

    const matchesText = (spot.comment || '').toLowerCase().includes(searchQuery) || (spot.userName || '').toLowerCase().includes(searchQuery);
    const matchesFilter = activeFilters.every(f => {
      if (f === 'privateOnly') return spot.privacy === 'private';
      return spot.features && spot.features[f] === true;
    });

    return isVisibleByGroup && matchesText && matchesFilter;
  });

  filtered.sort((a, b) => {
    if (sortMethod === 'highest') return (b.rating || 0) - (a.rating || 0);
    else if (sortMethod === 'nearest') return getDistanceMeters(a.lat, a.lng) - getDistanceMeters(b.lat, b.lng);
    else {
      const getTime = item => {
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

  let html = '';
  filtered.forEach((spot, index) => {
    const stars = '★'.repeat(spot.rating || 3) + '☆'.repeat(5 - (spot.rating || 3));
    let badgeClass = 'badge-public'; 
    let badgeText = t('badgePublic');
    
    if (spot.privacy === 'private') { badgeClass = 'badge-private'; badgeText = t('badgePrivate'); }
    else if (spot.privacy === 'group') { badgeClass = 'badge-group'; badgeText = `${t('badgeGroup')}${escapeHTML(getGroupName(spot.groupId))}`; }

    const tagsHtml = renderFeatureTags(spot.features);
    const safeImgUrl = escapeHTML(spot.imageUrl);
    const imgHtml = safeImgUrl ? `<img src="${safeImgUrl}" class="spot-img" onclick="window.open('${safeImgUrl}')">` : '';
    const distStr = calculateDistanceStr(spot.lat, spot.lng);
    const distBadge = distStr ? `<span class="distance-tag">${t('distPrefix')}${distStr}</span>` : '';
    const isOwner = spot.userId === currentUid;
    const deleteBtnHtml = isOwner ? `<button class="btn-action btn-delete" onclick="deleteSpot('${spot.docId}')">${t('btnDel')}</button>` : '';

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
        <div class="list-comment"><b>${escapeHTML(spot.comment || t('noComment')).replace(/\n/g, '<br>')}</b></div>
        <div class="list-user">${t('postedBy')}<b>${escapeHTML(spot.userName || t('anonymous'))}</b></div>
        <div class="list-actions">
          <button class="btn-action btn-map" onclick="viewOnMap('${spot.docId}')">${t('btnMap')}</button>
          <button class="btn-action btn-nav" onclick="openNavigation(${spot.lat}, ${spot.lng})">${t('btnNavi')}</button>
          <button class="btn-action" style="background:#007bff; color:white;" onclick="openCommentModal('${spot.docId}')">${t('btnComment')}</button>
          <button class="btn-action" style="background:#17a2b8; color:white;" onclick="openRecordForm('${spot.docId}')">${t('btnRecord')}</button>
          ${deleteBtnHtml}
        </div>
      </div>
    `;
  });
  container.innerHTML = html;
}

function viewOnMap(docId) {
  switchTab('map');
  const target = allSpots.find(s => s.docId === docId);
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

const locateControl = L.control({ position: 'topright' });
locateControl.onAdd = function(map) {
  const div = L.DomUtil.create('div', 'leaflet-bar leaflet-control');
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
  openRegisterForm();
});

// --- フォーム開閉用ヘルパー（フォームが下に隠れないように中央位置をオフセット調整） ---
function openRegisterForm() {
  closeForms();
  const center = map.getCenter();
  if (tempMarker) map.removeLayer(tempMarker);
  tempMarker = L.marker(center, { draggable: true }).addTo(map);
  tempMarker.bindPopup(t('popupDragAdjust')).openPopup();
  
  const form = document.getElementById('input-form-register');
  if (form) form.style.display = 'block';
  
  setTimeout(() => {
    map.invalidateSize();
    map.panBy([0, 150], { animate: true }); // 下部のフォームに隠れないよう地図をずらす
  }, 50);
}

function openRecordForm(toiletId = null) {
  closeForms();
  const recIdEl = document.getElementById('rec-target-toilet-id');
  if (recIdEl) recIdEl.value = toiletId || '';
  
  if (!toiletId) {
    const center = map.getCenter();
    if (tempMarker) map.removeLayer(tempMarker);
    tempMarker = L.marker(center, { draggable: true }).addTo(map);
    tempMarker.bindPopup(t('popupDragAdjust')).openPopup();
  }
  
  const groupSelect = document.getElementById('rec-group-select');
  if (groupSelect) {
    if (myGroups.length === 0) {
      groupSelect.innerHTML = `<option value="" disabled>${t('optNoGroups')}</option>`;
    } else {
      let optionsHtml = `<option value="" disabled selected>${t('optSelectGroup')}</option>`;
      myGroups.forEach(g => {
        optionsHtml += `<option value="${g.id}">${g.name}</option>`;
      });
      groupSelect.innerHTML = optionsHtml;
    }
  }

  const form = document.getElementById('input-form-record');
  if (form) form.style.display = 'block';
  
  setTimeout(() => {
    map.invalidateSize();
    map.panBy([0, 150], { animate: true }); // 下部のフォームに隠れないよう地図をずらす
  }, 50);
}

function closeForms() {
  const regForm = document.getElementById('input-form-register');
  const recForm = document.getElementById('input-form-record');
  if (regForm) regForm.style.display = 'none';
  if (recForm) recForm.style.display = 'none';
  if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }
}

document.addEventListener('change', function(e) {
  if (e.target && e.target.name === 'rec-privacy') {
    const groupSection = document.getElementById('rec-group-section');
    if (groupSection) {
      if (e.target.value === 'group') {
        groupSection.style.display = 'block'; // 「グループ」を選んだら表示
      } else {
        groupSection.style.display = 'none';  // それ以外なら隠す
      }
    }
  }
});

function renderGroupSettings() {
  const container = document.getElementById('group-list-container');
  if (!container) return;

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
  if (!input) return;
  const groupName = input.value.trim();
  if (!groupName) { alert(t('alertGroupNameReq')); return; }

  const loadingText = document.getElementById('loading-text');
  const loadingEl = document.getElementById('loading');
  if (loadingText) loadingText.innerText = t('loadingGroupCreate');
  if (loadingEl) loadingEl.style.display = 'flex';

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
    if (loadingEl) loadingEl.style.display = 'none';
  }
}

async function joinGroupById() {
  const input = document.getElementById('input-join-group-id');
  if (!input) return;
  const groupId = input.value.trim();
  if (!groupId) { alert(t('alertGroupIdReq')); return; }

  if (myGroups.some(g => g.id === groupId)) {
    alert(t('alertGroupAlready'));
    return;
  }

  const loadingText = document.getElementById('loading-text');
  const loadingEl = document.getElementById('loading');
  if (loadingText) loadingText.innerText = t('loadingGroupJoin');
  if (loadingEl) loadingEl.style.display = 'flex';

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
    if (loadingEl) loadingEl.style.display = 'none';
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
  const nickInput = document.getElementById('input-nickname');
  if (nickInput) nickInput.value = myNickname;
  renderGroupSettings();
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.add('open');
}

function closeSettings() { 
  const modal = document.getElementById('settings-modal');
  if (modal) modal.classList.remove('open'); 
}

function openPrivacyModal() { 
  const modal = document.getElementById('privacy-modal');
  if (modal) modal.classList.add('open'); 
}

function closePrivacyModal() { 
  const modal = document.getElementById('privacy-modal');
  if (modal) modal.classList.remove('open'); 
}

function saveSettings() {
  const nickInput = document.getElementById('input-nickname');
  myNickname = nickInput ? nickInput.value : '';
  localStorage.setItem('user_nickname', myNickname);
  updateProfileUI();
  closeSettings();
  alert(t('msgSettingsSaved'));
}

// --- コメント機能 ---
function openCommentModal(spotId) {
  const spot = allSpots.find(s => s.docId === spotId);
  if (!spot) return;

  currentCommentSpot = spot;
  const modal = document.getElementById('comment-modal');
  if (modal) modal.style.display = 'flex';
  loadComments(spot);
}

function closeCommentModal() {
  const modal = document.getElementById('comment-modal');
  if (modal) modal.style.display = 'none';
  currentCommentSpot = null;
}

async function submitComment() {
  const input = document.getElementById('input-new-comment');
  if (!input) return;
  const text = input.value.trim();
  
  if (!text) {
    alert(t('alertCommentReq'));
    return;
  }
  if (!currentCommentSpot) return;

  const baseRef = getDocRef(currentCommentSpot);
  if (!baseRef) return;

  try {
    await baseRef.collection('comments').add({
      userId: currentUid,
      userName: myNickname || t('guest'),
      text: text,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
    input.value = '';
  } catch (e) {
    alert(t('errCommentFail') + e.message);
  }
}

function loadComments(spot) {
  const container = document.getElementById('comment-list-container');
  if (!container) return;
  container.innerHTML = `<div style="padding:10px; text-align:center;">${t('loadingConnect')}</div>`;

  const baseRef = getDocRef(spot);
  if (!baseRef) return;

  baseRef.collection('comments').orderBy('createdAt', 'desc').onSnapshot(snap => {
    if (snap.empty) {
      container.innerHTML = `<div style="padding:10px; text-align:center; color:#888;">${t('noCommentsYet')}</div>`;
      return;
    }
    
    let html = '';
    snap.docs.forEach(doc => {
      const c = doc.data();
      html += `
        <div style="border-bottom: 1px solid #eee; padding: 6px 0;">
          <b style="font-size:12px; color:#555;">${escapeHTML(c.userName || t('anonymous'))}</b><br>
          <span style="font-size:14px; color:#333;">${escapeHTML(c.text)}</span>
        </div>
      `;
    });
    container.innerHTML = html;
  });
}
