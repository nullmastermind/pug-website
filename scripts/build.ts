import pug = require("pug");
import path = require("path");
import { getAllDirs, getAllFiles, parseFilename, relative } from "./utils/utils";
import fs = require("fs-extra");
import yaml = require("yaml");
import { pathExists } from "fs-extra";
import cheerio = require("cheerio");
import slug = require("slug");

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
        if (!(await fs.lstat(asset)).isDirectory()) continue;

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

    if (!filename.endsWith(".pug")) continue;

    const chunks: Array<string> = filename.split(".pug");

    chunks.pop();

    const saveTo = (chunks.join(".pug") + ".html").replace(pagesDir, distDir);
    const dataFile = chunks.join(".pug") + ".yaml";
    let locals: { [key: string]: any } = {};

    if (fs.existsSync(dataFile)) {
      locals = yaml.parse(await fs.readFile(dataFile, "utf-8"));
    }

    if (Array.isArray(locals.includes)) {
      let includeLocals = {};

      for (const include of locals.includes) {
        const dir = path.dirname(dataFile);
        const inc = path.join(dir, include);

        if (await fs.pathExists(inc)) {
          includeLocals = {
            ...includeLocals,
            ...yaml.parse(await fs.readFile(inc, "utf-8")),
          };
        }
      }

      locals = {
        ...includeLocals,
        ...locals,
      };
    }

    const compileData = [
      {
        locals: locals,
        saveTo: saveTo,
      },
    ];

    if (locals.template === "post") {
      const parsedFilename = parseFilename(filename);
      const dir = path.dirname(filename);
      const childrenDir = path.join(dir, parsedFilename.onlyName);

      if (await pathExists(childrenDir)) {
        const children = await getAllFiles(childrenDir);

        for (const child of children) {
          if (!child.endsWith(".html")) continue;

          const categoryURL = path
            .dirname(child)
            .replace(childrenDir, "")
            .split(path.sep)
            .map((v) => slug(v))
            .join("/");
          const category = path.dirname(child).replace(childrenDir, "").split(path.sep).pop();
          const html = await fs.readFile(child, "utf-8");
          const $ = cheerio.load(html);
          const $article = $("article");
          const title = $("header h1").html();
          const description = $(".page-body p:first-child").html();
          const content = $article.html();
          const saveTo = path.join(chunks.join(".pug"), categoryURL, path.basename(child)).replace(pagesDir, distDir);

          compileData.push({
            saveTo: saveTo,
            locals: {
              ...locals,
              category,
              categoryURL,
              title,
              description,
              content,
            },
          });
        }
      }
    }

    for (const cd of compileData) {
      const fn = pug.compileFile(filename);
      const html = fn(cd.locals);

      await fs.ensureFile(cd.saveTo);
      await fs.writeFile(cd.saveTo, html);

      console.log(project, filename.replace(workingDir, ""), "->", cd.saveTo.replace(workingDir, ""));
    }
  }
}

main().catch(console.error);
