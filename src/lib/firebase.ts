import { initializeApp } from 'firebase/app';
import {
  getAuth,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  User,
} from 'firebase/auth';
import {
  collection,
  doc,
  getDocFromServer,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import {
  AttendanceItem,
  RoleId,
  SafetyComplaintItem,
  SkillRecordItem,
} from '../types';

const app = initializeApp(firebaseConfig);
export const db = getFirestoreInstance();
export const auth = getAuth(app);

import { getFirestore } from 'firebase/firestore';
function getFirestoreInstance() {
  return getFirestore(app, firebaseConfig.firestoreDatabaseId);
}

// Validate connection to Firestore on boot per skill directive
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}
testConnection();

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Strict sanitization helpers matching firebase-blueprint.json
function sanitizeId(id: string): string {
  const cleaned = id.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
  return cleaned.length > 0 ? cleaned : 'doc_1';
}

function clampString(val: string, max: number, fallback = 'N/A'): string {
  const trimmed = (val || '').trim().slice(0, max);
  return trimmed.length > 0 ? trimmed : fallback;
}

export async function signInWithGoogleForRole(
  selectedRole: RoleId,
  department: string
): Promise<User> {
  const provider = new GoogleAuthProvider();
  const credential = await signInWithPopup(auth, provider);
  const user = credential.user;

  // Ensure UserProfile exists in /users/{uid}
  const safeUid = sanitizeId(user.uid);
  const path = `users/${safeUid}`;
  const isAdminUser = user.email === 'gameszoom325@gmail.com';
  const permittedRole: RoleId =
    !isAdminUser && (selectedRole === 'construction_admin' || selectedRole === 'college_admin')
      ? selectedRole === 'construction_admin'
        ? 'construction_worker'
        : 'college_student'
      : selectedRole;

  try {
    await setDoc(doc(db, 'users', safeUid), {
      uid: safeUid,
      displayName: clampString(user.displayName || user.email || 'ShiftSync User', 100),
      role: permittedRole,
      department: clampString(department, 100, 'General Operations'),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, path);
  }

  return user;
}

export async function signOutFirebaseUser(): Promise<void> {
  await signOut(auth);
}

export function subscribeToAuthChanges(callback: (user: User | null) => void) {
  return onAuthStateChanged(auth, callback);
}

export async function saveAttendanceToFirestore(record: AttendanceItem): Promise<void> {
  if (!auth.currentUser) return;
  const safeId = sanitizeId(record.id);
  const safeUid = sanitizeId(auth.currentUser.uid);
  const path = `attendance/${safeId}`;

  try {
    await setDoc(doc(db, 'attendance', safeId), {
      userId: safeUid,
      userName: clampString(record.userName, 100),
      portalType: record.portalType === 'college' ? 'college' : 'construction',
      dateLabel: clampString(record.dateLabel, 40),
      checkInTime: clampString(record.checkInTime, 40),
      checkOutTime: clampString(record.checkOutTime, 40),
      regularHours: Math.max(0, Math.min(24, Number(record.regularHours) || 0)),
      overtimeHours: Math.max(0, Math.min(24, Number(record.overtimeHours) || 0)),
      status: record.status,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveComplaintToFirestore(complaint: SafetyComplaintItem): Promise<void> {
  if (!auth.currentUser) return;
  const safeId = sanitizeId(complaint.id);
  const safeUid = sanitizeId(auth.currentUser.uid);
  const path = `complaints/${safeId}`;

  try {
    await setDoc(doc(db, 'complaints', safeId), {
      authorId: safeUid,
      authorName: clampString(complaint.authorName, 100),
      portalType: complaint.portalType === 'college' ? 'college' : 'construction',
      title: clampString(complaint.title, 140),
      category: clampString(complaint.category, 60),
      location: clampString(complaint.location, 100),
      priority: complaint.priority,
      status: 'Submitted',
      description: clampString(complaint.description, 1000),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function saveSkillToFirestore(skill: SkillRecordItem): Promise<void> {
  if (!auth.currentUser) return;
  const safeId = sanitizeId(skill.id);
  const safeUid = sanitizeId(auth.currentUser.uid);
  const path = `skills/${safeId}`;

  try {
    await setDoc(doc(db, 'skills', safeId), {
      userId: safeUid,
      userName: clampString(skill.userName, 100),
      portalType: skill.portalType === 'college' ? 'college' : 'construction',
      title: clampString(skill.title, 140),
      issuer: clampString(skill.issuer, 100),
      issueDate: clampString(skill.issueDate, 40),
      experienceHours: Math.max(0, Math.min(10000, Number(skill.experienceHours) || 0)),
      verifiedStatus: 'Pending',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function updateSkillStatusInFirestore(
  skill: SkillRecordItem,
  verifiedStatus: 'Pending' | 'Verified'
): Promise<void> {
  if (!auth.currentUser) return;
  const safeId = sanitizeId(skill.id);
  const path = `skills/${safeId}`;
  try {
    await updateDoc(doc(db, 'skills', safeId), {
      verifiedStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export function subscribeUserFirestoreData(
  uid: string,
  onData: (data: {
    attendance: AttendanceItem[];
    complaints: SafetyComplaintItem[];
    skills: SkillRecordItem[];
  }) => void
) {
  const safeUid = sanitizeId(uid);
  let latestAttendance: AttendanceItem[] = [];
  let latestComplaints: SafetyComplaintItem[] = [];
  let latestSkills: SkillRecordItem[] = [];

  const emit = () => {
    onData({
      attendance: latestAttendance,
      complaints: latestComplaints,
      skills: latestSkills,
    });
  };

  const attQuery = query(collection(db, 'attendance'), where('userId', '==', safeUid));
  const unsubAtt = onSnapshot(
    attQuery,
    (snap) => {
      latestAttendance = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          userId: raw.userId,
          userName: raw.userName,
          portalType: raw.portalType,
          department: 'Synced Cloud Record',
          dateLabel: raw.dateLabel,
          checkInTime: raw.checkInTime,
          checkOutTime: raw.checkOutTime,
          regularHours: raw.regularHours,
          overtimeHours: raw.overtimeHours,
          status: raw.status,
        };
      });
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'attendance')
  );

  const cmpQuery = query(collection(db, 'complaints'), where('authorId', '==', safeUid));
  const unsubCmp = onSnapshot(
    cmpQuery,
    (snap) => {
      latestComplaints = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          authorId: raw.authorId,
          authorName: raw.authorName,
          portalType: raw.portalType,
          title: raw.title,
          category: raw.category,
          location: raw.location,
          priority: raw.priority,
          status: raw.status,
          description: raw.description,
          dateSubmitted: 'Synced Today',
        };
      });
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'complaints')
  );

  const skQuery = query(collection(db, 'skills'), where('userId', '==', safeUid));
  const unsubSk = onSnapshot(
    skQuery,
    (snap) => {
      latestSkills = snap.docs.map((d) => {
        const raw = d.data();
        return {
          id: d.id,
          userId: raw.userId,
          userName: raw.userName,
          portalType: raw.portalType,
          title: raw.title,
          issuer: raw.issuer,
          issueDate: raw.issueDate,
          experienceHours: raw.experienceHours,
          verifiedStatus: raw.verifiedStatus,
        };
      });
      emit();
    },
    (err) => handleFirestoreError(err, OperationType.LIST, 'skills')
  );

  return () => {
    unsubAtt();
    unsubCmp();
    unsubSk();
  };
}
