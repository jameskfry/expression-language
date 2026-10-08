<?php
/*
 * Generates src/__tests__/fixtures/semantics-parity.json: what Symfony's own code answers for every operator applied to every
 * pair of operands of src/__tests__/fixtures/semantics-spec.json (see SymfonySemantics.test.js, which expands the same spec).
 *
 * Usage:
 *
 *   php -d xdebug.mode=off scripts/generate-semantics-fixtures.php /tmp/symfony-expression-language > src/__tests__/fixtures/semantics-parity.json
 *
 * Warnings and deprecations (a leading-numeric string, a float turned into an int...) do not stop PHP: the case is evaluated
 * regardless, and its result is what is kept.
 *
 * The file holds {"messages": [...], "results": [...]}: a result is wrapped in an array ([value]), an error is the index of
 * its message ("TypeError: Unsupported operand types: string + int").
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

use Symfony\Component\ExpressionLanguage\Lexer;
use Symfony\Component\ExpressionLanguage\Parser;

$spec = json_decode(file_get_contents(__DIR__.'/../src/__tests__/fixtures/semantics-spec.json'), true);

// the same expansion as SymfonySemantics.test.js
$cases = [];
foreach ($spec['binary'] as $operator) {
    foreach ($spec['values'] as $left) {
        foreach ($spec['values'] as $right) {
            $cases[] = ['a '.$operator.' b', ['a' => $left, 'b' => $right]];
        }
    }
}
foreach ($spec['unary'] as $operator) {
    foreach ($spec['values'] as $value) {
        $cases[] = [$operator.'a', ['a' => $value]];
    }
}
foreach ($spec['other'] as $expression) {
    foreach ($spec['values'] as $value) {
        $cases[] = [$expression, ['a' => $value, 'b' => $value]];
    }
}

$normalize = static function (mixed $value) use (&$normalize): mixed {
    if (\is_float($value) && (is_nan($value) || is_infinite($value))) {
        return ['$special' => is_nan($value) ? 'NaN' : ($value > 0 ? 'Infinity' : '-Infinity')];
    }
    if (\is_array($value)) {
        return array_map($normalize, $value);
    }
    if (\is_object($value)) {
        return ['$object' => $value::class];
    }

    return $value;
};

$parser = new Parser([]);
$lexer = new Lexer();
$messages = [];
$results = [];
foreach ($cases as [$expression, $variables]) {
    set_error_handler(static fn (): bool => true);

    try {
        $nodes = $parser->parse($lexer->tokenize($expression), array_keys($variables));
        // a result is wrapped in an array, an error is the index of its message
        $results[] = [$normalize($nodes->evaluate([], $variables))];
    } catch (\Throwable $e) {
        $message = $e::class.': '.$e->getMessage();
        $index = array_search($message, $messages, true);
        if (false === $index) {
            $index = \count($messages);
            $messages[] = $message;
        }
        $results[] = $index;
    } finally {
        restore_error_handler();
    }
}

echo json_encode(['messages' => $messages, 'results' => $results], \JSON_UNESCAPED_SLASHES | \JSON_UNESCAPED_UNICODE | \JSON_PARTIAL_OUTPUT_ON_ERROR), "\n";
