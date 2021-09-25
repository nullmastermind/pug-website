import { getAllFiles } from "../utils/utils";
import path = require("path");
import _ = require("lodash");
import html2pug = require("html2pug");
import fs = require("fs-extra");
import prettier = require("prettier");

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

        let pugContent = html2pug(html, {
          doubleQuotes: true,
        });

        try {
          pugContent = prettier.format(pugContent, {
            parser: "pug",
            ...(await fs.readJSON(path.join(__dirname, "../.prettierrc.json"))),
          });
        } catch (e) {
          console.error(file);
        }

        await fs.writeFile(
          pugFileChunk.join("."),
          pugContent
            .split("\n")
            .map((v) => {
              if (v.trim().length === 0) return;

              return v;
            })
            .filter((v) => v !== undefined)
            .join("\n")
        );

        console.log(file);
      }
    })
  );
}

main().catch(console.error);
