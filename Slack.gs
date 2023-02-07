/**
 * @returns {Object}
 */
function getScriptProperties() {
  return PropertiesService.getScriptProperties().getProperties();
}


/**
 * @param {string} path
 * @returns {string}
 */
function apiUrl(path) {
  return "https://slack.com/api/" + path;
}


/**
 * @param {string} token
 * @param {Object} [data]
 * @returns {Object}
 */
function prepareFetchParams(token, data) {
  let params = {
    contentType: "application/json; charset=utf-8",
    headers: {Authorization: "Bearer " + token},
  };
  return {...params, ...data};
}


/**
 * @param {string} url
 * @param {string} token
 * @param {Object} data
 */
function post(url, token, data) {
  let params = prepareFetchParams(
    token,
    {
      method: "post",
      payload: JSON.stringify(data),
    }
  );

  UrlFetchApp.fetch(url, params);
}


/**
 * @param {string} path
 * @param {string} token
 * @param {Object} data
 */
function postApi(path, token, data) {
  let url = apiUrl(path);
  post(url, token, data);
}


/**
 * @param {string} path
 * @param {string} argString
 * @param {string} token
 * @returns {Object[]}
 */
function getApi(path, argString, token) {
  let url = apiUrl(path) + argString;
  let params = prepareFetchParams(token);

  let response = UrlFetchApp.fetch(url, params);
  return JSON.parse(response);
}


/**
 * @param {string} channelId
 * @param {string} token
 * @param {string} [nextCursor]
 * @returns {Object[]}
 */
function readHistory(channelId, token, nextCursor) {
  let argString = "?channel=" + channelId;
  if (nextCursor) {
    argString += "&cursor=" + nextCursor;
  }

  return getApi("conversations.history", argString, token);
}


/**
 * @param {string} channelId
 * @returns {Object[]}
 */
function getMembers(channelId) {
  let props = getScriptProperties();

  let argString = "?channel=" + channelId;
  return getApi("conversations.members", argString, props.SLACK_TOKEN).members;
}


/**
 * @typedef {Object} User
 * @property {string} real_name
 * @property {boolean} is_bot
 */


/**
 * @param {string} userId
 * @returns {User}
 */
function getUserInfo(userId) {
  let props = getScriptProperties();

  return getApi("users.info", "?user=" + userId, props.SLACK_TOKEN).user;
}


/**
 * @param {string} channelId
 * @param {string} token
 * @param {string} appId
 */
function disarmLastMessage(channelId, token, appId) {
  let nextCursor;

  for (let repeat = 0; repeat < 10; repeat++) {
    let history = readHistory(channelId, token, nextCursor);

    if (!history.messages) return;

    for (let message of history.messages) {
      if (message.app_id === appId) {
        let data = {
          channel: channelId,
          ts: message.ts,
          blocks: removeActions(message.blocks),
        }

        postApi("chat.update", token, data);
        return;
      }
    }

    if (!history.has_more) break;

    nextCursor = history.response_metadata.next_cursor;
  }
}


/**
 * @param {Host} next
 * @param {Host} afterNext
 * @param {boolean} [markdown]
 */
function composeText(next, afterNext, markdown) {
  let nextName = markdown ? `<@${next.slackId}>` : next.name;
  let messageLines = [
    "Hello!",
    `This is a friendly reminder that ${nextName} is hosting today's stand-up meeting${markdown ? "" : "."}`,
  ]

  if (afterNext) {
    let nextAfterName = markdown ? `*${afterNext.name}*` : afterNext.name;
    let suffix = afterNext.name.endsWith("s") ? "" : "s";
    let footer = `Next time it's ${nextAfterName}'${suffix} turn`;
    if (markdown) {
      messageLines.push(`_${footer}_`);
    } else {
      messageLines.push(footer);
    }
  }

  return messageLines.join(markdown ? "\n\n": " ");
}


/**
 * @param {Object[]} blocks
 * @param {string} blocks[].type
 * @returns {Object[]}
 */
function removeActions(blocks) {
  return blocks.filter(function (value) {return value.type !== "actions"});
}


/**
 * @param {Object} message
 * @param {Object[]} message.blocks
 * @param {string} responseUrl
 */
function markMessageSkipped(message, responseUrl) {
  let props = getScriptProperties();

  let blocks = removeActions(message.blocks);
  blocks.push(
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*` Skipped `*",
      },
    },
  );

  let data = {
    blocks,
    replace_original: true,
  };

  post(responseUrl, props.SLACK_TOKEN, data);
}


/**
 * @param {Host} next
 * @param {Host} afterNext
 * @param {Object} params
 * @param {string} [params.channelId]
 * @param {string} [params.responseUrl]
 */
function postMessage(next, afterNext, params) {
  let props = getScriptProperties();

  let data = {
    text: composeText(next, afterNext),
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: composeText(next, afterNext, true),
        },
      },
      {
        type: "actions",
        elements: [
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Skip the meeting",
            },
            style: "danger",
            confirm: {
              title: {
                  type: "plain_text",
                  text: "Skip the meeting",
              },
              text: {
                  type: "plain_text",
                  text: "Re-select today's host for the next meeting?",
              },
              confirm: {
                  type: "plain_text",
                  text: "Yes",
              },
              deny: {
                  type: "plain_text",
                  text: "No",
              },
            },
            action_id: "skip-meeting",
          },
          {
            type: "button",
            text: {
              type: "plain_text",
              text: "Next host",
            },
            style: "primary",
            confirm: {
              title: {
                  type: "plain_text",
                  text: "Next host"
              },
              text: {
                  type: "plain_text",
                  text: "Select a new host for today's meeting?",
              },
              confirm: {
                  type: "plain_text",
                  text: "Yes",
              },
              deny: {
                  type: "plain_text",
                  text: "No",
              },
            },
            action_id: "next-host",
          }
        ]
      }
    ]
  };

  if (params.responseUrl) {
    data.replace_original = true;
    post(params.responseUrl, props.SLACK_TOKEN, data);
  } else if (params.channelId) {
    disarmLastMessage(params.channelId, props.SLACK_TOKEN, props.SLACK_APP_ID);
    data.channel = params.channelId;
    postApi("chat.postMessage", props.SLACK_TOKEN, data);
  }
}


/**
 * @param {string} channelId
 */
function joinChannel(channelId) {
  let props = getScriptProperties();

  let data = {
    channel: channelId,
  }

  postApi("conversations.join", props.SLACK_TOKEN, data);
}


/**
 * @param {string} channelId
 * @returns {boolean}
 */
function checkChannel(channelId) {
  let props = getScriptProperties();

  let result = getApi("conversations.info", "?channel=" + channelId, props.SLACK_TOKEN);
  return result.ok;
}


function debugGetMembers() {
  let sheet = SpreadsheetApp.getActive().getSheets()[1];
  console.log(getMembers(sheet.getName()));
}


function debugGetUserName() {
  let sheet = SpreadsheetApp.getActive().getSheets()[1];
  let userId = sheet.getRange(1, 2).getValue();
  console.log(getUserName(userId));
}
