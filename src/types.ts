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
export interface User {
  id: string;
  displayName: string;
  username: string;
  photoURL: string;
  credits: number;
}

export interface Post {
  id: string;
  authorId: string;
  content: string;
  timestamp: any; // Firestore Timestamp
  likesCount: number;
}

export interface Comment {
  id: string;
  postId: string;
  authorId: string;
  content: string;
  timestamp: any; // Firestore Timestamp
}

