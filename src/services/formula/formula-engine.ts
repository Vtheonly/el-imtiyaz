/**
 * Formula Engine — a safe, sandboxed expression evaluator for Excel-like formulas.
 *
 * Design goals:
 *   - Reproduce the formulas found in the Suivis clients.xlsx workbook.
 *   - Safe to evaluate on untrusted user input — no eval, no Function constructor.
 *   - Fully traceable: every evaluation produces an AST.
 */

import { logger } from "../../infrastructure/logger/logger";

export type AstNode =
  | { type: "num"; value: number }
  | { type: "str"; value: string }
  | { type: "bool"; value: boolean }
  | { type: "field"; path: string }
  | { type: "unary"; op: "+" | "-"; operand: AstNode }
  | { type: "binary"; op: BinaryOp; left: AstNode; right: AstNode }
  | { type: "call"; fn: string; args: AstNode[] };

export type BinaryOp =
  | "+"
  | "-"
  | "*"
  | "/"
  | "%"
  | "="
  | "<>"
  | "<"
  | ">"
  | "<="
  | ">="
  | "AND"
  | "OR";

type TokenType =
  | "num"
  | "str"
  | "bool"
  | "ident"
  | "op"
  | "lparen"
  | "rparen"
  | "comma"
  | "lbracket"
  | "rbracket"
  | "eof";

interface Token {
  type: TokenType;
  value: string;
  pos: number;
}

export class FormulaSyntaxError extends Error {
  constructor(
    message: string,
    public pos: number,
  ) {
    super(message);
    this.name = "FormulaSyntaxError";
  }
}

export class FormulaRuntimeError extends Error {
  constructor(
    message: string,
    public expression: string,
  ) {
    super(message);
    this.name = "FormulaRuntimeError";
  }
}

function tokenize(src: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  const n = src.length;

  const isDigit = (c: string) => c >= "0" && c <= "9";
  const isAlpha = (c: string) =>
    (c >= "a" && c <= "z") || (c >= "A" && c <= "Z") || c === "_";
  const isAlphaNum = (c: string) => isAlpha(c) || isDigit(c);

  while (i < n) {
    const c = src[i];

    if (/\s/.test(c)) {
      i++;
      continue;
    }

    if (isDigit(c) || (c === "." && isDigit(src[i + 1]))) {
      let j = i;
      while (j < n && (isDigit(src[j]) || src[j] === ".")) j++;
      if (j < n && (src[j] === "e" || src[j] === "E")) {
        j++;
        if (src[j] === "+" || src[j] === "-") j++;
        while (j < n && isDigit(src[j])) j++;
      }
      tokens.push({ type: "num", value: src.slice(i, j), pos: i });
      i = j;
      continue;
    }

    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let value = "";
      while (j < n && src[j] !== quote) {
        if (src[j] === "\\" && j + 1 < n) {
          value += src[j + 1];
          j += 2;
        } else {
          value += src[j];
          j++;
        }
      }
      if (j >= n)
        throw new FormulaSyntaxError(`Unterminated string starting at ${i}`, i);
      tokens.push({ type: "str", value, pos: i });
      i = j + 1;
      continue;
    }

    if (isAlpha(c)) {
      let j = i;
      while (j < n && isAlphaNum(src[j])) j++;
      const word = src.slice(i, j);
      const upper = word.toUpperCase();
      if (upper === "TRUE" || upper === "FALSE") {
        tokens.push({ type: "bool", value: upper, pos: i });
      } else {
        tokens.push({ type: "ident", value: word, pos: i });
      }
      i = j;
      continue;
    }

    if (c === "[") {
      tokens.push({ type: "lbracket", value: c, pos: i });
      i++;
      continue;
    }
    if (c === "]") {
      tokens.push({ type: "rbracket", value: c, pos: i });
      i++;
      continue;
    }
    if (c === "(") {
      tokens.push({ type: "lparen", value: c, pos: i });
      i++;
      continue;
    }
    if (c === ")") {
      tokens.push({ type: "rparen", value: c, pos: i });
      i++;
      continue;
    }
    if (c === ",") {
      tokens.push({ type: "comma", value: c, pos: i });
      i++;
      continue;
    }

    const two = src.slice(i, i + 2);
    if (two === "<>" || two === "<=" || two === ">=") {
      tokens.push({ type: "op", value: two, pos: i });
      i += 2;
      continue;
    }
    if ("+-*/%=<>.".includes(c)) {
      tokens.push({ type: "op", value: c, pos: i });
      i++;
      continue;
    }

    throw new FormulaSyntaxError(`Unexpected character '${c}' at ${i}`, i);
  }

  tokens.push({ type: "eof", value: "", pos: n });
  return tokens;
}

class Parser {
  private pos = 0;
  constructor(private readonly tokens: Token[]) {}

  private peek(): Token {
    return this.tokens[this.pos];
  }
  private next(): Token {
    return this.tokens[this.pos++];
  }

  private expect(type: TokenType, value?: string): Token {
    const t = this.peek();
    if (t.type !== type || (value !== undefined && t.value !== value)) {
      throw new FormulaSyntaxError(
        `Expected ${value ?? type} but got ${t.value || t.type} at ${t.pos}`,
        t.pos,
      );
    }
    return this.next();
  }

  parse(): AstNode {
    const node = this.parseOr();
    if (this.peek().type !== "eof") {
      throw new FormulaSyntaxError(
        `Unexpected token ${this.peek().value} at ${this.peek().pos}`,
        this.peek().pos,
      );
    }
    return node;
  }

  private parseOr(): AstNode {
    let left = this.parseAnd();
    while (
      this.peek().type === "ident" &&
      this.peek().value.toUpperCase() === "OR"
    ) {
      this.next();
      const right = this.parseAnd();
      left = { type: "binary", op: "OR", left, right };
    }
    return left;
  }

  private parseAnd(): AstNode {
    let left = this.parseNot();
    while (
      this.peek().type === "ident" &&
      this.peek().value.toUpperCase() === "AND"
    ) {
      this.next();
      const right = this.parseNot();
      left = { type: "binary", op: "AND", left, right };
    }
    return left;
  }

  private parseNot(): AstNode {
    if (
      this.peek().type === "ident" &&
      this.peek().value.toUpperCase() === "NOT"
    ) {
      this.next();
      const operand = this.parseNot();
      return {
        type: "unary",
        op: "-",
        operand: { type: "call", fn: "NOT", args: [operand] },
      };
    }
    return this.parseCmp();
  }

  private parseCmp(): AstNode {
    const left = this.parseAdd();
    const t = this.peek();
    if (
      t.type === "op" &&
      ["=", "<>", "<", ">", "<=", ">="].includes(t.value)
    ) {
      this.next();
      const right = this.parseAdd();
      return { type: "binary", op: t.value as BinaryOp, left, right };
    }
    return left;
  }

  private parseAdd(): AstNode {
    let left = this.parseMul();
    while (
      this.peek().type === "op" &&
      (this.peek().value === "+" || this.peek().value === "-")
    ) {
      const op = this.next().value as "+" | "-";
      const right = this.parseMul();
      left = { type: "binary", op, left, right };
    }
    return left;
  }

  private parseMul(): AstNode {
    let left = this.parseUnary();
    while (
      this.peek().type === "op" &&
      ["*", "/", "%"].includes(this.peek().value)
    ) {
      const op = this.next().value as BinaryOp;
      const right = this.parseUnary();
      left = { type: "binary", op, left, right };
    }
    return left;
  }

  private parseUnary(): AstNode {
    const t = this.peek();
    if (t.type === "op" && (t.value === "+" || t.value === "-")) {
      this.next();
      const operand = this.parseUnary();
      return { type: "unary", op: t.value as "+" | "-", operand };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): AstNode {
    const t = this.peek();

    if (t.type === "num") {
      this.next();
      return { type: "num", value: parseFloat(t.value) };
    }
    if (t.type === "str") {
      this.next();
      return { type: "str", value: t.value };
    }
    if (t.type === "bool") {
      this.next();
      return { type: "bool", value: t.value === "TRUE" };
    }
    if (t.type === "lparen") {
      this.next();
      const inner = this.parseOr();
      this.expect("rparen");
      return inner;
    }
    if (t.type === "lbracket") {
      this.next();
      const id = this.expect("ident").value;
      let path = id;
      while (this.peek().type === "op" && this.peek().value === ".") {
        this.next();
        path += "." + this.expect("ident").value;
      }
      while (this.peek().type === "lbracket") {
        this.next();
        const inner = this.expect("ident").value;
        this.expect("rbracket");
        path += "." + inner;
      }
      this.expect("rbracket");
      return { type: "field", path };
    }
    if (t.type === "ident") {
      this.next();
      const name = t.value;

      if (this.peek().type === "lparen") {
        this.next();
        const args: AstNode[] = [];
        if (this.peek().type !== "rparen") {
          args.push(this.parseOr());
          while (this.peek().type === "comma") {
            this.next();
            args.push(this.parseOr());
          }
        }
        this.expect("rparen");
        return { type: "call", fn: name.toUpperCase(), args };
      }

      let path = name;
      while (this.peek().type === "op" && this.peek().value === ".") {
        this.next();
        if (this.peek().type === "ident") {
          path += "." + this.next().value;
        } else if (this.peek().type === "lbracket") {
          this.next();
          path += "." + this.expect("ident").value;
          this.expect("rbracket");
        }
      }
      return { type: "field", path };
    }

    throw new FormulaSyntaxError(
      `Unexpected token ${t.value || t.type} at ${t.pos}`,
      t.pos,
    );
  }
}

export interface FormulaContext {
  fields: Record<string, unknown>;
  ranges?: Record<string, Array<Record<string, unknown>>>;
}

type FunctionImpl = (args: unknown[], ctx: FormulaContext) => unknown;

const FUNCTION_TABLE: Record<string, FunctionImpl> = {
  SUM: (args) => {
    let total = 0;
    for (const a of args) {
      if (Array.isArray(a)) {
        for (const x of a) total += Number(x) || 0;
      } else {
        total += Number(a) || 0;
      }
    }
    return total;
  },
  COUNT: (args) =>
    args.filter((a) => a !== null && a !== undefined && a !== "").length,
  AVG: (args) => {
    const nums = args.map(Number).filter((n) => !isNaN(n));
    return nums.length ? nums.reduce((s, n) => s + n, 0) / nums.length : 0;
  },
  AVERAGE: (args) => FUNCTION_TABLE.AVG(args, { fields: {} }),
  MIN: (args) => Math.min(...args.map(Number).filter((n) => !isNaN(n))),
  MAX: (args) => Math.max(...args.map(Number).filter((n) => !isNaN(n))),
  ABS: (args) => Math.abs(Number(args[0]) || 0),
  ROUND: (args) => {
    const v = Number(args[0]) || 0;
    const d = Number(args[1]) || 0;
    const m = Math.pow(10, d);
    return Math.round(v * m) / m;
  },
  FLOOR: (args) => Math.floor(Number(args[0]) || 0),
  CEIL: (args) => Math.ceil(Number(args[0]) || 0),
  INT: (args) => Math.floor(Number(args[0]) || 0),
  TRUNC: (args) => Math.trunc(Number(args[0]) || 0),

  IF: (args) => {
    const cond = toBool(args[0]);
    return cond ? args[1] : (args[2] ?? false);
  },
  IFS: (args) => {
    for (let i = 0; i < args.length; i += 2) {
      if (toBool(args[i])) return args[i + 1];
    }
    return null;
  },
  AND: (args) => args.every(toBool),
  OR: (args) => args.some(toBool),
  NOT: (args) => !toBool(args[0]),
  ISBLANK: (args) =>
    args[0] === null || args[0] === undefined || args[0] === "",
  ISNUMBER: (args) =>
    typeof args[0] === "number" || (!isNaN(Number(args[0])) && args[0] !== ""),
  ISEMPTY: (args) =>
    args[0] === null || args[0] === undefined || args[0] === "",

  IFERROR: (args) => {
    const v = args[0];
    if (v === null || v === undefined || v === "#ERROR" || v === "#REF!") {
      return args[1];
    }
    return v;
  },
  ISERROR: (args) =>
    args[0] === "#ERROR" || args[0] === "#REF!" || args[0] === null,

  TEXT: (args) => String(args[0] ?? ""),
  CONCAT: (args) => args.map((a) => String(a ?? "")).join(""),
  CONCATENATE: (args) => FUNCTION_TABLE.CONCAT(args, { fields: {} }),
  LEN: (args) => String(args[0] ?? "").length,
  LEFT: (args) => String(args[0] ?? "").slice(0, Number(args[1]) || 0),
  RIGHT: (args) => {
    const s = String(args[0] ?? "");
    const n = Number(args[1]) || 0;
    return s.slice(s.length - n);
  },
  MID: (args) => {
    const s = String(args[0] ?? "");
    const start = (Number(args[1]) || 1) - 1;
    const len = Number(args[2]) || 0;
    return s.slice(start, start + len);
  },
  UPPER: (args) => String(args[0] ?? "").toUpperCase(),
  LOWER: (args) => String(args[0] ?? "").toLowerCase(),
  TRIM: (args) => String(args[0] ?? "").trim(),

  TODAY: () => new Date().toISOString().slice(0, 10),
  NOW: () => new Date().toISOString(),
  YEAR: (args) => new Date(String(args[0])).getFullYear(),
  MONTH: (args) => new Date(String(args[0])).getMonth() + 1,
  DAY: (args) => new Date(String(args[0])).getDate(),
  DATE: (args) => {
    const y = Number(args[0]);
    const m = Number(args[1]);
    const d = Number(args[2]);
    return new Date(y, m - 1, d).toISOString().slice(0, 10);
  },

  VLOOKUP: (args, ctx) => {
    const lookup = args[0];
    const rangeName = String(args[1]);
    const colIndex = Number(args[2]) - 1;
    const exactMatch = args[3] === 0 || args[3] === false;
    const range = ctx.ranges?.[rangeName] ?? [];
    for (const row of range) {
      const keys = Object.keys(row);
      if (keys.length === 0) continue;
      if (
        row[keys[0]] === lookup ||
        (!exactMatch && String(row[keys[0]]) === String(lookup))
      ) {
        return row[keys[colIndex]];
      }
    }
    return "#N/A";
  },
  INDEX: (args, ctx) => {
    const rangeName = String(args[0]);
    const rowIdx = Number(args[1]) - 1;
    const colIdx = args[2] !== undefined ? Number(args[2]) - 1 : 0;
    const range = ctx.ranges?.[rangeName] ?? [];
    const row = range[rowIdx];
    if (!row) return "#REF!";
    const keys = Object.keys(row);
    return row[keys[colIdx]];
  },
  MATCH: (args, ctx) => {
    const lookup = args[0];
    const rangeName = String(args[1]);
    const range = ctx.ranges?.[rangeName] ?? [];
    for (let i = 0; i < range.length; i++) {
      const keys = Object.keys(range[i]);
      if (
        range[i][keys[0]] === lookup ||
        String(range[i][keys[0]]) === String(lookup)
      ) {
        return i + 1;
      }
    }
    return "#N/A";
  },
};

function toBool(v: unknown): boolean {
  if (typeof v === "boolean") return v;
  if (typeof v === "number") return v !== 0;
  if (typeof v === "string") {
    if (v.toUpperCase() === "TRUE") return true;
    if (v.toUpperCase() === "FALSE") return false;
    return v.length > 0;
  }
  return v !== null && v !== undefined;
}

function toNum(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  const n = Number(v);
  return isNaN(n) ? 0 : n;
}

function resolveField(path: string, ctx: FormulaContext): unknown {
  const parts = path.split(".");
  let current: unknown = ctx.fields;
  for (const p of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    if (Array.isArray(current)) {
      return current.map((item) => {
        if (item && typeof item === "object") {
          return (item as Record<string, unknown>)[p];
        }
        return undefined;
      });
    }
    current = (current as Record<string, unknown>)[p];
  }
  return current;
}

function evaluateAst(node: AstNode, ctx: FormulaContext): unknown {
  switch (node.type) {
    case "num":
      return node.value;
    case "str":
      return node.value;
    case "bool":
      return node.value;
    case "field":
      return resolveField(node.path, ctx);
    case "unary": {
      const v = evaluateAst(node.operand, ctx);
      const n = toNum(v);
      return node.op === "-" ? -n : n;
    }
    case "binary": {
      if (node.op === "AND") {
        return (
          toBool(evaluateAst(node.left, ctx)) &&
          toBool(evaluateAst(node.right, ctx))
        );
      }
      if (node.op === "OR") {
        return (
          toBool(evaluateAst(node.left, ctx)) ||
          toBool(evaluateAst(node.right, ctx))
        );
      }
      const l = evaluateAst(node.left, ctx);
      const r = evaluateAst(node.right, ctx);
      switch (node.op) {
        case "+":
          return toNum(l) + toNum(r);
        case "-":
          return toNum(l) - toNum(r);
        case "*":
          return toNum(l) * toNum(r);
        case "/": {
          const rn = toNum(r);
          if (rn === 0) throw new FormulaRuntimeError("Division by zero", "");
          return toNum(l) / rn;
        }
        case "%": {
          const rn = toNum(r);
          if (rn === 0) throw new FormulaRuntimeError("Modulo by zero", "");
          return toNum(l) % rn;
        }
        case "=":
          return (
            l === r ||
            (typeof l === "number" || typeof r === "number"
              ? toNum(l) === toNum(r)
              : false)
          );
        case "<>":
          return (
            l !== r &&
            (typeof l === "number" || typeof r === "number"
              ? toNum(l) !== toNum(r)
              : true)
          );
        case "<":
          return toNum(l) < toNum(r);
        case ">":
          return toNum(l) > toNum(r);
        case "<=":
          return toNum(l) <= toNum(r);
        case ">=":
          return toNum(l) >= toNum(r);
      }
      throw new FormulaRuntimeError(`Unknown operator: ${node.op}`, "");
    }
    case "call": {
      const fn = FUNCTION_TABLE[node.fn];
      if (!fn) {
        throw new FormulaRuntimeError(`Unknown function: ${node.fn}`, "");
      }
      const args = node.args.map((a) => evaluateAst(a, ctx));
      return fn(args, ctx);
    }
  }
}

export interface FormulaEvaluationResult {
  value: unknown;
  ast: AstNode;
  durationMs: number;
}

export function evaluate(
  expression: string,
  ctx: FormulaContext,
): FormulaEvaluationResult {
  const start = Date.now();
  const trimmed = expression.trim();
  const src = trimmed.startsWith("=") ? trimmed.slice(1) : trimmed;

  const tokens = tokenize(src);
  const parser = new Parser(tokens);
  const ast = parser.parse();
  const value = evaluateAst(ast, ctx);

  return { value, ast, durationMs: Date.now() - start };
}

export function safeEvaluate(
  expression: string,
  ctx: FormulaContext,
  logPrefix = "formula",
):
  | { ok: true; value: unknown; ast?: AstNode; durationMs: number }
  | { ok: false; error: string } {
  try {
    const result = evaluate(expression, ctx);
    if (result.durationMs > 50) {
      logger.warn(`${logPrefix}.slow`, {
        expression,
        durationMs: result.durationMs,
      });
    }
    return {
      ok: true,
      value: result.value,
      ast: result.ast,
      durationMs: result.durationMs,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn(`${logPrefix}.error`, { expression, error: msg });
    return { ok: false, error: msg };
  }
}

export function validate(
  expression: string,
): { ok: true } | { ok: false; error: string; pos?: number } {
  try {
    const trimmed = expression.trim();
    const src = trimmed.startsWith("=") ? trimmed.slice(1) : trimmed;
    const tokens = tokenize(src);
    const parser = new Parser(tokens);
    parser.parse();
    return { ok: true };
  } catch (err) {
    if (err instanceof FormulaSyntaxError) {
      return { ok: false, error: err.message, pos: err.pos };
    }
    return { ok: false, error: String(err) };
  }
}

export function astToString(node: AstNode): string {
  switch (node.type) {
    case "num":
      return String(node.value);
    case "str":
      return `"${node.value}"`;
    case "bool":
      return String(node.value).toUpperCase();
    case "field":
      return node.path;
    case "unary":
      return `${node.op}${astToString(node.operand)}`;
    case "binary":
      return `(${astToString(node.left)} ${node.op} ${astToString(node.right)})`;
    case "call":
      return `${node.fn}(${node.args.map(astToString).join(", ")})`;
  }
}

export function extractFieldRefs(node: AstNode): string[] {
  const refs: string[] = [];
  function walk(n: AstNode) {
    switch (n.type) {
      case "field":
        refs.push(n.path);
        break;
      case "unary":
        walk(n.operand);
        break;
      case "binary":
        walk(n.left);
        walk(n.right);
        break;
      case "call":
        n.args.forEach(walk);
        break;
    }
  }
  walk(node);
  return [...new Set(refs)];
}
