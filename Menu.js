/**
 * Get Monday date of the current week
 *
 * @returns {Date}
 */
function getStartOfWeek() {
  const date = new Date();
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);

  return date;
}

/**
 * Create, fill and format a new sheet
 *
 * @param {string} channelId
 */
function newSheet(channelId) {
  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = spreadsheet.insertSheet();
  sheet.protect().setDomainEdit(false);
  const totalSheets = spreadsheet.getNumSheets();
  spreadsheet.moveActiveSheet(totalSheets);
  sheet.setName(channelId);

  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(4, 150);

  const timestampRange = sheet.getRange(1, 4, sheet.getMaxRows());
  timestampRange.setNumberFormat("yyyy-mm-dd hh:mm:ss");
  const timestampFormatting = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied("=D:D=MAX(FILTER(D:D,C:C))")
    .setBackground("#b7e1cd")
    .setRanges([timestampRange])
    .build();

  sheet.setColumnWidth(5, 20);
  sheet.getRange(1, 5, sheet.getMaxRows()).setBackground("#efefef");

  const startOfWeek = getStartOfWeek();
  sheet.getRange(1, 6).setNumberFormat("yyyy-mm-dd").setValue(startOfWeek);
  sheet.getRange(1, 7).setNumberFormat("hh:mm");

  const dateTimeRange = sheet.getRange(1, 6, 1, 2);
  const dateTimeValidation = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .build();
  dateTimeRange.setDataValidation(dateTimeValidation);

  const tzRangeSource = spreadsheet.getRange(`${TIMEZONES_SHEET_NAME}!A:A`);
  const tzValidation = SpreadsheetApp.newDataValidation()
    .requireValueInRange(tzRangeSource, false)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(1, 8).setDataValidation(tzValidation).setValue("UTC");

  const scheduleDataFormatting = SpreadsheetApp.newConditionalFormatRule()
    .whenCellEmpty()
    .setBackground("#f4cccc")
    .setRanges([sheet.getRange(1, 6, 1, 3)])
    .build();

  sheet.setConditionalFormatRules([timestampFormatting, scheduleDataFormatting]);

  sheet.getRange(1, 6, 1, 4).setNotes(
    [
      [
        "Start point\n\nThe starting date of the schedule",
        "Meeting time",
        "Meeting timezone",
        "!!! DO NOT REMOVE !!!\n\nStored trigger UID"
      ]
    ]
  );

  new Schedule(sheet).triggerRange.protect().setWarningOnly(true);

  sheet.getRange(2, 6, 2, 7)
    .insertCheckboxes()
    .setValues(
      [
        [true, true, true, true, true, false, false],
        [true, true, true, true, true, false, false],
      ]
    );

  const slack = new Slack();

  const members = slack.getMembers(channelId);
  if (members) {
    let rowIndex = 0;
    for (const userId of members) {
      const user = slack.getUserInfo(userId);
      if (!user.is_bot) {
        rowIndex++;
        sheet.getRange(rowIndex, 3).insertCheckboxes();
        sheet.getRange(rowIndex, 1, 1, 4).setValues([[user.real_name, userId, false, new Date()]]);
      }
    }
  }

  sheet.getRange(1, 1, sheet.getMaxRows(), 4).sort(1);
}

/**
 * Add new channel menu item handler
 */
function addChannel() {
  const ui = SpreadsheetApp.getUi();
  const result = ui.prompt("Enter Slack channel ID");
  const channelId = result.getResponseText();

  if (!channelId) return;

  const slack = new Slack();

  if (!slack.checkChannel(channelId)) {
    ui.alert("Wrong channel ID", "Note: add the bot first if a channel is private", ui.ButtonSet.OK);
    return;
  }

  newSheet(channelId);
  slack.joinChannel(channelId);
}

/**
 * Re-read member list menu item handler
 */
function reReadMembers() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActive().getActiveSheet();
  const sheetName = sheet.getName();
  const channelId = sheetName;

  if (sheetName === TIMEZONES_SHEET_NAME) {
    ui.alert(`You cannot do this with "${TIMEZONES_SHEET_NAME}"!`);
    return;
  }

  const result = ui.alert("Confirm", "Re-read the channel members?", ui.ButtonSet.YES_NO);

  if (result === ui.Button.NO) return;

  const slack = new Slack();
  const members = slack.getMembers(channelId);

  const hosts = new Hosts(sheet).all;

  sheet.getRange(1, 1, sheet.getMaxRows(), 4).clearContent().removeCheckboxes();

  let rowIndex = 0;
  for (const userId of members) {
    const host = hosts.find((host) => host.slackId === userId);
    if (host) {
      rowIndex++;
      sheet.getRange(rowIndex, 3).insertCheckboxes();
      sheet.getRange(rowIndex, 1, 1, 4).setValues([[host.name, host.slackId, host.active, host.timestamp]]);
    } else {
      const user = slack.getUserInfo(userId);
      if (!user.is_bot) {
        rowIndex++;
        sheet.getRange(rowIndex, 3).insertCheckboxes();
        sheet.getRange(rowIndex, 1, 1, 4).setValues([[user.real_name, userId, false, new Date()]]);
      }
    }
  }

  sheet.getRange(1, 1, sheet.getMaxRows(), 4).sort(1);
}

/**
 * Delete sheet menu item handler
 */
function deleteSheet() {
  const ui = SpreadsheetApp.getUi();

  const spreadsheet = SpreadsheetApp.getActive();
  const sheet = spreadsheet.getActiveSheet();
  const sheetName = sheet.getName();

  if (sheetName === TIMEZONES_SHEET_NAME) {
    ui.alert(`You cannot delete "${TIMEZONES_SHEET_NAME}"!`);
    return;
  }

  const result = ui.alert("Confirm", "Are you sure you want to delete the channel?", ui.ButtonSet.YES_NO);
  if (result === ui.Button.NO) return;

  const channelId = ui.prompt("Confirm by entering channel ID", ).getResponseText();
  if (!channelId) return;

  if (sheetName !== channelId) return;

  const schedule = new Schedule(sheet);
  new Trigger(schedule.getTriggerUid()).delete();
  schedule.deleteTriggerUid();

  spreadsheet.deleteSheet(sheet);

  const slack = new Slack();
  slack.disarmLastMessage(channelId);
  slack.leaveChannel(channelId);
}
