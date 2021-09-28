import { readdir } from "fs-extra";
import path = require("path");
import { lstatSync } from "fs";
import prompts = require("prompts");

async function pre() {
  const dist = path.join(__dirname, "../dist");
  const projects = (await readdir(dist))
    .map((filename) => ({
      name: filename,
      path: path.join(dist, filename),
    }))
    .filter((project) => lstatSync(project.path).isDirectory());

  const selectedProject = (
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

  console.log(selectedProject);
}

pre().catch(console.error);
