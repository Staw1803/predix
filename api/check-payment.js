import { verifyFirebaseToken } from './_utils.js';

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 1. Secure Route: Verify User Authentication Token
  try {
    const authHeader = req.headers['authorization'];
    const apiKeyFirebase = process.env.VITE_FIREBASE_API_KEY;
    await verifyFirebaseToken(authHeader, apiKeyFirebase);
  } catch (authError) {
    res.status(401).json({ error: authError.message || "Unauthorized" });
    return;
  }

  try {
    const { txid } = req.query;

    if (!txid) {
      res.status(400).json({ error: "Missing txid parameter." });
      return;
    }

    // Read Asaas credentials
    const asaasApiKey = process.env.ASAAS_API_KEY || '89db5943-51f1-41e6-8f5b-1c31bcc36b1c';
    
    // Default to Production URL, will fallback to Sandbox if token is invalid on Production
    let baseUrl = 'https://api.asaas.com/v3';

    // Helper to query payment status from Asaas
    const queryPayment = async (url) => {
      return fetch(`${url}/payments/${txid}`, {
        method: 'GET',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'PredixApp'
        }
      });
    };

    // Try querying Production
    let statusRes = await queryPayment(baseUrl);

    if (!statusRes.ok) {
      const errData = await statusRes.json().catch(() => ({}));
      const isInvalidToken = errData.errors && errData.errors.some(e => e.code === 'invalid_access_token');
      
      if (isInvalidToken) {
        // Fallback: Try Sandbox environment
        baseUrl = 'https://api-sandbox.asaas.com/v3';
        statusRes = await queryPayment(baseUrl);
      }
    }

    if (!statusRes.ok) {
      const errDetails = await statusRes.text();
      throw new Error(`Asaas API Key is invalid or rejected in both environments: ${errDetails}`);
    }

    const paymentData = await statusRes.json();
    
    // Asaas Paid status values: PAID, CONFIRMED, RECEIVED, RECEIVED_VIA_PIX
    const isPaid = ['RECEIVED', 'CONFIRMED', 'PAID', 'RECEIVED_VIA_PIX'].includes(paymentData.status);

    if (isPaid) {
      res.status(200).json({ status: 'CONCLUIDA' });
    } else {
      res.status(200).json({ status: 'ATIVA' });
    }

  } catch (error) {
    console.error("Asaas Payment status checking error:", error);
    res.status(500).json({ error: error.message || "Failed to check Asaas payment status." });
  }
}
