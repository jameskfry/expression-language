# Javascript implementation of the Symfony/ExpressionLanguage

The idea is to be able to evaluate the same expressions client-side (in Javascript with this library)
and server-side (in PHP with the Symfony/ExpressionLanguage).

## Examples
#### Setup
```javascript
import ExpressionLanguage from "expression-language";
let expressionLanguage = new ExpressionLanguage();
```
#### Basic
```javascript
let result = expressionLanguage.evaluate('1 + 1');
// result is 2.
```
#### Multiple clauses
```javascript
let result = expressionLanguage.evaluate(
    'a > 0 && b != a', 
    {
        a: 1, 
        b: 2
    }
);
// result is true
```
#### Object and Array access
```javascript
let expression = 'a[2] === "three" and b.myMethod(a[1]) === "bar two"';
let values = {
    a: ["one", "two", "three"], 
    b: {
        myProperty: "foo", 
        myMethod: function(word) {
            return "bar " + word;
        }
    }
};
let result = expressionLanguage.evaluate(expression, values);
// result is true
```

