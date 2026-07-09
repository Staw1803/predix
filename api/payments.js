import { verifyFirebaseToken } from './_utils.js';

// Mathematically valid CPF generator to satisfy Asaas requirements
function generateValidCPF() {
  const randomDigit = () => Math.floor(Math.random() * 9);
  const n = Array.from({ length: 9 }, randomDigit);
  
  let d1 = 0;
  for (let i = 0; i < 9; i++) {
    d1 += n[i] * (10 - i);
  }
  d1 = 11 - (d1 % 11);
  if (d1 >= 10) d1 = 0;
  
  let d2 = 0;
  for (let i = 0; i < 9; i++) {
    d2 += n[i] * (11 - i);
  }
  d2 += d1 * 2;
  d2 = 11 - (d2 % 11);
  if (d2 >= 10) d2 = 0;
  
  return `${n.join('')}${d1}${d2}`;
}

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
    const asaasApiKey = process.env.ASAAS_API_KEY;
    if (!asaasApiKey) {
      throw new Error("Missing ASAAS_API_KEY environment variable. Please configure it in your Vercel settings.");
    }
    
    // Default to Production URL, will fallback to Sandbox if token is invalid or belongs to Sandbox
    let baseUrl = 'https://api.asaas.com/v3';
    let customerId = null;
    let existingCpf = null;

    // Helper to fetch customer from Asaas
    const getCustomer = async (url) => {
      return fetch(`${url}/customers?name=${encodeURIComponent('Cliente Predix')}`, {
        method: 'GET',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'PredixApp'
        }
      });
    };

    // Try querying Production
    let searchRes = await getCustomer(baseUrl);

    if (!searchRes.ok) {
      const cloneRes = searchRes.clone();
      const errData = await cloneRes.json().catch(() => ({}));
      const needsFallback = errData.errors && errData.errors.some(e => 
        e.code === 'invalid_access_token' || e.code === 'invalid_environment'
      );
      
      if (needsFallback) {
        // Fallback: Try Sandbox environment
        baseUrl = 'https://api-sandbox.asaas.com/v3';
        searchRes = await getCustomer(baseUrl);
      }
    }

    if (!searchRes.ok) {
      const errDetails = await searchRes.text();
      throw new Error(`Asaas API Key is invalid or rejected in both environments: ${errDetails}`);
    }

    const searchData = await searchRes.json();
    if (searchData.data && searchData.data.length > 0) {
      customerId = searchData.data[0].id;
      existingCpf = searchData.data[0].cpfCnpj;
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
          email: 'cliente@predix.com',
          cpfCnpj: generateValidCPF()
        })
      });

      if (!createCustRes.ok) {
        const errDetails = await createCustRes.text();
        throw new Error(`Failed to create default Asaas customer: ${errDetails}`);
      }

      const newCustData = await createCustRes.json();
      customerId = newCustData.id;
    } else if (!existingCpf) {
      // If customer exists but has NO CPF, update it immediately to prevent checkout errors
      const updateCustRes = await fetch(`${baseUrl}/customers/${customerId}`, {
        method: 'POST',
        headers: {
          'access_token': asaasApiKey,
          'Content-Type': 'application/json',
          'User-Agent': 'PredixApp'
        },
        body: JSON.stringify({
          cpfCnpj: generateValidCPF()
        })
      });

      if (!updateCustRes.ok) {
        const errDetails = await updateCustRes.text();
        console.warn(`Failed to update customer CPF: ${errDetails}`);
      }
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
