const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Gather coverage for JS and CSS files
  await Promise.all([page.coverage.startJSCoverage(), page.coverage.startCSSCoverage()]);

  await page.goto("https://hoiandor.org");
  await page.waitForNetworkIdle();

  // Stops the coverage gathering
  const [jsCoverage, cssCoverage] = await Promise.all([page.coverage.stopJSCoverage(), page.coverage.stopCSSCoverage()]);

  // Calculates # bytes being used based on the coverage
  const calculateUsedBytes = (type, coverage) =>
    coverage.map(({ url, ranges, text }) => {
      let usedBytes = 0;

      ranges.forEach((range) => {
        usedBytes += range.end - range.start - 1;

        console.log(url, text.substring(range.start, range.end));
      });

      return {
        url,
        type,
        usedBytes,
        totalBytes: text.length,
        percentUsed: `${((usedBytes / text.length) * 100).toFixed(2)}%`,
      };
    });

  console.info([...calculateUsedBytes("js", jsCoverage), ...calculateUsedBytes("css", cssCoverage)]);

  await browser.close();
})();
