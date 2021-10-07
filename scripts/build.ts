import pug = require("pug");
import path = require("path");
import { downloadFile, getAllDirs, getAllFiles, parseDescription, parseFilename, relative } from "./utils/utils";
import fs = require("fs-extra");
import yaml = require("yaml");
import { copy, ensureDir, ensureFile, pathExists } from "fs-extra";
import cheerio = require("cheerio");
import slug = require("slug");
import { key } from "tinify";

async function main() {
  const workingDir = path.join(__dirname, "../.");
  const assetsDir = path.join(__dirname, "../assets");
  const pagesDir = path.join(__dirname, "../pages");
  const distDir = path.join(__dirname, "../dist");
  const cacheDir = path.resolve("./.cached");
  const assets = await getAllDirs(assetsDir);
  const pageFiles = await getAllFiles(pagesDir);
  const processed: {
    [key: string]: boolean;
  } = {};

  await fs.remove(distDir);

  const buildData: Array<{
    filename: string;
    saveTo: string;
    locals: any;
    project: string;
  }> = [];
  const posts: Array<{
    title: string;
    description: string;
    url: string;
    cover: string;
  }> = [];

  for (const filename of pageFiles) {
    const project = path.dirname(filename).split(path.sep).pop();

    if (!processed[project]) {
      const project = path.dirname(filename).split(path.sep).pop();

      for (const asset of assets) {
        if (!(await fs.lstat(asset)).isDirectory()) continue;

        if (asset.split(path.sep).pop() === project) {
          const parent = path.dirname(asset);
          const to = parent.replace(workingDir, "");
          const target = path.join(distDir, project, to);

          await fs.copy(asset, target);

          console.log(project, asset.replace(workingDir, ""), "->", target.replace(workingDir, ""));
        }
      }

      processed[project] = true;
    }

    if (!filename.endsWith(".pug")) continue;

    const chunks: Array<string> = filename.split(".pug");

    chunks.pop();

    const saveTo = (chunks.join(".pug") + ".html").replace(pagesDir, distDir);
    const dataFile = chunks.join(".pug") + ".yaml";
    let locals: { [key: string]: any } = {};

    if (fs.existsSync(dataFile)) {
      locals = yaml.parse(await fs.readFile(dataFile, "utf-8"));
    }

    if (Array.isArray(locals.includes)) {
      let includeLocals = {};

      for (const include of locals.includes) {
        const dir = path.dirname(dataFile);
        const inc = path.join(dir, include);

        if (await fs.pathExists(inc)) {
          includeLocals = {
            ...includeLocals,
            ...yaml.parse(await fs.readFile(inc, "utf-8")),
          };
        }
      }

      locals = {
        ...includeLocals,
        ...locals,
      };
    }

    if (locals.template === "post") {
      const parsedFilename = parseFilename(filename);
      const dir = path.dirname(filename);
      const childrenDir = path.join(dir, parsedFilename.onlyName);
      const projectDir = path.resolve("./dist/" + project);

      if (await pathExists(childrenDir)) {
        const children = await getAllFiles(childrenDir);

        for (const child of children) {
          if (!child.endsWith(".html")) continue;

          const categoryURL = path
            .dirname(child)
            .replace(childrenDir, "")
            .split(path.sep)
            .map((v) => slug(v))
            .join("/");
          const category = path.dirname(child).replace(childrenDir, "").split(path.sep).pop();
          const html = await fs.readFile(child, "utf-8");
          let $ = cheerio.load(html);
          const title = $("h1.page-title").html();

          const images: Array<cheerio.Element> = [];
          const names: { [key: string]: number } = {};

          $("img").each((index, element) => {
            images.push(element);
          });

          for (const image of images) {
            const src = $(image).attr("src");

            if (typeof src === "string" && src.startsWith("http")) {
              let caption = $($($($(image).parent()).parent()).find("figcaption"))
                .text()
                .trim();
              let name = path.basename(src);
              const nameInfo = parseFilename(name);

              if (!caption) {
                caption = nameInfo.onlyName;
              }

              if (caption) {
                if (names[caption] === undefined) {
                  names[caption] = 0;
                } else {
                  names[caption]++;
                }

                name = [slug(caption), names[caption]].filter((v) => v !== 0).join("_") + "." + nameInfo.ext;
              }

              const downloadTo = path.join(cacheDir, "images/posts", slug(title), name);
              const copyTo = path.join(projectDir, "assets/images/posts", slug(title), name);
              const newSrc = copyTo.replace(projectDir, "").split(path.sep).join("/");

              await ensureDir(path.dirname(downloadTo));
              await downloadFile(src, downloadTo);
              await copy(downloadTo, copyTo);

              $(image).attr("src", newSrc);
            }
          }

          const description = parseDescription($($("p").get(0)).text());
          const background = $("img").attr("src");

          $("p").addClass("color-text-primary la-text-justify");
          $("figcaption").addClass("la-figcaption");
          $("figure").addClass("la-figure");
          $("h2").addClass("la-post-h2");
          $("h3").addClass("text-pretty");
          $("img").addClass("allow-viewer");
          $("li").addClass("la-list-style");
          $("a").each((index, element) => {
            if ($(element).find("img").length === 1) {
              $(element).replaceWith($(element).find("img"));
            }
          });
          $("figure").each((index, element) => {
            const $element = $(element);
            const $caption = $element.find("figcaption");

            if ($caption.length) {
              $element.find("img").attr("alt", $caption.text().trim());
            }
          });
          $("h2, h3").each((index, element) => {
            $(element).attr("id", slug($(element).text()));
          });
          $("figure").each((index, element) => {
            if (index === 0) {
              $(element).remove();
            }
          });
          $("h1.page-title").remove();
          $("header").remove();
          $("p").each((index, element) => {
            if (index === 0) {
              $(element).remove();
            }
          });
          $("a").each((index, element) => {
            if ($(element).attr("href").startsWith("http")) {
              $(element).attr("rel", "noreferrer");
            }
          });
          $ = cheerio.load($.html());

          let contents = [];
          let lastContentHref = "";

          $("h2, h3").each((index, element) => {
            const name = slug($(element).text());

            // $(element).addClass("la-sticky");
            // $(element).attr("data-sticky-wrap", "true");
            // $(element).attr("data-sticky-class", "la-sticky-love");

            if ($(element).prop("tagName") === "H2") {
              contents.push({
                name: $(element).text().trim(),
                href: "#" + name,
              });
              lastContentHref = "#" + name;
            } else if ($(element).prop("tagName") === "H3" && contents.length > 0) {
              if (!contents[contents.length - 1].children) {
                contents[contents.length - 1].children = [];
              }

              contents[contents.length - 1].children.push({
                name: $(element).text().trim(),
                href: "#" + name,
              });
              lastContentHref = "#" + name;
            }

            $(element).attr("data-last-content-href", lastContentHref);
          });

          const content = $("article").html();
          const saveTo = path.join(chunks.join(".pug"), categoryURL, path.basename(child)).replace(pagesDir, distDir);

          buildData.push({
            project: project,
            filename: filename,
            saveTo: saveTo,
            locals: {
              ...locals,
              category,
              categoryURL: "/" + path.basename(childrenDir) + categoryURL,
              title,
              description,
              content,
              background,
              contents: [...contents, { name: "Xem thêm", href: "#see-also" }],
            },
          });
          posts.push({
            title: title,
            description: description,
            cover: background,
            url: saveTo.replace(projectDir, "").split(path.sep).join("/"),
          });
        }
      }
    } else {
      buildData.push({
        project: project,
        filename: filename,
        locals: locals,
        saveTo: saveTo,
      });
    }
  }

  for (const cd of buildData) {
    const project = cd.project;
    const filename = cd.filename;
    const fn = pug.compileFile(filename);
    const html = fn({
      ...cd.locals,
      posts: posts,
    });

    await fs.ensureFile(cd.saveTo);
    await fs.writeFile(cd.saveTo, html);

    console.log(project, filename.replace(workingDir, ""), "->", cd.saveTo.replace(workingDir, ""));
  }
}

main().catch(console.error);
