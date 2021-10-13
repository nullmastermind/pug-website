import { copy, ensureDir, ensureFile, lstat, lstatSync, pathExists, readdir, readFile, remove, writeFile } from "fs-extra";
import { compressImage, findName, fixedFloat, getAllFiles, getProject, IProject, parseFilename, relative } from "./utils/utils";
import { load } from "cheerio";
import path = require("path");
import yaml = require("yaml");
import minimatch = require("minimatch");
import _ = require("lodash");
import { existsSync } from "fs";
import htmlMinifier = require("html-minifier");
import CleanCSS = require("clean-css");
import moment = require("moment");
import webp = require("webp-converter");
import UglifyJS = require("uglify-js");
import slug = require("slug");

const sizeOf = require("image-size");

declare global {
  var project: IProject;
  var now: any;
}

async function pre() {
  await getProject();

  global.now = moment().format("YYYYMMDD-HHmmss");

  const rootDir = path.resolve("./");
  const distDir = path.resolve("./dist");
  const copyTo = path.join(project.host, "./public");

  await remove(copyTo);
  await ensureDir(copyTo);

  const allFiles = await getAllFiles(project.dist);
  const htmlFiles: Array<string> = [];
  const jsFiles: Array<string> = [];
  const config = yaml.parse(await readFile(path.join(__dirname, "deploy.yaml"), "utf-8"));
  const copies = {};

  config.ignores = config.ignores.map((v) => path.join(rootDir, v));
  config.compressIgnores = (config.compressIgnores || []).map((v) => path.join(rootDir, v));

  for (const file of allFiles) {
    let next = false;

    for (const pattern of config.ignores) {
      if (minimatch(file, pattern)) {
        next = true;
        break;
      }
    }

    if (next) continue;

    if (file.endsWith(".html")) {
      htmlFiles.push(file);
    }

    copies[file] = file.replace(path.join(distDir, project.name), copyTo);
  }

  await Promise.all(
    _.map(copies, async (to, file) => {
      await ensureFile(to);
      await copy(file, to);
    })
  );

  for (const file of htmlFiles) {
    const dirname = path.dirname(copies[file]);
    let content = await readFile(file, "utf-8");

    content = await processorBackgroundImages(path.join(project.host, "public"), content, config);

    const $ = load(content);
    await processorImgTags(path.join(project.host, "public"), $);

    $("script[src]").each((index, element) => {
      const $element = $(element);
      const file = path.join(project.dist, $element.attr("src"));

      if (existsSync(file)) {
        jsFiles.push(copies[file]);
      }
    });

    const cssFiles = [];

    $('link[rel="stylesheet"]').each((index, element) => {
      const $element = $(element);
      const cssFile = path.join(project.dist, $element.attr("href"));

      if (existsSync(cssFile)) {
        cssFiles.push(cssFile);
      }
    });

    for (const file of cssFiles) {
      await _cleanCss(copies[file]);

      const dirname = path.dirname(copies[file]);
      let content = await readFile(file, "utf-8");

      content = await processorBackgroundImages(path.join(project.host, "public"), content, config);

      await writeFile(file, content);
    }

    await processorVersion($);
    await writeFile(copies[file], $.html());
    await _cleanHtml(copies[file]);
  }

  await _cleanJs(jsFiles);
  await _cleanOthers(htmlFiles.map((v) => copies[v]));
}

async function processorBackgroundImages(dirname: string, content: string, config: any) {
  const backgroundChunks = content.split("background");
  const images = [];
  const mapNames = {};

  _.forEach(backgroundChunks, (chunk) => {
    if (chunk.includes("url")) {
      try {
        const detectedName = chunk.split("url")[1].split("(")[1].split(")")[0].replace(/"/g, "").replace(/'/g, "").trim();
        const url = path.join(dirname, detectedName);

        if (existsSync(url)) {
          let next = false;

          for (const pattern of config.compressIgnores) {
            if (minimatch(url, pattern)) {
              next = true;
              break;
            }
          }

          if (!next) {
            mapNames[url] = detectedName;
            images.push(url);
          }
        }
      } catch (ignoreError) {}
    }
  });

  const replaces = {};

  for (const filename of images) {
    await _compressImage(filename);

    const webp = filename + ".webp";

    if (!filename.endsWith(".webp") && (await pathExists(webp))) {
      replaces[mapNames[filename]] = mapNames[filename] + ".webp";
    }
  }

  _.forEach(replaces, (v, k) => {
    content = content.replace(new RegExp(k, "g"), v);
  });

  return content;
}

async function processorImgTags(dirname: string, $: cheerio.Root) {
  const elements: Array<cheerio.Cheerio> = [];

  $("img").each((index, element) => {
    elements.push($(element));
  });

  for (const $element of elements) {
    const src = $element.attr("src");
    const filename = path.join(dirname, src);

    await _compressImage(filename);

    if (src && !src.endsWith(".webp")) {
      $element.attr("src", src + ".webp");
    }

    const dimensions = sizeOf(filename);

    $element.attr("width", dimensions.width);
    $element.attr("height", dimensions.height);
    // if (!alt) {
    //   console.error(src);
    //
    //   break;
    // }
  }
}

async function processorVersion($: cheerio.Root) {
  const _newVersion = (url: string) => {
    let sep = "?";

    if (url.includes("?")) {
      sep = "#";
    }

    return url + sep + "v=" + global.now;
  };

  $("link[href]").each((index, element) => {
    const href = $(element).attr("href");

    if (!href.startsWith("http")) {
      $(element).attr("href", _newVersion(href));
    }
  });

  $("script[src]").each((index, element) => {
    const src = $(element).attr("src");

    if (!src.startsWith("http")) {
      $(element).attr("src", _newVersion(src));
    }
  });
}

async function _cleanJs(jsFiles) {
  const options = {
    mangle: {
      toplevel: true,
    },
    nameCache: {},
    webkit: true,
    toplevel: true,
  };

  const cleaned: { [key: string]: boolean } = {};
  const files: { [key: string]: string } = {};

  for (const file of jsFiles) {
    files[file] = await readFile(file, "utf-8");
  }

  for (const file of jsFiles) {
    if (cleaned[file]) continue;

    if (file.endsWith("main.js")) {
      const code = UglifyJS.minify(files, options).code;

      await writeFile(file, code);
    } else {
      await writeFile(file, "");
    }

    cleaned[file] = true;

    console.log("clean:", relative(file));
  }

  // for (const file of jsFiles) {
  //   if (cleaned[file]) continue;
  //
  //   const code = UglifyJS.minify(
  //     {
  //       [file]: await readFile(file, "utf-8"),
  //     },
  //     options
  //   ).code;
  //
  //   // console.log(relative(file), code);
  //   await writeFile(file, code);
  //
  //   cleaned[file] = true;
  //
  //   console.log("clean:", relative(file));
  // }
}

async function _cleanCss(filename: string) {
  let content = await readFile(filename, "utf-8");

  content = new CleanCSS({}).minify(content).styles;

  await writeFile(filename, content);
}

async function _cleanHtml(filename: string) {
  let content = await readFile(filename, "utf-8");

  content = htmlMinifier.minify(content, {
    removeAttributeQuotes: true,
    collapseBooleanAttributes: true,
    minifyCSS: true,
    minifyJS: true,
  });

  await writeFile(filename, content);
}

async function _compressImage(filename: string, quality = 60) {
  const compressedImage = await compressImage(filename);
  const compressedSize = (await lstat(compressedImage)).size;
  const originSize = (await lstat(filename)).size;

  if (!filename.endsWith(".webp")) {
    const webpFile = filename + ".webp";

    await webp.cwebp(compressedImage, webpFile, "-q " + quality);

    if (await pathExists(webpFile)) {
      await copy(await compressImage(webpFile), webpFile);
    }
  }

  if (compressedImage !== filename) {
    await copy(compressedImage, filename);
  }

  // console.table({
  //   filename: relative(filename),
  //   to: relative(compressedImage),
  //   origin: fixedFloat(originSize / 1024),
  //   compressed: fixedFloat(compressedSize / 1024),
  //   reduce: fixedFloat(originSize / 1024 - compressedSize / 1024),
  //   result: "-" + fixedFloat(((originSize - compressedSize) / originSize) * 100) + "%",
  // });
  console.log(relative(filename), "-" + fixedFloat(((originSize - compressedSize) / originSize) * 100) + "%");

  const fileParsed = parseFilename(filename);

  if (fileParsed.onlyName.endsWith("-cropped")) {
    const originFile = filename.replace("-cropped", "");

    if (await pathExists(originFile)) {
      return await _compressImage(originFile, 100);
    }
  }
}

async function _cleanOthers(htmlFiles: Array<string>) {
  const project = await getProject();
  const dir = project.public;
  const cache: { [key: string]: string } = {};
  const seoUrls = [];

  htmlFiles.sort((a, b) => {
    a = relative(a);
    b = relative(b);

    return a.split("/").length - b.split("/").length;
  });

  for (const filename of htmlFiles) {
    const parsedFilename = parseFilename(filename);
    const content = await readFile(filename, "utf-8");
    const $ = load(content);
    const $elements: Array<cheerio.Cheerio> = [];
    const images: Array<{
      loc: string;
      caption: string;
      title: string;
    }> = [];

    $("script").each((index, element) => {
      let src = $(element).attr("src");

      if (src) {
        src = src.split("?")[0];

        if (!(src.startsWith("http") || src.endsWith("main.js"))) {
          $(element).remove();
        }
      }
    });

    $("img").each((index, element) => {
      $elements.push($(element));
    });

    for (const $element of $elements) {
      $element.attr("data-origin", $element.attr("src").replace("-cropped.", "."));

      const alt = ($element.attr("alt") || "").trim();

      if (alt.length > 0) {
        const src = $element.attr("src");
        const imageFile = path.join(dir, src);

        if (!cache[imageFile]) {
          const parsedImageFilename = parseFilename(imageFile);
          const newFilename = slug(alt);
          const newDir = path.join(path.dirname(parsedImageFilename.dir), parsedFilename.onlyName);
          const newFile = await findName(path.join(newDir, newFilename + "." + parsedImageFilename.ext));

          cache[imageFile] = newFile;
          images.push({
            loc: cache[imageFile].replace(dir, "").split(path.sep).join("/"),
            title: alt,
            caption: alt,
          });

          await copy(imageFile, newFile);
        }

        $element.attr("src", cache[imageFile].replace(dir, "").split(path.sep).join("/"));
      }
    }

    await writeFile(filename, $.html());

    if (!filename.endsWith("404.html")) {
      seoUrls.push({
        images: images,
        url: filename.replace(dir, "").split(path.sep).join("/"),
      });
    }
  }

  const config = yaml.parse(await readFile(path.resolve("./scripts/seo.yaml"), "utf-8"));
  const domain = config["domains"][project.name];
  let seoXmlUrls = [];

  for (const seoUrl of seoUrls) {
    const buildImages = [];

    for (const image of seoUrl.images) {
      buildImages.push(
        `
    <image:image>
      <image:loc>https://${domain}${image.loc}</image:loc>
      <image:caption>${image.caption}</image:caption>
      <image:title>${image.title}</image:title>
    </image:image>
`
      );
    }

    seoXmlUrls.push(
      `
  <url>
    <loc>https://${domain}${seoUrl.url}</loc>
    ${buildImages.join("\n")}
  </url>
`
    );
  }

  await writeFile(
    path.join(project.public, "sitemap.xml"),
    (
      await readFile(path.resolve("./pages/sitemap.xml"), "utf-8")
    ).replace(
      "<!-- {{ URLS }} -->",
      seoXmlUrls
        .join("\n")
        .split("\n")
        .map((v) => {
          if (v.trim().length === 0) return undefined;

          return v;
        })
        .filter((v) => v !== undefined)
        .join("\n")
    )
  );
  await writeFile(
    path.join(project.public, "robots.txt"),
    (await readFile(path.resolve("./pages/robots.txt"), "utf-8")).replace("{{DOMAIN}}", domain)
  );
}

function deploy() {}

pre().then(deploy).catch(console.error);
