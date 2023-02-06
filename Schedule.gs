const DAY_MS = 86400000;


/**
 * @typedef {Object} ScheduleData
 * @property {Date} startPoint
 * @property {Date} timeAt
 * @property {string} timeZone
 * @property {number} triggerUid
 * @property {boolean[]} schedule
 */


/**
 * @param {SpreadsheetApp.Sheet} sheet
 * @returns {ScheduleData}
 */
function getScheduleData(sheet) {
  let rows = sheet.getDataRange().getValues();

  let [startPoint, timeAt, timeZone, triggerUid] = rows[0].slice(5);

  let schedule = [];
  for (let i = 1; i < rows.length; i++) {
    let row = rows[i].slice(5);
    if (row[0] === "") {
      break;
    }
    schedule.push(...row);
  }

  return {startPoint, timeAt, timeZone, triggerUid, schedule};
}


/**
 * @param {string} timeZone
 * @param {number} year
 * @param {number} monthIndex
 * @param {number} day
 * @param {number} hour
 * @param {number} minute
 * @returns {Date}
 */
function tzDate(timeZone, year, monthIndex, day, hour, minute) {
  let date = new Date(Date.UTC(year, monthIndex, day, hour, minute));

  let utcDate = new Date(date.toLocaleString("en-US", {timeZone: "UTC"}));
  let tzDate = new Date(date.toLocaleString("en-US", {timeZone: timeZone}));
  let offset = utcDate.getTime() - tzDate.getTime();

  date.setTime(date.getTime() + offset);

  return date;
}


/**
 * @param {ScheduleData} scheduleData
 * @returns {Date}
 */
function getNextMeeting(scheduleData) {
  if (!scheduleData.timeAt) return;

  let now = new Date();
  let startDay = Math.floor((now.getTime() - scheduleData.startPoint.getTime()) / DAY_MS) % scheduleData.schedule.length;

  let schedule = [...scheduleData.schedule, ...scheduleData.schedule];
  let dayShift = 0;
  for (let i = startDay; i < schedule.length; i++) {
    if (schedule[i]) {
      let date = new Date(now.getTime() + dayShift);
      let dateAt = tzDate(scheduleData.timeZone, date.getFullYear(), date.getMonth(), date.getDate(), scheduleData.timeAt.getHours(), scheduleData.timeAt.getMinutes());

      if (dateAt > now) {
        return dateAt;
      }
    }
    dayShift += DAY_MS;
  }
}


function debugGetNextMeeting() {
  let sheet = SpreadsheetApp.getActive().getSheets()[1];
  let scheduleData = getScheduleData(sheet);
  let nextMeeting = getNextMeeting(scheduleData);
  console.log(nextMeeting);
}
