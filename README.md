# Javascript implementation of the Symfony/ExpressionLanguage

The idea is to be able to evaluate the same expressions client-side (in Javascript with this library)
and server-side (in PHP with the Symfony/ExpressionLanguage).

## Installation

### NPM/Yarn
```bash
npm install expression-language
# or
yarn add expression-language
```

### Browser
You can also use this library directly in the browser by including it via a script tag:

```html
<!-- Unminified version for development -->
<script src="https://unpkg.com/expression-language/dist/expression-language.js"></script>
<!-- or minified version for production -->
<script src="https://unpkg.com/expression-language/dist/expression-language.min.js"></script>
```

## Examples

### NPM/Yarn Setup
```javascript
import ExpressionLanguage from "expression-language";
let expressionLanguage = new ExpressionLanguage();
```

### Browser Setup
```html
<script src="https://unpkg.com/expression-language/dist/expression-language.min.js"></script>
<script>
  // The library is available as a global ExpressionLanguage object
  const expressionLanguage = new ExpressionLanguage();
</script>
```

A complete browser example is available in the [examples/browser-usage.html](examples/browser-usage.html) file.
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

## Continuous Integration and Deployment

This package is automatically published to npm when changes are pushed to the main branch using GitHub Actions.

### For Maintainers

If you're maintaining this package, you'll need to set up an NPM authentication token:

1. Generate an npm access token with publish permissions:
   - Go to npmjs.com and log in
   - Click on your profile picture → Access Tokens
   - Click "Generate New Token" → Select "Publish"
   
2. Add the token to your GitHub repository:
   - Go to your GitHub repository → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `NPM_TOKEN`
   - Value: Your npm access token
   - Click "Add secret"

Once set up, any push to the main branch will trigger the workflow to test and publish the package.

