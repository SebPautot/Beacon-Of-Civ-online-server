//NODE JS UTILS
var compatibleGameVersions = [1];

const util = require('util');

const WebSocket = require('ws');

const wss = new WebSocket.Server({ port: 8080 });

var sessions = [];
var sessionsID = [];

wss.on('connection', function connection(ws) {
  console.log("connection");
  ws.on('message', function incoming(message) {


    // console.log(ws);

    var args = message.split("_");

    console.log('received: %s', args[0]);


    //CREATE 0 : create 1 : username 2: GAMEVERSION
    if (args[0] == "create") {

      if (!compatibleGameVersions.includes(parseInt(args[2])))
        return ws.close();

      //FORMAT : create_username:username

      removeUserFromCurrentLobby(ws);
      //CREATE SESSION ID
      var correct = false;

      while (!correct) {
        var newSessionId = makeid(5);
        correct = true;
        if (sessions[newSessionId])
          correct = false;
      }

      sessionsID.push(newSessionId);

      //SETUP SESSION
      sessions[newSessionId] =
      {
        id: newSessionId,
        created: {
          ws: ws,
          username: args[1]
        },
        users: [
          {
            username: args[1],
            ws: ws,
            data: {
              previewBalls: [],
              currentLine: null,
              vsBarAmount: null,
              timeSinceLaunch: null,
              cannonColumn: null,
              grid: {},
              points: null
            }
          }
        ],
        ColorGrid: [],
        maxUsers: 2
      };

      //UPDATE CLIENT
      ws.send('created_' + newSessionId);
    }

    //JOIN 0 : "join" 1 : session 2 : username 3 : GAMEVERSION
    if (message.startsWith('join')) {

      if (!compatibleGameVersions.includes(parseInt(args[3]))) {
        return ws.send("error_Game version not supported : " + compatibleGameVersions);
      }



      if (sessions[args[1]]) {
        sessions[args[1]].users.forEach(user => {
          if (user.ws == ws) {
            ws.send("error_You already joined lobby " + args[1]);
          } else {



            sessions[args[1]].users.push({
              username: args[1].replace("username:", ""),
              ws: ws,
              data: {
                previewBalls: [],
                vsBarAmount: null,
                timeSinceLaunch: null,
                cannonColumn: null,
                grid: {},
                points: null
              }
            })

            ws.send("joined_" + sessions[args[1]].created.username);

            if (sessions[args[1]].users.length == sessions[args[1]].maxUsers) {

              startGame(args);

            }
          }
        })
      } else {
        ws.send("error_Lobby doesn't exist");
      }

    }



    //PLAYER ACTIONS
    //send -> moveRight moveLeft shootCube

    if (args[0] == "moveLeft" || args[0] == "moveRight" || args[0] == "shootCube") {

      sessions[args[1]].users.forEach(user => {

        if (user.ws != ws) {
          user.ws.send(args[0]);
        }

      })
    }

    //GRID MANAGEMENT
    //0 1:session 2:grid
    if (message.startsWith('updateGrid')) {

      sessions[args[1]].users.forEach(user => {

        if (user.ws == ws) {
          user.data.grid = args[2];
        } else {
          user.ws.send("updateGrid_" + args[2]);
        }
      })
    }

    //0 1:session 2/3/4:previewBalls
    if (message.startsWith('updatePreviewBalls')) {

      sessions[args[1]].users.forEach(user => {
        if (user.ws == ws) {
          user.data.previewBalls[0] = args[2];
          user.data.previewBalls[1] = args[3];
          user.data.previewBalls[2] = args[4];
        } else {
          user.ws.send("updatePreviewBalls_" + args[2] + "_" + args[3] + "_" + args[4])
        }
      })

    }
    //0 1:session 2: cannon position
    if (message.startsWith('updatePreviewCannon')) {

    }
    //0 1:session 2:points 3:bar points 4:joker points 5: joker amount
    if (message.startsWith('updatePoints')) {
      sessions[args[1]].users.forEach(user => {
        if (user.ws == ws) {
          user.points = args[2];
          user.vsBarAmount = args[3];
        } else {
          user.ws.send("updatePlayerPoints_" + args[2]);
          user.ws.send("updateVSPoints_" + args[3]);
          user.ws.send("updateJokerPoints_" + args[4]);
          user.ws.send("updateJokerAmount_" + args[5]);
        }
      })
    }

    //0 1:session
    if (message.startsWith("generateColorGrid")) {
      generateColorGrid(sessions[args[1]]);
    }

    if (message.startsWith("lose")) {
      sessions[args[1]].users.forEach(user => {
        if (user.ws != ws) {
          user.ws.send("win");
          user.ws.close();
        }
      })
    }

    if (message.startsWith("generateRow")) {
      sessions[args[1]].users.forEach(user => {
        if (user.ws != ws) {
          user.ws.send("generateRow");
        }
      })
    }




    // console.log('sessions : ');
    // console.log(sessions);
  });

  ws.on('close', function closing(message) {
    console.log('Closing');

    sessionsID.forEach(ID => {
      sessions[ID].users.forEach(usercheck => {
        if (usercheck.ws == ws && sessions[ID] != null) {
          sessions[ID].users.forEach(user => {
            user.ws.close();


          })

          sessions[ID] = null;
          sessionsID.splice(sessionsID.indexOf(ID));
        }
      })
    })
  })
});

function removeUserFromCurrentLobby(ws) {
  sessionsID.forEach(ID => {
    if (sessions[ID].users > 1) {
      sessions[ID].users.forEach(user => {
        if (user.ws == ws) {
          user.ws.send("error_You left lobby " + ID);
          sessions[ID].users.forEach(userx => {
            userx.ws.send("error_" + user.username + " left lobby " + ID);
          })
          sessions[ID].users.splice(sessions[ID].users.indexOf(user), 1);

        }
      })
    } else {
      sessions[ID] = null;
      sessionsID.splice(sessionsID.indexOf(ID));
    }
  })
}



//START GAME

function startGame(args) {
  var session = sessions[args[1]];

  session.users.forEach(user => {
    user.ws.send("startGame");
  });

  generateColorGrid(session);
}



function generateColorGrid(session) {
  var gridMalus = 25;

  var colorGrid = Array.from(Array(10), () => new Array(100));

  //LINE
  for (i = 0; i < 100; i++) {
    //COLUMN
    var pbBalleB = 25;
    var pbBalleR = 25;
    var pbBalleO = 25;
    var pbBalleV = 25;

    for (j = 0; j < 10; j++) {
      generatedNumber = Math.random() * 100;

      if (generatedNumber >= 0 && generatedNumber < pbBalleB) {
        colorGrid[j][i] = ["B"];
        pbBalleB -= gridMalus;
        pbBalleR += gridMalus / 3;
        pbBalleO += gridMalus / 3;
        pbBalleV += gridMalus / 3;
      } else if (generatedNumber >= pbBalleB && generatedNumber < pbBalleB + pbBalleR) {
        colorGrid[j][i] = ["R"];
        pbBalleB += gridMalus / 3;
        pbBalleR -= gridMalus;
        pbBalleO += gridMalus / 3;
        pbBalleV += gridMalus / 3;
      } else if (generatedNumber >= pbBalleB + pbBalleR && generatedNumber < pbBalleB + pbBalleR + pbBalleO) {
        colorGrid[j][i] = ["O"];
        pbBalleB += gridMalus / 3;
        pbBalleR += gridMalus / 3;
        pbBalleO -= gridMalus;
        pbBalleV += gridMalus / 3;
      } else if (generatedNumber >= pbBalleB + pbBalleR + pbBalleO && generatedNumber < pbBalleB + pbBalleR + pbBalleO + pbBalleV) {
        colorGrid[j][i] = ["V"];
        pbBalleB += gridMalus / 3;
        pbBalleR += gridMalus / 3;
        pbBalleO += gridMalus / 3;
        pbBalleV -= gridMalus;
      }

    }
  }




  var completeColorGrid = {
    "c2array": true,
    "size": [10, 100, 1],
    "data": colorGrid
  }

  session.ColorGrid = completeColorGrid;

  // console.log(JSON.stringify(completeColorGrid));

  session.users.forEach(user => {
    user.ws.send(`updateColorGrid_${JSON.stringify(completeColorGrid)}`);
  })


}



//GENERATE RANDOM STRING
function makeid(length) {
  var result = [];
  var characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var charactersLength = characters.length;
  for (var i = 0; i < length; i++) {
    result.push(characters.charAt(Math.floor(Math.random() *
      charactersLength)));
  }
  return result.join('');
}