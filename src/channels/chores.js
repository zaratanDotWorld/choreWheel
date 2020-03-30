const callback_id = "modal_list";

async function list(db) {
  const options = await getOptions(db);

  return {
    "type": "modal",
    "callback_id": callback_id,
    "title": {
      "type": "plain_text",
      "text": "Chores",
      "emoji": true
    },
    "submit": {
      "type": "plain_text",
      "text": "Submit",
      "emoji": true
    },
    "close": {
      "type": "plain_text",
      "text": "Cancel",
      "emoji": true
    },
    "blocks": [
      {
        "type": "input",
        "block_id": "chore_input",
        "label": {
          "type": "plain_text",
          "text": "🧹 Choose a chore",
          "emoji": true
        },
        "element": {
          "type": "radio_buttons",
          "action_id": "chore_select",
          "options": options,
        }
      }
    ]
  }
}


async function getOptions(db) {
  const options = await db.getChores();

  // [
  //   {
  //     id: 1,
  //     created_at: '2020-03-29 22:01:03',
  //     updated_at: '2020-03-29 22:01:03',
  //     name: 'dishes'
  //   },
  //   {
  //     id: 2,
  //     created_at: '2020-03-29 22:01:03',
  //     updated_at: '2020-03-29 22:01:03',
  //     name: 'sweeping'
  //   },
  //   {
  //     id: 3,
  //     created_at: '2020-03-29 22:01:03',
  //     updated_at: '2020-03-29 22:01:03',
  //     name: 'restock'
  //   }
  // ]

  return options.map(option => {
    return {
      "text": {
        "type": "plain_text",
        "text": option.name,
        "emoji": true
      },
      "value": option.id.toString(),
      "description": {
        "type": "plain_text",
        "text": option.created_at
      }
    }
  })
}

exports.callback_id = callback_id;
exports.list = list;
