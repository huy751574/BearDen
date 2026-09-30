import { createRemoteJWKSet, jwtVerify } from 'jose';

// Verifies a Firebase ID token (from Google sign-in in the game) so the room
// knows who is who. Google publishes the signing keys; jose caches them.

const JWKS = createRemoteJWKSet(
  new URL('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com'),
);

export interface Identity {
  uid: string;
  name: string;
}

export async function verifyFirebaseToken(token: string, projectId: string): Promise<Identity | null> {
  if (!token || !projectId) return null;
  try {
    const { payload } = await jwtVerify(token, JWKS, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });
    if (!payload.sub) return null;
    const name = typeof payload.name === 'string' && payload.name.trim() ? payload.name.trim() : 'Bear fan';
    return { uid: payload.sub, name: name.slice(0, 32) };
  } catch {
    return null;
  }
}
