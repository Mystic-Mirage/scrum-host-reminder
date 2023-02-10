/**
 * Get Monday date of the current week
 *
 * @returns {Date}
 */
function getStartOfWeek() {
  let date = new Date();
  let day = date.getDay();
  let diff = date.getDate() - day + (day === 0 ? -6 : 1);
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
  let spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.insertSheet();
  sheet.protect().setDomainEdit(false);
  let totalSheets = spreadsheet.getNumSheets();
  spreadsheet.moveActiveSheet(totalSheets);
  sheet.setName(channelId);

  sheet.setColumnWidth(1, 200);
  sheet.setColumnWidth(4, 150);
  sheet.getRange(1, 4, sheet.getMaxRows()).setNumberFormat("yyyy-mm-dd hh:mm:ss")
  sheet.setColumnWidth(5, 20);

  sheet.getRange(1, 5, sheet.getMaxRows()).setBackground("#efefef");

  let startOfWeek = getStartOfWeek();
  sheet.getRange(1, 6).setNumberFormat("yyyy-mm-dd").setValue(startOfWeek);
  sheet.getRange(1, 7).setNumberFormat("hh:mm");

  let dateTimeRange = sheet.getRange(1, 6, 1, 2);
  let dateTimeValidation = SpreadsheetApp.newDataValidation()
    .requireDate()
    .setAllowInvalid(false)
    .build();
  dateTimeRange.setDataValidation(dateTimeValidation);

  let tzRangeSource = spreadsheet.getRange(`${TIMEZONES_SHEET_NAME}!A:A`);
  let tzValidation = SpreadsheetApp.newDataValidation()
    .requireValueInRange(tzRangeSource, false)
    .setAllowInvalid(false)
    .build();
  sheet.getRange(1, 8).setDataValidation(tzValidation).setValue("UTC");

  let scheduleDataFormatting = SpreadsheetApp.newConditionalFormatRule()
    .whenCellEmpty()
    .setBackground("#f4cccc")
    .setRanges([sheet.getRange(1, 6, 1, 3)])
    .build();
  sheet.setConditionalFormatRules([scheduleDataFormatting]);

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

  getTriggerRange(sheet).protect().setWarningOnly(true);

  sheet.getRange(2, 6, 2, 7)
    .insertCheckboxes()
    .setValues(
      [
        [true, true, true, true, true, false, false],
        [true, true, true, true, true, false, false],
      ]
    );

  let members = getMembers(channelId);
  if (members) {
    let rowIndex = 0;
    for (let userId of members) {
      let user = getUserInfo(userId);
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
  let ui = SpreadsheetApp.getUi();
  let result = ui.prompt("Enter Slack channel ID");
  let channelId = result.getResponseText();

  if (!channelId) return;

  if (!checkChannel(channelId)) {
    ui.alert("Wrong channel ID", "Note: add the bot first if a channel is private", ui.ButtonSet.OK);
    return;
  }

  newSheet(channelId);
  joinChannel(channelId);
}


/**
 * Re-read member list menu item handler
 */
function reReadMembers() {
  let ui = SpreadsheetApp.getUi();
  let sheet = SpreadsheetApp.getActive().getActiveSheet();
  let sheetName = sheet.getName();

  if (sheetName === TIMEZONES_SHEET_NAME) {
    ui.alert(`You cannot do this with "${TIMEZONES_SHEET_NAME}"!`);
    return;
  }

  let result = ui.alert("Confirm", "Re-read the channel members?", ui.ButtonSet.YES_NO);

  if (result === ui.Button.NO) return;

  let hosts = getHosts(sheet);
  let members = getMembers(sheetName);

  sheet.getRange(1, 1, sheet.getMaxRows(), 4).clear().removeCheckboxes();

  let rowIndex = 0;
  for (let userId of members) {
    let host = hosts.find((host) => host.slackId === userId);
    if (host) {
      rowIndex++;
      sheet.getRange(rowIndex, 3).insertCheckboxes();
      sheet.getRange(rowIndex, 1, 1, 4).setValues([[host.name, host.slackId, host.active, host.timestamp]]);
    } else {
      let user = getUserInfo(userId);
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
  let ui = SpreadsheetApp.getUi();

  let spreadsheet = SpreadsheetApp.getActive();
  let sheet = spreadsheet.getActiveSheet();
  let sheetName = sheet.getName();

  if (sheetName === TIMEZONES_SHEET_NAME) {
    ui.alert(`You cannot delete "${TIMEZONES_SHEET_NAME}"!`);
    return;
  }

  let result = ui.alert("Confirm", "Are you sure you want to delete the channel?", ui.ButtonSet.YES_NO);
  if (result === ui.Button.NO) return;

  let channelId = ui.prompt("Confirm by entering channel ID", ).getResponseText();
  if (!channelId) return;

  if (sheetName !== channelId) return;

  let triggerRange = getTriggerRange(sheet);
  deleteTrigger(triggerRange.getValue().toString());
  triggerRange.clearContent();

  spreadsheet.deleteSheet(sheet);
  disarmLastMessageUi(channelId);
  leaveChannel(channelId);
}


/**
 * Create a menu on spreadsheet open
 */
function onOpen() {
  let ui = SpreadsheetApp.getUi();
  ui.createMenu("Scrum Host Reminder")
    .addItem("Add Slack channel", addChannel.name)
    .addSeparator()
    .addItem("Re-read the channel members", reReadMembers.name)
    .addSeparator()
    .addItem("Delete current channel", deleteSheet.name)
    .addToUi();
}
