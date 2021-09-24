import { getAllFiles } from "../utils/utils";
import path = require("path");
import _ = require("lodash");
import html2pug = require("html2pug");
import fs = require("fs-extra");

async function main() {
  const dir = path.join(__dirname, "../assets/themes");
  const files = await getAllFiles(dir);

  await Promise.all(
    _.map(files, async (file: string) => {
      if (file.endsWith(".html")) {
        const html = await fs.readFile(file, "utf-8");
        const pugFileChunk = file.split(".");

        pugFileChunk.pop();
        pugFileChunk.push("pug");

        await fs.writeFile(
          pugFileChunk.join("."),
          html2pug(html, {
            doubleQuotes: true,
          })
        );
      }
    })
  );
}

main().catch(console.error);
