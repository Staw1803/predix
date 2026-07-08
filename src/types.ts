export interface Prediction {
  id: string;
  authorId: string;
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
  status: 'active' | 'frozen' | 'resolved';
  winningChoice?: boolean;
}

export interface UserBet {
  predictionId: string;
  choice: 'YES' | 'NO';
  amount: number;
  timestamp: Date;
}
