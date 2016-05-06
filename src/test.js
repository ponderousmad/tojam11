var TEST = (function () {
    "use strict";
    
    var TEST = {},
        catchExceptions = false;
    
    TEST.contains = function (list, item) {
        for (var i = 0; i < list.length; ++i) {
            if (list[i] == item) {
                return true;
            }
        }
        return false;
    };
    
    function AssertException(message) {
        this.message = message;
    }
    
    AssertException.prototype.toString = function() {
        return this.message;
    };
    
    function fail() { throw new AssertException("Assertion Failure"); }
    TEST.fail = fail;
    TEST.isTrue = function (value) { if (!value) { fail(); } };
    TEST.isFalse = function (value) { if (value) { fail(); } };
    TEST.isNull = function (value) { if (value !== null) { fail(); } };
    TEST.notNull = function (value) { if (value === null) { fail(); } };
    TEST.equals = function (a, b) { TEST.isTrue(a === b); };
    TEST.same = function (a, b) { TEST.isTrue(a == b); };
    TEST.notSame = function (a, b) { TEST.isFalse(a == b); };
    TEST.isEmpty = function (list) { TEST.equals(list.length, 0); };
    TEST.inList = function (list, item) { return TEST.isTrue(TEST.contains(list, item)); };
    
    TEST.run  = function (name, tests) {
        console.log("Running " + name + " Tests");
        if (!Array.isArray(tests)) {
            tests = [tests];
        }
        for (var t = 0; t < tests.length; ++t) {
            var test = tests[t];
            if (catchExceptions) {
                try {
                    test();
                } catch(e) {
                    console.log("Failed " + test.name + ":");
                    console.log(e);
                }
            } else {
                test();
            }
        }
    };
    
    TEST.INCLUDE_SLOW = false;
    
    return TEST;
}());
