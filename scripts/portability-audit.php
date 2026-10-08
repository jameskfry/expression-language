<?php
/*
 * Helper of portability-audit.cjs (--php-symfony): evaluates expressions with Symfony's own Lexer, Parser and Nodes.
 *
 * Usage: php portability-audit.php <path to a checkout of symfony/expression-language> <cases.json>
 *
 * The cases are [{"text": "...", "values": {...}}]; the values are decoded as PHP arrays (a JSON object is an associative array,
 * which is what an object is for the expressions evaluated here). Prints one {"value": ...} or {"error": "..."} per case.
 * Warnings and deprecations do not stop an evaluation, they only make it lenient, like the PHP they come from.
 */

if ($argc < 3 || !is_dir($argv[1]) || !is_file($argv[2])) {
    fwrite(STDERR, "Usage: php {$argv[0]} <path to a checkout of symfony/expression-language> <cases.json>\n");
    exit(2);
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

$results = [];
foreach (json_decode(file_get_contents($argv[2]), true) as $case) {
    set_error_handler(static fn (): bool => true);

    try {
        $nodes = (new Parser([]))->parse((new Lexer())->tokenize($case['text']), array_keys($case['values']));
        $results[] = ['value' => $normalize($nodes->evaluate([], $case['values']))];
    } catch (\Throwable $e) {
        $results[] = ['error' => $e::class.': '.$e->getMessage()];
    } finally {
        restore_error_handler();
    }
}

echo json_encode($results, \JSON_UNESCAPED_UNICODE | \JSON_PARTIAL_OUTPUT_ON_ERROR), "\n";
