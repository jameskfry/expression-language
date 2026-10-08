<?php
/*
 * Loads a PHP file dumped by CompiledExpressionLanguage#dumpCompiled(expressions, {target: 'php'}) with Symfony's own
 * CompiledExpressionLanguage, and checks that it behaves like the file Symfony itself dumps for the same expressions,
 * over a corpus (the format of src/__tests__/fixtures/symfony-corpus.json: a list of [expression, variables]).
 *
 * Symfony's compiled code is not always the twin of its plain evaluator (PHP's own `??` and string offsets are more lenient
 * than the nodes' evaluate()), so the file is compared with Symfony's compiled one, and the gaps between compiled and plain
 * evaluation are only listed, as "symfonyInconsistencies".
 *
 * Usage:
 *
 *   php -d xdebug.mode=off verify-compiled-php.php <path to a checkout of symfony/expression-language> <dumped.php> <corpus.json>
 *
 * Prints a JSON report: {"checked": n, "compiled": n, "identical": n, "mismatches": [...], "symfonyInconsistencies": [...]}.
 * Exits with 1 when there is a mismatch.
 * symfony/cache is replaced by a tiny in-memory stand-in, so the component can be checked out on its own.
 */

namespace Symfony\Contracts\Service {
    interface ResetInterface
    {
        public function reset();
    }
}

namespace Psr\Cache {
    interface CacheItemPoolInterface
    {
    }
}

namespace Symfony\Component\Cache\Adapter {
    class ArrayAdapter implements \Psr\Cache\CacheItemPoolInterface
    {
        private array $items = [];

        public function getItem(string $key): object
        {
            return $this->items[$key] ??= new class {
                public mixed $value = null;

                public function get(): mixed
                {
                    return $this->value;
                }

                public function set(mixed $value): static
                {
                    $this->value = $value;

                    return $this;
                }
            };
        }

        public function save(object $item): bool
        {
            return true;
        }
    }
}

namespace {
    if ($argc < 4 || !is_dir($argv[1]) || !is_file($argv[2]) || !is_file($argv[3])) {
        fwrite(STDERR, "Usage: php {$argv[0]} <symfony/expression-language checkout> <dumped.php> <corpus.json>\n");
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

    use Symfony\Component\ExpressionLanguage\CompiledExpressionLanguage;
    use Symfony\Component\ExpressionLanguage\ExpressionLanguage;

    $plain = new ExpressionLanguage();
    $compiled = new CompiledExpressionLanguage(new ExpressionLanguage(), $argv[2]);
    $dumped = require $argv[2];
    $corpus = json_decode(file_get_contents($argv[3]));

    // what Symfony itself compiles for the same expressions
    $reference = new CompiledExpressionLanguage(new ExpressionLanguage());
    $referenceFile = tempnam(sys_get_temp_dir(), 'sel');
    file_put_contents($referenceFile, $reference->dumpCompiled(array_map(static fn (array $case) => $case[0], $corpus)));
    $symfonyCompiled = new CompiledExpressionLanguage(new ExpressionLanguage(), $referenceFile);

    $outcome = static function (ExpressionLanguage $language, string $expression, array $variables): array {
        set_error_handler(static function (int $type, string $message): never {
            throw new \ErrorException($message, 0, $type);
        });

        try {
            return ['result' => $language->evaluate($expression, $variables)];
        } catch (\Throwable $e) {
            return ['error' => $e::class];
        } finally {
            restore_error_handler();
        }
    };
    $same = static fn (array $a, array $b): bool => $a === $b || (isset($a['result'], $b['result']) && $a['result'] == $b['result'] && \gettype($a['result']) === \gettype($b['result']));

    $report = ['checked' => 0, 'compiled' => 0, 'identical' => 0, 'mismatches' => [], 'symfonyInconsistencies' => []];
    foreach ($corpus as [$expression, $variables]) {
        $variables = (array) $variables;
        ++$report['checked'];
        if (isset($dumped[$expression])) {
            ++$report['compiled'];
        }

        $ours = $outcome($compiled, $expression, $variables);
        $theirs = $outcome($symfonyCompiled, $expression, $variables);
        $plainResult = $outcome($plain, $expression, $variables);

        // a failing expression only has to fail with the same kind of error: the message is PHP's own
        if ($same($ours, $theirs) || (isset($ours['error']) && isset($theirs['error']))) {
            ++$report['identical'];
        } else {
            $report['mismatches'][] = ['expression' => $expression, 'variables' => $variables, 'symfonyCompiled' => $theirs, 'ours' => $ours];
        }

        if (isset($dumped[$expression]) && !$same($theirs, $plainResult) && !(isset($theirs['error']) && isset($plainResult['error']))) {
            $report['symfonyInconsistencies'][] = ['expression' => $expression, 'variables' => $variables, 'plain' => $plainResult, 'compiled' => $theirs];
        }
    }
    @unlink($referenceFile);

    echo json_encode($report, \JSON_PRETTY_PRINT | \JSON_UNESCAPED_SLASHES | \JSON_PARTIAL_OUTPUT_ON_ERROR), "\n";
    exit($report['mismatches'] ? 1 : 0);
}
