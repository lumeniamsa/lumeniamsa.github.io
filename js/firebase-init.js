/* ═══════════════════════════════════════════════════════════════
   Lumenia — Firebase Initialization
   SDK modulaire — compatible GitHub Pages (pas de bundler requis)
   ═══════════════════════════════════════════════════════════════ */

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import { getFirestore }  from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            'AIzaSyAIVM1-OeA4SRW24qBYknKDwsl9OCPWa0Y',
  authDomain:        'lumeniamsa-22edd.firebaseapp.com',
  projectId:         'lumeniamsa-22edd',
  storageBucket:     'lumeniamsa-22edd.firebasestorage.app',
  messagingSenderId: '57176949231',
  appId:             '1:57176949231:web:e6663a1b252176561b761a',
  measurementId:     'G-Q7YT90RY14'
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
