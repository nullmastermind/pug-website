import pug = require("pug");
import path = require("path");
import { getAllFiles } from "../utils/utils";
import _ = require("lodash");
import fs = require("fs-extra");
import yaml = require("yaml");

async function main() {
  const root = path.join(__dirname, "../pages");
  const dist = path.join(__dirname, "../dist");
  const files = await getAllFiles(root);

  // await fs.remove(dist);

  await Promise.all(
    _.map(files, async (filename: string) => {
      if (!filename.endsWith(".pug")) return;

      const chunks: Array<string> = filename.split(".pug");

      chunks.pop();

      const saveTo = (chunks.join(".pug") + ".html").replace(root, dist);
      const dataFile = chunks.join(".pug") + ".yaml";
      let locals = {};

      if (fs.existsSync(dataFile)) {
        locals = yaml.parse(await fs.readFile(dataFile, "utf-8"));
      }

      const fn = pug.compileFile(filename);
      const html = fn(locals);

      await fs.ensureFile(saveTo);
      await fs.writeFile(saveTo, html);

      console.log(filename, "->", saveTo);
    })
  );
}

main().catch(console.error);
