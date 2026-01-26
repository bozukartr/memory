// Firebase Configuration
// =====================
// Bu dosyadaki placeholder değerlerini kendi Firebase projenizin bilgileriyle değiştirin.
// Firebase Console: https://console.firebase.google.com/

const firebaseConfig = {
    apiKey: "AIzaSyAyMCEPSLc5LAo9KbaXn1DENJJV5earF7s",
    authDomain: "memory-3db05.firebaseapp.com",
    projectId: "memory-3db05",
    storageBucket: "memory-3db05.firebasestorage.app",
    messagingSenderId: "949377224946",
    appId: "1:949377224946:web:67958e3737797bc1cd406b",
    measurementId: "G-TT06Z0TD7D"
};

// Firebase'i başlat
firebase.initializeApp(firebaseConfig);

// Realtime Database referansı
const database = firebase.database();

// Bağlantı durumu kontrolü
const connectedRef = database.ref('.info/connected');

console.log('Firebase initialized');
