import path = require("path");
import fs = require("fs-extra");
import tinify = require("tinify");
import _ = require("lodash");
import md5 = require("md5");
import { ensureDir, lstatSync, pathExists, readdir, remove } from "fs-extra";
import axios from "axios";
import { createWriteStream } from "fs";
import prompts = require("prompts");

declare global {
  var project: IProject;
}

export async function getAllFiles(dir: string): Promise<Array<string>> {
  let result: Array<string> = [];
  const files = await fs.readdir(dir);

  for (let filename of files) {
    filename = path.join(dir, filename);

    if ((await fs.lstat(filename)).isDirectory()) {
      result = result.concat(await getAllFiles(filename));
    } else {
      result.push(filename);
    }
  }

  return result;
}

export async function getAllDirs(dir: string): Promise<Array<string>> {
  let result: Array<string> = [];
  const dirs = await fs.readdir(dir);

  for (let dirname of dirs) {
    dirname = path.join(dir, dirname);

    if ((await fs.lstat(dirname)).isDirectory()) {
      result.push(dirname);

      result = result.concat(await getAllDirs(dirname));
    }
  }

  return result;
}

export function parseFilename(filename: string) {
  const dir = path.dirname(filename);
  const fullName = path.basename(filename);
  const chunks = fullName.split(".");
  let ext = chunks.pop();
  let onlyName = chunks.join(".");

  if (onlyName.length === 0 && ext === fullName) {
    onlyName = ext;
    ext = "";
  }

  return { dir, ext, fullName, onlyName };
}

export async function compressImage(filename: string): Promise<string> {
  try {
    const cachedDir = path.resolve("./.cached");

    await ensureDir(cachedDir);

    const content = await fs.readFile(filename, "utf-8");
    const contentMd5 = md5(content);
    const cachedFile: string = path.join(cachedDir, contentMd5);
    const cachedFileRef: string = path.join(cachedDir, contentMd5 + ".ref");

    if (await fs.pathExists(cachedFile)) return cachedFile;
    if (await fs.pathExists(cachedFileRef)) return path.join(cachedDir, await fs.readFile(cachedFileRef, "utf-8"));

    console.log("call API:", relative(filename));

    const apiKeys = ["cLH8b75hpcXHxy202hg3XdjJDbh27wLS", "YBg9YR2P4H3qjF0MlddSk985R8Qlykf2", "GSh0VNTpw0XMkG3YNvxfvJkscvFVhH85"];

    tinify.key = apiKeys[_.random(0, apiKeys.length - 1)];

    const source = tinify.fromFile(filename);

    await source.toFile(cachedFile);

    const newContent = await fs.readFile(cachedFile, "utf-8");
    const newContentMd5 = md5(newContent);

    await fs.writeFile(path.join(cachedDir, newContentMd5 + ".ref"), contentMd5);

    return cachedFile;
  } catch (e) {
    console.log(filename);

    throw e;
  }
}

export function relative(filename: string): string {
  return filename.replace(path.resolve("./") + path.sep, "");
}

export function fixedFloat(n: any, fractionDigits: number = 2) {
  return parseFloat(parseFloat(n).toFixed(fractionDigits));
}

export function parseDescription(baseDesc: string, maxLength = 160) {
  baseDesc = baseDesc.trim().replace(/\n/g, " ");

  while (true) {
    if (baseDesc.includes("  ")) {
      baseDesc = baseDesc.replace("  ", " ");
    } else {
      break;
    }
  }

  if (baseDesc.length > maxLength) {
    baseDesc = baseDesc.substr(0, maxLength) + "...";
  }

  return baseDesc;
}

// https://stackoverflow.com/a/61269447/6435579
export async function downloadFile(fileUrl: string, outputLocationPath: string) {
  if (await pathExists(outputLocationPath)) {
    return true;
  }

  const writer = createWriteStream(outputLocationPath);

  return axios({
    method: "get",
    url: fileUrl,
    responseType: "stream",
  }).then((response: any) => {
    //ensure that the user can call `then()` only when the file has
    //been downloaded entirely.

    return new Promise((resolve, reject) => {
      response.data.pipe(writer);
      let error = null;
      writer.on("error", (err) => {
        error = err;
        writer.close();
        remove(outputLocationPath);
        reject(err);
      });
      writer.on("close", () => {
        if (!error) {
          resolve(true);
        }
        //no need to call the reject here, as it will have been called in the
        //'error' stream;
      });
    });
  });
}

export async function findName(originName: string) {
  const parsedFileName = parseFilename(originName);
  let i = 1;

  while (true) {
    if (!(await pathExists(originName))) {
      break;
    }

    originName = path.join(parsedFileName.dir, parsedFileName.onlyName + "_" + ("0" + i).slice(-2) + "." + parsedFileName.ext);

    i += 1;
  }

  return originName;
}

const HYPHENS_POSITIONS = [8, 12, 16, 20];
const VALUE_REGEXP = /^[0-9A-Fa-f]{32}$/;

/**
 * Insert value to a source array at position
 * @param {Array} source array to insert
 * @param {number} position position to insert
 * @param {*} value value to insert
 * @returns {Array}
 */
function insert<T>(source: T[], position: number, value: T): T[] {
  return [...source.slice(0, position), value, ...source.slice(position)];
}

/**
 * Format string to UUID format
 * @param {string} value string of 32 hexadecimal numbers
 * @returns {string} formatted toUUID string
 */
export function toUUID(value: string) {
  value = value.split("-").join("");

  if (typeof value !== "string") {
    throw new Error(`Value must be string`);
  }
  if (!VALUE_REGEXP.test(value)) {
    throw new Error(`Value must be string of 32 hexadecimal numbers`);
  }

  let array = value.split("");
  let offset = 0;
  for (const num of HYPHENS_POSITIONS) {
    const position = num + offset++;
    array = insert(array, position, "-");
  }
  return array.join("");
}

export type IProject = {
  name: string;
  dist: string;
  distAssets: string;
  host: string;
  public: string;
  page: string;
  assets: string;
};

export async function getProject() {
  if (!global.project) {
    const distDir = path.resolve("./dist");
    const hostsDir = path.resolve("./hosts");
    const pagesDir = path.resolve("./pages");
    const assetsDir = path.resolve("./assets");
    const projects = (await readdir(distDir))
      .map((dirname) => ({
        name: dirname,
        dist: path.join(distDir, dirname),
        distAssets: path.join(distDir, dirname, "assets"),
        host: path.join(hostsDir, dirname),
        public: path.join(hostsDir, dirname, "public"),
        page: path.join(pagesDir, dirname),
        assets: path.join(assetsDir, dirname),
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
      await getProject();
    }
  }

  return global.project;
}
