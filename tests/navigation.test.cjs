const test = require("node:test");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(
  path.join(__dirname, "../assets/navigation.js"),
  "utf8",
);
const settle = () => new Promise((resolve) => setImmediate(resolve));
function setup() {
  const events = [],
    requests = [],
    assigned = [],
    pushed = [];
  const location = {
    href: "http://localhost:8080/",
    origin: "http://localhost:8080",
    assign: (url) => assigned.push(url),
    reload() {},
  };
  Object.defineProperty(location, "pathname", { get: () => new URL(location.href).pathname });
  const heading = { textContent: "Начало", focus() {} };
  const main = {
    childNodes: ["Начало"],
    querySelectorAll: () => [],
    querySelector: () => heading,
    setAttribute() {},
    removeAttribute() {},
    replaceChildren(...nodes) {
      this.childNodes = nodes;
      heading.textContent = nodes[0];
    },
  };
  const seo = [];
  const seoNode = (tag) => ({
    tag,
    remove() {
      seo.splice(seo.indexOf(this), 1);
    },
  });
  seo.push(seoNode("old"));
  const doc = {
    title: "Начало",
    head: {
      append(node) {
        if (node.tag) seo.push(node);
      },
      querySelectorAll: (selector) =>
        selector === "[data-flex-seo]" ? [...seo] : [],
    },
    importNode: (node) => seoNode(node.tag),
    body: { append() {} },
    querySelector: (selector) =>
      selector === ".site-main-fullscreen" ? main : null,
    querySelectorAll: (selector) =>
      selector.includes("script")
        ? [
            {
              src: "http://localhost:8080/extensions/flex/commerce/assets/assets/storefront.js",
            },
          ]
        : [],
    createElement: () => ({ setAttribute() {} }),
    addEventListener() {},
    dispatchEvent: (event) => events.push(event.type),
  };
  const history = {
    state: null,
    replaceState(value) {
      this.state = value;
    },
    pushState(value, _, url) {
      this.state = value;
      location.href = url;
      pushed.push(url);
    },
  };
  const window = {
    scrollX: 0,
    scrollY: 0,
    addEventListener() {},
    scrollTo() {},
  };
  class Parser {
    parseFromString(html) {
      const next = { childNodes: [html], querySelectorAll: () => [] };
      return {
        title: html,
        head: {
          querySelectorAll: (selector) =>
            selector === "[data-flex-seo]" ? [{ tag: "seo:" + html }] : [],
        },
        querySelector: (selector) =>
          selector === ".site-main-fullscreen" ? next : null,
        querySelectorAll: (selector) =>
          selector === "script[src]"
            ? [
                {
                  type: "module",
                  getAttribute: () =>
                    "/extensions/flex/commerce/assets/assets/storefront.js?v=1",
                },
              ]
            : [],
      };
    }
  }
  vm.runInNewContext(source, {
    document: doc,
    window,
    location,
    history,
    URL,
    URLSearchParams,
    DOMParser: Parser,
    AbortController,
    CustomEvent: class {
      constructor(type, options) {
        this.type = type;
        this.detail = options?.detail;
      }
    },
    fetch: (url, options) =>
      new Promise((resolve) => requests.push({ url, options, resolve })),
    console: { warn() {} },
    navigator: {},
    setTimeout,
    clearTimeout,
  });
  const reply = (request, title, ok = true) =>
    request.resolve({ ok, url: request.url, text: async () => title });
  return { window, requests, reply, main, doc, events, assigned, pushed, seo };
}

test("public pages retain the document and reuse a module with a version query", async () => {
  const app = setup();
  app.window.FlexNavigation.navigate("/about");
  app.reply(app.requests[0], "За нас");
  await settle();
  assert.deepEqual(app.main.childNodes, ["За нас"]);
  assert.equal(app.doc.title, "За нас");
  assert.deepEqual(
    app.seo.map((node) => node.tag),
    ["seo:За нас"],
  );
  assert.deepEqual(app.assigned, []);
  assert.equal(app.pushed[0], "http://localhost:8080/about");
  assert.ok(app.events.includes("flex:page-before-change"));
  assert.ok(app.events.includes("flex:page-ready"));
});

test("a slow previous response cannot replace the latest navigation", async () => {
  const app = setup();
  app.window.FlexNavigation.navigate("/about");
  app.window.FlexNavigation.navigate("/contact");
  assert.equal(app.requests[0].options.signal.aborted, true);
  app.reply(app.requests[1], "Контакти");
  await settle();
  app.reply(app.requests[0], "За нас");
  await settle();
  assert.deepEqual(app.main.childNodes, ["Контакти"]);
  assert.deepEqual(app.pushed, ["http://localhost:8080/contact"]);
});

test("HTTP failures keep the current content and use normal navigation", async () => {
  const app = setup();
  app.window.FlexNavigation.navigate("/missing");
  app.reply(app.requests[0], "Не е намерено", false);
  await settle();
  assert.deepEqual(app.main.childNodes, ["Начало"]);
  assert.deepEqual(app.assigned, ["http://localhost:8080/missing"]);
  assert.deepEqual(
    app.seo.map((node) => node.tag),
    ["old"],
  );
  assert.deepEqual(app.pushed, []);
});
