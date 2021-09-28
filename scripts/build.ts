import pug = require("pug");
import path = require("path");
import { getAllDirs, getAllFiles } from "./utils/utils";
import fs = require("fs-extra");
import yaml = require("yaml");

async function main() {
  const workingDir = path.join(__dirname, "../.");
  const assetsDir = path.join(__dirname, "../assets");
  const pagesDir = path.join(__dirname, "../pages");
  const distDir = path.join(__dirname, "../dist");
  const assets = await getAllDirs(assetsDir);
  const pageFiles = await getAllFiles(pagesDir);
  const processed: {
    [key: string]: boolean;
  } = {};

  await fs.remove(distDir);

  for (const filename of pageFiles) {
    const project = path.dirname(filename).split(path.sep).pop();

    if (!processed[project]) {
      const project = path.dirname(filename).split(path.sep).pop();

      for (const asset of assets) {
        if (!(await fs.lstat(asset)).isDirectory()) return;

        if (asset.split(path.sep).pop() === project) {
          const parent = path.dirname(asset);
          const to = parent.replace(workingDir, "");
          const target = path.join(distDir, project, to);

          await fs.copy(asset, target);

          console.log(project, asset.replace(workingDir, ""), "->", target.replace(workingDir, ""));
        }
      }

      processed[project] = true;
    }

    if (!filename.endsWith(".pug")) return;

    const chunks: Array<string> = filename.split(".pug");

    chunks.pop();

    const saveTo = (chunks.join(".pug") + ".html").replace(pagesDir, distDir);
    const dataFile = chunks.join(".pug") + ".yaml";
    let locals = {};

    if (fs.existsSync(dataFile)) {
      locals = yaml.parse(await fs.readFile(dataFile, "utf-8"));
    }

    const fn = pug.compileFile(filename);
    const html = fn(locals);

    await fs.ensureFile(saveTo);
    await fs.writeFile(saveTo, html);

    console.log(project, filename.replace(workingDir, ""), "->", saveTo.replace(workingDir, ""));
  }
}

main().catch(console.error);
