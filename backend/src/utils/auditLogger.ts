import pool from './db';

/**
 * Log a system activity/audit event into the database.
 * 
 * @param staffId ID of the staff performing the action (null if system or unauthenticated)
 * @param actionType Category of action (e.g. 'login', 'create_job_card')
 * @param entityType Affected entity name (e.g. 'staff', 'job_card')
 * @param entityId ID of the affected entity
 * @param description Detailed text description of the activity
 * @param ipAddress Client's IP address (optional)
 * @param userAgent Client's User Agent string (optional)
 */
export const logActivity = async (
  staffId: number | null,
  actionType: string,
  entityType: string,
  entityId: number | null,
  description: string,
  ipAddress?: string,
  userAgent?: string
): Promise<void> => {
  try {
    await pool.query(
      `INSERT INTO system_logs (staff_id, action_type, entity_type, entity_id, description, ip_address, user_agent)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [staffId, actionType, entityType, entityId, description, ipAddress || null, userAgent || null]
    );
  } catch (error) {
    console.error('❌ Audit Logger Error:', error);
  }
};
