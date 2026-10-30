// Ponto único de acesso aos dados. Escolhe o banco de verdade (Supabase)
// quando configurado, ou o modo demonstração.
import { MODO_DEMO } from './config.js';

export let db = null;

export async function iniciarDados() {
  db = MODO_DEMO ? await import('./backend-demo.js') : await import('./backend-supabase.js');
  await db.iniciar();
  return db;
}
