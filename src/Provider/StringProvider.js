import ExpressionFunction from "../ExpressionFunction";
import AbstractProvider from "./AbstractProvider";

export default class StringProvider extends AbstractProvider {
    getFunctions() {
        return [
            new ExpressionFunction('strtolower', (str) => {
                return 'strtolower(' + str + ')';
            }, (args, str) => {
                if (typeof str === "string") {
                    return str.toLocaleLowerCase();
                }
                return undefined;
            }),
            new ExpressionFunction('strtoupper', (str) => {
                return 'strtoupper(' + str + ')';
            }, (args, str) => {
                if (typeof str === "string") {
                    return str.toLocaleUpperCase()
                }
                return undefined;
            }),
            new ExpressionFunction('explode', (delimiter, string, limit='null') => {
                return `explode(${delimiter}, ${string}, ${limit})`;
            }, (values, delimiter, string, limit=null) => {
                //  discuss at: https://locutus.io/php/explode/
                // original by: Kevin van Zonneveld (https://kvz.io)
                //   example 1: explode(' ', 'Kevin van Zonneveld')
                //   returns 1: [ 'Kevin', 'van', 'Zonneveld' ]

                if (typeof delimiter === 'undefined' ||
                    typeof string === 'undefined') {
                    return null
                }
                if (delimiter === '' ||
                    delimiter === false ||
                    delimiter === null) {
                    return false
                }
                if (typeof delimiter === 'function' ||
                    typeof delimiter === 'object' ||
                    typeof string === 'function' ||
                    typeof string === 'object') {
                    return {
                        0: ''
                    }
                }
                if (delimiter === true) {
                    delimiter = '1'
                }

                // Here we go...
                delimiter += '';
                string += '';

                var s = string.split(delimiter);

                if (typeof limit === 'undefined') return s;

                // Support for limit
                if (limit === 0) limit = 1;

                // Positive limit
                if (limit > 0) {
                    if (limit >= s.length) {
                        return s
                    }
                    return s
                        .slice(0, limit - 1)
                        .concat([s.slice(limit - 1)
                            .join(delimiter)
                        ])
                }

                // Negative limit
                if (-limit >= s.length) {
                    return []
                }

                s.splice(s.length + limit);
                return s
            })
        ]
    }
}