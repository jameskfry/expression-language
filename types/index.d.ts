export = ExpressionLanguage;
export as namespace ExpressionLanguage;

declare class ExpressionLanguage {
  constructor(cache?: CacheAdapter | null, providers?: AbstractProvider[]);

  functions: Record<string, FunctionDefinition>;
  lexer: Lexer | null;
  parser: Parser | null;
  compiler: Compiler | null;

  /**
   * Compiles an expression source code.
   * @param expression The expression to compile
   * @param names An array of valid names
   * @returns The compiled javascript source code
   */
  compile(expression: Expression | string, names?: VariableName[]): string;

  /**
   * Evaluate an expression
   * @param expression The expression to compile
   * @param values An object of values
   * @returns The result of the evaluation of the expression
   */
  evaluate(
    expression: Expression | string,
    values?: Record<string, unknown>
  ): unknown;

  /**
   * Parses an expression
   * @param expression The expression to parse
   * @param names An array of valid names
   * @param flags Parser flags
   * @returns A ParsedExpression instance
   */
  parse(
    expression: Expression | string,
    names: VariableName[],
    flags?: number
  ): ParsedExpression;

  /**
   * Lint an expression for syntax errors
   * @param expression The expression to lint
   * @param names An array of valid names (pass null for deprecated behavior)
   * @param flags Parser flags
   */
  lint(
    expression: Expression | string,
    names?: VariableName[] | null,
    flags?: number
  ): void;

  /**
   * Registers a function
   * @param name The function name
   * @param compiler A function able to compile the function
   * @param evaluator A function able to evaluate the function
   */
  register(
    name: string,
    compiler: CompilerFunction,
    evaluator: EvaluatorFunction
  ): void;

  /**
   * Adds an ExpressionFunction
   * @param expressionFunction The function to add
   */
  addFunction(expressionFunction: ExpressionFunction): void;

  /**
   * Registers a provider
   * @param provider The provider to register
   */
  registerProvider(provider: AbstractProvider): void;

  getLexer(): Lexer;
  getParser(): Parser;
  getCompiler(): Compiler;
}

declare namespace ExpressionLanguage {
  export {
    ExpressionLanguage,
    Parser,
    IGNORE_UNKNOWN_VARIABLES,
    IGNORE_UNKNOWN_FUNCTIONS,
    OPERATOR_LEFT,
    OPERATOR_RIGHT,
    tokenize,
    ExpressionFunction,
    Compiler,
    ArrayAdapter,
    AbstractProvider,
    BasicProvider,
    StringProvider,
    ArrayProvider,
    DateProvider,
    // Additional exports
    Expression,
    ParsedExpression,
    Token,
    TokenStream,
    Node,
    SyntaxError,
    CacheItem,
    // Type exports
    VariableName,
    FunctionDefinition,
    CompilerFunction,
    EvaluatorFunction,
    CacheAdapter,
    Lexer,
  };
}

// Constants
declare const IGNORE_UNKNOWN_VARIABLES: number;
declare const IGNORE_UNKNOWN_FUNCTIONS: number;
declare const OPERATOR_LEFT: number;
declare const OPERATOR_RIGHT: number;

// Type aliases
type VariableName = string | Record<string, string>;
type CompilerFunction = (...args: string[]) => string;
type EvaluatorFunction = (
  values: Record<string, unknown>,
  ...args: unknown[]
) => unknown;

interface FunctionDefinition {
  compiler: CompilerFunction;
  evaluator: EvaluatorFunction;
}

interface Lexer {
  tokenize(expression: string): TokenStream;
}

interface CacheAdapter {
  getItem(key: string): CacheItem;
  save(item: CacheItem): boolean;
  get(
    key: string,
    callback: (item: CacheItem, save: boolean) => unknown,
    beta?: unknown,
    metadata?: unknown
  ): unknown;
  getItems(keys: string[]): Record<string, CacheItem>;
  hasItem(key: string): boolean;
  clear(): boolean;
  deleteItem(key: string): boolean;
  deleteItems(keys: string[]): boolean;
  commit(): boolean;
  saveDeferred(item: CacheItem): boolean;
}

// Lexer function
declare function tokenize(expression: string): TokenStream;

// Classes
declare class ExpressionFunction {
  constructor(
    name: string,
    compiler: CompilerFunction,
    evaluator: EvaluatorFunction
  );

  name: string;
  compiler: CompilerFunction;
  evaluator: EvaluatorFunction;

  getName(): string;
  getCompiler(): CompilerFunction;
  getEvaluator(): EvaluatorFunction;

  /**
   * Creates an ExpressionFunction from a JavaScript function name (string path).
   * @param javascriptFunctionName The JS function name or dotted path on globalThis
   * @param expressionFunctionName Optional expression function name
   */
  static fromJavascript(
    javascriptFunctionName: string,
    expressionFunctionName?: string | null
  ): ExpressionFunction;
}

declare class Parser {
  constructor(functions?: Record<string, FunctionDefinition>);

  functions: Record<string, FunctionDefinition>;
  tokenStream: TokenStream | null;
  names: VariableName[] | null;
  flags: number;

  unaryOperators: Record<string, { precedence: number }>;
  binaryOperators: Record<
    string,
    { precedence: number; associativity: number }
  >;

  /**
   * Parse a token stream into a node tree
   * @param tokenStream The token stream to parse
   * @param names An array of valid variable names
   * @param flags Parser flags
   */
  parse(tokenStream: TokenStream, names?: VariableName[], flags?: number): Node;

  /**
   * Lint a token stream for syntax errors
   * @param tokenStream The token stream to lint
   * @param names An array of valid variable names
   * @param flags Parser flags
   */
  lint(tokenStream: TokenStream, names?: VariableName[], flags?: number): void;
}

declare class Compiler {
  constructor(functions: Record<string, FunctionDefinition>);

  source: string;
  functions: Record<string, FunctionDefinition>;

  getFunction(name: string): FunctionDefinition;

  /**
   * Gets the current javascript code after compilation.
   */
  getSource(): string;

  reset(): this;

  /**
   * Compiles a node
   */
  compile(node: Node): this;

  subcompile(node: Node): string;

  /**
   * Adds a raw string to the compiled code.
   */
  raw(str: string): this;

  /**
   * Adds a quoted string to the compiled code.
   */
  string(value: string): this;

  /**
   * Returns a javascript representation of a given value.
   */
  repr(value: unknown, isIdentifier?: boolean): this;
}

declare class ArrayAdapter implements CacheAdapter {
  constructor(defaultLifetime?: number);

  defaultLifetime: number;
  values: Record<string, unknown>;
  expiries: Record<string, number>;

  createCacheItem(key: string, value: unknown, isHit: boolean): CacheItem;
  get(
    key: string,
    callback: (item: CacheItem, save: boolean) => unknown,
    beta?: unknown,
    metadata?: unknown
  ): unknown;
  getItem(key: string): CacheItem;
  getItems(keys: string[]): Record<string, CacheItem>;
  deleteItems(keys: string[]): boolean;
  save(item: CacheItem): boolean;
  saveDeferred(item: CacheItem): boolean;
  commit(): boolean;
  delete(key: string): boolean;
  getValues(): Record<string, unknown>;
  hasItem(key: string): boolean;
  clear(): boolean;
  deleteItem(key: string): boolean;
  reset(): void;
}

declare class CacheItem {
  static METADATA_EXPIRY_OFFSET: number;
  static RESERVED_CHARACTERS: string[];
  static validateKey(key: string): string;

  key: string | null;
  value: unknown;
  isHit: boolean;
  expiry: number | null;
  defaultLifetime: number | null;
  metadata: Record<string, unknown>;
  newMetadata: Record<string, unknown>;
  innerItem: unknown;
  poolHash: unknown;
  isTaggable: boolean;

  getKey(): string | null;
  get(): unknown;
  set(value: unknown): this;
  expiresAt(expiration: Date | null): this;
  expiresAfter(time: number | null): this;
  tag(tags: string | string[]): this;
  getMetadata(): Record<string, unknown>;
}

declare abstract class AbstractProvider {
  abstract getFunctions(): ExpressionFunction[];
}

declare class BasicProvider extends AbstractProvider {
  getFunctions(): ExpressionFunction[];
}

declare class StringProvider extends AbstractProvider {
  getFunctions(): ExpressionFunction[];
}

declare class ArrayProvider extends AbstractProvider {
  getFunctions(): ExpressionFunction[];
}

declare class DateProvider extends AbstractProvider {
  getFunctions(): ExpressionFunction[];
}

declare class Expression {
  constructor(expression: string);
  expression: string;
  toString(): string;
}

declare class ParsedExpression extends Expression {
  constructor(expression: string, nodes: Node);
  nodes: Node;
  getNodes(): Node;

  /**
   * Reconstructs a ParsedExpression from a JSON representation
   */
  static fromJSON(json: string | object): ParsedExpression;
}

declare class Token {
  static EOF_TYPE: "end of expression";
  static NAME_TYPE: "name";
  static NUMBER_TYPE: "number";
  static STRING_TYPE: "string";
  static OPERATOR_TYPE: "operator";
  static PUNCTUATION_TYPE: "punctuation";

  constructor(type: string, value: unknown, cursor: number);

  value: unknown;
  type: string;
  cursor: number;

  test(type: string, value?: unknown): boolean;
  toString(): string;
  isEqualTo(t: Token): boolean;
  diff(t: Token): string[];
}

declare class TokenStream {
  constructor(expression: string, tokens: Token[]);

  expression: string;
  position: number;
  tokens: Token[];

  readonly current: Token;
  readonly last: Token;

  toString(): string;
  next(): void;
  expect(type: string, value?: unknown, message?: string): void;
  isEOF(): boolean;
  isEqualTo(ts: TokenStream): boolean;
  diff(ts: TokenStream): Array<{ index: number; diff: string[] }>;
}

declare class Node {
  constructor(
    nodes?: Record<string, Node> | Node[],
    attributes?: Record<string, unknown>
  );

  name: string;
  nodes: Record<string, Node> | Node[];
  attributes: Record<string, unknown>;

  toString(): string;
  compile(compiler: Compiler): void;
  evaluate(
    functions: Record<string, FunctionDefinition>,
    values: Record<string, unknown>
  ): unknown;
  toArray(): unknown[];
  dump(): string;
  dumpString(value: string): string;
  isHash(value: object): boolean;
}

declare class SyntaxError extends Error {
  constructor(
    message: string,
    cursor: number,
    expression?: string,
    subject?: string,
    proposals?: string[]
  );

  name: "SyntaxError";
  cursor: number;
  expression?: string;
  subject?: string;
  proposals?: string[];

  toString(): string;
}
