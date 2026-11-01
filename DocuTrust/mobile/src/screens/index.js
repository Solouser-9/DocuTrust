// SCREEN_REGISTRY — the single inventory of every screen in the app.
// 45 entries: name → { component, module, title }. RootNavigator mounts these;
// deep links, notification taps and presenter `go()` calls all use these names.

import SplashScreen from './SplashScreen';
import OnboardingScreen from './OnboardingScreen';
import LoginScreen from './LoginScreen';
import RegisterScreen from './RegisterScreen';
import VerifyEmailScreen from './VerifyEmailScreen';
import ForgotPasswordScreen from './ForgotPasswordScreen';
import ResetPasswordScreen from './ResetPasswordScreen';
import MfaScreen from './MfaScreen';
import DashboardScreen from './DashboardScreen';
import DocumentsScreen from './DocumentsScreen';
import DocumentDetailScreen from './DocumentDetailScreen';
import UploadDocumentScreen from './UploadDocumentScreen';
import EditDocumentScreen from './EditDocumentScreen';
import VersionsScreen from './VersionsScreen';
import HistoryScreen from './HistoryScreen';
import FoldersScreen from './FoldersScreen';
import FolderDetailScreen from './FolderDetailScreen';
import SearchScreen from './SearchScreen';
import TrashScreen from './TrashScreen';
import ExpiringScreen from './ExpiringScreen';
import SharesScreen from './SharesScreen';
import CreateShareScreen from './CreateShareScreen';
import ShareDetailScreen from './ShareDetailScreen';
import VerificationRequestsScreen from './VerificationRequestsScreen';
import CreateVerificationScreen from './CreateVerificationScreen';
import VerificationDetailScreen from './VerificationDetailScreen';
import PublicVerifyScreen from './PublicVerifyScreen';
import PublicVerifyResultScreen from './PublicVerifyResultScreen';
import NotificationsScreen from './NotificationsScreen';
import NotificationPrefsScreen from './NotificationPrefsScreen';
import ProfileScreen from './ProfileScreen';
import EditProfileScreen from './EditProfileScreen';
import ChangePasswordScreen from './ChangePasswordScreen';
import SecurityScreen from './SecurityScreen';
import HelpScreen from './HelpScreen';
import AdminDashboardScreen from './AdminDashboardScreen';
import AdminReviewQueueScreen from './AdminReviewQueueScreen';
import AdminReviewDetailScreen from './AdminReviewDetailScreen';
import AdminUsersScreen from './AdminUsersScreen';
import AdminUserDetailScreen from './AdminUserDetailScreen';
import AdminAuditLogsScreen from './AdminAuditLogsScreen';
import AdminDocumentsScreen from './AdminDocumentsScreen';
import OrgScreen from './OrgScreen';
import TeamMembersScreen from './TeamMembersScreen';
import InviteMemberScreen from './InviteMemberScreen';

export const SCREEN_REGISTRY = {
  // Auth (8)
  Splash: { component: SplashScreen, module: 'auth', title: 'DocuTrust' },
  Onboarding: { component: OnboardingScreen, module: 'auth', title: 'Welcome' },
  Login: { component: LoginScreen, module: 'auth', title: 'Sign in' },
  Register: { component: RegisterScreen, module: 'auth', title: 'Create account' },
  VerifyEmail: { component: VerifyEmailScreen, module: 'auth', title: 'Verify email' },
  ForgotPassword: { component: ForgotPasswordScreen, module: 'auth', title: 'Forgot password' },
  ResetPassword: { component: ResetPasswordScreen, module: 'auth', title: 'Reset password' },
  Mfa: { component: MfaScreen, module: 'auth', title: 'Two-factor check' },

  // Documents (10)
  Dashboard: { component: DashboardScreen, module: 'documents', title: 'Dashboard' },
  Documents: { component: DocumentsScreen, module: 'documents', title: 'The Vault' },
  DocumentDetail: { component: DocumentDetailScreen, module: 'documents', title: 'Document' },
  UploadDocument: { component: UploadDocumentScreen, module: 'documents', title: 'Seal a document' },
  EditDocument: { component: EditDocumentScreen, module: 'documents', title: 'Edit document' },
  Versions: { component: VersionsScreen, module: 'documents', title: 'Versions' },
  History: { component: HistoryScreen, module: 'documents', title: 'History' },
  Search: { component: SearchScreen, module: 'documents', title: 'Search' },
  Trash: { component: TrashScreen, module: 'documents', title: 'Trash' },
  Expiring: { component: ExpiringScreen, module: 'documents', title: 'Expiring soon' },

  // Folders (2)
  Folders: { component: FoldersScreen, module: 'folders', title: 'Folders' },
  FolderDetail: { component: FolderDetailScreen, module: 'folders', title: 'Folder' },

  // Sharing (3)
  Shares: { component: SharesScreen, module: 'sharing', title: 'Shares' },
  CreateShare: { component: CreateShareScreen, module: 'sharing', title: 'Create share' },
  ShareDetail: { component: ShareDetailScreen, module: 'sharing', title: 'Share' },

  // Verification (5)
  VerificationRequests: { component: VerificationRequestsScreen, module: 'verification', title: 'Verification requests' },
  CreateVerification: { component: CreateVerificationScreen, module: 'verification', title: 'New verification' },
  VerificationDetail: { component: VerificationDetailScreen, module: 'verification', title: 'Verification' },
  PublicVerify: { component: PublicVerifyScreen, module: 'verification', title: 'Verify a document' },
  PublicVerifyResult: { component: PublicVerifyResultScreen, module: 'verification', title: 'Verification result' },

  // Notifications (2)
  Notifications: { component: NotificationsScreen, module: 'notifications', title: 'Alerts' },
  NotificationPrefs: { component: NotificationPrefsScreen, module: 'notifications', title: 'Notification preferences' },

  // Profile (5)
  Profile: { component: ProfileScreen, module: 'profile', title: 'Profile' },
  EditProfile: { component: EditProfileScreen, module: 'profile', title: 'Edit profile' },
  ChangePassword: { component: ChangePasswordScreen, module: 'profile', title: 'Change password' },
  Security: { component: SecurityScreen, module: 'profile', title: 'Security & sessions' },
  Help: { component: HelpScreen, module: 'profile', title: 'Help & FAQ' },

  // Admin (7)
  AdminDashboard: { component: AdminDashboardScreen, module: 'admin', title: 'Registrar console' },
  AdminReviewQueue: { component: AdminReviewQueueScreen, module: 'admin', title: 'Review queue' },
  AdminReviewDetail: { component: AdminReviewDetailScreen, module: 'admin', title: 'Review detail' },
  AdminUsers: { component: AdminUsersScreen, module: 'admin', title: 'User directory' },
  AdminUserDetail: { component: AdminUserDetailScreen, module: 'admin', title: 'User record' },
  AdminAuditLogs: { component: AdminAuditLogsScreen, module: 'admin', title: 'Audit logs' },
  AdminDocuments: { component: AdminDocumentsScreen, module: 'admin', title: 'Platform documents' },

  // Organisation (3)
  Org: { component: OrgScreen, module: 'org', title: 'Organisation' },
  TeamMembers: { component: TeamMembersScreen, module: 'org', title: 'Team directory' },
  InviteMember: { component: InviteMemberScreen, module: 'org', title: 'Invite member' },
};

export const SCREEN_COUNT = Object.keys(SCREEN_REGISTRY).length;

export default SCREEN_REGISTRY;
