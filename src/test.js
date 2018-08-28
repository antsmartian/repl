const { Runtime, mainContextIdPromise } = require('./inspector');

(async () => {
    const a = await Runtime.evaluate({
        expression : 'var a = 5 ;(function test() { a = [12,4,5].sort() ; return a })(',
        generatePreview: true,
        // throwOnSideEffect : true,
    });

    console.log(a.result);
    // console.log(a.result.preview.properties);
})();