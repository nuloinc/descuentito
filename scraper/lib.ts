import puppeteer from "puppeteer";
import ProxyChain from "proxy-chain";

export async function createBrowserSession() {
  const server = new ProxyChain.Server({
    port: 8000,
    host: "localhost",
    prepareRequestFunction: ({}) => {
      return {
        upstreamProxyUrl: `${process.env.PROXY_URI}`,
      };
    },
  });

  await new Promise((resolve) =>
    server.listen(() => {
      resolve(true);
    })
  );

  const browser = await puppeteer.launch({
    args: [`--proxy-server=localhost:8000`],
    headless: false,
  });

  const page = await browser.newPage();

  await page.goto("https://api.ipify.org?format=json");
  const ip = await page.evaluate(() => {
    // @ts-ignore DOM
    return JSON.parse(document.body.textContent).ip;
  });
  console.info("Current IP address:", { ip });

  return {
    [Symbol.asyncDispose]: async () => {
      await browser.close();
      await server.close(true);
    },
    browser,
    page,
  };
}
