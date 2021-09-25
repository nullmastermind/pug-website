import pug = require("pug");
import path = require("path");
import { getAllFiles } from "../utils/utils";
import _ = require("lodash");
import fs = require("fs-extra");

async function main() {
  const root = path.join(__dirname, "../pages");
  const dist = path.join(__dirname, "../dist");
  const files = await getAllFiles(root);

  // await fs.remove(dist);

  await Promise.all(
    _.map(files, async (filename: string) => {
      if (!filename.endsWith(".pug")) return;

      const fn = pug.compileFile(filename, {});
      const html = fn();
      const chunks: Array<string> = filename.replace(root, dist).split(".pug");

      chunks.pop();

      const saveTo = chunks.join(".pug") + ".html";

      await fs.ensureFile(saveTo);
      await fs.writeFile(saveTo, html);

      console.log(filename, "->", saveTo);
    })
  );
}

main().catch(console.error);
