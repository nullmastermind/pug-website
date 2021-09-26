import path = require("path");
import fs = require("fs-extra");

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
