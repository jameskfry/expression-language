import ExpressionFunction from "../ExpressionFunction";
import AbstractProvider from "./AbstractProvider";
import explode from "locutus/php/strings/explode";
import strlen from "locutus/php/strings/strlen";
import strtolower from "locutus/php/strings/strtolower";
import strtoupper from "locutus/php/strings/strtoupper";
import substr from "locutus/php/strings/substr";
import strstr from "locutus/php/strings/strstr";
import stristr from "locutus/php/strings/stristr";

export default class StringProvider extends AbstractProvider {
    getFunctions() {
        return [
            new ExpressionFunction('strtolower', (str) => {
                return 'strtolower(' + str + ')';
            }, (args, str) => {
                return strtolower(str);
            }),
            new ExpressionFunction('strtoupper', (str) => {
                return 'strtoupper(' + str + ')';
            }, (args, str) => {
                return strtoupper(str);
            }),
            new ExpressionFunction('explode', (delimiter, string, limit='null') => {
                return `explode(${delimiter}, ${string}, ${limit})`;
            }, (values, delimiter, string, limit=null) => {
                return explode(delimiter, string, limit);
            }),
            new ExpressionFunction('strlen', function compiler(str) {
                return `strlen(${str});`;
            }, function evaluator(values, str) {
                return strlen(str);
            }),
            new ExpressionFunction('strstr', function compiler(haystack, needle, before_needle) {
                let remaining = '';
                if (before_needle) {
                    remaining = `, ${before_needle}`;
                }
                return `strstr(${haystack}, ${needle}${remaining});`;
            }, function evaluator(values, haystack, needle, before_needle) {
                return strstr(haystack, needle, before_needle);
            }),
            new ExpressionFunction('stristr', function compiler(haystack, needle, before_needle) {
                let remaining = '';
                if (before_needle) {
                    remaining = `, ${before_needle}`;
                }
                return `stristr(${haystack}, ${needle}${remaining});`;
            }, function evaluator(values, haystack, needle, before_needle) {
                return stristr(haystack, needle, before_needle);
            }),
            new ExpressionFunction('substr', function compiler(str, start, length) {
                let remaining = '';
                if (length) {
                    remaining = `, ${length}`;
                }
                return `substr(${str}, ${start}${remaining});`;
            }, function evaluator(values, str, start, length) {
                return substr(str, start, length);
            })
        ]
    }
}
