import puppeteer = require("puppeteer");
import _ = require("lodash");
import path = require("path");
import { pathExists } from "fs-extra";
import { getAllFiles, relative } from "./utils/utils";

const sizeOf = require("image-size");

async function main() {
  const root = path.resolve("./dist/hoiandor");
  const routes = (await getAllFiles(root))
    .filter((v) => v.endsWith(".html"))
    .filter((v) => !path.relative(root, v).startsWith("assets"))
    .map((v) => path.resolve(root, v))
    .map((v) => "file://" + v);

  const browser = await puppeteer.launch({
    // headless: false,
    defaultViewport: {
      width: 1920,
      height: 1080,
    },
  });

  await Promise.all(
    _.map(routes, async (route) => {
      const page = await browser.newPage();

      await page.goto(route);
      await page.waitForNetworkIdle();

      let images = await page.$$eval("img", (elements) => {
        return elements
          .map((element) => {
            if (element.matches(".la-ignore-gallery")) return;

            const rect = element.getBoundingClientRect();

            return {
              src: element.getAttribute("src"),
              alt: element.getAttribute("alt"),
              width: Math.round(rect.width),
              height: Math.round(rect.height),
            };
          })
          .filter((v) => v !== undefined);
      });
      const backgrounds = await page.$$eval("[style]", (elements) => {
        return elements
          .map((element) => {
            const $ = (window as any).jQuery;
            const rect = element.getBoundingClientRect();
            let image = $(element).css("background-image");

            if (typeof image === "string" && image.includes("url")) {
              image = image.split("url")[1].split('"')[1].split('"')[0];

              return {
                src: image.replace("file:///", ""),
                width: Math.round(rect.width),
                height: Math.round(rect.height),
                alt: "",
              };
            }
          })
          .filter((v) => v !== undefined);
      });

      images = images.concat(
        backgrounds.map((v) => ({
          ...v,
          src: path.relative(root, v.src),
        }))
      );
      images.sort((a, b) => b.width * b.height - a.width * a.height);
      images = _.uniqBy(images, "src");

      for (const image of images) {
        const filename = path.join(root, image.src);

        if (await pathExists(filename)) {
          const real = sizeOf(filename);

          if (real.width * real.height > image.width * image.height) {
            console.log(relative(filename), [image.width, image.height], [real.width, real.height]);
          }
        }
      }
    })
  );

  await browser.close();
}

main().catch(console.error);
