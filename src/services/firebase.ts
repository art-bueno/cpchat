import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from 'firebase/app';
import { getAuth, getReactNativePersistence, initializeAuth, type Auth } from 'firebase/auth';
import { getDatabase, type Database } from 'firebase/database';
import { getFirestore, type Firestore } from 'firebase/firestore';
import rawConfig from '../../firebaseConfig.json';

type RequiredKey = 'apiKey' | 'authDomain' | 'databaseURL' | 'projectId' | 'storageBucket' | 'messagingSenderId' | 'appId';

type ClientFirebaseConfig = Required<Pick<FirebaseOptions, RequiredKey>>;

function assertConfig(config: Partial<Record<string, string>>): ClientFirebaseConfig {
  const read = (key: RequiredKey): string => {
    const value = config[key];
    if (!value) throw new Error(`firebaseConfig.json incompleto: falta "${key}".`);
    return value;
  };
  return {
    apiKey: read('apiKey'),
    authDomain: read('authDomain'),
    databaseURL: read('databaseURL'),
    projectId: read('projectId'),
    storageBucket: read('storageBucket'),
    messagingSenderId: read('messagingSenderId'),
    appId: read('appId'),
  };
}

const firebaseConfig = assertConfig(rawConfig);

export const app: FirebaseApp = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createAuth(): Auth {
  try {
    // Persiste a sessão no AsyncStorage → login é recuperado ao reabrir o app.
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch {
    // Fast Refresh: initializeAuth só pode ser chamado uma vez por app.
    return getAuth(app);
  }
}

export const auth: Auth = createAuth();
export const firestore: Firestore = getFirestore(app);
export const database: Database = getDatabase(app);
