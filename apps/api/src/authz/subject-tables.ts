import {
  auditLog,
  candidateProfile,
  jobPost,
  permission,
  project,
  role,
  tag,
  task,
  user,
} from "@et/db"

/** The table behind each permission subject, for SQL conditions and field options. */
export const SUBJECT_TABLES = {
  JobPost: jobPost,
  CandidateProfile: candidateProfile,
  Project: project,
  Task: task,
  Tag: tag,
  User: user,
  Role: role,
  Permission: permission,
  AuditLog: auditLog,
}
