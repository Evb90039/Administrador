import { PostgrestError } from '@supabase/supabase-js';

const DEFAULT_MESSAGES: Record<string, string> = {
  '23503': 'El registro relacionado no existe',
  '23505': 'Ya existe un registro con esos datos',
  '23514': 'Algún dato no es válido',
  '42P01': 'La tabla no existe en Supabase (ejecuta el script SQL)',
  PGRST116: 'El registro no existe o no tienes permiso para modificarlo',
  PGRST205: 'La tabla no existe en Supabase (ejecuta el script SQL)',
};

export function toDbError(error: PostgrestError, overrides: Record<string, string> = {}): Error {
  return new Error(overrides[error.code] ?? DEFAULT_MESSAGES[error.code] ?? error.message);
}
