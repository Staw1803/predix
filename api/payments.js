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
    const { transaction_amount, description } = req.body;
    
    if (!transaction_amount) {
      res.status(400).json({ error: "Missing transaction_amount parameter." });
      return;
    }

    // Read Asaas credentials
    const asaasApiKey = process.env.ASAAS_API_KEY || '89db5943-51f1-41e6-8f5b-1c31bcc36b1c';
    
    // Auto-detect environment based on key prefix
    const isSandbox = asaasApiKey.startsWith('$aact_hmlg_') || asaasApiKey.startsWith('$');
    const baseUrl = isSandbox ? 'https://api-sandbox.asaas.com/v3' : 'https://api.asaas.com/v3';

    // 2. Find or Create Default Customer "Cliente Predix"
    let customerId = null;
    const searchUrl = `${baseUrl}/customers?name=${encodeURIComponent('Cliente Predix')}`;
    const searchRes = await fetch(searchUrl, {
      method: 'GET',
      headers: {
        'access_token': asaasApiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'PredixApp'
      }
    });

    if (searchRes.ok) {
      const searchData = await searchRes.json();
      if (searchData.data && searchData.data.length > 0) {
        customerId = searchData.data[0].id;
      }
    }

    // Create customer if not found
    if (!customerId) {
      const createCustRes = await fetch(`${baseUrl}/customers`, {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'PredixApp'
        },
        body: JSON.stringify({
          name: 'Cliente Predix',
          email: 'cliente@predix.com'
        })
      });

      if (!createCustRes.ok) {
        const errDetails = await createCustRes.text();
        throw new Error(`Failed to create default Asaas customer: ${errDetails}`);
      }

      const newCustData = await createCustRes.json();
      customerId = newCustData.id;
    }

    // 3. Create Asaas Payment (billingType: PIX)
    // dueDate is set to tomorrow's date
    const tomorrowDate = new Date(Date.now() + 86400000).toISOString().split('T')[0];
    
    const paymentBody = {
      customer: customerId,
      billingType: 'PIX',
      value: Number(transaction_amount),
      dueDate: tomorrowDate,
      description: description || 'Recarga de moedas Predix'
    };

    const createPayRes = await fetch(`${baseUrl}/payments`, {
      method: 'POST',
      headers: {
        'access_token': asaasApiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'PredixApp'
      },
      body: JSON.stringify(paymentBody)
    });

    if (!createPayRes.ok) {
      const errDetails = await createPayRes.text();
      throw new Error(`Failed to create Asaas charge: ${errDetails}`);
    }

    const paymentData = await createPayRes.json();
    const paymentId = paymentData.id;

    // 4. Retrieve Pix Copy/Paste code & base64 image
    const qrCodeUrl = `${baseUrl}/payments/${paymentId}/pixQrCode`;
    const qrCodeRes = await fetch(qrCodeUrl, {
      method: 'GET',
      headers: {
        'access_token': asaasApiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'PredixApp'
      }
    });

    if (!qrCodeRes.ok) {
      const errDetails = await qrCodeRes.text();
      throw new Error(`Failed to generate Asaas Pix QR Code: ${errDetails}`);
    }

    const qrCodeData = await qrCodeRes.json();
    
    // Return formatted payload matching the frontend requirements
    res.status(200).json({
      txid: paymentId,
      qrCodeImage: qrCodeData.encodedImage.startsWith('data:') 
        ? qrCodeData.encodedImage 
        : `data:image/png;base64,${qrCodeData.encodedImage}`,
      pixCopiaECola: qrCodeData.payload
    });

  } catch (error) {
    console.error("Asaas Payment charge creation error:", error);
    res.status(500).json({ error: error.message || "Failed to create Asaas Pix charge." });
  }
}
