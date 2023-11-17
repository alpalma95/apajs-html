let html = (strings, ...args) => {
  let content = strings.reduce(
    (acc, currentString, index) => acc + currentString + (args[index] ?? ''),
    ''
  );

  let parser = new DOMParser();
  let temp = parser.parseFromString(content, 'text/html');
  let nodes = [...temp.body.childNodes];
  return nodes.length === 1 ? nodes[0] : nodes;
};

let append = ($target, content) =>
  Array.isArray(content)
    ? content.forEach((node) => $target.appendChild(node))
    : $target.appendChild(content);

let app = document.querySelector('#app');

const test = () => {
  return html`
    <h1>Hello World</h1>
    <button @click="logEvent | $event" @mouseover="inc | $event, 4, false">Inc</button>
    <span ref="count">Count</span>
    <span ref="count">Count</span>
    <span ref="count">Count</span>
    <span ref="count">Count</span>
    <span ref="count">Count</span>
    <span ref="test">test</span>
    <test-test>
      <!--  Should not have any effect thanks to tree walker reject condition -->
      <p @mouseover="logEvent">Dummy web component</p>
    </test-test>
    `;
};

let count = 0;

// Ctx and handlers
const ctx = {
  step: 10,
  $refs: {},
};

const handlers = {
  inc(e, num, dec = false) {
    dec ? (count -= num) : (count += num);
    console.log(count, e);
  },
  logEvent(e) {
    console.log(e);
  },
};

// Event hydration
let getArgs = (str) => {
  let [handler, args] = str.split('|');

  return [
    handler.trim(),
    args?.split(',').map((arg) => {
      let trimmedArg = arg.trim();
      if (/^\'|^\"|^\`/.test(trimmedArg) || trimmedArg === '$event') {
        return trimmedArg === '$event' ? trimmedArg : trimmedArg.slice(1, -1);
      } else {
        try {
          return JSON.parse(trimmedArg);
        } catch (_) {
          return ctx[trimmedArg];
        }
      }
    }),
  ];
};

let attachEvents = (eventString, node) => {
  let [handlerName, args] = getArgs(node.getAttribute(eventString));
  if (!handlerName in handlers) return;
  let handler = handlers[handlerName];
  let eventType = eventString.slice(1);
  args
    ? node.addEventListener(eventType, (e) =>
        args.at(0) === '$event'
          ? handler(e, ...args.slice(1))
          : handler(...args)
      )
    : node.addEventListener(eventType, handler);
};

let storeRefs = (node) => {
  let refName = node.getAttribute('ref');
  // Global, replace with this.ctx in web component
  if (!refName) return;
  refName in ctx.$refs
    ? (ctx.$refs[refName] = [ctx.$refs[refName], node].flat(Infinity))
    : (ctx.$refs[refName] = node);
};

let hydrate = (root) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
    acceptNode(node) {
      return node
        .getAttributeNames()
        .some((n) => n.startsWith('@') || n === 'ref')
        ? NodeFilter.FILTER_ACCEPT
        : node.tagName.includes('-')
        ? NodeFilter.FILTER_REJECT
        : NodeFilter.FILTER_SKIP;
    },
  });

  let currentNode = walker.currentNode;
  while ((currentNode = walker.nextNode())) {
    currentNode
      .getAttributeNames()
      .filter((name) => name.startsWith('@') || name === 'ref')
      .forEach((eventString) => {
        attachEvents(eventString, currentNode);
        storeRefs(currentNode);
        console.log(ctx.$refs);
      });
  }
};

append(app, test());
console.time('timer');
hydrate(app);
console.timeEnd('timer');
