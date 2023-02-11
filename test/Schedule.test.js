let assert = require("assert");

let itParam = require("mocha-param");
let rewire = require("rewire");

const ScheduleModule = rewire("../Schedule.js");
/** @type {Class<Schedule>} */
const Schedule = ScheduleModule.__get__("Schedule");
const tzDate = ScheduleModule.__get__("tzDate");


describe(tzDate.name, function () {
    it("should be 01:00 (UTC) when 03:00 (Kyiv) in Winter", function () {
        assert.deepStrictEqual(tzDate(new Date("2023-02-06 03:00"), "Europe/Kiev"), new Date("2023-02-06 01:00+00:00"));
    });

    it("should be 00:00 (UTC) when 03:00 (Kyiv) in Summer", function () {
        assert.deepStrictEqual(tzDate(new Date("2023-07-17 03:00"), "Europe/Kiev"), new Date("2023-07-17 00:00+00:00"));
    });
});


/**
 * @param {string} desc
 * @param {string} startPoint
 * @param {string} now
 * @param {string} expected
 * @returns {{desc: string, scheduleData: Object, now: Date, expected: Date}}
 */
function getNextMeetingParam(desc, startPoint, now, expected) {
    return {
        desc,
        scheduleData: {
            startPoint: new Date(startPoint),
            timeAt: new Date("1900-01-01 11:00"),
            timeZone: "Europe/Kiev",
            schedule: [true, true, true, true, true, false, false],
        },
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


describe(Schedule.prototype.getNextMeeting.name, function () {
    itParam("${value.desc}", getNextMeetingParams, function (value) {
        ScheduleModule.__with__({
            "getNow": () => value.now,
            "Schedule.prototype.getScheduleData": () => value.scheduleData,
        })(function () {
            assert.deepStrictEqual(new Schedule().getNextMeeting(), value.expected);
        });
    });
});
