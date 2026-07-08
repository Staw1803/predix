import { db } from '../firebaseClient';
import { 
  doc, 
  getDoc, 
  collection, 
  getDocs, 
  query, 
  where, 
  runTransaction 
} from 'firebase/firestore';

/**
 * Resolves a prediction market card using the Pari-Mutuel split formula.
 * @param postId The ID of the post/prediction card
 * @param winningChoice The winning outcome: true (YES/SIM) or false (NO/NÃO)
 */
export async function resolvePost(postId: string, winningChoice: boolean) {
  const postRef = doc(db, 'posts', postId);
  const postSnap = await getDoc(postRef);

  if (!postSnap.exists()) {
    throw new Error('Prediction post not found');
  }
  
  const postData = postSnap.data();
  if (postData.status === 'resolved') {
    throw new Error('This prediction is already resolved');
  }

  const poolYes = postData.pool_yes || 0;
  const poolNo = postData.pool_no || 0;
  const poolTotal = poolYes + poolNo;

  // 1. Calculate platform fee & net pool
  const platformFee = poolTotal * 0.10;
  const netPool = poolTotal - platformFee;

  // 2. Fetch all wagers for this prediction
  const betsRef = collection(db, 'bets');
  const betsQuery = query(betsRef, where('post_id', '==', postId));
  const betsSnap = await getDocs(betsQuery);

  const allBets = betsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() as any }));
  const winningBets = allBets.filter(b => b.choice === winningChoice);
  const totalWinningBetsAmount = winningBets.reduce((sum, b) => sum + (b.amount || 0), 0);

  // 3. Atomically update documents in transaction
  await runTransaction(db, async (transaction) => {
    // Lock the post and set it to resolved
    transaction.update(postRef, { 
      status: 'resolved',
      winning_choice: winningChoice 
    });

    if (totalWinningBetsAmount > 0 && netPool > 0) {
      for (const bet of winningBets) {
        const userProfileRef = doc(db, 'profiles', bet.user_id);
        const userProfileSnap = await transaction.get(userProfileRef);

        if (userProfileSnap.exists()) {
          const userData = userProfileSnap.data();
          const currentBalance = userData.balance || 0;
          const currentEarnings = userData.total_earnings || 0;
          const currentWins = userData.wins_count || 0;
          const currentBets = userData.total_bets || 0;

          // Proportional Split: (user_bet_amount / total_betted_on_winning_choice) * net_pool
          const userReward = Math.round((bet.amount / totalWinningBetsAmount) * netPool);
          const netProfit = userReward - bet.amount;

          const newWins = currentWins + 1;
          const totalBetsCount = currentBets || 1;
          const newWinRate = Math.round((newWins / totalBetsCount) * 100);

          transaction.update(userProfileRef, {
            balance: currentBalance + userReward,
            total_earnings: currentEarnings + netProfit,
            wins_count: newWins,
            win_rate: newWinRate
          });
        }
      }
    }
  });

  return { success: true, poolTotal, netPool, totalWinningBetsAmount };
}
