// Minimal C-style interpreter for golem scripts.
// Structural keywords (if/else/while) are real; callable "action" functions
// halt evaluation for the current tick once invoked (골렘 API 참고).

const KEYWORDS = new Set(["if", "else", "while", "true", "false"]);

export class LangError extends Error {
  constructor(message, line) {
    super(line ? `${line}번째 줄: ${message}` : message);
    this.line = line;
  }
}

function isIdentStart(ch) {
  return /[A-Za-z_가-힣]/.test(ch);
}
function isIdentPart(ch) {
  return /[A-Za-z0-9_가-힣]/.test(ch);
}
function isDigit(ch) {
  return ch >= "0" && ch <= "9";
}

export function tokenize(source) {
  const tokens = [];
  let i = 0;
  let line = 1;
  const n = source.length;
  while (i < n) {
    const ch = source[i];
    if (ch === "\n") {
      line += 1;
      i += 1;
      continue;
    }
    if (ch === " " || ch === "\t" || ch === "\r") {
      i += 1;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      while (i < n && source[i] !== "\n") i += 1;
      continue;
    }
    if (isDigit(ch)) {
      let j = i;
      while (j < n && (isDigit(source[j]) || source[j] === ".")) j += 1;
      tokens.push({ type: "NUMBER", value: parseFloat(source.slice(i, j)), line });
      i = j;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const quote = ch;
      let j = i + 1;
      let str = "";
      while (j < n && source[j] !== quote) {
        str += source[j];
        j += 1;
      }
      tokens.push({ type: "STRING", value: str, line });
      i = j + 1;
      continue;
    }
    if (isIdentStart(ch)) {
      let j = i;
      while (j < n && isIdentPart(source[j])) j += 1;
      const word = source.slice(i, j);
      if (KEYWORDS.has(word)) {
        tokens.push({ type: word.toUpperCase(), value: word, line });
      } else {
        tokens.push({ type: "IDENT", value: word, line });
      }
      i = j;
      continue;
    }
    const two = source.slice(i, i + 2);
    if (["==", "!=", "<=", ">=", "&&", "||"].includes(two)) {
      tokens.push({ type: two, value: two, line });
      i += 2;
      continue;
    }
    if ("+-*/%<>=!(){};,".includes(ch)) {
      tokens.push({ type: ch, value: ch, line });
      i += 1;
      continue;
    }
    throw new LangError(`알 수 없는 문자 '${ch}'`, line);
  }
  tokens.push({ type: "EOF", value: null, line });
  return tokens;
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }
  peek() {
    return this.tokens[this.pos];
  }
  next() {
    return this.tokens[this.pos++];
  }
  check(type) {
    return this.peek().type === type;
  }
  expect(type, what) {
    if (!this.check(type)) {
      const t = this.peek();
      throw new LangError(`${what || type}가 필요합니다 (실제: '${t.value ?? t.type}')`, t.line);
    }
    return this.next();
  }

  parseProgram() {
    const statements = [];
    while (!this.check("EOF")) statements.push(this.parseStatement());
    return { type: "Program", body: statements };
  }

  parseBlock() {
    this.expect("{", "'{'");
    const body = [];
    while (!this.check("}") && !this.check("EOF")) body.push(this.parseStatement());
    this.expect("}", "'}'");
    return { type: "Block", body };
  }

  parseStatement() {
    if (this.check("IF")) return this.parseIf();
    if (this.check("WHILE")) return this.parseWhile();
    if (this.check("{")) return this.parseBlock();
    const expr = this.parseAssignOrExpr();
    this.expect(";", "';'");
    return { type: "ExpressionStatement", expr };
  }

  parseIf() {
    const line = this.next().line; // IF
    this.expect("(", "'('");
    const test = this.parseExpr();
    this.expect(")", "')'");
    const consequent = this.parseBlock();
    let alternate = null;
    if (this.check("ELSE")) {
      this.next();
      alternate = this.check("IF") ? this.parseIf() : this.parseBlock();
    }
    return { type: "If", test, consequent, alternate, line };
  }

  parseWhile() {
    const line = this.next().line; // WHILE
    this.expect("(", "'('");
    const test = this.parseExpr();
    this.expect(")", "')'");
    const body = this.parseBlock();
    return { type: "While", test, body, line };
  }

  parseAssignOrExpr() {
    const start = this.pos;
    if (this.check("IDENT")) {
      const name = this.peek().value;
      const line = this.peek().line;
      if (this.tokens[this.pos + 1] && this.tokens[this.pos + 1].type === "=") {
        this.next();
        this.next();
        const value = this.parseExpr();
        return { type: "Assign", name, value, line };
      }
    }
    this.pos = start;
    return this.parseExpr();
  }

  parseExpr() {
    return this.parseOr();
  }
  parseOr() {
    let left = this.parseAnd();
    while (this.check("||")) {
      const line = this.next().line;
      left = { type: "Logical", op: "||", left, right: this.parseAnd(), line };
    }
    return left;
  }
  parseAnd() {
    let left = this.parseEquality();
    while (this.check("&&")) {
      const line = this.next().line;
      left = { type: "Logical", op: "&&", left, right: this.parseEquality(), line };
    }
    return left;
  }
  parseEquality() {
    let left = this.parseComparison();
    while (this.check("==") || this.check("!=")) {
      const op = this.next();
      left = { type: "Binary", op: op.type, left, right: this.parseComparison(), line: op.line };
    }
    return left;
  }
  parseComparison() {
    let left = this.parseAdditive();
    while (["<", ">", "<=", ">="].includes(this.peek().type)) {
      const op = this.next();
      left = { type: "Binary", op: op.type, left, right: this.parseAdditive(), line: op.line };
    }
    return left;
  }
  parseAdditive() {
    let left = this.parseMultiplicative();
    while (this.check("+") || this.check("-")) {
      const op = this.next();
      left = { type: "Binary", op: op.type, left, right: this.parseMultiplicative(), line: op.line };
    }
    return left;
  }
  parseMultiplicative() {
    let left = this.parseUnary();
    while (this.check("*") || this.check("/") || this.check("%")) {
      const op = this.next();
      left = { type: "Binary", op: op.type, left, right: this.parseUnary(), line: op.line };
    }
    return left;
  }
  parseUnary() {
    if (this.check("!") || this.check("-")) {
      const op = this.next();
      return { type: "Unary", op: op.type, argument: this.parseUnary(), line: op.line };
    }
    return this.parseCallOrPrimary();
  }
  parseCallOrPrimary() {
    let expr = this.parsePrimary();
    while (this.check("(")) {
      const line = this.next().line; // (
      const args = [];
      if (!this.check(")")) {
        args.push(this.parseExpr());
        while (this.check(",")) {
          this.next();
          args.push(this.parseExpr());
        }
      }
      this.expect(")", "')'");
      if (expr.type !== "Identifier") throw new LangError("함수처럼 호출할 수 없는 값입니다", line);
      expr = { type: "Call", name: expr.name, args, line };
    }
    return expr;
  }
  parsePrimary() {
    const t = this.peek();
    if (t.type === "NUMBER") {
      this.next();
      return { type: "Number", value: t.value, line: t.line };
    }
    if (t.type === "STRING") {
      this.next();
      return { type: "String", value: t.value, line: t.line };
    }
    if (t.type === "TRUE" || t.type === "FALSE") {
      this.next();
      return { type: "Boolean", value: t.type === "TRUE", line: t.line };
    }
    if (t.type === "IDENT") {
      this.next();
      return { type: "Identifier", name: t.value, line: t.line };
    }
    if (t.type === "(") {
      this.next();
      const e = this.parseExpr();
      this.expect(")", "')'");
      return e;
    }
    throw new LangError(`예상치 못한 토큰 '${t.value ?? t.type}'`, t.line);
  }
}

export function parseProgram(source) {
  const tokens = tokenize(source);
  const parser = new Parser(tokens);
  return parser.parseProgram();
}

// Thrown internally to unwind the stack once an "action" builtin runs.
class ActionTaken {
  constructor(name, result) {
    this.name = name;
    this.result = result;
  }
}

const MAX_STEPS = 20000;

// api: { actions: Set<string>, call(name, args, line) => value, vars: object (persisted between ticks) }
export function runTick(ast, api) {
  let steps = 0;
  function evalNode(node) {
    steps += 1;
    if (steps > MAX_STEPS) throw new LangError("코드가 너무 오래 실행되어 중단했습니다 (무한 루프 의심)");
    switch (node.type) {
      case "Number":
        return node.value;
      case "String":
        return node.value;
      case "Boolean":
        return node.value;
      case "Identifier": {
        if (Object.prototype.hasOwnProperty.call(api.vars, node.name)) return api.vars[node.name];
        if (api.readables && Object.prototype.hasOwnProperty.call(api.readables, node.name)) {
          return typeof api.readables[node.name] === "function" ? api.readables[node.name]() : api.readables[node.name];
        }
        throw new LangError(`정의되지 않은 변수 '${node.name}'`, node.line);
      }
      case "Assign": {
        const value = evalNode(node.value);
        api.vars[node.name] = value;
        return value;
      }
      case "Unary": {
        const v = evalNode(node.argument);
        if (node.op === "!") return !v;
        if (node.op === "-") return -v;
        throw new LangError(`알 수 없는 단항 연산자 '${node.op}'`, node.line);
      }
      case "Binary": {
        const l = evalNode(node.left);
        const r = evalNode(node.right);
        switch (node.op) {
          case "+": return l + r;
          case "-": return l - r;
          case "*": return l * r;
          case "/": return l / r;
          case "%": return l % r;
          case "<": return l < r;
          case ">": return l > r;
          case "<=": return l <= r;
          case ">=": return l >= r;
          case "==": return l === r;
          case "!=": return l !== r;
          default: throw new LangError(`알 수 없는 연산자 '${node.op}'`, node.line);
        }
      }
      case "Logical": {
        const l = evalNode(node.left);
        if (node.op === "&&") return l ? evalNode(node.right) : l;
        return l ? l : evalNode(node.right);
      }
      case "Call": {
        if (!api.functions.has(node.name)) {
          throw new LangError(`알 수 없는 함수 '${node.name}'`, node.line);
        }
        const args = node.args.map(evalNode);
        const result = api.call(node.name, args, node.line);
        if (api.actions.has(node.name)) {
          throw new ActionTaken(node.name, result);
        }
        return result;
      }
      case "Block": {
        for (const stmt of node.body) evalNode(stmt);
        return undefined;
      }
      case "If": {
        if (evalNode(node.test)) evalNode(node.consequent);
        else if (node.alternate) evalNode(node.alternate);
        return undefined;
      }
      case "While": {
        let guard = 0;
        while (evalNode(node.test)) {
          evalNode(node.body);
          guard += 1;
          if (guard > 5000) throw new LangError("while 반복이 너무 많이 실행되어 중단했습니다", node.line);
        }
        return undefined;
      }
      case "ExpressionStatement":
        return evalNode(node.expr);
      case "Program": {
        for (const stmt of node.body) evalNode(stmt);
        return undefined;
      }
      default:
        throw new LangError(`알 수 없는 노드 '${node.type}'`);
    }
  }

  try {
    evalNode(ast);
    return { status: "no_action" };
  } catch (e) {
    if (e instanceof ActionTaken) return { status: "action", name: e.name, result: e.result };
    throw e;
  }
}
