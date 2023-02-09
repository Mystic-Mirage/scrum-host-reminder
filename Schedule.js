const DAY_MS = 86400000;


/**
 * @typedef {Object} ScheduleData
 * @property {Date} startPoint
 * @property {Date} timeAt
 * @property {string} timeZone
 * @property {string} triggerUid
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
  for (let row of rows.slice(1)) {
    row = row.slice(5);
    if (row[0] === "") {
      break;
    }
    schedule.push(...row);
  }

  return {startPoint, timeAt, timeZone, triggerUid, schedule};
}


/**
 * @param {Date} date
 * @param {string} timeZone
 * @returns {Date}
 */
function tzDate(date, timeZone) {
  let newDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()));

  let utcDate = new Date(newDate.toLocaleString("en-US", {timeZone: "UTC"}));
  let tzDate = new Date(newDate.toLocaleString("en-US", {timeZone: timeZone}));
  let offset = utcDate.getTime() - tzDate.getTime();

  newDate.setTime(newDate.getTime() + offset);

  return newDate;
}


/**
 * @returns {Date}
 */
function getNow() {
  return new Date();
}


/**
 * @param {ScheduleData} scheduleData
 * @returns {Date}
 */
function getNextMeeting(scheduleData) {
  if (!(scheduleData.startPoint && scheduleData.timeAt && scheduleData.timeZone)) return;

  let now = getNow();
  if (now < scheduleData.startPoint) now = scheduleData.startPoint;

  let startDay = Math.floor((now.getTime() - scheduleData.startPoint.getTime()) / DAY_MS) % scheduleData.schedule.length;

  let schedule = [...scheduleData.schedule.slice(startDay), ...scheduleData.schedule.slice(0, startDay)];
  let dayShift = 0;
  for (let day of schedule) {
    if (day) {
      let date = new Date(now.getTime() + dayShift);
      date.setHours(scheduleData.timeAt.getHours(), scheduleData.timeAt.getMinutes(), 0, 0);
      let dateAt = tzDate(date, scheduleData.timeZone);

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
