import AbstractProvider from "./AbstractProvider";
import ExpressionFunction from "../ExpressionFunction";
import date from "locutus/php/datetime/date";
import strtotime from "locutus/php/datetime/strtotime";

export default class DateProvider extends AbstractProvider {
    getFunctions() {
        return [
            new ExpressionFunction('date', function(format, timestamp) {
                let remaining = "";
                if (timestamp) {
                    remaining = `, ${timestamp}`;
                }
                return `date(${format}${remaining})`;
            }, function(values, format, timestamp) {
                return date(format, timestamp);
            }),
            new ExpressionFunction('strtotime', function(str, now) {
                let remaining = "";
                if (now) {
                    remaining = `, ${now}`;
                }
                return `strtotime(${str}${remaining})`;
            }, function (values, str, now)  {
                return strtotime(str, now);
            })
        ]
    }
}
