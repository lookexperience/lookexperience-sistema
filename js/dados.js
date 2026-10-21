// Ponto único de acesso aos dados. Escolhe o banco de verdade (Supabase)
// quando configurado, ou o modo demonstração.
import { CONFIG } from './config.js';

export let db = null;

export async function iniciarDados() {
  db = CONFIG.supabaseUrl ? await import('./backend-supabase.js') : await import('./backend-demo.js');
  await db.iniciar();
  return db;
}
