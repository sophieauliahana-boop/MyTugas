import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc, setDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  setGroupId: (id: string) => Promise<void>;
  updateSettings: (settings: Partial<UserProfile['settings']>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, async (u) => {
      setUser(u);
      if (u) {
        // Sync profile
        const userDocRef = doc(db, 'users', u.uid);
        
        const unsubscribe = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            setProfile(docSnap.data() as UserProfile);
          } else {
            // Create default profile
            const defaultProfile: UserProfile = {
              uid: u.uid,
              displayName: u.displayName || 'User',
              photoURL: u.photoURL || '',
              groupId: '',
              role: 'member',
              settings: {
                notificationLeadTime: 10,
                ringtone: 'classic',
                vibration: true
              }
            };
            setDoc(userDocRef, defaultProfile);
            setProfile(defaultProfile);
          }
          setLoading(false);
        });
        return unsubscribe;
      } else {
        setProfile(null);
        setLoading(false);
      }
    });
  }, []);

  const setGroupId = async (id: string) => {
    if (!user) return;
    await setDoc(doc(db, 'users', user.uid), { groupId: id }, { merge: true });
  };

  const updateSettings = async (settings: Partial<UserProfile['settings']>) => {
    if (!user || !profile) return;
    await setDoc(doc(db, 'users', user.uid), { 
      settings: { ...profile.settings, ...settings } 
    }, { merge: true });
  };

  return (
    <AuthContext.Provider value={{ user, profile, loading, setGroupId, updateSettings }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
