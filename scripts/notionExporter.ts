import axios from "axios";
import AdmZip = require("adm-zip");
import _ = require("lodash");
import { ensureDir, readFile, writeFile } from "fs-extra";
import yaml = require("yaml");
import path = require("path");

async function exportBlock(token: string, id: string, saveTo: string, exportType: "html" | "markdown" = "html") {
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
  const entry = _.find(zip.getEntries(), (entry) => entry.name.endsWith(".html"));

  saveTo = path.resolve(saveTo);

  if (entry?.getData().toString().trim()) {
    await ensureDir(path.dirname(saveTo));
    await writeFile(path.resolve(saveTo), entry?.getData().toString().trim() || "", "utf-8");
  } else {
    throw { message: "Error: " + id };
  }
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
