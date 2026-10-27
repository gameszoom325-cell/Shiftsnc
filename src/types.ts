export type OrganizationType = 'college' | 'construction';

export type RoleId =
  | 'construction_worker'
  | 'construction_admin'
  | 'college_student'
  | 'college_admin';

export interface DemoUser {
  id: string;
  name: string;
  username: string;
  email: string;
  password?: string;
  organization: OrganizationType;
  role: RoleId;
  roleLabel: string;
  department: string;
  badgeId: string; // Worker ID (e.g. W001) or Student ID (e.g. CSE101) or Admin ID
  shiftWindow?: string;
  supervisor?: string;
  hourlyRate?: number;
  overtimeRate?: number;
  semester?: string;
  advisor?: string;
  gpa?: string;
  createdByAdmin?: boolean;
}

export interface AttendanceItem {
  id: string;
  userId: string;
  userName: string;
  portalType: 'construction' | 'college';
  department: string;
  dateLabel: string;
  checkInTime: string;
  checkOutTime: string;
  regularHours: number;
  overtimeHours: number;
  status: 'Checked In' | 'Completed' | 'Late';
}

export interface SafetyComplaintItem {
  id: string;
  authorId: string;
  authorName: string;
  portalType: 'construction' | 'college';
  title: string;
  category: string;
  location: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Submitted' | 'Under Review' | 'Resolved';
  description: string;
  dateSubmitted: string;
}

export interface SkillRecordItem {
  id: string;
  userId: string;
  userName: string;
  portalType: 'construction' | 'college';
  title: string;
  issuer: string;
  issueDate: string;
  experienceHours: number;
  verifiedStatus: 'Pending' | 'Verified';
}

export interface WorkerDirectoryItem {
  id: string;
  name: string;
  badgeId: string;
  username: string;
  password?: string;
  trade: string;
  siteZone: string;
  shiftTime: string;
  regularHoursWeek: number;
  overtimeHoursWeek: number;
  attendanceRate: number;
  activeShift: boolean;
  hourlyRate: number;
}

export interface CollegeDepartmentStat {
  id: string;
  department: string;
  headOfDept: string;
  totalStudents: number;
  avgAttendance: number;
  verifiedSkills: number;
  pendingVerifications: number;
  openComplaints: number;
}
