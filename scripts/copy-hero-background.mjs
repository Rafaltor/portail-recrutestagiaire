/**
 * Copie ta photo de hero vers public/swipe-stamps/background-portail.png
 *
 * Usage :
 *   node scripts/copy-hero-background.mjs "C:\chemin\vers\ta-photo.png"
 *   npm run copy:hero-bg -- "C:\chemin\vers\ta-photo.png"
 *
 * Sans argument : tente le fichier Cursor souvent utilisé pour les images de chat.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const dest = path.join(root, "public", "swipe-stamps", "background-portail.png");

const CURSOR_CANDIDATES = [
  process.argv[2],
  process.env.HERO_BG_SOURCE,
  path.join(
    process.env.USERPROFILE || "",
    ".cursor",
    "projects",
    "c-Users-Paul-Maxence-Baraton-Downloads-recrutestagiaire",
    "assets",
    "c__Users_Paul-Maxence_Baraton_AppData_Roaming_Cursor_User_workspaceStorage_19103685a1c889877cd7951d7cff1222_images_background_portail-f99cd2de-087a-40a6-a5f4-e1313b8cd14c.png",
  ),
].filter(Boolean);

function main() {
  fs.mkdirSync(path.dirname(dest), { recursive: true });

  for (const src of CURSOR_CANDIDATES) {
    if (!src) continue;
    const abs = path.isAbsolute(src) ? src : path.resolve(process.cwd(), src);
    if (fs.existsSync(abs)) {
      fs.copyFileSync(abs, dest);
      console.log("OK — copié vers", dest);
      return;
    }
  }

  console.error(
    "Aucun fichier source trouvé. Indique le chemin complet vers ton PNG :\n" +
      '  npm run copy:hero-bg -- "C:\\Users\\…\\ma-photo.png"',
  );
  process.exit(1);
}

main();
