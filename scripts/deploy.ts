import { copy, ensureFile, lstat, lstatSync, readdir, readFile, writeFile } from "fs-extra";
import { compressImage, fixedFloat, getAllFiles, relative } from "./utils/utils";
import { load } from "cheerio";
import path = require("path");
import prompts = require("prompts");
import yaml = require("yaml");
import minimatch = require("minimatch");
import _ = require("lodash");

declare global {
  var project: { name: string; dist: string; host: string };
}

async function pre() {
  const rootDir = path.resolve("./");
  const distDir = path.resolve("./dist");
  const hostsDir = path.resolve("./hosts");
  const projects = (await readdir(distDir))
    .map((filename) => ({
      name: filename,
      dist: path.join(distDir, filename),
      host: path.join(hostsDir, filename),
    }))
    .filter((project) => lstatSync(project.dist).isDirectory());

  if (projects.length > 1) {
    global.project = (
      await prompts([
        {
          type: "select",
          name: "project",
          message: "Project?",
          choices: projects.map((project) => ({
            title: project.name,
            value: project,
          })),
        },
      ])
    ).project;
  } else if (projects.length === 1) {
    global.project = projects[0];
  } else {
    throw { message: "no project found" };
  }

  const copyTo = path.join(project.host, "./public");
  const allFiles = await getAllFiles(project.dist);
  const htmlFiles: Array<string> = [];
  const config = yaml.parse(await readFile(path.join(__dirname, "deploy.yaml"), "utf-8"));
  const copies = {};

  config.ignores = config.ignores.map((v) => path.join(rootDir, v));

  for (const file of allFiles) {
    let next = false;

    for (const pattern of config.ignores) {
      if (minimatch(file, pattern)) {
        next = true;
        break;
      }
    }

    if (next) continue;

    if (file.endsWith(".html")) {
      htmlFiles.push(file);
    }

    copies[file] = file.replace(path.join(distDir, project.name), copyTo);
  }

  await Promise.all(
    _.map(copies, async (to, file) => {
      await ensureFile(to);
      await copy(file, to);
    })
  );

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, "utf-8");
    const $ = load(html);

    await processorImgTags(path.dirname(copies[htmlFile]), $);
    await writeFile(copies[htmlFile], $.html());
  }
}

async function processorImgTags(dirname: string, $: cheerio.Root) {
  const elements: Array<cheerio.Cheerio> = [];

  $("img").each((index, element) => {
    elements.push($(element));
  });

  const _compressImage = async (filename: string) => {
    const compressedImage = await compressImage(filename);
    const compressedSize = (await lstat(compressedImage)).size;
    const originSize = (await lstat(filename)).size;

    await copy(compressedImage, filename);

    console.table({
      filename: relative(filename),
      to: relative(compressedImage),
      origin: fixedFloat(originSize / 1024),
      compressed: fixedFloat(compressedSize / 1024),
      reduce: fixedFloat(originSize / 1024 - compressedSize / 1024),
      result: "-" + fixedFloat(((originSize - compressedSize) / originSize) * 100) + "%",
    });
  };

  for (const $element of elements) {
    const src = $element.attr("src");
    const alt = $element.attr("alt").trim();
    const filename = path.join(dirname, src);

    await _compressImage(filename);
    // if (!alt) {
    //   console.error(src);
    //
    //   break;
    // }
  }
}

function deploy() {
  // exec(
  //   "firebase deploy",
  //   {
  //     cwd: project.host,
  //   },
  //   (error, stdout, stderr) => console.log(error, stdout, stderr)
  // );
}

pre().then(deploy).catch(console.error);
