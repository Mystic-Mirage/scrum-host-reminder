const SCHEDULE_CACHE_KEY = "schedule-data";


/**
 * @returns {Object}
 */
function getSchedule() {
  let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("schedule");
  let rows = sheet.getDataRange().getValues();

  let [startPoint, timeAt, timeZone] = rows[0];

  let schedule = [];
  for (let i = 1; i < rows.length; i++) {
    schedule.push(...rows[i]);
  }

  return {startPoint, timeAt, timeZone, schedule};
}


/**
 * @returns {Object}
 */
function getScheduleCached() {
  let cache = CacheService.getScriptCache();
  let cached = cache.get(SCHEDULE_CACHE_KEY);

  if (cached === null) {
    var schedule = getSchedule();
    cache.put(SCHEDULE_CACHE_KEY, JSON.stringify(schedule));
  } else {
    var schedule = JSON.parse(cached);
    schedule.startPoint = new Date(schedule.startPoint);
    schedule.timeAt = new Date(schedule.timeAt);
  }

  return schedule;
}


/**
 * @param {Date} now
 * @param {Date} startPoint
 * @param {boolean[]} schedule
 * @returns {boolean}
 */
function isDay(now, startPoint, schedule) {
  let days = Math.floor((now.getTime() - startPoint.getTime()) / 86400000);
  let day = days % schedule.length;
  let active = schedule[day];
  return active;
}


/**
 * @param {Date} now
 * @param {Date} timeAt
 * @param {string} timeZone
 * @returns {boolean}
 */
function isTime(now, timeAt, timeZone) {
  let nowTz = new Date(now.toLocaleString("en-UK", {timeZone: timeZone}));
  return timeAt.getHours() === nowTz.getHours() && timeAt.getMinutes() === nowTz.getMinutes();
}


/**
 * @returns {boolean}
 */
function isMeetingTime() {
  let now = new Date();

  let schedule = getScheduleCached();

  let dayMatch = isDay(now, schedule.startPoint, schedule.schedule);
  let timeMatch = isTime(now, schedule.timeAt, schedule.timeZone);
  let meetingTime = dayMatch && timeMatch;

  return meetingTime;
}
