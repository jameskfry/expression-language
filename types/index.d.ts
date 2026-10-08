export = ExpressionLanguage;
export as namespace ExpressionLanguage;

declare class ExpressionLanguage {
  /**
   * @param cache The cache used to store parsed expressions
   * @param providers Providers of extra expression functions (any iterable)
   * @param options Behaviour switches, see {@link ExpressionLanguageOptions}
   */
  constructor(
    cache?: CacheAdapter | null,
    providers?: Iterable<AbstractProvider>,
    options?: ExpressionLanguageOptions
  );

  functions: Record<string, FunctionDefinition>;
  /** The parser flags every parse() / lint() adds (set by the constructor options). */
  defaultFlags: number;
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
    names?: VariableName[],
    flags?: number
  ): ParsedExpression;

  /**
   * Lint an expression for syntax errors
   * @param expression The expression to lint
   * @param names An array of valid names (passing null is deprecated, use IGNORE_UNKNOWN_VARIABLES)
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
   * @param phpCompiler A function able to compile the function to PHP (only used by dumps targeting PHP)
   */
  register(
    name: string,
    compiler: CompilerFunction,
    evaluator: EvaluatorFunction,
    phpCompiler?: CompilerFunction | null
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
    CASE_INSENSITIVE_STRING_OPERATORS,
    SEMANTICS_JS,
    SEMANTICS_PORTABLE,
    OPERATOR_LEFT,
    OPERATOR_RIGHT,
    tokenize,
    ExpressionFunction,
    Compiler,
    PhpCompiler,
    CompiledExpressionLanguage,
    ArrayAdapter,
    AbstractProvider,
    BasicProvider,
    StringProvider,
    ArrayProvider,
    DateProvider,
    ConstantFunctionProvider,
    defaultCustomFunctions,
    // Additional exports
    Expression,
    ParsedExpression,
    Token,
    TokenStream,
    Node,
    SyntaxError,
    LogicException,
    DivisionByZeroError,
    PortabilityError,
    CacheItem,
    CompileRuntime,
    // Type exports
    VariableName,
    FunctionDefinition,
    CompilerFunction,
    EvaluatorFunction,
    CacheAdapter,
    Lexer,
    ExpressionLanguageOptions,
    Semantics,
    SemanticsOperators,
    DumpCompiledOptions,
    CompiledExpressions,
  };
}

// Constants
declare const IGNORE_UNKNOWN_VARIABLES: number;
declare const IGNORE_UNKNOWN_FUNCTIONS: number;
/**
 * Parser flag: makes `contains`, `starts with` and `ends with` ignore case.
 * They are case-sensitive by default, like Symfony's.
 */
declare const CASE_INSENSITIVE_STRING_OPERATORS: number;
/**
 * Parser flag: operators follow JavaScript's rules (`+` concatenates a string, `==` coerces its own way, `"0"` is truthy...)
 * instead of Symfony's. Excludes SEMANTICS_PORTABLE.
 */
declare const SEMANTICS_JS: number;
/**
 * Parser flag: operators follow both sets of rules, and an operation that would not give the same result with both throws
 * a PortabilityError. Excludes SEMANTICS_JS.
 */
declare const SEMANTICS_PORTABLE: number;
declare const OPERATOR_LEFT: number;
declare const OPERATOR_RIGHT: number;

// Type aliases
/**
 * The rules operators follow where PHP and JavaScript differ (`+`, `==`, `<`, truthiness, bitwise operators, ...):
 * - "symfony" (the default): PHP's, so that an expression gives the same result here and in Symfony
 * - "js": JavaScript's
 * - "portable": both; an operation that would not give the same result with both is a PortabilityError
 */
type Semantics = "symfony" | "js" | "portable";

interface ExpressionLanguageOptions {
  /** The rules operators follow (default: "symfony"). Equivalent to always parsing with SEMANTICS_JS or SEMANTICS_PORTABLE. */
  semantics?: Semantics;

  /**
   * Make `contains`, `starts with` and `ends with` ignore case (default: false).
   * Equivalent to always parsing with the CASE_INSENSITIVE_STRING_OPERATORS flag.
   */
  caseInsensitiveStringOperators?: boolean;
}

type VariableName = string | Record<string, string>;
type CompilerFunction = (...args: string[]) => string;
type EvaluatorFunction = (
  values: Record<string, unknown>,
  ...args: unknown[]
) => unknown;

interface FunctionDefinition {
  compiler: CompilerFunction;
  evaluator: EvaluatorFunction;
  /** Present when the function declared how to compile itself to PHP. */
  phpCompiler?: CompilerFunction;
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
  /**
   * @param phpCompiler Optional: the same as `compiler`, for PHP source. Only used when dumping PHP with
   *                    CompiledExpressionLanguage. A function without one is called through its evaluator, which
   *                    therefore has to be registered under the same name on the PHP side.
   */
  constructor(
    name: string,
    compiler: CompilerFunction,
    evaluator: EvaluatorFunction,
    phpCompiler?: CompilerFunction | null
  );

  name: string;
  compiler: CompilerFunction;
  evaluator: EvaluatorFunction;
  phpCompiler: CompilerFunction | null;

  getName(): string;
  getCompiler(): CompilerFunction;
  getEvaluator(): EvaluatorFunction;
  getPhpCompiler(): CompilerFunction | null;

  /**
   * Declares that this function is a plain PHP function, so PHP dumps call it directly.
   * @param phpFunctionName The PHP function to call (default: the name of this expression function)
   */
  withPhpFunction(phpFunctionName?: string): this;

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

  /**
   * The variables read by the last parsed expression. Each name maps to the position where the expression
   * first reads it without "??", or to null when "??" guards every read.
   */
  getVariables(): Record<string, number | null>;
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

/**
 * Compiles a node tree to PHP, the way Symfony's own nodes compile themselves.
 * Used by CompiledExpressionLanguage#dumpCompiled() with the "php" target.
 */
declare class PhpCompiler extends Compiler {
  constructor(
    functions: Record<string, FunctionDefinition>,
    options?: { valuesVariable?: string; functionsVariable?: string }
  );

  valuesVariable: string;
  functionsVariable: string;
  /** Whether the compiled code calls functions through their evaluator (and so needs the functions array). */
  usesFunctions: boolean;
}

interface DumpCompiledOptions {
  /** The language of the generated code (default: "js"). */
  target?: "js" | "php";
  /**
   * How a JavaScript dump is packaged (default: "esm"): an ES module (`export default`), a CommonJS module
   * (`module.exports`), or a bare object expression for CompiledExpressionLanguage.load(). Ignored for PHP.
   */
  format?: "esm" | "cjs" | "expression";
}

/** What a JavaScript dump holds once loaded: hand it to the CompiledExpressionLanguage constructor. */
interface CompiledExpressions {
  format: number;
  flags: number;
  expressions: Array<
    [
      expression: string,
      evaluate: (
        values: Record<string, unknown>,
        functions: Record<string, FunctionDefinition>,
        runtime: typeof CompileRuntime
      ) => unknown,
      variables: Array<[name: string, firstReadAt: number | null]>
    ]
  >;
}

/**
 * Decorates an ExpressionLanguage to evaluate and lint the expressions it compiled ahead of time, without parsing them.
 *
 * dumpCompiled() turns a list of expressions into a source file (JavaScript by default, or PHP in the format
 * Symfony's own CompiledExpressionLanguage loads). Giving the loaded file back to the constructor makes evaluate()
 * run the generated code. An expression that is not in the file, or whose variables are not all provided, is handled
 * by the decorated ExpressionLanguage as usual.
 */
declare class CompiledExpressionLanguage {
  /**
   * @param expressionLanguage The language every call delegates to (or falls back to)
   * @param compiled What dumpCompiled() produced, once loaded (the module's default export), or the source of a
   *                 dump made with `format: "expression"`
   * @throws LogicException when the dump was made with other parser flags than this language uses
   */
  constructor(
    expressionLanguage: ExpressionLanguage,
    compiled?: CompiledExpressions | string | null
  );

  expressionLanguage: ExpressionLanguage;

  /**
   * Evaluates the source of a dump made with `format: "expression"`.
   * This runs the code of the dump, so only ever load a dump you produced yourself.
   */
  static load(source: string): CompiledExpressions;

  readonly functions: Record<string, FunctionDefinition>;

  compile(expression: Expression | string, names?: VariableName[]): string;
  parse(
    expression: Expression | string,
    names?: VariableName[],
    flags?: number
  ): ParsedExpression;
  evaluate(
    expression: Expression | string,
    values?: Record<string, unknown>
  ): unknown;
  lint(
    expression: Expression | string,
    names?: VariableName[],
    flags?: number
  ): void;
  register(
    name: string,
    compiler: CompilerFunction,
    evaluator: EvaluatorFunction,
    phpCompiler?: CompilerFunction | null
  ): void;
  addFunction(expressionFunction: ExpressionFunction): void;
  registerProvider(provider: AbstractProvider): void;

  /**
   * Compiles expressions to the source of a file that the constructor can load.
   * The expressions that cannot be compiled (a syntax error, an unknown function...) are left out.
   */
  dumpCompiled(
    expressions: Iterable<Expression | string>,
    options?: DumpCompiledOptions
  ): string;
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

/**
 * Provides the constant() and enum() functions, restricted to a list of allowed constants.
 *
 * Each entry is a dotted path such as "Math.PI" or "Roles.ADMIN" in which "*" matches any sequence of
 * characters within one path segment (never across a "."). PHP style separators ("\\" and "::") are accepted
 * in both the entries and the names. Only own properties are followed.
 */
declare class ConstantFunctionProvider extends AbstractProvider {
  /**
   * @param allowedConstants The constants (or patterns) expressions may read
   * @param root The object constants are resolved against (default: the global object).
   *             A provider with a custom root cannot be used with compile().
   */
  constructor(allowedConstants: string[], root?: object | null);

  getFunctions(): ExpressionFunction[];
}

interface DefaultCustomFunctions {
  isString(value: unknown): boolean;
  strLen(value: unknown): number;
  isEmail(value: unknown): boolean;
  isPhone(value: unknown): boolean;
  isNull(value: unknown): boolean;
  isCurrency(value: unknown): boolean;
  now(): import('dayjs').Dayjs;
  dateFormat(value: import('dayjs').Dayjs, format: string): string;
  year(value: import('dayjs').Dayjs): string;
  date(value: import('dayjs').Dayjs): string;
  string(value: unknown): string;
  int(value: unknown): number;
}

declare const defaultCustomFunctions: DefaultCustomFunctions;

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

// Runtime helpers required in scope (as `__runtime`) when executing compile()
// output for expressions that use StringProvider/ArrayProvider/DateProvider
// functions. See CompileRuntime.js for details.
/** The operators of a set of rules, which compiled code calls as `__runtime.symfony.add(a, b)`. */
interface SemanticsOperators {
  add(left: unknown, right: unknown): unknown;
  sub(left: unknown, right: unknown): unknown;
  mul(left: unknown, right: unknown): unknown;
  div(left: unknown, right: unknown): unknown;
  mod(left: unknown, right: unknown): unknown;
  pow(left: unknown, right: unknown): unknown;
  neg(value: unknown): unknown;
  plus(value: unknown): unknown;
  bitAnd(left: unknown, right: unknown): unknown;
  bitOr(left: unknown, right: unknown): unknown;
  bitXor(left: unknown, right: unknown): unknown;
  shl(left: unknown, right: unknown): unknown;
  shr(left: unknown, right: unknown): unknown;
  bitNot(value: unknown): unknown;
  eq(left: unknown, right: unknown): boolean;
  ne(left: unknown, right: unknown): boolean;
  identical(left: unknown, right: unknown): boolean;
  notIdentical(left: unknown, right: unknown): boolean;
  lt(left: unknown, right: unknown): boolean;
  gt(left: unknown, right: unknown): boolean;
  le(left: unknown, right: unknown): boolean;
  ge(left: unknown, right: unknown): boolean;
  truthy(value: unknown): boolean;
  str(value: unknown): string;
  /** The subject of `matches`: like str(), but an array is a TypeError. */
  matchSubject(value: unknown): string;
  concat(left: unknown, right: unknown): string;
  contains(left: unknown, right: unknown, ignoreCase?: boolean): boolean;
  startsWith(left: unknown, right: unknown, ignoreCase?: boolean): boolean;
  endsWith(left: unknown, right: unknown, ignoreCase?: boolean): boolean;
  inArray(needle: unknown, haystack: unknown): boolean;
  notInArray(needle: unknown, haystack: unknown): boolean;
  range(start: unknown, end: unknown): unknown[];
}

declare const CompileRuntime: {
  /** The operators of the "symfony" semantics (the default): compile() calls them. */
  symfony: SemanticsOperators;
  /** The operators of the "portable" semantics. */
  portable: SemanticsOperators;
  /** The operators of the "js" semantics (compiled code of these needs nothing, they are listed for completeness). */
  js: SemanticsOperators;
  strtolower(str: string): string;
  strtoupper(str: string): string;
  explode(delimiter: string, str: string, limit?: number | null): string[];
  strlen(str: string): number;
  strstr(haystack: string, needle: string, before_needle?: boolean): string | false;
  stristr(haystack: string, needle: string, before_needle?: boolean): string | false;
  substr(str: string, start: number, length?: number): string;
  implode(glue: string, pieces: unknown[]): string;
  count(mixedVar: unknown, mode?: number): number;
  array_intersect(...arrays: unknown[][]): unknown[];
  date(format: string, timestamp?: number): string;
  strtotime(str: string, now?: number): number | false;
};

/**
 * `message` holds the whole description, e.g.
 * 'Variable "nam" is not valid around position 1 for expression `nam`. Did you mean "name"?'
 */
declare class SyntaxError extends Error {
  constructor(
    message: string,
    cursor?: number,
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

declare class LogicException extends Error {
  constructor(message?: string);
  name: "LogicException";
}

/**
 * Raised by the "portable" semantics when an operation would not give the same result in PHP (Symfony) and in JavaScript.
 */
declare class PortabilityError extends Error {
  constructor(
    operator: string,
    operands: unknown[],
    symfony: { value?: unknown; error?: Error },
    javascript: { value?: unknown; error?: Error }
  );

  name: "PortabilityError";
  operator: string;
  operands: unknown[];
  /** What Symfony's rules give. */
  symfony: { value?: unknown; error?: Error };
  /** What JavaScript's rules give. */
  javascript: { value?: unknown; error?: Error };
}

/**
 * Thrown by `/` and `%` when the right operand is zero.
 */
declare class DivisionByZeroError extends Error {
  constructor(message?: string);
  name: "DivisionByZeroError";
}
