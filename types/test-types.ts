import ExpressionLanguage from "./index";

// ============================================================================
// ExpressionLanguage Main Class Tests
// ============================================================================

// Constructor tests
const el1 = new ExpressionLanguage();
const el2 = new ExpressionLanguage(null);
const el3 = new ExpressionLanguage(new ExpressionLanguage.ArrayAdapter());
const el4 = new ExpressionLanguage(null, [
  new ExpressionLanguage.BasicProvider(),
]);

// Property tests
el1.functions satisfies Record<string, ExpressionLanguage.FunctionDefinition>;
el1.lexer satisfies ExpressionLanguage.Lexer | null;
el1.parser satisfies ExpressionLanguage.Parser | null;
el1.compiler satisfies ExpressionLanguage.Compiler | null;

// Method tests - compile
const compiled1: string = el1.compile("1 + 1");
const compiled2: string = el1.compile("x + y", ["x", "y"]);
const compiled3: string = el1.compile(
  new ExpressionLanguage.Expression("1 + 1")
);

// Method tests - evaluate
const result1: unknown = el1.evaluate("1 + 1");
const result2: unknown = el1.evaluate("x + y", { x: 1, y: 2 });
const result3: unknown = el1.evaluate(
  new ExpressionLanguage.Expression("1 + 1")
);

// Method tests - parse
const parsed1: ExpressionLanguage.ParsedExpression = el1.parse("1 + 1", []);
const parsed2: ExpressionLanguage.ParsedExpression = el1.parse("x + y", [
  "x",
  "y",
]);
const parsed3: ExpressionLanguage.ParsedExpression = el1.parse(
  "x + y",
  ["x", "y"],
  0
);

// Method tests - lint
el1.lint("1 + 1");
el1.lint("x + y", ["x", "y"]);
el1.lint("x + y", null);
el1.lint("x + y", ["x", "y"], 0);

// Method tests - register
el1.register(
  "myFunc",
  (...args: string[]) => `myFunc(${args.join(",")})`,
  (values: Record<string, unknown>, ...args: unknown[]) => args[0]
);

// Method tests - addFunction
const expressionFunc = new ExpressionLanguage.ExpressionFunction(
  "test",
  () => "test",
  () => "test"
);
el1.addFunction(expressionFunc);

// Method tests - registerProvider
el1.registerProvider(new ExpressionLanguage.BasicProvider());

// Method tests - getters
const lexer: ExpressionLanguage.Lexer = el1.getLexer();
const parser: ExpressionLanguage.Parser = el1.getParser();
const compiler: ExpressionLanguage.Compiler = el1.getCompiler();

// ============================================================================
// ExpressionFunction Tests
// ============================================================================

const compilerFn: ExpressionLanguage.CompilerFunction = (...args: string[]) =>
  `func(${args.join(",")})`;
const evaluatorFn: ExpressionLanguage.EvaluatorFunction = (
  values: Record<string, unknown>,
  ...args: unknown[]
) => args[0];

const exprFunc1 = new ExpressionLanguage.ExpressionFunction(
  "myFunc",
  compilerFn,
  evaluatorFn
);

exprFunc1.name satisfies string;
exprFunc1.compiler satisfies ExpressionLanguage.CompilerFunction;
exprFunc1.evaluator satisfies ExpressionLanguage.EvaluatorFunction;

const name: string = exprFunc1.getName();
const comp: ExpressionLanguage.CompilerFunction = exprFunc1.getCompiler();
const evalFn: ExpressionLanguage.EvaluatorFunction = exprFunc1.getEvaluator();

// Static method test
const fromJs1: ExpressionLanguage.ExpressionFunction =
  ExpressionLanguage.ExpressionFunction.fromJavascript("Math.abs");
const fromJs2: ExpressionLanguage.ExpressionFunction =
  ExpressionLanguage.ExpressionFunction.fromJavascript("Math.abs", "abs");
const fromJs3: ExpressionLanguage.ExpressionFunction =
  ExpressionLanguage.ExpressionFunction.fromJavascript("Math.abs", null);

// ============================================================================
// Parser Tests
// ============================================================================

const parser1 = new ExpressionLanguage.Parser();
const parser2 = new ExpressionLanguage.Parser({
  test: {
    compiler: () => "test",
    evaluator: () => "test",
  },
});

parser1.functions satisfies Record<
  string,
  ExpressionLanguage.FunctionDefinition
>;
parser1.tokenStream satisfies ExpressionLanguage.TokenStream | null;
parser1.names satisfies ExpressionLanguage.VariableName[] | null;
parser1.flags satisfies number;
parser1.unaryOperators satisfies Record<string, { precedence: number }>;
parser1.binaryOperators satisfies Record<
  string,
  { precedence: number; associativity: number }
>;

const tokenStream = ExpressionLanguage.tokenize("1 + 1");
const node1: ExpressionLanguage.Node = parser1.parse(tokenStream);
const node2: ExpressionLanguage.Node = parser1.parse(tokenStream, ["x", "y"]);
const node3: ExpressionLanguage.Node = parser1.parse(
  tokenStream,
  ["x", "y"],
  0
);

parser1.lint(tokenStream);
parser1.lint(tokenStream, ["x", "y"]);
parser1.lint(tokenStream, ["x", "y"], 0);

// ============================================================================
// Compiler Tests
// ============================================================================

const compiler1 = new ExpressionLanguage.Compiler({
  test: {
    compiler: () => "test",
    evaluator: () => "test",
  },
});

compiler1.source satisfies string;
compiler1.functions satisfies Record<
  string,
  ExpressionLanguage.FunctionDefinition
>;

const funcDef: ExpressionLanguage.FunctionDefinition =
  compiler1.getFunction("test");
const source: string = compiler1.getSource();
const resetResult: ExpressionLanguage.Compiler = compiler1.reset();

const testNode = new ExpressionLanguage.Node();
const compileResult: ExpressionLanguage.Compiler = compiler1.compile(testNode);
const subcompiled: string = compiler1.subcompile(testNode);
const rawResult: ExpressionLanguage.Compiler = compiler1.raw("test");
const stringResult: ExpressionLanguage.Compiler = compiler1.string("test");
const reprResult: ExpressionLanguage.Compiler = compiler1.repr("test");
const reprResult2: ExpressionLanguage.Compiler = compiler1.repr("test", true);

// ============================================================================
// ArrayAdapter (CacheAdapter) Tests
// ============================================================================

const adapter1 = new ExpressionLanguage.ArrayAdapter();
const adapter2 = new ExpressionLanguage.ArrayAdapter(3600);

adapter1.defaultLifetime satisfies number;
adapter1.values satisfies Record<string, unknown>;
adapter1.expiries satisfies Record<string, number>;

const cacheItem1: ExpressionLanguage.CacheItem = adapter1.createCacheItem(
  "key",
  "value",
  true
);
const cacheItem2: ExpressionLanguage.CacheItem = adapter1.getItem("key");
const cacheItems: Record<string, ExpressionLanguage.CacheItem> =
  adapter1.getItems(["key1", "key2"]);
const hasItem: boolean = adapter1.hasItem("key");
const saved: boolean = adapter1.save(cacheItem1);
const saveDeferred: boolean = adapter1.saveDeferred(cacheItem1);
const committed: boolean = adapter1.commit();
const deleted: boolean = adapter1.delete("key");
const deletedItem: boolean = adapter1.deleteItem("key");
const deletedItems: boolean = adapter1.deleteItems(["key1", "key2"]);
const cleared: boolean = adapter1.clear();
const values: Record<string, unknown> = adapter1.getValues();
adapter1.reset();

const getResult: unknown = adapter1.get("key", (item, save) => {
  item satisfies ExpressionLanguage.CacheItem;
  save satisfies boolean;
  return "value";
});

// ============================================================================
// CacheItem Tests
// ============================================================================

const cacheItem = new ExpressionLanguage.CacheItem();

ExpressionLanguage.CacheItem.METADATA_EXPIRY_OFFSET satisfies number;
ExpressionLanguage.CacheItem.RESERVED_CHARACTERS satisfies string[];
const validKey: string = ExpressionLanguage.CacheItem.validateKey("mykey");

cacheItem.key satisfies string | null;
cacheItem.value satisfies unknown;
cacheItem.isHit satisfies boolean;
cacheItem.expiry satisfies number | null;
cacheItem.defaultLifetime satisfies number | null;
cacheItem.metadata satisfies Record<string, unknown>;
cacheItem.newMetadata satisfies Record<string, unknown>;
cacheItem.innerItem satisfies unknown;
cacheItem.poolHash satisfies unknown;
cacheItem.isTaggable satisfies boolean;

const key: string | null = cacheItem.getKey();
const value: unknown = cacheItem.get();
const setResult: ExpressionLanguage.CacheItem = cacheItem.set("value");
const expiresAtResult: ExpressionLanguage.CacheItem = cacheItem.expiresAt(
  new Date()
);
const expiresAtNull: ExpressionLanguage.CacheItem = cacheItem.expiresAt(null);
const expiresAfterResult: ExpressionLanguage.CacheItem =
  cacheItem.expiresAfter(3600);
const expiresAfterNull: ExpressionLanguage.CacheItem =
  cacheItem.expiresAfter(null);
const tagResult1: ExpressionLanguage.CacheItem = cacheItem.tag("tag1");
const tagResult2: ExpressionLanguage.CacheItem = cacheItem.tag([
  "tag1",
  "tag2",
]);
const metadata: Record<string, unknown> = cacheItem.getMetadata();

// ============================================================================
// Provider Tests
// ============================================================================

// AbstractProvider (abstract class)
const abstractProvider: ExpressionLanguage.AbstractProvider =
  new ExpressionLanguage.BasicProvider();
const abstractFuncs: ExpressionLanguage.ExpressionFunction[] =
  abstractProvider.getFunctions();

// BasicProvider
const basicProvider = new ExpressionLanguage.BasicProvider();
const basicFuncs: ExpressionLanguage.ExpressionFunction[] =
  basicProvider.getFunctions();

// StringProvider
const stringProvider = new ExpressionLanguage.StringProvider();
const stringFuncs: ExpressionLanguage.ExpressionFunction[] =
  stringProvider.getFunctions();

// ArrayProvider
const arrayProvider = new ExpressionLanguage.ArrayProvider();
const arrayFuncs: ExpressionLanguage.ExpressionFunction[] =
  arrayProvider.getFunctions();

// DateProvider
const dateProvider = new ExpressionLanguage.DateProvider();
const dateFuncs: ExpressionLanguage.ExpressionFunction[] =
  dateProvider.getFunctions();

// ============================================================================
// Expression Tests
// ============================================================================

const expr1 = new ExpressionLanguage.Expression("1 + 1");
expr1.expression satisfies string;
const exprStr: string = expr1.toString();

// ============================================================================
// ParsedExpression Tests
// ============================================================================

const parsedNode = new ExpressionLanguage.Node();
const parsedExpr1 = new ExpressionLanguage.ParsedExpression(
  "1 + 1",
  parsedNode
);
parsedExpr1.expression satisfies string;
parsedExpr1.nodes satisfies ExpressionLanguage.Node;
const nodes: ExpressionLanguage.Node = parsedExpr1.getNodes();

// Static method test
const fromJson1: ExpressionLanguage.ParsedExpression =
  ExpressionLanguage.ParsedExpression.fromJSON('{"expression":"1+1"}');
const fromJson2: ExpressionLanguage.ParsedExpression =
  ExpressionLanguage.ParsedExpression.fromJSON({ expression: "1+1" });

// ============================================================================
// Token Tests
// ============================================================================

ExpressionLanguage.Token.EOF_TYPE satisfies "end of expression";
ExpressionLanguage.Token.NAME_TYPE satisfies "name";
ExpressionLanguage.Token.NUMBER_TYPE satisfies "number";
ExpressionLanguage.Token.STRING_TYPE satisfies "string";
ExpressionLanguage.Token.OPERATOR_TYPE satisfies "operator";
ExpressionLanguage.Token.PUNCTUATION_TYPE satisfies "punctuation";

const token1 = new ExpressionLanguage.Token("name", "test", 0);
token1.value satisfies unknown;
token1.type satisfies string;
token1.cursor satisfies number;

const testResult: boolean = token1.test("name");
const testResult2: boolean = token1.test("name", "test");
const tokenStr: string = token1.toString();
const isEqual: boolean = token1.isEqualTo(token1);
const diff: string[] = token1.diff(token1);

// ============================================================================
// TokenStream Tests
// ============================================================================

const ts1 = new ExpressionLanguage.TokenStream("1 + 1", [token1]);
ts1.expression satisfies string;
ts1.position satisfies number;
ts1.tokens satisfies ExpressionLanguage.Token[];
ts1.current satisfies ExpressionLanguage.Token;
ts1.last satisfies ExpressionLanguage.Token;

const tsStr: string = ts1.toString();
ts1.next();
ts1.expect("name");
ts1.expect("name", "test");
ts1.expect("name", "test", "Expected name test");
const isEOF: boolean = ts1.isEOF();
const tsEqual: boolean = ts1.isEqualTo(ts1);
const tsDiff: Array<{ index: number; diff: string[] }> = ts1.diff(ts1);

// ============================================================================
// Node Tests
// ============================================================================

const node4 = new ExpressionLanguage.Node();
const node5 = new ExpressionLanguage.Node({ left: node4, right: node4 });
const node6 = new ExpressionLanguage.Node([node4, node4]);
const node7 = new ExpressionLanguage.Node({}, { attr: "value" });
const node8 = new ExpressionLanguage.Node({ left: node4 }, { operator: "+" });

node4.name satisfies string;
node4.nodes satisfies
  | Record<string, ExpressionLanguage.Node>
  | ExpressionLanguage.Node[];
node4.attributes satisfies Record<string, unknown>;

const nodeStr: string = node4.toString();
node4.compile(compiler1);
const evalResult: unknown = node4.evaluate(
  { test: { compiler: () => "test", evaluator: () => "test" } },
  { x: 1 }
);
const toArrayResult: unknown[] = node4.toArray();
const dumpResult: string = node4.dump();
const dumpStringResult: string = node4.dumpString("test");
const isHashResult: boolean = node4.isHash({});

// ============================================================================
// SyntaxError Tests
// ============================================================================

const syntaxError1 = new ExpressionLanguage.SyntaxError("Error message", 5);
const syntaxError2 = new ExpressionLanguage.SyntaxError(
  "Error message",
  5,
  "1 + x"
);
const syntaxError3 = new ExpressionLanguage.SyntaxError(
  "Error message",
  5,
  "1 + x",
  "x"
);
const syntaxError4 = new ExpressionLanguage.SyntaxError(
  "Error message",
  5,
  "1 + x",
  "x",
  ["y", "z"]
);

syntaxError1.name satisfies "SyntaxError";
syntaxError1.cursor satisfies number;
syntaxError1.expression satisfies string | undefined;
syntaxError1.subject satisfies string | undefined;
syntaxError1.proposals satisfies string[] | undefined;

const errorStr: string = syntaxError1.toString();

// ============================================================================
// Constants Tests
// ============================================================================

ExpressionLanguage.IGNORE_UNKNOWN_VARIABLES satisfies number;
ExpressionLanguage.IGNORE_UNKNOWN_FUNCTIONS satisfies number;
ExpressionLanguage.OPERATOR_LEFT satisfies number;
ExpressionLanguage.OPERATOR_RIGHT satisfies number;

// ============================================================================
// Type Alias Tests
// ============================================================================

// VariableName
const varName1: ExpressionLanguage.VariableName = "x";
const varName2: ExpressionLanguage.VariableName = { x: "number", y: "string" };

// CompilerFunction
const compFunc: ExpressionLanguage.CompilerFunction = (...args: string[]) =>
  args.join(",");
const compResult: string = compFunc("a", "b", "c");

// EvaluatorFunction
const evalFunc: ExpressionLanguage.EvaluatorFunction = (
  values: Record<string, unknown>,
  ...args: unknown[]
) => args[0];
const evalResult2: unknown = evalFunc({ x: 1 }, "test", 123);

// FunctionDefinition
const funcDef2: ExpressionLanguage.FunctionDefinition = {
  compiler: () => "test",
  evaluator: () => "test",
};

// ============================================================================
// Lexer Interface Tests
// ============================================================================

const lexer2: ExpressionLanguage.Lexer = {
  tokenize: (expression: string) =>
    new ExpressionLanguage.TokenStream(expression, []),
};

// ============================================================================
// CacheAdapter Interface Tests
// ============================================================================

const cacheAdapter: ExpressionLanguage.CacheAdapter = {
  getItem: (key: string) => new ExpressionLanguage.CacheItem(),
  save: (item: ExpressionLanguage.CacheItem) => true,
  get: (
    key: string,
    callback: (item: ExpressionLanguage.CacheItem, save: boolean) => unknown,
    beta?: unknown,
    metadata?: unknown
  ) => callback(new ExpressionLanguage.CacheItem(), true),
  getItems: (keys: string[]) => ({}),
  hasItem: (key: string) => true,
  clear: () => true,
  deleteItem: (key: string) => true,
  deleteItems: (keys: string[]) => true,
  commit: () => true,
  saveDeferred: (item: ExpressionLanguage.CacheItem) => true,
};

// ============================================================================
// Tokenize Function Test
// ============================================================================

const tokens: ExpressionLanguage.TokenStream =
  ExpressionLanguage.tokenize("1 + 1");

// ============================================================================
// Test with actual usage
// ============================================================================

el1.functions = {
  customFunc: {
    compiler: (...args: string[]) => `(${args.join(", ")})`,
    evaluator: (values: Record<string, unknown>, ...args: unknown[]) =>
      args.join(", "),
  },
};

el1.evaluate("true");
el1.evaluate(new ExpressionLanguage.Expression("true"));
