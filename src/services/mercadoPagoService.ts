import { db } from '../firebaseClient';
import { doc, runTransaction } from 'firebase/firestore';

// Mercado Pago Webhook and Payment Services
// This service compiles cleanly in the browser by dynamically importing Node libraries.
// It is copy-paste ready for serverless Cloud Functions.

const MP_ACCESS_TOKEN = import.meta.env?.VITE_MP_ACCESS_TOKEN || 'YOUR_ACCESS_TOKEN';

/**
 * Creates a Pix Payment via Mercado Pago SDK.
 * Serverless / backend ready.
 */
export async function createPixPayment(amount: number, email: string, userId: string) {
  // Client-side execution sandbox
  if (typeof window !== 'undefined') {
    return {
      id: `mp-sim-${Date.now()}`,
      qr_code: `00020101021226870014br.gov.bcb.pix2565https://qr.mercadopago.com/pix/v1/${Date.now()}5204000053039865405${amount.toFixed(2)}5802BR5910Predix_Inc6009Sao_Paulo62070503***6304CA12`,
      qr_code_base64: 'placeholder',
      status: 'pending'
    };
  }

  // Backend Node implementation:
  // @ts-ignore
  const { MercadoPagoConfig, Payment } = await import('mercadopago');
  const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
  const paymentInstance = new Payment(client);

  try {
    const response = await paymentInstance.create({
      body: {
        transaction_amount: amount,
        description: 'Compra de Moedas Virtuais Predix',
        payment_method_id: 'pix',
        payer: {
          email: email,
          first_name: email.split('@')[0],
          last_name: 'User',
        },
        metadata: {
          user_id: userId,
        }
      }
    });

    return {
      id: response.id,
      qr_code: response.point_of_interaction?.transaction_data?.qr_code,
      qr_code_base64: response.point_of_interaction?.transaction_data?.qr_code_base64,
      status: response.status
    };
  } catch (error) {
    console.error('Error creating Mercado Pago payment:', error);
    throw error;
  }
}

/**
 * Payment Webhook designed to receive HTTP POST confirmation signals from Mercado Pago.
 * Updates Firestore user balance document upon receipt of "approved" status.
 */
export async function paymentWebhook(payload: any) {
  // @ts-ignore
  const { MercadoPagoConfig, Payment } = await import('mercadopago');
  const client = new MercadoPagoConfig({ accessToken: MP_ACCESS_TOKEN });
  const paymentInstance = new Payment(client);

  try {
    const paymentId = payload.data?.id || payload.payment_id;
    if (!paymentId) return { success: false, message: 'Invalid payload' };

    const paymentData = await paymentInstance.get({ id: paymentId });
    
    if (paymentData.status === 'approved') {
      const userId = paymentData.metadata?.user_id;
      const transactionAmount = paymentData.transaction_amount;

      if (userId && transactionAmount) {
        // Map BRL value to coin packages
        let coinsToCredit = 0;
        if (transactionAmount >= 80) coinsToCredit = 1000;
        else if (transactionAmount >= 45) coinsToCredit = 500;
        else if (transactionAmount >= 10) coinsToCredit = 100;
        else coinsToCredit = transactionAmount * 10; // fallback calculation

        // Firestore atomic update
        const userRef = doc(db, 'profiles', userId);
        await runTransaction(db, async (transaction) => {
          const userSnap = await transaction.get(userRef);
          if (!userSnap.exists()) throw new Error('User profile not found');
          
          const currentBalance = userSnap.data().balance || 0;
          transaction.update(userRef, { balance: currentBalance + coinsToCredit });
        });

        return { success: true, credited: coinsToCredit, userId };
      }
    }
    return { success: false, status: paymentData.status };
  } catch (error: any) {
    console.error('Webhook processing failed:', error);
    return { success: false, error: error.message };
  }
}
