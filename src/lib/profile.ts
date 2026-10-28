/**
 * Who the user is, for Polish: verbs carry gender and "Pan/Pani" or "ty" sets the register.
 * Remembered in this browser only; it is sent with the session so the character can address the user correctly.
 */
export interface UserProfile {
  gender: 'm' | 'f';
  formal: boolean;
}

const KEY = 'sl.user.v1';

export function loadUser(): UserProfile {
  try {
    const p = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<UserProfile> | null;
    if (p && (p.gender === 'm' || p.gender === 'f')) return { gender: p.gender, formal: Boolean(p.formal) };
  } catch {
    /* blocked or corrupt storage: use the defaults */
  }
  return { gender: 'm', formal: false };
}

export function saveUser(user: UserProfile) {
  try {
    localStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    /* the choice just is not remembered */
  }
}
