/**
 * Firebase Configuration
 * Memory Card Game - Multiplayer
 */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js';
import { getDatabase, ref, set, get, update, remove, onValue, onDisconnect, push, serverTimestamp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js';

const firebaseConfig = {
    apiKey: "AIzaSyAyMCEPSLc5LAo9KbaXn1DENJJV5earF7s",
    authDomain: "memory-3db05.firebaseapp.com",
    databaseURL: "https://memory-3db05-default-rtdb.firebaseio.com",
    projectId: "memory-3db05",
    storageBucket: "memory-3db05.firebasestorage.app",
    messagingSenderId: "949377224946",
    appId: "1:949377224946:web:67958e3737797bc1cd406b",
    measurementId: "G-TT06Z0TD7D"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

// Export for use in other modules
export {
    auth,
    db,
    signInAnonymously,
    onAuthStateChanged,
    ref,
    set,
    get,
    update,
    remove,
    onValue,
    onDisconnect,
    push,
    serverTimestamp
};
