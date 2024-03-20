const DAY_MS = 86400000;
const [TRIGGER_ROW, TRIGGER_COLUMN] = [1, 9];

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

/**
 * @typedef ScheduleData
 * @property {Date} startPoint
 * @property {Date} timeAt
 * @property {string} timeZone
 * @property {string} triggerUid
 * @property {boolean[]} schedule
 * @property {boolean[][]} weeks
 */

/**
 * Schedule data processor
 */
class Schedule {
  /**
   * @param {SpreadsheetApp.Sheet} sheet
   */
  constructor(sheet) {
    /** @private */
    this.sheet = sheet;
    this.triggerRange = this.sheet.getRange(TRIGGER_ROW, TRIGGER_COLUMN);
  }

  /**
   * Retrieve schedule data from a sheet
   *
   * @param {false} force
   * @returns {ScheduleData | null}
   *
   * @param {true} force
   * @returns {ScheduleData}
   */
  getScheduleData(force = false) {
    const rows = this.sheet.getDataRange().getValues();
    const [startPoint, timeAt, timeZone, triggerUid] = rows[0].slice(5);

    if (!(force || startPoint && timeAt && timeZone)) return null;

    const schedule = [];
    const weeks = [];
    for (const row of rows.slice(1)) {
      const days = row.slice(5, 12);

      if (days[0] === "") break;

      schedule.push(...days);
      weeks.push(days);
    }

    return {startPoint, timeAt, timeZone, triggerUid, schedule, weeks};
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

    const startDay = Math.floor((now.getTime() - scheduleData.startPoint.getTime()) / DAY_MS) % scheduleData.schedule.length;
    const scheduleCarousel = [...scheduleData.schedule.slice(startDay), ...scheduleData.schedule.slice(0, startDay)];

    let dayShift = 0;
    for (const day of scheduleCarousel) {
      if (day) {
        const date = new Date(now.getTime() + dayShift);
        date.setHours(scheduleData.timeAt.getHours(), scheduleData.timeAt.getMinutes(), scheduleData.timeAt.getSeconds(), scheduleData.timeAt.getMilliseconds());
        const dateAt = tzDate(date, scheduleData.timeZone);

        if (dateAt > now) return dateAt;
      }

      dayShift += DAY_MS;
    }
  }

  /**
   * Retrieve trigger UID from a sheet
   *
   * @returns {string}
   */
  getTriggerUid() {
    return this.triggerRange.getValue().toString().replace(/^'/, "");
  }

  /**
   * Store trigger UID to a sheet
   *
   * @param {string} triggerUid
   */
  setTriggerUid(triggerUid) {
    this.triggerRange.setValue("'" + triggerUid);
    SpreadsheetApp.flush();
  }

  /**
   * Delete trigger UID from a sheet
   */
  deleteTriggerUid() {
    this.triggerRange.clearContent();
    SpreadsheetApp.flush();
  }

  /**
   * Return timezones organized into groups
   *
   * @returns {{[p: string]: {[p: string]: string}}}
   */
  static timeZones() {
    const timezones = {};

    for (const [tz] of SpreadsheetApp.getActive().getSheetByName(TIMEZONES_SHEET_NAME).getDataRange().getValues()) {
      const delimiterIndex = tz.indexOf("/");
      let section, option;
      if (delimiterIndex < 1) {
        section = "Other";
        option = tz;
      } else {
        section = tz.slice(0, delimiterIndex);
        option = tz.slice(delimiterIndex + 1)
      }

      while (Object.keys(timezones[section] || {}).length >= 100) {
        section += " ";
      }

      if (!timezones[section]) {
        timezones[section] = {};
      }

      timezones[section][option.replaceAll("_", " ")] = tz;
    }

    return timezones;
  }

  /**
   * Add a week to a schedule
   *
   * @param {SpreadsheetApp.Sheet} sheet
   */
  static addWeek(sheet) {
    /** @type {SpreadsheetApp.Range} */
    let prev;
    for (let i = 2; i < sheet.getMaxRows(); i++) {
      const range = sheet.getRange(i, 6, 1, 7);
      if (range.getValue() === "") {
        if (prev.getRow()) {
          prev.copyTo(range);
          SpreadsheetApp.flush();
        }
        break;
      }
      prev = range;
    }
  }

  /**
   * Remove a week from a schedule
   *
   * @param {SpreadsheetApp.Sheet} sheet
   */
  static removeWeek(sheet) {
    /** @type {SpreadsheetApp.Range} */
    let prev;
    for (let i = 3; i < sheet.getMaxRows(); i++) {
      const range = sheet.getRange(i, 6, 1, 7);
      if (range.getValue() === "") {
        if (prev) {
          prev.clearContent().removeCheckboxes();
          SpreadsheetApp.flush();
        }
        break;
      }
      prev = range;
    }
  }

  /**
   * Toggle a day of week
   *
   * @param {SpreadsheetApp.Sheet} sheet
   * @param {number} week
   * @param {number} day
   */
  static toggleDay(sheet, week, day) {
    const range = sheet.getRange(week + 2, day + 6);
    if (range.isChecked() !== null) {
      range.setValue(!range.getValue());
      SpreadsheetApp.flush();
    }
  }

  /**
   * Set schedule start point
   *
   * @param {SpreadsheetApp.Sheet} sheet
   * @param {string} value
   */
  static setStartPoint(sheet, value) {
    sheet.getRange(1, 6).setValue(value);
    SpreadsheetApp.flush();
  }

  /**
   * Set reminder time
   *
   * @param {SpreadsheetApp.Sheet} sheet
   * @param {string} [value]
   */
  static setTime(sheet, value) {
    const range = sheet.getRange(1, 7);
    if (value) {
      range.setValue(value);
    } else {
      range.clearContent();
    }
    SpreadsheetApp.flush();
  }

  /**
   * Set reminder timezone
   *
   * @param {SpreadsheetApp.Sheet} sheet
   * @param {string} value
   */
  static setTimeZone(sheet, value) {
    sheet.getRange(1, 8).setValue(value);
    SpreadsheetApp.flush();
  }
}

function debugGetNextMeeting() {
  const sheet = SpreadsheetApp.getActive().getSheets()[1];
  const schedule = new Schedule(sheet);
  const nextMeeting = schedule.getNextMeeting();
  console.log(nextMeeting);
}

function debugAddWeek() {
  const sheet = SpreadsheetApp.getActive().getSheets()[1];
  new Schedule(sheet).addWeek();
}

function debugRemoveWeek() {
  const sheet = SpreadsheetApp.getActive().getSheets()[1];
  new Schedule(sheet).removeWeek();
}

function debugTimezones() {
  console.log(Schedule.timeZones());
}
