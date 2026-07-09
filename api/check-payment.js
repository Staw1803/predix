import EfiPay from 'sdk-node-apis-efi';
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
    const apiKey = process.env.VITE_FIREBASE_API_KEY;
    await verifyFirebaseToken(authHeader, apiKey);
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

    // Mock handler (auto-completes after 15 seconds for sandbox demo validation)
    if (txid.startsWith('efiSandboxPix')) {
      const timestampPart = parseInt(txid.replace('efiSandboxPix', ''), 10);
      const secondsPassed = (Date.now() - timestampPart) / 1000;
      
      if (secondsPassed >= 15) {
        res.status(200).json({ status: 'CONCLUIDA' });
      } else {
        res.status(200).json({ status: 'ATIVA' });
      }
      return;
    }

    const client_id = process.env.VITE_EFI_CLIENT_ID;
    const client_secret = process.env.VITE_EFI_CLIENT_SECRET;
    const cert_base64 = process.env.VITE_EFI_CERTIFICATE_BASE64;
    const isSandbox = process.env.VITE_EFI_SANDBOX !== 'false';

    if (!client_id || !client_secret) {
      throw new Error("Missing Efí Bank environment keys.");
    }

    const options = {
      sandbox: isSandbox,
      client_id: client_id,
      client_secret: client_secret,
      certificate: isSandbox ? '' : (cert_base64 || ''),
      cert_base64: isSandbox ? false : !!cert_base64
    };

    const efipay = new EfiPay(options);
    const charge = await efipay.pixDetailCharge({ txid });

    res.status(200).json({ status: charge.status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
