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
    const { transaction_amount, description } = req.body;
    
    if (!transaction_amount) {
      res.status(400).json({ error: "Missing transaction_amount parameter." });
      return;
    }

    const client_id = process.env.VITE_EFI_CLIENT_ID;
    const client_secret = process.env.VITE_EFI_CLIENT_SECRET;
    const cert_base64 = process.env.VITE_EFI_CERTIFICATE_BASE64;
    const isSandbox = process.env.VITE_EFI_SANDBOX !== 'false';
    const pixKey = process.env.VITE_EFI_PIX_KEY || 'sandbox-pix-key@efi.com.br';

    if (!client_id || !client_secret) {
      throw new Error("Missing Efí Bank environment keys.");
    }

    // Convert to String BRL format (e.g. "10.00")
    const formattedAmount = Number(transaction_amount).toFixed(2);

    // Efi Pay options
    const options = {
      sandbox: isSandbox,
      client_id: client_id,
      client_secret: client_secret,
      certificate: isSandbox ? '' : (cert_base64 || ''),
      cert_base64: isSandbox ? false : !!cert_base64
    };

    let responseData = null;

    try {
      const efipay = new EfiPay(options);
      
      const body = {
        calendario: { expiracao: 3600 },
        valor: { original: formattedAmount },
        chave: pixKey,
        solicitacaoPagador: description || 'Recarga de moedas'
      };

      const charge = await efipay.pixCreateImmediateCharge({}, body);
      
      if (charge && charge.loc && charge.loc.id) {
        const qrCodeData = await efipay.pixGenerateQRCode({ id: charge.loc.id });
        if (qrCodeData && qrCodeData.qrcode) {
          responseData = {
            txid: charge.txid || `efiRealPix${Date.now()}`,
            qrCodeImage: qrCodeData.imagemQrcode,
            pixCopiaECola: qrCodeData.qrcode
          };
        }
      }
    } catch (sdkError) {
      console.warn("Efí SDK Sandbox call failed. Falling back to error display.", sdkError);
      
      let errorDetail = sdkError.message || "";
      try {
        errorDetail = JSON.stringify(sdkError);
      } catch (e) {}

      const errorMessage = `Erro Efí: ${errorDetail}. Verifique as credenciais, o certificado Base64 e se a chave Pix está cadastrada no Efí Bank.`;
      
      return res.status(200).json({
        txid: `efiSandboxPix${Date.now()}`, // Still return mock txid so polling doesn't break
        qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(errorMessage)}`,
        pixCopiaECola: errorMessage
      });
    }

    res.status(200).json(responseData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}
