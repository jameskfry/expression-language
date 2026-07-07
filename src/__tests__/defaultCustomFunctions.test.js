import dayjs from "dayjs";
import defaultCustomFunctions, {
    isString,
    strLen,
    isEmail,
    isPhone,
    isNull,
    isCurrency,
    now,
    dateFormat,
    year,
    date,
    string,
    int
} from "../defaultCustomFunctions";

test('isString', () => {
    expect(isString("hello")).toBe(true);
    expect(isString("")).toBe(true);
    expect(isString(123)).toBe(false);
    expect(isString(null)).toBe(false);
    expect(isString(undefined)).toBe(false);
    expect(isString({})).toBe(false);
});

test('strLen', () => {
    expect(strLen("hello")).toBe(5);
    expect(strLen("")).toBe(0);
    expect(strLen(12345)).toBe(0);
    expect(strLen(null)).toBe(0);
});

test('isEmail', () => {
    expect(isEmail("foo@example.com")).toBe(true);
    expect(isEmail("not-an-email")).toBe(false);
    expect(isEmail("missing@domain")).toBe(false);
    expect(isEmail(12345)).toBe(false);
    expect(isEmail(null)).toBe(false);
});

test('isPhone', () => {
    expect(isPhone("5551234567")).toBe(true);
    expect(isPhone("(555) 123-4567")).toBe(true);
    expect(isPhone("+15551234567")).toBe(true);
    expect(isPhone("555123")).toBe(false);
    expect(isPhone(5551234567)).toBe(false);
});

test('isNull', () => {
    expect(isNull(null)).toBe(true);
    expect(isNull(undefined)).toBe(false);
    expect(isNull(0)).toBe(false);
    expect(isNull("")).toBe(false);
});

test('isCurrency', () => {
    expect(isCurrency("$1,234.56")).toBe(true);
    expect(isCurrency("100")).toBe(true);
    expect(isCurrency("1234")).toBe(true);
    expect(isCurrency("abc")).toBe(false);
});

test('now returns a dayjs instance', () => {
    expect(dayjs.isDayjs(now())).toBe(true);
});

test('dateFormat formats a dayjs instance', () => {
    expect(dateFormat(dayjs("2026-07-07"), "YYYY-MM-DD")).toBe("2026-07-07");
});

test('year extracts the 4-digit year', () => {
    expect(year(dayjs("2026-07-07"))).toBe("2026");
});

test('date extracts YYYY-MM-DD', () => {
    expect(date(dayjs("2026-07-07"))).toBe("2026-07-07");
});

test('string converts values to their string representation', () => {
    expect(string(123)).toBe("123");
    expect(string(true)).toBe("true");
    expect(string("already a string")).toBe("already a string");
});

test('string returns an empty string for null/undefined', () => {
    expect(string(null)).toBe("");
    expect(string(undefined)).toBe("");
});

test('int parses numeric strings and returns NaN for non-numeric input', () => {
    expect(int("42")).toBe(42);
    expect(int("42.9")).toBe(42);
    expect(int("not a number")).toBeNaN();
});

test('defaultCustomFunctions exposes all helpers by name', () => {
    expect(Object.keys(defaultCustomFunctions).sort()).toEqual(
        ["date", "dateFormat", "int", "isCurrency", "isEmail", "isNull", "isPhone", "isString", "now", "string", "strLen", "year"].sort()
    );
});
