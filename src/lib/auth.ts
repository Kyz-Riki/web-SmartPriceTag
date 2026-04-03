// src/lib/auth.ts
// Firebase Authentication helper functions

import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import { auth } from "./firebase";

/**
 * Sign in with email and password.
 * Throws a Firebase AuthError on failure — the caller should handle error codes.
 */
export async function signIn(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Sign out the current user.
 */
export async function signOut() {
  return firebaseSignOut(auth);
}

/**
 * Subscribe to auth state changes.
 * Returns an unsubscribe function.
 *
 * @example
 *   const unsub = onAuthStateChange((user) => { ... });
 *   return () => unsub(); // cleanup in useEffect
 */
export function onAuthStateChange(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

/** Get the currently signed-in user (synchronous, may be null). */
export function getCurrentUser(): User | null {
  return auth.currentUser;
}
