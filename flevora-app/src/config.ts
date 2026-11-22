import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';
// @ts-ignore
import { initializeAuth, getAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';

const firebaseConfig = {
  apiKey: "AIzaSyBV63crlJvOorayDbWoeP4bbtDF0VNxGHE",
    authDomain: "flevora-fb8bb.firebaseapp.com",
      projectId: "flevora-fb8bb",
        storageBucket: "flevora-fb8bb.firebasestorage.app",
          messagingSenderId: "506028452820",
            appId: "1:506028452820:web:9e55311c930213f71d0441",
              measurementId: "G-XSFTNG7H0V",
              };

              const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

              let auth: Auth;
              try {
                auth = initializeAuth(app, {
                    persistence: getReactNativePersistence(ReactNativeAsyncStorage),
                      });
                      } catch {
                        auth = getAuth(app);
                        }

                        let db: Firestore;
                        try {
                          db = initializeFirestore(app, { experimentalForceLongPolling: true });
                          } catch {
                            db = getFirestore(app);
                            }

                            export const CLOUDINARY_CLOUD_NAME = "faqfo0lu";
                            export const CLOUDINARY_UPLOAD_PRESET = "flevora_upload";

                            export { app, auth, db };
                            