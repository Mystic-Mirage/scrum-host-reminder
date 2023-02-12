const dayMs = 86400000;
const [triggerRow, triggerColumn] = [1, 9];

/**
 * Convert a date to a specified timezone
 *
 * @param {Date} date
 * @param {string} timeZone
 * @returns {Date}
 */
function tzDate(date, timeZone) {
  const newDate = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), date.getMinutes(), date.getSeconds(), date.getMilliseconds()));

  const utcDate = new Date(newDate.toLocaleString("en-US", {timeZone: "UTC"}));
  const tzDate = new Date(newDate.toLocaleString("en-US", {timeZone: timeZone}));
  const offset = utcDate.getTime() - tzDate.getTime();

  newDate.setTime(newDate.getTime() + offset);

  return newDate;
}

/**
 * Get current date
 * Separate method to mock it in tests
 *
 * @returns {Date}
 */
function getNow() {
  return new Date();
}

class Schedule {
  /**
   * @param {SpreadsheetApp.Sheet} sheet
   */
  constructor(sheet) {
    /** @private */
    this.sheet = sheet;
    this.triggerRange = sheet && this.sheet.getRange(triggerRow, triggerColumn);
  }

  /**
   * Retrieve schedule data from a sheet
   *
   * @private
   * @returns {{startPoint: Date, timeAt: Date, timeZone: string, schedule: boolean[]} | null}
   */
  getScheduleData() {
    const rows = this.sheet.getDataRange().getValues();
    const [startPoint, timeAt, timeZone] = rows[0].slice(5);

    if (!(startPoint && timeAt && timeZone)) return null;

    const schedule = [];
    for (const row of rows.slice(1)) {
      const days = row.slice(5);

      if (days[0] === "") break;

      schedule.push(...days);
    }

    return {startPoint, timeAt, timeZone, schedule};
  }

  /**
   * Calculate next meeting date
   *
   * @returns {Date | null}
   */
  getNextMeeting() {
    const scheduleData = this.getScheduleData();
    if (!scheduleData) return null;

    let now = getNow();
    if (now < scheduleData.startPoint) {
      now = scheduleData.startPoint;
    }

    const startDay = Math.floor((now.getTime() - scheduleData.startPoint.getTime()) / dayMs) % scheduleData.schedule.length;

    const scheduleCarousel = [...scheduleData.schedule.slice(startDay), ...scheduleData.schedule.slice(0, startDay)];
    let dayShift = 0;
    for (const day of scheduleCarousel) {
      if (day) {
        const date = new Date(now.getTime() + dayShift);
        date.setHours(scheduleData.timeAt.getHours(), scheduleData.timeAt.getMinutes(), scheduleData.timeAt.getSeconds(), scheduleData.timeAt.getMilliseconds());
        const dateAt = tzDate(date, scheduleData.timeZone);

        if (dateAt > now) return dateAt;
      }

      dayShift += dayMs;
    }
  }

  /**
   * Retrieve trigger UID from a sheet
   *
   * @returns {string}
   */
  getTriggerUid() {
    return this.triggerRange.getValue().toString();
  }

  /**
   * Store trigger UID to a sheet
   *
   * @param {string} triggerUid
   */
  setTriggerUid(triggerUid) {
    this.triggerRange.setValue(triggerUid);
    SpreadsheetApp.flush();
  }

  /**
   * Delete trigger UID from a sheet
   */
  deleteTriggerUid() {
    this.triggerRange.clearContent();
    SpreadsheetApp.flush();
  }
}

function debugGetNextMeeting() {
  const sheet = SpreadsheetApp.getActive().getSheets()[1];
  const schedule = new Schedule(sheet);
  const nextMeeting = schedule.getNextMeeting();
  console.log(nextMeeting);
}
