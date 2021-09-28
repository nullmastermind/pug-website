import { readdir, lstatSync } from "fs-extra";
import path = require("path");
import prompts = require("prompts");
import { exec } from "child_process";

declare global {
  var project: { name: string; dist: string; host: string };
}

async function pre() {
  const distDir = path.resolve("./dist");
  const hostsDir = path.resolve("./hosts");
  const projects = (await readdir(distDir))
    .map((filename) => ({
      name: filename,
      dist: path.join(distDir, filename),
      host: path.join(hostsDir, filename),
    }))
    .filter((project) => lstatSync(project.dist).isDirectory());

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

  console.log(project);
}

pre()
  .catch(console.error)
  .then(() => {
    exec(
      "firebase deploy",
      {
        cwd: project.host,
      },
      (error, stdout, stderr) => console.log(error, stdout, stderr)
    );
  });
