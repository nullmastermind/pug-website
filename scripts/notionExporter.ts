import axios from "axios";
import AdmZip = require("adm-zip");
import { ensureDir, readFile, writeFile } from "fs-extra";
import yaml = require("yaml");
import path = require("path");
import { getProject, parseFilename, toUUID } from "./utils/utils";
import slug = require("slug");
import cheerio = require("cheerio");

async function exportBlock(token: string, id: string, saveTo: string, exportType: "html" | "markdown" = "html") {
  id = toUUID(id);

  const instance = axios.create({
    baseURL: "https://www.notion.so/api/v3",
    headers: {
      Cookie: `token_v2=${token}; `,
    },
  });
  const res: any = await instance.post("/enqueueTask", {
    task: {
      eventName: "exportBlock",
      request: {
        block: {
          id: id,
        },
        recursive: false,
        exportOptions: {
          exportType: exportType,
          timeZone: "Asia/Saigon",
          locale: "en",
        },
      },
    },
  });

  let zipURL: string;

  while (true) {
    const res1: any = await instance.post("/getTasks", {
      taskIds: [res.data.taskId],
    });
    const result: any = res1.data.results[0];

    if (result.status?.type === "complete") {
      zipURL = result.status.exportURL;
      break;
    }

    await new Promise((rel) => setTimeout(rel, 1000));
  }

  const res2 = await instance.get(zipURL, { responseType: "arraybuffer" });
  const zip = new AdmZip(res2.data);
  const entries = zip.getEntries();
  const project = await getProject();

  for (const entry of entries) {
    if (entry.entryName.endsWith(".html")) {
      const saveTo2 = path.resolve(saveTo);

      const html = entry.getData().toString();
      const $ = cheerio.load(html);

      $("p").each((index, element) => {
        const text = ($(element).text() || "").trim();

        if (text.length === 0) {
          $(element).remove();
        }
      });

      $("img").each((index, element) => {
        let src = $(element).attr("src");

        if (!src.startsWith("http")) {
          src = path.join(project.distAssets, "images", parseEntryName(src)).replace(project.dist, "").split(path.sep).join("/");

          $(element).attr("src", src);
        }
      });

      await ensureDir(path.dirname(saveTo2));
      await writeFile(saveTo2, $.html(), "utf-8");
    } else {
      saveTo = path.join(project.assets, "images", parseEntryName(entry.entryName));

      await ensureDir(path.dirname(saveTo));
      await writeFile(saveTo, entry.getData());
    }
  }
}

function parseEntryName(entryName: string) {
  entryName = decodeURIComponent(entryName);

  return entryName
    .split(path.sep)
    .join("/")
    .split("/")
    .map((v) => v.trim())
    .filter((v) => v.length)
    .map((v) => {
      const parsed = parseFilename(v);

      return [parsed.onlyName, parsed.ext]
        .filter((v) => v.length > 0)
        .map((v) => slug(v))
        .join(".");
    })
    .join("/");
}

async function main() {
  const config = yaml.parse(await readFile(path.join(__dirname, "notionExporter.yaml"), "utf-8"));

  for (const post of config.posts) {
    await exportBlock(config.token, post.id, post.path);

    console.log("exported:", post.path);
  }

  process.exit(0);
}

main().catch(console.error);
