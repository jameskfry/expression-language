<?php
/*
 * Generates src/__tests__/fixtures/symfony-parity.json: the result (or error message) that Symfony's own
 * ExpressionLanguage code gives for every expression of src/__tests__/fixtures/symfony-corpus.json.
 * The Jest suite replays the same corpus through this library and compares the outcomes.
 *
 * Usage (a PHP version able to run the checked out component is needed):
 *
 *   git clone --depth 1 https://github.com/symfony/expression-language.git /tmp/symfony-expression-language
 *   php -d xdebug.mode=off -d xdebug.max_nesting_level=-1 scripts/generate-parity-fixtures.php /tmp/symfony-expression-language > src/__tests__/fixtures/symfony-parity.json
 *
 * (Xdebug, when loaded, aborts the deeply nested expressions of the corpus on its own.)
 *
 * Only the Lexer, Parser, Compiler and Nodes are loaded, so symfony/cache is not required.
 */

if ($argc < 2 || !is_dir($argv[1])) {
    fwrite(STDERR, "Usage: php {$argv[0]} <path to a checkout of symfony/expression-language>\n");
    exit(1);
}

$root = rtrim($argv[1], '/');
spl_autoload_register(static function (string $class) use ($root): void {
    $prefix = 'Symfony\\Component\\ExpressionLanguage\\';
    if (str_starts_with($class, $prefix)) {
        $file = $root.'/'.str_replace('\\', '/', substr($class, \strlen($prefix))).'.php';
        if (is_file($file)) {
            require $file;
        }
    }
});
if (!function_exists('trigger_deprecation')) {
    function trigger_deprecation(string ...$args): void
    {
    }
}

use Symfony\Component\ExpressionLanguage\ExpressionFunction;
use Symfony\Component\ExpressionLanguage\Lexer;
use Symfony\Component\ExpressionLanguage\Parser;

$functions = [];
foreach (['min', 'max', 'count'] as $name) {
    $function = ExpressionFunction::fromPhp($name);
    $functions[$name] = ['compiler' => $function->getCompiler(), 'evaluator' => $function->getEvaluator()];
}

$corpus = json_decode(file_get_contents(__DIR__.'/../src/__tests__/fixtures/symfony-corpus.json'));

$normalize = static function (mixed $value) use (&$normalize): mixed {
    if (\is_float($value) && (is_nan($value) || is_infinite($value))) {
        return ['$special' => is_nan($value) ? 'NaN' : ($value > 0 ? 'Infinity' : '-Infinity')];
    }
    if (\is_array($value)) {
        return array_map($normalize, $value);
    }

    return $value;
};

$results = [];
foreach ($corpus as [$expression, $variables]) {
    $variables = (array) $variables;
    set_error_handler(static function (int $type, string $message): never {
        throw new \ErrorException($message, 0, $type);
    });

    try {
        $nodes = (new Parser($functions))->parse((new Lexer())->tokenize($expression), array_keys($variables));
        $results[] = ['result' => $normalize($nodes->evaluate($functions, $variables))];
    } catch (\ErrorException $e) {
        // a PHP warning/notice (e.g. an undefined property): there is nothing to compare these with
        $results[] = ['warning' => $e->getMessage()];
    } catch (\Throwable $e) {
        $results[] = ['error' => $e->getMessage()];
    } finally {
        restore_error_handler();
    }
}

echo json_encode($results, \JSON_PRETTY_PRINT | \JSON_UNESCAPED_SLASHES | \JSON_UNESCAPED_UNICODE | \JSON_PARTIAL_OUTPUT_ON_ERROR), "\n";
