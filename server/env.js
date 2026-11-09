// Carga el archivo .env (si existe) en process.env. Se importa antes que nada
// en server/index.js. En Vercel no hay .env: las variables se definen en el panel.
try {
  process.loadEnvFile();
} catch {
  // Sin .env: se usan las variables de entorno del sistema
}
