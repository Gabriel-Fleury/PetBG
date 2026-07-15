// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
   apiKey: "AIzaSyCjeOzUEdxgcfGgJ4W3y59UiZWF6PKatSg",
  authDomain: "petbg-6e0f9.firebaseapp.com",
  projectId: "petbg-6e0f9",
  storageBucket: "petbg-6e0f9.firebasestorage.app",
  messagingSenderId: "354733853626",
  appId: "1:354733853626:web:a3480d3e5353f5f3d5eb83"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app); // NOVO: exporta o serviço de autenticação