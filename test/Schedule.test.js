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
        "should be today if current time is before today's meeting time",
        {
            startPoint: new Date("2023-02-06 00:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-06 01:23:45+00:00"),
        new Date("2023-02-06 11:00+02:00"),
    ],
    [
        "should be next day if current time is after today's meeting time",
        {
            startPoint: new Date("2023-02-06 00:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-06 10:23:45+00:00"),
        new Date("2023-02-07 11:00+02:00"),
    ],
    [
        "should be next week if current time is before a weekend",
        {
            startPoint: new Date("2023-02-06 00:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-10 09:00:01+00:00"),
        new Date("2023-02-13 11:00+02:00"),
    ],
    [
        "should be at the same time if current time is before daylight saving change",
        {
            startPoint: new Date("2023-02-06 00:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-03-31 09:00:01+00:00"),
        new Date("2023-04-03 11:00+03:00"),
    ],
    [
        "should be next day if start point in the middle of a day and current time is before it",
        {
            startPoint: new Date("2023-02-06 12:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-06 07:00+00:00"),
        new Date("2023-02-07 11:00+02:00"),
    ],
    [
        "should be next day if start point in the middle of a day and current time is after it",
        {
            startPoint: new Date("2023-02-06 12:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-06 13:00+00:00"),
        new Date("2023-02-07 11:00+02:00"),
    ],
    [
        "should be today if start point in the middle of a day and current time is the next day after it before meeting time",
        {
            startPoint: new Date("2023-02-06 12:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-07 07:00+00:00"),
        new Date("2023-02-07 11:00+02:00"),
    ],
    [
        "should be on start point if start point in the future and current time is before meeting time",
        {
            startPoint: new Date("2023-02-13 00:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-06 08:32+00:00"),
        new Date("2023-02-13 11:00+02:00"),
    ],
    [
        "should be on start point if start point in the future and current time is after meeting time",
        {
            startPoint: new Date("2023-02-13 00:00"),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule,
        },
        new Date("2023-02-06 12:48+00:00"),
        new Date("2023-02-13 11:00+02:00"),
    ],
]


describe(getNextMeeting.name, function () {
    itParam("${value[0]}", data, function (value) {
        Schedule.__with__({"getNow": () => value[2]})(function () {
            assert.deepStrictEqual(getNextMeeting(value[1]), value[3]);
        });
    });
});
