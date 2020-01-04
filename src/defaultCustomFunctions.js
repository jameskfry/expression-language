import moment from "moment";

export const isString = s => {
    return typeof s === "string";
};

export const strLen = s => {
    if (isString(s)) {
        return s.length;
    }
    return 0;
};

export const isEmail = s => {
    if (isString(s)) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
    }

    return false;
};

export const isPhone = s => {
    if (isString(s)) {
        if (s.substring(0, 2) === "+1") {
            s = s.substring(2);
        }
        return /^\d{10}$/.test(s.replace(/\D/g, ""));
    }

    return false;
};

export const isNull = s => {
    return s === null;
};

export const isCurrency = s => {
    return /(?=.*?\d)^\$?(([1-9]\d{0,2}(,\d{3})*)|\d+)?(\.\d{1,2})?$/.test(s);
};

export const now = () => {
    return moment();
};

export const dateFormat = (m, format) => {
    return m.format(format);
};

export const year = m => {
    return dateFormat(m, "YYYY");
};

export const date = m => {
    return dateFormat(m, "YYYY-MM-DD");
};

export const string = s => {
    if (s.toString !== undefined) {
        return s.toString();
    }

    return "";
};

export const int = s => {
    return parseInt(s);
};

let defaultCustomFunctions = {
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
};

export default defaultCustomFunctions;