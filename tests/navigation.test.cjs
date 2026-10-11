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
class HTMLFormElement {
  constructor(fields, options = {}) {
    this.fields = fields;
    this.method = options.method ?? "post";
    this.action = options.action ?? "http://localhost:8080/account";
    this.target = "";
    this.enctype = "application/x-www-form-urlencoded";
    this.elements = [];
    this.submitted = false;
  }
  hasAttribute() {
    return false;
  }
  matches() {
    return false;
  }
  submit() {
    this.submitted = true;
  }
}
function submit(app, form) {
  const event = { target: form, submitter: null, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
  app.listeners.submit(event);
  return event;
}
function setup() {
  const events = [],
    requests = [],
    assigned = [],
    pushed = [],
    replaced = [],
    listeners = {};
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
        selector.includes("[data-flex-seo]") ? [...seo] : [],
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
    createElement: () => ({ setAttribute() {}, className: "", innerHTML: "" }),
    addEventListener: (type, listener) => {
      listeners[type] = listener;
    },
    dispatchEvent: (event) => events.push(event.type),
  };
  const history = {
    state: null,
    replaceState(value, _, url) {
      this.state = value;
      if (url) {
        location.href = url;
        replaced.push(url);
      }
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
            selector.includes("[data-flex-seo]") ? [{ tag: "seo:" + html }] : [],
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
    HTMLFormElement,
    FormData: class {
      constructor(form) {
        this.form = form;
      }
      entries() {
        return this.form.fields;
      }
    },
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
  const reply = (request, title, ok = true, url = request.url) =>
    request.resolve({ ok, url, text: async () => title });
  return { window, requests, reply, main, doc, events, assigned, pushed, replaced, listeners, seo };
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
  // Each click changes the address at once; the late answer for /about changes nothing.
  assert.deepEqual(app.pushed, ["http://localhost:8080/about", "http://localhost:8080/contact"]);
  assert.equal(app.doc.title, "Контакти");
});

test("HTTP failures load the server's page in full", async () => {
  const app = setup();
  app.window.FlexNavigation.navigate("/missing");
  app.reply(app.requests[0], "Не е намерено", false);
  await settle();
  assert.deepEqual(app.assigned, ["http://localhost:8080/missing"]);
  assert.deepEqual(
    app.seo.map((node) => node.tag),
    ["old"],
  );
});

test("the next page appears at once as a placeholder and loads in its place", async () => {
  const app = setup();
  app.window.FlexNavigation.navigate("/product/mug");
  // Before any answer: the address is the new one and the content is the placeholder.
  assert.deepEqual(app.pushed, ["http://localhost:8080/product/mug"]);
  assert.equal(app.main.childNodes[0].className, "flex-page-skeleton");
  assert.ok(app.events.includes("flex:page-skeleton"));
  assert.ok(app.events.indexOf("flex:page-before-change") < app.events.indexOf("flex:page-skeleton"));
  app.reply(app.requests[0], "Чаша");
  await settle();
  assert.deepEqual(app.main.childNodes, ["Чаша"]);
  assert.deepEqual(app.pushed, ["http://localhost:8080/product/mug"], "no second history entry");
});

test("forms are sent in the background and their answer replaces the content", async () => {
  const app = setup();
  const form = new HTMLFormElement([["_token", "t"], ["name", "Иван"]]);
  const event = submit(app, form);
  assert.equal(event.defaultPrevented, true);
  assert.equal(app.requests[0].options.method, "POST");
  assert.equal(app.requests[0].options.body, "_token=t&name=%D0%98%D0%B2%D0%B0%D0%BD");
  // The server redirects to the account page after saving.
  app.reply(app.requests[0], "Профил", true, "http://localhost:8080/account?saved=1");
  await settle();
  assert.deepEqual(app.main.childNodes, ["Профил"]);
  assert.deepEqual(app.pushed, ["http://localhost:8080/account?saved=1"]);
  assert.deepEqual(app.assigned, []);
});

test("a form answering with an error page shows it on the same address", async () => {
  const app = setup();
  app.window.FlexNavigation.navigate("/account/password");
  app.reply(app.requests[0], "Парола");
  await settle();
  submit(app, new HTMLFormElement([["password", "x"]], { action: "http://localhost:8080/account/password" }));
  app.reply(app.requests[1], "Паролата е твърде кратка", false);
  await settle();
  assert.deepEqual(app.main.childNodes, ["Паролата е твърде кратка"]);
  assert.deepEqual(app.pushed, ["http://localhost:8080/account/password"]);
  assert.deepEqual(app.replaced, ["http://localhost:8080/account/password"]);
});

test("forms of other sites and forms with files are submitted as usual", () => {
  const app = setup();
  assert.equal(submit(app, new HTMLFormElement([], { action: "https://example.com/pay" })).defaultPrevented, false);
  const upload = new HTMLFormElement([]);
  upload.enctype = "multipart/form-data";
  assert.equal(submit(app, upload).defaultPrevented, false);
  assert.equal(app.requests.length, 0);
});

test("search keeps empty fields out of the address", async () => {
  const app = setup();
  const form = new HTMLFormElement([["q", "чаша"], ["sort", ""]], { method: "get", action: "http://localhost:8080/catalog" });
  form.matches = () => true;
  submit(app, form);
  assert.equal(app.requests[0].url, "http://localhost:8080/catalog?q=%D1%87%D0%B0%D1%88%D0%B0");
  assert.equal(app.requests[0].options.method, "GET");
});

test("plugins can replace the current page, for example when an order link expires", async () => {
  const app = setup();
  app.window.FlexNavigation.navigate("/", { replace: true });
  app.reply(app.requests[0], "Начало");
  await settle();
  assert.deepEqual(app.pushed, []);
  assert.deepEqual(app.replaced, ["http://localhost:8080/"]);
});

test("a form that cannot be shown in place is submitted normally", async () => {
  const app = setup();
  const form = new HTMLFormElement([["a", "1"]]);
  submit(app, form);
  app.requests[0].resolve({ ok: true, url: "https://elsewhere.example/", text: async () => "x" });
  await settle();
  assert.equal(form.submitted, true);
  assert.deepEqual(app.assigned, []);
});