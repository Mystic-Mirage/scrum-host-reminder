let assert = require("assert");

let itParam = require("mocha-param");
let rewire = require("rewire");

let Schedule = rewire("../Schedule.js");
let tzDate = Schedule.__get__("tzDate");
let getNextMeeting = Schedule.__get__("getNextMeeting");


describe(tzDate.name, function () {
    it("should be 01:00 (UTC) when 03:00 (Kyiv) in Winter", function () {
        assert.deepStrictEqual(tzDate(new Date("2023-02-06 03:00"), "Europe/Kiev"), new Date("2023-02-06 01:00+00:00"));
    });

    it("should be 00:00 (UTC) when 03:00 (Kyiv) in Summer", function () {
        assert.deepStrictEqual(tzDate(new Date("2023-07-17 03:00"), "Europe/Kiev"), new Date("2023-07-17 00:00+00:00"));
    });
});


let schedule = [true, true, true, true, true, false, false];
let data = [
    [
        {
            startPoint: new Date("2023-02-06 00:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-06 01:23:45"),
        new Date("2023-02-06 09:00+00:00"),
    ],
    [
        {
            startPoint: new Date("2023-02-06 00:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-10 11:00:01"),
        new Date("2023-02-13 09:00+00:00"),
    ],
    [
        {
            startPoint: new Date("2023-02-06 00:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-03-31 11:00:01"),
        new Date("2023-04-03 08:00+00:00"),
    ],
    [
        {
            startPoint: new Date("2023-02-06 12:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-06 09:00"),
        new Date("2023-02-07 11:00"),
    ],
    [
        {
            startPoint: new Date("2023-02-06 12:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-06 13:00"),
        new Date("2023-02-07 11:00"),
    ],
    [
        {
            startPoint: new Date("2023-02-06 12:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-07 09:00"),
        new Date("2023-02-07 11:00"),
    ],
    [
        {
            startPoint: new Date("2023-02-13 00:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-06 08:32"),
        new Date("2023-02-13 11:00"),
    ],
    [
        {
            startPoint: new Date("2023-02-13 00:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-06 12:48"),
        new Date("2023-02-13 11:00"),
    ],
]


describe(getNextMeeting.name, function () {
    itParam("should be ${value[2]}", data, function (value) {
        Schedule.__with__({"getNow": () => value[1]})(function () {
            assert.deepStrictEqual(getNextMeeting(value[0]), value[2]);
        });
    });
});
