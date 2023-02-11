class Schedule {
  /** @private */
  static dayMs = 86400000;
  /** @private */
  static triggerRow = 1;
  /** @private */
  static triggerColumn = 9;

  /**
   * @param {Spreadsheet.Sheet} sheet
   */
  constructor(sheet) {
    /** @private */
    this.sheet = sheet;
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
   * Convert a date to a specified timezone
   *
   * @private
   * @param {Date} date
   * @param {string} timeZone
   * @returns {Date}
   */
  static tzDate(date, timeZone) {
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
   * @private
   * @returns {Date}
   */
  static getNow() {
    return new Date();
  }

  /**
   * Calculate next meeting date
   *
   * @returns {Date | null}
   */
  getNextMeeting() {
    const scheduleData = this.getScheduleData();
    if (!scheduleData) return null;

    let now = this.constructor.getNow();
    if (now < scheduleData.startPoint) {
      now = scheduleData.startPoint;
    }

    const startDay = Math.floor((now.getTime() - scheduleData.startPoint.getTime()) / this.constructor.dayMs) % scheduleData.schedule.length;

    const scheduleCarousel = [...scheduleData.schedule.slice(startDay), ...scheduleData.schedule.slice(0, startDay)];
    let dayShift = 0;
    for (const day of scheduleCarousel) {
      if (day) {
        const date = new Date(now.getTime() + dayShift);
        date.setHours(scheduleData.timeAt.getHours(), scheduleData.timeAt.getMinutes(), scheduleData.timeAt.getSeconds(), scheduleData.timeAt.getMilliseconds());
        const dateAt = this.constructor.tzDate(date, scheduleData.timeZone);

        if (dateAt > now) return dateAt;
      }

      dayShift += this.constructor.dayMs;
    }
  }
  /**
   * Return a range where trigger UID is stored
   *
   * @returns {SpreadsheetApp.Range}
   */
  getTriggerRange() {
    return /** @type {SpreadsheetApp.Range} */ this.sheet.getRange(this.constructor.triggerRow, this.constructor.triggerColumn);
  }

  /**
   * Retrieve trigger UID from a sheet
   *
   * @returns {string}
   */
  getTriggerUid() {
    return this.getTriggerRange().getValue().toString();
  }

  /**
   * Store trigger UID to a sheet
   *
   * @param {string} triggerUid
   */
  setTriggerUid(triggerUid) {
    this.getTriggerRange().setValue(triggerUid);
  }

  /**
   * Delete trigger UID from a sheet
   */
  deleteTriggerUid() {
    this.getTriggerRange().clearContent();
  }
}


function debugGetNextMeeting() {
  const sheet = SpreadsheetApp.getActive().getSheets()[1];
  const schedule = new Schedule(sheet);
  const nextMeeting = schedule.getNextMeeting();
  console.log(nextMeeting);
}
