import { readdir, lstatSync, copy, ensureFile, readFile } from "fs-extra";
import path = require("path");
import prompts = require("prompts");
import { exec } from "child_process";
import { getAllFiles } from "../utils/utils";
import { load } from "cheerio";

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

  for (const file of allFiles) {
    const to = file.replace(path.join(distDir, project.name), copyTo);

    await ensureFile(to);
    await copy(file, to);

    if (file.endsWith(".html")) {
      htmlFiles.push(file);
    }

    console.log(file.replace(rootDir, ""), "->", to.replace(rootDir, ""));
  }

  for (const htmlFile of htmlFiles) {
    const html = await readFile(htmlFile, "utf-8");
    const $ = load(html);

    $("img").each((index, element) => {
      console.log($(element).attr("src"));
    });
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
