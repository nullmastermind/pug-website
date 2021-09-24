import path = require("path");
import _ = require("lodash");
import fs = require("fs-extra");

export async function getAllFiles(dir: string): Promise<Array<string>> {
  let result: Array<string> = [];
  const files = await fs.readdir(dir);

  await Promise.all(
    _.map(files, async (filename: string) => {
      filename = path.join(dir, filename);

      if ((await fs.lstat(filename)).isDirectory()) {
        result = result.concat(await getAllFiles(filename));
      } else {
        result.push(filename);
      }
    })
  );

  return result;
}
