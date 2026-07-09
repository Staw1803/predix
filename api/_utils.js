/**
 * Backend security helper to verify Firebase Auth ID Tokens (JWT)
 * using the Google Identity Toolkit API.
 */
export async function verifyFirebaseToken(authHeader, apiKey) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error("Unauthorized: Missing or malformed authentication token.");
  }
  
  const idToken = authHeader.substring(7);
  if (!idToken) {
    throw new Error("Unauthorized: Token value is empty.");
  }

  if (!apiKey) {
    throw new Error("Server Configuration Error: Missing Firebase API Key.");
  }

  const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken })
  });

  if (!response.ok) {
    throw new Error("Unauthorized: Invalid or expired authentication token.");
  }

  const data = await response.json();
  if (!data.users || data.users.length === 0) {
    throw new Error("Unauthorized: Firebase user not found.");
  }

  // Returns verified user profile (uid, email, displayName, etc.)
  return data.users[0];
}
