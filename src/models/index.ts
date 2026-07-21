/**
 * Compatibility re-exports. Runtime data access uses Prisma (`src/config/prisma`).
 * Prefer importing ActionType/ResourceType from `services/actionLogService`
 * and UserRole from `types`.
 */
export { ActionType, ResourceType } from '../services/actionLogService';
export { UserRole, RecordSource, RecordStatus } from '../types';
