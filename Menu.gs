function getStartOfWeek() {
  let date = new Date();
  let day = date.getDay();
  let diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  date.setHours(0, 0, 0, 0);

  return date;
}


/**
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

  let tzRangeSource = spreadsheet.getRange("timezones!A:A");
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

  sheet.getRange(...TRIGGER_UID_RANGE).protect().setWarningOnly(true);

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


function reReadMembers() {
  let ui = SpreadsheetApp.getUi();
  let result = ui.alert("Confirm", "Re-read the channel members?", ui.ButtonSet.YES_NO);

  if (result == ui.Button.NO) {
    return;
  }

  let sheet = SpreadsheetApp.getActive().getActiveSheet();
  let hosts = getHosts(sheet);
  let members = getMembers(sheet.getName());

  sheet.getRange(1, 1, sheet.getMaxRows(), 4).clear().removeCheckboxes();

  let rowIndex = 0;
  for (let userId of members) {
    let host = hosts.find(function (value) {return value.slackId === userId});
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


function onOpen() {
  let ui = SpreadsheetApp.getUi();
  ui.createMenu("Scrum Host Reminder")
    .addItem("Add Slack channel", addChannel.name)
    .addItem("Re-read the channel members", reReadMembers.name)
    .addToUi();
}
