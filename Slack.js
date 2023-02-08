/**
 * @typedef {Object} ScriptProperties
 * @property {string} SLACK_APP_ID
 * @property {string} SLACK_TOKEN
 */

/**
 * @returns {ScriptProperties}
 */
function getScriptProperties() {
  return PropertiesService.getScriptProperties().getProperties();
}


/**
 * @param {string} path
 * @returns {string}
 */
function apiUrl(path) {
  return `https://slack.com/api/${path}`;
}


/**
 * @param {string} token
 * @param {Object} [data]
 * @returns {Object}
 */
function prepareFetchParams(token, data) {
  let params = {
    contentType: "application/json; charset=utf-8",
    headers: {
      Authorization: `Bearer ${token}`,
    },
  };
  return {...params, ...data};
}


/**
 * @param {string} token
 * @param {string} url
 * @param {Object} data
 */
function post(token, url, data) {
  let params = prepareFetchParams(
    token,
    {
      method: "post",
      payload: JSON.stringify(data),
    }
  );

  let result = UrlFetchApp.fetch(url, params);
  console.log(result.getContentText());
}


/**
 * @param {string} token
 * @param {string} path
 * @param {Object} data
 */
function postApi(token, path, data) {
  let url = apiUrl(path);
  post(token, url, data);
}


/**
 * @param {Object} data
 * @returns {string}
 */
function getParams(data) {
  let params = Object.entries(data).map(([k, v]) => `${k}=${v}`);
  if (params) {
    return `?${params.join("&")}`;
  }
  return "";
}


/**
 * @param {string} token
 * @param {string} path
 * @param {Object} data
 * @returns {Object[]}
 */
function getApi(token, path, data) {
  let url = apiUrl(path) + getParams(data);
  let params = prepareFetchParams(token);

  let response = UrlFetchApp.fetch(url, params);
  return JSON.parse(response);
}


/**
 * @param {string} token
 * @param {string} channelId
 * @param {string} [nextCursor]
 * @returns {Object}
 */
function readHistory(token, channelId, nextCursor) {
  let data = {
    channel: channelId,
  };
  if (nextCursor) {
    data.cursor = nextCursor;
  }

  return getApi(token, "conversations.history", data);
}


/**
 * @param {string} channelId
 * @returns {Object[]}
 */
function getMembers(channelId) {
  let token = getScriptProperties().SLACK_TOKEN;

  let data = {
    channel: channelId,
  };
  return getApi(token, "conversations.members", data).members;
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
  let token = getScriptProperties().SLACK_TOKEN;

  let data = {
    user: userId,
  }
  return getApi(token,"users.info", data).user;
}


/**
 * @param {string} token
 * @param {string} channelId
 * @param {string} appId
 */
function disarmLastMessage(token, channelId, appId) {
  let nextCursor = "";
  for (let repeat = 0; repeat < 10; repeat++) {
    let history = readHistory(token, channelId, nextCursor);

    if (!history.messages) return;

    for (let message of history.messages) {
      if (message.app_id === appId) {
        let data = {
          channel: channelId,
          ts: message.ts,
          blocks: removeActions(message.blocks),
        }

        postApi(token, "chat.update", data);
        return;
      }
    }

    if (!history.has_more) break;

    nextCursor = history.response_metadata.next_cursor;
  }
}


/**
 * @param {string} channelId
 */
function disarmLastMessageUi(channelId) {
  let props = getScriptProperties();

  disarmLastMessage(props.SLACK_TOKEN, channelId, props.SLACK_APP_ID);
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
    let footer = `Next time it's ${nextAfterName}'${suffix} turn${next.slackId === afterNext.slackId ? " again" : ""}`;
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
  return blocks.filter((block) => block.type !== "actions");
}


/**
 * @param {Object} message
 * @param {Object[]} message.blocks
 * @param {string} responseUrl
 */
function markMessageSkipped(message, responseUrl) {
  let token = getScriptProperties().SLACK_TOKEN;

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

  post(token, responseUrl, data);
}


/**
 * @param {Host} next
 * @param {Host} afterNext
 * @param {Object} params
 * @param {string} [params.channelId]
 * @param {string} [params.responseUrl]
 */
function sendMessage(next, afterNext, params) {
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
    post(props.SLACK_TOKEN, params.responseUrl, data);
  } else if (params.channelId) {
    disarmLastMessage(props.SLACK_TOKEN, params.channelId, props.SLACK_APP_ID);
    data.channel = params.channelId;
    postApi(props.SLACK_TOKEN, "chat.postMessage", data);
  }
}


/**
 * @param {string} channelId
 */
function joinChannel(channelId) {
  let token = getScriptProperties().SLACK_TOKEN;

  let data = {
    channel: channelId,
  }
  postApi(token, "conversations.join", data);
}


/**
 * @param {string} channelId
 */
function leaveChannel(channelId) {
  let token = getScriptProperties().SLACK_TOKEN;

  let data = {
    channel: channelId,
  }
  postApi(token, "conversations.leave", data);
}


/**
 * @param {string} channelId
 * @returns {boolean}
 */
function checkChannel(channelId) {
  let token = getScriptProperties().SLACK_TOKEN;

  let data = {
    channel: channelId,
  };
  let result = getApi(token, "conversations.info", data);
  console.log(result);
  return result.ok;
}


function debugGetMembers() {
  let sheet = SpreadsheetApp.getActive().getSheets()[1];
  console.log(getMembers(sheet.getName()));
}


function debugGetUserInfo() {
  let sheet = SpreadsheetApp.getActive().getSheets()[1];
  let userId = sheet.getRange(1, 2).getValue();
  console.log(getUserInfo(userId));
}
