import path = require("path");
import fs = require("fs-extra");
import tinify = require("tinify");
import _ = require("lodash");
import md5 = require("md5");
import { ensureDir } from "fs-extra";

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
  const ext = chunks.pop();
  const onlyName = chunks.join(".");

  return { dir, ext, fullName, onlyName };
}

export async function compressImage(filename: string): Promise<string> {
  const cachedDir = path.resolve("./cached");

  await ensureDir(cachedDir);

  const content = await fs.readFile(filename, "utf-8");
  const contentMd5 = md5(content);
  const cachedFile: string = path.join(cachedDir, contentMd5);
  const cachedFileRef: string = path.join(cachedDir, contentMd5 + ".ref");

  if (await fs.pathExists(cachedFile)) return cachedFile;
  if (await fs.pathExists(cachedFileRef)) return path.join(cachedDir, await fs.readFile(cachedFileRef, "utf-8"));

  const apiKeys = ["cLH8b75hpcXHxy202hg3XdjJDbh27wLS", "V76Fv6wT6kM9CWYS6bZKrqg6PGZgLKcz"];

  tinify.key = apiKeys[_.random(0, apiKeys.length - 1)];

  const source = tinify.fromFile(filename);

  await source.toFile(cachedFile);

  const newContent = await fs.readFile(cachedFile, "utf-8");
  const newContentMd5 = md5(newContent);

  await fs.writeFile(path.join(cachedDir, newContentMd5 + ".ref"), contentMd5);

  return cachedFile;
}

export function relative(filename: string): string {
  return filename.replace(path.resolve("./") + path.sep, "");
}

export function fixedFloat(n: any, fractionDigits: number = 2) {
  return parseFloat(parseFloat(n).toFixed(fractionDigits));
}
