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


/**
 * @param {string} startPoint
 * @returns {ScheduleData}
 */
function scheduleData(startPoint) {
    return {
        startPoint: new Date(startPoint),
        timeAt: new Date("1900-01-01 11:00"),
        timeZone: "Europe/Kiev",
        triggerUid: "",
        schedule: [true, true, true, true, true, false, false],
    }
}


/**
 * @typedef NextMeetingParam
 * @property {string} desc
 * @property {ScheduleData} scheduleData
 * @property {Date} now
 * @property {Date} expected
 */



/**
 * @param {string} desc
 * @param {string} startPoint
 * @param {string} now
 * @param {string} expected
 * @returns {NextMeetingParam}
 */
function getNextMeetingParam(desc, startPoint, now, expected) {
    return {
        desc,
        scheduleData: scheduleData(startPoint),
        now: new Date(now),
        expected: new Date(expected),
    }
}


let getNextMeetingParams = [
    getNextMeetingParam(
        "should be today if current time is before today's meeting time",
        "2023-02-06 00:00",
        "2023-02-06 01:23:45+00:00",
        "2023-02-06 11:00+02:00",
    ),
    getNextMeetingParam(
        "should be next day if current time is after today's meeting time",
        "2023-02-06 00:00",
        "2023-02-06 10:23:45+00:00",
        "2023-02-07 11:00+02:00",
    ),
    getNextMeetingParam(
        "should be next week if current time is before a weekend",
        "2023-02-06 00:00",
        "2023-02-10 09:00:01+00:00",
        "2023-02-13 11:00+02:00",
    ),
    getNextMeetingParam(
        "should be at the same time if current time is before daylight saving change",
        "2023-02-06 00:00",
        "2023-03-31 09:00:01+00:00",
        "2023-04-03 11:00+03:00",
    ),
    getNextMeetingParam(
        "should be next day if start point in the middle of a day and current time is before it",
        "2023-02-06 12:00",
        "2023-02-06 07:00+00:00",
        "2023-02-07 11:00+02:00",
    ),
    getNextMeetingParam(
        "should be next day if start point in the middle of a day and current time is after it",
        "2023-02-06 12:00",
        "2023-02-06 13:00+00:00",
        "2023-02-07 11:00+02:00",
    ),
    getNextMeetingParam(
        "should be today if start point in the middle of a day and current time is the next day after it before meeting time",
        "2023-02-06 12:00",
        "2023-02-07 07:00+00:00",
        "2023-02-07 11:00+02:00",
    ),
    getNextMeetingParam(
        "should be on start point if start point in the future and current time is before meeting time",
        "2023-02-13 00:00",
        "2023-02-06 08:32+00:00",
        "2023-02-13 11:00+02:00",
    ),
    getNextMeetingParam(
        "should be on start point if start point in the future and current time is after meeting time",
        "2023-02-13 00:00",
        "2023-02-06 12:48+00:00",
        "2023-02-13 11:00+02:00",
    ),
]


describe(getNextMeeting.name, function () {
    itParam("${value.desc}", getNextMeetingParams, function (value) {
        Schedule.__with__({"getNow": () => value.now})(function () {
            assert.deepStrictEqual(getNextMeeting(value.scheduleData), value.expected);
        });
    });
});
