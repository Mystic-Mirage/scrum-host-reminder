const TEMPLATE_SHEET_NAME = "template";

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
 * @returns {SpreadsheetApp.Sheet}
 */
function newSheet(channelId) {
  const spreadsheet = SpreadsheetApp.getActive();
  let sheet;

  const template = spreadsheet.getSheetByName(TEMPLATE_SHEET_NAME);
  if (template) {
    sheet = template.copyTo(spreadsheet).setName(channelId);
    sheet.protect().setDomainEdit(false);
    sheet.getRange(1, 6).setValue(getStartOfWeek());
    spreadsheet.setActiveSheet(sheet);
    return sheet;
  }

  sheet = spreadsheet.insertSheet(channelId, spreadsheet.getNumSheets());
  sheet.protect().setDomainEdit(false);

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
        "Reminder time",
        "Reminder timezone",
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

  return sheet;
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

  const sheet = newSheet(channelId);
  refreshHosts(sheet);
  slack.joinChannel(channelId);
}

/**
 * Re-read member list menu item handler
 */
function reReadMembers() {
  const ui = SpreadsheetApp.getUi();
  const sheet = SpreadsheetApp.getActive().getActiveSheet();
  const sheetName = sheet.getName();

  for (const prohibitedSheetName of [TIMEZONES_SHEET_NAME, TEMPLATE_SHEET_NAME]) {
    if (sheetName === prohibitedSheetName) {
      ui.alert(`You cannot do this with "${prohibitedSheetName}"!`);
      return;
    }
  }

  const result = ui.alert("Confirm", "Re-read the channel members?", ui.ButtonSet.YES_NO);

  if (result !== ui.Button.YES) return;

  refreshHosts(sheet);
}

/**
 * Refresh a channel member list
 *
 * @param {SpreadsheetApp.Sheet} sheet
 */
function refreshHosts(sheet) {
  const slack = new Slack();
  let members = slack.getMembers(sheet.getName());

  const hosts = new Hosts(sheet).all;

  const newHosts = [];
  for (const user of slack.usersList()) {
    if (members.includes(user.id)) {
      const host = hosts.find((host) => host.slackId === user.id);
      if (host) {
        newHosts.push([user.real_name, user.id, host.active, host.timestamp]);
      } else {
        newHosts.push([user.real_name, user.id, false, ""]);
      }
    }

    members = members.filter((userId) => userId !== user.id);
    if (members.length === 0) break;
  }

  newHosts.sort();

  const hostsDiff = newHosts.length - hosts.length;
  if (hostsDiff < 0) {
    sheet.getRange(newHosts.length + 1, 1, -hostsDiff, 4).clearContent().removeCheckboxes();
  } else if (hostsDiff > 0) {
    sheet.getRange(hosts.length + 1, 3, hostsDiff, 1).insertCheckboxes();
  }

  sheet.getRange(1, 1, newHosts.length, 4).setValues(newHosts);
}

/**
 * Delete sheet menu item handler
 */
function deleteChannel() {
  const ui = SpreadsheetApp.getUi();

  const sheet = SpreadsheetApp.getActive().getActiveSheet();
  const sheetName = sheet.getName();

  for (const prohibitedSheetName of [TIMEZONES_SHEET_NAME, TEMPLATE_SHEET_NAME]) {
    if (sheetName === prohibitedSheetName) {
      ui.alert(`You cannot delete "${prohibitedSheetName}"!`);
      return;
    }
  }

  const result = ui.alert("Confirm", "Are you sure you want to delete the channel?", ui.ButtonSet.YES_NO);
  if (result !== ui.Button.YES) return;

  const channelId = ui.prompt("Confirm by entering channel ID").getResponseText();
  if (!channelId) return;

  if (sheetName !== channelId) return;

  deleteSheet(sheet);

  const slack = new Slack();
  slack.disarmLastMessage(channelId);
  slack.leaveChannel(channelId);
}

/**
 * Delete sheet
 *
 * @param {SpreadsheetApp.Sheet} sheet
 */
function deleteSheet(sheet) {
  const schedule = new Schedule(sheet);
  new Trigger(schedule.getTriggerUid()).delete();
  schedule.deleteTriggerUid();

  SpreadsheetApp.getActive().deleteSheet(sheet);
}
