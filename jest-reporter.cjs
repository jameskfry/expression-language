class AssertionReporter {
    constructor() {
        this.assertionCount = 0;
    }
    onTestResult(_, testResult) {
        let count = 0;
        testResult.testResults.forEach(tr => {
            count += tr.numPassingAsserts;
            this.assertionCount += tr.numPassingAsserts;
        });
        //console.log(`✅ Passed expectations in this file: ${count}`);
    }
    onRunComplete() {
        console.log("");
        console.log("------");
        // Make the "Passed expectations:" label bold and the count green
        // Bold: \x1b[1m ... \x1b[22m (reset bold)
        // Green: \x1b[32m ... \x1b[39m (reset foreground color)
        console.log(`\x1b[1mPassed expectations: \x1b[32m${this.assertionCount}\x1b[39m\x1b[22m`);
    }
}

module.exports = AssertionReporter;