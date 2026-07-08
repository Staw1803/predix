export interface Prediction {
  id: string;
  username: string;
  userHandle: string;
  userAvatar: string;
  timeAgo: string;
  question: string;
  resolutionSource: string;
  category: string;
  poolYes: number;
  poolNo: number;
  betsCount: number;
}

export interface UserBet {
  predictionId: string;
  choice: 'YES' | 'NO';
  amount: number;
  timestamp: Date;
}
