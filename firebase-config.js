const firebaseConfig = {
  apiKey: "AIzaSyA0ixB0Wj-rSo7X7VOUZZROP8lUZBj6vJg",
  authDomain: "my-toilet-app-3c2c3.firebaseapp.com",
  projectId: "my-toilet-app-3c2c3",
  storageBucket: "my-toilet-app-3c2c3.firebasestorage.app",
  messagingSenderId: "322835199622",
  appId: "1:322835199622:web:7e43f787b97a003d408307"
};

// Firebaseの初期化
const app = initializeApp(firebaseConfig);

// Analyticsの初期化（ブラウザ等の対応環境のみ実行）
let analytics;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
});
