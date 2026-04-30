export type Priority = 'low' | 'medium' | 'high';

export interface Task {
  id: string;
  title: string;
  deadline: any; // Timestamp or ISO string
  priority: Priority;
  createdBy: string;
  createdByName: string;
  groupId: string;
  createdAt: any;
  completedBy: string[]; // UIDs who completed it locally
}

export interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  senderPhoto: string;
  timestamp: any;
  editedAt?: any;
  groupId: string;
}

export interface UserProfile {
  uid: string;
  displayName: string;
  photoURL: string;
  groupId: string;
  role: 'member' | 'admin' | 'secretary';
  settings?: {
    notificationLeadTime: number; // minutes
    ringtone: string;
    vibration: boolean;
  };
}

export interface Group {
  id: string;
  name: string;
  ownerUid: string;
}
