import fs from "fs/promises";
import crypto from "crypto";
import path from "path";
import { Script } from "../scripts/models.js";

const SCRIPTS_DIR = path.resolve("scripts");

export async function syncScriptsToDB() {
  console.log("synicing database ...");
  const diskFiles = await fs.readdir(SCRIPTS_DIR);

  const scripts = [];
  // 1.  insert / update any new or changed files
  for (const file of diskFiles) {
    const fullPath = path.join(SCRIPTS_DIR, file);

    const stat = await fs.stat(fullPath);
    if (stat.isDirectory()) continue;

    const ext = path.extname(file).toLowerCase();
    const type =
      ext === ".bat" ? "batch" : ext === ".ps1" ? "powershell" : null;
    if (!type) continue; // skip non-script files

    // quick content has
    const buf = await fs.readFile(fullPath);
    const hash = crypto.createHash("sha1").update(buf).digest("hex");

    await Script.upsert(
      {
        name: path.basename(file, ext),
        type,
        filePath: path.join("scripts", file),
        // hash,
      },
      { returning: false }
    );
  }

  // 2.  delete DB records for files that were removed from disk
  const dbScripts = await Script.findAll({
    attributes: ["id", "name", "filePath"],
  });
  for (const s of dbScripts) {
    if (!diskFiles.includes(path.basename(s.filePath))) {
      await s.destroy();
    }
  }

  console.log(`🔄 Script index synced • total = ${await Script.count()}`);
}
